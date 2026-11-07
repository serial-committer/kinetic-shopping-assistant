/* ---------------------------------------
    Runs inside the embedder's sandbox (same flags, plus read access to this folder) and tries to break out.
    Every target is local and harmless. Each attempt prints one JSON line; a probe that succeeds prints ALLOWED,
    so a weak seal shows up instead of hiding.
    Usage (by tests/embedder-sandbox.test.ts only): node <flags> escape-probe.ts <target folder> <model folder> <tcp port> <udp port>
--------------------------------------- */

import { spawn } from 'node:child_process';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';

const [targetFolder = '', modelFolder = '', tcpPortText = '0', udpPortText = '0'] = process.argv.slice(2);
const tcpPort = Number(tcpPortText);
const udpPort = Number(udpPortText);

const REFUSAL = /blocked|ERR_ACCESS_DENIED|ERR_DLOPEN_DISABLED|EvalError|Code generation from strings|disallowed/i;
const isRefusal = (error: unknown): boolean => {
  const { code = '', name = '', message = '' } = (error ?? {}) as { code?: string; name?: string; message?: string };
  return REFUSAL.test(`${code} ${name} ${message}`);
};

/* -- One JSON line per attempt on stdout: the test reads these lines -- */
const report = (line: object): void => void process.stdout.write(`${JSON.stringify(line)}\n`);

async function attempt(label: string, run: () => unknown): Promise<void> {
  try {
    const result = await run();
    report({ label, outcome: 'ALLOWED', detail: String(result ?? '').slice(0, 60) });
  } catch (error) {
    const { code, name } = (error ?? {}) as { code?: string; name?: string };
    report({ label, outcome: isRefusal(error) ? 'blocked' : 'failed differently', detail: `${code ?? name}` });
  }
}

/* -- new dgram.Socket('udp4') is the undocumented route around createSocket, so its type is not public -- */
const RawUdpSocket = dgram.Socket as unknown as new (type: 'udp4') => dgram.Socket;

const waitForSocket =(socket: net.Socket): Promise<string> => new Promise((resolve, reject) => {
  socket.once('connect', () => { socket.destroy(); resolve('connected'); });
  socket.once('error', reject);
});

await attempt('download a page (fetch)', async () => (await fetch(`http://127.0.0.1:${tcpPort}/`)).status);
await attempt('download a page (http.get)', () => new Promise((resolve, reject) => { http.get(`http://127.0.0.1:${tcpPort}/`, resolve).on('error', reject); }));
await attempt('open a raw connection (net.connect)', () => waitForSocket(net.connect(tcpPort, '127.0.0.1')));
await attempt('open a raw connection (new net.Socket)', () => { const socket = new net.Socket(); const waiting = waitForSocket(socket); socket.connect(tcpPort, '127.0.0.1'); return waiting; });
await attempt('send a UDP packet (new dgram.Socket)', () => new Promise((resolve, reject) => { const socket = new RawUdpSocket('udp4'); socket.send('x', udpPort, '127.0.0.1', (error) => (error ? reject(error) : resolve('sent'))); }));
await attempt('look up a name (dns.lookup)', () => new Promise((resolve, reject) => { dns.lookup('example.com', (error, address) => (error ? reject(error) : resolve(address))); }));
await attempt('ask a DNS server (dns.Resolver)', () => new Promise((resolve, reject) => { new dns.Resolver().resolve4('example.com', (error, list) => (error ? reject(error) : resolve(list))); }));
await attempt('listen for connections', () => new Promise((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { server.close(); resolve('listening'); }); }));
await attempt('start another program', () => new Promise((resolve, reject) => { const child = spawn('cmd.exe', ['/c', 'echo hi']); child.on('error', reject); child.on('spawn', () => resolve('started')); }));
await attempt('start a worker thread', () => { const worker = new Worker('1', { eval: true }); void worker.terminate(); return 'started'; });
await attempt('load native code', () => process.dlopen({ exports: {} } as NodeJS.Module, join(targetFolder, 'fake.node')));
await attempt('read a file not handed over', () => readFileSync(join(targetFolder, 'not-granted.txt'), 'utf8'));
await attempt('list the home folder', () => readdirSync(homedir()).length);
await attempt('write outside the sandbox', () => writeFileSync(join(targetFolder, 'escaped.txt'), 'x'));
await attempt('write into the model folder', () => writeFileSync(join(modelFolder, 'escaped.txt'), 'x'));
await attempt('turn text into code (eval)', () => (0, eval)('1 + 1'));
await attempt('turn text into code (new Function)', () => new Function('return 1')());
await attempt('turn text into code (vm)', () => vm.runInThisContext('1 + 1'));
await attempt('reach another program (process.kill)', () => process.kill(process.ppid, 0));
await attempt('open node:sqlite', () => {
  if (!process.getBuiltinModule('node:sqlite')) throw Object.assign(new Error('blocked'), { code: 'ERR_ACCESS_DENIED' });
  return 'available';
});
process.exit(0);
