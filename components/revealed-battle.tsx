import type { GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { isStoneBurner } from '@/game/battle-cards';
import { stoneBurnerComparison } from '@/game/stone-burner';
import { RevealedPlanPieces } from './revealed-plan-pieces';
import { KwisatzInspector } from './kwisatz-inspector';
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
    <section className="revealed-plans" id="revealed-battle-plans" tabIndex={-1} aria-label="Revealed battle plans">
      <h3>Revealed battle plans</h3>
      <a className="battle-display-link" href="#table-decisions">Return to battle decisions</a>
      <p className="revealed-plans-help">Both plans are public. Inspect any played component; use the decision controls to resolve the battle. <a href="/rules?topic=revealed-battle-components#revealed-battle-components">Component guide</a> · <a href="/rules?topic=battle#battle">Battle rules</a></p>
      <div className="revealed-plan-pair">
      {[battle.attacker, battle.defender].map((id) => {
        const plan = battle.plans[id];
        if (!plan) return null;
        const leader = game.allLeaders.find((l) => l.id === plan.leader);
        const diplomat =
          battle.diplomatDefense?.player === id ? battle.diplomatDefense : null;
        const undialed = [
          ...new Set(
            comparisons.flatMap(
              (comparison) =>
                comparison[id === battle.attacker ? 'attacker' : 'defender'],
            ),
          ),
        ].sort((a, b) => a - b);
        return (
          <section className="revealed-plan" key={id} aria-label={`${id === battle.attacker ? 'Attacker' : 'Defender'} plan`}>
            <h4>{game.players.find((p) => p.id === id)?.name} · {id === battle.attacker ? 'Attacker' : 'Defender'}</h4>
            <span className="revealed-plan-detail">
              Dial {plan.dial}
              {game.advanced ? ` · ${plan.support} spice support` : ''}
              {!!plan.allyPayment && ` (${plan.allyPayment} from CHOAM)`}
            </span>
            {!!plan.bankerSpice && (
              <span className="revealed-plan-detail">Spice Banker: {plan.bankerSpice} spice committed</span>
            )}
            {battle.native === id && !battle.cards.some(isStoneBurner) && (
              <span className="revealed-plan-detail">
                Native Homeworld bonus: +{battle.nativeBattleStrength} to the
                battle score, separately from the dial
              </span>
            )}
            {plan.kwisatz && (
              <span className="revealed-plan-detail">
                Kwisatz Haderach · +2 if leader survives · protected from
                traitors
              </span>
            )}
            {undialed.length > 0 && (
              <span className="revealed-plan-detail">
                Stone Burner undialed tokens: {undialed.join(' or ')}
                {undialed.length > 1
                  ? ' (possible counts before casualty choice)'
                  : ''}
              </span>
            )}
            {battle.stoneBurner[id] && (
              <span className="revealed-plan-detail">
                Stone Burner:{' '}
                {battle.stoneBurner[id] === 'kill'
                  ? 'both leaders die'
                  : 'surviving leader strength ignored'}{' '}
                · compare undialed force tokens
              </span>
            )}
            {battle.poisonTooth[id] !== undefined && (
              <span className="revealed-plan-detail">
                Poison Tooth: {battle.poisonTooth[id] ? 'activated' : 'unused'}
              </span>
            )}
            {diplomat?.stage === 'copied' && diplomat.card && (
              <span className="revealed-plan-detail">
                Diplomat: {name(diplomat.card)} copies {name(diplomat.source)} ·
                discard after battle
              </span>
            )}
            {diplomat?.stage === 'declined' && (
              <span className="revealed-plan-detail">Diplomat: defense copy declined</span>
            )}
            <RevealedPlanPieces
              dial={plan.dial}
              leader={leader ? { id: leader.id, name: leader.name, factionName: faction(leader.faction).name, strength: leaderStrengthLabel(leader) } : undefined}
              leaderCard={battle.cards.find(card => card.id === plan.leader)}
              weapon={battle.cards.find(card => card.id === plan.weapon)}
              defense={battle.cards.find(card => card.id === plan.defense)}
              lateDefense={battle.cards.find(card => card.id === battle.lateDefense[id])}
            />
            {plan.kwisatz && <KwisatzInspector context="plan" />}
          </section>
        );
      })}
      </div>
    </section>
  );
}
