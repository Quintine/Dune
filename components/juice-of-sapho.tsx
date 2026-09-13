'use client';

import { useId } from 'react';
import type { Action, GameView } from '@/game/engine';
import { richeseCardDefinition } from '@/game/richese-cards';
import { Button } from './ui/button';
import { CardInspector } from './card-inspector';

/** Reasons use public timing only; exact card reservation checks stay on the server. */
function unavailableReason(game: GameView) {
  if (game.status !== 'playing')
    return 'Order changes are available during play.';
  if (game.truthtrance || game.response || game.decision || game.phaseOpening)
    return 'Finish the current interaction before changing turn order.';
  if (game.phase === 3) {
    if (game.richeseAuction?.method === 'silent')
      return 'Silent bids are simultaneous. These controls do not change their tie order.';
    if (game.richeseAuction?.method !== 'onceAround')
      return 'These bidding controls require a Once Around auction.';
    return 'No order change is available for you in this lot. You must still be eligible and have not bid; first is available only before bidding begins. A card already committed elsewhere cannot be used.';
  }
  if (game.phase === 5)
    return 'Movement order can change only before the current combined shipment and movement turn begins. First requires all remaining turns to be unstarted and the Advanced Guild to have finished or be absent. Completed turns stay completed. Already-held positions and committed cards are unavailable.';
  if (game.phase === 6)
    return game.battle
      ? 'Finish the current battle and its aftermath before changing the order of remaining battle choices. This does not change the current battle’s aggressor.'
      : 'You need an unresolved battle and an available first or last position. Completed battles stay resolved, and a card committed elsewhere cannot be used.';
  return 'These controls support Once Around bidding, movement order and remaining battle-choice order. Battle aggressor and other phase or auction modes remain unfinished.';
}

export function JuiceOfSapho({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const me = game.players.find((p) => p.id === game.me);
  const card = me?.hand?.find(
    (c) => richeseCardDefinition(c)?.card.effect === 'juiceOfSapho',
  );
  if (!card) return null;
  const options = game.saphoOptions ?? [];
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Juice of Sapho: change turn order
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Choose one available order change, then discard Juice of Sapho. This
          does not grant an extra bid, shipment, movement or battle.
        </p>
        <CardInspector card={card} />
        {options.length ? (
          options.map((option) => {
            const once = option.scope === 'onceAround';
            const battle = option.scope === 'battleOrder';
            return (
              <div
                key={`${option.scope}-${option.event}-${option.mode}`}
                className="flex min-w-0 flex-col gap-2"
              >
                <p>
                  {once
                    ? `Bid ${option.mode} in the current Once Around lot. Each eligible player still has only one bidding opportunity.`
                    : battle
                      ? `Choose your remaining battles ${option.mode}. Completed battles stay resolved. This changes who chooses next, not the aggressor or tie advantage of a battle. Other players may still choose battles against you before your turn.`
                    : `Take the ${option.mode} remaining combined shipment and movement turn. Completed turns stay completed${option.mode === 'last' ? ', and the Guild cannot move behind you' : ''}.`}
                </p>
                <Button
                  className="min-h-11 whitespace-normal motion-reduce:transition-none"
                  disabled={busy}
                  onClick={() => {
                    if (!busy) act({ type: 'card', card: card.id, ...option });
                  }}
                >
                  {once ? 'Bid' : battle ? 'Choose battles' : 'Take your movement turn'} {option.mode} and
                  discard Juice of Sapho
                </Button>
              </div>
            );
          })
        ) : (
          <p className="notice" id={`${id}-reason`}>
            {unavailableReason(game)}
          </p>
        )}
        <p className="text-sm">
          Battle aggressor and other phase or auction modes are still
          unfinished.
        </p>
      </div>
    </details>
  );
}
