'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export function EcazDukeAcquisitionChoices({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const entry = game.ambassadorEntry;
  if (
    !entry ||
    entry.stage !== 'offer' ||
    entry.effect !== 'ecaz' ||
    entry.owner !== game.me ||
    game.decision?.kind !== 'ecazAmbassador' ||
    game.decision.player !== game.me
  )
    return null;

  const recipients = entry.beneficiaries.length
    ? entry.beneficiaries
    : [{
        player: entry.owner,
        blocked: entry.dukeAcquisition
          ? entry.dukeAcquisition.blocked
          : 'Duke acquisition is unavailable for this opportunity.',
      }];

  return (
    <div className="flex flex-col gap-3" aria-label="Ecaz Ambassador Duke acquisition">
      <p className="m-0 text-sm leading-6">
        Acquire Duke Vidal for a listed recipient. The Ambassador returns to
        your supply.
      </p>
      <p className="m-0 text-sm leading-6" aria-label="Provisional shared Duke tenure">
        Provisional ordinary acquisition: the chosen recipient keeps Duke Vidal
        until battle use, including when unused beyond this turn, unless another
        rule takes him away. A recipient holding him under a different temporary
        tenure can renew that control with the Ambassador. The separate Duke
        loan after a new alliance lasts for the current turn. Only Ecaz may revive him.
      </p>
      {recipients.map((recipient) => {
        const blocked = recipient.blocked;
        const disabled = busy || !!blocked;
        const reasonId = `ecaz-duke-${entry.event}-${recipient.player}-blocked`;
        const name = game.players.find((player) => player.id === recipient.player)?.name ?? recipient.player;
        return (
          <div key={recipient.player} className="flex flex-col gap-2">
            <Button
              className="min-h-11 whitespace-normal motion-reduce:transition-none"
              data-testid={`ecaz-duke-acquisition-${recipient.player}`}
              disabled={disabled}
              aria-describedby={blocked ? reasonId : undefined}
              onClick={() => {
                if (!disabled)
                  act({
                    type: 'decision',
                    event: entry.event,
                    trigger: true,
                    beneficiary: recipient.player,
                    choice: 'duke',
                  });
              }}
            >
              Acquire Duke Vidal for {name}
            </Button>
            {blocked && <p id={reasonId} className="m-0 text-sm leading-6">{blocked}</p>}
          </div>
        );
      })}
    </div>
  );
}
