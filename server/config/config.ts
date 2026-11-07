/* ---------------------------------------
    The only module that reads settings. Values come from the .env file. For everything except API keys, a real
    environment variable with the same name wins (handy for LOG_LEVEL=DEBUG on one run). API keys come from .env
    only, so a key that happens to sit in the machine's environment is never picked up and billed by surprise.
    The .env file is parsed here and never copied into process.env, so no library and no child process can find a
    key by looking there.
--------------------------------------- */

import { parseEnv } from 'node:util';
import { readEnvFileText } from '../data/data-service.ts';
import { isLogLevelName, type LogLevelName } from '../logging/log-levels.ts';

export type ChatProviderId = 'claude' | 'openai' | 'offline';

export type ChatProviderSettings = Readonly<{
  id: ChatProviderId;
  label: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
}>;

export type AppConfig = Readonly<{
  serverPort: number;
  webPort: number;
  logLevel: LogLevelName;
  debugPanel: boolean;
  /* -- Only the providers set up in .env, in dropdown order -- */
  providers: readonly ChatProviderSettings[];
  sharedNodeModules: string | null;
  /* -- Every configured key, so the logger can mask them -- */
  secrets: readonly string[];
  /* -- Problems found while reading settings, logged once the logger exists -- */
  warnings: readonly string[];
}>;

const KNOWN_SETTINGS = [
  'SERVER_PORT', 'WEB_PORT', 'LOG_LEVEL', 'DEBUG_PANEL', 'SHARED_NODE_MODULES',
  'ANTHROPIC_API_KEY', 'CLAUDE_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OLLAMA_BASE_URL', 'OLLAMA_MODEL',
] as const;
type SettingName = (typeof KNOWN_SETTINGS)[number];

const FILE_ONLY_SETTINGS: ReadonlySet<SettingName> = new Set(['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);

const DEFAULTS = Object.freeze({
  serverPort: 9500,
  webPort: 9519,
  logLevel: 'INFO' as LogLevelName,
  claudeModel: 'claude-opus-5-5',
  openaiModel: 'gpt-6-astra',
  ollamaModel: 'qwen2.5:7b',
});

let loaded: AppConfig | null = null;

/* -- Reads settings once, the first time anything asks, and hands the same frozen object to every caller after that -- */
export function getConfig(): AppConfig {
  loaded ??= configFrom(readEnvFileText(), process.env);
  return loaded;
}

/* -- The settings from .env text and an environment; the environment wins except for API keys. Exported for tests -- */
export function configFrom(envFileText: string | null, environment: Readonly<Record<string, string | undefined>>): AppConfig {
  const fromFile = parseEnv(envFileText ?? '');
  const settings: Partial<Record<SettingName, string>> = {};
  for (const name of KNOWN_SETTINGS) {
    const fromEnvironment = FILE_ONLY_SETTINGS.has(name) ? undefined : environment[name];
    const value = (fromEnvironment ?? fromFile[name] ?? '').trim();
    if (value) settings[name] = value;
  }
  return buildConfig(settings);
}

function buildConfig(settings: Partial<Record<SettingName, string>>): AppConfig {
  const warnings: string[] = [];
  const providers: ChatProviderSettings[] = [];

  if (settings.ANTHROPIC_API_KEY) {
    providers.push({ id: 'claude', label: 'Claude', model: settings.CLAUDE_MODEL ?? DEFAULTS.claudeModel, apiKey: settings.ANTHROPIC_API_KEY, baseUrl: null });
  }
  if (settings.OPENAI_API_KEY) {
    providers.push({ id: 'openai', label: 'OpenAI', model: settings.OPENAI_MODEL ?? DEFAULTS.openaiModel, apiKey: settings.OPENAI_API_KEY, baseUrl: null });
  }
  if (settings.OLLAMA_BASE_URL) {
    /* -- Ollama ignores the key, but the SDK needs a non-empty one -- */
    providers.push({ id: 'offline', label: 'Offline', model: settings.OLLAMA_MODEL ?? DEFAULTS.ollamaModel, apiKey: 'ollama', baseUrl: settings.OLLAMA_BASE_URL });
  }

  const logLevelText = (settings.LOG_LEVEL ?? DEFAULTS.logLevel).toUpperCase();
  if (!isLogLevelName(logLevelText)) warnings.push(`LOG_LEVEL "${settings.LOG_LEVEL}" is not a level, using ${DEFAULTS.logLevel}`);

  return Object.freeze({
    serverPort: readPort(settings.SERVER_PORT, DEFAULTS.serverPort, 'SERVER_PORT', warnings),
    webPort: readPort(settings.WEB_PORT, DEFAULTS.webPort, 'WEB_PORT', warnings),
    logLevel: isLogLevelName(logLevelText) ? logLevelText : DEFAULTS.logLevel,
    debugPanel: settings.DEBUG_PANEL?.toLowerCase() === 'true',
    providers: Object.freeze(providers),
    sharedNodeModules: settings.SHARED_NODE_MODULES ?? null,
    secrets: Object.freeze([settings.ANTHROPIC_API_KEY, settings.OPENAI_API_KEY].filter((key): key is string => Boolean(key))),
    warnings: Object.freeze(warnings),
  });
}

function readPort(text: string | undefined, fallback: number, name: string, warnings: string[]): number {
  if (text === undefined) return fallback;
  const port = Number(text);
  if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  warnings.push(`${name} "${text}" is not a port number, using ${fallback}`);
  return fallback;
}
