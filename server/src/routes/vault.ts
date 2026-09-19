import { Router, Request, Response } from "express";
import { vaultQueries, qaQueries } from "../db/database";
import { embedText, searchSimilarQA } from "../ai/embedding";
import { getActiveProvider } from "../ai/factory";
import { PROMPTS } from "../ai/prompts";
import type { QAEntry } from "../types";

const router = Router();

// ─── Metadata Endpoints ───────────────────────────────────────────────────────

router.get("/meta", (_req: Request, res: Response) => {
  try {
    const meta = vaultQueries.getMetadata();
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/meta", (req: Request, res: Response) => {
  try {
    const updated = vaultQueries.updateMetadata(req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Q&A Endpoints ───────────────────────────────────────────────────────────

router.get("/qa", (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const entries = qaQueries.list(category);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/qa", async (req: Request, res: Response) => {
  try {
    const {
      question,
      answer,
      category = "General",
      tags = [],
    } = req.body as {
      question?: string;
      answer?: string;
      category?: string;
      tags?: string[];
    };

    if (!question?.trim() || !answer?.trim()) {
      return void res
        .status(400)
        .json({ error: "Question and answer are required" });
    }

    // Compute embedding for semantic matching
    const textToEmbed = `${question.trim()}. ${answer.trim()}`;
    const { embedding, model } = await embedText(textToEmbed);

    const id = qaQueries.create({
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim(),
      tags,
      embedding,
      embedding_model: model,
    });

    const created = qaQueries.get(id);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/qa/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const existing = qaQueries.get(id);
    if (!existing) {
      return void res.status(404).json({ error: "Q&A entry not found" });
    }

    const { question, answer, category, tags } = req.body as Partial<QAEntry>;
    const newQ = question !== undefined ? question.trim() : existing.question;
    const newA = answer !== undefined ? answer.trim() : existing.answer;

    let embedding = existing.embedding;
    let model = existing.embedding_model;

    // If text changed, recompute embedding
    if (
      newQ !== existing.question ||
      newA !== existing.answer ||
      !existing.embedding
    ) {
      const textToEmbed = `${newQ}. ${newA}`;
      const result = await embedText(textToEmbed);
      embedding = result.embedding;
      model = result.model;
    }

    qaQueries.update(id, {
      question: newQ,
      answer: newA,
      category: category ?? existing.category,
      tags: tags ?? existing.tags,
      embedding,
      embedding_model: model,
    });

    const updated = qaQueries.get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete("/qa/:id", (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    qaQueries.delete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Semantic Search ──────────────────────────────────────────────────────────

router.post("/qa/search", async (req: Request, res: Response) => {
  try {
    const {
      query,
      limit = 6,
      min_similarity = 0.2,
      category,
    } = req.body as {
      query?: string;
      limit?: number;
      min_similarity?: number;
      category?: string;
    };

    if (!query?.trim()) {
      return void res.json([]);
    }

    const allEntries = qaQueries.getAllForSearch();
    const results = await searchSimilarQA(query, allEntries, {
      limit: Number(limit),
      minSimilarity: Number(min_similarity),
      category,
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Re-index All Embeddings ──────────────────────────────────────────────────

router.post("/qa/reindex", async (_req: Request, res: Response) => {
  try {
    const all = qaQueries.getAllForSearch();
    let updatedCount = 0;

    for (const entry of all) {
      const textToEmbed = `${entry.question}. ${entry.answer}`;
      const { embedding, model } = await embedText(textToEmbed);
      qaQueries.updateEmbedding(entry.id, embedding, model);
      updatedCount++;
    }

    res.json({ ok: true, count: updatedCount });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Seed Starter Questions ───────────────────────────────────────────────────

router.post("/qa/seed", async (_req: Request, res: Response) => {
  try {
    const starters = [
      {
        question: "What was your proudest engineering project?",
        answer:
          "At my previous role, I architected and led the complete migration of a monolithic batch data pipeline into an event-driven streaming architecture using Node.js, Kafka, and Redis. This reduced end-to-end processing latency from 45 minutes to sub-second real-time across 10M+ daily events. I designed fault-tolerant retry queues with dead-letter buffering, achieving 99.99% message delivery reliability and saving an estimated $120k annually in cloud compute overhead.",
        category: "Engineering & Projects",
        tags: ["architecture", "scalability", "performance", "cloud"],
      },
      {
        question:
          "Describe a difficult technical bug or challenge you diagnosed and resolved.",
        answer:
          "We encountered non-deterministic database lock timeouts during peak traffic that caused cascading connection pool exhaustion. By profiling low-level query logs and analyzing write-ahead log (WAL) checkpoints in SQLite and PostgreSQL, I identified an unindexed composite foreign key constraint combined with an un-scoped transaction wrapper. I refactored the execution into atomic idempotent batches and added targeted compound indexes, dropping p99 query latency from 3.8s to 12ms and eliminating timeouts completely.",
        category: "Engineering & Projects",
        tags: ["debugging", "database", "optimization", "backend"],
      },
      {
        question:
          "Tell me about a time you had a disagreement with a teammate or stakeholder on technical design.",
        answer:
          "During an API redesign, a senior peer proposed a complex GraphQL schema while I advocated for RESTful OpenAPI specs due to our team’s existing client SDKs and strict caching constraints. Rather than debating opinions, I built a rapid 2-day proof of concept measuring client latency, payload over-fetching, and cache invalidation complexity. We reviewed the empirical data together, agreed on a pragmatic REST approach with sparse fieldsets, and shipped 3 weeks ahead of schedule.",
        category: "Behavioral & Leadership",
        tags: ["collaboration", "communication", "conflict-resolution"],
      },
      {
        question:
          "Why are you looking for your next opportunity and why this role?",
        answer:
          "Over the past three years, I have strengthened my skills in building resilient distributed systems and mentoring engineers. I am now seeking a high-impact environment where I can tackle deeper architectural scalability challenges, collaborate with curious product teams, and directly influence engineering culture and technical velocity.",
        category: "Culture & Motivation",
        tags: ["motivation", "career-growth", "culture"],
      },
      {
        question: "What are your compensation expectations?",
        answer:
          "Based on current market benchmarks for a Senior Software Engineer with my track record in distributed backend systems and frontend architecture, my target total compensation is in the range of $160,000 - $185,000 base salary, along with standard equity and comprehensive benefits. I am flexible and primarily focused on the overall scope, ownership, and team impact.",
        category: "Compensation & Logistics",
        tags: ["salary", "compensation", "expectations"],
      },
    ];

    const inserted: string[] = [];
    for (const item of starters) {
      const textToEmbed = `${item.question}. ${item.answer}`;
      const { embedding, model } = await embedText(textToEmbed);
      const id = qaQueries.create({
        question: item.question,
        answer: item.answer,
        category: item.category,
        tags: item.tags,
        embedding,
        embedding_model: model,
      });
      inserted.push(id);
    }

    res.json({ ok: true, count: inserted.length, ids: inserted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── AI Answer Morpher ────────────────────────────────────────────────────────

router.post("/qa/morph", async (req: Request, res: Response) => {
  try {
    const {
      originalQuestion,
      originalAnswer,
      targetQuestion,
      instructions = "",
      model,
    } = req.body as {
      originalQuestion?: string;
      originalAnswer?: string;
      targetQuestion?: string;
      instructions?: string;
      model?: string;
    };

    if (!originalAnswer?.trim() || !targetQuestion?.trim()) {
      return void res
        .status(400)
        .json({ error: "originalAnswer and targetQuestion are required" });
    }

    const prompt = PROMPTS.morphQA(
      originalQuestion?.trim() || "General Experience",
      originalAnswer.trim(),
      targetQuestion.trim(),
      instructions.trim(),
    );

    try {
      const provider = getActiveProvider(model);
      // We call rewrite or import_parse endpoint or generic feature
      // HttpProvider supports calling configured features. Let's check available endpoint
      // Most providers have 'rewrite' or 'chat' or test. Let's execute via provider.call:
      let rawResult: any;
      const endpointName =
        (provider as any).config?.features?.rewrite?.endpoint ||
        "chat" ||
        "generate";
      if ((provider as any).config?.endpoints?.[endpointName]) {
        rawResult = await provider.call(endpointName, prompt);
      } else {
        // Fallback to first available endpoint with prompt
        const endpoints = Object.keys(
          (provider as any).config?.endpoints ?? {},
        );
        const ep =
          endpoints.find(
            (e) =>
              e.includes("chat") ||
              e.includes("complete") ||
              e.includes("rewrite"),
          ) || endpoints[0];
        rawResult = await provider.call(ep, prompt);
      }

      let parsed = rawResult;
      if (typeof rawResult === "string") {
        const cleaned = rawResult
          .replace(/^```json\s*/im, "")
          .replace(/^```\s*/im, "")
          .replace(/\s*```\s*$/im, "")
          .trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = { morphed_answer: rawResult };
        }
      }

      return void res.json({
        ok: true,
        morphed_answer:
          parsed.morphed_answer || parsed.rewritten || String(rawResult),
        key_adaptations: parsed.key_adaptations || [
          "Reframed experience for target question",
        ],
        suggested_tags: parsed.suggested_tags || ["interview", "experience"],
        suggested_category: parsed.suggested_category || "Experience",
        provider: provider.info.name,
      });
    } catch (aiErr) {
      console.warn(
        "[Morph] AI provider call failed, generating smart structured response:",
        aiErr,
      );
      // Smart offline / fallback synthesis if no API key or provider is offline
      const synthesized = `Addressing "${targetQuestion.trim()}": Building on my proven experience, ${originalAnswer.trim()}`;
      return void res.json({
        ok: true,
        morphed_answer: synthesized,
        key_adaptations: ["Adapted to target context (offline mode)"],
        suggested_tags: ["adapted", "experience"],
        suggested_category: "Experience",
        fallback: true,
      });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
