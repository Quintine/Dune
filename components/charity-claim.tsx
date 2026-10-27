'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';

type Props = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

export function CharityClaim(props: Props) {
  const { game, act, busy } = props;
  const me = game.players.find((player) => player.id === game.me);
  if (game.status !== 'playing' || game.phase !== 2 || !me) return null;
  const actor = game.me, turn = game.turn, order = game.charityOrder;
  const currentActor = order?.remaining[0];
  const currentName = game.players.find(player => player.id === currentActor)?.name ?? 'the current player';
  const ownTurn = !order || (order.version === 1 || order.version === 2) && order.turn === turn && order.remaining[0] === actor;
  const blocked = busy || !!game.truthtrance || !!game.nexusTraitors?.pending || game.charity.incomePending ||
    !!game.response || !!game.decision || !!game.phaseOpening || !!game.automaticContinuationPending ||
    !ownTurn || !!game.charity.orderBlocked;
  const canClaim = !blocked && !me.charityClaimed && game.charity.amount > 0;
  const canFinish = !!order && !blocked;
  return (
    <>
      {order && <div className="fine" data-testid="charity-turn-status">
        <p>{order.version === 2 ? 'Juice of Sapho changed the remaining Charity order. Completed turns stay finished.' : 'Advanced Charity proceeds from the First Player counterclockwise, one player at a time.'}</p>
        <p>{(order.version !== 1 && order.version !== 2) || order.turn !== turn
          ? 'This Charity turn order is no longer current.'
          : !currentActor ? 'All Charity turns are complete.'
            : !order.remaining.includes(actor) ? `Your Charity turn is complete. Waiting for ${currentName} to finish Charity.`
              : currentActor === actor ? 'It is your Charity turn. Claim if eligible, then finish your turn to continue.'
                : `Waiting for ${currentName} to finish Charity. Your turn comes later in the public order.`}</p>
        {game.charity.orderBlocked && <p>{game.charity.orderBlocked}</p>}
      </div>}
      <p className="muted">
        {game.charity.multiplier === 0
          ? 'Inflation cancels charity for every faction this turn.'
          : game.charity.multiplier === 2
            ? 'Inflation doubles the amount of charity you receive. Ordinary eligibility still requires fewer than two spice; advanced Bene Gesserit receives four regardless of wealth.'
            : game.advanced && me.faction === 'beneGesserit'
              ? 'Receive two spice once per turn. If you already hold two or more, opponents may cancel the faction benefit with Karama.'
              : 'If you have fewer than two spice, claim charity once to reach two.'}
      </p>
      <p className="fine">
        {game.charity.payer
          ? `The ordinary claim is ${game.charity.ordinary} spice. CHOAM pays as much of the ordinary claim as it can; the Spice Bank supplies any shortfall. This funding rule is provisional.`
          : 'Charity is paid by the Spice Bank.'}
        {game.charity.homeworld > 0 &&
          ` Low Homeworld population adds ${game.charity.homeworld} spice directly from the bank${game.charity.multiplier === 2 ? ' after Inflation doubles the bonus' : ''}.`}
      </p>
      <Button
        data-testid="charity-claim-submit"
        className="game-action"
        disabled={!canClaim}
        onClick={() => {
          if (canClaim) act({ type: 'charity' });
        }}
      >
        {game.charity.amount > 0
          ? `Claim ${game.charity.amount} charity spice`
          : 'Claim charity'}
        <ArrowRight size={15} />
      </Button>
      {order && <Button
        data-testid="charity-turn-finish"
        className="game-action"
        disabled={!canFinish}
        onClick={() => { if (canFinish) act({ type: 'ready' }); }}
      >
        Finish Charity turn
      </Button>}
    </>
  );
}
