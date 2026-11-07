/* ---------------------------------------
    The page: header on top, chat on the left, products on the right (stacked on small screens), the product sheet,
    and the debug panel when the server has it switched on. Settings are fetched once at load.
--------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import { fetchSettings, isAbort } from './api/api-client.ts';
import type { AppSettings, CardView } from './api/api-types.ts';
import { ChatPanel } from './components/chat/ChatPanel.tsx';
import { DebugPanel } from './components/debug/DebugPanel.tsx';
import { Header } from './components/header/Header.tsx';
import { ResultsPanel } from './components/results/ResultsPanel.tsx';
import { CardSheet } from './components/sheet/CardSheet.tsx';
import { uiLogger } from './logging/ui-logger.ts';
import { useConversation } from './state/use-conversation.ts';
import { useTheme } from './state/use-theme.ts';

const NO_SETTINGS: AppSettings = { providers: [], debugPanel: false, meaningSearch: false };

export function App() {
  const [settings, setSettings] = useState<AppSettings>(NO_SETTINGS);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<{ card: CardView; anchor: DOMRect } | null>(null);
  const theme = useTheme();
  const conversation = useConversation(providerId);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal)
      .then((loaded) => {
        setSettings(loaded);
        setProviderId(loaded.providers[0]?.id ?? null);
        uiLogger.info('start', 'settings loaded', { providers: loaded.providers.map((provider) => provider.label), meaningSearch: loaded.meaningSearch });
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) uiLogger.error('start', 'settings could not be loaded', { reason: (error as Error).message });
      });
    return () => controller.abort();
  }, []);

  const onOpenCard = useCallback((card: CardView, anchor: DOMRect) => setOpenCard({ card, anchor }), []);
  const onSheetClosed = useCallback(() => setOpenCard(null), []);

  return (
    <div className="app">
      <Header providers={settings.providers} providerId={providerId} onProviderChange={setProviderId} theme={theme.choice} onThemeNext={theme.next} />
      <main className="app-main">
        <ChatPanel items={conversation.items} pending={conversation.pending} onSend={conversation.send} onBrandChoice={conversation.chooseBrand} />
        <ResultsPanel cards={conversation.cards} searched={conversation.searched} pending={conversation.pending} state={conversation.state} onOpenCard={onOpenCard} onStartOver={conversation.reset} />
      </main>
      <CardSheet card={openCard?.card ?? null} anchor={openCard?.anchor ?? null} onClosed={onSheetClosed} />
      {settings.debugPanel && <DebugPanel />}
    </div>
  );
}
