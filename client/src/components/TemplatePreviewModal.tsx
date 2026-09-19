import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { templatesApi } from '../api';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  ShieldCheck,
  FileText,
  Zap,
  Type,
  AlignLeft,
  Briefcase,
  Code,
  Terminal,
  Sparkles,
  GraduationCap,
  Compass,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';

interface TemplatePreviewModalProps {
  initialTemplateId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (templateId: string) => void;
  actionButtonLabel?: string;
}

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    tag: 'Popular',
    desc: 'Clean two-column layout with a light sidebar for skills and contact info, and clear space for your work history.',
    isAtsSafe: false,
    icon: Zap,
    color: '#2563eb',
  },
  {
    id: 'executive',
    name: 'Executive',
    tag: 'Leadership',
    desc: 'Authoritative dark banner with gold accents, prominent leadership summary, and dual-column competencies.',
    isAtsSafe: false,
    icon: Briefcase,
    color: '#d97706',
  },
  {
    id: 'tech',
    name: 'Tech Lead',
    tag: 'Developer',
    desc: 'Developer-first terminal aesthetic with git timelines, monospace details, and clean tag badges.',
    isAtsSafe: false,
    icon: Terminal,
    color: '#0284c7',
  },
  {
    id: 'creative',
    name: 'Creative',
    tag: 'Editorial',
    desc: 'Contemporary Nordic editorial layout with vibrant gradient accents and refined card typography.',
    isAtsSafe: false,
    icon: Sparkles,
    color: '#6366f1',
  },
  {
    id: 'compact',
    name: 'Compact',
    tag: 'Dense Tech',
    desc: 'Single-page high-density format tailored for software engineers and quantitative specialists.',
    isAtsSafe: false,
    icon: Code,
    color: '#2563eb',
  },
  {
    id: 'classic',
    name: 'Classic',
    tag: 'Classic',
    desc: 'Traditional serif typography with formal centered headings, great for business, legal, and academic roles.',
    isAtsSafe: false,
    icon: FileText,
    color: '#475569',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tag: 'Clean',
    desc: 'Clean spacing and high-contrast typography that lets your achievements stand out.',
    isAtsSafe: false,
    icon: Type,
    color: '#0284c7',
  },
  {
    id: 'ivy',
    name: 'Ivy League',
    tag: 'Academic',
    desc: 'Prestigious academic serif standard with diamond small-caps headings, classical double rules, and formal elegance.',
    isAtsSafe: false,
    icon: GraduationCap,
    color: '#1e3a8a',
  },
  {
    id: 'nordic',
    name: 'Nordic',
    tag: 'Scandinavian',
    desc: 'Serene Scandinavian minimalism with soft teal pill badges, generous whitespace, and a refined timeline.',
    isAtsSafe: false,
    icon: Compass,
    color: '#0d9488',
  },
  {
    id: 'elevate',
    name: 'Elevate',
    tag: 'Product Lead',
    desc: 'High-impact product and engineering leadership layout with vibrant gradient header and skills matrix.',
    isAtsSafe: false,
    icon: TrendingUp,
    color: '#6366f1',
  },
  {
    id: 'swiss',
    name: 'Swiss Grid',
    tag: 'Swiss Grid',
    desc: 'Iconic International Typographic Style with bold asymmetric grid, heavy grotesque headings, and crimson accents.',
    isAtsSafe: false,
    icon: LayoutGrid,
    color: '#e11d48',
  },
  {
    id: 'ats',
    name: 'ATS Pure',
    tag: 'Simple',
    desc: 'Simple text format with no graphics, easy for company hiring systems to scan without errors.',
    isAtsSafe: true,
    icon: AlignLeft,
    color: '#10b981',
  },
];

