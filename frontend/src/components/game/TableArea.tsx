import type { ScopaCard, ScopaCaptureOption } from '../../api/rooms';
import { ScopaCardButton } from '../cards/ScopaCardButton';

type TableAreaProps = {
  deckRemaining: number;
  lastEvent: string | null;
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
  lastEvent,
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
      <div className={`table-felt ${lastEvent === 'SCOPA' ? 'has-scopa' : ''}`}>
        {lastEvent === 'SCOPA' && <ScopaFeedback />}
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

function ScopaFeedback() {
  return (
    <div className="scopa-flash" role="status">
      <span aria-hidden="true">O</span>
      SCOPA!
      <span aria-hidden="true">O</span>
    </div>
  );
}
