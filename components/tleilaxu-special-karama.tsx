'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';

export function TleilaxuSpecialKarama({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.tleilaxuSpecialKarama;
  const me = game.players.find((player) => player.id === game.me);
  if (!offer || game.status !== 'playing' || !game.advanced ||
    game.phase !== 4 || me?.faction !== 'tleilaxu') return null;
  const ownStop = offer.pending && game.decision?.kind === 'revivalStop' &&
    game.decision.player === game.me;
  const priorityPending = !!game.response || !!game.phaseOpening || !!game.truthtrance ||
    !!game.nexusTraitors?.pending || (!!game.decision && !ownStop) || (offer.pending && !ownStop);
  const blocked = offer.blocked || (priorityPending
    ? 'Finish the current response, decision or phase opening before using this special Karama.'
    : null);
  return (
    <section className="notice space-y-3" aria-label="Tleilaxu special Karama revival prevention">
      <h3 className="font-serif text-xl">Prevent revival</h3>
      <p className="muted">
        Spend your once-per-game special Karama to prevent one faction’s force
        and leader revivals for the rest of this Revival, including returns from
        Ghola Treachery. You may choose
        yourself or an ally, even if the chosen faction is ready or has already
        completed revivals.
      </p>
      <p className="fine">
        Completed returns and payments stay unchanged. This power does not
        remove returned pieces or refund spice.
      </p>
      <p className="fine">
        Provisional rule: Ghola Treachery is included during the
        affected Revival, and this prevention expires when the phase ends. It
        does not stop Ghola outside Revival.
      </p>
      <p className="fine">
        The Emperor’s native special Karama remains protected by the printed
        immunity of special Karama powers.
      </p>
      {game.homeworlds && <p className="fine">
        Provisional Homeworld rule: Low keeps its printed free revival rate.
        Preventing the return as a whole gives no separate bonus-only return.
      </p>}
      {offer.pending && (
        <p className="fine">Only the original recipient can be selected during this pending revival.</p>
      )}
      {blocked && <p className="notice" id="tleilaxu-special-karama-unavailable">{blocked}</p>}
      {!offer.cards.length && (
        <p className="muted">No spendable Karama is currently available for this special power.</p>
      )}
      {!offer.targets.length && (
        <p className="muted">No faction is currently available for this revival-prevention power.</p>
      )}
      {offer.targets.map((target) => {
        const name = game.players.find((player) => player.id === target.player)?.name ?? 'the selected faction';
        const targetReasonId = `tleilaxu-special-karama-${target.player}-unavailable`;
        const describedBy = [
          blocked ? 'tleilaxu-special-karama-unavailable' : undefined,
          target.blocked ? targetReasonId : undefined,
        ].filter(Boolean).join(' ') || undefined;
        const disabled = busy || !!blocked || !!target.blocked;
        return (
          <div key={target.player} className="space-y-2">
            {target.blocked && <p className="notice" id={targetReasonId}>{name}: {target.blocked}</p>}
            <div className="flex flex-wrap gap-2">
              {offer.cards.map((card) => (
                <Button
                  key={card}
                  data-testid={`tleilaxu-special-karama-${card}-${target.player}`}
                  className="game-action min-h-11 whitespace-normal"
                  disabled={disabled}
                  aria-describedby={describedBy}
                  onClick={() => {
                    if (!disabled) act({ type: 'card', mode: 'special', card, target: target.player });
                  }}
                >
                  Spend special Karama · prevent revival for {name}
                  <ArrowRight size={15} />
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
