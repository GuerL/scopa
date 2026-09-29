import type { ScopaCard } from '../../api/rooms';
import { cardName, suitGlyph } from './cardText';

type ScopaCardButtonProps = {
  card: ScopaCard;
  disabled?: boolean;
  onClick: () => void;
  selected?: boolean;
  suggested?: boolean;
  unavailable?: boolean;
};

export function ScopaCardButton({
  card,
  disabled = false,
  onClick,
  selected = false,
  suggested = false,
  unavailable = false,
}: ScopaCardButtonProps) {
  return (
    <button
      aria-label={cardName(card)}
      aria-pressed={selected}
      className={[
        'scopa-card',
        `scopa-card-${card.suit.toLowerCase()}`,
        selected ? 'is-selected' : '',
        suggested ? 'is-suggested' : '',
        unavailable ? 'is-unavailable' : '',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="card-corner card-corner-top">
        <strong>{card.value}</strong>
        <em>{suitGlyph(card.suit)}</em>
      </span>
      <span className="suit-mark" aria-hidden="true">
        {suitGlyph(card.suit)}
      </span>
      <span className="card-corner card-corner-bottom">
        <strong>{card.value}</strong>
        <em>{suitGlyph(card.suit)}</em>
      </span>
    </button>
  );
}
