'use client';

import type { ReactElement } from 'react';
import type { GameView } from '@/game/engine';
import { TERRITORIES } from '@/game/board';
import { parseMixedActionExpression, type MixedActionExpression } from '@/game/mixed-action-question';
import { MOVEMENT_EXPRESSION_MAX_DEPTH, MOVEMENT_EXPRESSION_MAX_LEAVES } from '@/game/movement-expression-promises';
import { parseMovementClaim, type MovementClaim } from '@/game/movement-promises';
import type { TruthFact } from '@/game/truthtrance';
import { truthFactExpressionError } from '@/game/truth-fact-expression';
import { TruthFactFields, invalidTruthFact } from './mixed-shipment-fields';
import { Button } from './ui/button';
import { Input } from './ui/input';

type MixedMovementExpression = MixedActionExpression<MovementClaim>;
const newFact = (): MixedMovementExpression => ({ kind: 'fact', fact: { kind: 'hand', name: 'Shield' } });
const newMove = (): MixedMovementExpression => ({ kind: 'action', action: { territory: 'carthag', minimum: 1 } });
const newFactLeaf = (): TruthFact => ({ kind: 'hand', name: 'Shield' });
function factSize(fact: TruthFact): { leaves: number; depth: number } {
  if (fact.kind !== 'and' && fact.kind !== 'or') return { leaves: 1, depth: 0 };
  const sizes = fact.terms.map(factSize);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
}
function sizeOf(node: MixedMovementExpression): { leaves: number; depth: number } {
  if (node.kind === 'fact') return factSize(node.fact);
  if (node.kind === 'action') return { leaves: 1, depth: 0 };
  const sizes = node.terms.map(sizeOf);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
}
function structuralError(node: MixedMovementExpression): string | null {
  const size = sizeOf(node);
  if (size.leaves > MOVEMENT_EXPRESSION_MAX_LEAVES || size.depth > MOVEMENT_EXPRESSION_MAX_DEPTH)
    return 'Use at most sixteen conditions and four levels of grouping.';
  if (node.kind === 'fact') return truthFactExpressionError(node.fact);
  if (node.kind === 'action') return null;
  if (node.terms.length < 2) return 'Join two or more conditions with AND or OR.';
  for (const term of node.terms) {
    const error = structuralError(term);
    if (error) return error;
  }
  return null;
}

/** Draft feedback reuses the existing fact fields. The server remains the
 * authority for current-fact eligibility and legal future movement routes. */
export function mixedMovementInputError(value: unknown, game: GameView, target: string): string | null {
  try {
    parseMixedActionExpression(value, input => {
      const fact = input as TruthFact;
      const error = truthFactExpressionError(fact);
      if (error) throw new Error(error);
      if (invalidTruthFact(fact, game, target)) throw new Error('Resolve the marked current-fact fields.');
      return fact;
    }, parseMovementClaim);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Choose a current fact and a future ground-movement condition.';
  }
}

/** Preserve the complete original tree, including incomplete numeric drafts.
 * Structural changes never evaluate current facts or select a future branch. */
