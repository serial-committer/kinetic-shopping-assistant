/* ---------------------------------------
    The cleaning rules on small hand-made records: brand chain, color families, size groups, gender, group key.
--------------------------------------- */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandSpellings, normaliseBrand, pickBrand } from '../server/catalog/brand-rules.ts';
import { cleanValue } from '../server/catalog/clean-value.ts';
import { colorFamilyOf } from '../server/catalog/color-rules.ts';
import { genderOf } from '../server/catalog/gender-rules.ts';
import type { RawRecord } from '../server/catalog/product-types.ts';
import { groupKeyOf } from '../server/catalog/record-text.ts';
import { shopperSizeGroupOf, sizeGroupOf } from '../server/catalog/size-rules.ts';

const record = (fields: Partial<RawRecord>): RawRecord => ({ parent_asin: 'TEST', ...fields });

test('junk values count as missing', () => {
  for (const junk of ['nan', 'None', ' unknown ', 'N/A', 'Generic', '', undefined, 42, '\\', '/', '...', '⭐']) assert.equal(cleanValue(junk), '');
  assert.equal(cleanValue('9.5'), '9.5');
  assert.equal(cleanValue('  Nike '), 'Nike');
});

test('brand falls back from brand to details to store', () => {
  assert.equal(pickBrand(record({ brand: 'Nike', store: 'Shop' })), 'Nike');
  assert.equal(pickBrand(record({ brand: 'nan', details: { 'Brand Name': 'Merrell' }, store: 'Shop' })), 'Merrell');
  assert.equal(pickBrand(record({ details: { Brand: 'Columbia' }, store: 'Shop' })), 'Columbia');
  assert.equal(pickBrand(record({ brand: 'Unbranded', store: 'Shop' })), 'Shop');
  assert.equal(pickBrand(record({})), '');
});

test('brand names compare lowercase with single spaces, with and without "the"', () => {
  assert.equal(normaliseBrand('  The   North Face '), 'the north face');
  assert.deepEqual(brandSpellings('North Face'), ['north face', 'the north face']);
  assert.deepEqual(brandSpellings('The North Face'), ['the north face', 'north face']);
});

test('colors map to the first matching family', () => {
  assert.equal(colorFamilyOf('Navy Blue'), 'blue');
  assert.equal(colorFamilyOf('Rose Gold'), 'pink');
  assert.equal(colorFamilyOf('Charcoal Heather'), 'grey');
  assert.equal(colorFamilyOf('Tan'), 'brown');
  assert.equal(colorFamilyOf('Tangerine'), 'orange');
  assert.equal(colorFamilyOf('Style 4'), null);
  assert.equal(colorFamilyOf('nan'), null);
});

test('sizes fold into exact groups', () => {
  const cases: Array<[string, string | null]> = [
    ['Small', 'S'], ['s', 'S'], ['Medium', 'M'], ['X-Large', 'XL'], ['XL', 'XL'], ['xx-large', 'XXL'], ['2x-large', 'XXL'],
    ['3XL', 'XXXL'], ['4XL', '4XL'], ['X-Small', 'XS'], ['9.5', '9.5'], ['9.5 Wide', '9.5'], ['10 M US', '10'],
    ['One Size', 'ONE SIZE'], ['one-size', 'ONE SIZE'], ['32W x 30L', null], ['nan', null],
  ];
  for (const [raw, group] of cases) assert.equal(sizeGroupOf(raw), group, raw);
});

test('a shopper size goes through the same rules', () => {
  assert.equal(shopperSizeGroupOf('small'), 'S');
  assert.equal(shopperSizeGroupOf('size 9.5'), '9.5');
  assert.equal(shopperSizeGroupOf('XL'), 'XL');
});

test('gender comes from the category path, then department, then title', () => {
  assert.equal(genderOf(record({ categories: ['Clothing, Shoes & Jewelry', 'Women', 'Shoes'] })), 'women');
  assert.equal(genderOf(record({ categories: ['Clothing, Shoes & Jewelry', 'Men'], title: "Women's boot" })), 'men');
  assert.equal(genderOf(record({ department: 'nan', title: "Unisex running cap" })), 'unisex');
  assert.equal(genderOf(record({ department: 'Boys', title: 'Cap' })), 'boys');
  assert.equal(genderOf(record({ title: 'Leather belt' })), 'unknown');
});

test('the card group key is store plus exact title, lowercased', () => {
  assert.equal(groupKeyOf(record({ store: 'VIIOO', title: " Men's Shorts " })), "viioo|men's shorts");
  assert.notEqual(groupKeyOf(record({ store: 'VIIOO', title: "Men's Shorts" })), groupKeyOf(record({ store: 'VIIOO', title: "Men's Shorts, Blue" })));
});
