/**
 * HttpProvider — Generic AI provider driven entirely by a YAML contract.
 *
 * The YAML defines: base URL, auth strategy, per-endpoint request/response
 * schemas, and per-feature input/output contracts. Swap the YAML to swap
 * providers. Zero code changes required for new providers.
 */

import { PROMPTS } from '../prompts';
import type {
  ProviderConfig, EndpointConfig,
  RedlineResult, RewriteResult, ATSScoreResult,
  KeywordGapResult, ImportParseResult,
} from '../../types';

export interface ProviderInfo {
  provider: string;
  name: string;
  model: string;
  local: boolean;
  features: string[];
  models: ProviderConfig['models']['options'];
}

export default class HttpProvider {
  private config: ProviderConfig;
  private apiKey: string | null;
  public model: string;

  constructor(config: ProviderConfig, apiKey: string | null) {
    this.config = config;
    this.apiKey = apiKey;
    this.model = config.models?.default ?? 'default';
  }

  get info(): ProviderInfo {
    return {
      provider: this.config.provider,
      name: this.config.name,
      model: this.model,
      local: this.config.local ?? false,
      features: Object.entries(this.config.features ?? {})
        .filter(([, v]) => (v as { enabled?: boolean })?.enabled)
        .map(([k]) => k),
      models: this.config.models?.options ?? [],
    };
  }

  setModel(modelId: string): void {
    this.model = modelId;
  }

  // ─── Core HTTP engine ──────────────────────────────────────────────────────

  private buildUrl(endpointCfg: EndpointConfig): string {
    const base = this.config.api.base_url.replace(/\/$/, '');
    const path = endpointCfg.path.replace('{{model}}', encodeURIComponent(this.model));
    let url = base + path;

    if (this.config.api.auth.type === 'query-param' && this.apiKey) {
      url += `?${this.config.api.auth.param}=${encodeURIComponent(this.apiKey)}`;
    }
    return url;
  }

  private buildHeaders(endpointCfg: EndpointConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': endpointCfg.content_type ?? this.config.api.content_type ?? 'application/json',
      'Accept': this.config.api.accept ?? 'application/json',
    };
    const auth = this.config.api.auth;
    if (auth.type === 'bearer' && this.apiKey) {
      headers[auth.header!] = `${auth.prefix ?? 'Bearer '}${this.apiKey}`;
    } else if (auth.type === 'api-key-header' && this.apiKey) {
      headers[auth.header!] = `${auth.prefix ?? ''}${this.apiKey}`;
    }
    if (this.config.api.extra_headers) {
      Object.assign(headers, this.config.api.extra_headers);
    }
    return headers;
  }

  private buildBody(endpointCfg: EndpointConfig, prompt: string): unknown {
    const template = JSON.stringify(endpointCfg.request ?? {});
    const escaped = prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return JSON.parse(
      template
        .replace(/\{\{prompt\}\}/g, escaped)
        .replace(/\{\{model\}\}/g, this.model)
    );
  }

  /** Dot/bracket notation path extractor: "choices[0].message.content" */
  private extract(obj: unknown, path: string): unknown {
    return path
      .split(/\.|\[(\d+)\]/)
      .filter(Boolean)
      .reduce((acc: unknown, key: string) => {
        if (acc == null || typeof acc !== 'object') return undefined;
        return (acc as Record<string, unknown>)[isNaN(Number(key)) ? key : Number(key)];
      }, obj);
  }

  private parseResponse(raw: unknown, responseCfg: EndpointConfig['response']): unknown {
    if (raw == null) throw new Error('Empty response from provider');
    if (responseCfg.parse === 'json') {
      let text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (responseCfg.strip_markdown_fences) {
        text = text
          .replace(/^```json\s*/im, '')
          .replace(/^```\s*/im, '')
          .replace(/\s*```\s*$/im, '')
          .trim();
      }
      return typeof raw === 'object' ? raw : JSON.parse(text);
    }
    if (responseCfg.parse === 'text') return String(raw);
    if (responseCfg.parse === 'number') return Number(raw);
    return raw;
  }

  /** Execute a named endpoint from the YAML config. */
  async call(endpointName: string, prompt: string | null = null): Promise<unknown> {
    const endpointCfg = this.config.endpoints?.[endpointName];
    if (!endpointCfg) throw new Error(`Endpoint "${endpointName}" not defined in provider YAML for ${this.config.provider}`);

    const url = this.buildUrl(endpointCfg);
    const headers = this.buildHeaders(endpointCfg);
    const method = (endpointCfg.method ?? 'POST').toUpperCase();

    const fetchOpts: RequestInit = { method, headers };
    if (method !== 'GET' && endpointCfg.request && prompt !== null) {
      fetchOpts.body = JSON.stringify(this.buildBody(endpointCfg, prompt));
    } else if (method !== 'GET' && endpointCfg.request) {
      fetchOpts.body = JSON.stringify(endpointCfg.request);
    }

    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`${this.config.name} API ${res.status}: ${errText.substring(0, 300)}`);
    }

    const body = await res.json() as unknown;
    const extracted = this.extract(body, endpointCfg.response.extract);
    return this.parseResponse(extracted, endpointCfg.response);
  }

  // ─── Feature methods ───────────────────────────────────────────────────────

  private assertFeature(name: string): string {
    const feat = this.config.features?.[name];
    if (!feat?.enabled) throw new Error(`Feature "${name}" not enabled for "${this.config.provider}"`);
    return feat.endpoint;
  }

  async redline(sectionTitle: string, sectionContent: string, context?: string): Promise<RedlineResult> {
    const endpoint = this.assertFeature('redline');
    return this.call(endpoint, PROMPTS.redline(sectionTitle, sectionContent, context)) as Promise<RedlineResult>;
  }

  async rewrite(bullet: string, tone?: string, role?: string): Promise<RewriteResult> {
    const endpoint = this.assertFeature('rewrite');
    return this.call(endpoint, PROMPTS.rewrite(bullet, tone, role)) as Promise<RewriteResult>;
  }

  async atsScore(resumeText: string, jobDescription: string): Promise<ATSScoreResult> {
    const endpoint = this.assertFeature('ats_score');
    return this.call(endpoint, PROMPTS.atsScore(resumeText, jobDescription)) as Promise<ATSScoreResult>;
  }

  async keywordGap(resumeText: string, jobDescription: string): Promise<KeywordGapResult> {
    const endpoint = this.assertFeature('keyword_gap');
    return this.call(endpoint, PROMPTS.keywordGap(resumeText, jobDescription)) as Promise<KeywordGapResult>;
  }

  async importParse(rawText: string): Promise<ImportParseResult> {
    const endpoint = this.assertFeature('import_parse');
    return this.call(endpoint, PROMPTS.importParse(rawText)) as Promise<ImportParseResult>;
  }

  async test(): Promise<unknown> {
    return this.call('test');
  }

  async listModels(): Promise<unknown> {
    if (!this.config.endpoints?.list_models) return { models: this.config.models?.options ?? [] };
    return this.call('list_models');
  }
}
