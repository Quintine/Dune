'use client';

import { fighterCount } from '@/game/advisors';
import { validLocation } from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';

export interface FaceDanceActionsProps {
  game: GameView;
  sources: Record<string, number>;
  sector: number;
  busy: boolean;
  act: (action: Action) => void;
}

/** The existing public survivor count and the caller's own selectable forces. */
export function faceDanceForceChoices(game: GameView) {
  const d = game.decision;
  const me = game.players.find((player) => player.id === game.me);
  const world =
    d?.kind === 'faceDance' && d.player === game.me
      ? game.combatLocations?.find(
          (place) => place.id === d.territory && place.kind === 'homeworld',
        )
      : undefined;
  const foreign = d?.kind === 'faceDance' ? world?.forces?.[d.winner] : undefined;
  const maximum =
    d?.kind === 'faceDance' && d.player === game.me && me
      ? world
        ? (foreign?.normal ?? 0) + (foreign?.elite ?? 0)
        : d.winners
          ? game.players.reduce(
              (sum, player) =>
                sum +
                (d.winners!.includes(player.id)
                  ? fighterCount(player, d.territory)
                  : 0),
              0,
            )
          : fighterCount(
              game.players.find((player) => player.id === d.winner)!,
              d.territory,
            )
      : 0;
  const availableSources: Record<string, number> =
    d?.kind === 'faceDance' && d.player === game.me && me
      ? world
        ? me.forces
        : { reserves: me.reserves, ...me.forces }
      : {};
  return { world, maximum, availableSources };
}

/** Hook-free so the actual guarded callbacks can be exercised directly. */
export function FaceDanceActions({
  game,
  sources,
  sector,
  busy,
  act,
}: FaceDanceActionsProps) {
  const d = game.decision;
  const owner = d?.kind === 'faceDance' && d.player === game.me;
  const me = owner ? game.players.find((player) => player.id === game.me) : undefined;
  const held = me?.faceDancers?.some(
    (card) => !card.revealed && d?.kind === 'faceDance' && card.leader === d.identity,
  );
  const { world, maximum, availableSources } = faceDanceForceChoices(game);
  const selected =
    sources && typeof sources === 'object' && !Array.isArray(sources)
      ? Object.entries(sources)
      : null;
  const validCounts =
    selected !== null &&
    selected.every(
      ([key, count]) =>
        Object.hasOwn(availableSources, key) &&
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= availableSources[key],
    );
  const total = validCounts ? selected.reduce((sum, [, count]) => sum + count, 0) : null;
  const validSources = validCounts &&
    Number.isSafeInteger(total) &&
    total! <= maximum;
  const revealDisabled =
    busy ||
    !owner ||
    !me ||
    !held ||
    !!(d?.kind === 'faceDance' && d.blocked) ||
    !validSources ||
    (!world &&
      !(d?.kind === 'faceDance' && Number.isSafeInteger(sector) && validLocation(d.territory, sector)));
  const declineDisabled = busy || !owner || !me;
  return (
    <>
      <Button
        data-testid="face-dance-reveal"
        disabled={revealDisabled}
        onClick={() => {
          if (!revealDisabled)
            act({
              type: 'decision',
              reveal: true,
              sources,
              ...(world ? {} : { sector }),
            });
        }}
      >
        Reveal Face Dancer
      </Button>
      <Button
        data-testid="face-dance-decline"
        variant="outline"
        disabled={declineDisabled}
        onClick={() => {
          if (!declineDisabled) act({ type: 'decision', reveal: false });
        }}
      >
        Decline Face Dancer
      </Button>
    </>
  );
}
