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
  const me = game.players.find((player) => player.playerId === currentPlayerId);
  const resultPlayers = result?.players ?? [];
  const displayName = (playerId: string) => players.find((player) => player.playerId === playerId)?.displayName ?? 'Player';
  const linePlayer = (line: NonNullable<typeof result>['lines'][number], playerId: string) =>
    line.players.find((player) => player.playerId === playerId);
  const totalFor = (playerId: string) => resultPlayers.find((player) => player.playerId === playerId);
  const gridStyle = { gridTemplateColumns: `1.12fr repeat(${Math.max(resultPlayers.length, 1)}, 1fr)` };

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

        <div className="score-grid header" style={gridStyle}>
          <strong>Category</strong>
          {resultPlayers.map((player) => (
            <strong key={player.playerId}>{displayName(player.playerId)}</strong>
          ))}
        </div>
        {result?.lines.map((line) => (
          <div className="score-grid" key={line.label} style={gridStyle}>
            <span>{line.label}</span>
            {resultPlayers.map((player) => {
              const score = linePlayer(line, player.playerId);
              return (
                <span className={(score?.points ?? 0) > 0 ? 'awarded' : ''} key={player.playerId}>
                  +{score?.points ?? 0}
                  <small>{score?.detail ?? '-'}</small>
                </span>
              );
            })}
          </div>
        ))}
        {result && (
          <div className="score-totals">
            <div className="score-grid total-row" style={gridStyle}>
              <span>Round</span>
              {resultPlayers.map((player) => (
                <span key={player.playerId}>{totalFor(player.playerId)?.roundPoints ?? 0}</span>
              ))}
            </div>
            <div className="score-grid total-row grand-total" style={gridStyle}>
              <span>Total</span>
              {resultPlayers.map((player) => (
                <span key={player.playerId}>{totalFor(player.playerId)?.totalPoints ?? 0}</span>
              ))}
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onNextRound} disabled={busyAction === 'next-round'}>
            {me?.roundAcknowledged ? 'Waiting for players' : 'Next round'}
          </button>
          <button className="secondary" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
            Leave game
          </button>
        </div>
      </section>
    </main>
  );
}
