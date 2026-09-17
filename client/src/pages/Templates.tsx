import { useState, useEffect } from 'react';
import { templatesApi, type Template } from '../api';
import { useAppStore } from '../store';
import { CheckCircle2, Zap, FileText, Type, AlignLeft, ShieldCheck, Layers, Eye, Check, Briefcase, Code, Terminal, Sparkles } from 'lucide-react';
import TemplatePreviewModal from '../components/TemplatePreviewModal';

const TEMPLATE_META: Record<string, { icon: typeof FileText; accent: string; preview: string; tag: string }> = {
  modern: {
    icon: Zap,
    accent: '#2563eb',
    tag: 'Popular',
    preview: 'Clean two-column layout with a light sidebar for skills and contact info, and clear space for your work history.',
  },
  executive: {
    icon: Briefcase,
    accent: '#d97706',
    tag: 'Leadership',
    preview: 'Authoritative dark banner with gold accents, prominent leadership summary, and dual-column competencies.',
  },
  tech: {
    icon: Terminal,
    accent: '#0284c7',
    tag: 'Developer',
    preview: 'Developer-first terminal aesthetic with git timelines, monospace details, and clean tag badges.',
  },
  creative: {
    icon: Sparkles,
    accent: '#6366f1',
    tag: 'Editorial',
    preview: 'Contemporary Nordic editorial layout with vibrant gradient accents and refined card typography.',
  },
  compact: {
    icon: Code,
    accent: '#2563eb',
    tag: 'Dense Tech',
    preview: 'Single-page high-density format tailored for software engineers and quantitative specialists.',
  },
  classic: {
    icon: FileText,
    accent: '#475569',
    tag: 'Classic',
    preview: 'Traditional serif typography with formal centered headings, great for business, legal, and academic roles.',
  },
  minimal: {
    icon: Type,
    accent: '#06b6d4',
    tag: 'Clean',
    preview: 'Clean spacing and clear headings that put the focus directly on your achievements.',
  },
  ats: {
    icon: AlignLeft,
    accent: '#10b981',
    tag: 'Simple',
    preview: 'Simple text format with no graphics, easy for company hiring systems to scan without errors.',
  },
};

