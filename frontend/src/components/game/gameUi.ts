import type { PlayerSnapshot, ScopaGameSnapshot, ScopaPlayerPublicSnapshot } from '../../api/rooms';

export function playerGameState(game: ScopaGameSnapshot, playerId?: string): ScopaPlayerPublicSnapshot | null {
  if (!playerId) {
    return null;
  }
  return game.players.find((player) => player.playerId === playerId) ?? null;
}

export function currentTurnName(game: ScopaGameSnapshot, players: PlayerSnapshot[]) {
  return players.find((player) => player.playerId === game.currentPlayerId)?.displayName ?? 'Opponent';
}

export function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function scoreText(game: ScopaGameSnapshot, players: PlayerSnapshot[]) {
  return players
    .map((player) => {
      const gamePlayer = playerGameState(game, player.playerId);
      return `${player.displayName} ${gamePlayer?.totalPoints ?? 0}`;
    })
    .join(' - ');
}
