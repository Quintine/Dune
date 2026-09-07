'use client';
import type { GameView } from '@/game/engine';
import { HelpTip } from './help-tip';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { BattleComponentInspection } from './battle-component-inspection';

export function PrivateBattlePlan({ game }: { game: GameView }) {
  const insight = game.battle?.fullPlanInsight;
  if (
    !insight ||
    game.battle?.revealed ||
    game.battle?.fullPlan?.owner !== game.me
  )
    return null;
  const leader = game.allLeaders.find((l) => l.id === insight.plan.leader);
  const name = (id: string | null) =>
    id
      ? (insight.cards.find((c) => c.id === id)?.name ??
        game.allLeaders.find((l) => l.id === id)?.name ??
        id)
      : 'None';
  return (
    <section
      className="private-battle-plan"
      aria-label="Private battle plan inspection"
    >
      <span className="eyebrow">Atreides · private inspection</span>
      <h3>
        {game.players.find((p) => p.id === insight.target)?.name}’s committed
        plan <HelpTip topic="fullPlan" />
      </h3>
      <p className="muted">
        Only you receive this inspection, including when you are helping an
        ally. It stays available until both plans are publicly revealed. The
        other combatant can prepare and seal their plan without an inspection
        confirmation.
      </p>
      <dl>
        <div>
          <dt>Dial</dt>
          <dd>{insight.plan.dial}</dd>
        </div>
        <div>
          <dt>Spice support</dt>
          <dd>{insight.plan.support}</dd>
        </div>
        <div>
          <dt>Leader</dt>
          <dd>{name(insight.plan.leader)}</dd>
        </div>
        <div>
          <dt>Weapon</dt>
          <dd>{name(insight.plan.weapon)}</dd>
        </div>
        <div>
          <dt>Defense</dt>
          <dd>{name(insight.plan.defense)}</dd>
        </div>
        <div>
          <dt>Kwisatz Haderach</dt>
          <dd>{insight.plan.kwisatz ? 'Included' : 'Not included'}</dd>
        </div>
      </dl>
      <BattleComponentInspection
        playerName={
          game.players.find((p) => p.id === insight.target)?.name ?? 'Player'
        }
        cards={insight.cards}
        leader={
          leader
            ? {
                name: leader.name,
                factionName: faction(leader.faction).name,
                strength: leaderStrengthLabel(leader),
              }
            : undefined
        }
      />
    </section>
  );
}
