import type { CSSProperties } from 'react';

type CardBackProps = {
  index?: number;
};

export function CardBack({ index = 0 }: CardBackProps) {
  return (
    <span
      aria-label="Hidden opponent card"
      className="card-back"
      role="img"
      style={{ '--card-offset': `${index * -6}px` } as CSSProperties}
    >
      <span aria-hidden="true" />
    </span>
  );
}
