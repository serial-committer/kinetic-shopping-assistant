/* ---------------------------------------
    Opens and closes a native <dialog> with the grow-from-anchor motion. The native dialog gives focus trapping,
    Escape to close and the top layer for free; this hook adds the animation and makes sure a close always runs
    its exit animation first, whether it came from a button, Escape or a click on the dimmed backdrop.
--------------------------------------- */

import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useRef } from 'react';
import { growFromAnchor, shrinkToAnchor } from './grow-from-anchor.ts';

export function useAnchoredDialog(open: boolean, anchor: DOMRect | null, onClosed: () => void) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closing = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || dialog.open) return;
    closing.current = false;
    dialog.showModal();
    const animation = growFromAnchor(dialog, anchor);
    return () => animation.cancel();
  }, [open, anchor]);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closing.current) return;
    closing.current = true;
    const animation = shrinkToAnchor(dialog, anchor);
    animation.onfinish = () => {
      animation.cancel();
      dialog.close();
      onClosed();
    };
  }, [anchor, onClosed]);

  /* -- Escape fires "cancel"; stop the instant close and run the animated one instead -- */
  const onCancel = useCallback((event: SyntheticEvent) => {
    event.preventDefault();
    requestClose();
  }, [requestClose]);

  /* -- A click that lands on the dialog element itself (not its content) is a click on the backdrop -- */
  const onBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) requestClose();
  }, [requestClose]);

  return { dialogRef, requestClose, onCancel, onBackdropClick };
}
