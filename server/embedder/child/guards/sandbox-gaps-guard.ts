/* ---------------------------------------
    Seals what Node's permission sandbox does not check, apart from the network (network-guard.ts covers that):
    (1) reaching other programs: stopping them, opening a debugger inside them, changing their priority;
    (2) diagnostics that write files on their own: trace logs, and a heap snapshot taken when memory runs out;
    (3) turning text into code: vm compiles text whatever --disallow-code-generation-from-strings says, and V8's
        flags can switch that lock off.
    Ported from Kinetic Markdown's security/sandbox-gaps-guard.mjs, same logic, with this project's refusal tag.
--------------------------------------- */

import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import traceEvents from 'node:trace_events';
import v8 from 'node:v8';
import vm from 'node:vm';
import { type AnyFunction, sealEveryFunction, sealFunctions } from './seal.ts';

export const SANDBOX_GAP_TAG = 'embedder sandbox: blocked by the sandbox guard';

/* -- Refuses the way Node's own sandbox does (ERR_ACCESS_DENIED), so callers handle both alike -- */
function refuse(name: string): AnyFunction {
  return function blocked(): never {
    process.stderr.write(`${SANDBOX_GAP_TAG} (${name})\n`);
    throw Object.assign(new Error(`${SANDBOX_GAP_TAG} (${name})`), { code: 'ERR_ACCESS_DENIED' });
  };
}

/* -- (1) Other programs -- */
sealFunctions(process, ['kill', '_kill', '_debugProcess'], 'process', refuse);
sealFunctions(os, ['setPriority'], 'os', refuse);

/* -- (2) Files written by diagnostics, past the sandbox's write check -- */
sealEveryFunction(traceEvents, 'trace_events', refuse);
sealFunctions(v8, ['setHeapSnapshotNearHeapLimit'], 'v8', refuse);

/* -- (3) Code from text -- */
sealEveryFunction(vm, 'vm', refuse);
sealFunctions(v8, ['setFlagsFromString'], 'v8', refuse);

syncBuiltinESMExports();
