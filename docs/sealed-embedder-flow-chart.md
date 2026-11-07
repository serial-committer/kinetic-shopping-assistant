# Sealed embedder: flow chart

**In one line:** the code that turns text into 384 numbers runs in its own Node process, locked in a sandbox that lets it read two folders and nothing else.

Think of a bank's counting room. The counter sits behind glass. Paper goes in through a slot, totals come back through the slot, and the counter has no phone, no door to the street and no pen that writes on the bank's records. If anything inside tried to make a call, an alarm notes it and the line is dead anyway. The slot is IPC (inter-process communication, messages between two processes), the glass is Node's permission sandbox, and the dead phone line is the guards.

```text
Fig A: who talks to whom

  SERVER or EMBED TOOL (not sealed: the server needs the network for Claude and OpenAI)
     |
     |  Point 1  startEmbedderProcess()           server/embedder/embedder-process.ts
     |           spawn(process.execPath, [flags..., embedder-child.ts, engine folder, model folder])
     |           no shell, env: {}, stdio: stderr piped + IPC channel
     v
  +--------------------------- SANDBOX (Point 2: server/embedder/sandbox-flags.ts) ----------------------+
  |  --permission                         nothing is allowed unless granted                             |
  |  --allow-fs-read  child folder, vendor/onnxruntime, vendor/bge-small-en-v1.5   (no write grants)    |
  |  --disallow-code-generation-from-strings   no eval, no new Function                                 |
  |  --no-experimental-sqlite             node:sqlite would write files without asking                  |
  |  --import guards/network-guard.ts     fetch, http, net, tls, UDP, DNS: all refuse                   |
  |  --import guards/sandbox-gaps-guard.ts  process.kill, vm, v8 flags, trace files: all refuse         |
  |  --import guards/listen-guard.ts      no listening for connections                                  |
  |                                                                                                     |
  |  Point 3  sandbox-check.ts     asks Node what it really grants; any problem -> refuse to start      |
  |  Point 4  engine.ts            ONNX Runtime WebAssembly, 1 thread, .wasm handed over as bytes       |
  |           tokenizer.ts         our 90-line BERT tokenizer                                           |
  |           vendor-files.ts      the child's only file reads                                          |
  |  Point 5  embedder-child.ts    sends "ready", then answers embed requests one at a time             |
  +-----------------------------------------------------------------------------------------------------+
     ^                                         |
     |  { kind: 'embed', texts, purpose }      |  { kind: 'vectors', vectors: Float32Array }
     +-----------------------------------------+  { kind: 'log', ... }  -> server logger, tagged [embedder]
```

## Example: one shopper sentence

```text
Fig B: "orange running shorts in size small"

Point 1  server  -> child   { kind: 'embed', requestId: 7, purpose: 'query', texts: ['orange running shorts in size small'] }
Point 2  child             adds the query prefix: "Represent this sentence for searching relevant passages: orange ..."
Point 3  child             tokenizer: [CLS] represent this sentence ... orange running shorts in size small [SEP]
Point 4  child             engine: keeps the first (CLS) row of the output, scales it to length 1
Point 5  child  -> server  { kind: 'vectors', requestId: 7, vectors: Float32Array(384), tookMs: 11 }
```

Product texts get no prefix. That is how bge-small was trained: questions and documents are written differently.

## Lifecycle: no stray processes

```text
Fig C: how the child ends

normal stop     parent calls close()  -> disconnects IPC -> child sees 'disconnect' -> exits 0
slow stop       still running 3 s later -> parent kills it
parent crashes  the operating system closes the IPC channel -> child sees 'disconnect' -> exits
child crashes   every waiting request is rejected with "the embedder stopped"
```

## The build tool: 8 children at once

`npm run embed-catalog` starts 8 of these children (one thread each). It sorts all products by text length, cuts them into requests of 64, and each child takes the next request as soon as it is free. Similar lengths share a request, because every text in a batch is padded to the longest one. The parent puts each answer at its row number, then writes `data/vectors.bin` and `data/manifest.json`.

## How it is proven

`tests/embedder-sandbox.test.ts`:

1. Starts a TCP and a UDP listener on 127.0.0.1.
2. Runs `tests/sandbox/escape-probe.ts` inside the same sandbox. It tries 20 escapes: fetch, http, raw sockets, UDP, DNS, listening, starting a program, a worker thread, native code, reading a file it wasn't given, listing the home folder, writing anywhere, eval, new Function, vm, reaching another process, node:sqlite.
3. Expects 20 of 20 refused, both listeners silent, and no file written.
4. Starts the real child, embeds a sentence (under 100 ms, length-1 vector), closes it and checks the process is gone.

## Where to change things

| To change | Edit |
|---|---|
| What the child may read | `server/embedder/sandbox-flags.ts` |
| Batch size, query prefix | `server/embedder/child/engine.ts` |
| Message shapes | `server/embedder/embedder-messages.ts` |
| Number of build processes, request size | `tools/embed-catalog.ts` (`--processes=`, `ROWS_PER_REQUEST`) |
| What makes vectors trusted | `server/embedder/vector-manifest.ts` |
