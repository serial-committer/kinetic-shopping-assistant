/* ---------------------------------------
    Replaces every configured key with *** inside log messages and log data, however deep it sits.
--------------------------------------- */

const MASK = '***';
const MAX_DEPTH = 8;

export function maskSecrets<T>(value: T, secrets: readonly string[]): T {
  if (secrets.length === 0) return value;
  return maskValue(value, secrets, 0) as T;
}

function maskValue(value: unknown, secrets: readonly string[], depth: number): unknown {
  if (typeof value === 'string') return secrets.reduce((text, secret) => text.split(secret).join(MASK), value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => maskValue(item, secrets, depth + 1));
  if (ArrayBuffer.isView(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskValue(item, secrets, depth + 1)]));
}
