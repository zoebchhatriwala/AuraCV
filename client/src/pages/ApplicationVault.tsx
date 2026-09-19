import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Search,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
  Briefcase,
  HelpCircle,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  ClipboardPaste,
} from "lucide-react";
import {
  vaultApi,
  type JobMetadata,
  type QAEntry,
  type QASearchResult,
  type CustomField,
} from "../api";
import ConfirmModal from "../components/ConfirmModal";

const DEFAULT_CATEGORIES = [
  "All",
  "Experience",
  "Behavioral",
  "Leadership",
  "Culture Fit",
  "Logistics",
  "General",
];

export default function ApplicationVault() {
  const [activeTab, setActiveTab] = useState<"qa" | "profile">("qa");

  // Metadata State
  const [metadata, setMetadata] = useState<JobMetadata>({
    id: "default",
    full_name: "",
    preferred_name: "",
    email: "",
    phone: "",
    location: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
    current_company: "",
    current_title: "",
    experience_years: "",
    notice_period: "",
    work_authorization: "",
    salary_current: "",
    salary_expected: "",
    willing_to_relocate: "",
    work_mode_preference: "",
    highest_education: "",
    custom_fields: [],
    updated_at: "",
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaSavedToast, setMetaSavedToast] = useState(false);

  // In-app Toast Notification State (replaces native alerts)
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // Delete Confirmation Modal State (replaces native confirm)
  const [deleteConfirmQA, setDeleteConfirmQA] = useState<QAEntry | null>(null);

  // Q&A Bank State
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([]);
  const [loadingQA, setLoadingQA] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [keywordFilter, setKeywordFilter] = useState("");

  // Semantic Matcher State
  const [portalQuery, setPortalQuery] = useState("");
  const [searchingSemantic, setSearchingSemantic] = useState(false);
  const [searchResults, setSearchResults] = useState<QASearchResult[]>([]);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<QAEntry | null>(null);
  const [entryForm, setEntryForm] = useState({
    question: "",
    answer: "",
    category: "Experience",
    tagsInput: "",
  });

  // AI Morpher Modal State
  const [morphModalOpen, setMorphModalOpen] = useState(false);
  const [morphSource, setMorphSource] = useState<{
    question: string;
    answer: string;
  } | null>(null);
  const [targetQuestion, setTargetQuestion] = useState("");
  const [morphInstructions, setMorphInstructions] = useState("");
  const [morphing, setMorphing] = useState(false);
  const [morphedOutput, setMorphedOutput] = useState<{
    morphed_answer: string;
    key_adaptations?: string[];
    suggested_tags?: string[];
    suggested_category?: string;
  } | null>(null);

  // Custom Field Form in Profile
  const [newCustomField, setNewCustomField] = useState({
    label: "",
    value: "",
    category: "General",
  });

  // Clipboard Copied feedback map
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadQAEntries = async () => {
    setLoadingQA(true);
    try {
      const data = await vaultApi.listQA();
      setQaEntries(data);
    } catch (err) {
      console.error("Failed to load QA entries:", err);
    } finally {
      setLoadingQA(false);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    let ignore = false;
    vaultApi.getMeta().then((data) => {
      if (!ignore) setMetadata(data);
    }).catch((err) => {
      console.error("Failed to load metadata:", err);
    });

    vaultApi.listQA().then((data) => {
      if (!ignore) setQaEntries(data);
    }).catch((err) => {
      console.error("Failed to load QA entries:", err);
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Debounced Semantic Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!portalQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchingSemantic(true);
      try {
        const results = await vaultApi.searchQA(portalQuery.trim(), {
          limit: 5,
          min_similarity: 0.25,
        });
        setSearchResults(results);
      } catch (err) {
        console.error("Semantic search error:", err);
      } finally {
        setSearchingSemantic(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [portalQuery]);

  const handleSaveMetadata = async () => {
    setSavingMeta(true);
    try {
      const updated = await vaultApi.updateMeta(metadata);
      setMetadata(updated);
      setMetaSavedToast(true);
      setTimeout(() => setMetaSavedToast(false), 2500);
      showToast("Profile metadata saved successfully", "success");
    } catch (err) {
      console.error("Failed to save metadata:", err);
      showToast("Failed to save profile metadata", "error");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryForm.question.trim() || !entryForm.answer.trim()) return;

    const tags = entryForm.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingEntry) {
        await vaultApi.updateQA(editingEntry.id, {
          question: entryForm.question,
          answer: entryForm.answer,
          category: entryForm.category,
          tags,
        });
        showToast("Question & answer updated", "success");
      } else {
        await vaultApi.createQA({
          question: entryForm.question,
          answer: entryForm.answer,
          category: entryForm.category,
          tags,
        });
        showToast("Question & answer saved to bank", "success");
      }
      setShowAddModal(false);
      setEditingEntry(null);
      setEntryForm({
        question: "",
        answer: "",
        category: "Experience",
        tagsInput: "",
      });
      await loadQAEntries();
    } catch (err) {
      console.error("Failed to save QA entry:", err);
      showToast("Failed to save question & answer", "error");
    }
  };

  const confirmDeleteQA = async () => {
    if (!deleteConfirmQA) return;
    const { id } = deleteConfirmQA;
    setDeleteConfirmQA(null);
    try {
      await vaultApi.deleteQA(id);
      await loadQAEntries();
      if (portalQuery.trim()) {
        const updatedSearch = await vaultApi.searchQA(portalQuery.trim());
        setSearchResults(updatedSearch);
      }
      showToast("Question & answer deleted", "info");
    } catch (err) {
      console.error("Failed to delete QA:", err);
      showToast("Failed to delete entry", "error");
    }
  };

  const handleReindex = async () => {
    try {
      setLoadingQA(true);
      await vaultApi.reindexQA();
      await loadQAEntries();
      showToast(
        "Embeddings re-indexed successfully with multilingual model!",
        "success",
      );
    } catch (err) {
      console.error("Reindex error:", err);
      showToast("Failed to re-index embeddings", "error");
    } finally {
      setLoadingQA(false);
    }
  };

  const openMorphModal = (question: string, answer: string) => {
    setMorphSource({ question, answer });
    setTargetQuestion("");
    setMorphInstructions("");
    setMorphedOutput(null);
    setMorphModalOpen(true);
  };

  const handleExecuteMorph = async () => {
    if (!morphSource || !targetQuestion.trim()) return;
    setMorphing(true);
    try {
      const res = await vaultApi.morphQA({
        originalQuestion: morphSource.question,
        originalAnswer: morphSource.answer,
        targetQuestion: targetQuestion.trim(),
        instructions: morphInstructions.trim(),
      });
      setMorphedOutput(res);
    } catch (err) {
      console.error("Morph error:", err);
      showToast("Failed to adapt answer with AI", "error");
    } finally {
      setMorphing(false);
    }
  };

  const handleSaveMorphedAsQA = async () => {
    if (!morphedOutput || !targetQuestion.trim()) return;
    try {
      await vaultApi.createQA({
        question: targetQuestion.trim(),
        answer: morphedOutput.morphed_answer,
        category: morphedOutput.suggested_category || "Experience",
        tags: morphedOutput.suggested_tags || ["morphed", "interview"],
      });
      await loadQAEntries();
      setMorphModalOpen(false);
      showToast("Morphed answer saved to Q&A bank!", "success");
    } catch (err) {
      console.error("Failed to save morphed QA:", err);
      showToast("Failed to save morphed answer", "error");
    }
  };

  const generateChatGptPrompt = () => {
    if (!morphSource) return "";
    const target = targetQuestion.trim() || "[Paste your target question here]";
    const instructions = morphInstructions.trim()
      ? `\n\n### Specific Guidance / Constraints:\n- ${morphInstructions.trim()}`
      : "";

    return `You are an expert career and interview coach. Please adapt and reframe my authentic experience below to directly and persuasively answer the target question for a job application or interview.

### My Authentic Source Experience:
Question: "${morphSource.question}"
My Answer:
${morphSource.answer}

### Target Question to Answer:
"${target}"${instructions}

### Instructions:
1. Ground your response strictly in my real experience, projects, skills, and metrics from the answer above. Do NOT invent new companies, fake achievements, or false statistics.
2. Adapt the narrative structure (e.g. STAR: Situation, Task, Action, Result) and emphasis so it directly answers the target question.
3. Keep the tone authentic, confident, and professional in first-person voice.
4. Output just the complete, refined answer ready to paste into my job application.`;
  };

  const handleCopyPromptForChatGpt = () => {
    const prompt = generateChatGptPrompt();
    if (!prompt) return;
    copyToClipboard("chatgpt-prompt", prompt);
    showToast("Prompt copied! Ready to paste into ChatGPT, Claude, etc.", "success");
  };

  const addCustomField = () => {
    if (!newCustomField.label.trim()) return;
    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: newCustomField.label.trim(),
      value: newCustomField.value.trim(),
      category: newCustomField.category.trim() || "General",
    };
    setMetadata((prev) => ({
      ...prev,
      custom_fields: [...prev.custom_fields, newField],
    }));
    setNewCustomField({ label: "", value: "", category: "General" });
  };

  const removeCustomField = (id: string) => {
    setMetadata((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((f) => f.id !== id),
    }));
  };

  // Filtered QA list
  const filteredQA = useMemo(() => {
    return qaEntries.filter((entry) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (() => {
          const c = entry.category.toLowerCase();
          const sc = selectedCategory.toLowerCase();
          if (c === sc || c.startsWith(sc)) return true;
          if (
            sc === "experience" &&
            (c.includes("experience") || c.includes("project"))
          )
            return true;
          if (
            sc === "behavioral" &&
            (c.includes("behavioral") || c.includes("situation"))
          )
            return true;
          if (
            sc === "leadership" &&
            (c.includes("leadership") ||
              c.includes("owner") ||
              c.includes("team"))
          )
            return true;
          if (
            sc === "culture fit" &&
            (c.includes("culture") || c.includes("motivation"))
          )
            return true;
          if (
            sc === "logistics" &&
            (c.includes("logistics") || c.includes("compensation"))
          )
            return true;
          return false;
        })();

      const matchesKeyword =
        !keywordFilter.trim() ||
        entry.question.toLowerCase().includes(keywordFilter.toLowerCase()) ||
        entry.answer.toLowerCase().includes(keywordFilter.toLowerCase()) ||
        entry.tags.some((t) =>
          t.toLowerCase().includes(keywordFilter.toLowerCase()),
        );
      return matchesCategory && matchesKeyword;
    });
  }, [qaEntries, selectedCategory, keywordFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header Bar ── */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1
                className="text-xl font-bold font-display"
                style={{ color: "var(--text-primary)" }}
              >
                Job Application Vault
              </h1>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Application metadata, custom fields, and multilingual semantic
                Q&A search
              </p>
            </div>
          </div>
        </div>

        {/* Engine Status & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px]">
              Multilingual MiniLM L12 (Local)
            </span>
          </div>

          <button
            type="button"
            onClick={handleReindex}
            disabled={loadingQA}
            className="p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
            title="Recompute all vector embeddings"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingQA ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div
        className="flex items-center gap-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("qa")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "qa"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent hover:text-blue-500"
          }`}
          style={{
            color: activeTab === "qa" ? undefined : "var(--text-secondary)",
          }}
        >
          <Sparkles className="w-4 h-4" />
          <span>Q&A Bank & Semantic Matcher</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
            {qaEntries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "profile"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent hover:text-blue-500"
          }`}
          style={{
            color:
              activeTab === "profile" ? undefined : "var(--text-secondary)",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Profile & Portal Metadata</span>
          {metadata.custom_fields.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
              +{metadata.custom_fields.length} Custom
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: Q&A BANK & SEMANTIC MATCHER ─────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "qa" && (
        <div className="space-y-6">
          {/* ── Hero Semantic Search Box ── */}
          <div
            className="p-5 rounded-3xl border shadow-sm transition-all"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Multilingual Semantic Matcher
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Paste any portal question to find and adapt your best saved
                  answer
                </span>
              </div>
            </div>

            <div className="relative">
              <Search
                className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="text"
                value={portalQuery}
                onChange={(e) => setPortalQuery(e.target.value)}
                placeholder="Paste any job application or interview question (e.g. 'What was your proudest achievement?' or 'Describe a time you solved a difficult problem')..."
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              {portalQuery && (
                <button
                  onClick={() => setPortalQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Search Matches Banner */}
            {portalQuery.trim() && (
              <div
                className="mt-4 pt-4 border-t space-y-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {searchingSemantic ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                        Analyzing semantic similarity...
                      </span>
                    ) : (
                      `Matched ${searchResults.length} relevant answer${searchResults.length === 1 ? "" : "s"}`
                    )}
                  </span>
                </div>

                {searchResults.length === 0 && !searchingSemantic ? (
                  <div
                    className="p-4 rounded-xl text-center text-xs"
                    style={{
                      color: "var(--text-muted)",
                      backgroundColor: "var(--bg-surface-elevated)",
                    }}
                  >
                    No close match found for this question yet. You can add it
                    below or adapt another answer with AI!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {searchResults.map((match) => {
                      const pct = Math.round(match.similarity * 100);
                      const isHigh = pct >= 65;
                      const isMed = pct >= 45;
                      return (
                        <div
                          key={match.id}
                          className="p-4 rounded-2xl border transition-all hover:border-blue-500 flex flex-col md:flex-row md:items-start justify-between gap-4"
                          style={{
                            backgroundColor: "var(--bg-surface-elevated)",
                            borderColor: "var(--border-subtle)",
                          }}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                                  isHigh
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : isMed
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                }`}
                              >
                                {pct}% Semantic Match
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400">
                                {match.category}
                              </span>
                            </div>

                            <h4
                              className="text-sm font-bold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {match.question}
                            </h4>

                            <p
                              className="text-xs leading-relaxed line-clamp-3"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {match.answer}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center md:flex-col gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  `match-${match.id}`,
                                  match.answer,
                                )
                              }
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                                copiedKey === `match-${match.id}`
                                  ? "bg-emerald-600 text-white"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              {copiedKey === `match-${match.id}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Answer</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openMorphModal(match.question, match.answer)
                              }
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"
                              style={{
                                borderColor: "var(--border-subtle)",
                                color: "var(--text-primary)",
                              }}
                              title="Morph this answer to fit a different question"
                            >
                              <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                              <span>Morph AI</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Q&A Bank Controls ── */}
          <div className="space-y-3.5 pt-2">
            {/* Top Tier: Title, Count, Search & New Q&A */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2
                    className="font-display font-bold text-lg"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Saved Q&A Bank
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {filteredQA.length}{" "}
                    {filteredQA.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Organize and quickly copy your verified answers for job
                  portals
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bank by keywords or tags..."
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 w-full sm:w-64 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  />
                  {keywordFilter && (
                    <button
                      type="button"
                      onClick={() => setKeywordFilter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(null);
                    setEntryForm({
                      question: "",
                      answer: "",
                      category: "Experience",
                      tagsInput: "",
                    });
                    setShowAddModal(true);
                  }}
                  className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Q&A</span>
                </button>
              </div>
            </div>

            {/* Sub Tier: Dedicated Horizontal Category Rail */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count =
                  cat === "All"
                    ? qaEntries.length
                    : qaEntries.filter((e) => {
                        const c = e.category.toLowerCase();
                        const sc = cat.toLowerCase();
                        return (
                          c === sc ||
                          c.startsWith(sc) ||
                          (sc === "experience" &&
                            (c.includes("experience") ||
                              c.includes("project"))) ||
                          (sc === "behavioral" &&
                            (c.includes("behavioral") ||
                              c.includes("situation"))) ||
                          (sc === "leadership" &&
                            (c.includes("leadership") ||
                              c.includes("owner") ||
                              c.includes("team"))) ||
                          (sc === "culture fit" &&
                            (c.includes("culture") ||
                              c.includes("motivation"))) ||
                          (sc === "logistics" &&
                            (c.includes("logistics") ||
                              c.includes("compensation")))
                        );
                      }).length;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20"
                        : "border hover:bg-slate-100 dark:hover:bg-neutral-800"
                    }`}
                    style={{
                      borderColor: isSelected
                        ? "transparent"
                        : "var(--border-subtle)",
                      color: isSelected ? "#ffffff" : "var(--text-secondary)",
                      backgroundColor: isSelected
                        ? undefined
                        : "var(--bg-surface)",
                    }}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium leading-none ${
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-slate-200/70 dark:bg-neutral-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQA.map((entry) => (
              <div
                key={entry.id}
                className="rounded-3xl border p-5 flex flex-col justify-between transition-all hover:shadow-md glass-card"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {entry.category}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          openMorphModal(entry.question, entry.answer)
                        }
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Morph this answer into a new question using AI"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Morph</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntry(entry);
                          setEntryForm({
                            question: entry.question,
                            answer: entry.answer,
                            category: entry.category,
                            tagsInput: entry.tags.join(", "),
                          });
                          setShowAddModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        style={{ color: "var(--text-secondary)" }}
                        title="Edit question & answer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmQA(entry)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3
                    className="font-bold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {entry.question}
                  </h3>

                  <p
                    className="text-xs leading-relaxed line-clamp-4 whitespace-pre-wrap"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {entry.answer}
                  </p>

                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 font-mono"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="mt-4 pt-3 border-t flex items-center justify-between"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Embedded locally
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(`entry-${entry.id}`, entry.answer)
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      copiedKey === `entry-${entry.id}`
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700"
                    }`}
                    style={{
                      color:
                        copiedKey === `entry-${entry.id}`
                          ? undefined
                          : "var(--text-primary)",
                    }}
                  >
                    {copiedKey === `entry-${entry.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-blue-500" />
                        <span>Copy Answer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredQA.length === 0 && (
            <div
              className="text-center py-12 border rounded-3xl p-6"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <HelpCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                No Q&A entries found
              </p>
              <p
                className="text-xs mt-1 mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                {keywordFilter || selectedCategory !== "All"
                  ? "Try clearing your search filters or selected category"
                  : "Add your questions and answers to build your personal application and interview bank!"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingEntry(null);
                  setEntryForm({
                    question: "",
                    answer: "",
                    category: "Experience",
                    tagsInput: "",
                  });
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question & Answer</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: PROFILE & PORTAL METADATA ───────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Top Bar with Save Button */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl border"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            <div>
              <h3
                className="font-display text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Job Portal Autofill Profile
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Click the copy icon on any field to instantly copy it while
                filling job applications.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveMetadata}
              disabled={savingMeta}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                metaSavedToast
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {metaSavedToast ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{savingMeta ? "Saving..." : "Save Profile"}</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal & Contact Details */}
            <div
              className="p-5 rounded-3xl border space-y-4"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-default)",
              }}
            >
              <h4
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>Personal & Contact Info</span>
              </h4>

              {[
                {
                  label: "Full Legal Name",
                  key: "full_name" as const,
                  placeholder: "e.g. John Doe",
                },
                {
                  label: "Preferred / First Name",
                  key: "preferred_name" as const,
                  placeholder: "e.g. Johnny",
                },
                {
                  label: "Email Address",
                  key: "email" as const,
                  placeholder: "e.g. john@example.com",
                },
                {
                  label: "Phone Number",
                  key: "phone" as const,
                  placeholder: "e.g. +1 (555) 019-2831",
                },
                {
                  label: "Location (City, State, Country)",
                  key: "location" as const,
                  placeholder: "e.g. San Francisco, CA, USA",
                },
                {
                  label: "LinkedIn Profile URL",
                  key: "linkedin_url" as const,
                  placeholder: "e.g. https://linkedin.com/in/username",
                },
                {
                  label: "GitHub Profile URL",
                  key: "github_url" as const,
                  placeholder: "e.g. https://github.com/username",
                },
                {
                  label: "Portfolio / Website",
                  key: "portfolio_url" as const,
                  placeholder: "e.g. https://portfolio.dev",
                },
              ].map((field) => (
                <div key={field.key} className="space-y-1">
                  <label
                    className="text-xs font-semibold block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {field.label}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={metadata[field.key]}
                      onChange={(e) =>
                        setMetadata({
                          ...metadata,
                          [field.key]: e.target.value,
                        })
                      }
                      placeholder={field.placeholder}
                      className="w-full pr-10 pl-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                      style={{
                        backgroundColor: "var(--bg-surface-elevated)",
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(field.key, metadata[field.key])
                      }
                      className="absolute right-2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedKey === field.key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Compensation, Logistics & Experience */}
            <div className="space-y-6">
              <div
                className="p-5 rounded-3xl border space-y-4"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-default)",
                }}
              >
                <h4
                  className="text-sm font-bold flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span>Compensation & Work Logistics</span>
                </h4>

                {[
                  {
                    label: "Current Job Title",
                    key: "current_title" as const,
                    placeholder: "e.g. Senior Software Engineer",
                  },
                  {
                    label: "Current Company",
                    key: "current_company" as const,
                    placeholder: "e.g. Stripe",
                  },
                  {
                    label: "Total Years of Experience",
                    key: "experience_years" as const,
                    placeholder: "e.g. 6 years",
                  },
                  {
                    label: "Notice Period / Availability",
                    key: "notice_period" as const,
                    placeholder: "e.g. Immediate / 2 Weeks",
                  },
                  {
                    label: "Current Compensation / CTC",
                    key: "salary_current" as const,
                    placeholder: "e.g. $145,000 / year",
                  },
                  {
                    label: "Expected Compensation / CTC",
                    key: "salary_expected" as const,
                    placeholder: "e.g. $165,000 - $185,000 / year",
                  },
                  {
                    label: "Work Authorization / Visa Status",
                    key: "work_authorization" as const,
                    placeholder: "e.g. Citizen / Green Card / Requires H1B",
                  },
                  {
                    label: "Work Mode Preference",
                    key: "work_mode_preference" as const,
                    placeholder: "e.g. Remote / Hybrid (2 days)",
                  },
                  {
                    label: "Willing to Relocate?",
                    key: "willing_to_relocate" as const,
                    placeholder: "e.g. Yes / Open to Seattle & SF",
                  },
                  {
                    label: "Highest Degree / Education",
                    key: "highest_education" as const,
                    placeholder: "e.g. B.S. in Computer Science",
                  },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label
                      className="text-xs font-semibold block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {field.label}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={metadata[field.key]}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            [field.key]: e.target.value,
                          })
                        }
                        placeholder={field.placeholder}
                        className="w-full pr-10 pl-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{
                          backgroundColor: "var(--bg-surface-elevated)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(field.key, metadata[field.key])
                        }
                        className="absolute right-2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedKey === field.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Custom Portal Fields Section ── */}
          <div
            className="p-5 rounded-3xl border space-y-4"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4
                  className="text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Custom Portal Fields
                </h4>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Add any recurring questions job boards ask (e.g. "Security
                  clearance", "Pronouns", "Link to video intro").
                </p>
              </div>
            </div>

            {/* List of Custom Fields */}
            {metadata.custom_fields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metadata.custom_fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-3.5 rounded-2xl border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {field.label}
                        </span>
                        {field.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500">
                            {field.category}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs truncate font-mono mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {field.value || "<empty>"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(`custom-${field.id}`, field.value)
                        }
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"
                        title="Copy value"
                      >
                        {copiedKey === `custom-${field.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"
                        title="Delete field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Custom Field Row */}
            <div
              className="pt-3 border-t flex flex-col sm:flex-row items-center gap-2"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <input
                type="text"
                placeholder="Field Label (e.g. US Clearance)"
                value={newCustomField.label}
                onChange={(e) =>
                  setNewCustomField({
                    ...newCustomField,
                    label: e.target.value,
                  })
                }
                className="w-full sm:w-1/3 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              <input
                type="text"
                placeholder="Value (e.g. Active Secret)"
                value={newCustomField.value}
                onChange={(e) =>
                  setNewCustomField({
                    ...newCustomField,
                    value: e.target.value,
                  })
                }
                className="w-full sm:w-1/2 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={addCustomField}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                style={{ color: "var(--text-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: ADD / EDIT Q&A ─────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-4"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="font-display text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {editingEntry ? "Edit Question & Answer" : "Add New Q&A"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQA} className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-xs font-semibold block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Question or Prompt
                </label>
                <input
                  type="text"
                  required
                  value={entryForm.question}
                  onChange={(e) =>
                    setEntryForm({ ...entryForm, question: e.target.value })
                  }
                  placeholder="e.g. What was your proudest professional achievement or project?"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    className="text-xs font-semibold block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Category
                  </label>
                  <select
                    value={entryForm.category}
                    onChange={(e) =>
                      setEntryForm({ ...entryForm, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {DEFAULT_CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-xs font-semibold block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={entryForm.tagsInput}
                    onChange={(e) =>
                      setEntryForm({ ...entryForm, tagsInput: e.target.value })
                    }
                    placeholder="e.g. leadership, project-management, metrics, teamwork"
                    className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="text-xs font-semibold block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Your Answer (supports full details, STAR format, and metrics)
                </label>
                <textarea
                  required
                  rows={6}
                  value={entryForm.answer}
                  onChange={(e) =>
                    setEntryForm({ ...entryForm, answer: e.target.value })
                  }
                  placeholder="Write your comprehensive answer here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div
                className="flex items-center justify-end gap-2 pt-3 border-t"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save & Index Q&A
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: AI ANSWER MORPHER ──────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {morphModalOpen && morphSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setMorphModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl p-6 md:p-8 border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b pb-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    className="font-display text-base font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    AI Answer Morpher
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Reframes your truthful experience to directly answer a new
                    question
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMorphModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source Answer Pill */}
            <div
              className="p-3.5 rounded-2xl border space-y-1.5"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400">
                Source Experience ({morphSource.question})
              </span>
              <p className="text-xs line-clamp-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                {morphSource.answer}
              </p>
            </div>

            {/* Target Question Input */}
            <div className="space-y-2">
              <label
                className="text-xs font-bold block"
                style={{ color: "var(--text-primary)" }}
              >
                What new target question do you want to answer?
              </label>
              <input
                type="text"
                value={targetQuestion}
                onChange={(e) => setTargetQuestion(e.target.value)}
                placeholder="e.g. Tell me about a time you led a team under tight deadlines and delivered successfully"
                className="w-full px-4 py-3 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Optional Focus */}
            <div className="space-y-1">
              <label
                className="text-xs font-medium block"
                style={{ color: "var(--text-secondary)" }}
              >
                Optional Instructions / Nuance
              </label>
              <input
                type="text"
                value={morphInstructions}
                onChange={(e) => setMorphInstructions(e.target.value)}
                placeholder="e.g. Focus on communication with stakeholders and keep it under 150 words"
                className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyPromptForChatGpt}
                className="px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer shadow-xs"
                style={{
                  borderColor:
                    copiedKey === "chatgpt-prompt"
                      ? "#10b981"
                      : "var(--border-default)",
                  color:
                    copiedKey === "chatgpt-prompt"
                      ? "#10b981"
                      : "var(--text-primary)",
                  backgroundColor: "var(--bg-surface-elevated)",
                }}
                title="Copy a structured prompt to paste directly into ChatGPT, Claude, Gemini, etc."
              >
                {copiedKey === "chatgpt-prompt" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Copied Prompt for ChatGPT!
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-purple-500" />
                    <span>Copy Prompt for ChatGPT / External AI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExecuteMorph}
                disabled={morphing || !targetQuestion.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {morphing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Morphing with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Morph with Built-in AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick paste helper if user answered outside via ChatGPT */}
            {!morphedOutput && (
              <div
                className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-dashed"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Used ChatGPT, Claude, or another tool to generate the answer?
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    let clipboardText = "";
                    try {
                      clipboardText = await navigator.clipboard.readText();
                    } catch {
                      // ignore clipboard permission
                    }
                    setMorphedOutput({
                      morphed_answer: clipboardText,
                      suggested_category: "Experience",
                      suggested_tags: ["chatgpt", "adapted"],
                      key_adaptations: [
                        "Reframed via external AI (ChatGPT / Claude)",
                      ],
                    });
                    if (clipboardText) {
                      showToast("Pasted answer from clipboard!", "success");
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 cursor-pointer transition-colors"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste Answer from ChatGPT</span>
                </button>
              </div>
            )}

            {/* Morphed Output Preview & Editor */}
            {morphedOutput && (
              <div
                className="mt-4 pt-4 border-t space-y-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Adapted Answer Ready
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setMorphedOutput((prev) =>
                              prev ? { ...prev, morphed_answer: text } : null,
                            );
                            showToast("Pasted text into answer box", "success");
                          }
                        } catch {
                          showToast(
                            "Could not read clipboard. Please paste manually.",
                            "info",
                          );
                        }
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste clipboard over text</span>
                    </button>
                    {morphedOutput.suggested_category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                        {morphedOutput.suggested_category}
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={morphedOutput.morphed_answer}
                  onChange={(e) =>
                    setMorphedOutput({
                      ...morphedOutput,
                      morphed_answer: e.target.value,
                    })
                  }
                  placeholder="Paste or refine your adapted answer here..."
                  className="w-full p-4 rounded-2xl border text-xs leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                  style={{
                    backgroundColor: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />

                {morphedOutput.key_adaptations &&
                  morphedOutput.key_adaptations.length > 0 && (
                    <div
                      className="text-[11px] space-y-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span className="font-semibold block text-slate-700 dark:text-slate-300">
                        How it was adapted:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {morphedOutput.key_adaptations.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "morphed-output",
                        morphedOutput.morphed_answer,
                      )
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      copiedKey === "morphed-output"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 text-slate-900 dark:text-white"
                    }`}
                  >
                    {copiedKey === "morphed-output" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedKey === "morphed-output"
                        ? "Copied!"
                        : "Copy Answer"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveMorphedAsQA}
                    disabled={!morphedOutput.morphed_answer.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save as New Q&A</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Q&A Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmQA !== null}
        title="Delete Question & Answer"
        message={`Are you sure you want to delete "${deleteConfirmQA?.question}"? This will permanently remove this entry and its semantic embeddings.`}
        confirmLabel="Delete Q&A"
        variant="danger"
        onConfirm={confirmDeleteQA}
        onCancel={() => setDeleteConfirmQA(null)}
      />

      {/* In-app Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-fade-in-up flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md bg-slate-900/95 text-white border-slate-700/60 dark:bg-black/95 dark:border-neutral-700/60">
          {toast.type === "success" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {toast.type === "error" && (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          {toast.type === "info" && (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:bg-white/10 rounded-lg ml-1 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      )}
    </div>
  );
}
