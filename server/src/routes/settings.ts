import { Router, Request, Response } from 'express';
import { settingsQueries } from '../db/database';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try { res.json(settingsQueries.all()); }
  catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.put('/', (req: Request, res: Response) => {
  try {
    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      settingsQueries.set(key, String(value));
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get('/:key', (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    const value = settingsQueries.get(key);
    if (value === undefined) return void res.status(404).json({ error: 'Key not found' });
    res.json({ key, value });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.put('/:key', (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    settingsQueries.set(key, String((req.body as { value: unknown }).value));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

export default router;
