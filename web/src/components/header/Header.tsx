/* ---------------------------------------
    The top bar: the app name, the chat model dropdown (only providers set up on the server, or "Search only"),
    and the theme switch.
--------------------------------------- */

import type { ProviderInfo } from '../../api/api-types.ts';
import type { ThemeChoice } from '../../state/use-theme.ts';
import './header.css';

type HeaderProps = Readonly<{
  providers: readonly ProviderInfo[];
  providerId: string | null;
  onProviderChange: (id: string) => void;
  theme: ThemeChoice;
  onThemeNext: () => void;
}>;

const THEME_LABEL: Readonly<Record<ThemeChoice, string>> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

export function Header({ providers, providerId, onProviderChange, theme, onThemeNext }: HeaderProps) {
  return (
    <header className="app-header">
      <h1 className="app-title">Kinetic Shopping Assistant</h1>
      <div className="header-controls">
        <label className="visually-hidden" htmlFor="provider-select">Chat model</label>
        {providers.length > 0 ? (
          <select id="provider-select" className="provider-select" value={providerId ?? ''} onChange={(event) => onProviderChange(event.target.value)}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label} ({provider.model})
              </option>
            ))}
          </select>
        ) : (
          <select id="provider-select" className="provider-select" disabled value="">
            <option value="">Search only</option>
          </select>
        )}
        <button type="button" className="pill-button theme-button" onClick={onThemeNext} aria-label={`Theme: ${THEME_LABEL[theme]}. Click to change.`}>
          {THEME_LABEL[theme]}
        </button>
      </div>
    </header>
  );
}
