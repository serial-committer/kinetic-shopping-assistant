/* ---------------------------------------
    Point 12: the chat model writes the words above the cards, from real records only, then code checks them.
    Any failure (refusal, cut-off, invalid JSON, timeout) keeps the cards and shows a fixed sentence (WARN):
    "Here's what I found." above cards, or "Nothing in the catalog matched..." when there are none.
--------------------------------------- */

import type { CatalogStore } from '../catalog/catalog-store.ts';
import { logger } from '../logging/logger.ts';
import type { Card } from '../search/merge-cards.ts';
import type { Slip } from '../slip/slip-types.ts';
import { ChatFailure, type ChatProvider } from './chat-provider.ts';
import { checkReply, NO_MATCH_REPLY, SAFE_REPLY } from './reply-checks.ts';
import { REPLY_FORM_SCHEMA, REPLY_INSTRUCTIONS } from './reply-form.ts';
import { buildReplyInput, type ReplyMode } from './reply-input.ts';

export type WrittenReply = Readonly<{ text: string; highlightIds: string[] }>;

export type ReplyRequest = Readonly<{
  provider: ChatProvider;
  store: CatalogStore;
  mode: ReplyMode;
  message: string;
  slip: Slip;
  cards: readonly Card[];
  survivorCount: number;
  /* -- On an "Anything cheaper?" turn: the cheapest price shown before. The reply may name it -- */
  cheaperThan?: number | null;
  signal?: AbortSignal;
}>;

export async function writeReply({ provider, store, mode, message, slip, cards, survivorCount, cheaperThan = null, signal }: ReplyRequest): Promise<WrittenReply> {
  const fallback = cards.length ? SAFE_REPLY : NO_MATCH_REPLY;
  const input = buildReplyInput(store, mode, message, slip, cards, survivorCount, cheaperThan);
  logger.debug('P12', 'reply request', { provider: provider.label, input });
  let json: unknown;
  try {
    json = await provider.completeJson({ purpose: 'reply', instructions: REPLY_INSTRUCTIONS, input, schemaName: 'reply', schema: REPLY_FORM_SCHEMA, signal });
  } catch (error) {
    if (error instanceof ChatFailure && error.kind === 'aborted') throw error;
    logger.warn('P12', 'the reply failed, so a fixed sentence is shown', { reason: (error as Error).message });
    return { text: fallback, highlightIds: [] };
  }
  logger.debug('P12', 'reply response', json);

  const reply = json as { message?: unknown; productIds?: unknown };
  if (typeof reply?.message !== 'string' || !Array.isArray(reply.productIds)) {
    logger.warn('P12', 'the reply broke its schema, so a fixed sentence is shown', json);
    return { text: fallback, highlightIds: [] };
  }

  const rows = cards.flatMap((card) => (mode === 'answer' ? [...card.passingRows, ...card.otherRows] : card.passingRows));
  const shownIds = new Set(cards.map((card) => store.products[card.bestRow]!.id));
  const shownPrices = [...rows.map((row) => store.products[row]!.price).filter((price): price is number => price !== null), ...(cheaperThan === null ? [] : [cheaperThan])];
  const productIds = reply.productIds.filter((id): id is string => typeof id === 'string');
  const checked = checkReply(reply.message, productIds, shownIds, shownPrices, slip, fallback);
  if (checked.droppedIds.length) logger.warn('P12', 'the reply named products that are not on screen; they were dropped', { droppedIds: checked.droppedIds });
  if (checked.unknownAmounts.length) logger.warn('P12', 'the reply quoted a price that is not on screen, so it was replaced', { amounts: checked.unknownAmounts, message: reply.message });
  return { text: checked.text, highlightIds: checked.highlightIds };
}
