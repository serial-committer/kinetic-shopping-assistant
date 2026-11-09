/* ---------------------------------------
    The slip test: how well a chat model fills the slip (Point 6), with the app's own merge, word-keeper and gate.
    Usage: npm run slip-test -- [--provider=offline|claude|openai] [--set=first|followups|all]
    - 30 first messages: prints each slip, the brand gate's decision, words put back, and flags any brand or price
      the shopper never typed (for review: the app itself never checks for invented values).
    - 13 follow-ups with three Merrell boots on screen: each is graded against what a correct form must contain.
    Baseline on Offline (qwen2.5:7b, temperature 0): 16 to 17 of 18 brand decisions, 8 of 8 unseen, 11 of 13 follow-ups.
--------------------------------------- */

import { parseArgs } from 'node:util';
import type { ChatProvider } from '../server/chat/chat-provider.ts';
import { createProviderRegistry } from '../server/chat/provider-registry.ts';
import { getConfig } from '../server/config/config.ts';
import { readBrandSheets } from '../server/data/data-service.ts';
import { printLine } from '../server/logging/logger.ts';
import { checkBrand } from '../server/slip/brand-gate.ts';
import { fillSlip } from '../server/slip/fill-slip.ts';
import { keepShopperWords } from '../server/slip/keep-words.ts';
import { mergeSlip } from '../server/slip/merge-slip.ts';
import { moveNamedBrand } from '../server/slip/named-brand.ts';
import type { SlipChange, SlipForm } from '../server/slip/slip-form.ts';
import type { ScreenLine } from '../server/slip/slip-prompt.ts';
import { EMPTY_SLIP, SLIP_BOXES, type Slip } from '../server/slip/slip-types.ts';

const { values } = parseArgs({ options: { provider: { type: 'string' }, set: { type: 'string' } } });
const registry = createProviderRegistry(getConfig());
const provider = registry.find(values.provider ?? 'offline') ?? registry.list()[0];
if (!provider) {
  printLine('No chat provider is set up in .env, so there is nothing to test.');
  process.exit(1);
}
const sheets = readBrandSheets();
const brandSheets = { brandCounts: new Map(Object.entries(sheets.brandCounts)), otherTitleCounts: new Map(Object.entries(sheets.otherTitleCounts)) };

const FIRST_MESSAGES = [
  'Show me Nike shoes', 'merrell hiking shoes under $100', 'Columbia jackets under $80', 'north face fleece',
  'Under Armour shorts in blue', 'Life is Good t-shirt', 'Oakley sunglasses', 'Fox racing gloves',
  'gore-tex boots for men', 'merino wool socks', 'warm gloves for skiing', 'an orange dress I can wear to a party and at work',
  'something for a beach wedding', 'an ordinary white t-shirt', 'Ordinary brand t-shirts', 'a polo shirt',
  'Polo brand shirts', 'a new bracelet', 'I need something for my sister', 'help me find a gift',
  "Levi's jeans under $50", 'waterproof hiking boots in brown', 'Calvin Klein boxers', 'a linen shirt for a summer wedding',
  'cheap running socks', 'Carhartt beanie', 'something warm for my dad', 'black leather belt for work',
  'Show me running shoes under $120.', "I'm looking for orange running shorts in size small.",
];

type Expectation = { action: SlipForm['action']; cheaperThanShown?: boolean; color?: string; clears?: keyof Slip; size?: string; gender?: string; sort?: string; newSearch?: boolean; textHas?: string; brand?: string; orSort?: string };

const FOLLOW_UPS: Array<{ message: string; expect: Expectation }> = [
  { message: 'Anything cheaper?', expect: { action: 'search', cheaperThanShown: true } },
  { message: 'Only show blue ones', expect: { action: 'search', color: 'blue' } },
  { message: 'Is the second one waterproof?', expect: { action: 'answer' } },
  { message: 'Which of these is cheapest?', expect: { action: 'answer', orSort: 'price_low' } },
  { message: 'Does the first one come in red?', expect: { action: 'answer' } },
  { message: 'Tell me more about the third one', expect: { action: 'answer' } },
  { message: 'Any price is fine', expect: { action: 'search', clears: 'maxPrice' } },
  { message: 'In size 9.5', expect: { action: 'search', size: '9.5' } },
  { message: 'Only for women', expect: { action: 'search', gender: 'women' } },
  { message: 'Sort by best rated', expect: { action: 'search', sort: 'rating' } },
  { message: 'Actually, show me sandals instead', expect: { action: 'search', newSearch: true, textHas: 'sandal' } },
  { message: 'What about Columbia?', expect: { action: 'search', brand: 'columbia', newSearch: false } },
  { message: 'Forget the brand', expect: { action: 'search', clears: 'brand' } },
];

const SCREEN: ScreenLine[] = [
  { title: "Merrell Men's Moab 3 Mid Waterproof Hiking Boot", color: 'brown', price: '$129.99' },
  { title: "Merrell Women's Siren Edge 3 Hiking Shoe", color: 'grey', price: '$89.95' },
  { title: "Merrell Men's Moab Vertex Mid Waterproof Work Boot", color: 'black', price: '$139.00' },
];
const FOLLOW_UP_SLIP: Slip = { ...EMPTY_SLIP, text: 'hiking boots', brand: 'Merrell', maxPrice: 150 };

