/* ---------------------------------------
    npm run dev: starts the API server (SERVER_PORT) and the Vite dev server for the web page (WEB_PORT),
    with output from both in this terminal. Ctrl+C stops both; if either one ends, the other is stopped too,
    so no process is left holding a port.
    Both are started as `node <script>` from process.execPath with no shell, so paths with spaces work and
    stopping a child reaches the real process.
--------------------------------------- */

import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { getConfig } from '../server/config/config.ts';
import { PROJECT_ROOT } from '../server/data/project-paths.ts';
import { printLine } from '../server/logging/logger.ts';

const STOP_GRACE_MS = 5_000;
const config = getConfig();

const children: ChildProcess[] = [
  spawn(process.execPath, [join(PROJECT_ROOT, 'server', 'main.ts')], { cwd: PROJECT_ROOT, stdio: 'inherit' }),
  spawn(process.execPath, [join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', join(PROJECT_ROOT, 'web', 'vite.config.ts')], { cwd: PROJECT_ROOT, stdio: 'inherit' }),
];
printLine(`Web page: http://localhost:${config.webPort}  (API on 127.0.0.1:${config.serverPort})`);

let stopping = false;
function stopAll(exitCode: number): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(exitCode), STOP_GRACE_MS).unref();
  void Promise.all(children.map((child) => (child.exitCode === null ? new Promise((done) => child.once('exit', done)) : null))).then(() => process.exit(exitCode));
}

for (const child of children) child.once('exit', (code) => stopAll(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, () => stopAll(0));
