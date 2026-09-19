import { useState, useEffect } from "react";
import { useAppStore } from "../store";
import {
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Sun,
  Moon,
  Cpu,
  FolderOpen,
  Database,
  Download,
  HardDrive,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { exportApi, type DatabaseStats } from "../api";

export default function Settings() {
  const {
    providers,
    activeProvider,
    setActiveProvider,
    saveApiKey,
    testProvider,
    settings,
    updateSettings,
    theme,
    setTheme,
  } = useAppStore();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<
    Record<string, boolean | null>
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [exportingDb, setExportingDb] = useState(false);
  const [exportDbSuccess, setExportDbSuccess] = useState(false);
  const [showRestoreGuide, setShowRestoreGuide] = useState(false);
  const [restoreTab, setRestoreTab] = useState<"unix" | "windows">("unix");

  const fetchDbStats = async () => {
    try {
      const stats = await exportApi.dbStats();
      setDbStats(stats);
    } catch (e) {
      console.warn("Failed to load DB stats:", e);
    }
  };

  useEffect(() => {
    let ignore = false;
    exportApi.dbStats().then(stats => {
      if (!ignore) setDbStats(stats);
    }).catch(e => {
      console.warn("Failed to load DB stats:", e);
    });
    return () => { ignore = true; };
  }, []);

  const [exportDbError, setExportDbError] = useState<string | null>(null);

  const handleExportDb = async () => {
    setExportingDb(true);
    setExportDbSuccess(false);
    setExportDbError(null);
    try {
      await exportApi.downloadDb("auracv.db");
      setExportDbSuccess(true);
      setTimeout(() => setExportDbSuccess(false), 3500);
      fetchDbStats();
    } catch (e) {
      console.error("Database export failed:", e);
      setExportDbError(
        `Export failed: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    } finally {
      setExportingDb(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleTest = async (providerId: string) => {
    const providerObj = providers.find((p) => p.provider === providerId);
    const key = keys[providerId] || "";
    setTesting((t) => ({ ...t, [providerId]: true }));
    const ok = await testProvider(providerId, key, providerObj?.default_model);
    setTestResults((r) => ({ ...r, [providerId]: ok }));
    setTesting((t) => ({ ...t, [providerId]: false }));
  };

  const handleSave = async (provider: string) => {
    const key = keys[provider];
    if (!key) return;
    setSaving((s) => ({ ...s, [provider]: true }));
    await saveApiKey(provider, key);
    setKeys((k) => ({ ...k, [provider]: "" }));
    setSaving((s) => ({ ...s, [provider]: false }));
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto animate-fade-in-up space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Studio Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Configure theme preferences and AI provider connections.
        </p>
      </div>

      {/* ── General Preferences ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          General Preferences
        </h2>

        <div
          className="rounded-3xl border glass-card p-6 divide-y"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Theme Selector */}
          <div className="flex items-center justify-between pb-5">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Color Theme
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Toggle between light studio mode and obsidian dark mode
              </p>
            </div>
            <div
              className="flex p-1 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white shadow-sm"
                    : "hover:bg-slate-100 dark:hover:bg-neutral-700"
                }`}
                style={{
                  color: theme === "light" ? "#0f172a" : "var(--text-primary)",
                }}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "hover:bg-slate-100 dark:hover:bg-neutral-700"
                }`}
                style={{
                  color: theme === "dark" ? "#ffffff" : "var(--text-primary)",
                }}
              >
                <Moon className="w-3.5 h-3.5 text-blue-400" /> Dark
              </button>
            </div>
          </div>

          {/* Auto-Save Toggle */}
          <div className="flex items-center justify-between py-5">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Auto-Save
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Automatically save your changes as you type
              </p>
            </div>
            <button
              onClick={() =>
                updateSettings({
                  auto_save: settings.auto_save === "false" ? "true" : "false",
                })
              }
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
            >
              {settings.auto_save !== "false" ? (
                <ToggleRight
                  className="w-8 h-8"
                  style={{ color: "var(--brand)" }}
                />
              ) : (
                <ToggleLeft
                  className="w-8 h-8"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </button>
          </div>

          {/* Default Template */}
          <div className="flex items-center justify-between pt-5">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Default Resume Template
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Starting layout used when creating new resumes
              </p>
            </div>
            <select
              value={settings.default_template ?? "modern"}
              onChange={(e) =>
                updateSettings({ default_template: e.target.value })
              }
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="modern">Modern Layout</option>
              <option value="classic">Classic Serif</option>
              <option value="minimal">Minimal Layout</option>
              <option value="ats">ATS Pure Text</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── AI Provider Management ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="font-display text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              AI Providers
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Select which AI provider powers your resume suggestions and review
              tools
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {providers.map((provider) => {
            const isActive = activeProvider?.provider === provider.provider;
            const isShowingKey = showKey[provider.provider] ?? false;

            return (
              <div
                key={provider.provider}
                className="rounded-3xl border glass-card p-6 transition-all space-y-4"
                style={{
                  borderColor: isActive
                    ? "var(--color-brand-500)"
                    : "var(--border-subtle)",
                  boxShadow: isActive ? "var(--shadow-glow)" : undefined,
                }}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-display font-bold text-base"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {provider.name}
                        </span>
                        {provider.local ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            Local / Offline
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: "var(--bg-surface-elevated)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Cloud API
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Active Provider
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveProvider(provider.provider)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "btn-primary"
                        : "border hover:bg-slate-100 dark:hover:bg-neutral-700"
                    }`}
                    style={{
                      borderColor: isActive
                        ? undefined
                        : "var(--border-default)",
                      color: isActive ? undefined : "var(--text-primary)",
                    }}
                  >
                    {isActive ? "Currently Active" : "Set as Active"}
                  </button>
                </div>

                {/* API Key Vault input (skip for local ollama) */}
                {!provider.local && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={isShowingKey ? "text" : "password"}
                        value={keys[provider.provider] ?? ""}
                        onChange={(e) =>
                          setKeys((k) => ({
                            ...k,
                            [provider.provider]: e.target.value,
                          }))
                        }
                        placeholder={
                          provider.has_api_key
                            ? "•••••••••••••••••••••••••••• (Encrypted in DB)"
                            : "Paste API Key (AES-256 encrypted)…"
                        }
                        className="w-full rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                        style={{
                          backgroundColor: "var(--bg-surface-elevated)",
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowKey((s) => ({
                            ...s,
                            [provider.provider]: !isShowingKey,
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80"
                        style={{ color: "var(--text-muted)" }}
                        title={isShowingKey ? "Hide key" : "Show key"}
                      >
                        {isShowingKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(provider.provider)}
                        disabled={
                          (!keys[provider.provider] && !provider.has_api_key) ||
                          testing[provider.provider]
                        }
                        className="px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-neutral-700 cursor-pointer"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {testing[provider.provider] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Test"
                        )}
                        {testResults[provider.provider] === true && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {testResults[provider.provider] === false && (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </button>

                      <button
                        onClick={() => handleSave(provider.provider)}
                        disabled={
                          !keys[provider.provider] || saving[provider.provider]
                        }
                        className="btn-primary px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
                      >
                        {saving[provider.provider] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Save Key"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Model badges */}
                {provider.models?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Models:
                    </span>
                    {provider.models.map((m) => {
                      const isModelActive = m.id === provider.default_model;
                      return (
                        <button
                          key={m.id}
                          onClick={() =>
                            setActiveProvider(provider.provider, m.id)
                          }
                          className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium cursor-pointer transition-all ${
                            isModelActive
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-sm"
                              : "border-transparent hover:border-slate-300 dark:hover:border-neutral-600"
                          }`}
                          style={{
                            backgroundColor: isModelActive
                              ? undefined
                              : "var(--bg-surface-elevated)",
                            color: isModelActive
                              ? undefined
                              : "var(--text-secondary)",
                          }}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Swappable YAML instructions */}
        <div
          className="p-5 rounded-2xl border text-xs leading-relaxed flex items-start gap-3"
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              Zero-Code AI Customization:
            </span>
            <p className="mt-0.5">
              Every provider contract is defined in YAML files located in{" "}
              <code className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                providers/*.yml
              </code>
              . You can tweak endpoints, auth headers, token limits, model
              names, or add entirely custom LLM providers by dropping in a new
              YAML file.
            </p>
          </div>
        </div>
      </section>

      {/* ── Database & Backup Management ─────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2
            className="font-display text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Database & Data Storage
          </h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Manage and export your local SQLite database containing all resumes,
            settings, and logs
          </p>
        </div>

        <div
          className="rounded-3xl border glass-card p-6 space-y-6"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Top row: DB status & action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-display font-bold text-base"
                    style={{ color: "var(--text-primary)" }}
                  >
                    SQLite Database Engine
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    WAL Active
                  </span>
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  File:{" "}
                  <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-800">
                    auracv.db
                  </code>{" "}
                  · Fast embedded zero-network storage
                </p>
              </div>
            </div>

            <button
              onClick={handleExportDb}
              disabled={exportingDb}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                exportDbSuccess ? "bg-emerald-600 text-white" : "btn-primary"
              }`}
            >
              {exportingDb ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Snapshot…
                </>
              ) : exportDbSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Database Exported!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Database (.db)
                </>
              )}
            </button>
          </div>

          {exportDbError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
              <span>{exportDbError}</span>
              <button
                type="button"
                onClick={() => setExportDbError(null)}
                className="text-xs font-semibold hover:underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Resumes
              </p>
              <p
                className="text-lg font-bold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {dbStats?.resumesCount ?? "—"}
              </p>
            </div>
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Resume Sections
              </p>
              <p
                className="text-lg font-bold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {dbStats?.sectionsCount ?? "—"}
              </p>
            </div>
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Database Size
              </p>
              <p
                className="text-lg font-bold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {formatSize(dbStats?.fileSizeBytes)}
              </p>
            </div>
            <div
              className="p-3.5 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                AI Sessions
              </p>
              <p
                className="text-lg font-bold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {dbStats?.sessionsCount ?? "—"}
              </p>
            </div>
          </div>

          {/* Info footer */}
          <div
            className="text-xs flex items-start gap-2 pt-2 border-t"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <HardDrive className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
            <span>
              The exported file is a consolidated, standalone SQLite database
              snapshot created using{" "}
              <code className="font-mono text-[11px] text-blue-500">
                VACUUM INTO
              </code>
              . It is ready for offline backup, direct SQL querying, or
              restoring onto another machine.
            </span>
          </div>

          {/* Restore Guide Accordion */}
          <div
            className="pt-2 border-t"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={() => setShowRestoreGuide(!showRestoreGuide)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs font-semibold transition-all hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-blue-500" />
                <span>How to Restore a Database Backup</span>
              </div>
              {showRestoreGuide ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showRestoreGuide && (
              <div
                className="mt-3 p-4 rounded-2xl border text-xs space-y-3.5 animate-fade-in"
                style={{
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Safety First:</strong> Make sure to export your
                    current database as a safety backup before restoring an
                    older file.
                  </span>
                </div>

                <div className="space-y-2">
                  <p
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Restoring with an exported{" "}
                    <code className="font-mono text-[11px] text-blue-500">
                      auracv.db
                    </code>{" "}
                    file:
                  </p>
                  <ol
                    className="list-decimal list-inside space-y-1.5 pl-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <li>
                      <strong>Stop the server:</strong> Press{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-neutral-700 font-mono text-[10px]">
                        Ctrl + C
                      </kbd>{" "}
                      in your running terminal.
                    </li>
                    <li>
                      <strong>Replace database file:</strong> Copy your backup
                      file into the{" "}
                      <code className="font-mono text-[11px]">server/</code>{" "}
                      folder and name it{" "}
                      <code className="font-mono text-[11px] text-blue-500">
                        auracv.db
                      </code>
                      .
                    </li>
                    <li>
                      <strong>Clear WAL journals:</strong> Delete{" "}
                      <code className="font-mono text-[11px]">
                        server/auracv.db-wal
                      </code>{" "}
                      and{" "}
                      <code className="font-mono text-[11px]">
                        server/auracv.db-shm
                      </code>{" "}
                      if present to prevent journal conflicts.
                    </li>
                    <li>
                      <strong>Restart the server:</strong> Run{" "}
                      <code className="font-mono text-[11px]">npm run dev</code>{" "}
                      from root. AuraCV will automatically load all your
                      restored resumes, sections, and settings.
                    </li>
                  </ol>
                </div>

                {/* OS Selector Tabs */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Terminal OS:
                    </span>
                    <div
                      className="flex p-1 rounded-xl border"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setRestoreTab("unix")}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          restoreTab === "unix"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "hover:bg-slate-100 dark:hover:bg-neutral-800"
                        }`}
                        style={{
                          color:
                            restoreTab === "unix"
                              ? "#ffffff"
                              : "var(--text-secondary)",
                        }}
                      >
                        macOS / Linux (Bash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRestoreTab("windows")}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          restoreTab === "windows"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "hover:bg-slate-100 dark:hover:bg-neutral-800"
                        }`}
                        style={{
                          color:
                            restoreTab === "windows"
                              ? "#ffffff"
                              : "var(--text-secondary)",
                        }}
                      >
                        Windows (PowerShell)
                      </button>
                    </div>
                  </div>

                  {restoreTab === "unix" ? (
                    <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1.5 shadow-inner">
                      <div className="flex items-center gap-1.5 text-slate-400 pb-1.5 border-b border-slate-800">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Unix
                        / macOS / Linux (Bash or Zsh)
                      </div>
                      <p className="text-slate-500">
                        # 1. Stop server (Ctrl + C in running terminal)
                      </p>
                      <p className="text-slate-500">
                        # 2. In server/ directory:
                      </p>
                      <p className="text-emerald-400">
                        rm -f auracv.db-wal auracv.db-shm
                      </p>
                      <p className="text-emerald-400">
                        cp /path/to/your_backup.db auracv.db
                      </p>
                      <p className="text-slate-500">
                        # 3. Start server again from project root
                      </p>
                      <p className="text-cyan-400">cd .. && npm run dev</p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1.5 shadow-inner">
                      <div className="flex items-center gap-1.5 text-slate-400 pb-1.5 border-b border-slate-800">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />{" "}
                        Windows (PowerShell)
                      </div>
                      <p className="text-slate-500">
                        # 1. Stop server (Ctrl + C in running terminal)
                      </p>
                      <p className="text-slate-500">
                        # 2. In server/ directory:
                      </p>
                      <p className="text-emerald-400">
                        Remove-Item auracv.db-wal, auracv.db-shm -ErrorAction
                        SilentlyContinue
                      </p>
                      <p className="text-emerald-400">
                        Copy-Item path\to\your_backup.db auracv.db -Force
                      </p>
                      <p className="text-slate-500">
                        # 3. Start server again from project root
                      </p>
                      <p className="text-cyan-400">cd ..; npm run dev</p>
                    </div>
                  )}
                </div>

                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Tip: If you only want to restore a single resume without
                  replacing the entire database, go to the{" "}
                  <strong>Import</strong> page and upload an individual resume
                  JSON backup.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
