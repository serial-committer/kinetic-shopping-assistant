/* ---------------------------------------
    One message. An assistant message can carry a note (search-only mode) and the two "ask first" brand buttons,
    which lock once one of them is clicked.
--------------------------------------- */

import type { BrandChoice } from '../../api/api-types.ts';
import type { ChatItem } from '../../state/use-conversation.ts';

type ChatMessageProps = Readonly<{ item: ChatItem; onBrandChoice: (itemKey: string, choice: BrandChoice) => void }>;

export function ChatMessage({ item, onBrandChoice }: ChatMessageProps) {
  const classes = ['chat-bubble', item.role === 'shopper' ? 'is-shopper' : 'is-assistant', item.kind === 'error' ? 'is-error' : ''].filter(Boolean).join(' ');
  const question = item.brandQuestion;
  return (
    <div className={classes}>
      <p className="chat-text">{item.text}</p>
      {item.notice && <p className="chat-notice">{item.notice}</p>}
      {question && (
        <div className="brand-choices" role="group" aria-label="Which did you mean?">
          <button type="button" className="pill-button" disabled={item.answered} onClick={() => onBrandChoice(item.key, question.brand.choice)}>
            {question.brand.label}
          </button>
          <button type="button" className="pill-button" disabled={item.answered} onClick={() => onBrandChoice(item.key, question.word.choice)}>
            {question.word.label}
          </button>
        </div>
      )}
    </div>
  );
}
