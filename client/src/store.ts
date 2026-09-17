import { create } from 'zustand';
import { resumeApi, aiApi, settingsApi, type Resume, type ResumeWithSections, type ProviderInfo, type ActiveProvider } from './api';

export type Theme = 'dark' | 'light';

interface AppState {
  // Resumes
  resumes: Resume[];
  currentResume: ResumeWithSections | null;
  loadingResumes: boolean;

  // Providers
  providers: ProviderInfo[];
  activeProvider: ActiveProvider | null;

  // Settings
  settings: Record<string, string>;

  // UI state
  sidebarOpen: boolean;
  activeTab: 'editor' | 'preview' | 'ai';
  theme: Theme;

  // Actions
  fetchResumes: () => Promise<void>;
  fetchResume:  (id: string) => Promise<void>;
  createResume: (name: string, templateId?: string) => Promise<string>;
  updateResume: (id: string, data: Partial<Resume>) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
  duplicateResume: (id: string) => Promise<string>;

  fetchProviders:      () => Promise<void>;
  fetchActiveProvider: () => Promise<void>;
  setActiveProvider:   (provider: string, model?: string) => Promise<void>;
  saveApiKey:          (provider: string, key: string) => Promise<void>;
  testProvider:        (provider: string, key: string, model?: string) => Promise<boolean>;

  fetchSettings:  () => Promise<void>;
  updateSettings: (data: Record<string, string>) => Promise<void>;

  setSidebarOpen: (open: boolean) => void;
  setActiveTab:   (tab: 'editor' | 'preview' | 'ai') => void;
  setTheme:       (theme: Theme) => void;
  toggleTheme:    () => void;
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('auracv-theme', theme);
  }
}

const initialTheme: Theme = (() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('auracv-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
})();

applyTheme(initialTheme);

export const useAppStore = create<AppState>((set, get) => ({
  resumes: [],
  currentResume: null,
  loadingResumes: false,
  providers: [],
  activeProvider: null,
  settings: {},
  sidebarOpen: true,
  activeTab: 'editor',
  theme: initialTheme,

  fetchResumes: async () => {
    set({ loadingResumes: true });
    try {
      const resumes = await resumeApi.list();
      set({ resumes, loadingResumes: false });
    } catch (e) {
      set({ loadingResumes: false });
      throw e;
    }
  },

  fetchResume: async (id) => {
    const resume = await resumeApi.get(id);
    set({ currentResume: resume });
  },

  createResume: async (name, templateId) => {
    const { id } = await resumeApi.create({ name, template_id: templateId });
    await get().fetchResumes();
    return id;
  },

  updateResume: async (id, data) => {
    await resumeApi.update(id, data);
    if (get().currentResume?.id === id) await get().fetchResume(id);
    await get().fetchResumes();
  },

  deleteResume: async (id) => {
    await resumeApi.delete(id);
    if (get().currentResume?.id === id) set({ currentResume: null });
    await get().fetchResumes();
  },

  duplicateResume: async (id) => {
    const { id: newId } = await resumeApi.duplicate(id);
    await get().fetchResumes();
    return newId;
  },

  fetchProviders: async () => {
    const providers = await aiApi.providers();
    set({ providers });
  },

  fetchActiveProvider: async () => {
    const activeProvider = await aiApi.activeProvider();
    set({ activeProvider });
  },

  setActiveProvider: async (provider, model?: string) => {
    await aiApi.setProvider(provider, model);
    await get().fetchActiveProvider();
    await get().fetchProviders();
  },

  saveApiKey: async (provider, key) => {
    await aiApi.saveKey(provider, key);
    await get().fetchProviders();
    await get().fetchActiveProvider();
  },

  testProvider: async (provider, key, model?: string) => {
    try {
      await aiApi.testProvider(provider, key, model);
      return true;
    } catch {
      return false;
    }
  },

  fetchSettings: async () => {
    const settings = await settingsApi.all();
    set({ settings });
    if (settings.theme === 'light' || settings.theme === 'dark') {
      get().setTheme(settings.theme as Theme);
    }
  },

  updateSettings: async (data) => {
    await settingsApi.update(data);
    set(s => ({ settings: { ...s.settings, ...data } }));
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab:   (tab)  => set({ activeTab: tab }),

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    get().updateSettings({ theme }).catch(() => {});
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));
