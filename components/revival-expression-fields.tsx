'use client';

import type { ReactElement } from 'react';
import {
  parseRevivalExpression, REVIVAL_EXPRESSION_MAX_DEPTH, REVIVAL_EXPRESSION_MAX_LEAVES,
  type RevivalExpression,
} from '@/game/revival-expression-promises';
import { Button } from './ui/button';
import { Input } from './ui/input';

type LeaderChoice = { id: string; name: string };
const newLeaf = (): RevivalExpression => ({ kind: 'forces', counter: 'total', minimum: 1 });
export function revivalExpressionInputError(value: unknown): string | null {
  try { parseRevivalExpression(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a valid ordinary Revival expression.'; }
}

// Numeric drafts remain visible and repairable. Only structural controls use
// this detached placeholder tree; the user's original numbers are retained.
const structuralDraft = (node: RevivalExpression): RevivalExpression => node.kind === 'and' || node.kind === 'or'
  ? { ...node, terms: node.terms.map(structuralDraft) }
  : node.kind === 'forces' ? { ...node, minimum: 1 } : node;
const inputSize = (node: RevivalExpression): { leaves: number; depth: number } => {
  if (node.kind !== 'and' && node.kind !== 'or') return { leaves: 1, depth: 0 };
  const sizes = node.terms.map(inputSize);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
};

/** Hook-free controlled tree, including invalid numeric drafts. Eligibility
 * and the whole-expression answer remain authoritative on the server. */
export function RevivalExpressionFields({ value, leaders, disabled, onChange }: {
  value: RevivalExpression;
  leaders: readonly LeaderChoice[];
  disabled: boolean;
  onChange: (expression: RevivalExpression) => void;
}) {
  const size = inputSize(value), error = revivalExpressionInputError(value);
  const commit = (next: RevivalExpression) => {
    if (!disabled && !revivalExpressionInputError(structuralDraft(next))) onChange(next);
  };
  const render = (node: RevivalExpression, path: string, replace: (next: RevivalExpression) => RevivalExpression,
    remove?: () => RevivalExpression): ReactElement => {
    const group = node.kind === 'and' || node.kind === 'or';
    const id = `truth-revival-expression-${path}`;
    const allowed = (next: RevivalExpression) => !disabled && !revivalExpressionInputError(structuralDraft(replace(next)));
    const change = (next: RevivalExpression) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): RevivalExpression => ({ kind, terms: [node, newLeaf()] });
    return <fieldset key={path} data-revival-expression-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Revival group ${path} · ${node.kind.toUpperCase()}` : `Revival condition ${path}`}</legend>
      {group ? <>
        <label htmlFor={`${id}-meaning`}>Revival group {path} meaning</label>
        <select id={`${id}-meaning`} value={node.kind} disabled={disabled} onChange={event => {
          const kind = event.currentTarget.value;
          if (kind === 'and' || kind === 'or') change({ ...node, kind });
        }}>
          <option value="and">All conditions · AND</option>
          <option value="or">At least one condition · OR</option>
        </select>
        {node.terms.map((term, index) => render(term, `${path}.${index + 1}`,
          next => replace({ ...node, terms: node.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = node.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...node, terms });
          }))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-revival-expression-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newLeaf()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newLeaf()] })}>Add Revival condition</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: RevivalExpression = { ...node, terms: [...node.terms, { kind, terms: [newLeaf(), newLeaf()] }] };
            return <Button key={kind} type="button" data-revival-expression-control={`nested-${kind}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </> : <>
        <label htmlFor={`${id}-kind`}>Revival condition type</label>
        <select id={`${id}-kind`} value={node.kind} disabled={disabled} onChange={event => {
          if (event.currentTarget.value === 'forces') change(newLeaf());
          else if (event.currentTarget.value === 'leader' && leaders.length) change({ kind: 'leader', leader: leaders[0].id });
        }}>
          <option value="forces">Cumulative physical forces</option>
          <option value="leader" disabled={!leaders.length}>Named ordinary leader</option>
        </select>
        {node.kind === 'forces' ? <>
          <label htmlFor={`${id}-counter`}>Physical force counters</label>
          <select id={`${id}-counter`} value={node.counter} disabled={disabled} onChange={event => {
            const counter = event.currentTarget.value;
            if (counter === 'total' || counter === 'normal' || counter === 'elite') change({ ...node, counter });
          }}>
            <option value="total">All physical forces</option>
            <option value="normal">Normal forces</option>
            <option value="elite">Elite forces</option>
          </select>
          <label htmlFor={`${id}-minimum`}>Minimum future ordinary returns</label>
          <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
            value={Number.isNaN(node.minimum) ? '' : node.minimum}
            aria-invalid={!!revivalExpressionInputError(node)} onChange={event => change({ ...node, minimum: event.currentTarget.valueAsNumber })} />
        </> : node.kind === 'leader' ? <>
          <label htmlFor={`${id}-leader`}>Named leader</label>
          <select id={`${id}-leader`} value={leaders.some(leader => leader.id === node.leader) ? node.leader : ''}
            disabled={disabled} onChange={event => {
              const leader = event.currentTarget.value;
              if (leaders.some(choice => choice.id === leader)) change({ ...node, leader });
            }}>
            <option value="">Choose a named leader</option>
            {leaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
          </select>
        </> : null}
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-revival-expression-control={`${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-revival-expression-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="revival-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Ordinary Revival expression</legend>
    <p className="fine">
      AND requires every condition; OR requires at least one. No makes the whole expression false,
      not necessarily every condition. Legal alternatives remain available; the question does not pin a fixed branch.
      Count only future ordinary native force and named-leader returns after the answer this turn.
    </p>
    <p className="fine">App input limits: {REVIVAL_EXPRESSION_MAX_LEAVES} conditions and {REVIVAL_EXPRESSION_MAX_DEPTH} levels of grouping.
      Groups do not count as conditions. These are input limits, not additional printed rules.</p>
    <p className="fine">{size.leaves} / {REVIVAL_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {REVIVAL_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
