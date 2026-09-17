import { Router, Request, Response } from 'express';
import {
  getActiveProvider, getActiveProviderName, listProviderFiles,
  testProvider, readProviderConfig,
} from '../ai/factory';
import { settingsQueries, apiKeyQueries, aiSessionQueries, sectionQueries } from '../db/database';
import type { ResumeSection } from '../types';

const router = Router();

// ─── Provider management ──────────────────────────────────────────────────────

router.get('/providers', (_req: Request, res: Response) => {
  try { res.json(listProviderFiles()); }
  catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get('/providers/active', (_req: Request, res: Response) => {
  try {
    const name = getActiveProviderName();
    const config = readProviderConfig(name);
    const hasKey = !!apiKeyQueries.get(config.provider);
    res.json({
      provider: config.provider,
      name: config.name,
      model: config.models?.default,
      models: config.models?.options,
      features: Object.entries(config.features ?? {}).filter(([, v]) => (v as { enabled?: boolean })?.enabled).map(([k]) => k),
      has_api_key: hasKey,
      local: config.local ?? false,
    });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.put('/providers/active', (req: Request, res: Response) => {
  try {
    const { provider, model } = req.body as { provider?: string; model?: string };
    if (!provider) return void res.status(400).json({ error: 'provider is required' });
    settingsQueries.set('active_provider', provider);
    if (model) {
      settingsQueries.set(`provider_model_${provider}`, model);
    }
    res.json({ ok: true, active_provider: provider, model });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/providers/test', async (req: Request, res: Response) => {
  try {
    const { provider, api_key, model } = req.body as { provider?: string; api_key?: string; model?: string };
    if (!provider) return void res.status(400).json({ error: 'provider is required' });
    const finalKey = api_key || apiKeyQueries.get(provider) || '';
    const result = await testProvider(provider, finalKey, model);
    res.json({ ok: true, result });
  } catch (e) { res.status(400).json({ ok: false, error: (e as Error).message }); }
});

router.post('/providers/key', (req: Request, res: Response) => {
  try {
    const { provider, api_key } = req.body as { provider?: string; api_key?: string };
    if (!provider || !api_key) return void res.status(400).json({ error: 'provider and api_key required' });
    apiKeyQueries.set(provider, api_key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.delete('/providers/key/:provider', (req: Request, res: Response) => {
  try {
    apiKeyQueries.delete(String(req.params.provider));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionsToPlainText(sections: ResumeSection[]): string {
  return sections.map(s => {
    const lines = [`== ${s.title} ==`];
    for (const entry of s.content) {
      if (typeof entry === 'string') { lines.push(entry); continue; }
      const e = entry as Record<string, unknown>;
      if (e.text) lines.push(e.text as string);
      else if (e.company) {
        lines.push(`${e.role} at ${e.company} (${e.start_date}–${e.end_date})`);
        if (Array.isArray(e.bullets)) lines.push(...(e.bullets as string[]).map(b => `• ${b}`));
      } else if (Array.isArray(e.items)) lines.push((e.items as string[]).join(', '));
      else lines.push(JSON.stringify(entry));
    }
    return lines.join('\n');
  }).join('\n\n');
}

// ─── AI task routes ────────────────────────────────────────────────────────────

router.post('/redline', async (req: Request, res: Response) => {
  try {
    const { resume_id, section_id, context } = req.body as {
      resume_id?: string; section_id?: string; context?: string;
    };
    if (!section_id) return void res.status(400).json({ error: 'section_id required' });
    const section = sectionQueries.get(section_id);
    if (!section) return void res.status(404).json({ error: 'Section not found' });

    const sectionText = section.content.map(e => {
      const entry = e as Record<string, unknown>;
      return entry.text ?? JSON.stringify(e);
    }).join('\n');

    const provider = getActiveProvider();
    const result = await provider.redline(section.title, sectionText, context);
    const sessionId = aiSessionQueries.create({
      resume_id: resume_id ?? '', section_id,
      task_type: 'redline', provider: provider.info.provider, model: provider.info.model,
      input_text: sectionText, output_text: JSON.stringify(result), job_desc: null, score: null,
    });
    res.json({ session_id: sessionId, ...result });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/rewrite', async (req: Request, res: Response) => {
  try {
    const { bullet, tone, role, resume_id, section_id } = req.body as {
      bullet?: string; tone?: string; role?: string; resume_id?: string; section_id?: string;
    };
    if (!bullet) return void res.status(400).json({ error: 'bullet required' });
    const provider = getActiveProvider();
    const result = await provider.rewrite(bullet, tone, role);
    if (resume_id) {
      aiSessionQueries.create({
        resume_id, section_id: section_id ?? null,
        task_type: 'rewrite', provider: provider.info.provider, model: provider.info.model,
        input_text: bullet, output_text: JSON.stringify(result), job_desc: null, score: null,
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/ats-score', async (req: Request, res: Response) => {
  try {
    const { resume_id, job_description } = req.body as { resume_id?: string; job_description?: string };
    if (!resume_id || !job_description) return void res.status(400).json({ error: 'resume_id and job_description required' });
    const sections = sectionQueries.list(resume_id);
    const resumeText = sectionsToPlainText(sections);
    const provider = getActiveProvider();
    const result = await provider.atsScore(resumeText, job_description);
    aiSessionQueries.create({
      resume_id, section_id: null, task_type: 'ats_score',
      provider: provider.info.provider, model: provider.info.model,
      input_text: resumeText, output_text: JSON.stringify(result),
      job_desc: job_description, score: (result as { overall_score?: number }).overall_score ?? null,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/keyword-gap', async (req: Request, res: Response) => {
  try {
    const { resume_id, job_description } = req.body as { resume_id?: string; job_description?: string };
    if (!resume_id || !job_description) return void res.status(400).json({ error: 'resume_id and job_description required' });
    const sections = sectionQueries.list(resume_id);
    const resumeText = sectionsToPlainText(sections);
    const provider = getActiveProvider();
    const result = await provider.keywordGap(resumeText, job_description);
    aiSessionQueries.create({
      resume_id, section_id: null, task_type: 'keyword_gap',
      provider: provider.info.provider, model: provider.info.model,
      input_text: resumeText, output_text: JSON.stringify(result),
      job_desc: job_description, score: null,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get('/sessions/:resumeId', (req: Request, res: Response) => {
  try {
    const sessions = aiSessionQueries.list(String(req.params.resumeId));
    res.json(sessions.map(s => ({ ...s, output: s.output_text ? JSON.parse(s.output_text) : null })));
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.post('/sessions/:id/accept', (req: Request, res: Response) => {
  try {
    aiSessionQueries.accept(String(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
