import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getHealth, type HealthResponse } from './api/health';
import {
  createRoom,
  getGameRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  nextRound,
  playCard,
  rematch,
  setReady,
  startGame,
  type RoomSession,
  type RoomSnapshot,
} from './api/rooms';
import { GameScreen } from './components/game/GameScreen';
import { LandingScreen } from './components/lobby/LandingScreen';
import { LobbyScreen } from './components/lobby/LobbyScreen';
import { createScopaSocket } from './multiplayer/useScopaSocket';
import './styles/app.css';

const SESSION_STORAGE_KEY = 'scopa.roomSession';
const DISPLAY_NAME_STORAGE_KEY = 'scopa.displayName';

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
    getGameRoom(session.roomCode, session.playerId, session.sessionToken)
      .then(setRoom)
      .catch(() => getRoom(session.roomCode).then(setRoom))
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
      enterRoom(await joinRoom(joinCode.trim().toUpperCase(), displayName.trim()));
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

  if (session && room?.game) {
    return (
      <GameScreen
        busyAction={busyAction}
        error={error}
        game={room.game}
        onLeave={handleLeave}
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
    );
  }

  if (session && room) {
    return (
      <LobbyScreen
        busyAction={busyAction}
        currentPlayer={currentPlayer}
        error={error}
        onCopyRoom={copyRoomCode}
        onLeave={handleLeave}
        onReady={handleReady}
        onStartGame={handleStartGame}
        players={room.players}
        readyToStart={readyToStart}
        roomCode={room.roomCode}
        socketState={socketState}
      />
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
