import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileJson, FileCode, Copy, X, Loader2, ShieldCheck, Check } from 'lucide-react';

interface Props {
  resumeId: string;
  resumeName: string;
  onClose: () => void;
}

export default function ExportModal({ resumeId, resumeName, onClose }: Props) {
  const [atsMode, setAtsMode] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copyMarkdown = async () => {
    setLoading('md-copy');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/export/${resumeId}/markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download: false }),
      });
      if (!res.ok) throw new Error('Failed to generate markdown');
      const data = await res.json();
      await navigator.clipboard.writeText(data.markdown || '');
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
    } catch (err) {
      console.error('Copy markdown error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to copy markdown to clipboard');
    } finally {
      setLoading(null);
    }
  };

  const downloadMarkdown = async () => {
    setLoading('markdown');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/export/${resumeId}/markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download: true }),
      });
      if (!res.ok) throw new Error('Failed to download markdown');
      const blob = await res.blob();
      const safeName = resumeName.replace(/[^a-z0-9]/gi, '_');
      triggerDownload(blob, `${safeName}_cv.md`, 'text/markdown');
      setDownloaded('markdown');
      setTimeout(() => setDownloaded(null), 2500);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to download markdown');
    } finally {
      setLoading(null);
    }
  };

  const download = async (format: 'pdf' | 'docx' | 'json') => {
    setLoading(format);
    setDownloaded(null);
    setErrorMessage(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      let blob: Blob;
      const safeName = resumeName.replace(/[^a-z0-9]/gi, '_');

      if (format === 'pdf') {
        const res = await fetch(`/api/export/${resumeId}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ats_mode: atsMode }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Server returned ${res.status}`);
        blob = await res.blob();
        triggerDownload(blob, `${safeName}_cv.pdf`, 'application/pdf');
      } else if (format === 'docx') {
        const res = await fetch(`/api/export/${resumeId}/docx`, { method: 'POST', signal: controller.signal });
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Server returned ${res.status}`);
        blob = await res.blob();
        triggerDownload(blob, `${safeName}_cv.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else {
        const res = await fetch(`/api/export/${resumeId}/json`, { method: 'POST', signal: controller.signal });
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Server returned ${res.status}`);
        const data = await res.json();
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `${safeName}_backup.json`, 'application/json');
      }
      setDownloaded(format);
      setTimeout(() => setDownloaded(null), 2500);
    } catch (e) {
      console.error('Export failed:', e);
      const msg = e instanceof Error && e.name === 'AbortError'
        ? 'Export timed out. Please try again.'
        : e instanceof Error ? e.message : 'The server might be unreachable or an error occurred.';
      setErrorMessage(`Export failed: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
      setLoading(null);
    }
  };



  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/25 dark:bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 md:p-8 border shadow-2xl space-y-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          boxShadow: 'var(--shadow-float)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Export Resume
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Download pixel-perfect files ready for job applications
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ATS Mode Toggle */}
        <div
          className="flex items-center justify-between p-4 rounded-2xl border"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: atsMode ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: atsMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                color: atsMode ? '#10b981' : '#6366f1',
              }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ATS Optimized Mode</p>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {atsMode ? 'Plain text, zero graphics for strict scanners' : 'Retain styled layout with colors'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAtsMode(!atsMode)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              atsMode ? 'bg-emerald-500' : 'bg-slate-400/40'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                atsMode ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Export Formats */}
        <div className="space-y-3">
          {[
            {
              fmt: 'pdf' as const,
              label: 'PDF Document (.pdf)',
              desc: atsMode ? 'ATS-safe raw format' : 'Pixel-perfect print rendering',
              badge: 'Most Popular',
              icon: FileText,
              color: '#6366f1',
            },
            {
              fmt: 'docx' as const,
              label: 'Microsoft Word (.docx)',
              desc: 'Editable document with standard formatting',
              badge: 'Editable',
              icon: FileText,
              color: '#0ea5e9',
            },
            {
              fmt: 'json' as const,
              label: 'AuraCV Backup (.json)',
              desc: 'Complete backup file of your resume data',
              badge: 'Data Backup',
              icon: FileJson,
              color: '#10b981',
            },
          ].map(({ fmt, label, desc, badge, icon: Icon, color }) => (
            <button
              key={fmt}
              onClick={() => download(fmt)}
              disabled={!!loading}
              className="w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all hover:border-blue-500 hover:scale-[1.01] group disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}25`,
                    color,
                  }}
                >
                  {loading === fmt ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : downloaded === fmt ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {label}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {badge}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {desc}
                  </p>
                </div>
              </div>

              <Download className="w-4 h-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all shrink-0" style={{ color: 'var(--text-muted)' }} />
            </button>
          ))}

          {/* Markdown (.md) with prominent 1-click Copy */}
          <div
            className="w-full flex items-stretch rounded-2xl border transition-all overflow-hidden group"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: copiedMarkdown ? '#10b981' : 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={copyMarkdown}
              disabled={!!loading}
              className="flex-1 flex items-center justify-between p-4 text-left cursor-pointer transition-colors hover:bg-violet-500/5 disabled:opacity-50 min-w-0"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: copiedMarkdown ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                    borderColor: copiedMarkdown ? 'rgba(16, 185, 129, 0.25)' : 'rgba(139, 92, 246, 0.25)',
                    color: copiedMarkdown ? '#10b981' : '#8b5cf6',
                  }}
                >
                  {loading === 'md-copy' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : copiedMarkdown ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <FileCode className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Markdown (.md)
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                      copiedMarkdown
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                    }`}>
                      {copiedMarkdown ? 'Copied!' : '1-Click Copy'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {copiedMarkdown ? 'Copied to clipboard ready to paste' : 'Copy clean formatted markdown'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className={`text-xs font-semibold ${copiedMarkdown ? 'text-emerald-500' : 'text-violet-600 dark:text-violet-400'}`}>
                  {copiedMarkdown ? 'Copied' : 'Copy'}
                </span>
                {copiedMarkdown ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
                )}
              </div>
            </button>

            <div className="w-[1px] my-2" style={{ backgroundColor: 'var(--border-subtle)' }} />

            <button
              type="button"
              onClick={downloadMarkdown}
              disabled={!!loading}
              className="px-4 flex items-center justify-center transition-colors hover:bg-violet-500/10 text-violet-500 cursor-pointer disabled:opacity-50 shrink-0"
              title="Download .md file"
            >
              {loading === 'md-download' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 hover:scale-110 transition-transform" />
              )}
            </button>
          </div>
        </div>


      </div>
    </div>,
    document.body
  );
}

function triggerDownload(blob: Blob, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
