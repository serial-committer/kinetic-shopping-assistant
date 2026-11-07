/* ---------------------------------------
    The chat column: a welcome with example requests, the messages (with brand buttons and notes under the
    assistant's), a "searching" bubble while a reply is on its way, and the message box at the bottom.
--------------------------------------- */

import { useEffect, useRef } from 'react';
import type { BrandChoice } from '../../api/api-types.ts';
import type { ChatItem } from '../../state/use-conversation.ts';
import { ChatMessage } from './ChatMessage.tsx';
import { Composer } from './Composer.tsx';
import { Welcome } from './Welcome.tsx';
import './chat.css';

type ChatPanelProps = Readonly<{
  items: readonly ChatItem[];
  pending: boolean;
  onSend: (message: string) => void;
  onBrandChoice: (itemKey: string, choice: BrandChoice) => void;
}>;

export function ChatPanel({ items, pending, onSend, onBrandChoice }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* -- Keep the newest message in view -- */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [items.length, pending]);

  return (
    <section className="chat-panel" aria-label="Chat">
      <div className="chat-scroll" ref={scrollRef} aria-live="polite">
        {items.length === 0 ? <Welcome onPick={onSend} /> : items.map((item) => <ChatMessage key={item.key} item={item} onBrandChoice={onBrandChoice} />)}
        {pending && (
          <div className="chat-bubble is-assistant is-typing" role="status">
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="visually-hidden">Searching the catalog</span>
          </div>
        )}
      </div>
      <Composer onSend={onSend} />
    </section>
  );
}
