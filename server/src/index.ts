import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { getDb } from './db/database';
import resumeRoutes from './routes/resumes';
import aiRoutes from './routes/ai';
import settingsRoutes from './routes/settings';
import exportRoutes from './routes/export';
import importRoutes from './routes/import';

const app = express();
const PORT = process.env.PORT ?? 3847;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5842', 'http://127.0.0.1:5842', 'http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Initialize DB on startup ─────────────────────────────────────────────────
try {
  getDb();
  console.log('✅ SQLite database ready');
} catch (e) {
  console.error('❌ Database initialization failed:', e);
  process.exit(1);
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/resumes',  resumeRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/export',   exportRoutes);
app.use('/api/import',   importRoutes);

// ─── Templates list ───────────────────────────────────────────────────────────
app.get('/api/templates', (_req, res) => {
  res.json([
    { id: 'modern',    name: 'Modern',    description: 'Clean two-column layout with sidebar and clear sections', category: 'modern',    is_ats_safe: false },
    { id: 'executive', name: 'Executive', description: 'Authoritative leadership format with dark banner and gold accents', category: 'executive', is_ats_safe: false },
    { id: 'tech',      name: 'Tech Lead', description: 'Developer-first terminal aesthetic with git timelines and monospace details', category: 'tech', is_ats_safe: false },
    { id: 'creative',  name: 'Creative',  description: 'Nordic editorial layout with gradient accents and contemporary card styling', category: 'creative', is_ats_safe: false },
    { id: 'compact',   name: 'Compact',   description: 'High-density single-page engineering format with concise spacing', category: 'compact',   is_ats_safe: false },
    { id: 'classic',   name: 'Classic',   description: 'Traditional serif typography with formal centered headings',    category: 'classic',   is_ats_safe: false },
    { id: 'minimal',   name: 'Minimal',   description: 'Clean balanced layout focused on your career experience',      category: 'minimal',   is_ats_safe: false },
    { id: 'ivy',       name: 'Ivy League', description: 'Distinguished academic serif standard with diamond small-caps headings', category: 'classic', is_ats_safe: false },
    { id: 'nordic',    name: 'Nordic',    description: 'Scandinavian warm minimalism with teal pill badges and serene timeline', category: 'modern', is_ats_safe: false },
    { id: 'elevate',   name: 'Elevate',   description: 'High-impact product leadership layout with vibrant gradient header and skills matrix', category: 'executive', is_ats_safe: false },
    { id: 'swiss',     name: 'Swiss Grid', description: 'Iconic International Typographic Style with asymmetric numeric index grid', category: 'creative', is_ats_safe: false },
    { id: 'ats',       name: 'ATS Pure',  description: 'Simple text format designed for hiring systems',         category: 'ats',       is_ats_safe: true  },
  ]);
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── Process Error Guards (Prevent Crash on Unhandled Errors) ──────────────────
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AuraCV server running on http://localhost:${PORT}`);
  console.log(`📁 DB: ${join(process.cwd(), 'auracv.db')}`);
  console.log(`📂 Providers: ${join(process.cwd(), 'providers/')}\n`);
});

export default app;
