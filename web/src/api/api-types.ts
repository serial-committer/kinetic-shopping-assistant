/* ---------------------------------------
    The shapes the API sends and receives, taken straight from the server's own types (type-only, nothing from the
    server runs in the browser), so the two sides can't drift apart.
--------------------------------------- */

export type { CardView, ListingView } from '../../../server/chat/card-view.ts';
export type { BrandQuestion, ChatTurnResult, TurnKind } from '../../../server/chat/chat-service.ts';
export type { ConversationState } from '../../../server/chat/conversation-state.ts';
export type { LogEntry } from '../../../server/logging/logger.ts';
export type { LogLevel } from '../../../server/logging/log-levels.ts';
export type { BrandChoice } from '../../../server/slip/brand-gate.ts';
export type { Slip } from '../../../server/slip/slip-types.ts';

export type ProviderInfo = Readonly<{ id: string; label: string; model: string }>;

export type AppSettings = Readonly<{ providers: readonly ProviderInfo[]; debugPanel: boolean; meaningSearch: boolean }>;
