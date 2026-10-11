import { FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getHealth, type HealthResponse } from './api/health';
import {
  createRoom,
  ApiError,
  endGame,
  getGameRoom,
  joinRoom,
  leaveRoom,
  nextRound,
  playCard,
  rematch,
  resumeGame,
  setReady,
  startGame,
  type RoomSession,
  type RoomSnapshot,
} from './api/rooms';
import { LeaveGameDialog } from './components/LeaveGameDialog';
import { PauseGameDialog } from './components/PauseGameDialog';
import { GameScreen } from './components/game/GameScreen';
import { LandingScreen } from './components/lobby/LandingScreen';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { createScopaSocket } from './multiplayer/useScopaSocket';
import './styles/app.css';

const SESSION_STORAGE_KEY = 'scopa.roomSession';
const DISPLAY_NAME_STORAGE_KEY = 'scopa.displayName';
const RESERVED_SESSIONS_STORAGE_KEY = 'scopa.reservedSessions';

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
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const leaveInFlight = useRef(false);
  const leaveTrigger = useRef<HTMLElement | null>(null);
  const lifecycleInFlight = useRef(false);
  const liveSnapshotReceived = useRef(false);
  const [rejoined, setRejoined] = useState(() => Boolean(loadSavedSession() || lastReservedSession()));
  const [backend, setBackend] = useState<BackendState>({ status: 'checking' });
  const [session, setSession] = useState<SavedSession | null>(() => loadSavedSession() ?? lastReservedSession());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [displayName, setDisplayName] = useState(() => loadSavedDisplayName());
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<'idle' | 'connecting' | 'live' | 'offline'>('idle');
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedTableCardIds, setSelectedTableCardIds] = useState<string[]>([]);

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
    saveDisplayName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!session) {
      setRoom(null);
      return;
    }

    saveSession(session);
    liveSnapshotReceived.current = false;
    let cancelled = false;
    getGameRoom(session.roomCode, session.playerId, session.sessionToken)
      .then(snapshot => { if (!cancelled && !liveSnapshotReceived.current) setRoom(snapshot); })
      .catch((unknownError: unknown) => {
        if (cancelled) return;
        setError(errorMessage(unknownError));
        // A network failure must not erase a reserved seat's credentials.
        if (unknownError instanceof ApiError && [400, 404].includes(unknownError.status)) {
          clearSavedSession();
          forgetReservedSession(session.roomCode);
          setSession(null);
        }
      });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session || !room) return;
    if (room.game && room.game.status !== 'MATCH_FINISHED') {
      rememberReservedSession(session);
    } else {
      forgetReservedSession(session.roomCode);
    }
    if (room.game?.status !== 'PAUSED') setRejoined(false);
  }, [session, room?.game?.status]);

  useEffect(() => {
    if (!session) {
      setSocketState('idle');
      return;
    }

    let disposed = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (disposed || !session || leaveInFlight.current) return;
      setSocketState('connecting');
      socket = createScopaSocket(session.roomCode, session.playerId, session.sessionToken);
      socket.addEventListener('message', (event: MessageEvent<string>) => {
        if (!disposed) {
          liveSnapshotReceived.current = true;
          setRoom(JSON.parse(event.data) as RoomSnapshot);
          setSocketState('live');
        }
      });
      socket.addEventListener('close', (event: CloseEvent) => {
        if (disposed) return;
        setSocketState('offline');
        setRejoined(true);
        // Invalid sessions need a new identity, rather than an endless retry.
        if (event.code !== 1003 && !leaveInFlight.current) retry = setTimeout(connect, 1500);
      });
      socket.addEventListener('error', () => {
        if (!disposed) setSocketState('offline');
      });
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [session]);

  useEffect(() => {
    setSelectedHandCardId(null);
    setSelectedTableCardIds([]);
  }, [room?.game?.currentPlayerId, room?.game?.hand.map((card) => card.id).join(',')]);

  const currentPlayer = useMemo(
    () => room?.players.find((player) => player.playerId === session?.playerId) ?? null,
    [room, session],
  );
  const readyToStart = room ? room.players.length >= 2 && room.players.every((player) => player.ready) : false;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('create', async () => {
      enterRoom(await createRoom(displayName.trim()));
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('join', async () => {
      const code = joinCode.trim().toUpperCase();
      const identity = loadReservedSessions()[code];
      let response: RoomSession;
      try {
        response = await joinRoom(code, displayName.trim(), identity);
      } catch (unknownError) {
        if (identity && unknownError instanceof ApiError && [400, 404].includes(unknownError.status)) {
          forgetReservedSession(code);
        }
        throw unknownError;
      }
      setRejoined(Boolean(identity && response.room.game));
      enterRoom(response);
    });
  }

  async function handleReady() {
    if (!session || !currentPlayer) {
      return;
    }

    await runAction('ready', async () => {
      setRoom(await setReady(session.roomCode, session.playerId, session.sessionToken, !currentPlayer.ready));
    });
  }

  async function handleStartGame() {
    if (!session) {
      return;
    }

    await runAction('start', async () => {
      setRoom(await startGame(session.roomCode, session.playerId, session.sessionToken));
    });
  }

  async function handlePlay() {
    if (!session || !selectedHandCardId) {
      return;
    }

    await runAction('play', async () => {
      setRoom(await playCard(session.roomCode, session.playerId, session.sessionToken, selectedHandCardId, selectedTableCardIds));
      setSelectedHandCardId(null);
      setSelectedTableCardIds([]);
    });
  }

  async function handleNextRound() {
    if (!session) {
      return;
    }

    await runAction('next-round', async () => {
      setRoom(await nextRound(session.roomCode, session.playerId, session.sessionToken));
    });
  }

  async function handleRematch() {
    if (!session) {
      return;
    }

    await runAction('rematch', async () => {
      setRoom(await rematch(session.roomCode, session.playerId, session.sessionToken));
    });
  }

  function requestLeave(event?: MouseEvent<HTMLButtonElement>) {
    if (leaveInFlight.current) return;
    leaveTrigger.current = event?.currentTarget
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setLeaveDialogOpen(true);
  }

  function cancelLeave() {
    setLeaveDialogOpen(false);
    leaveTrigger.current?.focus();
  }

  async function confirmLeave() {
    if (leaveInFlight.current) return;
    leaveInFlight.current = true;
    setLeaveDialogOpen(false);
    try {
      await handleLeave();
    } finally {
      leaveInFlight.current = false;
    }
  }

  async function handleLeave() {
    if (!session) {
      return;
    }

    await runAction('leave', async () => {
      await leaveRoom(session.roomCode, session.playerId, session.sessionToken);
      if (room?.game && room.game.status !== 'MATCH_FINISHED') {
        rememberReservedSession(session);
        setJoinCode(session.roomCode);
      } else {
        forgetReservedSession(session.roomCode);
      }
      clearSavedSession();
      setSession(null);
      setRoom(null);
      setSocketState('idle');
    });
  }

  async function handleLifecycle(action: 'resume' | 'end') {
    if (!session || lifecycleInFlight.current) return;
    lifecycleInFlight.current = true;
    try {
      await runAction(action, async () => {
        const handler = action === 'resume' ? resumeGame : endGame;
        setRoom(await handler(session.roomCode, session.playerId, session.sessionToken));
        setRejoined(false);
      });
    } finally {
      lifecycleInFlight.current = false;
    }
  }

  async function copyRoomCode() {
    if (!room) {
      return;
    }

    await navigator.clipboard?.writeText(room.roomCode);
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

  const leaveDialog = leaveDialogOpen && session && room ? (
    <LeaveGameDialog
      active={Boolean(room.game && room.game.status !== 'MATCH_FINISHED')}
      onCancel={cancelLeave}
      onConfirm={confirmLeave}
    />
  ) : null;

  if (session && room?.game) {
    const paused = room.game.status === 'PAUSED'
      || (socketState !== 'live' && room.game.status !== 'MATCH_FINISHED');
    return (
      <>
        <GameScreen
          busyAction={busyAction}
          error={error}
          game={room.game}
          onLeave={requestLeave}
          onNextRound={handleNextRound}
          onPlay={handlePlay}
          onRematch={handleRematch}
          players={room.players}
          roomCode={room.roomCode}
          selectedHandCardId={selectedHandCardId}
          selectedTableCardIds={selectedTableCardIds}
          session={session}
          setSelectedHandCardId={setSelectedHandCardId}
          setSelectedTableCardIds={setSelectedTableCardIds}
          socketState={socketState}
        />
        {paused && <PauseGameDialog
          roomCode={room.roomCode}
          players={room.players}
          host={room.hostPlayerId === session.playerId}
          rejoined={rejoined}
          online={socketState === 'live'}
          busyAction={busyAction}
          error={error}
          onResume={() => handleLifecycle('resume')}
          onEnd={() => handleLifecycle('end')}
          onLeave={requestLeave}
        />}
        {leaveDialog}
      </>
    );
  }

  if (session && room) {
    return (
      <>
        <LobbyScreen
          busyAction={busyAction}
          currentPlayer={currentPlayer}
          error={error}
          onCopyRoom={copyRoomCode}
          onLeave={requestLeave}
          onReady={handleReady}
          onStartGame={handleStartGame}
          players={room.players}
          readyToStart={readyToStart}
          roomCode={room.roomCode}
          socketState={socketState}
        />
        {leaveDialog}
      </>
    );
  }

  return (
    <LandingScreen
      backendMessage={backend.status === 'offline' ? backend.message : undefined}
      backendStatus={backend.status}
      busyAction={busyAction}
      displayName={displayName}
      error={error}
      joinCode={joinCode}
      reservedRoomCode={lastReservedSession()?.roomCode}
      onCreate={handleCreate}
      onDisplayNameChange={setDisplayName}
      onJoin={handleJoin}
      onJoinCodeChange={setJoinCode}
    />
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

function loadReservedSessions(): Record<string, SavedSession> {
  try {
    const value = JSON.parse(localStorage.getItem(RESERVED_SESSIONS_STORAGE_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function lastReservedSession(): SavedSession | null {
  return Object.values(loadReservedSessions()).at(-1) ?? null;
}

function rememberReservedSession(session: SavedSession) {
  const saved = loadReservedSessions();
  saved[session.roomCode] = session;
  localStorage.setItem(RESERVED_SESSIONS_STORAGE_KEY, JSON.stringify(saved));
}

function forgetReservedSession(roomCode: string) {
  const saved = loadReservedSessions();
  delete saved[roomCode];
  localStorage.setItem(RESERVED_SESSIONS_STORAGE_KEY, JSON.stringify(saved));
}

function loadSavedDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '';
}

function saveDisplayName(displayName: string) {
  const trimmedName = displayName.trim();
  if (trimmedName) {
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmedName);
    return;
  }

  localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
}

function errorMessage(unknownError: unknown): string {
  return unknownError instanceof Error ? unknownError.message : 'Something went wrong';
}

export default App;
