import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { PlayerSnapshot } from '../api/rooms';

type PauseGameDialogProps = {
  roomCode: string;
  players: PlayerSnapshot[];
  host: boolean;
  rejoined: boolean;
  online: boolean;
  busyAction: string | null;
  error: string;
  onResume: () => void;
  onEnd: () => void;
  onLeave: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PauseGameDialog({
  roomCode, players, host, rejoined, online, busyAction, error, onResume, onEnd, onLeave,
}: PauseGameDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const endButton = useRef<HTMLButtonElement>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const missing = players.filter(player => !player.connected);
  const busy = busyAction !== null;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    heading.current?.focus();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (confirmingEnd) cancelButton.current?.focus();
  }, [confirmingEnd]);

  function cancelEnd() {
    setConfirmingEnd(false);
    // The End button is rendered again after the state update.
    requestAnimationFrame(() => endButton.current?.focus());
  }

  return (
    <dialog
      ref={dialog}
      className="leave-game-dialog pause-game-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-game-title"
      aria-describedby="pause-game-message"
      onCancel={event => {
        event.preventDefault();
        if (confirmingEnd && !busy) cancelEnd();
      }}
    >
      <h2 id="pause-game-title" ref={heading} tabIndex={-1}>
        {confirmingEnd ? 'End current game?' : 'GAME PAUSED'}
      </h2>
      {confirmingEnd ? (
        <>
          <p id="pause-game-message">This unfinished round will not be scored.</p>
          <div className="leave-game-dialog-actions">
            <button ref={cancelButton} className="secondary" type="button" disabled={busy} onClick={cancelEnd}>Cancel</button>
            <button className="leave-game-confirm" type="button" disabled={busy || !online} onClick={onEnd}>End game</button>
          </div>
        </>
      ) : (
        <>
          <div id="pause-game-message" aria-live="polite">
            {rejoined && <p>Rejoined game successfully.</p>}
            {!online && <p>Connecting to the game...</p>}
            {missing.length > 0 ? (
              <>
                <p>Waiting for players to return:</p>
                <ul>{missing.map(player => <li key={player.playerId}>{player.displayName}</li>)}</ul>
              </>
            ) : online ? (
              <p>All players are back.{!host && <><br />Waiting for host to resume...</>}</p>
            ) : null}
          </div>
          <p className="pause-room-code">Room code:<strong>{roomCode}</strong></p>
          <p className="pause-rejoin-hint">Rejoin with this code using the same browser and saved player session.</p>
          <div className="leave-game-dialog-actions pause-game-actions">
            {host && missing.length === 0 && <button type="button" disabled={busy || !online} onClick={onResume}>Resume game</button>}
            <button className="secondary" type="button" disabled={busy} onClick={onLeave}>Leave game</button>
            {host && <button ref={endButton} className="leave-game-confirm" type="button" disabled={busy || !online} onClick={() => setConfirmingEnd(true)}>End game</button>}
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  );
}
