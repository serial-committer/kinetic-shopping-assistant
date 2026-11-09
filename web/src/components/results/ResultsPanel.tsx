/* ---------------------------------------
    The products column: a summary of what the search used (the slip), then the cards, and "Load more" when the
    search has more cards than are on screen (or a note when the screen holds the most cards it can). Before the first search it explains where products will appear;
    after a search with no match it says so (the reply says why).
--------------------------------------- */

import type { CardView, ConversationState } from '../../api/api-types.ts';
import { ProductCard } from './ProductCard.tsx';
import { SlipSummary } from './SlipSummary.tsx';
import './results.css';

type ResultsPanelProps = Readonly<{
  cards: readonly CardView[];
  searched: boolean;
  pending: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  listNote: string | null;
  state: ConversationState | null;
  onOpenCard: (card: CardView, anchor: DOMRect) => void;
  onLoadMore: () => void;
  onStartOver: () => void;
}>;

/* -- Cards arrive 8 at a time; the fade-in stagger restarts for each batch instead of growing with the list -- */
const STAGGER_BATCH = 8;

export function ResultsPanel({ cards, searched, pending, hasMore, loadingMore, listNote, state, onOpenCard, onLoadMore, onStartOver }: ResultsPanelProps) {
  return (
    <section className="results-panel" aria-label="Products" aria-busy={pending || loadingMore}>
      <div className="results-header">
        <div className="results-title-row">
          <h2 className="results-title">{searched ? `${cards.length} ${cards.length === 1 ? 'product' : 'products'}${hasMore ? ' so far' : ''}` : 'Products'}</h2>
          {state && (
            <button type="button" className="pill-button start-over" onClick={onStartOver}>
              New search
            </button>
          )}
        </div>
        {state && <SlipSummary slip={state.screenSlip ?? state.slip} excludedCards={state.excludedGroups.length} />}
      </div>
      {!searched && <p className="results-empty">Products the assistant finds will appear here, with their real prices and listings.</p>}
      {searched && cards.length === 0 && <p className="results-empty">No products matched this search.</p>}
      {cards.length > 0 && (
        <div className={`results-grid${pending ? ' is-pending' : ''}`}>
          {cards.map((card, index) => (
            <ProductCard key={card.id} card={card} index={index % STAGGER_BATCH} onOpen={onOpenCard} />
          ))}
        </div>
      )}
      {cards.length > 0 && hasMore && !pending && (
        <div className="load-more-row">
          <button type="button" className="pill-button load-more" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
      {cards.length > 0 && !hasMore && listNote && !pending && (
        <div className="load-more-row">
          <p className="load-more-note">{listNote}</p>
        </div>
      )}
    </section>
  );
}
