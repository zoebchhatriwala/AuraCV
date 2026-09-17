import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { networkInterfaces } from 'os';
import type {
  ResumeRow, SectionRow, AISessionRow,
  Resume, ResumeSection, SectionType, SectionContent,
  ResumeMeta
} from '../types';

// Single source of truth SQLite database
const DB_PATH = join(__dirname, '..', '..', 'auracv.db');

let _db: DatabaseSync | null = null;

// ─── Encryption (AES-256, machine-fingerprint key) ────────────────────────────

function getMachineKey(): Buffer {
  const nets = networkInterfaces();
  const macs: string[] = [];
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') macs.push(iface.mac);
    }
  }
  const seed = macs.sort().join('|') || 'auracv-fallback-seed-2024';
  return createHash('sha256').update(seed).digest();
}

export function encrypt(text: string): string {
  const key = getMachineKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(data: string): string | null {
  try {
    const [ivHex, encHex] = data.split(':');
    const key = getMachineKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: DatabaseSync): void {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseResume(row: ResumeRow): Resume {
  return { ...row, meta: JSON.parse(row.meta || '{}') as ResumeMeta };
}

function parseSection(row: SectionRow): ResumeSection {
  return { ...row, content: JSON.parse(row.content || '[]') as SectionContent[] };
}

// ─── Resume queries ───────────────────────────────────────────────────────────

export const resumeQueries = {
  list(): Resume[] {
    const rows = getDb().prepare(`
      SELECT r.*, COUNT(rs.id) as section_count
      FROM resumes r
      LEFT JOIN resume_sections rs ON rs.resume_id = r.id
      GROUP BY r.id ORDER BY r.updated_at DESC
    `).all() as unknown as ResumeRow[];
    return rows.map(parseResume);
  },

  get(id: string): Resume | undefined {
    const row = getDb().prepare(`SELECT * FROM resumes WHERE id=?`).get(id) as unknown as ResumeRow | undefined;
    return row ? parseResume(row) : undefined;
  },

  create(data: Partial<Resume> & { name: string }): string {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO resumes (id, name, version_tag, template_id, meta)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.name, data.version_tag ?? 'v1', data.template_id ?? 'modern', JSON.stringify(data.meta ?? {}));
    return id;
  },

  update(id: string, data: Partial<Resume>): void {
    const existing = resumeQueries.get(id);
    if (!existing) return;
    getDb().prepare(`
      UPDATE resumes SET name=?, version_tag=?, template_id=?, meta=?, updated_at=datetime('now')
      WHERE id=?
    `).run(
      data.name ?? existing.name,
      data.version_tag ?? existing.version_tag,
      data.template_id ?? existing.template_id,
      JSON.stringify(data.meta ?? existing.meta),
      id
    );
  },

  delete(id: string): void {
    getDb().prepare(`DELETE FROM resumes WHERE id=?`).run(id);
  },

  duplicate(id: string, newName?: string): string | null {
    const db = getDb();
    const src = db.prepare(`SELECT * FROM resumes WHERE id=?`).get(id) as unknown as ResumeRow | undefined;
    if (!src) return null;
    const newId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO resumes (id, name, version_tag, template_id, meta, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId, newName ?? `${src.name} (copy)`, src.version_tag, src.template_id, src.meta, id);
    const sections = db.prepare(`SELECT * FROM resume_sections WHERE resume_id=?`).all(id) as unknown as SectionRow[];
    for (const s of sections) {
      db.prepare(`
        INSERT INTO resume_sections (id, resume_id, section_type, title, content, position, is_visible)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), newId, s.section_type, s.title, s.content, s.position, s.is_visible);
    }
    return newId;
  },
};

// ─── Section queries ──────────────────────────────────────────────────────────

export const sectionQueries = {
  list(resumeId: string): ResumeSection[] {
    const rows = getDb().prepare(`
      SELECT * FROM resume_sections WHERE resume_id=? ORDER BY position ASC
    `).all(resumeId) as unknown as SectionRow[];
    return rows.map(parseSection);
  },

  get(id: string): ResumeSection | undefined {
    const row = getDb().prepare(`SELECT * FROM resume_sections WHERE id=?`).get(id) as unknown as SectionRow | undefined;
    return row ? parseSection(row) : undefined;
  },

  upsert(data: Partial<ResumeSection> & { resume_id: string; section_type?: SectionType; title?: string }): string {
    const db = getDb();
    if (data.id) {
      const existing = sectionQueries.get(data.id);
      if (existing) {
        const title = data.title !== undefined ? data.title : existing.title;
        const content = data.content !== undefined ? JSON.stringify(data.content) : JSON.stringify(existing.content);
        const position = data.position !== undefined ? data.position : existing.position;
        const is_visible = data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : existing.is_visible;
        db.prepare(`
          UPDATE resume_sections
          SET title=?, content=?, position=?, is_visible=?, updated_at=datetime('now')
          WHERE id=?
        `).run(title, content, position, is_visible, data.id);
        return data.id;
      }
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO resume_sections (id, resume_id, section_type, title, content, position, is_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.resume_id, data.section_type ?? 'custom', data.title ?? 'Custom Section', JSON.stringify(data.content ?? []), data.position ?? 0, data.is_visible ?? 1);
    return id;
  },

  delete(id: string): void {
    const db = getDb();
    const row = db.prepare(`SELECT section_type FROM resume_sections WHERE id=?`).get(id) as { section_type: string } | undefined;
    if (row && row.section_type === 'header') {
      return; // Cannot delete header section
    }
    db.prepare(`DELETE FROM resume_sections WHERE id=?`).run(id);
  },

  reorder(resumeId: string, orderedIds: string[]): void {
    const db = getDb();
    // Verify if header section exists and ensure it is always anchored at position 0
    const headerRow = db.prepare(`SELECT id FROM resume_sections WHERE resume_id=? AND section_type='header'`).get(resumeId) as { id: string } | undefined;
    let finalOrderedIds = [...orderedIds];
    if (headerRow) {
      finalOrderedIds = [headerRow.id, ...finalOrderedIds.filter(id => id !== headerRow.id)];
    }
    const stmt = db.prepare(`UPDATE resume_sections SET position=? WHERE id=? AND resume_id=?`);
    db.exec('BEGIN TRANSACTION');
    try {
      finalOrderedIds.forEach((id, idx) => stmt.run(idx, id, resumeId));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};

// ─── Settings queries ─────────────────────────────────────────────────────────

export const settingsQueries = {
  get(key: string): string | undefined {
    const row = getDb().prepare(`SELECT value FROM settings WHERE key=?`).get(key) as unknown as { value: string } | undefined;
    return row?.value;
  },
  set(key: string, value: string): void {
    getDb().prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
    `).run(key, value);
  },
  all(): Record<string, string> {
    const rows = getDb().prepare(`SELECT key, value FROM settings`).all() as unknown as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};

// ─── API Key queries ──────────────────────────────────────────────────────────

export const apiKeyQueries = {
  set(provider: string, plainKey: string): void {
    getDb().prepare(`
      INSERT INTO api_keys (provider, encrypted, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(provider) DO UPDATE SET encrypted=excluded.encrypted, updated_at=datetime('now')
    `).run(provider, encrypt(plainKey));
  },
  get(provider: string): string | null {
    const row = getDb().prepare(`SELECT encrypted FROM api_keys WHERE provider=?`).get(provider) as unknown as { encrypted: string } | undefined;
    return row ? decrypt(row.encrypted) : null;
  },
  list(): Array<{ provider: string; updated_at: string }> {
    const rows = getDb().prepare(`SELECT provider, updated_at FROM api_keys`).all() as unknown as Array<{ provider: string; updated_at: string }>;
    return rows;
  },
  delete(provider: string): void {
    getDb().prepare(`DELETE FROM api_keys WHERE provider=?`).run(provider);
  },
};

// ─── AI Session queries ────────────────────────────────────────────────────────

export const aiSessionQueries = {
  create(data: Omit<AISessionRow, 'id' | 'accepted' | 'created_at'>): string {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO ai_sessions (id, resume_id, section_id, task_type, provider, model, input_text, output_text, job_desc, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.resume_id, data.section_id, data.task_type, data.provider, data.model,
           data.input_text, data.output_text, data.job_desc, data.score);
    return id;
  },
  list(resumeId: string): AISessionRow[] {
    return getDb().prepare(`
      SELECT * FROM ai_sessions WHERE resume_id=? ORDER BY created_at DESC
    `).all(resumeId) as unknown as AISessionRow[];
  },
  accept(id: string): void {
    getDb().prepare(`UPDATE ai_sessions SET accepted=1 WHERE id=?`).run(id);
  },
};
