import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlayerSnapshot, ScopaCard, ScopaGameSnapshot, ScopaScoreLine } from '../api/rooms';
import { GameScreen } from '../components/game/GameScreen';
import { LobbyScreen } from '../components/lobby/LobbyScreen';
import { prepareScene, sceneReady } from './ready';
import '../styles/app.css';

const noop = () => undefined;
const players: PlayerSnapshot[] = [
  { playerId: 'demo-sofia', displayName: 'Sofia', host: true, ready: true, connected: true },
  { playerId: 'demo-marco', displayName: 'Marco', host: false, ready: true, connected: true },
];
const card = (suit: ScopaCard['suit'], value: number): ScopaCard => ({ id: `${suit}_${value}`, suit, value });
// 12 undealt + 6 in hands + 4 on table + 18 captured = the complete 40-card deck.
const game: ScopaGameSnapshot = {
  status: 'ACTIVE', roundNumber: 2,
  tableCards: [card('GOLD', 7), card('CUPS', 3), card('SWORDS', 5), card('CLUBS', 1)],
  hand: [card('CUPS', 7), card('GOLD', 8), card('SWORDS', 6)],
  possibleCaptures: [
    { handCardId: 'CUPS_7', tableCardIds: ['GOLD_7'] },
    { handCardId: 'GOLD_8', tableCardIds: ['CUPS_3', 'SWORDS_5'] },
    { handCardId: 'GOLD_8', tableCardIds: ['GOLD_7', 'CLUBS_1'] },
    { handCardId: 'SWORDS_6', tableCardIds: ['SWORDS_5', 'CLUBS_1'] },
  ],
  players: players.map((p, i) => ({ playerId: p.playerId, handCount: 3, capturedCount: i ? 8 : 10,
    scopasThisRound: i ? 0 : 1, roundPoints: 0, totalPoints: i ? 2 : 3,
    roundAcknowledged: false, rematchRequested: false })),
  currentPlayerId: players[0].playerId, startingPlayerId: players[1].playerId,
  lastCapturingPlayerId: players[0].playerId, winnerPlayerId: null, deckRemaining: 12,
  roundResult: null, lastEvent: null, lastMove: null, capturedCards: [card('GOLD', 1), card('GOLD', 2), card('GOLD', 3), card('CUPS', 1), card('CUPS', 2),
    card('CUPS', 4), card('SWORDS', 1), card('SWORDS', 2), card('SWORDS', 3), card('CLUBS', 2)], moveSequence: 8,
};
// Scopa categories award 4 base points plus the two scopas: 5 + 1 = 6.
const lines: ScopaScoreLine[] = [
  ['Cards', 1, '23 cards', 0, '17 cards'],
  ['Coins', 1, '6 coins', 0, '4 coins'],
  ['Settebello', 1, '7 of coins', 0, '—'],
  ['Primiera', 1, '81', 0, '75'],
  ['Scopas', 1, '1 scopa', 1, '1 scopa'],
].map(([label, a, ad, b, bd]) => ({ label: String(label), players: [
  { playerId: players[0].playerId, points: Number(a), detail: String(ad) },
  { playerId: players[1].playerId, points: Number(b), detail: String(bd) },
] }));
const results: ScopaGameSnapshot = { ...game, status: 'ROUND_FINISHED', tableCards: [], hand: [],
  possibleCaptures: [], currentPlayerId: null, deckRemaining: 0,
  // 23 cards, six coins, settebello and primiera 81; the complement has primiera 75.
  capturedCards: [
    ...(['GOLD', 'CUPS', 'SWORDS'] as const).flatMap(suit => [1, 2, 3, 4, 5, 7].map(value => card(suit, value))),
    ...[2, 3, 4, 5, 6].map(value => card('CLUBS', value)),
  ],
  players: game.players.map((p, i) => ({ ...p, handCount: 0, capturedCount: i ? 17 : 23,
    scopasThisRound: 1, roundPoints: i ? 1 : 5, totalPoints: i ? 3 : 8 })),
  roundResult: { lines, players: players.map((p, i) => ({ playerId: p.playerId, roundPoints: i ? 1 : 5, totalPoints: i ? 3 : 8 })) },
};
function ScreenshotDemo({ scene }: { scene: string }) {
  useEffect(() => { void sceneReady(); }, []);
  if (scene === 'lobby') return <LobbyScreen busyAction={null} currentPlayer={players[0]} error=""
    onCopyRoom={noop} onLeave={noop} onReady={noop} onStartGame={noop} players={players}
    readyToStart roomCode="SCOPA7" socketState="live" />;
  return <GameScreen busyAction={null} error="" game={scene === 'results' ? results : game}
    onLeave={noop} onNextRound={noop} onPlay={noop} onRematch={noop} players={players}
    roomCode="SCOPA7" selectedHandCardId={null} selectedTableCardIds={[]}
    session={{ roomCode: 'SCOPA7', playerId: players[0].playerId, sessionToken: 'demo-inert' }}
    setSelectedHandCardId={noop} setSelectedTableCardIds={noop} socketState="live" />;
}
export function mountScreenshotDemo() {
  const scene = prepareScene(['gameplay', 'mobile-gameplay', 'lobby', 'results']);
  createRoot(document.getElementById('root')!).render(<ScreenshotDemo scene={scene} />);
}
