import type { PlayerSnapshot } from '../../api/rooms';

type LobbyScreenProps = {
  busyAction: string | null;
  currentPlayer: PlayerSnapshot | null;
  error: string;
  onCopyRoom: () => void;
  onLeave: () => void;
  onReady: () => void;
  onStartGame: () => void;
  players: PlayerSnapshot[];
  readyToStart: boolean;
  roomCode: string;
  socketState: string;
};

export function LobbyScreen({
  busyAction,
  currentPlayer,
  error,
  onCopyRoom,
  onLeave,
  onReady,
  onStartGame,
  players,
  readyToStart,
  roomCode,
  socketState,
}: LobbyScreenProps) {
  return (
    <main className="app-shell lobby-shell">
      <section className="lobby" aria-labelledby="room-title">
        <div className="topline">
          <p className="eyebrow">Private room</p>
          <div className="connection-line compact" role="status">
            <span className={`signal signal-${socketState}`} aria-hidden="true" />
            {socketState === 'live' ? 'Live' : socketState}
          </div>
        </div>

        <div className="room-code-block">
          <span>Room</span>
          <h1 id="room-title">{roomCode}</h1>
          <button className="text-button" type="button" onClick={onCopyRoom}>
            Copy code
          </button>
        </div>

        <div className="players" aria-label="Players">
          {players.map((player) => (
            <article className={`player-row ${player.ready ? 'is-ready' : ''}`} key={player.playerId}>
              <div>
                <strong>{player.displayName}</strong>
                <div className="badges">
                  {player.host && <span>Host</span>}
                  <span>{player.ready ? 'Ready' : 'Not ready'}</span>
                  <span>{player.connected ? 'Online' : 'Away'}</span>
                </div>
              </div>
              {player.playerId === currentPlayer?.playerId && <span className="you">You</span>}
            </article>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions lobby-actions">
          <button type="button" onClick={onReady} disabled={busyAction === 'ready'}>
            {currentPlayer?.ready ? 'Not ready' : 'Ready'}
          </button>
          {currentPlayer?.host && (
            <button type="button" onClick={onStartGame} disabled={!readyToStart || busyAction === 'start'}>
              Start game
            </button>
          )}
          <button className="secondary" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
            Leave room
          </button>
        </div>
      </section>
    </main>
  );
}
