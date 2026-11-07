/* ---------------------------------------
    Point 6: one call to the chosen chat model, which must answer with the slip form.
    The model gets the tested instructions plus the current slip, the cards on screen and the last few turns.
--------------------------------------- */

import type { ChatProvider } from '../chat/chat-provider.ts';
import { logger } from '../logging/logger.ts';
import { readSlipForm } from './read-slip-form.ts';
import { type SlipForm, SLIP_FORM_SCHEMA } from './slip-form.ts';
import { buildSlipInput, type HistoryTurn, SLIP_INSTRUCTIONS, type ScreenLine } from './slip-prompt.ts';
import type { Slip } from './slip-types.ts';

export async function fillSlip(provider: ChatProvider, slip: Slip, screen: readonly ScreenLine[], history: readonly HistoryTurn[], message: string, signal?: AbortSignal): Promise<SlipForm> {
  const input = buildSlipInput(slip, screen, history, message);
  logger.debug('P6', 'slip request', { provider: provider.label, model: provider.model, input });
  const started = performance.now();
  const json = await provider.completeJson({ purpose: 'slip', instructions: SLIP_INSTRUCTIONS, input, schemaName: 'slip', schema: SLIP_FORM_SCHEMA, signal });
  const { form, problems } = readSlipForm(json);
  logger.debug('P6', 'slip response', { form, ms: Math.round(performance.now() - started) });
  if (problems.length) logger.warn('P6', 'slip boxes broke the schema and were dropped', { problems });
  return form;
}
