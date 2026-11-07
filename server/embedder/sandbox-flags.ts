/* ---------------------------------------
    The flags that seal the embedder child, in one place. The server and the embed tool both start it with these.
    - --permission turns on Node's sandbox: no file access unless granted, no child processes, no worker threads,
      no native code.
    - Read grants: the child's own folder (its code and the guards) and the two vendor folders. No write grants.
    - --disallow-code-generation-from-strings stops eval and new Function; --no-experimental-sqlite removes
      node:sqlite, which writes files without asking the sandbox.
    - --import loads the three guards before any of the child's own code (network, sandbox gaps, listening).
--------------------------------------- */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PATHS } from '../data/project-paths.ts';

const GUARD_FILES = Object.freeze(['network-guard.ts', 'sandbox-gaps-guard.ts', 'listen-guard.ts']);

export const EMBEDDER_CHILD_SCRIPT = join(PATHS.embedderChildFolder, 'embedder-child.ts');

/* -- extraReads is for tests only: the escape probe needs its own folder readable to run inside the same sandbox -- */
export function embedderSandboxFlags(extraReads: readonly string[] = []): string[] {
  const reads = [PATHS.embedderChildFolder, PATHS.engineFolder, PATHS.modelFolder, ...extraReads];
  return [
    '--permission',
    '--disallow-code-generation-from-strings',
    '--no-experimental-sqlite',
    ...reads.map((folder) => `--allow-fs-read=${folder}`),
    ...GUARD_FILES.map((file) => `--import=${pathToFileURL(join(PATHS.embedderChildFolder, 'guards', file)).href}`),
  ];
}

/* -- The two folders the child is told about, in the order its arguments expect -- */
export function embedderChildArguments(): string[] {
  return [PATHS.engineFolder, PATHS.modelFolder];
}
