-- AuraCV SQLite Schema - single source of truth

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('active_provider', 'openai'),
  ('app_version',     '1.0.0'),
  ('theme',           'dark'),
  ('default_template','modern'),
  ('auto_save',       'true');

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider   TEXT NOT NULL UNIQUE,
  encrypted  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resumes (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT NOT NULL,
  version_tag  TEXT DEFAULT 'v1',
  template_id  TEXT DEFAULT 'modern',
  is_active    INTEGER DEFAULT 1,
  parent_id    TEXT REFERENCES resumes(id) ON DELETE SET NULL,
  meta         TEXT DEFAULT '{}',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resume_sections (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  resume_id    TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '[]',
  position     INTEGER DEFAULT 0,
  is_visible   INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resume_sections_resume ON resume_sections(resume_id, position);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT DEFAULT 'modern',
  html_file   TEXT NOT NULL,
  is_ats_safe INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO templates (id, name, description, category, html_file, is_ats_safe) VALUES
  ('modern',  'Modern',   'Clean contemporary design with accent colors',  'modern',  'modern.html',  0),
  ('classic', 'Classic',  'Traditional professional serif typography',     'classic', 'classic.html', 0),
  ('minimal', 'Minimal',  'Ultra-minimal typography-focused layout',       'minimal', 'minimal.html', 0),
  ('ats',     'ATS Pure', 'Raw text zero graphics guaranteed ATS-safe',    'ats',     'ats.html',     1);

CREATE TABLE IF NOT EXISTS ai_sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  resume_id   TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  section_id  TEXT REFERENCES resume_sections(id) ON DELETE SET NULL,
  task_type   TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  input_text  TEXT,
  output_text TEXT,
  job_desc    TEXT,
  score       REAL,
  accepted    INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_resume ON ai_sessions(resume_id);

CREATE TABLE IF NOT EXISTS exports (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  resume_id   TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  format      TEXT NOT NULL,
  template_id TEXT,
  ats_mode    INTEGER DEFAULT 0,
  file_path   TEXT,
  file_size   INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);
