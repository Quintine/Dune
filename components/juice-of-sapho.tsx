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
  if (game.phase === 5)
    return 'Movement order supports clean combined-turn boundaries and queuing behind a started active turn. Your own started turn may be paused at a clean boundary and resumed last, with spent actions retained. Finish pending interactions and preparations first. The Advanced Guild retains its next timing choice; another player cannot displace an already granted Guild turn, and last remains after the Guild. A Karama-locked privilege stays locked. Completed turns and actual shipment and movement counters stay unchanged. Already-held positions and committed cards remain unavailable.';
  if (game.truthtrance || game.response || game.phaseOpening ||
    (game.decision && !(game.phase === 8 && game.decision.kind === 'moritaniExtortion')))
    return 'Finish the current interaction before changing turn order.';
  if (game.phase === 2)
    return !game.advanced || !game.charityOrder
      ? 'Charity order changes require an ordered Advanced Charity phase. Basic and an already-opened unstamped phase keep their existing timing.'
      : 'Choose first or last only among remaining unstarted Charity turns. A player who has claimed finishes their Charity turn unchanged. Completed turns stay finished; already-held positions and committed cards are unavailable.';
  if (game.phase === 4)
    return !game.advanced || !game.revivalOrder
      ? 'Revival order changes require an ordered Advanced Revival phase. Basic and an already-opened unstamped phase keep their existing timing.'
      : 'Change the order of remaining Revival turns. Another player finishes any started turn first. At a clean boundary, you may pause your own started turn and resume it last with used allowances unchanged. Completed turns stay finished; already-held positions and committed cards are unavailable.';
  if (game.phase === 8 && game.extortion?.pending)
    return 'Only an unanswered non-Moritani player can change their Extortion choice position. Earlier declines stay finished. Already-held first/last positions and committed cards are unavailable; you may still decline payment when your choice arrives.';
  if (game.phase === 3) {
    if (game.richeseAuction?.method === 'silent')
      return 'Silent bids are simultaneous. These controls do not change their tie order.';
    if (game.auction || game.richeseAuction?.method === 'normal')
      return 'No cyclic order change is available for your pending bid. A passed player waits for a new raise; the current high bidder has no pending bid. Already-held positions and committed cards are unavailable.';
    return 'No order change is available for you in this lot. You must not have bid or passed; discarding this card can open a hand slot, but a completed opportunity cannot be repeated. A card already committed elsewhere cannot be used.';
  }
  if (game.phase === 6)
    return game.battle
      ? game.battle.saphoTimingVersion === 1
        ? 'Become aggressor at a clean boundary before both players finish final battle actions. Already-held priority, a committed card, pending decisions and closed final opportunities are unavailable. Finish the current battle and its aftermath before changing remaining battle-choice order.'
        : 'This older battle retains its pre-plan opportunity, before declaring ready or committing a plan. Already-held priority and committed cards are unavailable. Finish the current battle and its aftermath before changing remaining battle-choice order.'
      : 'You need an unresolved battle and an available first or last position. Completed battles stay resolved, and a card committed elsewhere cannot be used.';
  return 'These controls support Once Around and cyclic bidding, movement order, remaining battle-choice order and aggressor priority. Other phase modes remain unfinished.';
}

type SaphoOption = NonNullable<GameView['saphoOptions']>[number];

