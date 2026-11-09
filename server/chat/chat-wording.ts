/* ---------------------------------------
    Every fixed sentence the assistant can show, in one place, so wording changes never hunt through logic.
--------------------------------------- */

import { MAX_SCREEN_CARDS } from './conversation-state.ts';

export const FIXED_QUESTION = 'What kind of item are you looking for, and is there a budget?';

export const CHAT_OFF_NOTE = "Chat is off, so price, colour and size aren't applied. See the README to turn on Claude, OpenAI or a free local model with Ollama.";

/* -- Under the cards when "Load more" reaches the most cards a screen can hold -- */
export const SCREEN_FULL_NOTE = `These are the first ${MAX_SCREEN_CARDS} products. Narrow the search to see others.`;

export const CHAT_FAILED_NOTE = "The chat model didn't answer this time, so this search used your words only, without price, colour or size.";

/* -- The question shown with the two brand buttons -- */
export function brandQuestionText(brandName: string, asTyped: string): string {
  return `Did you mean ${displayName(brandName)}, the brand, or "${asTyped.toLowerCase()}" as a word?`;
}

export function brandButtonLabel(brandName: string, products: number): string {
  return `${displayName(brandName)}, the brand (${products} ${products === 1 ? 'product' : 'products'})`;
}

export function wordButtonLabel(asTyped: string, products: number): string {
  return `${asTyped.toLowerCase()} as a word (${products} ${products === 1 ? 'product' : 'products'})`;
}

/* -- "the north face" -> "The North Face" -- */
export function displayName(normalised: string): string {
  return normalised.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
