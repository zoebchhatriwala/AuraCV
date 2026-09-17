import { useState } from 'react';
import { useAppStore } from '../store';
import { aiApi, type ATSScoreResult, type KeywordGapResult, type RedlineResult, type RewriteResult } from '../api';
import { useParams } from 'react-router-dom';
import {
  Sparkles, Target, Search, Pencil,
  CheckCircle2, AlertCircle, Loader2, Copy, Check,
  Zap, ArrowRight,
} from 'lucide-react';

type AITask = 'ats' | 'keywords' | 'redline' | 'rewrite';

export default function AIStudio() {
  const { id } = useParams<{ id?: string }>();
  const { resumes, currentResume, fetchResume } = useAppStore();
  const [selectedResumeId, setSelectedResumeId] = useState(id ?? (resumes[0]?.id ?? ''));
  const [activeTask, setActiveTask] = useState<AITask>('ats');
  const [jobDesc, setJobDesc] = useState('');
  const [bullet, setBullet] = useState('');
  const [tone, setTone] = useState('executive');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null);
  const [gapResult, setGapResult] = useState<KeywordGapResult | null>(null);
  const [redlineResult, setRedlineResult] = useState<RedlineResult | null>(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);

  const runTask = async () => {
    if (!selectedResumeId) return;
    setLoading(true);
    setError('');
    try {
      if (activeTask === 'ats') {
        const r = await aiApi.atsScore({ resume_id: selectedResumeId, job_description: jobDesc });
        setAtsResult(r);
      } else if (activeTask === 'keywords') {
        const r = await aiApi.keywordGap({ resume_id: selectedResumeId, job_description: jobDesc });
        setGapResult(r);
      } else if (activeTask === 'redline') {
        const r = await aiApi.redline({ resume_id: selectedResumeId, section_id: selectedSectionId });
        setRedlineResult(r);
      } else if (activeTask === 'rewrite') {
        const r = await aiApi.rewrite({ bullet, tone, resume_id: selectedResumeId });
        setRewriteResult(r);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const TASKS = [
    { id: 'ats' as AITask,      icon: Target,   label: 'ATS Match Score', color: 'text-emerald-500', desc: 'Check your match against a job description' },
    { id: 'keywords' as AITask, icon: Search,   label: 'Keyword Gap',     color: 'text-sky-500',     desc: 'Find missing industry and technical keywords' },
    { id: 'redline' as AITask,  icon: Sparkles, label: 'Section Review',  color: 'text-blue-600',    desc: 'Get clear suggestions to improve impact' },
    { id: 'rewrite' as AITask,  icon: Pencil,   label: 'Bullet Polisher', color: 'text-amber-500',   desc: 'Improve bullet points with clear results' },
  ];

  const sections = currentResume?.id === selectedResumeId ? currentResume.sections : [];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto animate-fade-in-up space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
          <Zap className="w-3.5 h-3.5" /> AI Assistant
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          AI Resume Assistant
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Check how your resume matches job postings, discover missing keywords, and improve bullet points.
        </p>
      </div>

      {/* ── Resume Selector Bar ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 border glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="space-y-0.5">
          <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
            Target Resume Profile
          </label>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Choose which resume version to analyze
          </p>
        </div>
        <select
          value={selectedResumeId}
          onChange={e => {
            setSelectedResumeId(e.target.value);
            fetchResume(e.target.value);
          }}
          className="w-full sm:w-80 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Select a resume</option>
          {resumes.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.version_tag})
            </option>
          ))}
        </select>
      </div>

      {/* ── Task Tabs ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TASKS.map(task => {
          const isActive = activeTask === task.id;
          const Icon = task.icon;
          return (
            <button
              key={task.id}
              onClick={() => setActiveTask(task.id)}
              className={`p-4 rounded-2xl border text-left transition-all glass-card relative cursor-pointer ${
                isActive ? 'bg-[var(--bg-surface-elevated)]' : 'bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-neutral-700'
              }`}
              style={{
                borderColor: isActive ? '#3b82f6' : 'var(--border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl bg-blue-500/10 ${task.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                )}
              </div>
              <h4 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {task.label}
              </h4>
              <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {task.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Task Form ────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border glass-card p-6 md:p-8 space-y-6"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {activeTask === 'ats' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Job Description
              </label>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {jobDesc.length} characters
              </span>
            </div>
            <textarea
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
              rows={6}
              placeholder="Paste the target job description here (requirements, qualifications, responsibilities)…"
              className="w-full rounded-2xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-y"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}

        {activeTask === 'keywords' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Job Description for Keyword Analysis
              </label>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {jobDesc.length} characters
              </span>
            </div>
            <textarea
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
              rows={6}
              placeholder="Paste the target job description here (requirements, qualifications, responsibilities)…"
              className="w-full rounded-2xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-y"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}

        {activeTask === 'redline' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
              Select Section to Analyze
            </label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Choose a section</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.section_type})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTask === 'rewrite' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
                Bullet Point to Polish
              </label>
              <textarea
                value={bullet}
                onChange={e => setBullet(e.target.value)}
                rows={3}
                placeholder="e.g. Worked on database performance and helped team ship feature on time."
                className="w-full rounded-2xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 border resize-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>
                Target Tone and Style
              </label>
              <div className="flex flex-wrap gap-2">
                {['executive', 'technical', 'concise', 'impact-driven', 'leadership'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border cursor-pointer ${
                      tone === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
                    }`}
                    style={{
                      borderColor: tone === t ? undefined : 'var(--border-default)',
                      color: tone === t ? undefined : 'var(--text-primary)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center gap-4">
          <button
            onClick={runTask}
            disabled={loading || !selectedResumeId}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'AI Engine Processing…' : 'Run AI Analysis'}
          </button>
          {!selectedResumeId && (
            <span className="text-xs text-amber-500 font-medium">Please select a resume first</span>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* ── Results Canvas ───────────────────────────────────────────────── */}
      {atsResult && activeTask === 'ats' && <ATSScorePanel result={atsResult} />}
      {gapResult && activeTask === 'keywords' && <KeywordGapPanel result={gapResult} />}
      {redlineResult && activeTask === 'redline' && <RedlinePanel result={redlineResult} />}
      {rewriteResult && activeTask === 'rewrite' && <RewritePanel result={rewriteResult} originalBullet={bullet} />}
    </div>
  );
}

// ─── Score Ring SVG ──────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" opacity="0.1" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">/ 100</span>
      </div>
    </div>
  );
}

