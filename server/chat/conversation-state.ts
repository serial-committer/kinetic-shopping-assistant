/* ---------------------------------------
    What the browser keeps between messages and sends back with each one, like a shopping list the shopper carries:
    the saved slip, the cards on screen, the cards "cheaper" excluded, the last few turns, the brand choices made,
    and a slip waiting for a brand button. The server keeps nothing per chat, so memory can't grow and a restart
    loses nothing. Everything that arrives is checked: unknown ids and malformed values are dropped.
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';
import { isColorFamily } from '../catalog/color-rules.ts';
import { isGender } from '../catalog/gender-rules.ts';
import type { BrandChoice } from '../slip/brand-gate.ts';
import type { HistoryTurn } from '../slip/slip-prompt.ts';
import { EMPTY_SLIP, type Slip, SORT_ORDERS, type SortOrder } from '../slip/slip-types.ts';

export const HISTORY_TURNS_KEPT = 6;
const MAX_TEXT_CHARS = 1_000;
const MAX_SCREEN_CARDS = 50;

export type PendingBrand = Readonly<{ name: string; asTyped: string; message: string; slip: Slip }>;

export type ConversationState = Readonly<{
  slip: Slip;
  /* -- The product id heading each card on screen, in card order -- */
  screenIds: readonly string[];
  excludedGroups: readonly string[];
  history: readonly HistoryTurn[];
  brandChoices: Readonly<Record<string, BrandChoice>>;
  pendingBrand: PendingBrand | null;
}>;

export const NEW_CONVERSATION: ConversationState = Object.freeze({
  slip: EMPTY_SLIP,
  screenIds: [],
  excludedGroups: [],
  history: [],
  brandChoices: {},
  pendingBrand: null,
});

/* -- The last few turns only: enough for follow-ups, small enough to send every time -- */
export function withTurns(history: readonly HistoryTurn[], ...turns: HistoryTurn[]): HistoryTurn[] {
  return [...history, ...turns].slice(-HISTORY_TURNS_KEPT);
}

export function readConversationState(raw: unknown, store: CatalogStore): ConversationState {
  if (!isRecord(raw)) return NEW_CONVERSATION;
  const pending = isRecord(raw['pendingBrand']) ? raw['pendingBrand'] : null;
  return {
    slip: readSlip(raw['slip']),
    screenIds: asArray(raw['screenIds']).filter((id): id is string => typeof id === 'string' && store.rowById.has(id)).slice(0, MAX_SCREEN_CARDS),
    excludedGroups: asArray(raw['excludedGroups']).filter((key): key is string => typeof key === 'string' && store.rowsByGroup.has(key)),
    history: asArray(raw['history']).flatMap(readTurn).slice(-HISTORY_TURNS_KEPT),
    brandChoices: Object.fromEntries(Object.entries(isRecord(raw['brandChoices']) ? raw['brandChoices'] : {}).filter(([name, choice]) => store.brandCounts.has(name) && (choice === 'brand' || choice === 'word'))) as Record<string, BrandChoice>,
    pendingBrand: pending && typeof pending['name'] === 'string' && store.brandCounts.has(pending['name'])
      ? { name: pending['name'], asTyped: text(pending['asTyped']) ?? pending['name'], message: text(pending['message']) ?? '', slip: readSlip(pending['slip']) }
      : null,
  };
}

function readSlip(raw: unknown): Slip {
  if (!isRecord(raw)) return EMPTY_SLIP;
  const price = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);
  return {
    text: text(raw['text']),
    color: isColorFamily(raw['color']) ? raw['color'] : null,
    size: text(raw['size']),
    gender: isGender(raw['gender']) && raw['gender'] !== 'unisex' ? raw['gender'] : null,
    minPrice: price(raw['minPrice']),
    maxPrice: price(raw['maxPrice']),
    brand: text(raw['brand']),
    sort: SORT_ORDERS.includes(raw['sort'] as SortOrder) ? (raw['sort'] as SortOrder) : null,
  };
}

function readTurn(raw: unknown): HistoryTurn[] {
  if (!isRecord(raw) || (raw['role'] !== 'shopper' && raw['role'] !== 'assistant')) return [];
  const turnText = text(raw['text']);
  return turnText ? [{ role: raw['role'], text: turnText }] : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT_CHARS) : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