export function MixedMovementFields({ value, game, target, disabled, onChange }: {
  value: MixedMovementExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedMovementExpression) => void;
}) {
  const size = sizeOf(value), error = mixedMovementInputError(value, game, target);
  const commit = (next: MixedMovementExpression) => {
    if (!disabled && !structuralError(next)) onChange(next);
  };
  const renderFact = (fact: TruthFact, path: string, replace: (next: TruthFact) => MixedMovementExpression,
    remove?: () => MixedMovementExpression): ReactElement => {
    const allowed = (next: TruthFact) => !disabled && !structuralError(replace(next));
    const change = (next: TruthFact) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): TruthFact => ({ kind, terms: [fact, newFactLeaf()] });
    return <fieldset key={path} data-mixed-movement-fact-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{fact.kind === 'and' || fact.kind === 'or' ? `Current-fact group ${path}` : `Current fact ${path}`}</legend>
      {fact.kind === 'and' || fact.kind === 'or' ? <>
        <label htmlFor={`truth-mixed-movement-${path}-fact-meaning`}>Current-fact group {path} meaning</label>
        <select id={`truth-mixed-movement-${path}-fact-meaning`} value={fact.kind} disabled={disabled} onChange={event => {
          const kind = event.currentTarget.value;
          if (kind === 'and' || kind === 'or') change({ ...fact, kind });
        }}><option value="and">All conditions · AND</option><option value="or">At least one condition · OR</option></select>
        {fact.terms.map((term, index) => renderFact(term, `${path}.${index + 1}`,
          next => replace({ ...fact, terms: fact.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = fact.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...fact, terms });
          }))}
        <Button type="button" data-mixed-movement-control={`fact-add-${path}`}
          disabled={!allowed({ ...fact, terms: [...fact.terms, newFactLeaf()] })}
          onClick={() => change({ ...fact, terms: [...fact.terms, newFactLeaf()] })}>Add current fact</Button>
      </> : <TruthFactFields value={fact} game={game} target={target} onChange={change} />}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-mixed-movement-control={`fact-${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group current facts with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-mixed-movement-control={`fact-remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove current fact</Button>}
      </div>
    </fieldset>;
  };
  const render = (node: MixedMovementExpression, path: string, replace: (next: MixedMovementExpression) => MixedMovementExpression,
    remove?: () => MixedMovementExpression): ReactElement => {
    const id = `truth-mixed-movement-${path}`;
    const allowed = (next: MixedMovementExpression) => !disabled && !structuralError(replace(next));
    const change = (next: MixedMovementExpression) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): MixedMovementExpression => ({ kind, terms: [node, node.kind === 'fact' ? newMove() : newFact()] });
    return <fieldset key={path} data-mixed-movement-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{node.kind === 'and' || node.kind === 'or' ? `Mixed group ${path} · ${node.kind.toUpperCase()}` : `Mixed condition ${path}`}</legend>
      {node.kind === 'and' || node.kind === 'or' ? <>
        <label htmlFor={`${id}-meaning`}>Mixed group {path} meaning</label>
        <select id={`${id}-meaning`} value={node.kind} disabled={disabled} onChange={event => {
          const kind = event.currentTarget.value;
          if (kind === 'and' || kind === 'or') change({ ...node, kind });
        }}><option value="and">All conditions · AND</option><option value="or">At least one condition · OR</option></select>
        {node.terms.map((term, index) => render(term, `${path}.${index + 1}`,
          next => replace({ ...node, terms: node.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = node.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...node, terms });
          }))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-mixed-movement-control={`add-fact-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newFact()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newFact()] })}>Add current fact</Button>
          <Button type="button" data-mixed-movement-control={`add-action-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newMove()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newMove()] })}>Add ground-movement condition</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: MixedMovementExpression = { ...node, terms: [...node.terms, { kind, terms: [newFact(), newMove()] }] };
            return <Button key={kind} type="button" data-mixed-movement-control={`nested-${kind}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </> : <>
        <label htmlFor={`${id}-timing`}>Condition timing</label>
        <select id={`${id}-timing`} value={node.kind} disabled={disabled} onChange={event => {
          if (event.currentTarget.value === 'fact') change(newFact());
          if (event.currentTarget.value === 'action') change(newMove());
        }}><option value="fact">Current fact · at the answer</option><option value="action">Future ground move · this turn</option></select>
        {node.kind === 'fact' ? renderFact(node.fact, path, fact => replace({ kind: 'fact', fact })) : node.kind === 'action' ? <>
          <label htmlFor={`${id}-territory`}>Ground-movement destination</label>
          <select id={`${id}-territory`} value={TERRITORIES.some(destination => destination.id === node.action.territory) ? node.action.territory : ''}
            disabled={disabled} aria-invalid={!TERRITORIES.some(destination => destination.id === node.action.territory)}
            onChange={event => change({ ...node, action: { ...node.action, territory: event.currentTarget.value } })}>
            <option value="">Choose a printed Arrakis territory</option>
            {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
          </select>
          <label htmlFor={`${id}-minimum`}>Minimum physical forces in one ground move</label>
          <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
            value={Number.isNaN(node.action.minimum) ? '' : node.action.minimum}
            aria-invalid={!Number.isSafeInteger(node.action.minimum) || node.action.minimum < 1 || node.action.minimum > 20}
            onChange={event => change({ ...node, action: { ...node.action, minimum: event.currentTarget.valueAsNumber } })} />
        </> : null}
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-mixed-movement-control={`${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-mixed-movement-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {node.kind === 'and' || node.kind === 'or' ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="mixed-movement-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Mixed current-fact / future ground-movement claim</legend>
    <p className="fine">Current facts are evaluated when the player answers. They create no promise to keep cards, spice or forces afterward.
      AND requires every condition; OR requires at least one. No makes the whole grouped claim false, not necessarily every condition.
      Only the aggregate answer is shared; an unknown current fact can still allow a definite whole answer.</p>
    <p className="fine">Each movement condition needs one actual future ground move after the answer, before your Movement turn ends this round.
      Smaller moves never add together. Prior moves and shipments do not count. The claim grants no extra movement opportunity.</p>
    <p className="fine">App input limits: {MOVEMENT_EXPRESSION_MAX_LEAVES} conditions and {MOVEMENT_EXPRESSION_MAX_DEPTH} levels of grouping.
      These are input limits, not additional printed rules.</p>
    <p className="fine">{size.leaves} / {MOVEMENT_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {MOVEMENT_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
