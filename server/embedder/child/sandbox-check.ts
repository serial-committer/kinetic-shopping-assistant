/* ---------------------------------------
    The child checks its own sandbox before it loads the model, by asking Node what it grants instead of assuming.
    Any problem in the list means it refuses to start.
--------------------------------------- */

import { Server } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import type { VendorFolders } from './vendor-files.ts';

/* -- A guard leaves each function it seals read-only; Node ships these ones writable -- */
const isSealed = (target: object, name: string): boolean => Object.getOwnPropertyDescriptor(target, name)?.writable === false;

export function findSandboxViolations(folders: VendorFolders): string[] {
  const permission = process.permission;
  if (!permission) return ['it was not started inside the sandbox'];
  const violations: string[] = [];
  if (permission.has('child')) violations.push('it may start other programs');
  if (permission.has('worker')) violations.push('it may start worker threads');
  if (permission.has('addon')) violations.push('it may load native code');
  if (permission.has('fs.read', homedir())) violations.push('it may read the whole home folder');
  for (const folder of [folders.engineFolder, folders.modelFolder, tmpdir(), homedir()]) {
    if (permission.has('fs.write', folder)) violations.push(`it may write to ${folder}`);
  }
  if (process.getBuiltinModule('node:sqlite')) violations.push('node:sqlite is on, and it writes database files without asking the sandbox');
  if (!isSealed(globalThis, 'fetch') || !isSealed(process, 'kill') || !isSealed(Server.prototype, 'listen')) violations.push('its guards did not load before its own code');
  return violations;
}