/** Submit only action fields: projected timing guidance is display metadata. */
export function SaphoOrderButton({
  card,
  option,
  act,
  busy,
}: {
  card: string;
  option: SaphoOption;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const bidding = option.scope === 'onceAround' || option.scope === 'cyclicAuction';
  return (
    <Button
      className="min-h-11 whitespace-normal motion-reduce:transition-none"
      disabled={busy}
      onClick={() => {
        if (!busy) act({
          type: 'card', card, scope: option.scope, event: option.event, mode: option.mode,
        });
      }}
    >
      {option.scope === 'battleAggressor' ? 'Become aggressor and discard Juice of Sapho' :
        (option.scope === 'movement' || option.scope === 'revival') && option.resumeOwn ? `Resume your ${option.scope} last and discard Juice of Sapho` :
        `${bidding ? 'Bid' : option.scope === 'battleOrder' ? 'Choose battles' : option.scope === 'extortion' ? 'Take your Extortion choice' : option.scope === 'revival' ? 'Take your Revival turn' : option.scope === 'charity' ? 'Take your Charity turn' : 'Take your movement turn'} ${option.mode} and discard Juice of Sapho`}
    </Button>
  );
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
  const options = (game.saphoOptions ?? []).filter(option =>
    option.scope === 'charity'
      ? game.advanced && game.phase === 2 && !!game.charityOrder?.remaining.includes(game.me)
      : option.scope !== 'revival' ||
        (game.advanced && game.phase === 4 && game.revivalOrder?.remaining.includes(game.me) &&
          !game.revivalOrder.completed.includes(game.me)));
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Juice of Sapho: change order or become aggressor
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
            const cyclic = option.scope === 'cyclicAuction';
            const battle = option.scope === 'battleOrder';
            const aggressor = option.scope === 'battleAggressor';
            const extortion = option.scope === 'extortion';
            const revival = option.scope === 'revival';
            const charity = option.scope === 'charity';
            const resumeOwn = (option.scope === 'movement' || revival) && option.resumeOwn;
            const afterCurrent = (option.scope === 'movement' || revival || charity) && option.afterCurrent;
            const currentPlayer = afterCurrent
              ? game.players.find(player => player.id === afterCurrent)?.name ?? 'The active player'
              : null;
            return (
              <div
                key={`${option.scope}-${option.event}-${option.mode}`}
                className="flex min-w-0 flex-col gap-2"
              >
                {currentPlayer && (charity ? (
                  <p aria-label="Provisional queued Charity order">
                    Provisional queued Charity order: {currentPlayer} finishes
                    the current Charity turn unchanged. Your {option.mode}
                    {' '}position applies among later unstarted Charity turns.
                    Completed turns and claims stay finished; each player
                    still has only one Charity claim.
                  </p>
                ) : revival ? (
                  <p aria-label="Provisional queued Revival order">
                    Provisional queued Revival order: {currentPlayer} finishes
                    the current Revival turn unchanged. Your {option.mode}
                    {' '}position applies among later unstarted Revival turns.
                    Completed turns, returned pieces, payments and revival
                    allowances stay unchanged.
                  </p>
                ) : (
                  <p>
                    Provisional queued movement order: {currentPlayer} finishes
                    the current combined shipment and movement turn unchanged.
                    Your {option.mode} position applies among later unstarted
                    combined turns. Completed turns and actual shipment and
                    movement counters stay unchanged.
                    {game.advanced && game.players.some(player => player.faction === 'guild' && player.id !== game.me)
                      ? ' The Advanced Guild keeps its native timing choice at the next boundary. A last position still follows the Guild.'
                      : ''}
                  </p>
                ))}
                <p>
                  {resumeOwn
                    ? revival
                      ? 'Pause your started Revival turn and resume it last, after the other remaining players. Returned pieces, costs and used revival allowances remain unchanged. This timing is provisional.'
                      : 'Pause your started turn and resume it last, after the other remaining players. Shipment and movement already used stay spent; no extra action is granted. This timing is provisional.'
                    : aggressor
                    ? 'Become this battle’s aggressor. You win ordinary ties; a Habbanya Stronghold advantage still takes precedence. The participants, committed plans and later battle choices stay unchanged.'
                    : extortion
                    ? `Take your Extortion choice ${option.mode} among unanswered players. Earlier declines and Moritani’s five-spice bank collection remain. You may decline instead of paying; the first actual three-spice payment ends all offers.`
                    : cyclic
                    ? `Bid ${option.mode} in the current cyclic lot. Provisional duration: this lot only. Existing bids, funding and passes stay committed. Later circuits use the changed cycle; the next lot returns to its normal opener.`
                    : once
                    ? `Bid ${option.mode} in the current Once Around lot. Each eligible player still has only one bidding opportunity.`
                    : battle
                      ? `Choose your remaining battles ${option.mode}. Completed battles stay resolved. This changes who chooses next, not the aggressor or tie advantage of a battle. Other players may still choose battles against you before your turn.`
                    : charity
                      ? `Take the ${option.mode} remaining Charity turn. Completed Charity turns stay finished. Each player still has only one Charity claim; changing order does not grant another claim or reopen completed turns.`
                    : revival
                      ? `Take the ${option.mode} remaining Revival turn. Completed Revival turns stay finished. This changes the remaining order without granting another revival, resetting allowances or returning completed players to the queue.`
                    : `Take the ${option.mode} remaining combined shipment and movement turn. Completed turns stay completed${option.mode === 'last' ? ', and the Guild cannot move behind you' : game.advanced && game.players.some(player => player.faction === 'guild' && player.id !== game.me) ? '. Provisional first priority: the Guild retains its next legal timing choice and may take its turn before yours; a Karama-locked privilege stays locked' : ''}.`}
                </p>
                <SaphoOrderButton card={card.id} option={option} act={act} busy={busy} />
              </div>
            );
          })
        ) : (
          <p className="notice" id={`${id}-reason`}>
            {unavailableReason(game)}
          </p>
        )}
        <p className="text-sm">
          Late aggressor timing in new battles uses a provisional shared final opportunity. Older battles retain their pre-plan timing. Other phase modes are still unfinished.
        </p>
      </div>
    </details>
  );
}
