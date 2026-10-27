/**
 * HttpProvider — Generic AI provider driven entirely by a YAML contract.
 *
 * The YAML defines: base URL, auth strategy, per-endpoint request/response
 * schemas, and per-feature input/output contracts. Swap the YAML to swap
 * providers. Zero code changes required for new providers.
 */

import { PROMPTS } from '../prompts';
import { extractAndRepairJson, type JsonRepairResult } from '../jsonRepair';
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
    const path = endpointCfg.path.replace(/\{\{model\}\}/g, encodeURIComponent(this.model));
    let url = base + path;

    if (this.config.api.auth.type === 'query-param' && this.apiKey) {
      url += `?${this.config.api.auth.param}=${encodeURIComponent(this.apiKey)}`;
    }
    return url;
  }

  private isStreamingEnabled(endpointCfg: EndpointConfig): boolean {
    if (endpointCfg.stream !== undefined) return Boolean(endpointCfg.stream);
    if ((endpointCfg.request as any)?.stream !== undefined) return Boolean((endpointCfg.request as any).stream);
    if (this.config.api?.stream !== undefined) return Boolean(this.config.api.stream);
    return false;
  }

  private buildHeaders(endpointCfg: EndpointConfig): Record<string, string> {
    const isStream = this.isStreamingEnabled(endpointCfg);
    const defaultAccept = isStream ? 'text/event-stream, application/json' : (this.config.api.accept ?? 'application/json');
    const headers: Record<string, string> = {
      'Content-Type': endpointCfg.content_type ?? this.config.api.content_type ?? 'application/json',
      'Accept': defaultAccept,
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

  private buildBody(endpointCfg: EndpointConfig, prompt: string | null = null): unknown {
    const template = JSON.parse(JSON.stringify(endpointCfg.request ?? {}));

    if (this.isStreamingEnabled(endpointCfg) && typeof template === 'object' && template !== null && template.stream === undefined) {
      template.stream = true;
    }
    
    const modelCfg = this.config.models?.options.find(m => m.id === this.model);
    if (modelCfg?.request_overrides) {
      const merge = (target: any, source: any) => {
        for (const key of Object.keys(source)) {
          if (source[key] === null) {
            delete target[key];
          } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            merge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      };
      merge(template, modelCfg.request_overrides);
    }
    
    const walkAndReplace = (obj: any): any => {
      if (typeof obj === 'string') {
        let s = obj.replace(/\{\{model\}\}/g, () => this.model);
        if (s.includes('{{prompt}}')) {
          s = s.replace(/\{\{prompt\}\}/g, () => prompt ?? '');
        }
        return s;
      }
      if (Array.isArray(obj)) {
        return obj.map(walkAndReplace);
      }
      if (typeof obj === 'object' && obj !== null) {
        const res: any = {};
        for (const k of Object.keys(obj)) {
          res[k] = walkAndReplace(obj[k]);
        }
        return res;
      }
      return obj;
    };
    
    return walkAndReplace(template);
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

  private extractJsonFromText(text: string): unknown {
    return extractAndRepairJson(text).data;
  }

  private parseResponse(raw: unknown, responseCfg: EndpointConfig['response']): unknown {
    if (raw == null) throw new Error('Empty response from provider');
    if (responseCfg.parse === 'json') {
      if (typeof raw === 'object') return raw;
      const text = String(raw);
      try {
        return this.extractJsonFromText(text);
      } catch (err: any) {
        throw new Error(`JSON Parse Error: ${err.message}\n\nRaw Text:\n${text}`);
      }
    }
    if (responseCfg.parse === 'text') return String(raw);
    if (responseCfg.parse === 'number') return Number(raw);
    return raw;
  }

  /** Execute HTTP request with streaming support and configurable timeouts */
  private async execute(endpointCfg: EndpointConfig, prompt: string | null = null): Promise<unknown> {
    const url = this.buildUrl(endpointCfg);
    const headers = this.buildHeaders(endpointCfg);
    const method = (endpointCfg.method ?? 'POST').toUpperCase();
    const timeoutMs = endpointCfg.timeout ?? this.config.api.timeout ?? 60000;
    const isStream = this.isStreamingEnabled(endpointCfg);

    const controller = new AbortController();
    let initialTimer: NodeJS.Timeout | null = setTimeout(() => {
      controller.abort(new Error('TIMEOUT'));
    }, timeoutMs);

    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (method !== 'GET' && endpointCfg.request) {
      fetchOpts.body = JSON.stringify(this.buildBody(endpointCfg, prompt));
    }

    let res: Response;
    try {
      res = await fetch(url, fetchOpts);
    } catch (err: any) {
      if (initialTimer) clearTimeout(initialTimer);
      if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message === 'TIMEOUT' || err.message === 'IDLE_TIMEOUT') {
        const sec = Math.round(timeoutMs / 1000);
        throw new Error(`${this.config.name} request timed out after ${sec} seconds. The selected model (${this.model}) took too long to respond. Please try a faster model.`);
      }
      throw err;
    }

    if (!res.ok) {
      if (initialTimer) clearTimeout(initialTimer);
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`${this.config.name} API ${res.status}: ${errText.substring(0, 300)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const isStreamingResponse = isStream && (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/x-ndjson') ||
      !contentType.includes('application/json')
    );

    if (isStreamingResponse && res.body) {
      return this.readStream(res, controller, initialTimer, timeoutMs, endpointCfg);
    }

    if (initialTimer) clearTimeout(initialTimer);
    return res.json() as unknown;
  }

  /** Stream accumulator supporting OpenAI/NVIDIA SSE, Anthropic SSE, and Ollama NDJSON */
  private async readStream(
    res: Response,
    controller: AbortController,
    initialTimer: NodeJS.Timeout | null,
    timeoutMs: number,
    _endpointCfg: EndpointConfig
  ): Promise<unknown> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedReasoning = '';

    let idleTimer: NodeJS.Timeout | null = null;
    const resetIdleTimer = () => {
      if (initialTimer) {
        clearTimeout(initialTimer);
        initialTimer = null;
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        controller.abort(new Error('IDLE_TIMEOUT'));
      }, timeoutMs);
    };

    resetIdleTimer();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) continue;

          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              // OpenAI / NVIDIA NIM delta extraction
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                if (typeof delta.content === 'string') {
                  accumulatedContent += delta.content;
                }
                const reasoning = delta.reasoning_content ?? delta.reasoning;
                if (typeof reasoning === 'string') {
                  accumulatedReasoning += reasoning;
                }
              }
              // Anthropic delta extraction
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta' && typeof parsed.delta.text === 'string') {
                  accumulatedContent += parsed.delta.text;
                }
                if (parsed.delta?.type === 'thinking_delta' && typeof parsed.delta.thinking === 'string') {
                  accumulatedReasoning += parsed.delta.thinking;
                }
              }
              if (parsed.delta?.text && typeof parsed.delta.text === 'string') {
                accumulatedContent += parsed.delta.text;
              }
            } catch {
              // Ignore partial JSON chunks
            }
          } else if (line.startsWith('{') && line.endsWith('}')) {
            // Ollama or other NDJSON
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                accumulatedContent += parsed.message.content;
              } else if (typeof parsed.response === 'string') {
                accumulatedContent += parsed.response;
              }
              if (parsed.message?.reasoning_content) {
                accumulatedReasoning += parsed.message.reasoning_content;
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) accumulatedContent += delta.content;
              const reasoning = delta?.reasoning_content ?? delta?.reasoning;
              if (reasoning) accumulatedReasoning += reasoning;
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.message === 'TIMEOUT' || err.message === 'IDLE_TIMEOUT') {
        const sec = Math.round(timeoutMs / 1000);
        throw new Error(`${this.config.name} request timed out after ${sec} seconds. The selected model (${this.model}) took too long to respond. Please try a faster model.`);
      }
      throw err;
    } finally {
      if (initialTimer) clearTimeout(initialTimer);
      if (idleTimer) clearTimeout(idleTimer);
    }

    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: accumulatedContent,
            reasoning_content: accumulatedReasoning || undefined,
          },
        },
      ],
      content: [{ type: 'text', text: accumulatedContent }],
      message: { role: 'assistant', content: accumulatedContent },
      response: accumulatedContent,
    };
  }

  /** Execute a named endpoint from the YAML config. */
  async call(endpointName: string, prompt: string | null = null): Promise<unknown> {
    const endpointCfg = this.config.endpoints?.[endpointName];
    if (!endpointCfg) throw new Error(`Endpoint "${endpointName}" not defined in provider YAML for ${this.config.provider}`);

    const body = await this.execute(endpointCfg, prompt);
    const extracted = this.extract(body, endpointCfg.response.extract);
    return this.parseResponse(extracted, endpointCfg.response);
  }

  /** Execute a named endpoint and return the full repair & thinking context. */
  async callWithRepair(endpointName: string, prompt: string | null = null): Promise<JsonRepairResult<unknown>> {
    const endpointCfg = this.config.endpoints?.[endpointName];
    if (!endpointCfg) throw new Error(`Endpoint "${endpointName}" not defined in provider YAML for ${this.config.provider}`);

    const body = await this.execute(endpointCfg, prompt);
    const content = this.extract(body, endpointCfg.response.extract);
    const reasoning = this.extract(body, 'choices[0].message.reasoning_content') as string | undefined;

    // Use content if non-empty, otherwise fallback to reasoning
    const targetPayload = (content !== null && content !== undefined && content !== '') ? content : reasoning;
    const repairResult = extractAndRepairJson(targetPayload);

    // If native reasoning exists and wasn't extracted from <think> tags, attach it
    if (!repairResult.extractedThinking && reasoning && typeof reasoning === 'string') {
      repairResult.extractedThinking = reasoning.trim();
    }

    return repairResult;
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

  async cvTailorQuestions(resumeText: string, role: string, instructions: string): Promise<{questions: Array<{id: string, question: string}>}> {
    return this.call('chat', PROMPTS.cvTailorQuestions(resumeText, role, instructions)) as Promise<{questions: Array<{id: string, question: string}>}>;
  }

  async cvTailorRewrite(
    resumeText: string,
    role: string,
    instructions: string,
    qna: Array<{question: string, answer: string}>
  ): Promise<JsonRepairResult<unknown>> {
    return this.callWithRepair('chat', PROMPTS.cvTailorRewrite(resumeText, role, instructions, qna));
  }


  async test(): Promise<unknown> {
    return this.call('test');
  }

  async listModels(): Promise<unknown> {
    if (!this.config.endpoints?.list_models) return { models: this.config.models?.options ?? [] };
    return this.call('list_models');
  }
}
