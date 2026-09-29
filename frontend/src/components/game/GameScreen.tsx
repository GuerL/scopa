import type { PlayerSnapshot, ScopaGameSnapshot } from '../../api/rooms';
import { PlayerHand } from './PlayerHand';
import { PlayerHeader } from './PlayerHeader';
import { TableArea } from './TableArea';
import { currentTurnName, playerGameState, sameIds } from './gameUi';
import { ResultScreen } from '../results/ResultScreen';
import { WinnerScreen } from '../results/WinnerScreen';

type SavedSession = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
};

type GameScreenProps = {
  busyAction: string | null;
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

export function GameScreen({
  busyAction,
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
  const opponents = players.filter((player) => player.playerId !== session.playerId);
  const myGame = playerGameState(game, session.playerId);
  const isMyTurn = game.status === 'ACTIVE' && game.currentPlayerId === session.playerId;
  const selectedOptions = game.possibleCaptures.filter((option) => option.handCardId === selectedHandCardId);
  const mustCapture = selectedOptions.length > 0;
  const selectedIsLegalCapture = selectedOptions.some((option) => sameIds(option.tableCardIds, selectedTableCardIds));
  const canPlay = Boolean(selectedHandCardId) && isMyTurn && (!mustCapture || selectedIsLegalCapture);
  const moveHint = mustCapture
    ? selectedIsLegalCapture
      ? 'Capture ready.'
      : 'Choose one highlighted capture.'
    : 'No capture available. Play to the table.';
  const feedbackMessage = error
    ? error
    : game.lastEvent === 'SCOPA'
      ? 'SCOPA!'
      : selectedHandCardId
        ? moveHint
        : isMyTurn
          ? 'Your turn'
          : `${currentTurnName(game, players)} is playing...`;

  function selectHandCard(cardId: string) {
    setSelectedHandCardId(selectedHandCardId === cardId ? null : cardId);
    setSelectedTableCardIds([]);
  }

  function cancelSelection() {
    setSelectedHandCardId(null);
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
    return (
      <WinnerScreen
        busyAction={busyAction}
        error={error}
        game={game}
        myGame={myGame}
        onLeave={onLeave}
        onRematch={onRematch}
        players={players}
        roomCode={roomCode}
      />
    );
  }

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="Scopa game board">
        <div className="opponents">
          {opponents.map((opponent) => (
            <PlayerHeader
              connected={opponent.connected}
              gamePlayer={playerGameState(game, opponent.playerId)}
              key={opponent.playerId}
              player={opponent}
            />
          ))}
        </div>
        <TableArea
          deckRemaining={game.deckRemaining}
          lastEvent={game.lastEvent}
          mustCapture={mustCapture}
          onSelectTableCard={selectTableCard}
          roundNumber={game.roundNumber}
          selectedHandCardId={selectedHandCardId}
          selectedOptions={selectedOptions}
          selectedTableCardIds={selectedTableCardIds}
          tableCards={game.tableCards}
        />
        <div className={`turn-context ${error ? 'is-error' : ''} ${game.lastEvent === 'SCOPA' ? 'is-scopa' : ''}`} aria-live="polite">
          {feedbackMessage}
        </div>
        <PlayerHand
          busyAction={busyAction}
          canPlay={canPlay}
          hand={game.hand}
          isMyTurn={isMyTurn}
          moveHint={moveHint}
          myGame={myGame}
          onCancelSelection={cancelSelection}
          onLeave={onLeave}
          onPlay={onPlay}
          onSelectHandCard={selectHandCard}
          player={me}
          selectedHandCardId={selectedHandCardId}
        />
      </section>
    </main>
  );
}
