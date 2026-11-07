/* ---------------------------------------
    The child's only file reads. Its sandbox lets it read just the two vendor folders (and its own code),
    so the server's data service is out of reach on purpose. The parent hands both folder paths in as arguments.
--------------------------------------- */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type VendorFolders = Readonly<{ engineFolder: string; modelFolder: string }>;

const engineDist = (folders: VendorFolders): string => join(folders.engineFolder, 'node_modules', 'onnxruntime-web', 'dist');

/* -- The engine's JavaScript entry, imported by URL. It imports onnxruntime-common by name from the same folder -- */
export function engineModuleUrl(folders: VendorFolders): string {
  return pathToFileURL(join(engineDist(folders), 'ort.node.min.mjs')).href;
}

/* -- The engine's WebAssembly, read here and handed over as bytes, so the engine never looks for files itself -- */
export function readEngineWasm(folders: VendorFolders): Uint8Array {
  return readFileSync(join(engineDist(folders), 'ort-wasm-simd-threaded.wasm'));
}

export function readModelBytes(folders: VendorFolders): Uint8Array {
  return readFileSync(join(folders.modelFolder, 'onnx', 'model_quantized.onnx'));
}

/* -- 384 for bge-small: how many numbers each text becomes -- */
export function readModelDimension(folders: VendorFolders): number {
  return (JSON.parse(readFileSync(join(folders.modelFolder, 'config.json'), 'utf8')) as { hidden_size: number }).hidden_size;
}

export function readVocabText(folders: VendorFolders): string {
  return readFileSync(join(folders.modelFolder, 'vocab.txt'), 'utf8');
}