export default function Templates() {
  const { settings, updateSettings } = useAppStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState(settings.default_template ?? 'modern');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ats' | 'modern' | 'executive' | 'tech' | 'creative' | 'compact' | 'classic' | 'minimal'>('all');
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    templatesApi.list().then(setTemplates).catch(console.error);
  }, []);

  const handleSelect = async (id: string) => {
    setSelected(id);
    await updateSettings({ default_template: id });
  };

  const list = templates.length ? templates : [
    { id: 'modern',    name: 'Modern',    description: 'Clean contemporary design', category: 'modern',    is_ats_safe: false },
    { id: 'executive', name: 'Executive', description: 'Authoritative leadership format', category: 'executive', is_ats_safe: false },
    { id: 'tech',      name: 'Tech Lead', description: 'Developer terminal format with git timeline', category: 'tech', is_ats_safe: false },
    { id: 'creative',  name: 'Creative',  description: 'Contemporary Nordic editorial layout', category: 'creative', is_ats_safe: false },
    { id: 'compact',   name: 'Compact',   description: 'High-density tech layout', category: 'compact',   is_ats_safe: false },
    { id: 'classic',   name: 'Classic',   description: 'Traditional professional', category: 'classic',   is_ats_safe: false },
    { id: 'minimal',   name: 'Minimal',   description: 'Ultra-minimal layout',     category: 'minimal',   is_ats_safe: false },
    { id: 'ats',       name: 'ATS Pure',  description: 'Guaranteed ATS-safe',      category: 'ats',       is_ats_safe: true  },
  ];

  const filtered = activeFilter === 'all'
    ? list
    : activeFilter === 'ats'
      ? list.filter(t => t.is_ats_safe)
      : list.filter(t => t.id === activeFilter);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto animate-fade-in-up space-y-6 sm:space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
            <Layers className="w-3.5 h-3.5" /> Resume Templates
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Choose Your Resume Style
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Select a design for your resume. You can switch templates anytime in the editor.
          </p>
        </div>

        {/* Filter Pills */}
        <div
          className="flex flex-wrap p-1 rounded-2xl border gap-1"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
          }}
        >
          {(['all', 'modern', 'executive', 'compact', 'classic', 'minimal', 'ats'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeFilter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 hover:text-slate-950 dark:hover:text-white'
              }`}
              style={{
                color: activeFilter === f ? undefined : 'var(--text-secondary)',
              }}
            >
              {f === 'all' ? 'All' : f === 'ats' ? 'ATS-Pure' : f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Template Cards Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((t, idx) => {
          const meta = TEMPLATE_META[t.id] ?? TEMPLATE_META.modern;
          const Icon = meta.icon;
          const isDefault = selected === t.id;

          return (
            <div
              key={t.id}
              className="rounded-3xl border glass-card p-6 flex flex-col justify-between transition-all relative overflow-hidden"
              style={{
                borderColor: isDefault ? meta.accent : 'var(--border-subtle)',
                boxShadow: isDefault ? `0 0 25px ${meta.accent}25` : undefined,
                animationDelay: `${idx * 60}ms`,
              }}
            >
              {/* Top Framed Preview Box */}
              <div
                onClick={() => setPreviewTemplateId(t.id)}
                className="w-full h-72 rounded-2xl mb-5 overflow-hidden relative border cursor-pointer group/thumb transition-all hover:border-blue-500/60 p-3.5 flex justify-center items-start"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {/* Framed Paper Sheet with realistic drop shadow */}
                <div
                  className="rounded-xl overflow-hidden pointer-events-none bg-white relative border border-slate-200/90 dark:border-slate-800 shadow-md transition-transform group-hover/thumb:scale-[1.02]"
                  style={{
                    width: '380px',
                    height: '245px',
                    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <iframe
                    src={templatesApi.samplePreviewUrl(t.id)}
                    title={`${t.name} Live Card Preview`}
                    tabIndex={-1}
                    scrolling="no"
                    className="border-0 bg-white"
                    style={{
                      width: '794px',
                      height: '1123px',
                      transform: 'scale(0.48)',
                      transformOrigin: 'top left',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                {/* Hover overlay with button */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center p-4 z-10">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-xl transform scale-95 group-hover/thumb:scale-100 transition-transform">
                    <Eye className="w-4 h-4 text-blue-600" />
                    Open Full Size Preview
                  </span>
                </div>

                {/* Badge top right */}
                <span
                  className="absolute top-5 right-5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shadow-xs z-10"
                  style={{
                    backgroundColor: `${meta.accent}20`,
                    borderColor: `${meta.accent}40`,
                    color: meta.accent,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {meta.tag}
                </span>
              </div>

              {/* Template details */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${meta.accent}15`,
                        borderColor: `${meta.accent}30`,
                        color: meta.accent,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {t.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.is_ats_safe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" /> ATS Friendly
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Recruiter Friendly
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="w-4 h-4" /> Default
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {meta.preview}
                </p>

                {/* Bottom Dual Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateId(t.id)}
                    className="py-2.5 px-3 rounded-xl text-xs font-semibold border inline-flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    style={{
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Preview Sample
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelect(t.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                      isDefault ? 'btn-primary shadow-md' : 'border hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                    style={{
                      borderColor: isDefault ? undefined : 'var(--border-default)',
                      color: isDefault ? '#ffffff' : 'var(--text-primary)',
                    }}
                  >
                    {isDefault ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Selected
                      </>
                    ) : (
                      'Set as Default'
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Realistic Full Preview Modal with Dummy Data ───────────────────── */}
      {previewTemplateId && (
        <TemplatePreviewModal
          isOpen={Boolean(previewTemplateId)}
          initialTemplateId={previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
          onSelect={id => {
            handleSelect(id);
            setPreviewTemplateId(null);
          }}
          actionButtonLabel="Set as Default Template"
        />
      )}
    </div>
  );
}
