import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ScopaLastMove } from '../../api/rooms';
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
    const animate = Boolean(move && isNewMove(sequence, previous) && !reduced);
    setAnimating(animate);
    const settle = window.setTimeout(() => setAnimating(false), move?.capturedCards.length ? 760 : 360);
    const clear = window.setTimeout(() => setFeedback(null), (animate ? 760 : 0) + 1800);
    return () => { window.clearTimeout(settle); window.clearTimeout(clear); };
    // Move payload is immutable for a sequence; unrelated snapshots must not reset timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, scope]);
  return { feedback, animating: animating && !reduced, reduced };
}

export function moveSummary(move: ScopaLastMove): string {
  return `${move.playerDisplayName} played ${cardName(move.playedCard)}${move.capturedCards.length
    ? ` → captured ${move.capturedCards.map(cardName).join(' + ')}` : ''}${move.scopa ? ' · SCOPA!' : ''}`;
}

export function MoveFeedback({ move, animating, reduced }: {
  move: ScopaLastMove | null; animating: boolean; reduced: boolean;
}) {
  const [origin, setOrigin] = useState({ x: 0, y: -100 });
  useLayoutEffect(() => {
    if (!move) return;
    const player = Array.from(document.querySelectorAll<HTMLElement>('[data-player-id]'))
      .find(element => element.dataset.playerId === move.playerId);
    const table = document.querySelector('.table-zone');
    if (!player || !table) return;
    const source = player.getBoundingClientRect();
    const target = table.getBoundingClientRect();
    setOrigin({ x: source.x + source.width / 2 - (target.x + target.width / 2),
      y: source.y + source.height / 2 - (target.y + target.height / 2) });
  }, [move?.sequence, move?.playerId]);
  if (!move || (!animating && !reduced)) return null;
  const style = { '--move-x': `${origin.x}px`, '--move-y': `${origin.y}px` } as CSSProperties;
  return (
    <div className={`move-overlay ${reduced ? 'is-reduced' : ''}`} style={style} key={move.sequence}>
      <div className="move-title">{move.playerDisplayName} played {move.scopa && <strong> · SCOPA!</strong>}</div>
      <div className={`move-cards ${move.capturedCards.length ? 'is-capture' : ''}`}>
        <div className="move-played"><ScopaCardButton card={move.playedCard} disabled onClick={() => {}} /></div>
        {move.capturedCards.length > 0 && <div className="move-captured">
          <span>Captured:</span>
          {move.capturedCards.map(card => <ScopaCardButton key={card.id} card={card} disabled onClick={() => {}} suggested />)}
        </div>}
      </div>
    </div>
  );
}
