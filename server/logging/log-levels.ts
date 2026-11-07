/* ---------------------------------------
    Log levels in Apache log4j order. A level prints itself and everything to its right:
    TRACE < DEBUG < INFO < WARN < ERROR, plus OFF, which prints nothing.
    LOG_LEVEL=DEBUG prints DEBUG, INFO, WARN and ERROR, and skips TRACE.
--------------------------------------- */

export const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogLevelName = LogLevel | 'OFF';

const RANK: Readonly<Record<LogLevelName, number>> = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, OFF: 5 };

export function isLogLevelName(value: string): value is LogLevelName {
  return Object.hasOwn(RANK, value);
}

/* -- True when an entry at `level` should print under the configured threshold -- */
export function isLevelEnabled(level: LogLevel, threshold: LogLevelName): boolean {
  return RANK[level] >= RANK[threshold];
}
