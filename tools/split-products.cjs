#!/usr/bin/env node
'use strict';

const { createReadStream } = require('node:fs');
const { mkdir, writeFile, appendFile, unlink } = require('node:fs/promises');
const path = require('node:path');

// Read a top-level JSON array without loading the entire file into memory.
async function* readProducts(inputPath) {
  let state = 'start';
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let firstChunk = true;
  let parts = [];
  let count = 0;

  for await (let chunk of createReadStream(inputPath, { encoding: 'utf8' })) {
    if (firstChunk) chunk = chunk.replace(/^\uFEFF/, '');
    firstChunk = false;
    let start = depth ? 0 : -1;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      if (depth) {
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === '{') depth++;
        else if (char === '}') depth--;

        if (!depth) {
          parts.push(chunk.slice(start, i + 1));
          const raw = parts.join('');
          parts = [];
          start = -1;
          state = 'separator';
          let product;
          try {
            product = JSON.parse(raw);
          } catch (error) {
            throw new Error(`Invalid product ${count + 1}: ${error.message}`);
          }
          count++;
          yield { product, raw };
        }
        continue;
      }

      if (/[ \t\r\n]/.test(char)) continue;
      if (state === 'start' && char === '[') {
        state = 'first';
      } else if ((state === 'first' || state === 'separator') && char === ']') {
        state = 'done';
      } else if (state === 'separator' && char === ',') {
        state = 'value';
      } else if ((state === 'first' || state === 'value') && char === '{') {
        depth = 1;
        start = i;
      } else {
        throw new Error(`Unexpected ${JSON.stringify(char)} after ${count} products. Expected a JSON array of objects.`);
      }
    }
    if (depth) parts.push(chunk.slice(start));
  }

  if (state !== 'done' || depth) {
    throw new Error('Incomplete JSON array. Check the closing braces and final ].');
  }
}

function safeName(category) {
  let name = category.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  const letters = Array.from(name).slice(0, 100);
  while (Buffer.byteLength(letters.join(''), 'utf8') > 180) letters.pop();
  name = letters.join('').replace(/[. ]+$/, '') || 'Category';
  // Windows device names are reserved even when followed by a file extension.
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) name = `_${name}`;
  return name;
}

async function splitProducts(inputPath, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const categories = new Map();
  const usedNames = new Set(['general_products.json']);
  let bufferedChars = 0;
  let total = 0;

  async function flush(file) {
    if (!file.pending) return;
    await appendFile(file.path, file.pending, 'utf8');
    bufferedChars -= file.pending.length;
    file.pending = '';
  }

  try {
    for await (const { product, raw } of readProducts(inputPath)) {
      const value = product.main_category;
      if (value != null && typeof value !== 'string') {
        throw new Error(`Product ${total + 1}: main_category must be a string or null.`);
      }
      const category = value?.trim() || 'General';
      let file = categories.get(category);

      if (!file) {
        const base = safeName(category);
        let name = `${base}_Products.json`;
        if (category !== 'General') {
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) name = `${base}_${suffix++}_Products.json`;
        }
        usedNames.add(name.toLowerCase());
        const outputPath = path.join(outputDir, name);
        // Never overwrite the input or an existing output file.
        await writeFile(outputPath, '[\n', { encoding: 'utf8', flag: 'wx' });
        file = { path: outputPath, name, count: 0, pending: '' };
        categories.set(category, file);
      }

      // Keep the original object text, including numeric precision and all fields.
      const text = `${file.count ? ',\n' : ''}${raw}`;
      file.pending += text;
      bufferedChars += text.length;
      file.count++;
      total++;

      // Batch disk writes, bound buffered output, and keep no file handles open.
      if (file.pending.length >= 64 * 1024) await flush(file);
      if (bufferedChars >= 1024 * 1024) {
        for (const entry of categories.values()) await flush(entry);
      }
    }

    for (const file of categories.values()) {
      await flush(file);
      await appendFile(file.path, '\n]\n', 'utf8');
    }
  } catch (error) {
    // Remove only files created by this run; leave existing files untouched.
    for (const file of categories.values()) {
      try { await unlink(file.path); }
      catch (cleanupError) { console.error(`Could not remove ${file.path}: ${cleanupError.message}`); }
    }
    throw error;
  }

  return { total, files: [...categories.values()].map(({ name, count }) => ({ name, count })) };
}

if (require.main === module) {
  const [inputPath, outputDir = 'category-products', ...extra] = process.argv.slice(2);
  if (!inputPath || extra.length || inputPath === '--help') {
    console.log('Usage: node split-products.cjs <input.json> [output-directory]');
    process.exitCode = inputPath === '--help' ? 0 : 1;
  } else {
    splitProducts(path.resolve(inputPath), path.resolve(outputDir))
      .then(({ total, files }) => {
        for (const file of files) console.log(`${file.name}: ${file.count} products`);
        console.log(`Done: ${total} products in ${files.length} files. Output: ${path.resolve(outputDir)}`);
      })
      .catch((error) => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
      });
  }
}

module.exports = { splitProducts };
