'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function NexusEmperorSellerPurchase({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const decision = game.decision;
  if (decision?.kind !== 'nexusEmperorSellerPurchase' || decision.player !== game.me) return null;
  const own = game.players.find(player => player.id === game.me);
  const offer = game.nexusEmperorSellerPurchase;
  const seller = offer && game.players.find(player => player.id === offer.seller);
  const disabled = busy || game.status !== 'playing' || game.phase !== 3 ||
    game.automaticContinuationPending || !!game.phaseOpening || !!game.response ||
    !!game.truthtrance || !!game.nexusTraitors?.pending ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const entitled = !!offer && offer.event === decision.event && offer.canUse && !offer.blocked;

  return (
    <section aria-label="Richese purchase confirmation" className="notice min-w-0 space-y-3 break-words">
      <h3>Confirm your winning purchase</h3>
      <p>Pay the original winning price to complete this Treachery Card purchase.
        This confirmation does not change the winning lot or bid.</p>
      {offer && <>
        <h4>Emperor Nexus · Secret Ally</h4>
        <p>The original {offer.source === 'cache' ? 'Richese cache' : 'Black Market'} price is
          {' '}{offer.price} spice. Show that you personally hold the full amount to keep your spice
          while acquiring the original card.</p>
        <p className="fine">Provisional seller policy, not a publisher ruling:
          {' '}{seller?.name ?? offer.seller} remains unpaid. No bank reimbursement or substitute
          payer is created. {offer.policy} Using this option spends your Emperor Nexus Card.</p>
        {offer.blocked && <output className="fine block">{offer.blocked}</output>}
      </>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled) act({ type: 'nexusEmperorSellerPurchase', event: decision.event, use: false }); }}>
        Pay original winning price
      </Button>
      {offer && entitled && <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
        onClick={() => { if (!disabled && entitled) act({ type: 'nexusEmperorSellerPurchase', event: decision.event, use: true }); }}>
        Use Emperor Nexus · keep {offer.price} spice; seller unpaid
      </Button>}
    </section>
  );
}
