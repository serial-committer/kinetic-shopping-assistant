/* ---------------------------------------
    Point 6: the form the chat model must reply with, as a strict JSON schema (structured output).
    The model can't answer outside this form, so it can't write a query, a card or a product.
        action "search"  run Points 7 to 12 with `change`
        action "ask"     show `question`, leave the slip as it is
        action "answer"  a question about the cards on screen: skip the search, answer from their records
    Nullable boxes use anyOf with null, a form Claude, OpenAI and Ollama all accept in strict mode.
--------------------------------------- */

import { COLOR_FAMILIES, type ColorFamily } from '../catalog/color-rules.ts';
import { GENDERS } from '../catalog/gender-rules.ts';
import { SLIP_BOXES, SORT_ORDERS, type ShopperGender, type SlipBox, type SortOrder } from './slip-types.ts';

export type SlipAction = 'search' | 'ask' | 'answer';

/* -- What the model may change. Null means "leave this box alone" -- */
export type SlipChange = {
  text: string | null;
  color: ColorFamily | null;
  size: string | null;
  gender: ShopperGender | null;
  minPrice: number | null;
  maxPrice: number | null;
  brand: string | null;
  sort: SortOrder | null;
  cheaperThanShown: boolean;
  clear: SlipBox[];
  newSearch: boolean;
};

export type SlipForm = {
  action: SlipAction;
  question: string | null;
  change: SlipChange | null;
};

const orNull = (schema: Record<string, unknown>): Record<string, unknown> => ({ anyOf: [schema, { type: 'null' }] });

export const SLIP_FORM_SCHEMA: Record<string, unknown> = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['action', 'question', 'change'],
  properties: {
    action: { type: 'string', enum: ['search', 'ask', 'answer'] },
    question: orNull({ type: 'string' }),
    change: orNull({
      type: 'object',
      additionalProperties: false,
      required: [...SLIP_BOXES, 'cheaperThanShown', 'clear', 'newSearch'],
      properties: {
        text: orNull({ type: 'string' }),
        color: orNull({ type: 'string', enum: [...COLOR_FAMILIES] }),
        size: orNull({ type: 'string' }),
        gender: orNull({ type: 'string', enum: [...GENDERS] }),
        minPrice: orNull({ type: 'number' }),
        maxPrice: orNull({ type: 'number' }),
        brand: orNull({ type: 'string' }),
        sort: orNull({ type: 'string', enum: [...SORT_ORDERS] }),
        cheaperThanShown: { type: 'boolean' },
        clear: { type: 'array', items: { type: 'string', enum: [...SLIP_BOXES] } },
        newSearch: { type: 'boolean' },
      },
    }),
  },
});
