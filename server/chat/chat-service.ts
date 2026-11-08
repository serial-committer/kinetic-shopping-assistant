/* ---------------------------------------
    One shopper message, start to finish (Points 6 to 12):
        P6   fill-slip        the chat model fills the slip form           -> search | ask | answer
        P7a  merge-slip       the change goes into the saved slip
        P7b  keep-words       shopper words the model dropped go back into text
        P7c  brand-gate       filter, back to words, or ask first (no search until a button is clicked)
        P8-11 search engine   filter, rank, combine, cards
        P12  write-reply      the chat model writes the words; code draws the cards and checks the words
    No provider set up, or a failed slip: search-only mode for that message (whole sentence as words, no filters).
    A brand button (handleBrandChoice) skips P6 and picks up at the search, because the button already says
    exactly what changes.
--------------------------------------- */

import { randomUUID } from 'node:crypto';
import { shopperSizeGroupOf } from '../catalog/size-rules.ts';
import { logger } from '../logging/logger.ts';
import { filtersFromSlip, NO_FILTERS } from '../search/filter-set.ts';
import type { Card } from '../search/merge-cards.ts';
import type { SearchEngine } from '../search/search-engine.ts';
import { type BrandChoice, checkBrand } from '../slip/brand-gate.ts';
import { fillSlip } from '../slip/fill-slip.ts';
import { keepShopperWords } from '../slip/keep-words.ts';
import { mergeSlip } from '../slip/merge-slip.ts';
import type { SlipChange, SlipForm } from '../slip/slip-form.ts';
import { EMPTY_SLIP, type Slip } from '../slip/slip-types.ts';
import { toCardViews, type CardView } from './card-view.ts';
import { ChatFailure, type ChatProvider } from './chat-provider.ts';
import { brandButtonLabel, brandQuestionText, CHAT_FAILED_NOTE, CHAT_OFF_NOTE, FIXED_QUESTION, wordButtonLabel } from './chat-wording.ts';
import { type ConversationState, withTurns } from './conversation-state.ts';
import type { ProviderRegistry } from './provider-registry.ts';
import { SAFE_REPLY } from './reply-checks.ts';
import { lowestPriceOnScreen, priceJustUnderScreen, rebuildScreenCards, screenLines } from './screen-cards.ts';
import { writeReply } from './write-reply.ts';

export type TurnKind = 'results' | 'question' | 'answer' | 'brand-question' | 'search-only' | 'more';

export type BrandQuestion = Readonly<{ text: string; brand: { label: string; choice: 'brand' }; word: { label: string; choice: 'word' } }>;

export type ChatTurnResult = Readonly<{
  messageId: string;
  kind: TurnKind;
  reply: Readonly<{ text: string; highlightIds: string[] }>;
  /* -- null means "leave the cards on screen as they are". For kind "more", these are cards to ADD below the ones on screen -- */
  cards: CardView[] | null;
  /* -- Whether "Load more" has more to load; null means "unchanged" (no new cards) -- */
  hasMore: boolean | null;
  brandQuestion: BrandQuestion | null;
  notice: string | null;
  state: ConversationState;
  meta: Readonly<{ provider: string | null; action: string; ranking: string | null; survivorCount: number | null; ms: number }>;
}>;

export type ChatService = Readonly<{
  handleMessage(request: { message: string; providerId: string | null; state: ConversationState; signal?: AbortSignal }): Promise<ChatTurnResult>;
  handleBrandChoice(request: { choice: BrandChoice; providerId: string | null; state: ConversationState; signal?: AbortSignal }): Promise<ChatTurnResult>;
  handleLoadMore(request: { state: ConversationState }): Promise<ChatTurnResult>;
}>;

type FinishMeta = { action: string; ranking?: string; survivorCount?: number; hasMore?: boolean };

type Turn = { messageId: string; started: number; provider: ChatProvider | null; signal?: AbortSignal };

