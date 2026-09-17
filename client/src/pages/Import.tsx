import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importApi } from '../api';
import { Upload, FileText, ClipboardPaste, FileJson, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

type Mode = 'pdf' | 'text' | 'json';

export default function Import() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (file: File) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const { id } = await importApi.pdf(file, name || file.name.replace(/\.pdf$/i, ''));
      setSuccess('Resume successfully parsed and imported! Opening editor…');
      setTimeout(() => navigate(`/editor/${id}`), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  const handleTextImport = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const { id } = await importApi.text(text, name || 'Imported Resume');
      setSuccess('Resume text structured into sections! Opening editor…');
      setTimeout(() => navigate(`/editor/${id}`), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  const handleJsonImport = async (file: File) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const raw = await file.text();
      const { resume, sections } = JSON.parse(raw);
      const { id } = await importApi.json(resume, sections);
      setSuccess('Backup restored with all sections intact! Opening editor…');
      setTimeout(() => navigate(`/editor/${id}`), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  const modes: Array<{ id: Mode; icon: typeof Upload; label: string; desc: string }> = [
    { id: 'pdf',  icon: FileText,       label: 'PDF Upload',  desc: 'Upload an existing PDF resume' },
    { id: 'text', icon: ClipboardPaste, label: 'Paste Text',  desc: 'Paste plain text content'      },
    { id: 'json', icon: FileJson,       label: 'JSON Backup', desc: 'Restore an AuraCV backup file' },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-2xl mx-auto animate-fade-in-up space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
          <Upload className="w-3.5 h-3.5" /> Resume Import
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Import Resume
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Upload or paste your resume to automatically fill in your work history, education, and skills.
        </p>
      </div>

      {/* ── Mode Tabs ────────────────────────────────────────────────────── */}
      <div
        className="flex p-1 rounded-2xl border"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {modes.map(m => {
          const isActive = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
              }`}
              style={{
                color: isActive ? undefined : 'var(--text-primary)',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Target Name Input ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
          Resume Title <span className="opacity-60">(Optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Senior Backend Engineer"
          className="w-full px-4 py-3 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* ── Upload Area: PDF Mode ────────────────────────────────────────── */}
      {mode === 'pdf' && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.type === 'application/pdf') handlePdfUpload(f);
          }}
          className="rounded-3xl p-10 border-2 border-dashed glass-card text-center cursor-pointer transition-all hover:border-blue-600 group"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handlePdfUpload(f);
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20 group-hover:scale-105 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
            Drag and drop your PDF resume here
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            or click to choose a file from your computer
          </p>
        </div>
      )}

      {/* ── Paste Area: Text Mode ────────────────────────────────────────── */}
      {mode === 'text' && (
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            placeholder="Paste raw resume text here (Header, Experience, Education, Skills)…"
            className="w-full rounded-2xl px-4 py-3 text-xs md:text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-y"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleTextImport}
            disabled={!text.trim() || loading}
            className="btn-primary w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'AI Parsing Resume Sections…' : 'Parse with AI Engine'}
          </button>
        </div>
      )}

      {/* ── JSON Restore Area: JSON Mode ─────────────────────────────────── */}
      {mode === 'json' && (
        <div
          onClick={() => jsonRef.current?.click()}
          className="rounded-3xl p-10 border-2 border-dashed glass-card text-center cursor-pointer transition-all hover:border-emerald-500 group"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <input
            ref={jsonRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleJsonImport(f);
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <FileJson className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
            Restore AuraCV JSON Backup
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Instantly restores all sections, versions, and metadata without data loss
          </p>
        </div>
      )}

      {/* ── Status Feedback ──────────────────────────────────────────────── */}
      {loading && (
        <div
          className="p-4 rounded-2xl border flex items-center gap-3 animate-fade-in-up"
          style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Structuring your resume…
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Analyzing layout, classifying sections, and formatting experience bullets
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-500 animate-fade-in-up">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-500 animate-fade-in-up">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
