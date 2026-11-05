import type { ScopaCard } from '../../api/rooms';
import { cardName } from './cardText';
import { CardFace } from './CardFace';

type ScopaCardButtonProps = {
  card: ScopaCard;
  temporaryHidden?: boolean;
  disabled?: boolean;
  onClick: () => void;
  selected?: boolean;
  suggested?: boolean;
  unavailable?: boolean;
};

export function ScopaCardButton({
  card,
  temporaryHidden = false,
  disabled = false,
  onClick,
  selected = false,
  suggested = false,
  unavailable = false,
}: ScopaCardButtonProps) {
  return (
    <button
      data-card-id={card.id}
      aria-label={cardName(card)}
      aria-pressed={selected}
      className={[
        'scopa-card',
        temporaryHidden ? 'is-move-hidden' : '',
        `scopa-card-${card.suit.toLowerCase()}`,
        selected ? 'is-selected' : '',
        suggested ? 'is-suggested' : '',
        unavailable ? 'is-unavailable' : '',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <CardFace card={card} />
    </button>
  );
}