export function createChatService(engine: SearchEngine, providers: ProviderRegistry): ChatService {
  const store = engine.store;

  /* -- The chosen provider, or the first one set up, or null for search-only -- */
  const pickProvider = (providerId: string | null): ChatProvider | null => providers.find(providerId) ?? providers.list()[0] ?? null;

  async function handleMessage({ message, providerId, state, signal }: { message: string; providerId: string | null; state: ConversationState; signal?: AbortSignal }): Promise<ChatTurnResult> {
    const turn: Turn = { messageId: newMessageId(), started: performance.now(), provider: pickProvider(providerId), signal };
    return logger.withMessageId(turn.messageId, async () => {
      logger.info('turn', 'shopper message', { message, provider: turn.provider ? `${turn.provider.label} (${turn.provider.model})` : 'none', cardsOnScreen: state.screenIds.length });
      if (!turn.provider) return searchOnly(turn, message, state, CHAT_OFF_NOTE);
      const screen = rebuildScreenCards(store, state.screenIds, state.screenSlip ?? state.slip, state.brandChoices);
      let form: SlipForm;
      try {
        form = await fillSlip(turn.provider, state.slip, screenLines(store, screen), state.history, message, signal);
      } catch (error) {
        if (error instanceof ChatFailure && error.kind === 'aborted') throw error;
        logger.warn('P6', 'the slip failed, so this message runs in search-only mode', { reason: (error as Error).message });
        return searchOnly(turn, message, state, CHAT_FAILED_NOTE);
      }

      if (form.action === 'ask' || (form.action === 'search' && !form.change)) {
        if (!form.question) logger.warn('P6', 'ask came back without a question, so the fixed question is shown');
        const question = form.question ?? FIXED_QUESTION;
        return finish(turn, 'question', { text: question, highlightIds: [] }, null, { ...state, history: withTurns(state.history, { role: 'shopper', text: message }, { role: 'assistant', text: question }) }, { action: 'ask' });
      }

      if (form.action === 'answer') {
        const reply = await writeReply({ provider: turn.provider, store, mode: 'answer', message, slip: state.slip, cards: screen, survivorCount: screen.length, signal });
        return finish(turn, 'answer', reply, toCardViews(store, screen, reply.highlightIds), { ...state, history: withTurns(state.history, { role: 'shopper', text: message }, { role: 'assistant', text: reply.text }) }, { action: 'answer' });
      }

      return searchFromChange(turn, message, form.change!, state, screen);
    });
  }

  async function handleBrandChoice({ choice, providerId, state, signal }: { choice: BrandChoice; providerId: string | null; state: ConversationState; signal?: AbortSignal }): Promise<ChatTurnResult> {
    const turn: Turn = { messageId: newMessageId(), started: performance.now(), provider: pickProvider(providerId), signal };
    return logger.withMessageId(turn.messageId, async () => {
      const pending = state.pendingBrand;
      if (!pending) throw new Error('there is no brand question waiting for an answer');
      logger.debug('P7c', 'brand button clicked', { brand: pending.name, choice });
      const brandChoices = { ...state.brandChoices, [pending.name]: choice };
      const slip = choice === 'word' ? { ...pending.slip, brand: null, text: joinWords(pending.slip.text, pending.asTyped) } : pending.slip;
      const label = choice === 'brand' ? brandButtonLabel(pending.name, store.brandCounts.get(pending.name) ?? 0) : wordButtonLabel(pending.asTyped, store.otherTitleCounts.get(pending.name) ?? 0);
      const history = withTurns(state.history, { role: 'shopper', text: label });
      return searchAndReply(turn, pending.message, slip, choice === 'brand' ? pending.name : null, state.excludedGroups, { ...state, brandChoices, history, pendingBrand: null }, 'brand-choice');
    });
  }

  /* ---------------------------------------
      "Load more": the same search again (P8 to P11) with every card already on screen excluded, the way "cheaper"
      excludes them, so the next 8 come back without any offset or page number to keep. No chat model is involved
      and no message is added to the chat: the new cards go below the ones on screen.
  --------------------------------------- */
  async function handleLoadMore({ state }: { state: ConversationState }): Promise<ChatTurnResult> {
    const turn: Turn = { messageId: newMessageId(), started: performance.now(), provider: null };
    return logger.withMessageId(turn.messageId, async () => {
      const slip = state.screenSlip ?? state.slip;
      const decision = checkBrand(slip.brand, store, state.brandChoices);
      const shownGroups = state.screenIds.flatMap((id) => {
        const row = store.rowById.get(id);
        return row === undefined ? [] : [store.products[row]!.groupKey];
      });
      const excluded = new Set([...state.excludedGroups, ...shownGroups]);
      logger.info('turn', 'load more', { cardsOnScreen: state.screenIds.length, slip });
      const result = await engine.search({ text: slip.text, sort: slip.sort, filters: filtersFromSlip(slip, decision.kind === 'filter' ? decision.name : null, excluded) });
      const nextState: ConversationState = { ...state, screenIds: [...state.screenIds, ...result.cards.map((card) => store.products[card.bestRow]!.id)] };
      return finish(turn, 'more', { text: '', highlightIds: [] }, toCardViews(store, result.cards), nextState, { action: 'load-more', ranking: result.ranking, survivorCount: result.survivorCount, hasMore: result.hasMore });
    });
  }

  /* -- P7a to P7c, then the search. The brand gate may stop here and ask first -- */
  async function searchFromChange(turn: Turn, message: string, change: SlipChange, state: ConversationState, screen: readonly Card[]): Promise<ChatTurnResult> {
    logger.debug('P7a', 'slip before merge', { slip: state.slip, change });
    const merged = mergeSlip(state.slip, change, screen.length);
    if (merged.newTopicByCode) logger.debug('P7a', 'new topic: the new search words share nothing with the saved ones, so this starts a new search', { saved: state.slip.text, incoming: change.text });
    let excludedGroups = exclusionsAfter(change, merged.startedOver, state.excludedGroups);
    let slip = merged.slip;
    if (merged.cheaperRequested) {
      slip = { ...slip, maxPrice: priceJustUnderScreen(screen) ?? slip.maxPrice };
      excludedGroups = [...new Set([...excludedGroups, ...screen.map((card) => card.groupKey)])];
      logger.debug('P7a', 'cheaper than the cards on screen', { maxPrice: slip.maxPrice, excludedCards: excludedGroups.length });
    }
    logger.debug('P7a', 'slip after merge', slip);

    const kept = keepShopperWords(message, slip);
    slip = kept.slip;
    if (kept.putBack.length) logger.debug('P7b', 'shopper words put back into text', { words: kept.putBack, text: slip.text });
    slip = sizeIntoWordsWhenUnreadable(slip);

    const decision = checkBrand(slip.brand, store, state.brandChoices);
    logger.debug('P7c', 'brand gate', decision);
    const history = withTurns(state.history, { role: 'shopper', text: message });
    if (decision.kind === 'ask') {
      const question = brandQuestionText(decision.name, decision.asTyped);
      const brandQuestion: BrandQuestion = {
        text: question,
        brand: { label: brandButtonLabel(decision.name, decision.own), choice: 'brand' },
        word: { label: wordButtonLabel(decision.asTyped, decision.elsewhere), choice: 'word' },
      };
      const pendingState: ConversationState = { ...state, excludedGroups, history: withTurns(history, { role: 'assistant', text: question }), pendingBrand: { name: decision.name, asTyped: decision.asTyped, message, slip } };
      return finish(turn, 'brand-question', { text: question, highlightIds: [] }, null, pendingState, { action: 'search' }, brandQuestion);
    }
    if (decision.kind === 'words') slip = { ...slip, brand: null, text: joinWords(slip.text, decision.word) };
    const cheaperThan = merged.cheaperRequested ? lowestPriceOnScreen(screen) : null;
    return searchAndReply(turn, message, slip, decision.kind === 'filter' ? decision.name : null, excludedGroups, { ...state, history }, 'search', cheaperThan);
  }

  /* -- P8 to P12. cheaperThan: on a "cheaper" turn, the cheapest price the shopper saw before, which the reply may name -- */
  async function searchAndReply(turn: Turn, message: string, slip: Slip, brandKey: string | null, excludedGroups: readonly string[], state: ConversationState, action: string, cheaperThan: number | null = null): Promise<ChatTurnResult> {
    const result = await engine.search({ text: slip.text, sort: slip.sort, filters: filtersFromSlip(slip, brandKey, new Set(excludedGroups)) });
    const reply = turn.provider
      ? await writeReply({ provider: turn.provider, store, mode: 'search', message, slip, cards: result.cards, survivorCount: result.survivorCount, cheaperThan, signal: turn.signal })
      : { text: SAFE_REPLY, highlightIds: [] };
    const nextState: ConversationState = {
      ...state,
      slip,
      excludedGroups,
      screenIds: result.cards.map((card) => store.products[card.bestRow]!.id),
      screenSlip: slip,
      history: withTurns(state.history, { role: 'assistant', text: reply.text }),
      pendingBrand: null,
    };
    return finish(turn, 'results', reply, toCardViews(store, result.cards, reply.highlightIds), nextState, { action, ranking: result.ranking, survivorCount: result.survivorCount, hasMore: result.hasMore });
  }

  /* -- No chat model for this message: the whole sentence becomes search words, filters stay off, the saved slip is untouched -- */
  async function searchOnly(turn: Turn, message: string, state: ConversationState, notice: string): Promise<ChatTurnResult> {
    logger.warn('P6', 'search-only mode for this message', { reason: turn.provider ? 'the slip failed' : 'no chat provider is set up' });
    const result = await engine.search({ text: message, sort: null, filters: NO_FILTERS });
    const nextState: ConversationState = {
      ...state,
      screenIds: result.cards.map((card) => store.products[card.bestRow]!.id),
      screenSlip: { ...EMPTY_SLIP, text: message },
      history: withTurns(state.history, { role: 'shopper', text: message }, { role: 'assistant', text: SAFE_REPLY }),
    };
    return finish(turn, 'search-only', { text: SAFE_REPLY, highlightIds: [] }, toCardViews(store, result.cards), nextState, { action: 'search-only', ranking: result.ranking, survivorCount: result.survivorCount, hasMore: result.hasMore }, null, notice);
  }

  function finish(
    turn: Turn, kind: TurnKind, reply: { text: string; highlightIds: string[] }, cards: CardView[] | null, state: ConversationState,
    meta: FinishMeta, brandQuestion: BrandQuestion | null = null, notice: string | null = null,
  ): ChatTurnResult {
    const ms = Math.round(performance.now() - turn.started);
    logger.info('turn', 'message handled', { provider: turn.provider?.label ?? 'none', action: meta.action, kind, reply: reply.text, cardIds: cards?.map((card) => card.id) ?? 'unchanged', hasMore: meta.hasMore ?? 'unchanged', ms });
    return {
      messageId: turn.messageId,
      kind,
      reply,
      cards,
      hasMore: meta.hasMore ?? null,
      brandQuestion,
      notice,
      state,
      meta: { provider: turn.provider?.label ?? null, action: meta.action, ranking: meta.ranking ?? null, survivorCount: meta.survivorCount ?? null, ms },
    };
  }

  return Object.freeze({ handleMessage, handleBrandChoice, handleLoadMore });
}

/* -- Cards excluded by "cheaper" only make sense while that price cap stands: a new search or a new price resets them -- */
function exclusionsAfter(change: SlipChange, startedOver: boolean, excluded: readonly string[]): readonly string[] {
  if (startedOver || change.clear.includes('maxPrice') || (!change.cheaperThanShown && change.maxPrice !== null)) return [];
  return excluded;
}

/* -- A size the rules can't read ("petite") would filter nothing and vanish, so it becomes a search word instead -- */
function sizeIntoWordsWhenUnreadable(slip: Slip): Slip {
  if (!slip.size || shopperSizeGroupOf(slip.size)) return slip;
  logger.debug('P7b', 'size has no group, so it searches as a word', { size: slip.size });
  return { ...slip, size: null, text: joinWords(slip.text, slip.size) };
}

function joinWords(text: string | null, word: string): string {
  return [text, word].filter(Boolean).join(' ');
}

function newMessageId(): string {
  return randomUUID().slice(0, 8);
}
