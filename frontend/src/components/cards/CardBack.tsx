import type { CSSProperties } from 'react';

type CardBackProps = {
  hidden?: boolean;
  index?: number;
};

export function CardBack({ hidden = false, index = 0 }: CardBackProps) {
  return (
    <span
      aria-label="Hidden opponent card"
      aria-hidden={hidden}
      className={`card-back ${hidden ? 'is-placeholder' : ''}`}
      role="img"
      style={{ '--card-offset': `${index * -6}px` } as CSSProperties}
    >
      <span aria-hidden="true" />
    </span>
  );
}
