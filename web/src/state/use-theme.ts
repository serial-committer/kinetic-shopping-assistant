/* ---------------------------------------
    Light, dark, or follow the system (the default). The choice is a convenience kept in this browser only;
    if storage is blocked, the page still works and simply follows the system.
--------------------------------------- */

import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'kinetic-shopping-theme';
const ORDER: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function useTheme(): { choice: ThemeChoice; next: () => void } {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredChoice);

  useEffect(() => {
    if (choice === 'auto') delete document.documentElement.dataset['theme'];
    else document.documentElement.dataset['theme'] = choice;
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* -- Storage blocked: the choice lasts for this visit only -- */
    }
  }, [choice]);

  const next = useCallback(() => setChoice(nextThemeChoice), []);
  return { choice, next };
}

/* -- Auto, then Light, then Dark, then back to Auto -- */
export function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
}
