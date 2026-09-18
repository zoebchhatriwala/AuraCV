// Typed API client for the AuraCV server

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const get  = <T>(path: string) => request<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put  = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) });
const del  = <T>(path: string) => request<T>(path, { method: 'DELETE' });

// ─── Resume API ───────────────────────────────────────────────────────────────
export const resumeApi = {
  list:      ()         => get<Resume[]>('/resumes'),
  get:       (id: string) => get<ResumeWithSections>(`/resumes/${id}`),
  create:    (data: Partial<Resume> & { name: string }) => post<{ id: string }>('/resumes', data),
  update:    (id: string, data: Partial<Resume>) => put<{ ok: boolean }>(`/resumes/${id}`, data),
  delete:    (id: string) => del<{ ok: boolean }>(`/resumes/${id}`),
  duplicate: (id: string, name?: string) => post<{ id: string }>(`/resumes/${id}/duplicate`, { name }),

  addSection:    (id: string, data: Partial<Section> & { section_type: string; title: string }) =>
                   post<{ id: string }>(`/resumes/${id}/sections`, data),
  updateSection: (id: string, sectionId: string, data: Partial<Section>) =>
                   put<{ ok: boolean }>(`/resumes/${id}/sections/${sectionId}`, data),
  deleteSection: (id: string, sectionId: string) =>
                   del<{ ok: boolean }>(`/resumes/${id}/sections/${sectionId}`),
  reorderSections: (id: string, orderedIds: string[]) =>
                   post<{ ok: boolean }>(`/resumes/${id}/sections/reorder`, { orderedIds }),
};

// ─── AI API ───────────────────────────────────────────────────────────────────
export const aiApi = {
  providers:       ()                          => get<ProviderInfo[]>('/ai/providers'),
  activeProvider:  ()                          => get<ActiveProvider>('/ai/providers/active'),
  setProvider:     (provider: string, model?: string) => put<{ ok: boolean }>('/ai/providers/active', { provider, model }),
  saveKey:         (provider: string, api_key: string) => post<{ ok: boolean }>('/ai/providers/key', { provider, api_key }),
  deleteKey:       (provider: string)          => del<{ ok: boolean }>(`/ai/providers/key/${provider}`),
  testProvider:    (provider: string, api_key: string, model?: string) => post<{ ok: boolean }>('/ai/providers/test', { provider, api_key, model }),

  redline:     (data: { resume_id: string; section_id: string; context?: string; model?: string }) =>
                 post<RedlineResult & { session_id: string }>('/ai/redline', data),
  rewrite:     (data: { bullet: string; tone?: string; role?: string; resume_id?: string; section_id?: string; model?: string }) =>
                 post<RewriteResult>('/ai/rewrite', data),
  atsScore:    (data: { resume_id: string; job_description: string; model?: string }) =>
                 post<ATSScoreResult>('/ai/ats-score', data),
  keywordGap:  (data: { resume_id: string; job_description: string; model?: string }) =>
                 post<KeywordGapResult>('/ai/keyword-gap', data),
  sessions:    (resumeId: string) => get<AISession[]>(`/ai/sessions/${resumeId}`),
  acceptSession: (id: string)     => post<{ ok: boolean }>(`/ai/sessions/${id}/accept`),
};

// ─── Settings API ─────────────────────────────────────────────────────────────
export const settingsApi = {
  all:    ()                              => get<Record<string, string>>('/settings'),
  update: (data: Record<string, string>) => put<{ ok: boolean }>('/settings', data),
};

// ─── Export API ───────────────────────────────────────────────────────────────
export const exportApi = {
  preview: (id: string, template?: string) =>
    `/api/export/${id}/preview${template ? `?template=${template}` : ''}`,
  samplePreview: (template: string = 'modern') =>
    `/api/export/sample-preview?template=${template}`,
  pdf:  (id: string, opts?: { ats_mode?: boolean; template?: string }) =>
    post<Blob>(`/export/${id}/pdf`, opts),
  docx: (id: string) => post<Blob>(`/export/${id}/docx`),
  json: (id: string) => post<unknown>(`/export/${id}/json`),
};

// ─── Import API ───────────────────────────────────────────────────────────────
export const importApi = {
  text: (text: string, name?: string) => post<{ id: string }>('/import/text', { text, name }),
  json: (resume: unknown, sections: unknown[]) => post<{ id: string }>('/import/json', { resume, sections }),
  pdf:  async (file: File, name?: string): Promise<{ id: string }> => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    const res = await fetch(`${BASE}/import/pdf`, { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error || `Upload failed: ${res.statusText}`);
    }
    return res.json() as Promise<{ id: string }>;
  },
};

// ─── Templates API ────────────────────────────────────────────────────────────
export const templatesApi = {
  list: () => get<Template[]>('/templates'),
  samplePreviewUrl: (templateId: string = 'modern') => `/api/export/sample-preview?template=${templateId}`,
};

// ─── Shared types (mirrored from server for frontend use) ─────────────────────
export interface Resume {
  id: string;
  name: string;
  version_tag: string;
  template_id: string;
  is_active: number;
  parent_id: string | null;
  meta: ResumeMeta;
  created_at: string;
  updated_at: string;
  section_count?: number;
}

export interface ResumeMeta {
  target_role?: string;
  target_company?: string;
  notes?: string;
}

export interface ResumeWithSections extends Resume {
  sections: Section[];
}

export interface Section {
  id: string;
  resume_id: string;
  section_type: string;
  title: string;
  content: unknown[];
  position: number;
  is_visible: number;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  is_ats_safe: boolean;
}

export interface ProviderInfo {
  file: string;
  name: string;
  provider: string;
  description?: string;
  icon?: string;
  local: boolean;
  models: ModelOption[];
  default_model: string;
  features: string[];
  has_api_key: boolean;
  error?: string;
}

export interface ActiveProvider {
  provider: string;
  name: string;
  model: string;
  models: ModelOption[];
  features: string[];
  has_api_key: boolean;
  local: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  context_window?: number;
  recommended?: boolean;
}

export interface RedlineResult {
  overall_score: number;
  suggestions: RedlineSuggestion[];
  strengths: string[];
  summary: string;
}

export interface RedlineSuggestion {
  type: 'improve' | 'remove' | 'add' | 'rewrite';
  original: string;
  suggestion: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RewriteResult {
  rewritten: string;
  alternatives: string[];
  action_verb_used: string;
  improvement_notes: string;
}

export interface ATSScoreResult {
  overall_score: number;
  keyword_match_score: number;
  format_score: number;
  experience_match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  section_scores: Record<string, number>;
  recommendations: string[];
  summary: string;
}

export interface KeywordGapResult {
  critical_missing: Array<{ keyword: string; frequency_in_jd: number; suggested_context: string }>;
  nice_to_have_missing: Array<{ keyword: string; suggested_context: string }>;
  already_present: string[];
  skills_gap: { technical: string[]; soft: string[]; domain: string[] };
  summary: string;
}

export interface AISession {
  id: string;
  resume_id: string;
  section_id: string | null;
  task_type: string;
  provider: string;
  model: string;
  output: unknown;
  score: number | null;
  accepted: number;
  created_at: string;
}
