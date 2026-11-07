/* ---------------------------------------
    Network tripwire. Node's sandbox has no network lock, so this seals every JavaScript network entry point with a
    stand-in that refuses and writes one line to stderr. Native code is out of its reach; the child loads none.
    Ported from Kinetic Markdown's security/network-guard.mjs, same logic, with this project's refusal tag.
--------------------------------------- */

import dgram from 'node:dgram';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import { type AnyFunction, sealEveryFunction, sealFunction, sealFunctions } from './seal.ts';

export const NETWORK_BLOCKED_TAG = 'embedder sandbox: network blocked';

function refuse(name: string): AnyFunction {
  return function blocked(): never {
    process.stderr.write(`${NETWORK_BLOCKED_TAG} (${name})\n`);
    throw new Error(`${NETWORK_BLOCKED_TAG} (${name})`);
  };
}

/* -- Looking up a numeric address like 127.0.0.1 never leaves the machine -- */
function allowOnlyNumericLookups(target: typeof dns | typeof dns.promises, prefix: string): void {
  const originalLookup = target.lookup as (...args: unknown[]) => unknown;
  const blocked = refuse(`${prefix}.lookup`);
  sealFunction(target, 'lookup', function lookup(this: unknown, hostname: unknown, ...rest: unknown[]) {
    return typeof hostname === 'string' && net.isIP(hostname) ? originalLookup.call(this, hostname, ...rest) : blocked();
  });
}

sealFunctions(globalThis, ['fetch', 'WebSocket', 'EventSource'], 'global', refuse);
sealFunctions(net, ['connect', 'createConnection'], 'net', refuse);
sealFunctions(net.Socket.prototype, ['connect'], 'net.Socket', refuse);
sealFunctions(tls, ['connect'], 'tls', refuse);
sealFunctions(http, ['request', 'get'], 'http', refuse);
sealFunctions(https, ['request', 'get'], 'https', refuse);
/* -- UDP: new dgram.Socket() sends without createSocket, so its methods are sealed too -- */
sealFunctions(dgram, ['createSocket', '_createSocketHandle'], 'dgram', refuse);
sealFunctions(dgram.Socket.prototype, ['bind', 'connect', 'send', 'sendto'], 'dgram.Socket', refuse);
/* -- DNS: every function but a numeric lookup. The Resolver classes go first, as sealing a module hides them -- */
sealEveryFunction(dns.Resolver.prototype, 'dns.Resolver', refuse);
sealEveryFunction(dns.promises.Resolver.prototype, 'dns.promises.Resolver', refuse);
for (const [target, prefix] of [[dns, 'dns'], [dns.promises, 'dns.promises']] as const) {
  allowOnlyNumericLookups(target, prefix);
  sealEveryFunction(target, prefix, refuse, { except: ['lookup'] });
}

/* -- Named ESM imports of built-ins are copies; this pushes the stand-ins into them -- */
syncBuiltinESMExports();

/* -- For processes that never accept connections, loaded through listen-guard.ts: seals listen() and Node's two older routes around it -- */
export function refuseListening(): void {
  sealFunctions(net.Server.prototype, ['listen', '_listen2'], 'net.Server', refuse);
  sealFunctions(net, ['_createServerHandle'], 'net', refuse);
  syncBuiltinESMExports();
}
