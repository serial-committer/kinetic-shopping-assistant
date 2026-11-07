/* ---------------------------------------
    The message box. Enter sends, Shift+Enter starts a new line. Sending while a reply is still on its way is
    allowed: the newer message cancels the older request.
--------------------------------------- */

import { type FormEvent, type KeyboardEvent, useState } from 'react';

const MAX_CHARS = 500;

export function Composer({ onSend }: Readonly<{ onSend: (message: string) => void }>) {
  const [text, setText] = useState('');

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="composer-input">Message</label>
      <textarea
        id="composer-input"
        className="composer-input"
        rows={1}
        maxLength={MAX_CHARS}
        value={text}
        placeholder="Describe what you're looking for"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="submit" className="pill-button is-accent composer-send" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
}
