# ONNX Runtime Web 1.30.0

Microsoft's engine that runs the bge-small model. We use its WebAssembly build, not the native `onnxruntime-node` package. The native one carries telemetry and loads extra DLLs.

## Where it came from

- **Packages:** `onnxruntime-web` 1.30.0 and `onnxruntime-common` 1.30.0, both MIT, both by Microsoft.
- **Copied from:** the copy used by Kinetic Markdown's OCR engine.
- **Why the `node_modules` folder:** `ort.node.min.mjs` imports `onnxruntime-common` by name, so the folder layout has to stay as it is. The project's `.gitignore` must not hide `vendor/**/node_modules`.

Only three files from `onnxruntime-web` are needed:

| File | Bytes | SHA-256 |
|---|---|---|
| `dist/ort.node.min.mjs` | 27,061 | `f41b1e1ccf89e7b630c2a822192d6cf48d642b1abe3c321f1ad6b4130a78327e` |
| `dist/ort-wasm-simd-threaded.mjs` | 24,381 | `e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b` |
| `dist/ort-wasm-simd-threaded.wasm` | 14,239,897 | `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2` |

## Settings that keep it sealed

- `env.wasm.numThreads = 1`, so it starts no worker threads.
- `env.wasm.proxy = false`, so it starts no helper worker.
- `env.wasm.wasmBinary` is the `.wasm` file read by our code and handed over as bytes, so the engine never looks for files on its own.

It ran 20 of 20 escape probes blocked under Node's permission model, with 0 sockets seen from outside. The probes run as a test: `tests/embedder-sandbox.test.ts` (`npm test`).
