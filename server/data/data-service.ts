/* ---------------------------------------
    The one place that reads and writes files. Every other module asks here instead of calling node:fs.
    It only moves bytes: it never logs and never decides what a missing file means. Callers do that.
    The sealed embedder is the one exception: it runs in its own process and reads only its two vendor folders.
--------------------------------------- */

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BrandSheets, Product, RawRecord } from '../catalog/product-types.ts';
import { dataFilesIn, PATHS } from './project-paths.ts';

/* -- What the embed tool records next to the vectors, so the server can refuse vectors that don't match -- */
export type VectorManifest = {
  model: string;
  modelSha256: string;
  productsSha256: string;
  rows: number;
  dimension: number;
  builtAt: string;
};

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function readEnvFileText(): string | null {
  return existsSync(PATHS.envFile) ? readFileSync(PATHS.envFile, 'utf8') : null;
}

/* -- The raw catalog: one JSON array of about 157 MB, parsed in about a second -- */
export function readRawCatalog(path: string = PATHS.rawCatalog): RawRecord[] {
  return JSON.parse(readFileSync(path, 'utf8')) as RawRecord[];
}

export function readProducts(folder?: string): Product[] {
  return readJson<Product[]>(dataFilesIn(folder).products);
}

/* -- One record per line inside the array: still one JSON file, but readable and diff-friendly -- */
export function writeProducts(products: readonly Product[], folder?: string): void {
  writeTextAtomically(dataFilesIn(folder).products, `[\n${products.map((product) => JSON.stringify(product)).join(',\n')}\n]\n`);
}

export function readBrandSheets(folder?: string): BrandSheets {
  return readJson<BrandSheets>(dataFilesIn(folder).brands);
}

export function writeBrandSheets(sheets: BrandSheets, folder?: string): void {
  writeTextAtomically(dataFilesIn(folder).brands, `${JSON.stringify(sheets)}\n`);
}

/* -- The vectors file is raw float32 numbers, row after row, with no header -- */
export function readVectors(folder?: string): Float32Array {
  const bytes = readFileSync(dataFilesIn(folder).vectors);
  /* -- A float view needs an offset divisible by 4; small files can come back inside a shared, unaligned buffer -- */
  const aligned = bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0 ? bytes : new Uint8Array(bytes);
  return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

export function writeVectors(vectors: Float32Array, folder?: string): void {
  writeBytesAtomically(dataFilesIn(folder).vectors, new Uint8Array(vectors.buffer, vectors.byteOffset, vectors.byteLength));
}

/* -- How many numbers the model makes per text, from its config.json (384 for bge-small) -- */
export function readModelDimension(): number {
  return readJson<{ hidden_size: number }>(join(PATHS.modelFolder, 'config.json')).hidden_size;
}

export function readManifest(folder?: string): VectorManifest {
  return readJson<VectorManifest>(dataFilesIn(folder).manifest);
}

export function writeManifest(manifest: VectorManifest, folder?: string): void {
  writeTextAtomically(dataFilesIn(folder).manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

/* -- Streams the file, so hashing the 63 MB products file never holds a second copy in memory -- */
export function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', rejectHash)
      .on('end', () => resolveHash(hash.digest('hex')));
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/* -- Writes next to the target, then renames, so a crash mid-write never leaves half a file behind -- */
function writeTextAtomically(path: string, text: string): void {
  writeBytesAtomically(path, Buffer.from(text, 'utf8'));
}

function writeBytesAtomically(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.partial`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, path);
}
