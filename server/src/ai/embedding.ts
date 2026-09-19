import type { QAEntry, QASearchResult } from '../types';

let pipelinePromise: Promise<any> | null = null;
const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const FALLBACK_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Lazy initialize the Hugging Face feature extraction pipeline.
 */
async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        const { pipeline } = await import('@huggingface/transformers');
        try {
          return await pipeline('feature-extraction', MODEL_NAME, { dtype: 'fp32' });
        } catch (err) {
          console.warn(`[Embedding] Primary model ${MODEL_NAME} failed, trying fallback ${FALLBACK_MODEL}:`, err);
          return await pipeline('feature-extraction', FALLBACK_MODEL, { dtype: 'fp32' });
        }
      } catch (e) {
        console.error('[Embedding] Failed to load @huggingface/transformers pipeline:', e);
        return null;
      }
    })();
  }
  return pipelinePromise;
}

/**
 * Fast deterministic bag-of-words pseudo-embedding for instant offline fallback (384 dimensions).
 */
function computeFallbackEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * Calculate Cosine Similarity between two normalized or unnormalized float arrays.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

/**
 * Compute token overlap ratio for hybrid ranking boost.
 */
function tokenOverlap(query: string, target: string): number {
  const qTokens = new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  const tTokens = new Set(target.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  if (qTokens.size === 0 || tTokens.size === 0) return 0;

  let common = 0;
  for (const token of qTokens) {
    if (tTokens.has(token)) common++;
  }
  return common / Math.max(qTokens.size, 1);
}

/**
 * Embed a text string using the neural multilingual model with fallback.
 */
export async function embedText(text: string): Promise<{ embedding: number[]; model: string }> {
  const clean = text.trim();
  if (!clean) {
    return { embedding: new Array(384).fill(0), model: 'empty' };
  }

  try {
    const extractor = await getPipeline();
    if (extractor) {
      const output = await extractor(clean, { pooling: 'mean', normalize: true });
      const rawData = Array.from(output.data as Float32Array | number[]);
      return {
        embedding: rawData,
        model: MODEL_NAME,
      };
    }
  } catch (err) {
    console.warn('[Embedding] Neural extraction failed, using fallback:', err);
  }

  return {
    embedding: computeFallbackEmbedding(clean),
    model: 'fallback-bow-384',
  };
}

/**
 * Perform semantic similarity search across Q&A entries.
 */
export async function searchSimilarQA(
  query: string,
  entries: QAEntry[],
  options: { limit?: number; minSimilarity?: number; category?: string } = {}
): Promise<QASearchResult[]> {
  const { limit = 8, minSimilarity = 0.25, category } = options;
  if (!query.trim() || entries.length === 0) return [];

  // Filter by category if specified
  const candidatePool = (category && category !== 'All')
    ? entries.filter(e => e.category.toLowerCase() === category.toLowerCase())
    : entries;

  if (candidatePool.length === 0) return [];

  // Embed the query
  const { embedding: queryEmbedding } = await embedText(query);

  const scored: QASearchResult[] = candidatePool.map(entry => {
    let similarity = 0;
    if (entry.embedding && entry.embedding.length === queryEmbedding.length) {
      similarity = cosineSimilarity(queryEmbedding, entry.embedding);
    } else {
      // If entry had no embedding or dimension mismatch, compute fallback cosine
      const fallbackEntryVec = computeFallbackEmbedding(`${entry.question} ${entry.answer}`);
      const fallbackQueryVec = computeFallbackEmbedding(query);
      similarity = cosineSimilarity(fallbackQueryVec, fallbackEntryVec);
    }

    // Hybrid boost: combine vector cosine (85%) with lexical keyword overlap (15%)
    const keywordMatch = Math.max(
      tokenOverlap(query, entry.question),
      tokenOverlap(query, entry.answer) * 0.7
    );
    const finalScore = Math.min(1.0, (similarity * 0.85) + (keywordMatch * 0.15));

    let match_confidence: 'high' | 'medium' | 'low' = 'low';
    if (finalScore >= 0.75) {
      match_confidence = 'high';
    } else if (finalScore >= 0.50) {
      match_confidence = 'medium';
    }

    return {
      ...entry,
      similarity: Math.round(finalScore * 100) / 100,
      match_confidence,
    };
  });

  // Filter by minimum similarity and sort descending
  return scored
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
