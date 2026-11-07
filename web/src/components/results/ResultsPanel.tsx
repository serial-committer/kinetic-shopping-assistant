/* ---------------------------------------
    The products column: a summary of what the search used (the slip), then up to 8 cards. Before the first search
    it explains where products will appear; after a search with no match it says so (the reply says why).
--------------------------------------- */

import type { CardView, ConversationState } from '../../api/api-types.ts';
import { ProductCard } from './ProductCard.tsx';
import { SlipSummary } from './SlipSummary.tsx';
import './results.css';

type ResultsPanelProps = Readonly<{
  cards: readonly CardView[];
  searched: boolean;
  pending: boolean;
  state: ConversationState | null;
  onOpenCard: (card: CardView, anchor: DOMRect) => void;
  onStartOver: () => void;
}>;

export function ResultsPanel({ cards, searched, pending, state, onOpenCard, onStartOver }: ResultsPanelProps) {
  return (
    <section className="results-panel" aria-label="Products" aria-busy={pending}>
      <div className="results-header">
        <div className="results-title-row">
          <h2 className="results-title">{searched ? `${cards.length} ${cards.length === 1 ? 'product' : 'products'}` : 'Products'}</h2>
          {state && (
            <button type="button" className="pill-button start-over" onClick={onStartOver}>
              New search
            </button>
          )}
        </div>
        {state && <SlipSummary slip={state.slip} excludedCards={state.excludedGroups.length} />}
      </div>
      {!searched && <p className="results-empty">Products the assistant finds will appear here, with their real prices and listings.</p>}
      {searched && cards.length === 0 && <p className="results-empty">No products matched this search.</p>}
      {cards.length > 0 && (
        <div className={`results-grid${pending ? ' is-pending' : ''}`}>
          {cards.map((card, index) => (
            <ProductCard key={card.id} card={card} index={index} onOpen={onOpenCard} />
          ))}
        </div>
      )}
    </section>
  );
}
