import type { PlayerSnapshot, ScopaCard, ScopaPlayerPublicSnapshot } from '../../api/rooms';
import { ScopaCardButton } from '../cards/ScopaCardButton';

type PlayerHandProps = {
  busyAction: string | null;
  canPlay: boolean;
  error: string;
  isMyTurn: boolean;
  moveHint: string;
  myGame: ScopaPlayerPublicSnapshot | null;
  onCancelSelection: () => void;
  onLeave: () => void;
  onPlay: () => void;
  onSelectHandCard: (cardId: string) => void;
  player: PlayerSnapshot | undefined;
  selectedHandCardId: string | null;
  hand: ScopaCard[];
};

export function PlayerHand({
  busyAction,
  canPlay,
  error,
  isMyTurn,
  moveHint,
  myGame,
  onCancelSelection,
  onLeave,
  onPlay,
  onSelectHandCard,
  player,
  selectedHandCardId,
  hand,
}: PlayerHandProps) {
  return (
    <footer className={`player-zone ${isMyTurn ? 'is-active' : ''}`}>
      <div className="turn-banner">
        <span>{isMyTurn ? 'Your turn' : 'Waiting'}</span>
      </div>
      <div className="cards hand-cards">
        {hand.map((card) => (
          <ScopaCardButton
            card={card}
            disabled={!isMyTurn}
            key={card.id}
            onClick={() => onSelectHandCard(card.id)}
            selected={selectedHandCardId === card.id}
          />
        ))}
      </div>
      {selectedHandCardId && (
        <div className="move-panel">
          <p>{moveHint}</p>
          <button type="button" onClick={onPlay} disabled={!canPlay || busyAction === 'play'}>
            Play card
          </button>
          <button className="secondary" type="button" onClick={onCancelSelection}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="my-summary">
        <div>
          <strong>{player?.displayName ?? 'You'}</strong>
          <p>
            {myGame?.totalPoints ?? 0} pts · {myGame?.scopasThisRound ?? 0}{' '}
            {myGame?.scopasThisRound === 1 ? 'scopa' : 'scope'} · {myGame?.capturedCount ?? 0} captured
          </p>
        </div>
        <button className="secondary compact-button" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
          Leave
        </button>
      </div>
    </footer>
  );
}
