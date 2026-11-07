/* ---------------------------------------
    The embedder service's crash policy, with fake child processes: restart once, then words only.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EmbedderExit, EmbedderProcess } from '../server/embedder/embedder-process.ts';
import { createEmbedderService } from '../server/embedder/embedder-service.ts';

type FakeChild = EmbedderProcess & { crash(): void };

function fakeChild(options: { dimension?: number; failToStart?: boolean } = {}): FakeChild {
  let finish: (exit: EmbedderExit) => void = () => undefined;
  const exited = new Promise<EmbedderExit>((resolve) => { finish = resolve; });
  return {
    pid: 1,
    ready: options.failToStart ? Promise.reject(new Error('model missing')) : Promise.resolve({ dimension: options.dimension ?? 384, loadMs: 1 }),
    exited,
    embed: async () => new Float32Array(384),
    close: async () => finish({ code: 0, signal: null, requested: true }),
    crash: () => finish({ code: 1, signal: null, requested: false }),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test('a crash restarts the embedder once; a second crash leaves it off', async () => {
  const children: FakeChild[] = [];
  const service = createEmbedderService({ expectedDimension: 384, startProcess: () => { const child = fakeChild(); children.push(child); return child; } });
  await service.start();
  assert.equal(service.state(), 'ready');
  assert.ok(await service.embedQuery('boots'));

  children[0]!.crash();
  await settle();
  assert.equal(children.length, 2);
  assert.equal(service.state(), 'ready');

  children[1]!.crash();
  await settle();
  assert.equal(children.length, 2, 'no third start');
  assert.equal(service.state(), 'off');
  assert.equal(await service.embedQuery('boots'), null);
});

test('a child that cannot start, or makes the wrong vector size, is not retried', async () => {
  for (const child of [fakeChild({ failToStart: true }), fakeChild({ dimension: 768 })]) {
    let starts = 0;
    const service = createEmbedderService({ expectedDimension: 384, startProcess: () => { starts += 1; return child; } });
    await service.start();
    assert.equal(service.state(), 'off');
    assert.equal(starts, 1);
  }
});

test('closing the service does not count as a crash', async () => {
  let starts = 0;
  const service = createEmbedderService({ expectedDimension: 384, startProcess: () => { starts += 1; return fakeChild(); } });
  await service.start();
  await service.close();
  await settle();
  assert.equal(starts, 1);
  assert.equal(service.state(), 'off');
});
