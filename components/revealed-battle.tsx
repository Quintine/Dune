import type { GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { isStoneBurner } from '@/game/battle-cards';
import { stoneBurnerComparison } from '@/game/stone-burner';
import { BattleComponentInspection } from './battle-component-inspection';
export function RevealedBattle({ game }: { game: GameView }) {
  const battle = game.battle;
  if (!battle?.revealed) return null;
  const attackerPlan = battle.plans[battle.attacker];
  const defenderPlan = battle.plans[battle.defender];
  const comparisons =
    battle.cards.some(isStoneBurner) &&
    battle.ownForces &&
    attackerPlan &&
    defenderPlan
      ? (battle.stoneBurnerContext?.opponentPools ?? []).map((opponent) =>
          stoneBurnerComparison(
            game.me === battle.attacker ? battle.ownForces! : opponent,
            attackerPlan.dial,
            attackerPlan.support,
            game.me === battle.defender ? battle.ownForces! : opponent,
            defenderPlan.dial,
            defenderPlan.support,
          ),
        )
      : [];
  const name = (id: string | null) =>
    id
      ? (game.allLeaders.find((l) => l.id === id)?.name ??
        battle.cards.find((c) => c.id === id)?.name ??
        id)
      : 'None';
  return (
    <div className="revealed-plans" aria-label="Revealed battle plans">
      {Object.entries(battle.plans).map(([id, plan]) => {
        const leader = game.allLeaders.find((l) => l.id === plan.leader);
        const undialed = [
          ...new Set(
            comparisons.flatMap(
              (comparison) =>
                comparison[id === battle.attacker ? 'attacker' : 'defender'],
            ),
          ),
        ].sort((a, b) => a - b);
        return (
          <div key={id}>
            <b>{game.players.find((p) => p.id === id)?.name}</b>
            <span>
              Dial {plan.dial}
              {game.advanced ? ` · ${plan.support} spice support` : ''}
              {!!plan.allyPayment && ` (${plan.allyPayment} from CHOAM)`}
            </span>
            {battle.native === id && !battle.cards.some(isStoneBurner) && (
              <span>
                Native Homeworld bonus: +{battle.nativeBattleStrength} to the
                battle score, separately from the dial
              </span>
            )}
            <span>Leader: {name(plan.leader)}</span>
            {plan.kwisatz && (
              <span>
                Kwisatz Haderach · +2 if leader survives · protected from
                traitors
              </span>
            )}
            <span>Weapon: {name(plan.weapon)}</span>
            {undialed.length > 0 && (
              <span>
                Stone Burner undialed tokens: {undialed.join(' or ')}
                {undialed.length > 1
                  ? ' (possible counts before casualty choice)'
                  : ''}
              </span>
            )}
            {battle.stoneBurner[id] && (
              <span>
                Stone Burner:{' '}
                {battle.stoneBurner[id] === 'kill'
                  ? 'both leaders die'
                  : 'surviving leader strength ignored'}{' '}
                · compare undialed force tokens
              </span>
            )}
            {battle.poisonTooth[id] !== undefined && (
              <span>
                Poison Tooth: {battle.poisonTooth[id] ? 'activated' : 'unused'}
              </span>
            )}
            <span>Defense in original plan: {name(plan.defense)}</span>
            {battle.lateDefense[id] && (
              <span>Added after reveal: {name(battle.lateDefense[id])}</span>
            )}
            <BattleComponentInspection
              playerName={
                game.players.find((p) => p.id === id)?.name ?? 'Player'
              }
              cards={battle.cards.filter((card) =>
                [
                  plan.leader,
                  plan.weapon,
                  plan.defense,
                  battle.lateDefense[id],
                ].includes(card.id),
              )}
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
          </div>
        );
      })}
    </div>
  );
}