export default function TemplatePreviewModal({
  initialTemplateId = 'modern',
  isOpen,
  onClose,
  onSelect,
  actionButtonLabel = 'Use This Template',
}: TemplatePreviewModalProps) {
  const [activeTemplate, setActiveTemplate] = useState(initialTemplateId);
  const [zoom, setZoom] = useState(75);
  const [isLoading, setIsLoading] = useState(true);

  // Sync initial template when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setActiveTemplate(initialTemplateId);
        setIsLoading(true);
        // Auto-fit zoom on smaller screens
        if (typeof window !== 'undefined' && window.innerWidth < 1200) {
          setZoom(70);
        } else {
          setZoom(85);
        }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialTemplateId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentMeta = TEMPLATES.find(t => t.id === activeTemplate) ?? TEMPLATES[0];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden animate-fade-in"
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* ── Modal Header Bar ───────────────────────────────────────────── */}
        <div
          className="px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 glass"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Zone 1: Template identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0"
              style={{
                backgroundColor: `${currentMeta.color}15`,
                borderColor: `${currentMeta.color}35`,
                color: currentMeta.color,
              }}
            >
              <currentMeta.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base md:text-lg truncate" style={{ color: 'var(--text-primary)' }}>
                  {currentMeta.name}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                  style={{
                    backgroundColor: `${currentMeta.color}15`,
                    borderColor: `${currentMeta.color}35`,
                    color: currentMeta.color,
                  }}
                >
                  {currentMeta.tag}
                </span>
                {currentMeta.isAtsSafe && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-500 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> ATS Friendly
                  </span>
                )}
              </div>
              <p className="text-xs hidden md:block" style={{ color: 'var(--text-secondary)' }}>
                Live preview with realistic sample resume details
              </p>
            </div>
          </div>

          {/* Zone 2: Template switcher tabs */}
          <div
            className="flex p-1 rounded-2xl border shrink-0"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {TEMPLATES.map(t => {
              const isCurrent = activeTemplate === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setIsLoading(true);
                    setActiveTemplate(t.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
                  }`}
                  style={{
                    color: isCurrent ? undefined : 'var(--text-primary)',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          {/* Zone 3: Controls & Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Zoom Controls */}
            <div
              className="flex items-center border rounded-xl p-1 gap-1"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
              </button>
              <span className="px-1.5 text-[11px] font-medium min-w-[34px] text-center" style={{ color: 'var(--text-primary)' }}>
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(130, z + 10))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(85)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded ml-1 cursor-pointer"
                title="Reset zoom"
              >
                <Maximize2 className="w-3 h-3" style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>

            {/* Select this template button */}
            {onSelect && (
              <button
                type="button"
                onClick={() => {
                  onSelect(activeTemplate);
                  onClose();
                }}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                {actionButtonLabel}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
              title="Close preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Info strip ─────────────────────────────────────────── */}
        <div
          className="px-6 py-2 border-b flex items-center justify-between text-xs"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              Previewing sample profile: Alex Morgan, Senior Software Engineer
            </span>
          </div>
          <span className="hidden sm:inline-block text-[11px]">
            Standard A4 format, print and PDF ready
          </span>
        </div>

        {/* ── Live Iframe View Container ──────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start relative"
          style={{
            backgroundColor: 'var(--bg-app)',
            backgroundImage: 'var(--bg-app-radial)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(148, 163, 184, 0.3) transparent',
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-xs z-10">
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-900/90 text-white shadow-xl">
                <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-xs font-medium">Rendering template sample…</span>
              </div>
            </div>
          )}

          {/* Genuine Printed Paper Sheet with realistic drop shadow */}
          <div
            className="bg-white rounded-lg shadow-2xl overflow-hidden transition-transform origin-top border border-slate-300/80 dark:border-slate-700/80"
            style={{
              width: '794px',
              minHeight: '1123px',
              height: '1123px',
              transform: `scale(${zoom / 100})`,
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              marginBottom: `${Math.max(0, (1123 * (zoom / 100)) - 750)}px`,
            }}
          >
            <iframe
              key={activeTemplate}
              src={templatesApi.samplePreviewUrl(activeTemplate)}
              title={`${currentMeta.name} Template Preview`}
              scrolling="no"
              className="w-full h-full border-0 bg-white"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
