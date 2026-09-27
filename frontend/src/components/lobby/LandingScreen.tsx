import type { FormEvent } from 'react';

type BackendStatus = 'checking' | 'connected' | 'offline';

type LandingScreenProps = {
  backendMessage?: string;
  backendStatus: BackendStatus;
  busyAction: string | null;
  displayName: string;
  error: string;
  joinCode: string;
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
  onCreate,
  onDisplayNameChange,
  onJoin,
  onJoinCodeChange,
}: LandingScreenProps) {
  const canSubmit = backendStatus === 'connected' && Boolean(displayName.trim());

  return (
    <main className="app-shell landing-shell">
      <section className="landing" aria-labelledby="app-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Gioco italiano</p>
        <h1 id="app-title">Scopa</h1>
        <p className="subtitle">A warm, tactical card game for two.</p>

        <div className="connection-line" role="status">
          <span className={`signal signal-${backendStatus}`} aria-hidden="true" />
          {backendStatus === 'offline' ? backendMessage ?? 'Offline' : backendStatus === 'checking' ? 'Checking' : 'Online'}
        </div>

        {error && <p className="error">{error}</p>}
        {backendStatus === 'offline' && backendMessage && <p className="error">{backendMessage}</p>}

        <div className="identity-panel">
          <label htmlFor="display-name">Playing as</label>
          <input
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
              Create game
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
              <button type="submit" disabled={!canSubmit || busyAction === 'join'}>
                Join
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
