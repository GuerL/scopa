import type { FormEvent } from 'react';

type BackendStatus = 'checking' | 'connected' | 'offline';

type LandingScreenProps = {
  backendMessage?: string;
  backendStatus: BackendStatus;
  busyAction: string | null;
  displayName: string;
  error: string;
  joinCode: string;
  reservedRoomCode?: string;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDisplayNameChange: (name: string) => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
  onJoinCodeChange: (code: string) => void;
};

export function LandingScreen({
  backendMessage,
  backendStatus,
  busyAction,
  displayName,
  error,
  joinCode,
  reservedRoomCode,
  onCreate,
  onDisplayNameChange,
  onJoin,
  onJoinCodeChange,
}: LandingScreenProps) {
  const canSubmit = backendStatus === 'connected' && Boolean(displayName.trim());

  return (
    <main className="app-shell landing-shell">
      <section className="landing" aria-labelledby="app-title">
        <header className="landing-branding">
          <img className="landing-logo" src="/qvb-logo.svg" alt="qvb." width="56" height="36" />
          <p className="landing-category">Gioco italiano</p>
          <h1 id="app-title">Scopa <span className="title-word">Online<span className="title-dot">.</span></span></h1>
          <p className="landing-description">The Italian card game. A table with friends.</p>
        </header>

        <div className="connection-line" role="status" title={backendMessage}>
          <span className={`signal signal-${backendStatus}`} aria-hidden="true" />
          {backendStatus === 'offline' ? 'Offline' : backendStatus === 'checking' ? 'Checking' : 'Online'}
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {reservedRoomCode && <p role="status">Your seat in room <strong>{reservedRoomCode}</strong> is reserved. Enter that code to rejoin with your saved player session.</p>}

        <div className="identity-panel">
          <label htmlFor="display-name">Playing as</label>
          <input
            autoComplete="nickname"
            id="display-name"
            maxLength={24}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Player name"
            required
            value={displayName}
          />
        </div>

        <div className="landing-actions">
          <form className="create-flow" onSubmit={onCreate}>
            <button type="submit" disabled={!canSubmit || busyAction === 'create'}>
              Create Room
            </button>
          </form>

          <form className="join-flow" onSubmit={onJoin}>
            <label htmlFor="join-code">Room code</label>
            <div className="join-row">
              <input
                autoCapitalize="characters"
                id="join-code"
                maxLength={5}
                onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
                placeholder="A7K3Q"
                required
                value={joinCode}
              />
              <button className="secondary" type="submit" disabled={!canSubmit || busyAction === 'join'}>
                Join Room
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
