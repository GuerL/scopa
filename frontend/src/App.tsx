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
  type PlayerSnapshot,
  type RoomSession,
  type RoomSnapshot,
  type ScopaCard,
  type ScopaGameSnapshot,
  type ScopaPlayerPublicSnapshot,
} from './api/rooms';
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
      const response = await createRoom(displayName.trim());
      enterRoom(response);
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction('join', async () => {
      const response = await joinRoom(joinCode.trim().toUpperCase(), displayName.trim());
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

  if (session && room?.game) {
    return (
      <GameScreen
        busyAction={busyAction}
        currentPlayer={currentPlayer}
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
              <button type="button" onClick={handleStartGame} disabled={!bothPlayersReady || busyAction === 'start'}>
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

        <div className="player-name">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            maxLength={24}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Player Name"
            required
            value={displayName}
          />
        </div>

        <div className="forms">
          <form className="flow" onSubmit={handleCreate}>
            <button
              type="submit"
              disabled={backend.status !== 'connected' || busyAction === 'create' || !displayName.trim()}
            >
              Create game
            </button>
          </form>

          <form className="flow" onSubmit={handleJoin}>
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
            <button
              type="submit"
              disabled={backend.status !== 'connected' || busyAction === 'join' || !displayName.trim()}
            >
              Join game
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

type GameScreenProps = {
  busyAction: string | null;
  currentPlayer: PlayerSnapshot | null;
  error: string;
  game: ScopaGameSnapshot;
  onLeave: () => void;
  onNextRound: () => void;
  onPlay: () => void;
  onRematch: () => void;
  players: PlayerSnapshot[];
  roomCode: string;
  selectedHandCardId: string | null;
  selectedTableCardIds: string[];
  session: SavedSession;
  setSelectedHandCardId: (cardId: string | null) => void;
  setSelectedTableCardIds: (cardIds: string[]) => void;
  socketState: string;
};

function GameScreen({
  busyAction,
  currentPlayer,
  error,
  game,
  onLeave,
  onNextRound,
  onPlay,
  onRematch,
  players,
  roomCode,
  selectedHandCardId,
  selectedTableCardIds,
  session,
  setSelectedHandCardId,
  setSelectedTableCardIds,
  socketState,
}: GameScreenProps) {
  const me = players.find((player) => player.playerId === session.playerId);
  const opponent = players.find((player) => player.playerId !== session.playerId);
  const myGame = game.players.find((player) => player.playerId === session.playerId);
  const opponentGame = opponent ? game.players.find((player) => player.playerId === opponent.playerId) : null;
  const isMyTurn = game.status === 'ACTIVE' && game.currentPlayerId === session.playerId;
  const selectedOptions = game.possibleCaptures.filter((option) => option.handCardId === selectedHandCardId);
  const mustCapture = selectedOptions.length > 0;
  const selectedIsLegalCapture = selectedOptions.some((option) => sameIds(option.tableCardIds, selectedTableCardIds));
  const canPlay = Boolean(selectedHandCardId) && isMyTurn && (!mustCapture || selectedIsLegalCapture);

  function selectHandCard(cardId: string) {
    setSelectedHandCardId(selectedHandCardId === cardId ? null : cardId);
    setSelectedTableCardIds([]);
  }

  function selectTableCard(cardId: string) {
    if (!selectedHandCardId || !mustCapture) {
      return;
    }

    const legalSets = selectedOptions.map((option) => option.tableCardIds);
    const next = selectedTableCardIds.includes(cardId)
      ? selectedTableCardIds.filter((selected) => selected !== cardId)
      : [...selectedTableCardIds, cardId];
    const canStillMatch = legalSets.some((set) => next.every((selected) => set.includes(selected)));
    if (canStillMatch) {
      setSelectedTableCardIds(next);
    }
  }

  if (game.status === 'ROUND_FINISHED' && game.roundResult) {
    return (
      <ResultScreen
        busyAction={busyAction}
        currentPlayerId={session.playerId}
        error={error}
        game={game}
        onLeave={onLeave}
        onNextRound={onNextRound}
        players={players}
        roomCode={roomCode}
        socketState={socketState}
      />
    );
  }

  if (game.status === 'MATCH_FINISHED') {
    const winner = players.find((player) => player.playerId === game.winnerPlayerId);
    return (
      <main className="game-shell">
        <section className="winner-screen">
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

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="Scopa game board">
        <header className="game-top">
          <div>
            <p className="eyebrow">Room {roomCode}</p>
            <h2>{opponent?.displayName ?? 'Waiting'}</h2>
            <p>{opponentGame?.totalPoints ?? 0} pts · {opponentGame?.capturedCount ?? 0} captured</p>
          </div>
          <div className="opponent-hand" aria-label="Opponent hidden cards">
            {Array.from({ length: opponentGame?.handCount ?? 0 }, (_, index) => (
              <span key={index}>?</span>
            ))}
          </div>
          <div className="badges">
            <span>{opponent?.connected ? 'Connected' : 'Disconnected'}</span>
            <span>{socketState === 'live' ? 'Live' : socketState}</span>
          </div>
        </header>

        <section className="table-zone" aria-label="Table cards">
          <div className="round-meta">
            <span>Round {game.roundNumber}</span>
            <span>Deck {game.deckRemaining}</span>
          </div>
          {game.lastEvent === 'SCOPA' && <div className="scopa-flash">SCOPA!</div>}
          <div className="cards table-cards">
            {game.tableCards.length === 0 && <p className="muted">Table is clear.</p>}
            {game.tableCards.map((card) => (
              <CardButton
                card={card}
                disabled={!selectedHandCardId || !mustCapture}
                key={card.id}
                onClick={() => selectTableCard(card.id)}
                selected={selectedTableCardIds.includes(card.id)}
                suggested={selectedOptions.some((option) => option.tableCardIds.includes(card.id))}
              />
            ))}
          </div>
        </section>

        <footer className="player-zone">
          <div className="turn-banner">{isMyTurn ? 'Your turn' : `${currentTurnName(game, players)} is thinking`}</div>
          <div className="cards hand-cards">
            {game.hand.map((card) => (
              <CardButton
                card={card}
                disabled={!isMyTurn}
                key={card.id}
                onClick={() => selectHandCard(card.id)}
                selected={selectedHandCardId === card.id}
              />
            ))}
          </div>
          {selectedHandCardId && (
            <div className="move-panel">
              <p>
                {mustCapture
                  ? selectedIsLegalCapture
                    ? 'Capture ready.'
                    : 'Choose one highlighted capture.'
                  : 'No capture available. Play to table.'}
              </p>
              <button type="button" onClick={onPlay} disabled={!canPlay || busyAction === 'play'}>
                Play card
              </button>
              <button className="secondary" type="button" onClick={() => selectHandCard(selectedHandCardId)}>
                Cancel
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <div className="my-summary">
            <div>
              <strong>{me?.displayName ?? 'You'}</strong>
              <p>{myGame?.totalPoints ?? 0} pts · {myGame?.scopasThisRound ?? 0} Scopa · {myGame?.capturedCount ?? 0} captured</p>
            </div>
            <button className="secondary compact-button" type="button" onClick={onLeave} disabled={busyAction === 'leave'}>
              Leave
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

function ResultScreen({
  busyAction,
  currentPlayerId,
  error,
  game,
  onLeave,
  onNextRound,
  players,
  roomCode,
  socketState,
}: {
  busyAction: string | null;
  currentPlayerId: string;
  error: string;
  game: ScopaGameSnapshot;
  onLeave: () => void;
  onNextRound: () => void;
  players: PlayerSnapshot[];
  roomCode: string;
  socketState: string;
}) {
  const result = game.roundResult;
  const left = players.find((player) => player.playerId === result?.leftPlayerId);
  const right = players.find((player) => player.playerId === result?.rightPlayerId);
  const me = game.players.find((player) => player.playerId === currentPlayerId);

  return (
    <main className="game-shell">
      <section className="result-screen">
        <div className="topline">
          <p className="eyebrow">Round {game.roundNumber} results · {roomCode}</p>
          <div className={`status compact status-${socketState}`} role="status">
            <span aria-hidden="true" />
            {socketState}
          </div>
        </div>
        <div className="score-grid header">
          <strong />
          <strong>{left?.displayName}</strong>
          <strong>{right?.displayName}</strong>
        </div>
        {result?.lines.map((line) => (
          <div className="score-grid" key={line.label}>
            <span>{line.label}</span>
            <span>+{line.leftPoints}<small>{line.leftDetail}</small></span>
            <span>+{line.rightPoints}<small>{line.rightDetail}</small></span>
          </div>
        ))}
        {result && (
          <>
            <div className="score-grid total-row">
              <span>Round</span>
              <span>{result.leftRoundPoints}</span>
              <span>{result.rightRoundPoints}</span>
            </div>
            <div className="score-grid total-row">
              <span>Total</span>
              <span>{result.leftTotalPoints}</span>
              <span>{result.rightTotalPoints}</span>
            </div>
          </>
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

function CardButton({
  card,
  disabled = false,
  onClick,
  selected = false,
  suggested = false,
}: {
  card: ScopaCard;
  disabled?: boolean;
  onClick: () => void;
  selected?: boolean;
  suggested?: boolean;
}) {
  return (
    <button
      className={`card card-${card.suit.toLowerCase()}${selected ? ' selected' : ''}${suggested ? ' suggested' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span>{card.value}</span>
      <strong>{suitLabel(card.suit)}</strong>
    </button>
  );
}

function suitLabel(suit: ScopaCard['suit']) {
  switch (suit) {
    case 'GOLD':
      return 'Oro';
    case 'CUPS':
      return 'Coppe';
    case 'SWORDS':
      return 'Spade';
    case 'CLUBS':
      return 'Bastoni';
  }
}

function currentTurnName(game: ScopaGameSnapshot, players: PlayerSnapshot[]) {
  return players.find((player) => player.playerId === game.currentPlayerId)?.displayName ?? 'Opponent';
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function scoreText(game: ScopaGameSnapshot, players: PlayerSnapshot[]) {
  return players
    .map((player) => {
      const gamePlayer = game.players.find((candidate) => candidate.playerId === player.playerId);
      return `${player.displayName} ${gamePlayer?.totalPoints ?? 0}`;
    })
    .join(' - ');
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
