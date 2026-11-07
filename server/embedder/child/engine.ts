/* ---------------------------------------
    Runs bge-small on Microsoft's ONNX Runtime (WebAssembly build): one thread, no helper worker,
    and the .wasm handed over as bytes. Each text becomes 384 numbers scaled to length 1, so comparing two texts
    is a plain dot product. Shopper sentences get the query prefix the model was trained with; product text doesn't.
--------------------------------------- */

import { createEncoder } from './tokenizer.ts';
import { engineModuleUrl, readEngineWasm, readModelBytes, readModelDimension, readVocabText, type VendorFolders } from './vendor-files.ts';

const BATCH_SIZE = 16;
export const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

/* -- The small part of the engine's API this file uses -- */
type OrtTensor = { data: Float32Array };
type OrtSession = { run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>; release(): Promise<void> };
type OrtModule = {
  env: { wasm: { numThreads: number; proxy: boolean; wasmBinary: Uint8Array } };
  Tensor: new (type: 'int64', data: BigInt64Array, dims: number[]) => unknown;
  InferenceSession: { create(model: Uint8Array, options: { executionProviders: string[] }): Promise<OrtSession> };
};

export type Engine = Readonly<{
  dimension: number;
  /* -- One flat array: row i is result[i * dimension ... (i + 1) * dimension] -- */
  embed(texts: readonly string[]): Promise<Float32Array>;
  embedQuery(text: string): Promise<Float32Array>;
  close(): Promise<void>;
}>;

export async function startEngine(folders: VendorFolders): Promise<Engine> {
  const dimension = readModelDimension(folders);
  const ort = (await import(engineModuleUrl(folders))) as OrtModule;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmBinary = readEngineWasm(folders);
  const session = await ort.InferenceSession.create(readModelBytes(folders), { executionProviders: ['wasm'] });
  const encode = createEncoder(readVocabText(folders));

  /* -- Pads every row to the longest one, runs the model, then keeps the first (CLS) row of each text scaled to length 1 -- */
  const runBatch = async (batch: readonly number[][]): Promise<Float32Array[]> => {
    const width = Math.max(...batch.map((ids) => ids.length));
    const count = batch.length;
    const inputIds = new BigInt64Array(count * width);
    const attention = new BigInt64Array(count * width);
    batch.forEach((ids, row) => ids.forEach((id, column) => {
      inputIds[row * width + column] = BigInt(id);
      attention[row * width + column] = 1n;
    }));
    const dims = [count, width];
    const output = await session.run({
      input_ids: new ort.Tensor('int64', inputIds, dims),
      attention_mask: new ort.Tensor('int64', attention, dims),
      token_type_ids: new ort.Tensor('int64', new BigInt64Array(count * width), dims),
    });
    const hidden = output['last_hidden_state']!.data;
    const vectors: Float32Array[] = [];
    for (let row = 0; row < count; row += 1) {
      const cls = hidden.subarray(row * width * dimension, row * width * dimension + dimension);
      const length = Math.hypot(...cls);
      vectors.push(Float32Array.from(cls, (value) => value / length));
    }
    return vectors;
  };

  /* -- Texts of similar length share a batch, because every row is padded to the longest one -- */
  const embed = async (texts: readonly string[]): Promise<Float32Array> => {
    const encoded = texts.map((text, index) => ({ index, ids: encode(text) })).sort((a, b) => a.ids.length - b.ids.length);
    const result = new Float32Array(texts.length * dimension);
    for (let start = 0; start < encoded.length; start += BATCH_SIZE) {
      const group = encoded.slice(start, start + BATCH_SIZE);
      const vectors = await runBatch(group.map((item) => item.ids));
      group.forEach((item, position) => result.set(vectors[position]!, item.index * dimension));
    }
    return result;
  };

  return Object.freeze({
    dimension,
    embed,
    embedQuery: (text: string) => embed([`${QUERY_PREFIX}${text}`]),
    close: () => session.release(),
  });
}
