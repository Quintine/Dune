'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

/** Native own revival choices follow the projected serial turn. Responder
 * powers use their separate commerce controls and do not use this guard. */
export function revivalTurnOrderBlock(game: GameView): string | null {
  const order = game.revivalOrder;
  if (!game.advanced || !order) return null;
  if ((order.version !== 1 && order.version !== 2) || order.turn !== game.turn || game.status !== 'playing' || game.phase !== 4)
    return 'This Revival turn is no longer current.';
  if (!game.players.some(player => player.id === game.me) || !order.original.includes(game.me))
    return 'This seat has no Revival turn in the current order.';
  if (order.completed.includes(game.me) || !order.remaining.includes(game.me))
    return 'Your Revival turn is finished.';
  const actor = order.remaining[0];
  if (actor !== game.me)
    return game.revival.orderBlocked || `Waiting for ${game.players.find(player => player.id === actor)?.name ?? 'the current player'} to finish their Revival turn.`;
  if (game.active !== actor) return 'The current Revival actor is unavailable.';
  return game.revival.orderBlocked || null;
}

export function finishRevivalTurnBlocked(game: GameView): string | null {
  if (!game.advanced || !game.revivalOrder) return 'No ordered Revival turn is available.';
  const order = revivalTurnOrderBlock(game);
  if (order) return order;
  if (game.response || game.decision || game.truthtrance || game.phaseOpening ||
    game.nexusTraitors?.pending || game.nexusCards?.waiting.length || game.revival.pending)
    return 'Finish the current Revival response or decision before ending your turn.';
  if (game.automaticContinuationPending || game.players.find(player => player.id === game.me)?.autopilot)
    return 'Wait for the current automatic action to finish.';
  return null;
}

/** Hook-free actual callback; an unaccepted quote does not prevent finishing. */
export function FinishRevivalTurn({ game, act, busy }: Props) {
  const blocked = finishRevivalTurnBlocked(game);
  const identity = JSON.stringify([game.turn, game.revivalOrder?.turn, game.revivalOrder?.original]);
  return <Button
    data-testid="finish-revival-turn"
    disabled={busy || !!blocked}
    onClick={() => {
      if (!busy && !finishRevivalTurnBlocked(game) &&
        JSON.stringify([game.turn, game.revivalOrder?.turn, game.revivalOrder?.original]) === identity)
        act({ type: 'ready' });
    }}
  >Finish Revival turn</Button>;
}

export function RevivalTurn({ game, act, busy }: Props) {
  const order = game.revivalOrder;
  if (!game.advanced || !order || game.phase !== 4) return null;
  const name = (id: string) => game.players.find(player => player.id === id)?.name ?? id;
  const blocked = finishRevivalTurnBlocked(game);
  return <section aria-label="Revival turn order" className="notice space-y-3">
    <h3>Revival turn order</h3>
    <p>{order.remaining.length ? `Current Revival actor: ${name(order.remaining[0])}.` : 'All Revival turns are finished.'}</p>
    <p>Remaining Revival turns: {order.remaining.map(name).join(' → ') || 'None'}.</p>
    <p>Completed Revival turns: {order.completed.map(name).join(', ') || 'None yet'}.</p>
    <p className="fine" aria-label="Provisional Revival grouping">
      Provisional grouping: finish your force, leader and Kwisatz Haderach revival
      choices together before ending your turn. Revival turns begin in the printed
      storm order for forces. Juice of Sapho may change the remaining order;
      completed Revival turns stay finished. Tleilaxu can still answer another player’s requests.
    </p>
    {blocked && <output className="fine block">{blocked}</output>}
    <FinishRevivalTurn game={game} act={act} busy={busy} />
  </section>;
}
