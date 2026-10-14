'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function NexusEmperorAmbassadorPurchase({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const decision = game.decision;
  if (decision?.kind !== 'nexusEmperorAmbassadorPurchase' || decision.player !== game.me) return null;
  const own = game.players.find(player => player.id === game.me);
  const offer = game.nexusEmperorAmbassadorPurchase;
  const disabled = busy || game.status !== 'playing' ||
    game.automaticContinuationPending || !!game.phaseOpening || !!game.response ||
    !!game.truthtrance || !!game.nexusTraitors?.pending ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const entitled = !!offer && offer.event === decision.event && offer.canUse && !offer.blocked;

  return (
    <section aria-label="Richese Ambassador purchase confirmation" className="notice min-w-0 space-y-3 break-words">
      <h3>Confirm the Richese Ambassador purchase</h3>
      <p>The original Ambassador effect purchases one Treachery Card for 3 spice.
        Pay continues that purchase; there is no additional decline option.</p>
      {offer && <>
        <h4>Emperor Nexus · Secret Ally</h4>
        <p>Personally hold the full three-spice price to keep your spice while acquiring
          the original card. Using this option spends your Emperor Nexus Card.</p>
        <p className="fine">Source recommendation, not a publisher ruling: apply the Emperor
          Secret Ally purchase benefit to the original Richese Ambassador purchase, outside
          Bidding. The bank remains unpaid; no seller, reimbursement or substitute income is
          created. {offer.policy}</p>
        {offer.blocked && <output className="fine block">{offer.blocked}</output>}
      </>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled) act({ type: 'nexusEmperorAmbassadorPurchase', event: decision.event, use: false }); }}>
        Pay original three-spice price
      </Button>
      {entitled && <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled && entitled) act({ type: 'nexusEmperorAmbassadorPurchase', event: decision.event, use: true }); }}>
        Use Emperor Nexus · keep 3 spice
      </Button>}
    </section>
  );
}
