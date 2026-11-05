import type { CSSProperties } from 'react';
import { useCardStyle } from './CardStyle';

type CardBackProps = {
  hidden?: boolean;
  index?: number;
};

export function CardBack({ hidden = false, index = 0 }: CardBackProps) {
  const { style } = useCardStyle();
  return (
    <span
      aria-label="Hidden opponent card"
      aria-hidden={hidden}
      className={`card-back card-back-${style} ${hidden ? 'is-placeholder' : ''}`}
      role="img"
      style={{ '--card-offset': `${index * -6}px` } as CSSProperties}
    >
      <span aria-hidden="true" />
    </span>
  );
}
