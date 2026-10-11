import type { ScopaCard, ScopaCaptureOption } from '../../api/rooms';
import { ScopaCardButton } from '../cards/ScopaCardButton';

type TableAreaProps = {
  deckRemaining: number;
  mustCapture: boolean;
  onSelectTableCard: (cardId: string) => void;
  roundNumber: number;
  selectedHandCardId: string | null;
  selectedOptions: ScopaCaptureOption[];
  selectedTableCardIds: string[];
  tableCards: ScopaCard[];
};

export function TableArea({
  deckRemaining,
  mustCapture,
  onSelectTableCard,
  roundNumber,
  selectedHandCardId,
  selectedOptions,
  selectedTableCardIds,
  tableCards,
}: TableAreaProps) {
  return (
    <section className="table-zone" aria-label="Table cards">
      <div className="round-meta">
        <span>Round {roundNumber}</span>
        <span>Deck {deckRemaining}</span>
      </div>
      <div className="table-felt">
        <div className="cards table-cards">
          {tableCards.length === 0 && <p className="muted">The table is clear.</p>}
          {tableCards.map((card) => {
            const suggested = selectedOptions.some((option) => option.tableCardIds.includes(card.id));
            return (
              <ScopaCardButton
                card={card}
                disabled={!selectedHandCardId || !mustCapture || !suggested}
                key={card.id}
                onClick={() => onSelectTableCard(card.id)}
                selected={selectedTableCardIds.includes(card.id)}
                suggested={suggested}
                unavailable={Boolean(selectedHandCardId && mustCapture && !suggested)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
