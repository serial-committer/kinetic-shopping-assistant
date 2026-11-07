/* ---------------------------------------
    Installs the project's packages. Usage: npm run deps
    With SHARED_NODE_MODULES set in .env, packages go into that shared folder and node_modules becomes a junction
    (a folder shortcut) to it, so several copies of the project share one install. Without it, this is a plain npm ci.
    Install scripts are always off (.npmrc), and every version is pinned in package-lock.json.
    When there is no lock file yet, every package (including the ones underneath) resolves to a release at least two
    weeks old, so a freshly published bad release can't slip in.
    In shared mode never run plain `npm install` in the project: npm replaces a junctioned node_modules with a real folder.
--------------------------------------- */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getConfig } from '../server/config/config.ts';
import { PROJECT_ROOT } from '../server/data/project-paths.ts';
import { printLine } from '../server/logging/logger.ts';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const LOCK = 'package-lock.json';
const MINIMUM_RELEASE_AGE_DAYS = 14;
const shared = getConfig().sharedNodeModules;

if (shared) installIntoSharedFolder(resolve(shared));
else installHere();

function installHere(): void {
  printLine(`Installing into ${join(PROJECT_ROOT, 'node_modules')}`);
  runNpm(existsSync(join(PROJECT_ROOT, LOCK)) ? 'ci' : 'install', PROJECT_ROOT);
}

function installIntoSharedFolder(sharedFolder: string): void {
  const link = join(PROJECT_ROOT, 'node_modules');
  const sharedModules = join(sharedFolder, 'node_modules');
  if (existsSync(link) && !isLink(link)) {
    printLine('node_modules is a real folder (plain npm install was run). Move it away, then run npm run deps again.');
    process.exit(1);
  }

  mkdirSync(sharedFolder, { recursive: true });
  for (const file of ['package.json', '.npmrc']) copyFileSync(join(PROJECT_ROOT, file), join(sharedFolder, file));
  const hasLock = existsSync(join(PROJECT_ROOT, LOCK));
  if (hasLock) copyFileSync(join(PROJECT_ROOT, LOCK), join(sharedFolder, LOCK));

  printLine(`Installing into ${sharedFolder}`);
  runNpm(hasLock ? 'ci' : 'install', sharedFolder);
  if (!hasLock) copyFileSync(join(sharedFolder, LOCK), join(PROJECT_ROOT, LOCK));

  if (isLink(link)) {
    if (resolve(readlinkSync(link)) === resolve(sharedModules)) {
      printLine('node_modules already points at the shared folder');
      return;
    }
    rmSync(link);
  }
  symlinkSync(sharedModules, link, 'junction');
  printLine(`node_modules -> ${sharedModules}`);
}

/* ---------------------------------------
    npm is called by name, so the shell needs no quoting; the folder with its spaces goes in as cwd.
    ci installs exactly what the lock lists, so it may use the local cache. A fresh install asks the registry for
    publish dates (cached package data may lack them), and --before keeps every version older than two weeks.
--------------------------------------- */
function runNpm(command: 'ci' | 'install', folder: string): void {
  const cutoff = new Date(Date.now() - MINIMUM_RELEASE_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const options = command === 'ci' ? ['--prefer-offline'] : ['--prefer-online', `--before=${cutoff}`];
  execFileSync(npm, [command, ...options], { cwd: folder, stdio: 'inherit', shell: process.platform === 'win32' });
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
