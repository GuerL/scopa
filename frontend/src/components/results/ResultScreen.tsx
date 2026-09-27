import type { PlayerSnapshot, ScopaGameSnapshot } from '../../api/rooms';

type ResultScreenProps = {
  busyAction: string | null;
  currentPlayerId: string;
  error: string;
  game: ScopaGameSnapshot;
  onLeave: () => void;
  onNextRound: () => void;
  players: PlayerSnapshot[];
  roomCode: string;
  socketState: string;
};

export function ResultScreen({
  busyAction,
  currentPlayerId,
  error,
  game,
  onLeave,
  onNextRound,
  players,
  roomCode,
  socketState,
}: ResultScreenProps) {
  const result = game.roundResult;
  const left = players.find((player) => player.playerId === result?.leftPlayerId);
  const right = players.find((player) => player.playerId === result?.rightPlayerId);
  const me = game.players.find((player) => player.playerId === currentPlayerId);

  return (
    <main className="game-shell result-shell">
      <section className="result-screen">
        <div className="score-sheet-heading">
          <div>
            <p className="eyebrow">Room {roomCode}</p>
            <h1>Round {game.roundNumber}</h1>
          </div>
          <div className="connection-line compact" role="status">
            <span className={`signal signal-${socketState}`} aria-hidden="true" />
            {socketState === 'live' ? 'Live' : socketState}
          </div>
        </div>

        <div className="score-grid header">
          <strong>Category</strong>
          <strong>{left?.displayName}</strong>
          <strong>{right?.displayName}</strong>
        </div>
        {result?.lines.map((line) => (
          <div className="score-grid" key={line.label}>
            <span>{line.label}</span>
            <span className={line.leftPoints > 0 ? 'awarded' : ''}>
              +{line.leftPoints}
              <small>{line.leftDetail}</small>
            </span>
            <span className={line.rightPoints > 0 ? 'awarded' : ''}>
              +{line.rightPoints}
              <small>{line.rightDetail}</small>
            </span>
          </div>
        ))}
        {result && (
          <div className="score-totals">
            <div className="score-grid total-row">
              <span>Round</span>
              <span>{result.leftRoundPoints}</span>
              <span>{result.rightRoundPoints}</span>
            </div>
            <div className="score-grid total-row grand-total">
              <span>Total</span>
              <span>{result.leftTotalPoints}</span>
              <span>{result.rightTotalPoints}</span>
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onNextRound} disabled={busyAction === 'next-round'}>
            {me?.roundAcknowledged ? 'Waiting for opponent' : 'Next round'}
          </button>
          <button className="secondary" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
            Leave game
          </button>
        </div>
      </section>
    </main>
  );
}
