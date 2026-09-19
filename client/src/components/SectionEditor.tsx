import { useState, useEffect, useRef } from 'react';
import { type Section } from '../api';
import { Plus, Trash2, SlidersHorizontal, Loader2, Bold, Italic, Link as LinkIcon, ChevronDown, ChevronUp, GripVertical, Check, Cloud, Save } from 'lucide-react';
import { aiApi } from '../api';
import { useAppStore } from '../store';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface Props {
  section: Section;
  resumeId: string;
  onUpdate: (data: Partial<Section>) => void;
  onOpenCopilotWithBullet?: (bulletText: string, context: { sectionId: string; index: number }) => void;
}
// ─── Markdown Shortcut Helper ─────────────────────────────────────────────
const handleMarkdownShortcut = (
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void
) => {
  if (!e.ctrlKey && !e.metaKey) return;
  const key = e.key.toLowerCase();
  if (!['b', 'i', 'k'].includes(key)) return;
  
  e.preventDefault();
  const target = e.currentTarget;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  
  let prefix = '';
  let suffix = '';
  if (key === 'b') { prefix = '**'; suffix = '**'; }
  else if (key === 'i') { prefix = '*'; suffix = '*'; }
  else if (key === 'k') { prefix = '['; suffix = '](url)'; }

  const selected = value.substring(start, end);
  const next = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
  onChange(next);

  setTimeout(() => {
    target.focus();
    if (selected) {
      if (key === 'k') target.setSelectionRange(start + 1, start + 1 + selected.length);
      else target.setSelectionRange(start + prefix.length, end + prefix.length);
    } else {
      target.setSelectionRange(start + prefix.length, start + prefix.length);
    }
  }, 0);
};

