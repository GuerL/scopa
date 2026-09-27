import type { PlayerSnapshot, ScopaGameSnapshot, ScopaPlayerPublicSnapshot } from '../../api/rooms';
import { scoreText } from '../game/gameUi';

type WinnerScreenProps = {
  busyAction: string | null;
  error: string;
  game: ScopaGameSnapshot;
  myGame: ScopaPlayerPublicSnapshot | null;
  onLeave: () => void;
  onRematch: () => void;
  players: PlayerSnapshot[];
  roomCode: string;
};

export function WinnerScreen({
  busyAction,
  error,
  game,
  myGame,
  onLeave,
  onRematch,
  players,
  roomCode,
}: WinnerScreenProps) {
  const winner = players.find((player) => player.playerId === game.winnerPlayerId);

  return (
    <main className="game-shell winner-shell">
      <section className="winner-screen">
        <div className="laurel" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="eyebrow">Room {roomCode}</p>
        <h1>{winner?.displayName ?? 'Winner'} wins</h1>
        <p className="scoreline">{scoreText(game, players)}</p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onRematch} disabled={busyAction === 'rematch'}>
            {myGame?.rematchRequested ? 'Waiting for rematch' : 'Rematch'}
          </button>
          <button className="secondary" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
            Leave game
          </button>
        </div>
      </section>
    </main>
  );
}
