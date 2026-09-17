import { useState } from 'react';
import { useAppStore } from '../store';
import {
  Key, CheckCircle2, XCircle, Loader2, ToggleLeft, ToggleRight,
  Eye, EyeOff, ShieldCheck, Sun, Moon, Cpu, FolderOpen,
} from 'lucide-react';

export default function Settings() {
  const {
    providers, activeProvider, setActiveProvider, saveApiKey,
    testProvider, settings, updateSettings, theme, setTheme,
  } = useAppStore();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleTest = async (providerId: string) => {
    const providerObj = providers.find(p => p.provider === providerId);
    const key = keys[providerId] || '';
    setTesting(t => ({ ...t, [providerId]: true }));
    const ok = await testProvider(providerId, key, providerObj?.default_model);
    setTestResults(r => ({ ...r, [providerId]: ok }));
    setTesting(t => ({ ...t, [providerId]: false }));
  };

  const handleSave = async (provider: string) => {
    const key = keys[provider];
    if (!key) return;
    setSaving(s => ({ ...s, [provider]: true }));
    await saveApiKey(provider, key);
    setKeys(k => ({ ...k, [provider]: '' }));
    setSaving(s => ({ ...s, [provider]: false }));
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto animate-fade-in-up space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Studio Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure theme preferences and AI provider connections.
        </p>
      </div>

      {/* ── General Preferences ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          General Preferences
        </h2>

        <div className="rounded-3xl border glass-card p-6 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Theme Selector */}
          <div className="flex items-center justify-between pb-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Color Theme</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Toggle between light studio mode and obsidian dark mode</p>
            </div>
            <div
              className="flex p-1 rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'light' ? 'bg-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
                }`}
                style={{ color: theme === 'light' ? '#0f172a' : 'var(--text-primary)' }}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-neutral-700'
                }`}
                style={{ color: theme === 'dark' ? '#ffffff' : 'var(--text-primary)' }}
              >
                <Moon className="w-3.5 h-3.5 text-blue-400" /> Dark
              </button>
            </div>
          </div>

          {/* Auto-Save Toggle */}
          <div className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Auto-Save</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Automatically save your changes as you type</p>
            </div>
            <button
              onClick={() => updateSettings({ auto_save: settings.auto_save === 'false' ? 'true' : 'false' })}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
            >
              {settings.auto_save !== 'false' ? (
                <ToggleRight className="w-8 h-8" style={{ color: 'var(--brand)' }} />
              ) : (
                <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
          </div>

          {/* Default Template */}
          <div className="flex items-center justify-between pt-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Default Resume Template</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Starting layout used when creating new resumes</p>
            </div>
            <select
              value={settings.default_template ?? 'modern'}
              onChange={e => updateSettings({ default_template: e.target.value })}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
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
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              AI Providers
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Select which AI provider powers your resume suggestions and review tools
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {providers.map(provider => {
            const isActive = activeProvider?.provider === provider.provider;
            const isShowingKey = showKey[provider.provider] ?? false;

            return (
              <div
                key={provider.provider}
                className="rounded-3xl border glass-card p-6 transition-all space-y-4"
                style={{
                  borderColor: isActive ? 'var(--color-brand-500)' : 'var(--border-subtle)',
                  boxShadow: isActive ? 'var(--shadow-glow)' : undefined,
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
                        <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
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
                              backgroundColor: 'var(--bg-surface-elevated)',
                              borderColor: 'var(--border-default)',
                              color: 'var(--text-secondary)',
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
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveProvider(provider.provider)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'btn-primary'
                        : 'border hover:bg-slate-100 dark:hover:bg-neutral-700'
                    }`}
                    style={{
                      borderColor: isActive ? undefined : 'var(--border-default)',
                      color: isActive ? undefined : 'var(--text-primary)',
                    }}
                  >
                    {isActive ? 'Currently Active' : 'Set as Active'}
                  </button>
                </div>

                {/* API Key Vault input (skip for local ollama) */}
                {!provider.local && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={isShowingKey ? 'text' : 'password'}
                        value={keys[provider.provider] ?? ''}
                        onChange={e => setKeys(k => ({ ...k, [provider.provider]: e.target.value }))}
                        placeholder={provider.has_api_key ? '•••••••••••••••••••••••••••• (Encrypted in DB)' : 'Paste API Key (AES-256 encrypted)…'}
                        className="w-full rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                        style={{
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: 'var(--border-default)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(s => ({ ...s, [provider.provider]: !isShowingKey }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80"
                        style={{ color: 'var(--text-muted)' }}
                        title={isShowingKey ? 'Hide key' : 'Show key'}
                      >
                        {isShowingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(provider.provider)}
                        disabled={(!keys[provider.provider] && !provider.has_api_key) || testing[provider.provider]}
                        className="px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-neutral-700 cursor-pointer"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                      >
                        {testing[provider.provider] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                        {testResults[provider.provider] === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {testResults[provider.provider] === false && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                      </button>

                      <button
                        onClick={() => handleSave(provider.provider)}
                        disabled={!keys[provider.provider] || saving[provider.provider]}
                        className="btn-primary px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
                      >
                        {saving[provider.provider] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Key'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Model badges */}
                {provider.models?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Models:</span>
                    {provider.models.map(m => {
                      const isModelActive = m.id === provider.default_model;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setActiveProvider(provider.provider, m.id)}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium cursor-pointer transition-all ${
                            isModelActive
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-sm'
                              : 'border-transparent hover:border-slate-300 dark:hover:border-neutral-600'
                          }`}
                          style={{
                            backgroundColor: isModelActive ? undefined : 'var(--bg-surface-elevated)',
                            color: isModelActive ? undefined : 'var(--text-secondary)',
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
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-600 dark:text-blue-400">Zero-Code AI Customization:</span>
            <p className="mt-0.5">
              Every provider contract is defined in YAML files located in <code className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">providers/*.yml</code>. You can tweak endpoints, auth headers, token limits, model names, or add entirely custom LLM providers by dropping in a new YAML file.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
