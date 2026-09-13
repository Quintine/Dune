'use client';

import { useId } from 'react';
import type { Action, GameView } from '@/game/engine';
import { discoveryFlightMove } from '@/game/discovery-flight-options';
import { Button } from './ui/button';

export function DiscoveryOrnithopterMovement({ game, act, busy, move }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  move: Action | null;
}) {
  const id = useId();
  if (!game.discoveryOrnithopter) return null;
  const quote = discoveryFlightMove(game, move);
  const unavailable = busy || !!game.players.find(p => p.id === game.me)?.autopilot ||
    !!game.automaticContinuationPending;
  return <section className="my-4 flex min-w-0 flex-col gap-3" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Carried Discovery Ornithopter</h3>
    <p>Use a range of three territories for the selected group’s movement. This replaces its normal range. The token is removed after that group moves.</p>
    <p className="fine">Acquired on turn {game.discoveryOrnithopter.acquiredTurn}. Available from the following turn.</p>
    <Button disabled={unavailable || !quote.action} aria-describedby={quote.blocked ? `${id}-reason` : undefined}
      onClick={() => { if (!unavailable && quote.action) act(quote.action); }}>
      Move with Discovery Ornithopter
    </Button>
    {quote.blocked && <output id={`${id}-reason`} className="fine">{quote.blocked}</output>}
  </section>;
}
