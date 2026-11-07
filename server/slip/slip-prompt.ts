/* ---------------------------------------
    Point 6: the instructions that turn a shopper message into the slip, and the input each message carries.
    The wording is the tested version: it describes every box, keeps describing words, and gives one example that is
    not a test request. On the local model it scored 16 to 17 of 18 brand decisions, 8 of 8 unseen requests and
    11 of 13 follow-ups. Change it only together with a slip-test run (npm run slip-test).
--------------------------------------- */

import type { Slip } from './slip-types.ts';

export const SLIP_INSTRUCTIONS = [
  'You turn a shopper message into a search form for a fashion shop. Reply only with the form.',
  'action is "search" when you can search, and "answer" when the shopper asks about the products already on screen, such as what they are made of, how they compare, or whether they come in another colour or size.',
  'action is "ask" only when the message is too vague to search at all. A message that names any item is never too vague.',
  'question is one short question when action is "ask", otherwise null.',
  'change holds the search fields when action is "search", otherwise null.',
  'Any box you leave null keeps its current value.',
  'Fill change like this:',
  '- brand: the company or label if the shopper names one, otherwise null.',
  '- color: the colour if the shopper names one, otherwise null.',
  '- size: the size if the shopper names one, such as S, M, L, XL or a shoe size like 9.5, otherwise null.',
  '- gender: women, men, girls, boys, baby or unisex if the shopper says who it is for, otherwise null.',
  '- minPrice and maxPrice: the price limits if the shopper names them, otherwise null.',
  '- sort: price_low, price_high or rating if the shopper asks for an order, otherwise null.',
  '- text: the item and every word that describes it, such as material, use, occasion or style. Leave out only the brand, colour, size, price and filler words such as "show me" or "I want". Use null when the shopper is only refining the current item.',
  '- cheaperThanShown: true only when the shopper asks for something cheaper than what is on screen. Then leave minPrice and maxPrice null, because the shop works out the price.',
  '- clear: the boxes whose limit the shopper no longer wants, for example ["maxPrice"] for "no price limit" or ["color"] for "any colour", otherwise [].',
  '  When the shopper says any price, any colour, any size or any brand is fine, or asks to forget one of them, put that box in clear.',
  '- newSearch: true when the shopper switches to a different kind of item, for example "actually, I want a jacket", otherwise false.',
  'Example: "show me red Adidas trainers for trail running under $60" gives brand "Adidas", color "red", maxPrice 60, text "trainers for trail running".',
].join('\n');

/* -- One product on screen, as the slip model sees it: number, title, color, price -- */
export type ScreenLine = Readonly<{ title: string; color: string; price: string }>;

/* -- A past turn in the chat, oldest first -- */
export type HistoryTurn = Readonly<{ role: 'shopper' | 'assistant'; text: string }>;

/* -- The current slip as JSON, the cards on screen, the last few turns, then the new message -- */
export function buildSlipInput(slip: Slip, screen: readonly ScreenLine[], history: readonly HistoryTurn[], message: string): string {
  const products = screen.length ? screen.map((line, index) => `${index + 1}. ${line.title}, ${line.color || 'color not listed'}, ${line.price}`).join('\n') : 'none';
  const recent = history.length ? `Recent conversation:\n${history.map((turn) => `${turn.role === 'shopper' ? 'Shopper' : 'Assistant'}: ${turn.text}`).join('\n')}\n\n` : '';
  return `${recent}Current search form: ${JSON.stringify(slip)}\nProducts on screen:\n${products}\n\nShopper: ${message}`;
}
