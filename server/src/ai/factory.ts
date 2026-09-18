import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { settingsQueries, apiKeyQueries } from '../db/database';
import HttpProvider from './providers/HttpProvider';
import type { ProviderConfig } from '../types';

// tsx runs as CommonJS — __dirname is natively available
const PROVIDERS_DIR = join(__dirname, '..', '..', '..', 'providers');

export function readProviderConfig(name: string): ProviderConfig {
  const filePath = join(PROVIDERS_DIR, `${name}.yml`);
  if (!existsSync(filePath)) {
    throw new Error(`Provider config not found: providers/${name}.yml`);
  }
  return yaml.load(readFileSync(filePath, 'utf8')) as ProviderConfig;
}

export interface ProviderListItem {
  file: string;
  name: string;
  provider: string;
  description?: string;
  icon?: string;
  local: boolean;
  models: ProviderConfig['models']['options'];
  default_model: string;
  features: string[];
  has_api_key: boolean;
  error?: string;
}

export function listProviderFiles(): ProviderListItem[] {
  if (!existsSync(PROVIDERS_DIR)) return [];
  return readdirSync(PROVIDERS_DIR)
    .filter(f => f.endsWith('.yml'))
    .map(file => {
      const name = file.replace('.yml', '');
      try {
        const config = readProviderConfig(name);
        const selectedModel = settingsQueries.get(`provider_model_${config.provider}`);
        return {
          file,
          name: config.name,
          provider: config.provider,
          description: config.description,
          icon: config.icon,
          local: config.local ?? false,
          models: config.models?.options ?? [],
          default_model: selectedModel || config.models?.default || '',
          features: Object.keys(config.features ?? {}),
          has_api_key: !!apiKeyQueries.get(config.provider),
        } satisfies ProviderListItem;
      } catch (e) {
        return {
          file, name, provider: name,
          local: false, models: [], default_model: '', features: [],
          has_api_key: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });
}

export function getActiveProviderName(): string {
  return settingsQueries.get('active_provider') ?? 'openai';
}

export function getActiveProvider(modelOverride?: string): HttpProvider {
  const name = getActiveProviderName();
  const config = readProviderConfig(name);
  const apiKey = apiKeyQueries.get(config.provider);
  const storedModel = settingsQueries.get(`provider_model_${config.provider}`);
  return buildProvider(name, apiKey, modelOverride || storedModel || undefined);
}

export function buildProvider(providerName: string, apiKey: string | null, modelOverride?: string): HttpProvider {
  const config = readProviderConfig(providerName);
  const provider = new HttpProvider(config, apiKey);
  if (modelOverride) provider.setModel(modelOverride);
  return provider;
}

export async function testProvider(providerName: string, apiKey: string, model?: string): Promise<unknown> {
  return buildProvider(providerName, apiKey, model).test();
}
