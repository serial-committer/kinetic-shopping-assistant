/* ---------------------------------------
    The theme button's icon: a half-filled circle for Auto (follows the system), a sun for Light, a moon for Dark.
    Drawn with currentColor so it matches the button text in both themes.
--------------------------------------- */

import type { ThemeChoice } from '../../state/use-theme.ts';

export function ThemeIcon({ theme }: Readonly<{ theme: ThemeChoice }>) {
  return (
    <svg key={theme} className="theme-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {theme === 'auto' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
        </>
      )}
      {theme === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </>
      )}
      {theme === 'dark' && <path d="M20.5 13.4A8.5 8.5 0 1 1 10.6 3.5a6.6 6.6 0 0 0 9.9 9.9z" />}
    </svg>
  );
}
