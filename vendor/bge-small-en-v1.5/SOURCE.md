# bge-small-en-v1.5 (quantized ONNX)

The embedding model. It turns a piece of text into 384 numbers so products can be compared by meaning.

## Where it came from

- **Repository:** `huggingface.co/Xenova/bge-small-en-v1.5`, an ONNX export of `BAAI/bge-small-en-v1.5` (MIT license).
- **Pinned commit:** `ea104dacec62c0de699686887e3f920caeb4f3e3`
- **Downloaded:** 2026-11-07, five named files only. Each one matched the hash Hugging Face publishes for it. `tokenizer.json` was used only to check our own tokenizer and isn't kept here.

| File | Bytes | SHA-256 |
|---|---|---|
| `onnx/model_quantized.onnx` | 34,014,426 | `6c9c6101a956d62dfb5e7190c538226c0c5bb9cb27b651234b6df063ee7dbfe4` |
| `vocab.txt` | 231,508 | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |
| `config.json` | 683 | `fa73f90bf92c8cace1fbcb709626306f2bdbc9ea3e5b5f94b440df9b6aa56350` |
| `tokenizer_config.json` | 366 | `9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3` |

## How to use it

- **Output:** 384 numbers per text. Keep the first row of `last_hidden_state` (the CLS token), then scale it to length 1.
- **Shopper sentences only:** put `Represent this sentence for searching relevant passages: ` in front. Product texts get no prefix.
- **Length:** at most 512 tokens, which is roughly 1,800 characters.
- **Same-model rule:** product vectors and shopper vectors must both come from this exact file. If the file changes, rebuild the vector file.
