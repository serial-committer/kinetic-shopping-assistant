/* ---------------------------------------
    The chat on the page: the messages shown, the cards on screen, and the conversation state the server hands back
    after every turn (the browser carries it; the server keeps nothing). Sending a new message while one is still
    running cancels the old request, so its answer can never land on top of the newer one.
--------------------------------------- */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort, sendBrandChoice, sendChatMessage } from '../api/api-client.ts';
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
  pending: boolean;
  state: ConversationState | null;
  send(message: string): void;
  chooseBrand(itemKey: string, choice: BrandChoice): void;
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
  const [state, setState] = useState<ConversationState | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const stateRef = useRef<ConversationState | null>(null);
  stateRef.current = state;

  /* -- Nothing keeps running after the page section unmounts -- */
  useEffect(() => () => inFlight.current?.abort(), []);

  const run = useCallback((request: (signal: AbortSignal) => Promise<ChatTurnResult>, label: string) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setPending(true);
    request(controller.signal)
      .then((result) => {
        uiLogger.info('turn', `${label}: ${result.kind}`, { cards: result.cards?.length ?? 'unchanged', ms: result.meta.ms }, result.messageId);
        setItems((current) => [...current, { key: keyOf(), role: 'assistant', text: result.reply.text, kind: result.kind, notice: result.notice, brandQuestion: result.brandQuestion }]);
        if (result.cards !== null) {
          setCards(result.cards);
          setSearched(true);
        } else if (result.kind === 'answer') {
          setSearched(true);
        }
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
          setPending(false);
        }
      });
  }, []);

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
    setItems([]);
    setCards([]);
    setSearched(false);
    setState(null);
    uiLogger.info('turn', 'started over: chat, cards and slip cleared');
  }, []);

  return { items, cards, searched, pending, state, send, chooseBrand, reset };
}