// ─── Result Panels ────────────────────────────────────────────────────────────

function ATSScorePanel({ result }: { result: ATSScoreResult }) {
  const color = result.overall_score >= 75 ? '#10b981' : result.overall_score >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ATS Match Scorecard
        </h3>
        <span className="text-xs font-semibold px-3 py-1 rounded-full border" style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}>
          {result.overall_score >= 75 ? 'Ready to Apply' : result.overall_score >= 50 ? 'Needs Tuning' : 'High Risk'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="flex flex-col items-center justify-center text-center p-4">
          <ScoreRing score={result.overall_score} color={color} />
          <span className="text-xs font-medium mt-2" style={{ color: 'var(--text-secondary)' }}>
            Overall Compatibility
          </span>
        </div>

        <div className="md:col-span-3 grid grid-cols-3 gap-3">
          {[
            { label: 'Keyword Match', score: result.keyword_match_score, color: '#38bdf8' },
            { label: 'Formatting', score: result.format_score, color: '#a855f7' },
            { label: 'Experience Depth', score: result.experience_match_score, color: '#34d399' },
          ].map(s => (
            <div
              key={s.label}
              className="p-4 rounded-2xl border text-center"
              style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="font-display text-2xl font-bold" style={{ color: s.color }}>
                {s.score}%
              </div>
              <div className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl border leading-relaxed text-sm" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {result.summary}
      </div>

      {/* Matched vs Missing Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
          <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Detected Keywords ({result.matched_keywords.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.matched_keywords.map(k => (
              <span key={k} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Missing Keywords ({result.missing_keywords.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.missing_keywords.map(k => (
              <span key={k} className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 font-medium">
                +{k}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Key Recommendations
          </h4>
          <ul className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KeywordGapPanel({ result }: { result: KeywordGapResult }) {
  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-6">
      <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Keyword Gap Breakdown
      </h3>
      <div className="p-4 rounded-2xl border text-sm" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {result.summary}
      </div>

      {result.critical_missing?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider">
            Critical Missing Keywords
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.critical_missing.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'rgba(244, 63, 94, 0.2)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-rose-500">{item.keyword}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500">
                    {item.frequency_in_jd}× in JD
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.suggested_context}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RedlinePanel({ result }: { result: RedlineResult }) {
  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Section Redline Suggestions
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            AI review of bullet strength, metrics, and action verbs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreRing score={result.overall_score} color="#2563eb" />
        </div>
      </div>

      <div className="p-4 rounded-2xl border text-sm" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {result.summary}
      </div>

      <div className="space-y-3">
        {result.suggestions.map((s, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border space-y-2"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: s.priority === 'high' ? 'rgba(244, 63, 94, 0.25)' : 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {s.type}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${s.priority === 'high' ? 'text-rose-500' : 'text-amber-500'}`}>
                {s.priority} Priority
              </span>
            </div>
            {s.original && (
              <p className="text-xs line-through opacity-60" style={{ color: 'var(--text-muted)' }}>
                "{s.original}"
              </p>
            )}
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {s.suggestion}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {s.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RewritePanel({ result, originalBullet }: { result: RewriteResult; originalBullet: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-5">
      <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Polished Bullet Output
      </h3>

      <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
        {originalBullet && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Before:</span>
            <p className="text-xs line-through opacity-60" style={{ color: 'var(--text-muted)' }}>{originalBullet}</p>
          </div>
        )}

        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">After (AI Enhanced):</span>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm md:text-base font-semibold text-emerald-500">
              {result.rewritten}
            </p>
            <button
              onClick={() => handleCopy(result.rewritten)}
              className="p-2 rounded-xl border transition-all hover:bg-emerald-500/10 text-emerald-500"
              style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {result.improvement_notes && (
          <p className="text-xs pt-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            💡 {result.improvement_notes}
          </p>
        )}
      </div>

      {result.alternatives?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Alternative Variations
          </h4>
          <div className="space-y-2">
            {result.alternatives.map((alt, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {alt}
                </p>
                <button
                  onClick={() => handleCopy(alt)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                  title="Copy variation"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
