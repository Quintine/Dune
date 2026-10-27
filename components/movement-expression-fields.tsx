'use client';

import type { ReactElement } from 'react';
import { TERRITORIES } from '@/game/board';
import {
  parseMovementExpression, MOVEMENT_EXPRESSION_MAX_DEPTH, MOVEMENT_EXPRESSION_MAX_LEAVES,
  type MovementExpression,
} from '@/game/movement-expression-promises';
import { Button } from './ui/button';
import { Input } from './ui/input';

type TerritoryChoice = { id: string; name: string };
export function movementExpressionInputError(value: unknown): string | null {
  try { parseMovementExpression(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a valid ground-movement expression.'; }
}

// Structural edits preserve repairable destination and numeric drafts. The
// detached valid placeholders are used only to check tree shape and limits.
const structuralDraft = (node: MovementExpression): MovementExpression => node.kind === 'move'
  ? { kind: 'move', territory: 'carthag', minimum: 1 }
  : { ...node, terms: node.terms.map(structuralDraft) };
const inputSize = (node: MovementExpression): { leaves: number; depth: number } => {
  if (node.kind === 'move') return { leaves: 1, depth: 0 };
  const sizes = node.terms.map(inputSize);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
};

/** Hook-free controlled tree. The server decides future route feasibility. */
export function MovementExpressionFields({ value, territories, disabled, onChange }: {
  value: MovementExpression;
  territories: readonly TerritoryChoice[];
  disabled: boolean;
  onChange: (expression: MovementExpression) => void;
}) {
  const newLeaf = (): MovementExpression => ({ kind: 'move', territory: territories[0]?.id ?? 'carthag', minimum: 1 });
  const size = inputSize(value), error = movementExpressionInputError(value);
  const commit = (next: MovementExpression) => {
    if (!disabled && !movementExpressionInputError(structuralDraft(next))) onChange(next);
  };
  const render = (node: MovementExpression, path: string, replace: (next: MovementExpression) => MovementExpression,
    remove?: () => MovementExpression): ReactElement => {
    const id = `truth-movement-expression-${path}`;
    const allowed = (next: MovementExpression) => !disabled && !movementExpressionInputError(structuralDraft(replace(next)));
    const change = (next: MovementExpression) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): MovementExpression => ({ kind, terms: [node, newLeaf()] });
    return <fieldset key={path} data-movement-expression-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{node.kind === 'move' ? `Movement condition ${path}` : `Movement group ${path} · ${node.kind.toUpperCase()}`}</legend>
      {node.kind === 'move' ? <>
        <label htmlFor={`${id}-territory`}>Ground-movement destination</label>
        <select id={`${id}-territory`} value={territories.some(destination => destination.id === node.territory) ? node.territory : ''}
          disabled={disabled} aria-invalid={!territories.some(destination => destination.id === node.territory)}
          onChange={event => change({ kind: 'move', territory: event.currentTarget.value, minimum: node.minimum })}>
          <option value="">Choose a printed Arrakis territory</option>
          {territories.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
        </select>
        <label htmlFor={`${id}-sector`}>Ground-movement sector</label>
        <select id={`${id}-sector`} disabled={disabled} value={node.sector === undefined ? '' : String(node.sector)}
          aria-invalid={node.sector !== undefined && !TERRITORIES.find(row => row.id === node.territory)?.sectors.includes(node.sector)}
          onChange={event => {
            const selected = event.currentTarget.value, printed = TERRITORIES.find(row => row.id === node.territory);
            if (selected === '') change({ kind: 'move', territory: node.territory, minimum: node.minimum });
            else { const sector = Number(selected); if (printed?.sectors.includes(sector)) change({ ...node, sector }); }
          }}>
          <option value="">Any sector in this territory</option>
          {TERRITORIES.find(row => row.id === node.territory)?.sectors.map(sector => <option key={sector} value={sector}>Sector {sector}</option>)}
        </select>
        <label htmlFor={`${id}-minimum`}>Minimum physical forces in one ground move</label>
        <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
          value={Number.isNaN(node.minimum) ? '' : node.minimum} aria-invalid={!!movementExpressionInputError(node)}
          onChange={event => change({ ...node, minimum: event.currentTarget.valueAsNumber })} />
      </> : <>
        <label htmlFor={`${id}-meaning`}>Movement group {path} meaning</label>
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
          <Button type="button" data-movement-expression-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newLeaf()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newLeaf()] })}>Add movement condition</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: MovementExpression = { ...node, terms: [...node.terms, { kind, terms: [newLeaf(), newLeaf()] }] };
            return <Button key={kind} type="button" data-movement-expression-control={`nested-${kind}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-movement-expression-control={`${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-movement-expression-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {node.kind === 'move' ? 'condition' : 'group'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="movement-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Ground-movement expression</legend>
    <p className="fine">
      AND requires every condition; OR requires at least one. No makes the whole expression false,
      not necessarily every condition. Legal alternatives remain available; the question does not pin a fixed branch.
      Each condition needs one future actual ground move after the answer, before your Movement turn ends this round.
      Name an exact sector when needed. Smaller moves never add together; a shipment can prepare a move but does not fulfill a condition.
    </p>
    <p className="fine">App input limits: {MOVEMENT_EXPRESSION_MAX_LEAVES} conditions and {MOVEMENT_EXPRESSION_MAX_DEPTH} levels of grouping.
      Groups do not count as conditions. These are input limits, not additional printed rules.</p>
    <p className="fine">{size.leaves} / {MOVEMENT_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {MOVEMENT_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
