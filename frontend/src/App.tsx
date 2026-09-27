import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getHealth, type HealthResponse } from './api/health';
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  setReady,
  type RoomSession,
  type RoomSnapshot,
} from './api/rooms';
import { createScopaSocket } from './multiplayer/useScopaSocket';
import './styles/app.css';

const SESSION_STORAGE_KEY = 'scopa.roomSession';

type BackendState =
  | { status: 'checking' }
  | { status: 'connected'; health: HealthResponse }
  | { status: 'offline'; message: string };

type SavedSession = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
};

function App() {
  const [backend, setBackend] = useState<BackendState>({ status: 'checking' });
  const [session, setSession] = useState<SavedSession | null>(() => loadSavedSession());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<'idle' | 'connecting' | 'live' | 'offline'>('idle');

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then((health) => setBackend({ status: 'connected', health }))
      .catch((unknownError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setBackend({
          status: 'offline',
          message: unknownError instanceof Error ? unknownError.message : 'Backend unavailable',
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!session) {
      setRoom(null);
      return;
    }

    saveSession(session);
    getRoom(session.roomCode)
      .then(setRoom)
      .catch((unknownError: unknown) => {
        setError(errorMessage(unknownError));
        clearSavedSession();
        setSession(null);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      setSocketState('idle');
      return;
    }

    setSocketState('connecting');
    const socket = createScopaSocket(session.roomCode, session.playerId, session.sessionToken);

    socket.addEventListener('open', () => setSocketState('live'));
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      setRoom(JSON.parse(event.data) as RoomSnapshot);
    });
    socket.addEventListener('close', () => setSocketState('offline'));
    socket.addEventListener('error', () => setSocketState('offline'));

    return () => socket.close();
  }, [session]);

  const currentPlayer = useMemo(
    () => room?.players.find((player) => player.playerId === session?.playerId) ?? null,
    [room, session],
  );
  const bothPlayersReady = room?.players.length === 2 && room.players.every((player) => player.ready);
  const backendLabel =
    backend.status === 'connected'
      ? 'Connected'
      : backend.status === 'checking'
        ? 'Checking...'
        : 'Offline';

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('create', async () => {
      const response = await createRoom(displayName);
      enterRoom(response);
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('join', async () => {
      const response = await joinRoom(joinCode.trim().toUpperCase(), joinDisplayName);
      enterRoom(response);
    });
  }

  async function handleReady() {
    if (!session || !currentPlayer) {
      return;
    }

    await runAction('ready', async () => {
      const updatedRoom = await setReady(
        session.roomCode,
        session.playerId,
        session.sessionToken,
        !currentPlayer.ready,
      );
      setRoom(updatedRoom);
    });
  }

  async function handleLeave() {
    if (!session) {
      return;
    }

    await runAction('leave', async () => {
      await leaveRoom(session.roomCode, session.playerId, session.sessionToken);
      clearSavedSession();
      setSession(null);
      setRoom(null);
      setSocketState('idle');
    });
  }

  async function runAction(action: string, callback: () => Promise<void>) {
    setError('');
    setBusyAction(action);
    try {
      await callback();
    } catch (unknownError: unknown) {
      setError(errorMessage(unknownError));
    } finally {
      setBusyAction(null);
    }
  }

  function enterRoom(response: RoomSession) {
    setSession({
      roomCode: response.roomCode,
      playerId: response.playerId,
      sessionToken: response.sessionToken,
    });
    setRoom(response.room);
  }

  if (session && room) {
    return (
      <main className="app-shell lobby-shell">
        <section className="lobby" aria-labelledby="room-title">
          <div className="topline">
            <p className="eyebrow">Lobby</p>
            <div className={`status compact status-${socketState}`} role="status">
              <span aria-hidden="true" />
              Live: {socketState === 'live' ? 'Connected' : socketState}
            </div>
          </div>

          <h1 id="room-title">{room.roomCode}</h1>
          <p className="room-note">Share this room code with the second player.</p>

          <div className="players" aria-label="Players">
            {room.players.map((player) => (
              <article className="player-row" key={player.playerId}>
                <div>
                  <strong>{player.displayName}</strong>
                  <div className="badges">
                    {player.host && <span>Host</span>}
                    <span>{player.connected ? 'Connected' : 'Disconnected'}</span>
                    <span>{player.ready ? 'Ready' : 'Not ready'}</span>
                  </div>
                </div>
                {player.playerId === session.playerId && <span className="you">You</span>}
              </article>
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <div className="actions lobby-actions">
            <button type="button" onClick={handleReady} disabled={busyAction === 'ready'}>
              {currentPlayer?.ready ? 'Not ready' : 'Ready'}
            </button>
            {currentPlayer?.host && (
              <button type="button" disabled={!bothPlayersReady}>
                Start game
              </button>
            )}
            <button className="secondary" type="button" onClick={handleLeave} disabled={busyAction === 'leave'}>
              Leave room
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="app-title">
        <p className="eyebrow">Italian card game</p>
        <h1 id="app-title">SCOPA</h1>
        <div className={`status status-${backend.status}`} role="status">
          <span aria-hidden="true" />
          Backend: {backendLabel}
        </div>
        {backend.status === 'offline' && <p className="error">{backend.message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="forms">
          <form className="flow" onSubmit={handleCreate}>
            <label htmlFor="create-name">Display name</label>
            <input
              id="create-name"
              maxLength={24}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Player Name"
              required
              value={displayName}
            />
            <button type="submit" disabled={backend.status !== 'connected' || busyAction === 'create'}>
              Create game
            </button>
          </form>

          <form className="flow" onSubmit={handleJoin}>
            <label htmlFor="join-name">Display name</label>
            <input
              id="join-name"
              maxLength={24}
              onChange={(event) => setJoinDisplayName(event.target.value)}
              placeholder="Player Name"
              required
              value={joinDisplayName}
            />
            <label htmlFor="join-code">Room code</label>
            <input
              autoCapitalize="characters"
              id="join-code"
              maxLength={5}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCDE"
              required
              value={joinCode}
            />
            <button type="submit" disabled={backend.status !== 'connected' || busyAction === 'join'}>
              Join game
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function loadSavedSession(): SavedSession | null {
  const value = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SavedSession;
  } catch {
    clearSavedSession();
    return null;
  }
}

function saveSession(session: SavedSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSavedSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function errorMessage(unknownError: unknown): string {
  return unknownError instanceof Error ? unknownError.message : 'Something went wrong';
}

export default App;
