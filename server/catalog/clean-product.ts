/* ---------------------------------------
    Point 1: turns one raw catalog record into the trimmed record the app keeps.
    Nothing is invented: a missing value stays empty or null, and the raw color and size text are kept as written.
--------------------------------------- */

import { pickBrand } from './brand-rules.ts';
import { cleanValue } from './clean-value.ts';
import { colorFamilyOf } from './color-rules.ts';
import { genderOf } from './gender-rules.ts';
import type { Product, RawRecord } from './product-types.ts';
import { categoryPathOf, groupKeyOf } from './record-text.ts';
import { sizeGroupOf } from './size-rules.ts';

const DESCRIPTION_EXCERPT_CHARS = 600;

export function toProduct(record: RawRecord): Product {
  return {
    id: record.parent_asin,
    title: String(record.title ?? '').trim(),
    brand: pickBrand(record),
    store: cleanValue(record.store),
    categoryPath: categoryPathOf(record),
    price: positiveNumberOrNull(record.price),
    rating: positiveNumberOrNull(record.average_rating),
    ratingCount: positiveNumberOrNull(record.rating_number) ?? 0,
    colorText: cleanValue(record.color),
    sizeText: cleanValue(record.size),
    colorFamily: colorFamilyOf(record.color),
    sizeGroup: sizeGroupOf(record.size),
    gender: genderOf(record),
    material: cleanValue(record.material),
    features: (record.features ?? []).map((feature) => String(feature).trim()).filter(Boolean),
    description: excerpt((record.description ?? []).join(' '), DESCRIPTION_EXCERPT_CHARS),
    imageUrl: record.images?.[0]?.large ?? '',
    groupKey: groupKeyOf(record),
  };
}

function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/* -- Cuts at the last space before the limit, so no word is broken in half -- */
function excerpt(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}...`;
}
