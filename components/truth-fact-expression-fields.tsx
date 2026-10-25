'use client';

import type { ReactElement } from 'react';
import type { GameView } from '@/game/engine';
import type { TruthFact } from '@/game/truthtrance';
import {
  TRUTH_FACT_MAX_DEPTH,
  TRUTH_FACT_MAX_NODES,
  TRUTH_FACT_MAX_TERMS,
  truthFactExpressionError,
  truthFactExpressionSize,
} from '@/game/truth-fact-expression';
import { TruthFactFields } from './mixed-shipment-fields';
import { Button } from './ui/button';

const newFact = (): TruthFact => ({ kind: 'hand', name: 'Shield' });

/** Controlled structure editor. Leaf controls retain their existing validators. */
export function TruthFactExpressionFields({ value, game, target, disabled, onChange }: {
  value: TruthFact;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (fact: TruthFact) => void;
}) {
  const size = truthFactExpressionSize(value);
  const commit = (next: TruthFact) => {
    if (!disabled && !truthFactExpressionError(next)) onChange(next);
  };
  const render = (
    node: TruthFact,
    path: string,
    replace: (next: TruthFact) => TruthFact,
    remove?: () => TruthFact,
  ): ReactElement => {
    const group = node.kind === 'and' || node.kind === 'or';
    const allowed = (next: TruthFact) => !disabled && !truthFactExpressionError(replace(next));
    const change = (next: TruthFact) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): TruthFact => ({ kind, terms: [node, newFact()] });
    return <fieldset key={path} data-truth-fact-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Group ${path} · ${node.kind.toUpperCase()}` : `Current fact ${path}`}</legend>
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
          <Button type="button" data-truth-fact-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newFact()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newFact()] })}>
            Add current fact
          </Button>
          <Button type="button" data-truth-fact-control={`nested-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, { kind: 'and', terms: [newFact(), newFact()] }] })}
            onClick={() => change({ ...node, terms: [...node.terms, { kind: 'and', terms: [newFact(), newFact()] }] })}>
            Add nested group
          </Button>
        </div>
      </> : <TruthFactFields value={node} game={game} target={target} onChange={change} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" data-truth-fact-control={`and-${path}`} disabled={!allowed(wrap('and'))}
          onClick={() => change(wrap('and'))}>Group with AND</Button>
        <Button type="button" data-truth-fact-control={`or-${path}`} disabled={!allowed(wrap('or'))}
          onClick={() => change(wrap('or'))}>Group with OR</Button>
        {remove && <Button type="button" data-truth-fact-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'fact'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="truth-fact-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Current-fact expression</legend>
    <p className="fine">
      AND requires all conditions; OR requires at least one. The player gives one aggregate answer
      for the whole expression. No makes the whole expression false, not necessarily every condition.
    </p>
    <p className="fine">
      Current facts are evaluated when the player answers. They create no promise to keep cards,
      spice or forces afterward.
    </p>
    <p className="fine">
      App limits: {TRUTH_FACT_MAX_TERMS} terms per group, {TRUTH_FACT_MAX_NODES} total clauses
      including groups, and {TRUTH_FACT_MAX_DEPTH} levels of grouping. These are input limits,
      not additional printed rules.
    </p>
    <p className="fine">{size.nodes} / {TRUTH_FACT_MAX_NODES} total clauses · {size.depth} / {TRUTH_FACT_MAX_DEPTH} levels of grouping</p>
    {render(value, '1', next => next)}
  </fieldset>;
}
