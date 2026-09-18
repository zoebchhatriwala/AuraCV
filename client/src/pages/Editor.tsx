import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../store';
import { resumeApi, exportApi, type Section } from '../api';
import {
  Download, Eye, EyeOff, ChevronDown, ChevronUp, Plus, Trash2,
  RefreshCw, ZoomIn, ZoomOut, Check, SlidersHorizontal, Lock,
  Cloud, CloudOff, Pencil,
} from 'lucide-react';
import ExportModal from '../components/ExportModal';
import SectionEditor from '../components/SectionEditor';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import AICopilotPanel from '../components/AICopilotPanel';
import ConfirmModal from '../components/ConfirmModal';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { fetchResume, currentResume, updateResume, settings, updateSettings } = useAppStore();
  const autoSave = settings.auto_save !== 'false';
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'split' | 'full-editor' | 'full-preview'>('split');
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview' | 'copilot'>('editor');
  const [showExport, setShowExport] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotInitialBullet, setCopilotInitialBullet] = useState('');
  const [copilotInitialContext, setCopilotInitialContext] = useState<{ sectionId: string; index: number } | undefined>(undefined);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [versionValue, setVersionValue] = useState('');
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.key.toLowerCase() === 'j') || (e.metaKey && e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        setShowCopilot(prev => {
          const next = !prev;
          if (next) setMobileTab('copilot');
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (id) {
      fetchResume(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (currentResume) {
      // eslint-disable-next-line react/set-state-in-effect
      setTitleValue(currentResume.name);
      if (!activeSection && currentResume.sections.length > 0) {
        // eslint-disable-next-line react/set-state-in-effect
        setActiveSection(currentResume.sections[0]?.id ?? null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResume?.id]);

  const refreshPreview = (overrideTemplateId?: string) => {
    if (previewRef.current && id && currentResume) {
      const templateId = overrideTemplateId || currentResume.template_id;
      const base = exportApi.preview(id, templateId);
      const sep = base.includes('?') ? '&' : '?';
      // eslint-disable-next-line react/purity
      previewRef.current.src = `${base}${sep}_t=${Date.now()}`;
    }
  };

  const handleSectionUpdate = async (sectionId: string, data: Partial<Section>) => {
    if (!id) return;
    setSaveStatus('saving');
    await resumeApi.updateSection(id, sectionId, data);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
    await fetchResume(id);
    refreshPreview();
  };

  const handleAddSection = async (type: string, title: string) => {
    if (!id || !currentResume) return;
    const maxPos = Math.max(-1, ...currentResume.sections.map(s => s.position));
    await resumeApi.addSection(id, { section_type: type, title, content: [], position: maxPos + 1 });
    await fetchResume(id);
    refreshPreview();
  };

  const handleDeleteSection = (sectionId: string) => {
    const sec = currentResume?.sections.find(s => s.id === sectionId);
    if (!sec || sec.section_type === 'header') return;
    setSectionToDelete({ id: sectionId, title: sec?.title || 'this section' });
  };

  const confirmDeleteSection = async () => {
    if (!id || !sectionToDelete) return;
    const sId = sectionToDelete.id;
    const sec = currentResume?.sections.find(s => s.id === sId);
    if (sec?.section_type === 'header') {
      setSectionToDelete(null);
      return;
    }
    setSectionToDelete(null);
    await resumeApi.deleteSection(id, sId);
    await fetchResume(id);
    refreshPreview();
  };

  const handleToggleVisibility = async (section: Section) => {
    if (!id) return;
    const isCurrentlyVisible = Boolean(section.is_visible);
    await resumeApi.updateSection(id, section.id, { ...section, is_visible: isCurrentlyVisible ? 0 : 1 });
    await fetchResume(id);
    refreshPreview();
  };

  const handleMoveSection = async (sectionId: string, direction: 'up' | 'down') => {
    if (!id || !currentResume) return;
    const sorted = currentResume.sections.slice().sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(s => s.id === sectionId);
    if (idx === -1) return;

    // Header section is permanently locked at the top
    if (sorted[idx].section_type === 'header') return;

    // If header exists at index 0, non-header sections cannot move into index 0
    const minMovableIdx = sorted[0]?.section_type === 'header' ? 1 : 0;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < minMovableIdx || targetIdx >= sorted.length) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    const orderedIds = reordered.map(s => s.id);
    await resumeApi.reorderSections(id, orderedIds);
    await fetchResume(id);
    refreshPreview();
  };

  const handleTemplateChange = async (templateId: string) => {
    if (!id) return;
    await updateResume(id, { template_id: templateId });
    refreshPreview(templateId);
  };

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (!id || !titleValue.trim() || titleValue === currentResume?.name) return;
    setSaveStatus('saving');
    await updateResume(id, { name: titleValue.trim() });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleVersionSubmit = async () => {
    setIsEditingVersion(false);
    const newTag = versionValue.trim() || 'v1';
    if (!id || newTag === currentResume?.version_tag) return;
    setSaveStatus('saving');
    await updateResume(id, { version_tag: newTag });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleOpenCopilotWithBullet = (bullet: string, context: { sectionId: string; index: number }) => {
    setCopilotInitialBullet(bullet);
    setCopilotInitialContext(context);
    setShowCopilot(true);
    setMobileTab('copilot');
  };

  const handleApplyBulletFromCopilot = async (
    newBullet: string,
    originalBullet?: string,
    targetSectionId?: string,
    bulletIndex?: number
  ) => {
    if (!id || !currentResume) return;

    let sec = currentResume.sections.find(s => s.id === targetSectionId);
    if (!sec) {
      sec = currentResume.sections.find(s => s.id === activeSection);
    }
    if (!sec) {
      sec = currentResume.sections.find(s => {
        const content = (s.content || []) as Array<Record<string, unknown>>;
        return content.some(entry => {
          const bullets = (entry.bullets as string[]) || [];
          return bullets.some(b => b === originalBullet);
        });
      });
    }
    if (!sec) return;

    const nextContent = JSON.parse(JSON.stringify(sec.content || [])) as Array<Record<string, unknown>>;
    let replaced = false;

    if (typeof bulletIndex === 'number' && nextContent.length > 0) {
      for (const entry of nextContent) {
        if (entry.bullets && Array.isArray(entry.bullets) && entry.bullets[bulletIndex] !== undefined) {
          entry.bullets[bulletIndex] = newBullet;
          replaced = true;
          break;
        }
      }
    }

    if (!replaced && originalBullet) {
      for (const entry of nextContent) {
        if (entry.bullets && Array.isArray(entry.bullets)) {
          const bIdx = entry.bullets.findIndex((b: string) => b === originalBullet);
          if (bIdx !== -1) {
            entry.bullets[bIdx] = newBullet;
            replaced = true;
            break;
          }
        } else if (typeof entry.text === 'string' && entry.text === originalBullet) {
          entry.text = newBullet;
          replaced = true;
          break;
        }
      }
    }

    if (!replaced && nextContent.length > 0) {
      if (nextContent[0].bullets && Array.isArray(nextContent[0].bullets)) {
        nextContent[0].bullets.push(newBullet);
        replaced = true;
      } else if ('text' in nextContent[0]) {
        nextContent[0].text = newBullet;
        replaced = true;
      }
    }

    if (replaced) {
      await handleSectionUpdate(sec.id, { content: nextContent });
    }
    setMobileTab('editor');
  };

  if (!currentResume) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Loading Resume Canvas…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Sub-header Toolbar ─────────────────────────────────────────── */}
      <div
        className="px-3 sm:px-6 py-2.5 sm:py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0 glass"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Title & Template pill */}
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
                className="px-3 py-1 text-sm font-semibold rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleTitleSubmit}
                className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="font-display font-bold text-sm sm:text-base md:text-lg cursor-pointer hover:text-blue-600 transition-colors truncate max-w-[160px] sm:max-w-xs"
              style={{ color: 'var(--text-primary)' }}
              title="Click to rename"
            >
              {currentResume.name}
            </h1>
          )}

          {/* Version tag badge */}
          {isEditingVersion ? (
            <div className="flex items-center shrink-0">
              <input
                autoFocus
                type="text"
                value={versionValue}
                onChange={e => setVersionValue(e.target.value)}
                onBlur={handleVersionSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleVersionSubmit();
                  if (e.key === 'Escape') setIsEditingVersion(false);
                }}
                className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border w-16 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          ) : (
            <span
              onClick={() => {
                setVersionValue(currentResume.version_tag || 'v1');
                setIsEditingVersion(true);
              }}
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer flex items-center gap-1 group/vtag shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              title="Click to edit version tag"
            >
              <span>{currentResume.version_tag || 'v1'}</span>
              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/vtag:opacity-70 transition-opacity" />
            </span>
          )}

          {/* Quick template selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowTemplatePreview(true)}
              className="p-1 sm:px-3 sm:py-1.5 rounded-lg border bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              title="Change Template"
            >
              <span className="opacity-70 hidden sm:inline">Template:</span>
              <span className="font-semibold capitalize text-blue-600 dark:text-blue-400">
                {currentResume.template_id}
              </span>
              <SlidersHorizontal className="w-3 h-3 ml-0.5 opacity-70" />
            </button>
          </div>

          {/* Auto-Save status & toggle pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            {saveStatus === 'saving' ? (
              <span className="text-xs text-blue-500 font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Saving…</span>
              </span>
            ) : saveStatus === 'saved' ? (
              <span className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Saved</span>
              </span>
            ) : autoSave ? (
              <button
                type="button"
                onClick={() => updateSettings({ auto_save: 'false' })}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                title="Auto-Save is ON. Changes save automatically as you type. Click to switch to manual saving."
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Auto-Save: On</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => updateSettings({ auto_save: 'true' })}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
                title="Auto-Save is OFF. Click to enable automatic saving."
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span>Auto-Save: Off</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Segmented Switcher (Editor vs Preview vs Copilot) */}
        <div className="flex md:hidden items-center justify-between gap-2 w-full pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="flex flex-1 p-0.5 rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-default)',
            }}
          >
            {(['editor', 'preview', 'copilot'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => {
                  setMobileTab(tabKey);
                  if (tabKey === 'copilot') setShowCopilot(true);
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                  mobileTab === tabKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {tabKey}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

        {/* Desktop View Mode & Action Buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div
            className="flex p-0.5 rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-default)',
            }}
          >
            {(['split', 'full-editor', 'full-preview'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
                  previewMode === mode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 hover:text-slate-950 dark:hover:bg-neutral-800 dark:hover:text-white'
                }`}
                style={{
                  color: previewMode === mode ? undefined : 'var(--text-secondary)',
                }}
              >
                {mode === 'split' ? 'Split View' : mode === 'full-editor' ? 'Editor Only' : 'Preview Only'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCopilot(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              showCopilot
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900'
            }`}
            title="Writing Copilot (Alt+A)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Copilot</span>
            <span className={`hidden sm:inline-block text-[10px] px-1 py-0.2 rounded border font-mono ${
              showCopilot 
                ? 'border-blue-400/50 text-blue-100' 
                : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              Alt+A
            </span>
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CV
          </button>
        </div>
      </div>

      {/* ── Main Canvas (Fully responsive across mobile tabs & desktop split) ── */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Left: Section Accordion Editor */}
        <div
          className={`
            flex-col overflow-y-auto border-r transition-all
            ${mobileTab === 'editor' ? 'flex w-full' : 'hidden'}
            md:flex
            ${previewMode === 'full-preview' ? 'md:!hidden' : ''}
            ${previewMode === 'full-editor' ? 'md:w-full' : showCopilot ? 'md:w-[38%]' : 'md:w-[48%]'}
          `}
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div className="p-4 sm:p-5 space-y-3 max-w-3xl mx-auto w-full">
            {(() => {
              const sortedSections = currentResume.sections
                .slice()
                .sort((a, b) => a.position - b.position);
              const headerIndex = sortedSections.findIndex(s => s.section_type === 'header');

              return sortedSections.map((section, idx, arr) => {
                const isHeader = section.section_type === 'header';
                // First movable section below header cannot move up
                const isFirst = isHeader || (headerIndex === 0 ? idx <= 1 : idx === 0);
                const isLast = isHeader || idx === arr.length - 1;

                return (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isActive={activeSection === section.id}
                    isFirst={isFirst}
                    isLast={isLast}
                    onToggle={() => setActiveSection(activeSection === section.id ? null : section.id)}
                    onUpdate={data => handleSectionUpdate(section.id, data)}
                    onDelete={() => handleDeleteSection(section.id)}
                    onToggleVisibility={() => handleToggleVisibility(section)}
                    onMoveUp={() => handleMoveSection(section.id, 'up')}
                    onMoveDown={() => handleMoveSection(section.id, 'down')}
                    onOpenCopilotWithBullet={handleOpenCopilotWithBullet}
                    resumeId={id!}
                  />
                );
              });
            })()}

            {/* Add Section Button */}
            <AddSectionDropdown onAdd={handleAddSection} />
          </div>
        </div>

        {/* Middle/Right: Realistic Paper Live Preview */}
        <div
          className={`
            flex-1 flex-col overflow-hidden transition-all
            ${mobileTab === 'preview' ? 'flex w-full' : 'hidden'}
            md:flex
            ${previewMode === 'full-editor' ? 'md:!hidden' : ''}
          `}
          style={{
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {/* Preview Toolbar */}
          <div
            className="px-4 sm:px-5 py-2 sm:py-2.5 border-b flex items-center justify-between glass text-xs"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold uppercase tracking-wider text-[10px]">A4 Live Rendering</span>
              <span>·</span>
              <span className="capitalize">{currentResume.template_id}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div
                className="flex items-center rounded-lg border p-0.5"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  onClick={() => setZoomLevel(z => Math.max(30, z - 10))}
                  className="p-1 hover:bg-slate-200/80 dark:hover:bg-neutral-800 rounded cursor-pointer transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <span className="px-1.5 sm:px-2 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(150, z + 10))}
                  className="p-1 hover:bg-slate-200/80 dark:hover:bg-neutral-800 rounded cursor-pointer transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>

              <button
                onClick={() => refreshPreview()}
                className="p-1.5 rounded-lg border transition-all hover:bg-slate-200/80 dark:hover:bg-neutral-800 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                title="Reload preview"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Paper Container with smooth scrolling & scaling */}
          <div className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center items-start">
            <div
              className="bg-white rounded-lg transition-transform origin-top shadow-2xl border border-slate-200/80 overflow-hidden shrink-0"
              style={{
                width: '794px',
                minHeight: '1123px',
                transform: `scale(${zoomLevel / 100})`,
              }}
            >
              <iframe
                ref={previewRef}
                src={exportApi.preview(id!, currentResume.template_id)}
                className="w-full h-[1200px] border-0 bg-white"
                title="CV Live Preview"
              />
            </div>
          </div>
        </div>

        {/* Right: Embedded AI Copilot Panel */}
          <div
            className={`
            ${mobileTab === 'copilot' ? 'fixed inset-0 z-40 flex bg-slate-900/25 dark:bg-black/70 backdrop-blur-xs md:static md:z-auto md:bg-transparent md:backdrop-blur-none' : 'hidden'}
            ${showCopilot ? 'md:flex' : 'md:hidden'}
            flex-col transition-all
          `}
        >
          <AICopilotPanel
            resumeId={id!}
            sections={currentResume.sections}
            activeSectionId={activeSection}
            onClose={() => {
              setShowCopilot(false);
              setMobileTab('editor');
            }}
            onApplyBullet={handleApplyBulletFromCopilot}
            initialBullet={copilotInitialBullet}
            initialBulletContext={copilotInitialContext}
          />
        </div>
      </div>

      {showExport && (
        <ExportModal
          resumeId={id!}
          resumeName={currentResume.name}
          onClose={() => setShowExport(false)}
        />
      )}

      {showTemplatePreview && (
        <TemplatePreviewModal
          isOpen={showTemplatePreview}
          initialTemplateId={currentResume.template_id}
          onClose={() => setShowTemplatePreview(false)}
          onSelect={id => {
            handleTemplateChange(id);
            setShowTemplatePreview(false);
          }}
          actionButtonLabel="Apply to This Resume"
        />
      )}

      <ConfirmModal
        isOpen={!!sectionToDelete}
        title="Delete Section"
        message={`Are you sure you want to delete the "${sectionToDelete?.title}" section? All content in this section will be permanently removed.`}
        confirmLabel="Delete Section"
        variant="danger"
        onConfirm={confirmDeleteSection}
        onCancel={() => setSectionToDelete(null)}
      />
    </div>
  );
}

// ─── Section Card Component ───────────────────────────────────────────────────

interface SectionCardProps {
  section: Section;
  isActive: boolean;
  resumeId: string;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onUpdate: (data: Partial<Section>) => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenCopilotWithBullet?: (bullet: string, context: { sectionId: string; index: number }) => void;
}

function SectionCard({
  section,
  isActive,
  resumeId,
  isFirst,
  isLast,
  onToggle,
  onUpdate,
  onDelete,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onOpenCopilotWithBullet,
}: SectionCardProps) {
  const isVisible = Boolean(section.is_visible);
  const [titleValue, setTitleValue] = useState(section.title);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setTitleValue(section.title);
  }, [section.title]);

  const handleTitleSubmit = () => {
    if (titleValue.trim() && titleValue.trim() !== section.title) {
      onUpdate({ title: titleValue.trim() });
    } else {
      setTitleValue(section.title);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        !isVisible ? 'opacity-75' : ''
      }`}
      style={{
        backgroundColor: isActive ? 'var(--bg-surface)' : 'var(--bg-surface-elevated)',
        borderColor: isActive ? 'var(--color-brand-500)' : 'var(--border-subtle)',
        boxShadow: isActive ? 'var(--shadow-card)' : undefined,
      }}
    >
      {/* Header pill */}
      <div
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Lock indicator for header, or 1-Click Move Up / Down Buttons for movable sections */}
        {section.section_type === 'header' ? (
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 dark:text-neutral-500 bg-slate-100 dark:bg-neutral-800/80 shrink-0 border border-slate-200/50 dark:border-neutral-700/50"
            title="Header section is locked at the top"
            onClick={e => e.stopPropagation()}
          >
            <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-400" />
          </div>
        ) : (
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              disabled={isFirst}
              onClick={onMoveUp}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
              title="Move section up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={onMoveDown}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer transition-colors"
              title="Move section down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <input
          type="text"
          value={titleValue}
          onChange={e => setTitleValue(e.target.value)}
          onBlur={handleTitleSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          onClick={e => e.stopPropagation()}
          className={`flex-1 text-sm font-semibold truncate bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -mx-1 ${!isVisible ? 'line-through opacity-70' : ''}`}
          style={{ color: 'var(--text-primary)' }}
          title="Click to edit section title"
        />
        {!isVisible && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            Hidden
          </span>
        )}
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-md capitalize border shrink-0 inline-flex items-center gap-1"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          {section.section_type === 'header' && <Lock className="w-2.5 h-2.5 opacity-60" />}
          {section.section_type}
        </span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isVisible
              ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
              : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
          }`}
          style={{ color: isVisible ? undefined : 'var(--text-muted)' }}
          title={isVisible ? 'Visible on resume (Click to hide)' : 'Hidden from resume (Click to show)'}
        >
          {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        {section.section_type !== 'header' && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <div style={{ color: 'var(--text-muted)' }} className="shrink-0">
          {isActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Collapsible Content */}
      {isActive && (
        <div
          className="px-4 pb-4 pt-1 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <SectionEditor
            section={section}
            resumeId={resumeId}
            onUpdate={onUpdate}
            onOpenCopilotWithBullet={onOpenCopilotWithBullet}
          />
        </div>
      )}
    </div>
  );
}

// ─── Add Section Dropdown ─────────────────────────────────────────────────────

const SECTION_TYPES = [
  { type: 'experience',     label: 'Work Experience'  },
  { type: 'education',      label: 'Education'        },
  { type: 'skills',         label: 'Skills'           },
  { type: 'projects',       label: 'Projects'         },
  { type: 'certifications', label: 'Certifications'   },
  { type: 'custom',         label: 'Custom Section'   },
];

function AddSectionDropdown({ onAdd }: { onAdd: (type: string, title: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  return (
    <div className="relative pt-2" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-xs font-semibold transition-all hover:border-blue-600 hover:bg-blue-500/5 text-blue-600 cursor-pointer"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <Plus className="w-4 h-4" /> Add Resume Section
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border shadow-2xl overflow-hidden z-20 glass animate-fade-in-up"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="p-1.5 space-y-1">
            {SECTION_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onAdd(type, label);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all hover:bg-blue-500/10 hover:text-blue-600 cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
