'use client';

import type { ReactElement } from 'react';
import type { GameView } from '@/game/engine';
import type { PlanClaim } from '@/game/battle-promises';
import {
  BATTLE_CLAIM_MAX_DEPTH,
  BATTLE_CLAIM_MAX_NODES,
  BATTLE_CLAIM_MAX_TERMS,
  battleClaimExpressionError,
  battleClaimExpressionSize,
} from '@/game/battle-claim-expression';
import { BattleClaimFields } from './battle-promises';
import { Button } from './ui/button';

const newClaim = (): PlanClaim => ({ kind: 'dial', compare: 'eq', value: 0 });

/** Controlled structure editor. Invalid leaf input stays available for repair. */
export function BattleClaimExpressionFields({ value, game, disabled, onChange }: {
  value: PlanClaim;
  game: GameView;
  disabled: boolean;
  onChange: (claim: PlanClaim) => void;
}) {
  const size = battleClaimExpressionSize(value);
  const commit = (next: PlanClaim) => {
    if (!disabled && !battleClaimExpressionError(next)) onChange(next);
  };
  const render = (
    node: PlanClaim,
    path: string,
    replace: (next: PlanClaim) => PlanClaim,
    remove?: () => PlanClaim,
  ): ReactElement => {
    const group = node.kind === 'and' || node.kind === 'or';
    const allowed = (next: PlanClaim) => !disabled && !battleClaimExpressionError(replace(next));
    const change = (next: PlanClaim) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): PlanClaim => ({ kind, terms: [node, newClaim()] });
    return <fieldset key={path} data-battle-claim-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Group ${path} · ${node.kind.toUpperCase()}` : `Plan condition ${path}`}</legend>
      {group ? <>
        <label>
          Group {path} meaning
          <select value={node.kind} disabled={disabled} onChange={event => {
            const kind = event.target.value;
            if (kind === 'and' || kind === 'or') change({ ...node, kind });
          }}>
            <option value="and">All conditions · AND</option>
            <option value="or">At least one condition · OR</option>
          </select>
        </label>
        {node.terms.map((term, index) => render(
          term,
          `${path}.${index + 1}`,
          next => replace({ ...node, terms: node.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = node.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...node, terms });
          },
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-battle-claim-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newClaim()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newClaim()] })}>
            Add plan condition
          </Button>
          <Button type="button" data-battle-claim-control={`nested-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, { kind: 'and', terms: [newClaim(), newClaim()] }] })}
            onClick={() => change({ ...node, terms: [...node.terms, { kind: 'and', terms: [newClaim(), newClaim()] }] })}>
            Add nested group
          </Button>
        </div>
      </> : <BattleClaimFields value={node} game={game} onChange={change} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" data-battle-claim-control={`and-${path}`} disabled={!allowed(wrap('and'))}
          onClick={() => change(wrap('and'))}>Group with AND</Button>
        <Button type="button" data-battle-claim-control={`or-${path}`} disabled={!allowed(wrap('or'))}
          onClick={() => change(wrap('or'))}>Group with OR</Button>
        {remove && <Button type="button" data-battle-claim-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="truth-battle-plan-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Battle-plan expression</legend>
    <p className="fine">
      AND requires all conditions; OR requires at least one. The player answers once for the whole
      expression. No makes the whole expression false, not necessarily every condition.
    </p>
    <p className="fine">
      A definite answer commits the player to a legal battle plan that keeps the whole answer.
      Available answers and the sealed plan are checked by the game.
    </p>
    <p className="fine">
      App limits: {BATTLE_CLAIM_MAX_TERMS} terms per group, {BATTLE_CLAIM_MAX_NODES} total clauses
      including groups, and {BATTLE_CLAIM_MAX_DEPTH} levels of grouping. These are input limits,
      not additional printed rules.
    </p>
    <p className="fine">{size.nodes} / {BATTLE_CLAIM_MAX_NODES} total clauses · {size.depth} / {BATTLE_CLAIM_MAX_DEPTH} levels of grouping</p>
    {render(value, '1', next => next)}
  </fieldset>;
}
