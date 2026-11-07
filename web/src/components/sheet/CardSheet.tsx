/* ---------------------------------------
    A product's details, in a sheet that grows out of its card: every listing (the ones that passed the filters
    first, the rest under "Other listings"), the twin warning, material, features and the description excerpt.
    Prices are shown exactly as listed; a twin is marked, never averaged.
--------------------------------------- */

import type { CardView, ListingView } from '../../api/api-types.ts';
import { useAnchoredDialog } from '../../motion/use-anchored-dialog.ts';
import './sheet.css';

type CardSheetProps = Readonly<{ card: CardView | null; anchor: DOMRect | null; onClosed: () => void }>;

export function CardSheet({ card, anchor, onClosed }: CardSheetProps) {
  const { dialogRef, requestClose, onCancel, onBackdropClick } = useAnchoredDialog(card !== null, anchor, onClosed);
  return (
    <dialog ref={dialogRef} className="glass-dialog card-sheet" aria-label={card?.title ?? 'Product details'} onCancel={onCancel} onClick={onBackdropClick}>
      {card && (
        <div className="sheet-content">
          <div className="sheet-image">{card.imageUrl ? <img src={card.imageUrl} alt={card.title} referrerPolicy="no-referrer" /> : <span>No image</span>}</div>
          <div className="sheet-details">
            <div className="sheet-heading">
              <div>
                {card.brand && <p className="sheet-brand">{card.brand}</p>}
                <h2 className="sheet-title">{card.title}</h2>
              </div>
              <button type="button" className="pill-button sheet-close" onClick={requestClose}>Close</button>
            </div>
            <p className="sheet-price">{card.priceText}</p>
            <p className="sheet-meta">{card.rating === null ? 'No rating yet' : `★ ${card.rating} from ${card.ratingCount} ratings`}</p>
            {card.twinWarning && <p className="sheet-warning">{card.twinWarning}</p>}

            <ListingTable title="Listings that match" listings={card.listings} />
            {card.otherListings.length > 0 && <ListingTable title="Other listings" listings={card.otherListings} />}

            {card.material && (
              <section className="sheet-section">
                <h3>Material</h3>
                <p>{card.material}</p>
              </section>
            )}
            {card.features.length > 0 && (
              <section className="sheet-section">
                <h3>Features</h3>
                <ul>
                  {card.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </section>
            )}
            {card.description && (
              <section className="sheet-section">
                <h3>Description</h3>
                <p>{card.description}</p>
              </section>
            )}
            <p className="sheet-footnote">The catalog has no stock information, and it only lists the sizes and colors shown here.</p>
          </div>
        </div>
      )}
    </dialog>
  );
}

function ListingTable({ title, listings }: Readonly<{ title: string; listings: readonly ListingView[] }>) {
  return (
    <section className="sheet-section">
      <h3>{title}</h3>
      <table className="listing-table">
        <thead>
          <tr>
            <th scope="col">Color</th>
            <th scope="col">Size</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td>{listing.colorText || 'Not listed'}</td>
              <td>{listing.sizeText || 'Not listed'}</td>
              <td className="listing-price">
                {listing.price === null ? 'Not listed' : `$${listing.price}`}
                {listing.isTwin && <span className="twin-mark"> (same color and size, other price)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
