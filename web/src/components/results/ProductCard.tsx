/* ---------------------------------------
    One product card, drawn entirely from the record: image, brand, title, price or range with the listing count,
    the color and size of the best listing, and the rating. A card the reply talks about gets an accent ring.
    Clicking it opens the details sheet, which grows out of the card.
--------------------------------------- */

import { type CSSProperties, useState } from 'react';
import type { CardView } from '../../api/api-types.ts';

type ProductCardProps = Readonly<{ card: CardView; index: number; onOpen: (card: CardView, anchor: DOMRect) => void }>;

export function ProductCard({ card, index, onOpen }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const variant = [card.colorText, card.sizeText].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      className={`product-card${card.highlighted ? ' is-highlighted' : ''}`}
      style={{ '--card-index': index } as CSSProperties}
      onClick={(event) => onOpen(card, event.currentTarget.getBoundingClientRect())}
      aria-label={`${card.title}, ${card.priceText}${card.highlighted ? ', mentioned in the reply' : ''}`}
    >
      <span className="product-image">
        {card.imageUrl && !imageFailed ? (
          <img src={card.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <span className="product-image-missing">No image</span>
        )}
      </span>
      <span className="product-body">
        {card.brand && <span className="product-brand">{card.brand}</span>}
        <span className="product-title">{card.title}</span>
        <span className="product-price">{card.priceText}</span>
        {variant && <span className="product-variant">{variant}</span>}
        <span className="product-rating">{card.rating === null ? 'No rating yet' : `★ ${card.rating} (${card.ratingCount})`}</span>
        {card.twinWarning && <span className="product-warning">{card.twinWarning}</span>}
      </span>
    </button>
  );
}
