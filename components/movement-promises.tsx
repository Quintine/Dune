'use client';
import type { Action, GameView } from '@/game/engine';
import { liveMovementPromises, movementClaimText } from '@/game/movement-promises';
import { Button } from './ui/button';

export function MovementPromises({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const own = liveMovementPromises(game.movementPromises ?? [], game.me, game.turn);
  if (!own.length) return null;
  const next = game.movementPromisePolicy?.[0];
  const amount = next?.forces && typeof next.forces === 'object'
    ? Object.values(next.forces as Record<string, number>).reduce((sum, count) => sum + count, 0) : typeof next?.amount === 'number' ? next.amount : 0;
  const destination = next && game.combatLocations.find(location => location.id === next.territory)?.name;
  const destinationLabel = destination ?? (typeof next?.territory === 'string' ? next.territory : 'the chosen destination');
  const sector = typeof next?.sector === 'number' ? next.sector : 0;
  const card = game.players.find(player => player.id === game.me)?.hand?.find(card => card.id === next?.card);
  const recovered = game.nullentropy?.search?.cards.find(card => card.id === next?.card);
  const label = next?.type === 'decision' ? `Choose ${recovered?.name ?? 'the required card'} in your paid Box search`
    : next?.type === 'card' && card?.effect === 'nullentropyBox' ? 'Pay 2 spice and search with Nullentropy Box'
    : next?.type === 'card' && next.mode === 'choam' ? 'Play Kulon to extend the required movement'
    : next?.type === 'card' ? 'Play Hajr to prepare the required movement'
    : next?.type === 'endMovement' ? 'Finish movement while honoring No'
    : `${next?.movementCard ? 'Use Ornithopter and move' : 'Move'} ${amount} forces to ${destinationLabel}, sector ${sector}`;
  return <section className="notice space-y-3" aria-label="Your ground-movement promises">
    <h4>Your ground-movement promises</h4>
    {own.map((promise, index) => <p key={index}>{promise.answer ? 'Yes: you must' : 'No: you must not'} {movementClaimText(promise)} before this Movement turn ends.</p>)}
    <p className="fine">One qualifying move fulfills Yes. No remains binding through every later Hajr or Ornithopter move. A paid Box search must finish before moving; its fee is paid only once. Opposing effects release an answer only if it becomes impossible.</p>
    {next && <Button className="game-action min-h-11 whitespace-normal" disabled={busy} onClick={() => { if (!busy) act(next); }}>{label}</Button>}
  </section>;
}
