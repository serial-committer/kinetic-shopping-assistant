/* ---------------------------------------
    Proves the embedder's seal (Section 10): 20 escape attempts from inside the same sandbox must all be refused,
    and two local listeners must hear nothing. Then the real child must embed a sentence and leave no process behind.
--------------------------------------- */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PATHS } from '../server/data/project-paths.ts';
import { startEmbedderProcess } from '../server/embedder/embedder-process.ts';
import { embedderSandboxFlags } from '../server/embedder/sandbox-flags.ts';

const PROBE_FOLDER = join(dirname(fileURLToPath(import.meta.url)), 'sandbox');
const EXPECTED_PROBES = 20;

let targetFolder = '';
const heard: string[] = [];
const tcp = createServer((socket) => { heard.push('tcp'); socket.on('error', () => undefined); socket.destroy(); });
const udp = createSocket('udp4').on('message', () => heard.push('udp'));

before(async () => {
  targetFolder = mkdtempSync(join(tmpdir(), 'kinetic-escape-'));
  writeFileSync(join(targetFolder, 'not-granted.txt'), 'secret');
  await new Promise<void>((done) => tcp.listen(0, '127.0.0.1', done));
  await new Promise<void>((done) => udp.bind(0, '127.0.0.1', done));
});

after(() => {
  tcp.close();
  udp.close();
  rmSync(targetFolder, { recursive: true, force: true });
});

test('every escape attempt from inside the embedder sandbox is refused', async () => {
  const tcpPort = (tcp.address() as { port: number }).port;
  const udpPort = udp.address().port;
  const probe = spawn(process.execPath, [...embedderSandboxFlags([PROBE_FOLDER]), join(PROBE_FOLDER, 'escape-probe.ts'), targetFolder, PATHS.modelFolder, String(tcpPort), String(udpPort)], {
    cwd: PROBE_FOLDER,
    env: {},
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  probe.stdout.setEncoding('utf8').on('data', (chunk: string) => { output += chunk; });
  probe.stderr.resume();
  const exitCode = await new Promise<number | null>((done) => probe.once('exit', done));

  const attempts = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as { label: string; outcome: string; detail: string });
  const notBlocked = attempts.filter((attempt) => attempt.outcome !== 'blocked');
  assert.equal(exitCode, 0);
  assert.equal(attempts.length, EXPECTED_PROBES, `expected ${EXPECTED_PROBES} probes, got ${attempts.length}`);
  assert.deepEqual(notBlocked, [], `not blocked: ${JSON.stringify(notBlocked)}`);

  await new Promise((done) => setTimeout(done, 300));
  assert.deepEqual(heard, [], 'a local listener heard a connection or a packet');
  assert.equal(existsSync(join(targetFolder, 'escaped.txt')), false);
  assert.equal(existsSync(join(PATHS.modelFolder, 'escaped.txt')), false);
});

test('the real embedder child embeds a shopper sentence and leaves no process behind', async () => {
  const child = startEmbedderProcess();
  try {
    const { dimension } = await child.ready;
    assert.equal(dimension, 384);
    await child.embed(['warm-up'], 'query');
    const started = performance.now();
    const vector = await child.embed(['orange running shorts in size small'], 'query', { timeoutMs: 5_000 });
    const tookMs = performance.now() - started;
    assert.equal(vector.length, 384);
    assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-3, 'the vector should have length 1');
    assert.ok(tookMs < 100, `one sentence took ${Math.round(tookMs)} ms`);
  } finally {
    await child.close();
  }
  const exit = await child.exited;
  assert.equal(exit.requested, true);
  assert.throws(() => process.kill(child.pid!, 0), /ESRCH/);
});
