/* ---------------------------------------
    Every call the page makes to the server, in one place. Each one takes an AbortSignal, so a newer message can
    cancel an older one and closing the debug panel stops its polling at once.
--------------------------------------- */

import type { AppSettings, BrandChoice, ChatTurnResult, ConversationState, LogEntry } from './api-types.ts';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  throw new ApiError(response.status, body.error ?? `the server answered ${response.status}`);
}

function postJson<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal }).then((response) => readJson<T>(response));
}

export function fetchSettings(signal: AbortSignal): Promise<AppSettings> {
  return fetch('/api/config', { signal }).then((response) => readJson<AppSettings>(response));
}

export function sendChatMessage(message: string, providerId: string | null, state: ConversationState | null, signal: AbortSignal): Promise<ChatTurnResult> {
  return postJson<ChatTurnResult>('/api/chat', { message, providerId, state }, signal);
}

export function sendBrandChoice(choice: BrandChoice, providerId: string | null, state: ConversationState, signal: AbortSignal): Promise<ChatTurnResult> {
  return postJson<ChatTurnResult>('/api/brand-choice', { choice, providerId, state }, signal);
}

export function sendLoadMore(state: ConversationState, signal: AbortSignal): Promise<ChatTurnResult> {
  return postJson<ChatTurnResult>('/api/more', { state }, signal);
}

export function fetchLogsAfter(afterId: number, signal: AbortSignal): Promise<{ entries: LogEntry[] }> {
  return fetch(`/api/debug/logs?after=${afterId}`, { signal }).then((response) => readJson<{ entries: LogEntry[] }>(response));
}

export const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';
