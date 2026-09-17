import { useState, useEffect, useRef } from 'react';
import { type Section } from '../api';
import { Plus, Trash2, SlidersHorizontal, Loader2, GripVertical } from 'lucide-react';
import { aiApi } from '../api';

interface Props {
  section: Section;
  resumeId: string;
  onUpdate: (data: Partial<Section>) => void;
  onOpenCopilotWithBullet?: (bulletText: string, context: { sectionId: string; index: number }) => void;
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
        <textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-y"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
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

export default function SectionEditor({ section, resumeId, onUpdate, onOpenCopilotWithBullet }: Props) {
  const [localContent, setLocalContent] = useState<Record<string, unknown>[]>((section.content || []) as Record<string, unknown>[]);
  const [rewriting, setRewriting] = useState<number | null>(null);
  const updateTimeout = useRef<NodeJS.Timeout | null>(null);
  const isTyping = useRef(false);

  useEffect(() => {
    if (!isTyping.current) {
      setLocalContent((section.content || []) as Record<string, unknown>[]);
    }
  }, [section.content]);

  const updateContent = (newContent: unknown[]) => {
    setLocalContent(newContent as Record<string, unknown>[]);
    isTyping.current = true;
    if (updateTimeout.current) clearTimeout(updateTimeout.current);
    updateTimeout.current = setTimeout(() => {
      isTyping.current = false;
      onUpdate({ ...section, content: newContent });
    }, 700);
  };

  const updateEntry = (idx: number, patch: Record<string, unknown>) => {
    const next = [...localContent];
    next[idx] = { ...(next[idx] || {}), ...patch };
    updateContent(next);
  };

  const addEntry = (template: Record<string, unknown>) => {
    updateContent([...localContent, template]);
  };

  const removeEntry = (idx: number) => {
    updateContent(localContent.filter((_, i) => i !== idx));
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
        <textarea
          value={text}
          onChange={e => updateEntry(idx, { text: e.target.value })}
          placeholder="High-impact engineering leader with 8+ years building distributed cloud platforms…"
          rows={3}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-y"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
    );
  };

  const renderExperience = (entry: Record<string, unknown>, idx: number) => {
    const bullets = (entry.bullets as string[]) ?? [];
    return (
      <div
        key={idx}
        className="p-4 rounded-2xl border space-y-3.5 mb-3 transition-all"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Position #{idx + 1}
          </span>
          <button
            type="button"
            onClick={() => removeEntry(idx)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Remove entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

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
          {bullets.map((bullet, bIdx) => {
            const isRewriting = rewriting === idx * 1000 + bIdx;
            return (
              <div key={bIdx} className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 mt-2.5 text-slate-400/40 shrink-0" />
                <textarea
                  value={bullet}
                  onChange={e => {
                    const next = [...bullets];
                    next[bIdx] = e.target.value;
                    updateEntry(idx, { bullets: next });
                  }}
                  rows={2}
                  className="flex-1 rounded-xl px-3.5 py-2 text-xs transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Led migration of core payments service, reducing latency by 35%…"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCopilotWithBullet && bullet.trim()) {
                        onOpenCopilotWithBullet(bullet, { sectionId: section.id, index: bIdx });
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
                    onClick={() => {
                      const next = bullets.filter((_, i) => i !== bIdx);
                      updateEntry(idx, { bullets: next });
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Remove bullet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => updateEntry(idx, { bullets: [...bullets, ''] })}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline pt-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add bullet point
          </button>
        </div>
      </div>
    );
  };

  const renderEducation = (entry: Record<string, unknown>, idx: number) => (
    <div
      key={idx}
      className="p-4 rounded-2xl border space-y-3 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Degree #{idx + 1}</span>
        <button
          type="button"
          onClick={() => removeEntry(idx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
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

  const renderSkills = (entry: Record<string, unknown>, idx: number) => {
    const rawItems = entry.items;
    const itemsStr = Array.isArray(rawItems) ? rawItems.join(', ') : (rawItems as string) ?? '';
    return (
      <div
        key={idx}
        className="p-4 rounded-2xl border space-y-3 mb-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Category #{idx + 1}</span>
          <button
            type="button"
            onClick={() => removeEntry(idx)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <Field label="Category Name" value={(entry.category as string) ?? ''} onChange={v => updateEntry(idx, { category: v })} placeholder="Languages, Frameworks, Cloud, etc." />
        <Field
          label="Skills (comma separated)"
          value={itemsStr}
          onChange={v => {
            const arr = v.split(',').map(s => s.trim()).filter(Boolean);
            updateEntry(idx, { items: arr });
          }}
          placeholder="TypeScript, React, Go, Docker, AWS, PostgreSQL"
        />
      </div>
    );
  };

  const renderProjects = (entry: Record<string, unknown>, idx: number) => {
    const rawTech = entry.tech;
    const techStr = Array.isArray(rawTech) ? rawTech.join(', ') : (rawTech as string) ?? '';
    return (
      <div
        key={idx}
        className="p-4 rounded-2xl border space-y-3 mb-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Project #{idx + 1}</span>
          <button
            type="button"
            onClick={() => removeEntry(idx)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Project Name" value={(entry.name as string) ?? ''} onChange={v => updateEntry(idx, { name: v })} placeholder="AuraCV" />
          <Field label="URL / Repository" value={(entry.url as string) ?? ''} onChange={v => updateEntry(idx, { url: v })} placeholder="github.com/org/project" />
        </div>
        <Field
          label="Technologies Used (comma separated)"
          value={techStr}
          onChange={v => {
            const arr = v.split(',').map(s => s.trim()).filter(Boolean);
            updateEntry(idx, { tech: arr });
          }}
          placeholder="Next.js, Tailwind, SQLite, WebAssembly"
        />
        <Field
          label="Project Description"
          value={(entry.description as string) ?? ''}
          onChange={v => updateEntry(idx, { description: v })}
          multiline
          placeholder="Engineered high-performance offline resume system with instant live previews…"
        />
      </div>
    );
  };

  const renderCertifications = (entry: Record<string, unknown>, idx: number) => (
    <div
      key={idx}
      className="p-4 rounded-2xl border space-y-3 mb-3"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Certification #{idx + 1}</span>
        <button
          type="button"
          onClick={() => removeEntry(idx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
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
    <div className="space-y-3 pt-2">
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
          {localContent.map(renderSkills)}
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
          {localContent.map(renderProjects)}
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
    </div>
  );
}
