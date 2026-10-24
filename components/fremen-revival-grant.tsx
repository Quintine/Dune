'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';

export function FremenRevivalGrant({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const grant = game.fremenRevivalGrant;
  const me = game.players.find((player) => player.id === game.me);
  if (!grant || game.status !== 'playing' || game.phase !== 4 ||
    me?.faction !== 'fremen' || me.ally !== grant.recipient) return null;
  const recipient = game.players.find((player) => player.id === grant.recipient)?.name ?? 'your ally';
  const disabled = busy || !!game.truthtrance || !!game.nexusTraitors?.pending ||
    !!grant.blocked || grant.granted;
  return (
    <section className="notice space-y-3" aria-label="Fremen ally free revival">
      <h3 className="font-serif text-xl">Fremen ally revival</h3>
      <p className="muted">
        Grant {recipient} an ordinary free force revival rate of three this phase. This
        replaces their native ordinary rate rather than adding three. Ordinary total
        revival and special-force limits still apply.
      </p>
      <p className="fine">
        Provisional current-rate policy: Recruits doubles the current granted rate, including applicable bonuses,
        before caps. Without other bonuses, three becomes six.
        Later grants use the same current-rate calculation;
        your ally’s revival controls show the actual remaining allowance.
        Previously recorded free returns use the allowance. Earlier paid returns keep their payments and count
        toward the total revival limit; there is no refund or retroactive
        reclassification.
      </p>
      <p className="fine">
        Another player may use Karama before the original alliance grant takes effect.
        Canceling blocks this Fremen grant to the current ally for this Revival;
        the ally retains its intrinsic rate and Recruits. Completed revivals and
        payments stay unchanged. This response timing and prevention scope are provisional.
      </p>
      {grant.granted && (
        <p className="muted">Free revival has been granted to {recipient} for this phase.</p>
      )}
      {grant.blocked && (
        <p className="notice" id="fremen-revival-grant-unavailable">{grant.blocked}</p>
      )}
      <Button
        data-testid="fremen-revival-grant-submit"
        className="game-action"
        disabled={disabled}
        aria-describedby={grant.blocked ? 'fremen-revival-grant-unavailable' : undefined}
        onClick={() => {
          if (!disabled) act({ type: 'grantRevival' });
        }}
      >
        Grant ally free revival
        <ArrowRight size={15} />
      </Button>
    </section>
  );
}
