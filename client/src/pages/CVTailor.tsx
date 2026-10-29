import { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { aiApi, resumeApi, type CVTailorResult } from "../api";
import { useParams, Link } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  MessageSquare,
  Brain,
  ShieldCheck,
  FileText,
  Code2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  RefreshCw,
  Wand2,
} from "lucide-react";

export default function CVTailor() {
  const { id } = useParams<{ id?: string }>();
  const { resumes, fetchResume } = useAppStore();
  const activeResumes = resumes.filter((r) => r.is_active !== 0);
  const [selectedResumeId, setSelectedResumeId] = useState(
    id ?? activeResumes[0]?.id ?? "",
  );

  useEffect(() => {
    if ((!selectedResumeId || !activeResumes.some((r) => r.id === selectedResumeId)) && activeResumes.length > 0) {
      const nextId = id && activeResumes.some((r) => r.id === id) ? id : activeResumes[0].id;
      setSelectedResumeId(nextId);
      fetchResume(nextId);
    }
  }, [activeResumes, id, selectedResumeId, fetchResume]);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [createdResumeId, setCreatedResumeId] = useState<string | null>(null);

  const [tailorRole, setTailorRole] = useState("");
  const [tailorInstructions, setTailorInstructions] = useState("");
  const [tailorQuestions, setTailorQuestions] = useState<
    Array<{ id: string; question: string }>
  >([]);
  const [tailorAnswers, setTailorAnswers] = useState<Record<string, string>>({});
  const [tailorResult, setTailorResult] = useState<CVTailorResult | null>(null);
  const [tailorStep, setTailorStep] = useState<1 | 2 | 3>(1);

  // Cycle loading messages to showcase the live thinking & evaluation stages
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStage((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const tailoringStages = [
    { label: "Role Analysis", desc: "Reviewing job requirements & target expectations..." },
    { label: "Drafting", desc: "Tailoring bullets with quantitative accomplishments..." },
    { label: "Review", desc: "Checking keywords, formatting, and completeness..." },
    { label: "Finalizing", desc: "Assembling full profile sections..." },
  ];

  const runTask = async () => {
    if (!selectedResumeId) return;
    setLoading(true);
    setLoadingStage(0);
    setError("");
    setSuccessMsg("");
    setCreatedResumeId(null);
    try {
      if (tailorStep === 1) {
        const r = await aiApi.cvTailorQuestions({
          resume_id: selectedResumeId,
          role: tailorRole,
          instructions: tailorInstructions,
        });
        if (r.questions && r.questions.length > 0) {
          setTailorQuestions(r.questions);
          setTailorStep(2);
        } else {
          const rr = await aiApi.cvTailorRewrite({
            resume_id: selectedResumeId,
            role: tailorRole,
            instructions: tailorInstructions,
            qna: [],
          });
          setTailorResult(rr);
          setTailorStep(3);
        }
      } else if (tailorStep === 2) {
        const qna = tailorQuestions.map((q) => ({
          question: q.question,
          answer: tailorAnswers[q.id] || "No answer provided.",
        }));
        const r = await aiApi.cvTailorRewrite({
          resume_id: selectedResumeId,
          role: tailorRole,
          instructions: tailorInstructions,
          qna,
        });
        setTailorResult(r);
        setTailorStep(3);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipQuestions = async () => {
    if (!selectedResumeId) return;
    setLoading(true);
    setLoadingStage(0);
    setError("");
    setSuccessMsg("");
    setCreatedResumeId(null);
    try {
      const r = await aiApi.cvTailorRewrite({
        resume_id: selectedResumeId,
        role: tailorRole,
        instructions: tailorInstructions,
        qna: [],
      });
      setTailorResult(r);
      setTailorStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToResume = async () => {
    const targetResume = resumes.find((r) => r.id === selectedResumeId);
    if (!targetResume || !tailorResult) return;
    setApplying(true);
    setError("");
    setSuccessMsg("");
    try {
      const newName = tailorRole
        ? `[Tailored] ${targetResume.name} - ${tailorRole}`
        : `[Tailored] ${targetResume.name}`;

      const { id: newResumeId } = await resumeApi.duplicate(
        targetResume.id,
        newName,
      );
      const duplicatedResume = await resumeApi.get(newResumeId);
      const existingSections = duplicatedResume.sections;

      // Update or create all sections from the tailored CV
      for (let i = 0; i < tailorResult.sections.length; i++) {
        const tailoredSec = tailorResult.sections[i];
        const existing = existingSections.find(
          (s) => s.section_type === tailoredSec.section_type,
        );

        if (existing) {
          await resumeApi.updateSection(newResumeId, existing.id, {
            title: tailoredSec.title || existing.title,
            content: tailoredSec.content as unknown[],
          });
        } else {
          await resumeApi.addSection(newResumeId, {
            section_type: tailoredSec.section_type,
            title: tailoredSec.title,
            content: tailoredSec.content as unknown[],
            position: i,
          });
        }
      }

      useAppStore.getState().fetchResumes();
      await fetchResume(newResumeId);
      setSelectedResumeId(newResumeId);
      setCreatedResumeId(newResumeId);
      setSuccessMsg(
        "Successfully created a complete tailored profile in your workspace with all sections updated!",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto animate-fade-in-up space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Profile Tailoring
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            AI Profile Tailor
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Tailor your profile for a target role, highlighting relevant metrics and generating a complete CV / Resume.
          </p>
        </div>

        {tailorResult && (
          <button
            onClick={() => {
              setTailorStep(1);
              setTailorResult(null);
              setTailorQuestions([]);
              setTailorAnswers({});
              setCreatedResumeId(null);
              setError("");
              setSuccessMsg("");
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors self-start sm:self-auto cursor-pointer"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Start New Tailoring
          </button>
        )}
      </div>

      {/* ── Resume Selector Bar ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 border glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="space-y-0.5">
          <label
            className="text-xs font-semibold uppercase tracking-wider block"
            style={{ color: "var(--text-muted)" }}
          >
            Source Profile
          </label>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Choose which base profile version to tailor
          </p>
        </div>
        <select
          value={selectedResumeId}
          onChange={(e) => {
            setSelectedResumeId(e.target.value);
            fetchResume(e.target.value);
          }}
          className="w-full sm:w-80 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">Select a Profile</option>
          {activeResumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.version_tag})
            </option>
          ))}
        </select>
      </div>

      {/* ── Task Form ────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border glass-card p-6 md:p-8 space-y-6"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="space-y-4">
          {tailorStep === 1 && (
            <>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Target Role &amp; Company
                </label>
                <input
                  value={tailorRole}
                  onChange={(e) => setTailorRole(e.target.value)}
                  placeholder="e.g. Senior Distributed Systems Engineer at Netflix"
                  className="w-full rounded-2xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 border"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Target Job Description or Strategic Focus (Optional)
                </label>
                <textarea
                  value={tailorInstructions}
                  onChange={(e) => setTailorInstructions(e.target.value)}
                  rows={4}
                  placeholder="Paste key requirements from the job description (e.g. distributed transactions, P99 latency SLA, Kubernetes, cross-functional mentorship)..."
                  className="w-full min-h-[90px] rounded-2xl rounded-br-md px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 border resize-y"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </>
          )}

          {tailorStep === 2 && (
            <div className="space-y-4">
              <div
                className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <p className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Strategic Context &amp; Metrics Gathering
                  </p>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    Estimates (e.g. ~30%, $150K, 10M reqs) work great!
                  </span>
                </div>
                <p style={{ color: "var(--text-secondary)" }}>
                  Answer these targeted questions to help the AI craft authentic, quantitative achievements for your target role, or skip to generate immediately.
                </p>
              </div>
              {tailorQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <label
                    className="text-sm font-semibold block"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {q.question}
                  </label>
                  <textarea
                    value={tailorAnswers[q.id] || ""}
                    onChange={(e) =>
                      setTailorAnswers({
                        ...tailorAnswers,
                        [q.id]: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="e.g. Reduced API latency by ~35% with Redis caching; supported 40K concurrent users..."
                    className="w-full min-h-[70px] rounded-xl rounded-br-md px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 border resize-y"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tailorStep === 3 && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Tailoring Complete!
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Complete CV / Resume generated with all sections preserved.
              </span>
            </div>
          )}
        </div>

        {/* Multi-Stage Loading Feedback */}
        {loading && (
          <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse text-purple-500" />
                Tailoring Progress
              </span>
              <span>Step {loadingStage + 1} of 4</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tailoringStages.map((stage, idx) => {
                const isActive = idx === loadingStage;
                const isPassed = idx < loadingStage;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isActive
                        ? "border-purple-500/50 bg-purple-500/10 shadow-sm"
                        : isPassed
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 dark:border-neutral-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-0.5">
                      {isPassed ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-current text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                      )}
                      <span>{stage.label}</span>
                    </div>
                    <p className="text-[11px] leading-tight opacity-80 truncate">
                      {stage.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={runTask}
            disabled={loading || !selectedResumeId || tailorStep === 3}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {loading
              ? "Tailoring profile…"
              : tailorStep === 2
              ? "Submit Answers & Tailor"
              : "Tailor My Profile"}
          </button>

          {tailorStep === 2 && (
            <button
              onClick={handleSkipQuestions}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold border hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
              title="Skip answering questions and generate tailored profile directly"
            >
              Skip Questions &amp; Generate Now
            </button>
          )}

          {!selectedResumeId && (
            <span className="text-xs text-amber-500 font-medium">
              Please select a profile first
            </span>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            {createdResumeId && (
              <Link
                to={`/editor/${createdResumeId}`}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                Open in Resume Builder <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Results Canvas ───────────────────────────────────────────────── */}
      {tailorResult && (
        <TailorPanel
          result={tailorResult}
          onApply={handleApplyToResume}
          isApplying={applying}
          createdResumeId={createdResumeId}
        />
      )}
    </div>
  );
}

function TailorPanel({
  result,
  onApply,
  isApplying,
  createdResumeId,
}: {
  result: CVTailorResult;
  onApply: () => void;
  isApplying: boolean;
  createdResumeId: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "json" | "thinking" | "evaluation">("preview");
  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.raw_cv_json || result, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tailored-cv-resume-${(result.target_role || "profile").toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalExperienceBullets = result.experience?.reduce((acc, e) => acc + (e.bullets?.length || 0), 0) || 0;

  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-6">
      {/* ── Action Bar Header ────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between border-b pb-5 flex-wrap gap-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3
              className="font-display text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Tailored CV / Resume Document
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              {result.target_role}
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Complete profile tailored for target role with {result.sections?.length || 4} sections.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => handleCopy(JSON.stringify(result.raw_cv_json || result, null, 2))}
            className="text-xs font-semibold px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            title="Copy full CV / Resume JSON to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy Full JSON
          </button>

          <button
            onClick={handleDownloadJson}
            className="text-xs font-semibold px-3 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            title="Download CV / Resume JSON file"
          >
            <Download className="w-3.5 h-3.5" /> Download JSON
          </button>

          {createdResumeId ? (
            <Link
              to={`/editor/${createdResumeId}`}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              Open in CV / Resume Builder <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isApplying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Create Tailored Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Quality Evaluation & Auto-Correction Scorecard ─────────────────── */}
      <div
        className="p-5 rounded-2xl border space-y-4"
        style={{
          backgroundColor: "var(--bg-surface-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Quality &amp; Validation Review
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Integrity Score: {result.evaluation?.completeness_score ?? 100}%
            </span>
            {result.evaluation?.json_repaired && (
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                JSON Auto-Repaired
              </span>
            )}
          </div>
        </div>

        {/* Verification Check Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {result.evaluation?.checks?.map((chk, i) => (
            <div
              key={i}
              className="p-3 rounded-xl border text-xs space-y-1"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {chk.name}
                </span>
                {chk.status === "pass" ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    PASS
                  </span>
                ) : chk.status === "repaired" ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    REPAIRED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    NOTE
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {chk.details}
              </p>
            </div>
          ))}
        </div>

        {/* Auto-Corrections Ledger (Guarantees zero data loss from cheaper models) */}
        {result.evaluation?.corrections && result.evaluation.corrections.length > 0 && (
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs space-y-1">
            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              Adjustments applied to preserve profile data:
            </span>
            <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-0.5 pl-1 text-[11px]">
              {result.evaluation.corrections.map((corr, idx) => (
                <li key={idx}>{corr}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Deep Thinking & Strategic Reasoning Panel ─────────────────────── */}
      {result.thinking_process && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-surface-elevated)",
          }}
        >
          <div
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Strategic Analysis &amp; Keyword Alignment
              </h4>
            </div>
            <button className="text-slate-400 hover:text-purple-500 p-1">
              {thinkingExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {thinkingExpanded && (
            <div className="space-y-4 pt-1 animate-fade-in-up">
              {/* Strategic Angle */}
              {result.thinking_process.strategic_angle && (
                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs space-y-1">
                  <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[10px]">
                    Strategic Positioning Angle:
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {result.thinking_process.strategic_angle}
                  </p>
                </div>
              )}

              {/* Gap Analysis */}
              {result.thinking_process.gap_analysis && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Gap Analysis &amp; Tailoring Thesis:
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {result.thinking_process.gap_analysis}
                  </p>
                </div>
              )}

              {/* Keyword Alignment Chips */}
              {result.thinking_process.keyword_alignment?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    ATS Keyword Matrix:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.thinking_process.keyword_alignment.map((kw, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Google X-Y-Z Transformations */}
              {result.thinking_process.xyz_transformations?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Google X-Y-Z Accomplishment Transformations:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.thinking_process.xyz_transformations.map((tr, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border text-xs space-y-2 overflow-hidden"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor: "var(--bg-surface)",
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                          {tr.target && (
                            <span
                              className="font-bold text-purple-500 text-[10px] uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 max-w-[200px] truncate"
                              title={tr.target}
                            >
                              {tr.target}
                            </span>
                          )}
                          {tr.impact_metric && (
                            <span className="font-mono text-emerald-500 dark:text-emerald-400 font-semibold text-[11px] break-words flex-1 text-right">
                              {tr.impact_metric}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed break-words" style={{ color: "var(--text-secondary)" }}>
                          {tr.bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b pb-1" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "preview"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Full CV / Resume Preview
        </button>

        <button
          onClick={() => setActiveTab("json")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "json"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Raw Full CV / Resume JSON
        </button>

        <button
          onClick={() => setActiveTab("thinking")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "thinking"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Brain className="w-3.5 h-3.5" /> Strategy &amp; Notes
        </button>

        <button
          onClick={() => setActiveTab("evaluation")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === "evaluation"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Quality Review
        </button>
      </div>

      {/* ── Tab 1: Full CV Preview ────────────────────────────────────────── */}
      {activeTab === "preview" && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Executive Summary */}
          {result.summary && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center justify-between">
                <span>Professional Executive Summary</span>
                <button
                  onClick={() => handleCopy(result.summary)}
                  className="text-slate-400 hover:text-purple-500 cursor-pointer flex items-center gap-1"
                  title="Copy Summary"
                >
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy</span>
                </button>
              </h4>
              <div
                className="p-4 rounded-2xl border text-sm font-medium leading-relaxed"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {result.summary}
              </div>
            </div>
          )}

          {/* Work Experience */}
          {result.experience?.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" /> Work Experience ({result.experience.length} roles, {totalExperienceBullets} bullets)
                </h4>
                <button
                  onClick={() => handleCopy(result.experience.map(e => `${e.role} at ${e.company}\n` + e.bullets.join("\n")).join("\n\n"))}
                  className="text-slate-400 hover:text-purple-500 cursor-pointer flex items-center gap-1 text-[10px]"
                >
                  <Copy className="w-3 h-3" /> Copy All Experience
                </button>
              </div>

              <div className="space-y-4">
                {result.experience.map((exp, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl border space-y-3"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div
                      className="flex items-start justify-between border-b pb-3 flex-wrap gap-2"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <div>
                        <div
                          className="font-bold text-base"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {exp.role}
                        </div>
                        <div
                          className="text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {exp.company}
                          {exp.location && ` • ${exp.location}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(exp.start_date || exp.end_date) && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400">
                            {exp.start_date || "Start"} — {exp.end_date || "Present"}
                          </span>
                        )}
                        <button
                          onClick={() => handleCopy(exp.bullets.join("\n"))}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-purple-500 transition-colors cursor-pointer"
                          title="Copy Role Bullets"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <ul className="space-y-2 list-disc list-outside ml-4">
                      {exp.bullets.map((b, j) => (
                        <li
                          key={j}
                          className="text-sm pl-1 leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills Optimization */}
          {result.skills && result.skills.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Skills Optimization
              </h4>
              <div
                className="p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                {result.skills.map((skillGroup, i) => (
                  <div key={i} className="space-y-2">
                    <div
                      className="font-bold text-xs uppercase tracking-wider"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {skillGroup.category}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skillGroup.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-3 py-1 rounded-lg border font-medium transition-colors"
                          style={{
                            backgroundColor: "var(--bg-surface)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {result.projects && result.projects.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-2">
                <FolderGit2 className="w-3.5 h-3.5" /> Strategic Projects
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.projects.map((proj, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl border space-y-2.5"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {proj.name}
                      </span>
                    </div>
                    {proj.description && (
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {proj.description}
                      </p>
                    )}
                    {proj.tech?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.tech.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {proj.bullets && proj.bullets.length > 0 && (
                      <ul className="list-disc list-inside text-xs space-y-1 text-slate-400 pt-1">
                        {proj.bullets.map((b, idx) => (
                          <li key={idx} className="leading-relaxed">{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education & Certifications Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.education && result.education.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </h4>
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {result.education.map((edu, i) => (
                    <div key={i} className="text-xs space-y-0.5 border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: "var(--border-subtle)" }}>
                      <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {edu.degree} {edu.field ? `in ${edu.field}` : ""}
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {edu.institution} {edu.end_date ? `(${edu.end_date})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.certifications && result.certifications.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" /> Certifications
                </h4>
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {result.certifications.map((cert, i) => (
                    <div key={i} className="text-xs space-y-0.5 border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: "var(--border-subtle)" }}>
                      <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {cert.name}
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {cert.issuer} {cert.date ? `(${cert.date})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Raw Full CV / Resume JSON ───────────────────────────────────────── */}
      {activeTab === "json" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Canonical Full CV / Resume JSON Structure (Ready for export, SQLite import, or downstream ATS)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(JSON.stringify(result.raw_cv_json || result, null, 2))}
                className="hover:text-purple-500 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy JSON
              </button>
              <button
                onClick={handleDownloadJson}
                className="hover:text-purple-500 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>

          <pre
            className="p-5 rounded-2xl border text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed select-text"
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {JSON.stringify(result.raw_cv_json || result, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Tab 3: Deep Thinking Trace ────────────────────────────────────── */}
      {activeTab === "thinking" && (
        <div className="space-y-6 animate-fade-in-up">
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <h4 className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Strategic Rationale &amp; Notes
            </h4>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Executive Value Proposition &amp; Strategic Angle:
              </label>
              <div
                className="p-4 rounded-xl border text-xs leading-relaxed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {result.thinking_process?.strategic_angle}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Strategic Gap &amp; Seniority Analysis:
              </label>
              <div
                className="p-4 rounded-xl border text-xs leading-relaxed"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {result.thinking_process?.gap_analysis}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. High-Priority ATS Keyword Alignment:
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {result.thinking_process?.keyword_alignment?.map((k, i) => (
                  <span
                    key={i}
                    className="text-xs px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                4. Google X-Y-Z Metric Accomplishment Mapping:
              </label>
              <div className="space-y-2.5">
                {result.thinking_process?.xyz_transformations?.map((x, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border text-xs space-y-1"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold">
                      {x.target && (
                        <span
                          className="text-purple-500 text-[10px] uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 max-w-[200px] truncate"
                          title={x.target}
                        >
                          {x.target}
                        </span>
                      )}
                      {x.impact_metric && (
                        <span className="text-emerald-500 font-mono break-words flex-1 text-right">
                          {x.impact_metric}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed break-words">{x.bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Evaluation Report ───────────────────────────────────────── */}
      {activeTab === "evaluation" && (
        <div className="space-y-6 animate-fade-in-up">
          <div
            className="p-5 rounded-2xl border space-y-5"
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Comprehensive Validation &amp; Quality Audit
                </h4>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Evaluated with live schema bounds, zero data-loss guarantees, and Google X-Y-Z rules.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-emerald-500">
                  {result.evaluation?.completeness_score ?? 100}%
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Health Score</div>
              </div>
            </div>

            <div className="space-y-3">
              {result.evaluation?.checks?.map((chk, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border flex items-start justify-between gap-4"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>
                        {chk.name}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {chk.details}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                      chk.status === "pass"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : chk.status === "repaired"
                        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {chk.status}
                  </span>
                </div>
              ))}
            </div>

            {result.improvement_notes && (
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs space-y-1">
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  Executive Strategist Notes:
                </span>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {result.improvement_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
