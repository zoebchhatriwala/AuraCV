// ─── Shared TypeScript types across the entire server ─────────────────────────

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
  [key: string]: unknown;
}

export interface ResumeSection {
  id: string;
  resume_id: string;
  section_type: SectionType;
  title: string;
  content: SectionContent[];
  position: number;
  is_visible: number;
  created_at: string;
  updated_at: string;
}

export type SectionType =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'custom';

export type SectionContent =
  | HeaderContent
  | SummaryContent
  | ExperienceContent
  | EducationContent
  | SkillGroupContent
  | ProjectContent
  | CertificationContent
  | Record<string, unknown>;

export interface HeaderContent {
  name: string;
  role?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface SummaryContent {
  text: string;
}

export interface ExperienceContent {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  location?: string;
  bullets: string[];
}

export interface EducationContent {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  gpa?: string;
  bullets?: string[];
}

export interface SkillGroupContent {
  category: string;
  items: string[];
}

export interface ProjectContent {
  name: string;
  description: string;
  tech: string[];
  url?: string;
  bullets?: string[];
}

export interface CertificationContent {
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

// ─── AI types ─────────────────────────────────────────────────────────────────

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

export interface ImportParseResult {
  name: string;
  sections: Array<{
    section_type: SectionType;
    title: string;
    content: SectionContent[];
  }>;
}

// ─── Provider YAML config types ───────────────────────────────────────────────

export interface ProviderConfig {
  provider: string;
  name: string;
  icon?: string;
  description?: string;
  local?: boolean;
  api: ProviderApiConfig;
  models: ProviderModelsConfig;
  endpoints: Record<string, EndpointConfig>;
  features: Record<string, FeatureConfig>;
}

export interface ProviderApiConfig {
  base_url: string;
  content_type: string;
  accept?: string;
  auth: AuthConfig;
  extra_headers?: Record<string, string>;
}

export interface AuthConfig {
  type: 'bearer' | 'api-key-header' | 'query-param' | 'none';
  header?: string;
  prefix?: string;
  param?: string;
}

export interface ProviderModelsConfig {
  default: string;
  options: ModelOption[];
}

export interface ModelOption {
  id: string;
  name: string;
  context_window?: number;
  recommended?: boolean;
}

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  content_type?: string;
  request?: Record<string, unknown>;
  response: ResponseConfig;
}

export interface ResponseConfig {
  extract: string;
  parse: 'json' | 'text' | 'number';
  strip_markdown_fences?: boolean;
}

export interface FeatureConfig {
  enabled: boolean;
  endpoint: string;
  description?: string;
  note?: string;
  input: Record<string, FieldSchema>;
  output: Record<string, FieldSchema>;
}

export interface FieldSchema {
  type: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  description?: string;
  range?: [number, number];
  items?: FieldSchema | Record<string, FieldSchema>;
  properties?: Record<string, FieldSchema>;
}

// ─── DB row types (raw from SQLite) ──────────────────────────────────────────

export interface ResumeRow {
  id: string;
  name: string;
  version_tag: string;
  template_id: string;
  is_active: number;
  parent_id: string | null;
  meta: string; // JSON string
  created_at: string;
  updated_at: string;
  section_count?: number;
}

export interface SectionRow {
  id: string;
  resume_id: string;
  section_type: SectionType;
  title: string;
  content: string; // JSON string
  position: number;
  is_visible: number;
  created_at: string;
  updated_at: string;
}

export interface AISessionRow {
  id: string;
  resume_id: string;
  section_id: string | null;
  task_type: string;
  provider: string;
  model: string;
  input_text: string | null;
  output_text: string | null;
  job_desc: string | null;
  score: number | null;
  accepted: number;
  created_at: string;
}