// ─── Markdown Area Component ─────────────────────────────────────────────
function MarkdownArea({
  value,
  onChange,
  placeholder = '',
  rows = 1,
  className = "w-full rounded-xl px-3.5 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = (type: 'bold' | 'italic' | 'link') => {
    const target = textareaRef.current;
    if (!target) return;
    
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    let prefix = '';
    let suffix = '';
    if (type === 'bold') { prefix = '**'; suffix = '**'; }
    else if (type === 'italic') { prefix = '*'; suffix = '*'; }
    else if (type === 'link') { prefix = '['; suffix = '](url)'; }

    const selected = value.substring(start, end);
    const next = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
    onChange(next);

    setTimeout(() => {
      target.focus();
      if (selected) {
        if (type === 'link') target.setSelectionRange(start + 1, start + 1 + selected.length);
        else target.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        target.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div className="relative group flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => handleMarkdownShortcut(e, value, onChange)}
        placeholder={placeholder}
        rows={rows}
        className={`${className} overflow-hidden resize-none pr-24`}
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
      />
      <div 
        className="absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-md shadow-sm border p-0.5"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <button type="button" onClick={() => handleFormat('bold')} className="p-1 hover:bg-slate-500/10 rounded text-slate-500 transition-colors" title="Bold (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => handleFormat('italic')} className="p-1 hover:bg-slate-500/10 rounded text-slate-500 transition-colors" title="Italic (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => handleFormat('link')} className="p-1 hover:bg-slate-500/10 rounded text-slate-500 transition-colors" title="Link (Ctrl+K)"><LinkIcon className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function SortableBullet({
  id,
  bullet,
  bIdx,
  idx,
  rewriting,
  onOpenCopilotWithBullet,
  rewriteBullet,
  updateEntry,
  bullets,
  sectionId,
  onRemove,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isRewriting = rewriting === idx * 1000 + bIdx;

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 bg-transparent relative z-10">
      <div {...attributes} {...listeners} className="mt-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0 outline-none">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <MarkdownArea
          value={bullet}
          onChange={v => {
            const next = [...bullets];
            next[bIdx] = v;
            updateEntry(idx, { bullets: next });
          }}
          placeholder="Led migration of core payments service, reducing latency by 35%…"
          className="w-full rounded-xl px-3.5 py-2 text-xs transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none overflow-hidden"
        />
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            if (onOpenCopilotWithBullet && bullet.trim()) {
              onOpenCopilotWithBullet(bullet, { sectionId, index: bIdx });
            } else {
              rewriteBullet(idx, bIdx, bullet);
            }
          }}
          disabled={isRewriting || !bullet.trim()}
          className="p-2 rounded-xl border transition-all text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 disabled:opacity-40 cursor-pointer"
          style={{ borderColor: 'var(--border-subtle)' }}
          title="Polish bullet in Copilot"
        >
          {isRewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
          title="Remove bullet"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Universal Field Component ─────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {multiline ? (
        <MarkdownArea value={value ?? ''} onChange={onChange} placeholder={placeholder} />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3.5 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      )}
    </div>
  );
}

function getEntryKey(entry: Record<string, unknown>, idx: number, prefix: string): string {
  if (!entry._id) {
    entry._id = `${prefix}_${idx}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return entry._id as string;
}

function SkillItemEditor({
  entry,
  idx,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: Record<string, unknown>;
  idx: number;
  total: number;
  onUpdate: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const getInitialSkills = () => {
    if (typeof entry._rawItems === 'string') return entry._rawItems;
    if (Array.isArray(entry.items)) return (entry.items as string[]).join(', ');
    return String(entry.items || '');
  };

  const [skillsText, setSkillsText] = useState(getInitialSkills);
  const [prevItems, setPrevItems] = useState(entry.items);

  if (entry.items !== prevItems) {
    setPrevItems(entry.items);
    const rawProps = Array.isArray(entry.items) ? (entry.items as string[]).join(', ') : String(entry.items || '');
    const currentParsed = skillsText.split(',').map(s => s.trim()).filter(Boolean);
    const incomingParsed = Array.isArray(entry.items) ? entry.items : [];
    if (JSON.stringify(currentParsed) !== JSON.stringify(incomingParsed)) {
      setSkillsText(typeof entry._rawItems === 'string' ? entry._rawItems : rawProps);
    }
  }

  const handleSkillsChange = (v: string) => {
    setSkillsText(v);
    const arr = v.split(',').map(s => s.trim()).filter(Boolean);
    onUpdate({ items: arr, _rawItems: v });
  };

  return (
    <div
      className="p-4 rounded-2xl border space-y-3 mb-3 transition-all"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Category #{idx + 1}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={onMoveUp}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move category up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === total - 1}
              onClick={onMoveDown}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move category down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Delete category"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <Field
        label="Category Name"
        value={(entry.category as string) ?? ''}
        onChange={v => onUpdate({ category: v })}
        placeholder="Languages, Frameworks, Cloud, etc."
      />
      <Field
        label="Skills (comma separated)"
        value={skillsText}
        onChange={handleSkillsChange}
        placeholder="TypeScript, React, Go, Docker, AWS, PostgreSQL"
      />
    </div>
  );
}

function ProjectItemEditor({
  entry,
  idx,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: Record<string, unknown>;
  idx: number;
  total: number;
  onUpdate: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const getInitialTech = () => {
    if (typeof entry._rawTech === 'string') return entry._rawTech;
    if (Array.isArray(entry.tech)) return (entry.tech as string[]).join(', ');
    return String(entry.tech || '');
  };

  const [techText, setTechText] = useState(getInitialTech);
  const [prevTech, setPrevTech] = useState(entry.tech);

  if (entry.tech !== prevTech) {
    setPrevTech(entry.tech);
    const rawProps = Array.isArray(entry.tech) ? (entry.tech as string[]).join(', ') : String(entry.tech || '');
    const currentParsed = techText.split(',').map(s => s.trim()).filter(Boolean);
    const incomingParsed = Array.isArray(entry.tech) ? entry.tech : [];
    if (JSON.stringify(currentParsed) !== JSON.stringify(incomingParsed)) {
      setTechText(typeof entry._rawTech === 'string' ? entry._rawTech : rawProps);
    }
  }

  const handleTechChange = (v: string) => {
    setTechText(v);
    const arr = v.split(',').map(s => s.trim()).filter(Boolean);
    onUpdate({ tech: arr, _rawTech: v });
  };

  return (
    <div
      className="p-4 rounded-2xl border space-y-3 mb-3 transition-all"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
            Project #{idx + 1}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={onMoveUp}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move project up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === total - 1}
              onClick={onMoveDown}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move project down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Project Name" value={(entry.name as string) ?? ''} onChange={v => onUpdate({ name: v })} placeholder="AuraCV" />
        <Field label="URL / Repository" value={(entry.url as string) ?? ''} onChange={v => onUpdate({ url: v })} placeholder="github.com/org/project" />
      </div>
      <Field
        label="Technologies Used (comma separated)"
        value={techText}
        onChange={handleTechChange}
        placeholder="Next.js, Tailwind, SQLite, WebAssembly"
      />
      <Field
        label="Project Description"
        value={(entry.description as string) ?? ''}
        onChange={v => onUpdate({ description: v })}
        multiline
        placeholder="Engineered high-performance offline resume system with instant live previews…"
      />
    </div>
  );
}

export default function SectionEditor({ section, resumeId, onUpdate, onOpenCopilotWithBullet }: Props) {
  const { settings } = useAppStore();
  const autoSave = settings.auto_save !== 'false';
  const [localContent, setLocalContent] = useState<Record<string, unknown>[]>((section.content || []) as Record<string, unknown>[]);
  const [isDirty, setIsDirty] = useState(false);
  const [rewriting, setRewriting] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const addingEntry = useRef(false);
  const prevSectionId = useRef(section.id);

  const localContentRef = useRef(localContent);
  const isDirtyRef = useRef(isDirty);
  const onUpdateRef = useRef(onUpdate);
  const sectionRef = useRef(section);

  useEffect(() => {
    localContentRef.current = localContent;
    isDirtyRef.current = isDirty;
    onUpdateRef.current = onUpdate;
    sectionRef.current = section;
  }, [localContent, isDirty, onUpdate, section]);

  const toggleExpanded = (idx: number, type: string) => {
    const key = `${type}-${idx}`;
    setExpanded(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };
  const isExpanded = (idx: number, type: string) => expanded[`${type}-${idx}`] ?? true;

  const stripForSave = (arr: unknown[]) =>
    (arr as Record<string, unknown>[]).map(item => {
      if (!item || typeof item !== 'object') return item;
      const { _rawItems, _rawTech, ...rest } = item;
      return rest;
    });

  const handleSaveNow = () => {
    if (updateTimeout.current) clearTimeout(updateTimeout.current);
    isTyping.current = false;
    setIsDirty(false);
    onUpdate({ ...section, content: stripForSave(localContent) });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveNow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    return () => {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      if (isDirtyRef.current) {
        onUpdateRef.current({ ...sectionRef.current, content: stripForSave(localContentRef.current) });
      }
    };
  }, []);

  useEffect(() => {
    const isNewSection = prevSectionId.current !== section.id;
    prevSectionId.current = section.id;

    if (isNewSection) {
      setLocalContent((section.content || []) as Record<string, unknown>[]);
      setIsDirty(false);
      isTyping.current = false;
      return;
    }

    // Never overwrite while the user is actively focused on an input inside this editor
    if (containerRef.current?.contains(document.activeElement)) {
      return;
    }

    // Strip internal helper keys (_id, _rawItems, _rawTech, _bulletIds) before comparing
    const stripInternal = (arr: unknown[]) =>
      (arr || []).map(item => {
        if (!item || typeof item !== 'object') return item;
        const { _id, _rawItems, _rawTech, _bulletIds, ...rest } = item as Record<string, unknown>;
        return rest;
      });

    const incomingStr = JSON.stringify(stripInternal(section.content || []));
    const localStr = JSON.stringify(stripInternal(localContentRef.current));

    if (incomingStr === localStr) {
      return;
    }

    if (!isDirtyRef.current) {
      setLocalContent((section.content || []) as Record<string, unknown>[]);
    }
  }, [section.id, section.content]);

  const updateContent = (newContent: unknown[], immediate = false) => {
    setLocalContent(newContent as Record<string, unknown>[]);
    setIsDirty(true);
    isTyping.current = true;
    if (updateTimeout.current) clearTimeout(updateTimeout.current);

    if (immediate) {
      isTyping.current = false;
      setIsDirty(false);
      onUpdate({ ...section, content: stripForSave(newContent) });
    } else if (autoSave) {
      updateTimeout.current = setTimeout(() => {
        isTyping.current = false;
        setIsDirty(false);
        onUpdate({ ...section, content: stripForSave(newContent) });
      }, 700);
    }
  };

  const updateEntry = (idx: number, patch: Record<string, unknown>) => {
    const next = [...localContent];
    next[idx] = { ...(next[idx] || {}), ...patch };
    updateContent(next);
  };

  const addEntry = (template: Record<string, unknown>) => {
    addingEntry.current = true;
    updateContent([...localContent, template]);
  };

  const removeEntry = (idx: number) => {
    updateContent(localContent.filter((_, i) => i !== idx), true);
  };

  const moveEntry = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= localContent.length) return;
    const next = [...localContent];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    updateContent(next, true);
  };

  const rewriteBullet = async (entryIdx: number, bulletIdx: number, bulletText: string) => {
    if (!bulletText.trim()) return;
    setRewriting(entryIdx * 1000 + bulletIdx);
    try {
      const result = await aiApi.rewrite({
        bullet: bulletText,
        resume_id: resumeId,
        section_id: section.id,
      });
      const entry = { ...(localContent[entryIdx] || {}) };
      const bullets = [...((entry.bullets as string[]) ?? [])];
      bullets[bulletIdx] = result.rewritten;
      entry.bullets = bullets;
      updateEntry(entryIdx, entry);
    } catch (err) {
      console.error('AI rewrite failed:', err);
    } finally {
      setRewriting(null);
    }
  };



  // ─── Section Type Renderers ────────────────────────────────────────────────

  const renderHeader = (entry: Record<string, unknown>, idx: number) => (
    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      {(['name', 'role', 'email', 'phone', 'location', 'linkedin', 'github', 'website'] as const).map(field => (
        <Field
          key={field}
          label={field.charAt(0).toUpperCase() + field.slice(1)}
          value={(entry[field] as string) ?? ''}
          onChange={v => updateEntry(idx, { [field]: v })}
          placeholder={
            field === 'name' ? 'Jane Doe' :
            field === 'role' ? 'Staff Software Engineer' :
            field === 'email' ? 'jane@example.com' :
            field === 'phone' ? '+1 (555) 234-5678' :
            field === 'location' ? 'San Francisco, CA' :
            field === 'linkedin' ? 'linkedin.com/in/janedoe' :
            field === 'github' ? 'github.com/janedoe' : 'janedoe.dev'
          }
        />
      ))}
    </div>
  );

  const renderSummary = (entry: Record<string, unknown>, idx: number) => {
    const text = (entry.text as string) ?? '';
    return (
      <div key={idx} className="pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
            Professional Summary
          </label>
          {onOpenCopilotWithBullet && text.trim() && (
            <button
              type="button"
              onClick={() => onOpenCopilotWithBullet(text, { sectionId: section.id, index: idx })}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" /> Polish with Copilot
            </button>
          )}
        </div>
        <MarkdownArea
          value={text}
          onChange={v => updateEntry(idx, { text: v })}
          placeholder="High-impact engineering leader with 8+ years building distributed cloud platforms…"
          rows={3}
        />
      </div>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const renderExperience = (entry: Record<string, unknown>, idx: number) => {
    const bullets = (entry.bullets as string[]) ?? [];
    
    // Ensure stable unique IDs for bullets that do NOT change when text is typed
    if (!entry._bulletIds || !Array.isArray(entry._bulletIds) || (entry._bulletIds as string[]).length !== bullets.length) {
      const existing = ((entry._bulletIds as string[]) || []);
      entry._bulletIds = bullets.map((_, i) => existing[i] || `bullet_${idx}_${i}_${Math.random().toString(36).slice(2, 9)}`);
    }
    const bulletIds = entry._bulletIds as string[];

    const expanded = isExpanded(idx, 'experience');
    
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = bulletIds.indexOf(String(active.id));
        const newIndex = bulletIds.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          const newBullets = [...bullets];
          const newIds = [...bulletIds];
          const [movedB] = newBullets.splice(oldIndex, 1);
          const [movedId] = newIds.splice(oldIndex, 1);
          newBullets.splice(newIndex, 0, movedB);
          newIds.splice(newIndex, 0, movedId);
          updateEntry(idx, { bullets: newBullets, _bulletIds: newIds });
        }
      }
    };

    return (
      <div
        key={getEntryKey(entry, idx, 'exp')}
        className="p-4 rounded-2xl border mb-3 transition-all"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => toggleExpanded(idx, 'experience')}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Position #{idx + 1}
            </span>
            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveEntry(idx, 'up')}
                className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                title="Move position up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={idx === localContent.length - 1}
                onClick={() => moveEntry(idx, 'down')}
                className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                title="Move position down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {!expanded && Boolean(entry.role || entry.company) && (
              <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[300px]">
                {String(entry.role || '')} {entry.role && entry.company ? 'at' : ''} {String(entry.company || '')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeEntry(idx); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Remove entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {expanded && (
          <div className="space-y-3.5 mt-3.5 pt-3.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Job Title" value={(entry.role as string) ?? ''} onChange={v => updateEntry(idx, { role: v })} placeholder="Senior Software Engineer" />
          <Field label="Company" value={(entry.company as string) ?? ''} onChange={v => updateEntry(idx, { company: v })} placeholder="Stripe" />
          <Field label="Start Date" value={(entry.start_date as string) ?? ''} onChange={v => updateEntry(idx, { start_date: v })} placeholder="Jan 2022" />
          <Field label="End Date" value={(entry.end_date as string) ?? ''} onChange={v => updateEntry(idx, { end_date: v })} placeholder="Present" />
          <div className="sm:col-span-2">
            <Field label="Location" value={(entry.location as string) ?? ''} onChange={v => updateEntry(idx, { location: v })} placeholder="San Francisco, CA (Hybrid)" />
          </div>
        </div>

        {/* Bullet Points with Copilot polish */}
        <div className="space-y-2 pt-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
            Accomplishments and Bullets
          </label>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={bulletIds} strategy={verticalListSortingStrategy}>
              {bullets.map((bullet, bIdx) => (
                <SortableBullet
                  key={bulletIds[bIdx]}
                  id={bulletIds[bIdx]}
                  bullet={bullet}
                  bIdx={bIdx}
                  idx={idx}
                  rewriting={rewriting}
                  onOpenCopilotWithBullet={onOpenCopilotWithBullet}
                  rewriteBullet={rewriteBullet}
                  updateEntry={updateEntry}
                  bullets={bullets}
                  sectionId={section.id}
                  onRemove={() => {
                    const nextBullets = bullets.filter((_, i) => i !== bIdx);
                    const nextIds = bulletIds.filter((_, i) => i !== bIdx);
                    updateEntry(idx, { bullets: nextBullets, _bulletIds: nextIds });
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => {
              const newId = `bullet_${idx}_${bullets.length}_${Math.random().toString(36).slice(2, 9)}`;
              updateEntry(idx, {
                bullets: [...bullets, ''],
                _bulletIds: [...bulletIds, newId],
              });
            }}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline pt-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add bullet point
          </button>
        </div>
          </div>
        )}
      </div>
    );
  };

  const renderEducation = (entry: Record<string, unknown>, idx: number) => (
    <div
      key={getEntryKey(entry, idx, 'edu')}
      className="p-4 rounded-2xl border space-y-3 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Degree #{idx + 1}</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => moveEntry(idx, 'up')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move degree up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === localContent.length - 1}
              onClick={() => moveEntry(idx, 'down')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move degree down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeEntry(idx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Delete degree"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Degree" value={(entry.degree as string) ?? ''} onChange={v => updateEntry(idx, { degree: v })} placeholder="B.S. Computer Science" />
        <Field label="Field of Study" value={(entry.field as string) ?? ''} onChange={v => updateEntry(idx, { field: v })} placeholder="Computer Engineering" />
        <Field label="Institution" value={(entry.institution as string) ?? ''} onChange={v => updateEntry(idx, { institution: v })} placeholder="Stanford University" />
        <Field label="GPA / Honors" value={(entry.gpa as string) ?? ''} onChange={v => updateEntry(idx, { gpa: v })} placeholder="3.9 / Magna Cum Laude" />
        <Field label="Start Date" value={(entry.start_date as string) ?? ''} onChange={v => updateEntry(idx, { start_date: v })} placeholder="2018" />
        <Field label="End Date" value={(entry.end_date as string) ?? ''} onChange={v => updateEntry(idx, { end_date: v })} placeholder="2022" />
      </div>
    </div>
  );

  const renderCustom = (entry: Record<string, unknown>, idx: number) => (
    <div
      key={getEntryKey(entry, idx, 'custom')}
      className="p-4 rounded-2xl border space-y-3 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-500">Item #{idx + 1}</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => moveEntry(idx, 'up')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move item up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === localContent.length - 1}
              onClick={() => moveEntry(idx, 'down')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move item down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeEntry(idx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Delete item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <Field label="Title / Heading" value={(entry.title as string) ?? ''} onChange={v => updateEntry(idx, { title: v })} placeholder="Item title or heading" />
      <Field
        label="Description / Content"
        value={(entry.description as string) ?? ''}
        onChange={v => updateEntry(idx, { description: v })}
        multiline
        placeholder="Describe this item…"
      />
    </div>
  );

  const renderCertifications = (entry: Record<string, unknown>, idx: number) => (
    <div
      key={getEntryKey(entry, idx, 'cert')}
      className="p-4 rounded-2xl border space-y-3 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Certification #{idx + 1}</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => moveEntry(idx, 'up')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move certification up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === localContent.length - 1}
              onClick={() => moveEntry(idx, 'down')}
              className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
              title="Move certification down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeEntry(idx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          title="Delete certification"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Certification" value={(entry.name as string) ?? ''} onChange={v => updateEntry(idx, { name: v })} placeholder="AWS Solutions Architect" />
        <Field label="Issuer" value={(entry.issuer as string) ?? ''} onChange={v => updateEntry(idx, { issuer: v })} placeholder="Amazon Web Services" />
        <Field label="Date" value={(entry.date as string) ?? ''} onChange={v => updateEntry(idx, { date: v })} placeholder="Nov 2023" />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="space-y-3 pt-2">
      {section.section_type === 'header' && (localContent[0] ? renderHeader(localContent[0], 0) : renderHeader({}, 0))}
      {section.section_type === 'summary' && (localContent[0] ? renderSummary(localContent[0], 0) : renderSummary({}, 0))}
      {section.section_type === 'experience' && (
        <div>
          {localContent.map(renderExperience)}
          <button
            type="button"
            onClick={() => addEntry({ role: '', company: '', start_date: '', end_date: '', location: '', bullets: [''] })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-blue-600 hover:bg-blue-500/5 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Experience
          </button>
        </div>
      )}
      {section.section_type === 'education' && (
        <div>
          {localContent.map(renderEducation)}
          <button
            type="button"
            onClick={() => addEntry({ degree: '', field: '', institution: '', gpa: '', start_date: '', end_date: '' })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-emerald-500 hover:bg-emerald-500/5 text-emerald-500 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Degree
          </button>
        </div>
      )}
      {section.section_type === 'skills' && (
        <div>
          {localContent.map((entry, idx) => (
            <SkillItemEditor
              key={getEntryKey(entry, idx, 'skill')}
              entry={entry}
              idx={idx}
              total={localContent.length}
              onUpdate={patch => updateEntry(idx, patch)}
              onRemove={() => removeEntry(idx)}
              onMoveUp={() => moveEntry(idx, 'up')}
              onMoveDown={() => moveEntry(idx, 'down')}
            />
          ))}
          <button
            type="button"
            onClick={() => addEntry({ category: '', items: [] })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-blue-600 hover:bg-blue-500/5 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Skill Category
          </button>
        </div>
      )}
      {section.section_type === 'projects' && (
        <div>
          {localContent.map((entry, idx) => (
            <ProjectItemEditor
              key={getEntryKey(entry, idx, 'proj')}
              entry={entry}
              idx={idx}
              total={localContent.length}
              onUpdate={patch => updateEntry(idx, patch)}
              onRemove={() => removeEntry(idx)}
              onMoveUp={() => moveEntry(idx, 'up')}
              onMoveDown={() => moveEntry(idx, 'down')}
            />
          ))}
          <button
            type="button"
            onClick={() => addEntry({ name: '', url: '', tech: [], description: '' })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-amber-500 hover:bg-amber-500/5 text-amber-500 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Project
          </button>
        </div>
      )}
      {section.section_type === 'certifications' && (
        <div>
          {localContent.map(renderCertifications)}
          <button
            type="button"
            onClick={() => addEntry({ name: '', issuer: '', date: '' })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-rose-500 hover:bg-rose-500/5 text-rose-500 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Certification
          </button>
        </div>
      )}
      {section.section_type === 'custom' && (
        <div>
          {localContent.map(renderCustom)}
          <button
            type="button"
            onClick={() => addEntry({ title: '', description: '' })}
            className="w-full py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all hover:border-purple-500 hover:bg-purple-500/5 text-purple-500 flex items-center justify-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>
      )}

      {/* Save status footer */}
      {!autoSave ? (
        <div
          className="flex items-center justify-between pt-3 mt-4 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {isDirty ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved changes in this section</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Section up to date</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveNow}
            disabled={!isDirty}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isDirty
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                : 'opacity-40 bg-slate-100 dark:bg-neutral-800 text-slate-400 cursor-not-allowed'
            }`}
            title="Save changes in this section (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Section</span>
            <span className="text-[10px] opacity-75 font-mono ml-0.5">Ctrl+S</span>
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between pt-3 mt-3 border-t text-[11px]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <Cloud className="w-3 h-3 text-emerald-500" />
            Auto-save active
          </span>
          <span className="opacity-70">Changes save automatically as you type</span>
        </div>
      )}
    </div>
  );
}
