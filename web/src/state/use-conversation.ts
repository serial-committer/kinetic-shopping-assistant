/* ---------------------------------------
    The chat on the page: the messages shown, the cards on screen, and the conversation state the server hands back
    after every turn (the browser carries it; the server keeps nothing). Sending a new message while one is still
    running cancels the old request, so its answer can never land on top of the newer one.
    "Load more" adds the next cards below the ones on screen, without a chat message.
--------------------------------------- */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort, sendBrandChoice, sendChatMessage, sendLoadMore } from '../api/api-client.ts';
import type { BrandChoice, BrandQuestion, CardView, ChatTurnResult, ConversationState, TurnKind } from '../api/api-types.ts';
import { uiLogger } from '../logging/ui-logger.ts';

export type ChatItem = Readonly<{
  key: string;
  role: 'shopper' | 'assistant';
  text: string;
  kind?: TurnKind | 'error';
  notice?: string | null;
  brandQuestion?: BrandQuestion | null;
  /* -- Set once a brand button is clicked, so the pair can't be clicked twice -- */
  answered?: boolean;
}>;

export type Conversation = Readonly<{
  items: readonly ChatItem[];
  cards: readonly CardView[];
  searched: boolean;
  /* -- A chat message is on its way (shows the "searching" bubble) -- */
  pending: boolean;
  /* -- More cards exist for the search on screen, and "Load more" is fetching them -- */
  hasMore: boolean;
  loadingMore: boolean;
  /* -- A note under the cards from "Load more", such as reaching the most cards a screen holds -- */
  listNote: string | null;
  state: ConversationState | null;
  send(message: string): void;
  chooseBrand(itemKey: string, choice: BrandChoice): void;
  loadMore(): void;
  /* -- Starts over: cancels any request, clears the chat, the cards and the saved slip -- */
  reset(): void;
}>;

let nextKey = 1;
const keyOf = (): string => `item-${nextKey++}`;

export function useConversation(providerId: string | null): Conversation {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [cards, setCards] = useState<CardView[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listNote, setListNote] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const stateRef = useRef<ConversationState | null>(null);
  stateRef.current = state;

  /* -- Nothing keeps running after the page section unmounts -- */
  useEffect(() => () => inFlight.current?.abort(), []);

  /* -- One request at a time: a newer one cancels the older. "more" requests show on the button, not in the chat -- */
  const run = useCallback((request: (signal: AbortSignal) => Promise<ChatTurnResult>, label: string, kind: 'chat' | 'more' = 'chat') => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const setBusy = kind === 'more' ? setLoadingMore : setPending;
    setPending(false);
    setLoadingMore(false);
    setBusy(true);
    request(controller.signal)
      .then((result) => {
        uiLogger.info('turn', `${label}: ${result.kind}`, { cards: result.cards?.length ?? 'unchanged', hasMore: result.hasMore, ms: result.meta.ms }, result.messageId);
        if (result.kind === 'more') {
          setCards((current) => [...current, ...(result.cards ?? [])]);
          setListNote(result.notice);
        } else {
          setItems((current) => [...current, { key: keyOf(), role: 'assistant', text: result.reply.text, kind: result.kind, notice: result.notice, brandQuestion: result.brandQuestion }]);
          if (result.cards !== null) {
            setCards(result.cards);
            setListNote(null);
          }
          if (result.cards !== null || result.kind === 'answer') setSearched(true);
        }
        if (result.hasMore !== null) setHasMore(result.hasMore);
        setState(result.state);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) {
          uiLogger.debug('turn', `${label}: cancelled by a newer message`);
          return;
        }
        uiLogger.error('turn', `${label} failed`, { reason: (error as Error).message });
        setItems((current) => [...current, { key: keyOf(), role: 'assistant', kind: 'error', text: "Something went wrong reaching the shop's server. Please try again." }]);
      })
      .finally(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setBusy(false);
        }
      });
  }, []);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.screenIds.length === 0) return;
    run((signal) => sendLoadMore(current, signal), 'load more', 'more');
  }, [run]);

  const send = useCallback((message: string) => {
    const text = message.trim();
    if (!text) return;
    setItems((current) => [...current, { key: keyOf(), role: 'shopper', text }]);
    run((signal) => sendChatMessage(text, providerId, stateRef.current, signal), 'message');
  }, [providerId, run]);

  /* -- The clicked button's label shows as the shopper's reply, then the server picks up at the search -- */
  const chooseBrand = useCallback((itemKey: string, choice: BrandChoice) => {
    const current = stateRef.current;
    if (!current?.pendingBrand) return;
    setItems((list) => {
      const question = list.find((entry) => entry.key === itemKey)?.brandQuestion;
      const label = question ? (choice === 'brand' ? question.brand.label : question.word.label) : choice;
      return [...list.map((entry) => (entry.key === itemKey ? { ...entry, answered: true } : entry)), { key: keyOf(), role: 'shopper' as const, text: label }];
    });
    run((signal) => sendBrandChoice(choice, providerId, current, signal), 'brand button');
  }, [providerId, run]);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setPending(false);
    setLoadingMore(false);
    setHasMore(false);
    setListNote(null);
    setItems([]);
    setCards([]);
    setSearched(false);
    setState(null);
    uiLogger.info('turn', 'started over: chat, cards and slip cleared');
  }, []);

  return { items, cards, searched, pending, hasMore, loadingMore, listNote, state, send, chooseBrand, loadMore, reset };
}
