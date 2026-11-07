/* ---------------------------------------
    The same-model rule: shopper vectors and product vectors must come from the same model file, and product
    vectors must belong to this exact products.json. The embed tool writes a manifest with both fingerprints;
    the server checks them at start and refuses the vectors on any mismatch.
--------------------------------------- */

import { type VectorManifest, sha256OfFile } from '../data/data-service.ts';
import { dataFilesIn, PATHS } from '../data/project-paths.ts';

export const MODEL_NAME = 'bge-small-en-v1.5 (quantized ONNX)';

export async function buildManifest(rows: number, dimension: number, dataFolder: string = PATHS.dataFolder): Promise<VectorManifest> {
  return {
    model: MODEL_NAME,
    modelSha256: await sha256OfFile(PATHS.modelFile),
    productsSha256: await sha256OfFile(dataFilesIn(dataFolder).products),
    rows,
    dimension,
    builtAt: new Date().toISOString(),
  };
}

/* -- Every reason the vectors can't be trusted; an empty list means they match -- */
export async function findManifestMismatches(manifest: VectorManifest, expected: { rows: number; dimension: number; vectorCount: number }): Promise<string[]> {
  const problems: string[] = [];
  if (manifest.modelSha256 !== (await sha256OfFile(PATHS.modelFile))) problems.push('the model file is not the one the vectors were built with');
  if (manifest.productsSha256 !== (await sha256OfFile(dataFilesIn().products))) problems.push('products.json changed since the vectors were built');
  if (manifest.rows !== expected.rows) problems.push(`the manifest has ${manifest.rows} rows, products.json has ${expected.rows}`);
  if (manifest.dimension !== expected.dimension) problems.push(`the manifest says ${manifest.dimension} numbers per row, the model makes ${expected.dimension}`);
  if (expected.vectorCount !== expected.rows * expected.dimension) problems.push(`vectors.bin holds ${expected.vectorCount} numbers, expected ${expected.rows * expected.dimension}`);
  return problems;
}
