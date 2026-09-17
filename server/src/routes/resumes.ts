import { Router, Request, Response } from 'express';
import { resumeQueries, sectionQueries } from '../db/database';

const router = Router();

// GET /api/resumes
router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(resumeQueries.list());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/resumes/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });
    const sections = sectionQueries.list(id);
    res.json({ ...resume, sections });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/resumes
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, template_id, version_tag, meta } = req.body as {
      name?: string; template_id?: string; version_tag?: string; meta?: Record<string, unknown>;
    };
    if (!name) return void res.status(400).json({ error: 'name is required' });

    const id = resumeQueries.create({ name, template_id, version_tag, meta });

    const defaultSections: Array<Parameters<typeof sectionQueries.upsert>[0]> = [
      { resume_id: id, section_type: 'header',     title: 'Contact Information',  content: [{ name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '' }], position: 0 },
      { resume_id: id, section_type: 'summary',    title: 'Professional Summary', content: [{ text: '' }],  position: 1 },
      { resume_id: id, section_type: 'experience', title: 'Work Experience',       content: [], position: 2 },
      { resume_id: id, section_type: 'education',  title: 'Education',            content: [], position: 3 },
      { resume_id: id, section_type: 'skills',     title: 'Skills',               content: [], position: 4 },
    ];
    for (const s of defaultSections) sectionQueries.upsert(s);

    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// PUT /api/resumes/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resume = resumeQueries.get(id);
    if (!resume) return void res.status(404).json({ error: 'Not found' });
    resumeQueries.update(id, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// DELETE /api/resumes/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    resumeQueries.delete(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/resumes/:id/duplicate
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const newId = resumeQueries.duplicate(id, (req.body as { name?: string }).name);
    if (!newId) return void res.status(404).json({ error: 'Source not found' });
    res.json({ id: newId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ─── Section sub-routes ───────────────────────────────────────────────────────

router.get('/:id/sections', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    res.json(sectionQueries.list(id));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/:id/sections', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const body = req.body as Parameters<typeof sectionQueries.upsert>[0];
    const sectionId = sectionQueries.upsert({ ...body, resume_id: id });
    res.json({ id: sectionId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:id/sections/:sectionId', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sectionId = String(req.params.sectionId);
    const body = req.body as Parameters<typeof sectionQueries.upsert>[0];
    sectionQueries.upsert({ ...body, id: sectionId, resume_id: id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/:id/sections/:sectionId', (req: Request, res: Response) => {
  try {
    const sectionId = String(req.params.sectionId);
    sectionQueries.delete(sectionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/:id/sections/reorder', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { orderedIds } = req.body as { orderedIds: string[] };
    sectionQueries.reorder(id, orderedIds);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
