/* ---------------------------------------
    Settings: .env values, environment overrides, provider list, bad values, and keys staying out of process.env.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configFrom, getConfig } from '../server/config/config.ts';

const ENV_TEXT = ['SERVER_PORT=9600', 'ANTHROPIC_API_KEY=sk-file-key', 'OLLAMA_BASE_URL=http://localhost:11434/v1', 'LOG_LEVEL=debug'].join('\n');

test('.env values are read and a real environment variable wins', () => {
  const config = configFrom(ENV_TEXT, { SERVER_PORT: '9700' });
  assert.equal(config.serverPort, 9700);
  assert.equal(config.webPort, 9519);
  assert.equal(config.logLevel, 'DEBUG');
});

test('API keys come from .env only, never from the environment', () => {
  const config = configFrom('', { OPENAI_API_KEY: 'sk-from-environment', ANTHROPIC_API_KEY: 'sk-ant-from-environment' });
  assert.deepEqual(config.providers, []);
  assert.deepEqual(config.secrets, []);
});

test('only providers set up in .env are listed, in dropdown order, with default models', () => {
  const config = configFrom(ENV_TEXT, {});
  assert.deepEqual(config.providers.map((provider) => [provider.id, provider.model]), [['claude', 'claude-opus-5-5'], ['offline', 'qwen2.5:7b']]);
  assert.deepEqual(config.secrets, ['sk-file-key']);
  assert.deepEqual(configFrom('', {}).providers, []);
});

test('a bad port or log level falls back to the default with a warning', () => {
  const config = configFrom('SERVER_PORT=99999\nLOG_LEVEL=LOUD', {});
  assert.equal(config.serverPort, 9500);
  assert.equal(config.logLevel, 'INFO');
  assert.equal(config.warnings.length, 2);
});

test('reading the real .env never copies its values into process.env', () => {
  const before = { ...process.env };
  getConfig();
  assert.deepEqual({ ...process.env }, before);
  assert.equal(process.env['SHARED_NODE_MODULES'], before['SHARED_NODE_MODULES']);
});
