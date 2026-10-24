'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';

export function CharityClaim({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const me = game.players.find((player) => player.id === game.me);
  if (game.status !== 'playing' || game.phase !== 2 || !me) return null;
  const disabled = busy || !!game.truthtrance || !!game.nexusTraitors?.pending ||
    !!me.charityClaimed || game.charity.incomePending || game.charity.amount === 0;
  return (
    <>
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
        disabled={disabled}
        onClick={() => {
          if (!disabled) act({ type: 'charity' });
        }}
      >
        {game.charity.amount > 0
          ? `Claim ${game.charity.amount} charity spice`
          : 'Claim charity'}
        <ArrowRight size={15} />
      </Button>
    </>
  );
}
