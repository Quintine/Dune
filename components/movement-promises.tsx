'use client';
import type { Action, GameView } from '@/game/engine';
import { liveMovementPromises, movementClaimText } from '@/game/movement-promises';
import { Button } from './ui/button';

export function MovementPromises({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const own = liveMovementPromises(game.movementPromises ?? [], game.me, game.turn);
  if (!own.length) return null;
  const proposed = game.movementPromisePolicy?.[0];
  const paidDecision = proposed?.type === 'decision' && game.decision?.player === game.me &&
    (game.decision.kind === 'nullentropy' || game.phase === 3 && game.decision.kind === 'auctionPayment');
  const next = game.phase >= 5 || paidDecision ||
    (game.phase === 2 && ['charity', 'ready'].includes(proposed?.type ?? '')) ||
    (game.phase === 4 && ['revive', 'ready'].includes(proposed?.type ?? '')) ||
    (game.phase === 3 && ['passBid', 'richeseBid'].includes(proposed?.type ?? '')) ? proposed : undefined;
  const amount = next?.forces && typeof next.forces === 'object'
    ? Object.values(next.forces as Record<string, number>).reduce((sum, count) => sum + count, 0) : typeof next?.amount === 'number' ? next.amount : 0;
  const destination = next && game.combatLocations.find(location => location.id === next.territory)?.name;
  const destinationLabel = destination ?? (typeof next?.territory === 'string' ? next.territory : 'the chosen destination');
  const sector = typeof next?.sector === 'number' ? next.sector : 0;
  const card = game.players.find(player => player.id === game.me)?.hand?.find(card => card.id === next?.card);
  const recovered = game.nullentropy?.search?.cards.find(card => card.id === next?.card);
  const payment = next?.type === 'decision' && game.decision?.kind === 'auctionPayment';
  const label = payment ? next.karama === true ? `Use ${card?.name ?? 'your card'} for the current auction payment` : 'Pay the current auction price'
    : next?.type === 'decision' ? `Choose ${recovered?.name ?? 'the required card'} in your paid Box search`
    : next?.type === 'charity' ? 'Claim Charity for your later movement'
    : next?.type === 'revive' ? `Revive ${amount} forces for your later movement`
    : next?.type === 'ready' ? 'Finish this preparation phase while preserving your promises'
    : next?.type === 'passBid' ? 'Pass this bid and preserve later movement'
    : next?.type === 'richeseBid' ? next.amount === 0 ? 'Submit zero in this Silent auction and preserve later movement' : 'Pass this Richese bid and preserve later movement'
    : next?.type === 'card' && next.mode === 'shipment' ? `Use ${card?.name ?? 'your card'} for Guild shipment rates`
    : next?.type === 'card' && card?.effect === 'nullentropyBox' ? 'Pay 2 spice and search with Nullentropy Box'
    : next?.type === 'card' && card?.effect === 'ghola' ? `Play Ghola to return ${amount} ${amount === 1 ? 'force' : 'forces'} to reserves for the required movement`
    : next?.type === 'card' && next.mode === 'choam' ? 'Play Kulon to extend the required movement'
    : next?.type === 'card' ? 'Play Hajr to prepare the required movement'
    : next?.type === 'ship' ? `Ship ${amount} forces to ${destinationLabel}, sector ${sector}, before the required movement`
    : next?.type === 'endMovement' ? 'Finish movement while honoring No'
    : `${next?.movementCard ? 'Use Ornithopter and move' : 'Move'} ${amount} forces to ${destinationLabel}, sector ${sector}`;
  return <section className="notice space-y-3" aria-label="Your ground-movement promises">
    <h4>Your ground-movement promises</h4>
    {(game.phase < 5 || game.active !== game.me) && <p>Your Movement turn is still ahead. Keep the needed forces, spice and cards available; movement controls appear on your turn.{game.phase < 5 && ' Complete any current preparation below before confirming readiness.'}{next?.type === 'decision' && game.decision?.kind === 'nullentropy' && ' Your already-paid Box search can finish now.'}</p>}
    {own.map((promise, index) => <p key={index}>{promise.answer ? 'Yes: you must' : 'No: you must not'} {movementClaimText(promise)} before your Movement turn ends this round.</p>)}
    <p className="fine">One qualifying ground move fulfills Yes; a shipment can prepare that move but does not fulfill it. No remains binding through every later Hajr or Ornithopter move. A paid Box search must finish before moving; its fee is paid only once. Opposing effects release an answer only if it becomes impossible.</p>
    {next && <Button className="game-action min-h-11 whitespace-normal" disabled={busy} onClick={() => { if (!busy) act(next); }}>{label}</Button>}
  </section>;
}
