/* ---------------------------------------
    Makes a dialog grow out of the thing that opened it (a product card, the logs button) and shrink back into it,
    so the shopper can see where it came from and where it went. Uses the Web Animations API: transform and opacity
    only, off the main thread. With reduced motion it is a plain fade.
--------------------------------------- */

const OPEN_MS = 280;
const CLOSE_MS = 180;
const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -- The transform that puts `element` over `anchor`: moved to the anchor's center and scaled to its width -- */
function collapsedTransform(element: HTMLElement, anchor: DOMRect): string {
  const box = element.getBoundingClientRect();
  const dx = anchor.left + anchor.width / 2 - (box.left + box.width / 2);
  const dy = anchor.top + anchor.height / 2 - (box.top + box.height / 2);
  const scale = Math.min(1, Math.max(0.2, anchor.width / box.width));
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

export function growFromAnchor(element: HTMLElement, anchor: DOMRect | null): Animation {
  if (!anchor || prefersReducedMotion()) {
    return element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: EASE_OUT });
  }
  return element.animate([{ opacity: 0, transform: collapsedTransform(element, anchor) }, { opacity: 1, transform: 'none' }], { duration: OPEN_MS, easing: EASE_DRAWER });
}

/* -- Closing is faster than opening: the shopper is done, the page shouldn't keep them waiting -- */
export function shrinkToAnchor(element: HTMLElement, anchor: DOMRect | null): Animation {
  if (!anchor || prefersReducedMotion()) {
    return element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: EASE_OUT, fill: 'forwards' });
  }
  return element.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: collapsedTransform(element, anchor) }], { duration: CLOSE_MS, easing: EASE_OUT, fill: 'forwards' });
}
