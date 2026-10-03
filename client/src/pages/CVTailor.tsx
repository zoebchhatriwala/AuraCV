import { useState } from "react";
import { useAppStore } from "../store";
import { aiApi, resumeApi } from "../api";
import { useParams } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";

export default function CVTailor() {
  const { id } = useParams<{ id?: string }>();
  const { resumes, fetchResume } = useAppStore();
  const [selectedResumeId, setSelectedResumeId] = useState(
    id ?? resumes[0]?.id ?? "",
  );

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [tailorRole, setTailorRole] = useState("");
  const [tailorInstructions, setTailorInstructions] = useState("");
  const [tailorQuestions, setTailorQuestions] = useState<
    Array<{ id: string; question: string }>
  >([]);
  const [tailorAnswers, setTailorAnswers] = useState<Record<string, string>>(
    {},
  );
  const [tailorResult, setTailorResult] = useState<{
    summary: string;
    experience: Array<{ company: string; role: string; bullets: string[] }>;
    skills?: Array<{ category: string; items: string[] }>;
    improvement_notes: string;
  } | null>(null);
  const [tailorStep, setTailorStep] = useState<1 | 2 | 3>(1);

  const runTask = async () => {
    if (!selectedResumeId) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");
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

      const headerSec = duplicatedResume.sections.find((s) => s.section_type === "header");
      if (headerSec && tailorRole) {
        const headerContent = headerSec.content as Array<any>;
        if (headerContent.length > 0) {
          const newHeaderContent = [{ ...headerContent[0], role: tailorRole }];
          await resumeApi.updateSection(newResumeId, headerSec.id, { content: newHeaderContent });
        }
      }

      const summarySec = duplicatedResume.sections.find(
        (s) => s.section_type === "summary",
      );
      if (summarySec && tailorResult.summary) {
        const newContent = [{ text: tailorResult.summary }];
        await resumeApi.updateSection(newResumeId, summarySec.id, {
          content: newContent,
        });
      }

      const expSec = duplicatedResume.sections.find(
        (s) => s.section_type === "experience",
      );
      if (expSec && tailorResult.experience?.length > 0) {
        const currentExp = expSec.content as Array<any>;
        const newContent = currentExp.map((item, idx) => {
          let matched = null;
          if (tailorResult.experience.length === currentExp.length) {
            matched = tailorResult.experience[idx];
          } else {
            matched = tailorResult.experience.find(
              (e) =>
                e.company
                  .toLowerCase()
                  .includes((item.company || "").toLowerCase()) ||
                (item.company || "")
                  .toLowerCase()
                  .includes(e.company.toLowerCase()),
            );
          }
          if (matched) {
            return {
              ...item,
              bullets: matched.bullets,
            };
          }
          return item;
        });
        await resumeApi.updateSection(newResumeId, expSec.id, {
          content: newContent,
        });
      }

      if (tailorResult.skills && tailorResult.skills.length > 0) {
        const skillSections = duplicatedResume.sections.filter((s) => s.section_type === "skills");
        for (const skillSec of skillSections) {
          const currentSkills = skillSec.content as Array<any>;
          const newContent = currentSkills.map((item) => {
            const matched = tailorResult.skills?.find(
              (s) => s.category?.toLowerCase() === (item.category || "").toLowerCase()
            );
            if (matched) {
              return { ...item, items: matched.items };
            }
            return item;
          });
          await resumeApi.updateSection(newResumeId, skillSec.id, { content: newContent });
        }
      }

      useAppStore.getState().fetchResumes();
      await fetchResume(newResumeId);
      setSelectedResumeId(newResumeId);
      setSuccessMsg(
        "Successfully created a new tailored version of your resume!",
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
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-2">
          <MessageSquare className="w-3.5 h-3.5" /> Agentic Flow
        </div>
        <h1
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          AI CV Tailor
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Tailor your resume for a specific role. The AI will ask you questions
          to uncover metrics and impact, then rewrite it perfectly.
        </p>
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
            Target Resume Profile
          </label>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Choose which resume version to tailor
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
          <option value="">Select a resume</option>
          {resumes.map((r) => (
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
                  Target Role
                </label>
                <input
                  value={tailorRole}
                  onChange={(e) => setTailorRole(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer at Acme Corp"
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
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={tailorInstructions}
                  onChange={(e) => setTailorInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Focus on my leadership experience and React performance optimizations."
                  className="w-full rounded-2xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 border resize-none"
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
                <p className="font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> The AI needs a bit more
                  context to make your CV perfect:
                </p>
                <p style={{ color: "var(--text-secondary)" }}>
                  Please answer the questions below to provide quantifiable
                  metrics and specific details.
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
                    placeholder="Your answer..."
                    className="w-full rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 border resize-y"
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
              <button
                onClick={() => {
                  setTailorStep(1);
                  setTailorResult(null);
                  setTailorQuestions([]);
                  setTailorAnswers({});
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              >
                Start Over
              </button>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center gap-4">
          <button
            onClick={runTask}
            disabled={loading || !selectedResumeId || tailorStep === 3}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading
              ? "AI Engine Processing…"
              : tailorStep === 2
                ? "Submit Answers & Tailor"
                : "Tailor My CV"}
          </button>
          {!selectedResumeId && (
            <span className="text-xs text-amber-500 font-medium">
              Please select a resume first
            </span>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
          </div>
        )}
      </div>

      {/* ── Results Canvas ───────────────────────────────────────────────── */}
      {tailorResult && (
        <TailorPanel
          result={tailorResult}
          onApply={handleApplyToResume}
          isApplying={applying}
        />
      )}
    </div>
  );
}

function TailorPanel({
  result,
  onApply,
  isApplying,
}: {
  result: {
    summary: string;
    experience: Array<{ company: string; role: string; bullets: string[] }>;
    skills?: Array<{ category: string; items: string[] }>;
    improvement_notes: string;
  };
  onApply: () => void;
  isApplying: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl p-6 md:p-8 border glass-card animate-fade-in-up space-y-6">
      <div
        className="flex items-center justify-between border-b pb-4 flex-wrap gap-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h3
          className="font-display text-xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Tailored Resume
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleCopy(JSON.stringify(result, null, 2))}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy JSON
          </button>

          <button
            onClick={onApply}
            disabled={isApplying}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Create Tailored Version
          </button>
        </div>
      </div>

      {result.improvement_notes && (
        <div
          className="p-4 rounded-2xl border text-sm"
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <strong className="text-purple-500">AI Notes: </strong>
          {result.improvement_notes}
        </div>
      )}

      {result.summary && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center justify-between">
            Professional Summary
            <button
              onClick={() => handleCopy(result.summary)}
              className="text-slate-400 hover:text-purple-500 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </h4>
          <div
            className="p-4 rounded-2xl border text-sm font-medium"
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

      {result.experience?.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500">
            Work Experience
          </h4>
          <div className="space-y-4">
            {result.experience.map((exp, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border space-y-3"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div>
                    <div
                      className="font-bold text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {exp.role}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {exp.company}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(exp.bullets.join("\n"))}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-purple-500 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ul className="space-y-2 list-disc list-outside ml-4">
                  {exp.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="text-sm pl-1"
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

      {result.skills && result.skills.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500">
            Skills Optimization
          </h4>
          <div
            className="p-4 rounded-2xl border space-y-4"
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {result.skills.map((skillGroup, i) => (
              <div key={i} className="space-y-1.5">
                <div
                  className="font-bold text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {skillGroup.category}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {skillGroup.items.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