const set = values.set ?? 'all';
const times: number[] = [];
printLine(`Slip test on ${provider.label} (${provider.model})`);
if (set === 'first' || set === 'all') await runFirstMessages(provider);
if (set === 'followups' || set === 'all') await runFollowUps(provider);
times.sort((a, b) => a - b);
printLine(`middle time ${Math.round(times[Math.floor(times.length / 2)] ?? 0)} ms over ${times.length} calls`);

async function timedFill(chat: ChatProvider, slip: Slip, screen: ScreenLine[], message: string): Promise<SlipForm> {
  const started = performance.now();
  const form = await fillSlip(chat, slip, screen, [], message);
  times.push(performance.now() - started);
  return form;
}

async function runFirstMessages(chat: ChatProvider): Promise<void> {
  printLine('\n--- first messages ---');
  for (const message of FIRST_MESSAGES) {
    const form = await timedFill(chat, EMPTY_SLIP, [], message);
    if (form.action !== 'search' || !form.change) {
      printLine(`${message} | ${form.action.toUpperCase()} "${form.question ?? ''}"`);
      continue;
    }
    const moved = moveNamedBrand(mergeSlip(EMPTY_SLIP, form.change, 0, message).slip, form.change, message, brandSheets);
    const { slip, putBack } = keepShopperWords(message, moved.slip);
    const decision = checkBrand(slip.brand, brandSheets);
    const gate = decision.kind === 'none' ? 'no brand' : decision.kind === 'words' ? `back to words "${decision.word}"` : decision.kind === 'ask' ? `ask first "${decision.name}" ${decision.own}/${decision.elsewhere}` : `filter "${decision.name}"`;
    const boxes = SLIP_BOXES.filter((box) => box !== 'text' && box !== 'brand' && slip[box] !== null).map((box) => `${box} ${slip[box]}`);
    const flags = notTyped(message, form.change);
    printLine(`${message} | ${gate} | text "${slip.text}"${putBack.length ? ` (put back: ${putBack.join(', ')})` : ''}${boxes.length ? ` | ${boxes.join(' | ')}` : ''}${flags.length ? ` | NOT TYPED: ${flags.join(', ')}` : ''}`);
  }
}

async function runFollowUps(chat: ChatProvider): Promise<void> {
  printLine('\n--- follow-ups, with three Merrell boots on screen ---');
  let right = 0;
  for (const { message, expect } of FOLLOW_UPS) {
    const form = await timedFill(chat, FOLLOW_UP_SLIP, SCREEN, message);
    const merged = form.change ? moveNamedBrand(mergeSlip(FOLLOW_UP_SLIP, form.change, SCREEN.length, message).slip, form.change, message, brandSheets).slip : FOLLOW_UP_SLIP;
    const slip = form.action === 'search' ? keepShopperWords(message, merged).slip : merged;
    const misses = grade(form, slip, expect);
    if (misses.length === 0) right += 1;
    const shown = form.action === 'search' ? JSON.stringify(Object.fromEntries(Object.entries(slip).filter(([, value]) => value !== null))) : form.action === 'ask' ? `"${form.question}"` : '';
    printLine(`${misses.length ? 'MISS' : 'OK  '} ${message} | ${form.action} ${shown}${form.change?.cheaperThanShown ? ' | cheaper' : ''}${misses.length ? ` | ${misses.join('; ')}` : ''}`);
  }
  printLine(`\nfollow-ups right: ${right} of ${FOLLOW_UPS.length}`);
}

function grade(form: SlipForm, slip: Slip, expect: Expectation): string[] {
  /* -- Re-sorting by price is also a fair way to show the cheapest -- */
  if (expect.orSort && form.action === 'search' && slip.sort === expect.orSort) return [];
  const misses: string[] = [];
  const change = form.change;
  if (form.action !== expect.action) misses.push(`action ${form.action}`);
  if (expect.cheaperThanShown && change?.cheaperThanShown !== true) misses.push('cheaperThanShown');
  if (expect.color && slip.color !== expect.color) misses.push(`color ${slip.color}`);
  if (expect.clears && slip[expect.clears] !== null) misses.push(`${expect.clears} still ${slip[expect.clears]}`);
  if (expect.size && String(slip.size ?? '').replace(/\s/g, '') !== expect.size) misses.push(`size ${slip.size}`);
  if (expect.gender && slip.gender !== expect.gender) misses.push(`gender ${slip.gender}`);
  if (expect.sort && slip.sort !== expect.sort) misses.push(`sort ${slip.sort}`);
  if (expect.newSearch !== undefined && Boolean(change?.newSearch) !== expect.newSearch) misses.push(`newSearch ${change?.newSearch}`);
  if (expect.textHas && !String(slip.text ?? '').toLowerCase().includes(expect.textHas)) misses.push(`text ${slip.text}`);
  if (expect.brand && String(slip.brand ?? '').toLowerCase() !== expect.brand) misses.push(`brand ${slip.brand}`);
  return misses;
}

/* -- A brand or price the shopper never typed, shown for review only -- */
function notTyped(message: string, change: SlipChange): string[] {
  const typed = new Set(message.toLowerCase().split(/[^a-z0-9'’.-]+/).map((word) => word.replace(/^\.+|\.+$/g, '').replace(/['’-]/g, '')).filter(Boolean));
  const flags: string[] = [];
  if (change.brand && change.brand.toLowerCase().split(/\s+/).some((word) => !typed.has(word.replace(/['’-]/g, '')))) flags.push(`brand ${change.brand}`);
  for (const box of ['minPrice', 'maxPrice'] as const) if (change[box] !== null && !typed.has(String(change[box]))) flags.push(`${box} ${change[box]}`);
  return flags;
}
