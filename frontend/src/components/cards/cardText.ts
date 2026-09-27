import type { ScopaCard, ScopaSuit } from '../../api/rooms';

export function suitName(suit: ScopaSuit) {
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

export function cardName(card: ScopaCard) {
  return `${card.value} of ${suitName(card.suit)}`;
}

export function suitGlyph(suit: ScopaSuit) {
  switch (suit) {
    case 'GOLD':
      return 'O';
    case 'CUPS':
      return 'C';
    case 'SWORDS':
      return 'S';
    case 'CLUBS':
      return 'B';
  }
}
