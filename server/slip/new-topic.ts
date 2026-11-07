/* ---------------------------------------
    The code-side new-topic check, part of Point 7a. The chat model decides first (its newSearch box); this catches
    what it misses. When the change brings new search words and none of them appear in the saved search words,
    the shopper has moved to a different kind of item, so the merge starts from an empty slip.
        saved "running shoes", change "shirts" (brand Polo)       -> new topic
        saved "running shoes", change "trail running shoes"       -> same item ("running", "shoes" shared)
        saved "hiking boots",  change null ("Only show blue ones") -> same item (no new words)
    Words that only name the change's own brand, color or size don't count, so "Columbia" with brand Columbia
    is a refinement, not a new topic. A synonym ("trainers" after "running shoes") does count as new: the model
    understands synonyms, code only compares words, and the slip summary on the page shows what was kept.
--------------------------------------- */

import type { SlipChange } from './slip-form.ts';
import { contentKeys } from './shopper-words.ts';

export function isNewTopic(savedText: string | null, change: SlipChange): boolean {
  if (change.newSearch || !change.text || !savedText) return false;
  const saved = contentKeys(savedText);
  const named = contentKeys([change.brand, change.color, change.size].filter(Boolean).join(' '));
  const incoming = [...contentKeys(change.text)].filter((key) => !named.has(key));
  return saved.size > 0 && incoming.length > 0 && !incoming.some((key) => saved.has(key));
}
