import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { settingsQueries, apiKeyQueries } from '../db/database';
import HttpProvider from './providers/HttpProvider';
import type { ProviderConfig } from '../types';

export function getUserProvidersDir(): string | null {
  if (process.env.AURACV_DATA_DIR) {
    return join(process.env.AURACV_DATA_DIR, 'providers');
  }
  return null;
}

export function getProvidersDir(): string {
  if (process.env.AURACV_PROVIDERS_DIR && existsSync(process.env.AURACV_PROVIDERS_DIR)) {
    return process.env.AURACV_PROVIDERS_DIR;
  }
  const rootDir = join(__dirname, '..', '..', '..', 'providers');
  if (existsSync(rootDir)) return rootDir;
  const distDir = join(__dirname, '..', '..', 'providers');
  if (existsSync(distDir)) return distDir;
  return rootDir;
}

export function readProviderConfig(name: string): ProviderConfig {
  const userDir = getUserProvidersDir();
  if (userDir && existsSync(userDir)) {
    const userFilePath = join(userDir, `${name}.yml`);
    if (existsSync(userFilePath)) {
      return yaml.load(readFileSync(userFilePath, 'utf8')) as ProviderConfig;
    }
  }

  const filePath = join(getProvidersDir(), `${name}.yml`);
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
  masked_api_key?: string;
  error?: string;
}

export function listProviderFiles(): ProviderListItem[] {
  const dir = getProvidersDir();
  const userDir = getUserProvidersDir();
  const fileNames = new Set<string>();

  if (existsSync(dir)) {
    readdirSync(dir)
      .filter(f => f.endsWith('.yml'))
      .forEach(f => fileNames.add(f));
  }
  if (userDir && existsSync(userDir)) {
    readdirSync(userDir)
      .filter(f => f.endsWith('.yml'))
      .forEach(f => fileNames.add(f));
  }

  return Array.from(fileNames).map(file => {
      const name = file.replace('.yml', '');
      try {
        const config = readProviderConfig(name);
        const selectedModel = settingsQueries.get(`provider_model_${config.provider}`);
        const hasKey = !!apiKeyQueries.get(config.provider);
        const maskedKey = hasKey ? apiKeyQueries.getMasked(config.provider) : undefined;
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
          has_api_key: hasKey,
          masked_api_key: maskedKey ?? undefined,
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
