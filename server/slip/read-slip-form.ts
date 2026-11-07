/* ---------------------------------------
    Reads the model's JSON as a slip form, box by box. Strict structured output should already guarantee the shape;
    this is the second lock, for a local model or a provider that bends a rule. A wrong value in one box is dropped
    (that box stays as it was) and reported; a reply that isn't a form at all is rejected.
--------------------------------------- */

import { isColorFamily } from '../catalog/color-rules.ts';
import { isGender } from '../catalog/gender-rules.ts';
import { ChatFailure } from '../chat/chat-provider.ts';
import type { SlipAction, SlipChange, SlipForm } from './slip-form.ts';
import { SLIP_BOXES, SORT_ORDERS, type SlipBox, type SortOrder } from './slip-types.ts';

const ACTIONS: readonly SlipAction[] = ['search', 'ask', 'answer'];

export type ReadSlipResult = Readonly<{ form: SlipForm; problems: string[] }>;

export function readSlipForm(json: unknown): ReadSlipResult {
  if (!isRecord(json) || !ACTIONS.includes(json['action'] as SlipAction)) throw new ChatFailure('invalid-json', 'the reply is not a slip form');
  const problems: string[] = [];
  const question = typeof json['question'] === 'string' && json['question'].trim() && json['question'].trim().toLowerCase() !== 'null' ? json['question'].trim() : null;
  const change = isRecord(json['change']) ? readChange(json['change'], problems) : null;
  return { form: { action: json['action'] as SlipAction, question, change }, problems };
}

function readChange(raw: Record<string, unknown>, problems: string[]): SlipChange {
  const pick = <T>(box: string, accept: (value: unknown) => value is T): T | null => {
    const value = raw[box];
    if (value === null || value === undefined) return null;
    if (accept(value)) return value;
    problems.push(`${box}: ${JSON.stringify(value)} dropped`);
    return null;
  };
  return {
    text: pick('text', isText),
    color: pick('color', isColorFamily),
    size: pick('size', isText),
    gender: pick('gender', isGender),
    minPrice: pick('minPrice', isPrice),
    maxPrice: pick('maxPrice', isPrice),
    brand: pick('brand', isText),
    sort: pick('sort', (value): value is SortOrder => SORT_ORDERS.includes(value as SortOrder)),
    cheaperThanShown: raw['cheaperThanShown'] === true,
    clear: Array.isArray(raw['clear']) ? raw['clear'].filter((box): box is SlipBox => (SLIP_BOXES as readonly unknown[]).includes(box)) : [],
    newSearch: raw['newSearch'] === true,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
