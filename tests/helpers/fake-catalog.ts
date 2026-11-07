/* ---------------------------------------
    Small hand-made catalogs for search tests: write only the fields a test cares about.
--------------------------------------- */

import type { Product } from '../../server/catalog/product-types.ts';

export function product(fields: Partial<Product>): Product {
  const title = fields.title ?? 'Test product';
  const store = fields.store ?? 'Test Store';
  return {
    id: fields.id ?? `ID-${Math.random().toString(36).slice(2, 10)}`,
    title,
    brand: fields.brand ?? store,
    store,
    categoryPath: '',
    price: 10,
    rating: 4,
    ratingCount: 10,
    colorText: '',
    sizeText: '',
    colorFamily: null,
    sizeGroup: null,
    gender: 'unknown',
    material: '',
    features: [],
    description: '',
    imageUrl: '',
    groupKey: `${store.toLowerCase()}|${title.toLowerCase().trim()}`,
    ...fields,
  };
}

/* -- The parts of a catalog store that filters and card merging read -- */
export function fakeStore(products: Product[]): { products: Product[]; rowsByGroup: Map<string, number[]>; brandKeys: string[] } {
  const rowsByGroup = new Map<string, number[]>();
  products.forEach((item, row) => rowsByGroup.set(item.groupKey, [...(rowsByGroup.get(item.groupKey) ?? []), row]));
  return { products, rowsByGroup, brandKeys: products.map((item) => item.brand.toLowerCase()) };
}
