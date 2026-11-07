/* ---------------------------------------
    The same-model rule: the server must refuse vectors whose manifest doesn't match the files on disk.
    Uses the real model file and data/products.json, so it needs the built data.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readManifest } from '../server/data/data-service.ts';
import { findManifestMismatches } from '../server/embedder/vector-manifest.ts';

const manifest = readManifest();
const matching = { rows: manifest.rows, dimension: manifest.dimension, vectorCount: manifest.rows * manifest.dimension };

test('the built manifest matches the model file and products.json', async () => {
  assert.deepEqual(await findManifestMismatches(manifest, matching), []);
});

test('a changed products.json, a changed model, or a wrong size are each refused', async () => {
  const problems = await findManifestMismatches({ ...manifest, productsSha256: '0'.repeat(64), modelSha256: '1'.repeat(64) }, { ...matching, rows: matching.rows - 1 });
  assert.equal(problems.length, 4);
  assert.match(problems.join(' | '), /model file/);
  assert.match(problems.join(' | '), /products\.json changed/);
});
