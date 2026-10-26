'use client';
import { useId } from 'react';
import { HelpTip } from './help-tip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TRUTH_CARD_NAMES } from '@/game/truthtrance-card-names';
import { planClaimText, type PlanClaim } from '@/game/battle-promises';
import { reinforcementsSourceLabel } from './reinforcements-sources';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import type { Action, GameView, Plan } from '@/game/engine';

export function BattleClaimFields({
  game: g,
  value: c,
  onChange,
}: {
  game: GameView;
  value: PlanClaim;
  onChange: (c: PlanClaim) => void;
}) {
  const amountId = useId();
  const initial = (kind: string): PlanClaim =>
    kind === 'dial' || kind === 'support'
      ? { kind, compare: 'eq', value: 0 }
      : kind === 'weapon' || kind === 'defense'
        ? { kind, name: null }
        : kind === 'leader'
          ? { kind, leader: g.allLeaders[0].id }
          : { kind: 'kwisatz', use: true };
  return (
    <>
      <label>
        Plan element
        <select
          value={c.kind}
          onChange={(e) => onChange(initial(e.target.value))}
        >
          <option value="dial">Dial</option>
          <option value="leader">Leader or hero</option>
          <option value="weapon">Weapon slot</option>
          <option value="defense">Defense slot</option>
          <option value="support">Spice support</option>
          <option value="kwisatz">Kwisatz Haderach</option>
        </select>
      </label>
      {(c.kind === 'dial' || c.kind === 'support') && (
        <>
          <label>
            Comparison
            <select
              value={c.compare}
              onChange={(e) =>
                onChange({
                  ...c,
                  compare: e.target.value as 'eq' | 'gte' | 'lte',
                })
              }
            >
              <option value="eq">Exactly</option>
              <option value="gte">At least</option>
              <option value="lte">At most</option>
            </select>
          </label>
          <label htmlFor={amountId}>
            Amount
            <Input
              id={amountId}
              type="number"
              min={0}
              max={40}
              step={c.kind === 'dial' ? 0.5 : 1}
              value={Number.isNaN(c.value) ? '' : c.value}
              onChange={(e) =>
                onChange({ ...c, value: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      {(c.kind === 'weapon' || c.kind === 'defense') && (
        <label>
          Card name
          <select
            value={c.name ?? ''}
            onChange={(e) => onChange({ ...c, name: e.target.value || null })}
          >
            <option value="">Empty slot</option>
            {TRUTH_CARD_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      {c.kind === 'leader' && (
        <label>
          Leader
          <select
            value={c.leader ?? ''}
            onChange={(e) => onChange({ ...c, leader: e.target.value || null })}
          >
            <option value="">No leader or hero</option>
            {g.allLeaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value={CHEAP_HERO_TRAITOR}>Cheap Hero / Heroine</option>
          </select>
        </label>
      )}
      {c.kind === 'kwisatz' && (
        <label>
          Kwisatz use
          <select
            value={c.use ? 'yes' : 'no'}
            onChange={(e) => onChange({ ...c, use: e.target.value === 'yes' })}
          >
            <option value="yes">Included</option>
            <option value="no">Not included</option>
          </select>
        </label>
      )}
    </>
  );
}
export function BattlePromises(props: {
  game: GameView;
  fill: (plan: Plan) => void;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const { game: g, fill, act } = props;
  const b = g.battle;
  if (!b) return null;
  const mixedRows = (g.mixedBattlePromises ?? []).filter(promise => promise.player === g.me && promise.turn === g.turn &&
    promise.battle === b.event && promise.territory === b.territory && !promise.fulfilled && !promise.released);
  if (!b.truthPromises.length && !b.compliantPreparation && (!b.compliantPlan || !mixedRows.length)) return null;
  const me = g.players.find((p) => p.id === g.me)!;
  const name = (id: string | null) =>
    id === null
      ? 'None'
      : (me.hand?.find((c) => c.id === id)?.name ??
        g.allLeaders.find((l) => l.id === id)?.name ??
        id);
  const plan = b.compliantPlan;
  const preparation = b.compliantPreparation;
  const nextPreparation = preparation?.actions[0];
  const actor = g.me, turn = g.turn, event = b.event, territory = b.territory;
  const attacker = b.attacker, defender = b.defender;
  const mixed = mixedRows
    .map(promise => ({ promise, event: promise.event, asker: promise.asker, answer: promise.answer,
      mixed: promise.mixed, signature: JSON.stringify(promise.mixed) }));
  const mixedAssistance = mixed.length > 0;
  const planSignature = JSON.stringify(plan), preparationSignature = JSON.stringify(preparation);
  // Native completion owns feasibility. For mixed assistance, a saved callback
  // also has to belong to this exact live question and current private guide.
  const canUseMixedAssistance = () => !mixedAssistance || (
    !props.busy && props.game === g && g.status === 'playing' && g.phase === 6 && g.me === actor && g.turn === turn &&
    g.battle === b && typeof event === 'string' && b.event === event && b.territory === territory &&
    b.attacker === attacker && b.defender === defender && [attacker, defender].includes(actor) &&
    !b.revealed && !b.submitted.includes(actor) && mixed.length > 0 &&
    mixed.every(context => g.mixedBattlePromises.includes(context.promise) && context.promise.event === context.event &&
      context.promise.asker === context.asker && context.promise.answer === context.answer &&
      context.promise.mixed === context.mixed && JSON.stringify(context.promise.mixed) === context.signature &&
      context.promise.player === actor &&
      context.promise.turn === turn && context.promise.battle === event && context.promise.territory === territory &&
      !context.promise.fulfilled && !context.promise.released) &&
    g.mixedBattlePromises.filter(promise => promise.player === actor && promise.turn === turn &&
      promise.battle === event && promise.territory === territory && !promise.fulfilled && !promise.released).length === mixed.length &&
    !g.truthtrance && !g.response && !g.decision && !g.phaseOpening && !g.automaticContinuationPending &&
    !g.roomControl?.paused && !g.roomControl?.closed && !!me &&
    g.players.find(player => player.id === actor) === me && !me.autopilot
  );
  const canPrepare = () => !props.busy && !g.truthtrance && !g.response && !g.decision && !g.phaseOpening &&
    canUseMixedAssistance() && (!mixedAssistance || b.compliantPreparation === preparation &&
      b.compliantPreparation?.actions[0] === nextPreparation && JSON.stringify(preparation) === preparationSignature && props.act === act);
  const canFill = () => !props.busy && canUseMixedAssistance() && (!mixedAssistance ||
    b.compliantPlan === plan && !b.compliantPreparation && JSON.stringify(plan) === planSignature && props.fill === fill);
  return (
    <section
      className="notice truthtrance-history"
      aria-label={
        b.truthPromises.length
          ? 'Battle Truthtrance commitments'
          : 'Private battle preparation'
      }
    >
      <h3>
        {b.truthPromises.length
          ? 'Truthtrance commitments'
          : 'Preparing your committed plan'}{' '}
        <HelpTip topic="truthBattle" />
      </h3>
      <ul>
        {b.truthPromises.map((p, i) => (
          <li key={i}>
            <p>
              {g.players.find((other) => other.id === p.player)?.name}:{' '}
              <strong>{p.answer ? 'Yes' : 'No'}</strong> to “
              {planClaimText(p.claim, name)}”
              {p.released ? ' · No longer possible; released' : ''}.
            </p>
          </li>
        ))}
      </ul>
      {b.compliantPreparation && (
        <div>
          <p className="eyebrow">Preparation · private</p>
          {b.compliantPreparation.waitingForIncome && (
            <p>Revival income must resolve before this plan can be funded.</p>
          )}
          {b.compliantPreparation.actions.map((action, index) => (
            <p key={index}>
              {index + 1}.{' '}
              {action.type === 'nexusSuboids'
                ? 'Use Ixian Cunning to give Suboids full strength without spice support'
                : action.type === 'nexusSardaukar'
                  ? 'Declare Emperor Cunning to count five ordinary forces as Sardaukar for this battle'
                  : action.mode === 'special'
                    ? `Spend Karama and discard ${(action.cards as string[]).map(name).join(', ')} to gain ${(action.cards as string[]).length * 3} spice`
                    : typeof action.leader === 'string'
                      ? `Play Ghola to revive ${action.leader === 'kwisatz' ? 'Kwisatz Haderach' : name(action.leader)}`
                      : `Play Ghola to revive ${Number(action.amount)} force${Number(action.amount) === 1 ? '' : 's'}${Number(action.elite) ? `, including ${Number(action.elite)} elite` : ''}`}
              .
            </p>
          ))}
          <p className="fine">
            {b.compliantPreparation.actions.length
              ? 'The next card is still in your hand. Complete the preparation and any response before reviewing and sealing the plan.'
              : 'The revival is complete. Resolve its income response before reviewing and sealing the plan.'}{' '}
            Other legal ways to keep your answer remain available.
          </p>
          {b.compliantPreparation.actions[0] && (!mixedAssistance || mixed.length > 0 && !b.revealed && !b.submitted.includes(actor)) && (
            <Button
              variant="outline"
              disabled={!canPrepare()}
              onClick={() => { if (canPrepare() && nextPreparation) act(nextPreparation); }}
            >
              Complete next preparation
            </Button>
          )}
        </div>
      )}
      {plan && (!mixedAssistance || mixed.length > 0 && !b.revealed && !b.submitted.includes(actor)) && (
        <details>
          <summary>Review a compliant plan · private</summary>
          <p>
            Dial {plan.dial} · Support {plan.support}
            {!!plan.allyPayment && ` · CHOAM pays ${plan.allyPayment}`}
            <br />
            Leader: {name(plan.leader)}
            <br />
            Weapon: {name(plan.weapon)}
            <br />
            Defense: {name(plan.defense)}
            <br />
            Kwisatz: {plan.kwisatz ? 'Included' : 'Not included'}
          </p>
          {plan.reinforcementsSources && (
            <p className="fine">Native reserve fee: {reinforcementsSourceLabel(g, plan.reinforcementsSources)}</p>
          )}
          {plan.planetologistSpecial && (
            <p className="fine">Planetologist alternate Special: +2 if the leader survives; no normal card effect.</p>
          )}
          <p className="fine">
            These choices satisfy your current commitments. Review and change
            the other elements before sealing your plan.
          </p>
          <Button variant="outline" disabled={!canFill()} onClick={() => { if (canFill()) fill(plan); }}>
            Fill these plan choices
          </Button>
        </details>
      )}
    </section>
  );
}
