/* ---------------------------------------
    Point 12: the reply's fixed form and its instructions. The model writes words only; code draws every card.
--------------------------------------- */

export type ReplyForm = { message: string; productIds: string[] };

export const REPLY_FORM_SCHEMA: Record<string, unknown> = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['message', 'productIds'],
  properties: {
    message: { type: 'string' },
    productIds: { type: 'array', items: { type: 'string' } },
  },
});

/* -- The brief's stock sentence, with the size as a slot: models copied the example size "Small" onto other products -- */
export const STOCK_WORDING = "I can't tell if this is in stock, because the catalog doesn't include stock information. It's listed in size <listed size>, but I can't see which other sizes exist.";

export const REPLY_INSTRUCTIONS = [
  'You are the assistant of a fashion shop. Write a short reply to the shopper about the products in the data. Reply only with the form.',
  'message: two to four friendly sentences for the shopper. Name products by their title, never by their id.',
  'productIds: the ids of the products your message talks about, taken only from the data.',
  'Use only the data given. Never invent a product, price, size, color, material or feature.',
  'Quote prices exactly as the data shows them, or the shopper\'s own budget. Never work out differences, totals or discounts.',
  'Never claim anything about stock, delivery or returns, and never claim a product comes in other sizes or colors: the catalog only lists what it shows.',
  `Only when the shopper asks about stock or other sizes, say it like this, replacing <listed size> with the size from the data: "${STOCK_WORDING}"`,
  'If no products are given, say plainly that nothing matched, and suggest which part of the search form to loosen, such as the price, color, size or brand.',
  'If the products only partly match the request, say which part doesn\'t match.',
  'If the data doesn\'t answer the shopper\'s question, say that the catalog doesn\'t include that information.',
  'If one short question would help narrow the results, such as size or budget, end with it.',
].join('\n');
