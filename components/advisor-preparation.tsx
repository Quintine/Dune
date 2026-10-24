'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { territory } from '@/game/board';
import type { Action, GameView } from '@/game/engine';

export function AdvisorPreparation({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.advisorPreparation;
  const me = game.players.find((player) => player.id === game.me);
  if (!offer || game.status !== 'playing' || !game.advanced ||
    game.phase < 2 || game.phase > 5 || me?.faction !== 'beneGesserit') return null;
  const priorityPending = !!game.response || !!game.decision || !!game.phaseOpening;
  const blocked = offer.blocked || (priorityPending
    ? 'Finish the current response, decision or phase opening before preparing advisors.'
    : null);
  const disabled = busy || !!blocked || !!game.truthtrance || !!game.nexusTraitors?.pending;
  return (
    <section className="notice space-y-3" aria-label="Bene Gesserit advisor preparation">
      <h3 className="font-serif text-xl">Prepare advisors for battle</h3>
      <p className="muted">
        After Spice Blow and any Nexus, you may prepare advisors until the first
        actual shipment has occurred. This window includes Charity, Bidding, Revival
        and the opening of Shipment and Movement.
      </p>
      <p className="fine">
        Choose a territory to turn all your advisors there into fighters, across
        every sector. Storm, ordinary allied occupation and fresh-advisor restrictions
        still apply. The existing supported Ecaz co-side composition retains its
        separate eligibility.
      </p>
      <p className="fine">
        Provisional Karama policy: a canceled preparation blocks that territory
        until this window ends. Other eligible territories remain available.
        Intrusion, Nexus conversion and automatic advisor flips remain independent.
      </p>
      <p className="fine">
        The ordinary advisor chooser during Shipment and Movement remains
        available. Declining that choice does not close this preparation window.
      </p>
      {blocked && <p className="notice" id="advisor-preparation-unavailable">{blocked}</p>}
      {!offer.territories.length && (
        <p className="muted">No advisor territory is currently eligible for preparation.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {offer.territories.map((id) => (
          <Button
            key={id}
            data-testid={`advisor-preparation-${id}`}
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            aria-describedby={blocked ? 'advisor-preparation-unavailable' : undefined}
            onClick={() => {
              if (!disabled) act({ type: 'prepareAdvisors', territory: id });
            }}
          >
            Prepare advisors · {territory(id).name}
            <ArrowRight size={15} />
          </Button>
        ))}
      </div>
    </section>
  );
}
