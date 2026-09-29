import type { PlayerSnapshot, ScopaPlayerPublicSnapshot } from '../../api/rooms';
import { CardBack } from '../cards/CardBack';

type PlayerHeaderProps = {
  connected?: boolean;
  gamePlayer: ScopaPlayerPublicSnapshot | null;
  player: PlayerSnapshot | undefined;
};

export function PlayerHeader({ connected, gamePlayer, player }: PlayerHeaderProps) {
  return (
    <header className={`game-top ${connected ? 'is-online' : 'is-away'}`}>
      <div>
        <p className="eyebrow">Opponent</p>
        <h2>{player?.displayName ?? 'Waiting'}</h2>
        <p>
          {gamePlayer?.totalPoints ?? 0} pts · {gamePlayer?.scopasThisRound ?? 0}{' '}
          {gamePlayer?.scopasThisRound === 1 ? 'scopa' : 'scope'} · {gamePlayer?.capturedCount ?? 0} captured
        </p>
      </div>
      <div className="opponent-hand" aria-label="Opponent hidden cards">
        {Array.from({ length: 3 }, (_, index) => (
          <CardBack hidden={index >= (gamePlayer?.handCount ?? 0)} index={index} key={index} />
        ))}
      </div>
      <span className="player-signal">
        <span className={`signal signal-${connected ? 'live' : 'offline'}`} aria-hidden="true" />
        {connected ? 'Online' : 'Away'}
      </span>
    </header>
  );
}
