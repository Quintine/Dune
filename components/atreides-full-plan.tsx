'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/help-tip';
import type { Action, GameView } from '@/game/engine';

export function AtreidesFullPlan({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.atreidesFullPlan;
  const me = game.players.find((player) => player.id === game.me);
  const battle = game.battle;
  if (!offer || game.status !== 'playing' || !game.advanced ||
    game.phase !== 6 || !battle || me?.faction !== 'atreides') return null;
  const ownOffer = game.decision?.kind === 'fullPlanOffer' && game.decision.player === game.me;
  const priorityPending = !!game.response || !!game.phaseOpening ||
    (!!game.decision && !ownOffer) || !!game.truthtrance || !!game.nexusTraitors?.pending;
  const blocked = offer.blocked || (battle.revealed
    ? 'The Battle Plans have already been revealed.'
    : priorityPending
      ? 'Finish the current response, decision or preparation before inspecting a full plan.'
      : null);
  const disabled = busy || !!blocked;
  const ownSealed = battle.submitted.includes(game.me);
  return (
    <section className="notice space-y-3" aria-label="Atreides full Battle Plan inspection">
      <h3 className="font-serif text-xl">Inspect a full Battle Plan</h3>
      <p className="muted">
        Spend your once-per-game special Karama after battle preparation and
        before public plan revelation, including when zero or one plan is sealed.
        If the chosen combatant has not sealed, they commit first; only you
        receive the inspection. Existing sealed plans cannot change.
      </p>
      <p className="fine">
        {battle.submitted.length} of 2 plans sealed. Leaving this power unused
        now keeps the opportunity open until public revelation. Battle plan
        submission continues normally.
      </p>
      {ownSealed && (
        <p className="notice">
          Your original sealed plan stays fixed. Plans reveal as soon as the
          other combatant seals; this power does not unlock either plan.
        </p>
      )}
      {!!battle.noFieldPlayers.length && (
        <p className="notice">
          Provisional power distinction: special Karama reads the complete
          committed No-Field plan, including dial and support. Ordinary
          Prescience still cannot request its dial. This private read does not
          reveal or materialize the marker before both plans seal.
        </p>
      )}
      <HelpTip topic="fullPlan" />
      {blocked && <p className="notice" id="atreides-full-plan-unavailable">{blocked}</p>}
      {!offer.cards.length && (
        <p className="muted">No spendable Karama is currently available for this special power.</p>
      )}
      {!offer.targets.length && (
        <p className="muted">No combatant is currently available for full-plan inspection.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {offer.cards.flatMap((card) => offer.targets.map((target) => {
          const name = game.players.find((player) => player.id === target)?.name ?? 'the selected combatant';
          return (
            <Button
              key={`${card}-${target}`}
              data-testid={`atreides-full-plan-${card}-${target}`}
              className="game-action min-h-11 whitespace-normal"
              disabled={disabled}
              aria-describedby={blocked ? 'atreides-full-plan-unavailable' : undefined}
              onClick={() => {
                if (!disabled) act({ type: 'card', mode: 'special', card, target });
              }}
            >
              Spend Karama · inspect {name}{battle.submitted.includes(target) ? ' · sealed plan' : ''}
              <ArrowRight size={15} />
            </Button>
          );
        }))}
      </div>
    </section>
  );
}
