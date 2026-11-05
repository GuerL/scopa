import type { ScopaCard } from '../../api/rooms';
import { suitGlyph } from './cardText';
import { useCardStyle } from './CardStyle';

const suits = { GOLD: 'denari', CUPS: 'coppe', SWORDS: 'spade', CLUBS: 'bastoni' } as const;

// Scans run 1–4, 5–8, then knight (9) and king (10) in columns 2–3.
export function traditionalFace(card: ScopaCard) {
  const index = card.value <= 8 ? card.value - 1 : card.value;
  return { file: `/cards/sicilian/${suits[card.suit]}.jpg`, column: index % 4, row: Math.floor(index / 4) };
}

export function CardFace({ card }: { card: ScopaCard }) {
  const { style } = useCardStyle();
  if (style === 'traditional') {
    const face = traditionalFace(card);
    return <span aria-hidden="true" className="traditional-face" style={{
      backgroundImage: `url("${face.file}")`,
      backgroundPosition: `${face.column * 100 / 3}% ${face.row * 50}%`,
    }} />;
  }
  return <>
      <span className="card-corner card-corner-top">
        <strong>{card.value}</strong>
        <em>{suitGlyph(card.suit)}</em>
      </span>
      <span className="suit-mark" aria-hidden="true">
        {suitGlyph(card.suit)}
      </span>
      <span className="card-corner card-corner-bottom">
        <strong>{card.value}</strong>
        <em>{suitGlyph(card.suit)}</em>
      </span>
  </>;
}
