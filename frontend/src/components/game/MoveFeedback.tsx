import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { ScopaLastMove, ScopaGameSnapshot } from '../../api/rooms';
import { ScopaCardButton } from '../cards/ScopaCardButton';
import { cardName } from '../cards/cardText';

// Initial snapshots are context only. Equal/older snapshots cannot restart feedback.
export function isNewMove(sequence: number, seen: number | null): boolean {
  return seen !== null && sequence > seen;
}

export function useMoveFeedback(move: ScopaLastMove | null, scope: string) {
  const seen = useRef<{ scope: string; sequence: number } | null>(null);
  const [feedback, setFeedback] = useState<ScopaLastMove | null>(null);
  const [animating, setAnimating] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const sequence = move?.sequence ?? 0;
  useEffect(() => {
    const previous = seen.current?.scope === scope ? seen.current.sequence : null;
    if (previous !== null && sequence < previous && move) {
      setFeedback(null);
      setAnimating(false);
      return;
    }
    seen.current = { scope, sequence: move ? sequence : previous ?? 0 };
    setFeedback(move);
    const present = Boolean(move && isNewMove(sequence, previous));
    setAnimating(present);
    const settle = window.setTimeout(() => setAnimating(false), move?.capturedCards.length ? 1100 : 500);
    const clear = window.setTimeout(() => setFeedback(null), (present ? (move?.capturedCards.length ? 1100 : 500) : 0) + 2600);
    return () => { window.clearTimeout(settle); window.clearTimeout(clear); };
    // Move payload is immutable for a sequence; unrelated snapshots must not reset timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, scope]);
  return { feedback, animating: animating && !reduced, presenting: animating, reduced };
}

export function moveSummary(move: ScopaLastMove): string {
  return `${move.playerDisplayName} played ${cardName(move.playedCard)}${move.capturedCards.length
    ? ` → captured ${move.capturedCards.map(cardName).join(' + ')}` : ''}${move.scopa ? ' · SCOPA!' : ''}`;
}

export type CardGeometry = { x: number; y: number; width: number; height: number };
type BoardGeometry = { cards: Map<string, CardGeometry>; previousCards: Map<string, CardGeometry>; sequence: number };

// Only DOM positions are retained, not a second copy of the game state.
export function useBoardGeometry(game: ScopaGameSnapshot, board: RefObject<HTMLElement | null>) {
  const geometry = useRef<BoardGeometry>({ cards: new Map(), previousCards: new Map(), sequence: -1 });
  useLayoutEffect(() => {
    const cards = new Map<string, CardGeometry>();
    board.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach(element => {
      if (element.closest('.move-animation-layer')) return;
      const rect = element.getBoundingClientRect();
      cards.set(element.dataset.cardId!, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    });
    const sequence = game.lastMove?.sequence ?? 0;
    const previousCards = sequence !== geometry.current.sequence ? geometry.current.cards : geometry.current.previousCards;
    geometry.current = { cards, previousCards, sequence };
  }, [game, board]);
  return geometry;
}

/** Find a nearby free card slot, keeping every captured card unobscured. */
export function captureStagingPosition(cards: CardGeometry[], size: CardGeometry, bounds: CardGeometry): CardGeometry {
  const gap = 10;
  const left = Math.min(...cards.map(card => card.x));
  const top = Math.min(...cards.map(card => card.y));
  const right = Math.max(...cards.map(card => card.x + card.width));
  const bottom = Math.max(...cards.map(card => card.y + card.height));
  const centerX = (left + right - size.width) / 2;
  const centerY = (top + bottom - size.height) / 2;
  const xs = [centerX, ...cards.flatMap(card => [card.x - size.width - gap, card.x + card.width + gap]), bounds.x + gap];
  const ys = [top - size.height - gap, centerY, bottom + gap, ...cards.map(card => card.y), bounds.y + gap];
  const candidates = xs.flatMap(x => ys.map(y => ({ x, y, width: size.width, height: size.height })))
    .filter(rect => rect.x >= bounds.x && rect.y >= bounds.y
      && rect.x + rect.width <= bounds.x + bounds.width && rect.y + rect.height <= bounds.y + bounds.height
      && cards.every(card => rect.x + rect.width + gap <= card.x || rect.x >= card.x + card.width + gap
        || rect.y + rect.height + gap <= card.y || rect.y >= card.y + card.height + gap));
  candidates.sort((a, b) => Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
  if (candidates.length) return candidates[0];
  // Very dense layouts can use a smaller temporary played card; actual cards retain their size.
  if (size.width > 24) return captureStagingPosition(cards, { ...size, width: size.width * 0.8, height: size.height * 0.8 }, bounds);
  return { ...size, x: bounds.x, y: bounds.y };
}

type AnimatedCard = { card: ScopaLastMove['playedCard']; rect: CardGeometry; dx: number; dy: number };
type AnimationGeometry = { played: AnimatedCard; captured: AnimatedCard[]; right: number };

export function MoveAnimationLayer({ move, board, previousGeometry, localPlayerId, reduced = false }: {
  move: ScopaLastMove;
  board: RefObject<HTMLElement | null>;
  previousGeometry: RefObject<BoardGeometry>;
  localPlayerId: string;
  reduced?: boolean;
}) {
  const [layout, setLayout] = useState<AnimationGeometry | null>(null);
  useLayoutEffect(() => {
    const root = board.current;
    const table = root?.querySelector('.table-cards');
    if (!root || !table) return;
    const bounds = root.getBoundingClientRect();
    const felt = table.getBoundingClientRect();
    const size = root.querySelector('.scopa-card')?.getBoundingClientRect();
    const width = size?.width || 64;
    const height = size?.height || 92;
    const positions = previousGeometry.current.previousCards;
    const captured = move.capturedCards.map((card, index) => ({ card,
      rect: positions.get(card.id) ?? { x: felt.x + index * (width + 6), y: felt.y, width, height } }));
    const landing = Array.from(table.querySelectorAll<HTMLElement>('[data-card-id]'))
      .find(element => element.dataset.cardId === move.playedCard.id)?.getBoundingClientRect();
    const normalTarget = landing ?? { x: felt.x + Math.max(0, (felt.width - width) / 2),
      y: felt.y + Math.max(0, (felt.height - height) / 2), width, height };
    const tableBounds = root.querySelector('.table-zone')?.getBoundingClientRect() ?? felt;
    // Keep staging above the status strip, including on compact boards.
    const stagingBounds = { x: bounds.x, y: bounds.y, width: bounds.width,
      height: Math.min(bounds.height, tableBounds.y + tableBounds.height - bounds.y) };
    const target = captured.length
      ? captureStagingPosition(captured.map(item => item.rect), normalTarget, stagingBounds)
      : normalTarget;
    const player = Array.from(root.querySelectorAll<HTMLElement>('[data-player-id]'))
      .find(element => element.dataset.playerId === move.playerId);
    const sourceArea = player?.querySelector(move.playerId === localPlayerId ? '.hand-cards' : '.opponent-hand') ?? player;
    const sourceBounds = sourceArea?.getBoundingClientRect();
    const source = (move.playerId === localPlayerId ? positions.get(move.playedCard.id) : null)
      ?? { x: sourceBounds ? sourceBounds.x + (sourceBounds.width - width) / 2 : target.x,
        y: sourceBounds ? sourceBounds.y : bounds.y, width, height };
    const relative = (rect: CardGeometry) => ({ ...rect, x: rect.x - bounds.x, y: rect.y - bounds.y });
    setLayout({
      played: { card: move.playedCard, rect: relative(target), dx: source.x - target.x, dy: source.y - target.y },
      captured: captured.map(({ card, rect }, index) => ({ card, rect: relative(rect),
        dx: target.x + (index + 1) * 12 - rect.x, dy: target.y + (index + 1) * 3 - rect.y })),
      right: bounds.width - (target.x - bounds.x) + width,
    });
  }, [move, board, previousGeometry, localPlayerId]);
  if (!layout) return null;
  const cardStyle = ({ rect, dx, dy }: AnimatedCard): CSSProperties => ({
    left: rect.x, top: rect.y, width: rect.width, height: rect.height,
    '--card-dx': `${dx}px`, '--card-dy': `${dy}px`,
  } as CSSProperties);
  return (
    <div className={`move-animation-layer ${reduced ? 'is-reduced' : ''}`} aria-hidden="true">
      <div className={`move-animation-group ${layout.captured.length ? 'is-capture' : ''}`}
        style={{ '--capture-right': `${layout.right}px` } as CSSProperties}>
        {layout.captured.map(item => <div className="animated-table-card" key={item.card.id} style={cardStyle(item)}>
          <ScopaCardButton card={item.card} disabled onClick={() => {}} />
        </div>)}
        <div className={`animated-played-card ${layout.captured.length ? 'is-capture' : ''}`} style={cardStyle(layout.played)}>
          <ScopaCardButton card={move.playedCard} disabled onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}
