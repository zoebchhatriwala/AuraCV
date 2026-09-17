import { useState, useEffect } from 'react';
import { aiApi, type Section, type ATSScoreResult, type KeywordGapResult, type RedlineResult, type RewriteResult } from '../api';
import { useAppStore } from '../store';
import {
  X, Target, Search, ArrowRight, Check,
  Copy, RefreshCw, AlertCircle, SlidersHorizontal
} from 'lucide-react';

interface AICopilotPanelProps {
  resumeId: string;
  sections: Section[];
  activeSectionId: string | null;
  onClose: () => void;
  onApplyBullet?: (newBullet: string, originalBullet?: string, targetSectionId?: string, bulletIndex?: number) => void;
  initialBullet?: string;
  initialBulletContext?: { sectionId: string; index: number };
}

type CopilotTab = 'match' | 'polish' | 'review';

export default function AICopilotPanel({
  resumeId,
  sections,
  activeSectionId,
  onClose,
  onApplyBullet,
  initialBullet,
  initialBulletContext,
}: AICopilotPanelProps) {
  const { activeProvider } = useAppStore();
  const [tab, setTab] = useState<CopilotTab>(initialBullet ? 'polish' : 'match');

  // ── Match & ATS State ──
  const [jobDesc, setJobDesc] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<ATSScoreResult | null>(null);
  const [, setGapResult] = useState<KeywordGapResult | null>(null);
  const [matchError, setMatchError] = useState('');

  // ── Bullet Polisher State ──
  const [bulletInput, setBulletInput] = useState(initialBullet || '');
  const [bulletTone, setBulletTone] = useState<'metrics' | 'concise' | 'executive' | 'technical'>('metrics');
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishResult, setPolishResult] = useState<RewriteResult | null>(null);
  const [polishError, setPolishError] = useState('');
  const [copiedBullet, setCopiedBullet] = useState(false);
  const [appliedBullet, setAppliedBullet] = useState(false);
  const [bulletContext, setBulletContext] = useState(initialBulletContext);

  // ── Section Review State ──
  const [selectedReviewSection, setSelectedReviewSection] = useState<string>(activeSectionId || (sections[0]?.id || ''));
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<RedlineResult | null>(null);
  const [reviewError, setReviewError] = useState('');

  // Update when parent requests polishing a specific bullet
  useEffect(() => {
    if (initialBullet) {
      setBulletInput(initialBullet);
      setBulletContext(initialBulletContext);
      setTab('polish');
      setAppliedBullet(false);
    }
  }, [initialBullet, initialBulletContext]);

  // Handle ATS and Keyword Analysis
  const handleRunMatch = async () => {
    if (!jobDesc.trim()) return;
    setMatchLoading(true);
    setMatchError('');
    try {
      const [ats, gap] = await Promise.all([
        aiApi.atsScore({ resume_id: resumeId, job_description: jobDesc }),
        aiApi.keywordGap({ resume_id: resumeId, job_description: jobDesc }).catch(() => null),
      ]);
      setMatchResult(ats);
      if (gap) setGapResult(gap);
    } catch (err) {
      setMatchError((err as Error).message || 'Failed to analyze job match');
    } finally {
      setMatchLoading(false);
    }
  };

  // Handle Bullet Rewrite
  const handlePolishBullet = async () => {
    if (!bulletInput.trim()) return;
    setPolishLoading(true);
    setPolishError('');
    setAppliedBullet(false);
    try {
      const toneMap: Record<string, string> = {
        metrics: 'executive',
        concise: 'concise',
        executive: 'leadership',
        technical: 'technical',
      };
      const res = await aiApi.rewrite({
        bullet: bulletInput,
        tone: toneMap[bulletTone] || 'executive',
        resume_id: resumeId,
        section_id: bulletContext?.sectionId || activeSectionId || undefined,
      });
      setPolishResult(res);
    } catch (err) {
      setPolishError((err as Error).message || 'Failed to enhance bullet point');
    } finally {
      setPolishLoading(false);
    }
  };

  // Handle Section Critique
  const handleRunReview = async () => {
    if (!selectedReviewSection) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const res = await aiApi.redline({
        resume_id: resumeId,
        section_id: selectedReviewSection,
      });
      setReviewResult(res);
    } catch (err) {
      setReviewError((err as Error).message || 'Failed to review section');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleApply = (replacementText: string) => {
    if (onApplyBullet) {
      onApplyBullet(
        replacementText,
        bulletInput,
        bulletContext?.sectionId,
        bulletContext?.index
      );
      setAppliedBullet(true);
      setTimeout(() => setAppliedBullet(false), 2500);
    }
  };

  return (
    <aside
      className="w-full sm:w-96 flex flex-col h-full border-l shrink-0 transition-all z-10"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
            A
          </div>
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            Writing Copilot
          </span>
          {activeProvider && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border truncate font-medium max-w-[120px]"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              title={`${activeProvider.name} · ${activeProvider.model}`}
            >
              {activeProvider.models?.find(m => m.id === activeProvider.model)?.name || activeProvider.model.split('/').pop() || activeProvider.model}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          title="Close Copilot (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className="px-3 pt-2.5 pb-2 border-b flex items-center gap-1.5 shrink-0"
        style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-default)' }}
      >
        <button
          onClick={() => setTab('match')}
          className={`flex-1 py-1.5 px-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-semibold ${
            tab === 'match'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-neutral-700'
          }`}
          style={{ color: tab === 'match' ? '#fff' : 'var(--text-primary)' }}
        >
          <Target className="w-3.5 h-3.5 shrink-0" />
          <span>Job Match</span>
        </button>

        <button
          onClick={() => setTab('polish')}
          className={`flex-1 py-1.5 px-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-semibold ${
            tab === 'polish'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-neutral-700'
          }`}
          style={{ color: tab === 'polish' ? '#fff' : 'var(--text-primary)' }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>Polisher</span>
        </button>

        <button
          onClick={() => setTab('review')}
          className={`flex-1 py-1.5 px-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-semibold ${
            tab === 'review'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-200 dark:hover:bg-neutral-700'
          }`}
          style={{ color: tab === 'review' ? '#fff' : 'var(--text-primary)' }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span>Review</span>
        </button>
      </div>

      {/* ── Content Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: JOB MATCH & ATS */}
        {tab === 'match' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target Job Description
              </label>
              <textarea
                rows={4}
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                placeholder="Paste job description requirements and responsibilities here..."
                className="w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans transition-all resize-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <button
              onClick={handleRunMatch}
              disabled={matchLoading || !jobDesc.trim()}
              className="w-full btn-primary py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {matchLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Alignment…
                </>
              ) : (
                <>
                  <Target className="w-3.5 h-3.5" />
                  Calculate Match Score
                </>
              )}
            </button>

            {matchError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words min-w-0 flex-1">{matchError}</span>
              </div>
            )}

            {matchResult && (
              <div className="space-y-4 pt-2 animate-fade-in-up">
                {/* Score Gauge */}
                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div>
                    <span className="text-[11px] font-medium block" style={{ color: 'var(--text-muted)' }}>
                      Overall Resume Match
                    </span>
                    <span className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                      {matchResult.overall_score}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block font-medium" style={{ color: 'var(--text-muted)' }}>
                      Keyword Match: <strong className="text-emerald-500">{matchResult.keyword_match_score}%</strong>
                    </span>
                    <span className="text-[10px] block font-medium" style={{ color: 'var(--text-muted)' }}>
                      Experience: <strong className="text-blue-500">{matchResult.experience_match_score}%</strong>
                    </span>
                  </div>
                </div>

                {/* Missing Keywords (Amber Chips) */}
                {matchResult.missing_keywords && matchResult.missing_keywords.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-amber-500">
                        Missing Keywords ({matchResult.missing_keywords.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matchResult.missing_keywords.slice(0, 15).map((kw, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium"
                        >
                          +{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Keywords (Emerald Chips) */}
                {matchResult.matched_keywords && matchResult.matched_keywords.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-emerald-500 block mb-1.5">
                      Matched Keywords ({matchResult.matched_keywords.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchResult.matched_keywords.slice(0, 15).map((kw, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium"
                        >
                          ✓ {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Recommendations */}
                {matchResult.recommendations && matchResult.recommendations.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>
                      Recommended Additions
                    </span>
                    {matchResult.recommendations.slice(0, 3).map((rec, i) => (
                      <div
                        key={i}
                        className="text-xs p-2.5 rounded-lg border leading-relaxed"
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {rec}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BULLET POLISHER */}
        {tab === 'polish' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Selected Bullet Point
                </label>
                {bulletContext && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                    Linked to Resume
                  </span>
                )}
              </div>
              <textarea
                rows={3}
                value={bulletInput}
                onChange={e => setBulletInput(e.target.value)}
                placeholder="Paste or select a bullet point to polish..."
                className="w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans transition-all resize-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Tone Selector */}
            <div>
              <span className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target Polish Style
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'metrics',   label: 'Metrics & Impact' },
                  { id: 'concise',   label: 'Crisp & Concise' },
                  { id: 'executive', label: 'Leadership' },
                  { id: 'technical', label: 'Technical Depth' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setBulletTone(t.id as typeof bulletTone)}
                    className={`text-xs py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer font-semibold ${
                      bulletTone === t.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
                    }`}
                    style={{
                      borderColor: bulletTone === t.id ? '#2563eb' : 'var(--border-default)',
                      color: bulletTone === t.id ? '#ffffff' : 'var(--text-primary)',
                      backgroundColor: bulletTone === t.id ? '#2563eb' : 'var(--bg-surface)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handlePolishBullet}
              disabled={polishLoading || !bulletInput.trim()}
              className="w-full btn-primary py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {polishLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Polishing Bullet…
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Enhance Bullet
                </>
              )}
            </button>

            {polishError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words min-w-0 flex-1">{polishError}</span>
              </div>
            )}

            {polishResult && (
              <div className="space-y-3 pt-2 animate-fade-in-up">
                {/* Result Card */}
                <div
                  className="p-3 rounded-xl border space-y-2.5"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-default)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      Polished Result
                    </span>
                    {polishResult.action_verb_used && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                        Verb: {polishResult.action_verb_used}
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                    {polishResult.rewritten}
                  </p>

                  <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      onClick={() => handleApply(polishResult.rewritten)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {appliedBullet ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Applied!
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          Apply to Resume
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(polishResult.rewritten);
                        setCopiedBullet(true);
                        setTimeout(() => setCopiedBullet(false), 2000);
                      }}
                      className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                      title="Copy to clipboard"
                    >
                      {copiedBullet ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Alternatives if available */}
                {polishResult.alternatives && polishResult.alternatives.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold block" style={{ color: 'var(--text-muted)' }}>
                      Alternative Angles
                    </span>
                    {polishResult.alternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border text-xs leading-relaxed group space-y-1.5"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <p style={{ color: 'var(--text-secondary)' }}>{alt}</p>
                        <button
                          onClick={() => handleApply(alt)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Use this version <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SECTION REVIEW */}
        {tab === 'review' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target Resume Section
              </label>
              <select
                value={selectedReviewSection}
                onChange={e => setSelectedReviewSection(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans transition-all"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.section_type})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunReview}
              disabled={reviewLoading || !selectedReviewSection}
              className="w-full btn-primary py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {reviewLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Reviewing Section…
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Run Section Critique
                </>
              )}
            </button>

            {reviewError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words min-w-0 flex-1">{reviewError}</span>
              </div>
            )}

            {reviewResult && (
              <div className="space-y-3 pt-2 animate-fade-in-up">
                <div
                  className="p-3 rounded-xl border flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Section Quality Score
                  </span>
                  <span className="text-lg font-bold font-display" style={{ color: 'var(--text-primary)' }}>
                    {reviewResult.overall_score}/100
                  </span>
                </div>

                {/* Suggestions */}
                {reviewResult.suggestions && reviewResult.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>
                      Actionable Improvements ({reviewResult.suggestions.length})
                    </span>
                    {reviewResult.suggestions.map((sug, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl border space-y-1.5 text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              sug.priority === 'high'
                                ? 'bg-rose-500/10 text-rose-400'
                                : sug.priority === 'medium'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {sug.priority} priority · {sug.type}
                          </span>
                        </div>

                        {sug.original && (
                          <p className="text-slate-400 line-through text-[11px]">
                            {sug.original}
                          </p>
                        )}

                        <p className="font-medium text-emerald-400">
                          {sug.suggestion}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          {sug.reason}
                        </p>

                        {sug.suggestion && onApplyBullet && (
                          <button
                            onClick={() => handleApply(sug.suggestion)}
                            className="pt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Apply this suggestion <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
