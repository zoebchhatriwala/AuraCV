import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import {
  Plus, FileText, Copy, Trash2, Pencil, Clock,
  Upload, Layers, CheckCircle2, Eye, X, Loader2,
  ShieldCheck, Zap
} from 'lucide-react';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard() {
  const { resumes, loadingResumes, createResume, deleteResume, duplicateResume, updateResume } = useAppStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [showCreate, setShowCreate] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resumeToDelete, setResumeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionValue, setVersionValue] = useState('');

  const handleCreate = async () => {
    const finalName = newName.trim() || 'Untitled Resume';
    setCreating(true);
    try {
      const id = await createResume(finalName, selectedTemplate);
      navigate(`/editor/${id}`);
    } finally {
      setCreating(false);
      setShowCreate(false);
      setNewName('');
    }
  };

  const handleStartEditVersion = (e: React.MouseEvent, resumeId: string, currentTag: string) => {
    e.stopPropagation();
    setEditingVersionId(resumeId);
    setVersionValue(currentTag || 'v1');
  };

  const handleSaveVersion = async (resumeId: string) => {
    const newTag = versionValue.trim() || 'v1';
    setEditingVersionId(null);
    const existing = resumes.find(r => r.id === resumeId);
    if (existing && newTag !== existing.version_tag) {
      await updateResume(resumeId, { version_tag: newTag });
    }
  };

  const filteredResumes = resumes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.meta?.target_role && r.meta.target_role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto animate-fade-in-up space-y-6 sm:space-y-8">
      {/* ── Case 1: Resumes Exist ─────────────────────────────────────────── */}
      {resumes.length > 0 ? (
        <>
          {/* Top Bar with Title, Search, and Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Your Resumes
                </h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {resumes.length}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Manage, edit, and export your resumes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search resumes..."
                  className="w-full px-3.5 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/import')}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Import
                </button>

                <button
                  onClick={() => setShowCreate(true)}
                  className="flex-1 sm:flex-initial btn-primary inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Resume
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Resumes', value: resumes.length, sub: 'Saved in studio' },
              { label: 'Target Roles', value: new Set(resumes.map(r => r.meta?.target_role || r.name)).size, sub: 'Active variations' },
              { label: 'Last Modified', value: resumes[0]?.updated_at ? new Date(resumes[0].updated_at).toLocaleDateString() : 'Today', sub: 'Most recent edit' },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl glass-card border transition-all"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {stat.value}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {stat.sub}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumes Grid */}
          {loadingResumes ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl p-6 border glass-card animate-pulse space-y-4">
                  <div className="h-6 w-3/4 rounded-lg bg-slate-400/20" />
                  <div className="h-4 w-1/2 rounded-lg bg-slate-400/15" />
                  <div className="h-16 rounded-xl bg-slate-400/10" />
                </div>
              ))}
            </div>
          ) : filteredResumes.length === 0 ? (
            <div
              className="py-16 text-center rounded-3xl border glass-card space-y-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                No resumes match "{searchQuery}"
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Try searching for a different title or keyword.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-2 inline-block cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResumes.map((resume, idx) => (
                <div
                  key={resume.id}
                  onClick={() => navigate(`/editor/${resume.id}`)}
                  className="rounded-2xl p-6 border glass-card cursor-pointer group flex flex-col justify-between transition-all"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="space-y-3">
                    {/* Header tag and icon */}
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {editingVersionId === resume.id ? (
                          <div onClick={e => e.stopPropagation()} className="flex items-center">
                            <input
                              autoFocus
                              type="text"
                              value={versionValue}
                              onChange={e => setVersionValue(e.target.value)}
                              onBlur={() => handleSaveVersion(resume.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveVersion(resume.id);
                                if (e.key === 'Escape') setEditingVersionId(null);
                              }}
                              className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border w-16 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-default)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </div>
                        ) : (
                          <span
                            onClick={e => handleStartEditVersion(e, resume.id, resume.version_tag)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer group/tag flex items-center gap-1"
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                            title="Click to edit version tag"
                          >
                            <span>{resume.version_tag || 'v1'}</span>
                            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/tag:opacity-70 transition-opacity" />
                          </span>
                        )}
                        <span
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize border"
                          style={{
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {resume.template_id}
                        </span>
                      </div>
                    </div>

                    {/* Title and target role */}
                    <div>
                      <h3
                        className="font-display font-bold text-base line-clamp-1 group-hover:text-blue-600 transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {resume.name}
                      </h3>
                      {resume.meta?.target_role && (
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                          {resume.meta.target_role} {resume.meta.target_company && `· ${resume.meta.target_company}`}
                        </p>
                      )}
                    </div>

                    {/* Meta details */}
                    <div className="flex items-center gap-3 text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(resume.updated_at).toLocaleDateString()}
                      </span>
                      <span>·</span>
                      <span>{resume.section_count ?? 5} sections</span>
                    </div>
                  </div>

                  {/* Action Toolbar */}
                  <div
                    className="flex items-center gap-2 pt-6 mt-4 border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => navigate(`/editor/${resume.id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => duplicateResume(resume.id)}
                      className="p-2 rounded-xl border transition-all bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      title="Duplicate resume version"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setResumeToDelete({ id: resume.id, name: resume.name })}
                      className="p-2 rounded-xl border transition-all bg-[var(--bg-surface)] hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      title="Delete resume"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Case 2: No Resumes Yet (Clean Unified Onboarding Hero) ────────── */
        <div className="space-y-8">
          <div
            className="rounded-3xl p-8 md:p-12 border glass-card text-center space-y-6 max-w-4xl mx-auto"
            style={{
              borderColor: 'var(--border-default)',
              background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
            }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Layers className="w-3.5 h-3.5" /> AuraCV Resume Studio
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
              <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Build a resume that gets you hired
              </h1>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Choose a clean layout, write impactful bullet points with AI assistance, and export to PDF or Word in seconds.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create First Resume
              </button>

              <button
                onClick={() => navigate('/import')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border transition-all bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-700 cursor-pointer"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Import Existing CV
              </button>

              <button
                onClick={() => navigate('/templates')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border transition-all bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-700 cursor-pointer"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                <Layers className="w-4 h-4 text-emerald-500" />
                Browse Templates
              </button>
            </div>

            {/* Feature pill highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="p-4 rounded-2xl text-left bg-slate-500/5 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>4 Proven Templates</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Modern, Classic, Minimal, and ATS Pure layouts designed for recruiters.
                </p>
              </div>

              <div className="p-4 rounded-2xl text-left bg-slate-500/5 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Integrated AI Copilot</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Get smart keyword suggestions and polish bullet points with metrics.
                </p>
              </div>

              <div className="p-4 rounded-2xl text-left bg-slate-500/5 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                  <FileText className="w-4 h-4 text-sky-500" />
                  <span>PDF and Word Export</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Download print-ready PDF files or fully editable Word documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Resume Modal ──────────────────────────────────────────── */}
      {showCreate && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/25 dark:bg-black/70 backdrop-blur-xs"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6 md:p-8 border shadow-2xl space-y-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              boxShadow: 'var(--shadow-float)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  Create New Resume
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Give your resume a name and choose a starting style.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Resume Title
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Template selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Starting Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'modern', name: 'Modern', tag: 'Popular', desc: 'Clean two-column layout' },
                    { id: 'executive', name: 'Executive', tag: 'Leadership', desc: 'Authoritative dark banner' },
                    { id: 'compact', name: 'Compact', tag: 'Dense Tech', desc: 'High-density tech layout' },
                    { id: 'classic', name: 'Classic', tag: 'Classic', desc: 'Formal serif typography' },
                    { id: 'minimal', name: 'Minimal', tag: 'Clean', desc: 'Simple balanced layout' },
                    { id: 'ats', name: 'ATS Pure', tag: 'Simple', desc: 'ATS parser friendly' },
                  ].map(t => {
                    const isSelected = selectedTemplate === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-500/10 shadow-xs'
                            : 'hover:bg-slate-100 dark:hover:bg-neutral-800'
                        }`}
                        style={{
                          borderColor: isSelected ? undefined : 'var(--border-subtle)',
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {t.name}
                            </span>
                            {isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 inline-block" />
                            )}
                          </div>
                          <span className="text-[11px] block mt-1" style={{ color: 'var(--text-muted)' }}>
                            {t.desc}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              borderColor: 'var(--border-default)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {t.tag}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPreviewTemplateId(t.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer shadow-sm disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create and Open'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Realistic Full Preview Modal with Dummy Data ───────────────────── */}
      {previewTemplateId && (
        <TemplatePreviewModal
          isOpen={Boolean(previewTemplateId)}
          initialTemplateId={previewTemplateId}
          onClose={() => setPreviewTemplateId(null)}
          onSelect={id => {
            setSelectedTemplate(id);
            setPreviewTemplateId(null);
          }}
          actionButtonLabel="Use for New Resume"
        />
      )}

      {/* ── In-App Confirm Modal for Deletion ─────────────────────────────── */}
      <ConfirmModal
        isOpen={!!resumeToDelete}
        title="Delete Resume"
        message={`Are you sure you want to delete "${resumeToDelete?.name}"? All associated sections and configurations will be permanently removed.`}
        confirmLabel="Delete Resume"
        variant="danger"
        onConfirm={() => {
          if (resumeToDelete) {
            deleteResume(resumeToDelete.id);
            setResumeToDelete(null);
          }
        }}
        onCancel={() => setResumeToDelete(null)}
      />
    </div>
  );
}
