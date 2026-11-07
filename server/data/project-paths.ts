/* ---------------------------------------
    Every file and folder the app knows about, in one place.
    Paths are absolute, built from the project root, so the app works from any working directory.
--------------------------------------- */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PATHS = Object.freeze({
  envFile: join(PROJECT_ROOT, '.env'),
  rawCatalog: join(PROJECT_ROOT, 'catalog', 'products.json'),
  dataFolder: join(PROJECT_ROOT, 'data'),
  modelFolder: join(PROJECT_ROOT, 'vendor', 'bge-small-en-v1.5'),
  modelFile: join(PROJECT_ROOT, 'vendor', 'bge-small-en-v1.5', 'onnx', 'model_quantized.onnx'),
  engineFolder: join(PROJECT_ROOT, 'vendor', 'onnxruntime'),
  embedderChildFolder: join(PROJECT_ROOT, 'server', 'embedder', 'child'),
  webBuildFolder: join(PROJECT_ROOT, 'web', 'dist'),
});

export type DataFiles = Readonly<{ products: string; brands: string; vectors: string; manifest: string }>;

/* -- The four built files. A different folder is used for sample builds, so they never overwrite the real ones. -- */
export function dataFilesIn(folder: string = PATHS.dataFolder): DataFiles {
  return Object.freeze({
    products: join(folder, 'products.json'),
    brands: join(folder, 'brands.json'),
    vectors: join(folder, 'vectors.bin'),
    manifest: join(folder, 'manifest.json'),
  });
}
