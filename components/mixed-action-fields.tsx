'use client';

import type { ReactElement, ReactNode } from 'react';
import type { GameView } from '@/game/engine';
import { mixedActionExpressionSize, parseMixedActionExpression, type MixedActionExpression } from '@/game/mixed-action-question';
import type { TruthFact } from '@/game/truthtrance';
import { truthFactExpressionError } from '@/game/truth-fact-expression';
import { TruthFactFields, invalidTruthFact } from './mixed-shipment-fields';
import { Button } from './ui/button';

export type MixedActionConfig<A> = {
  prefix: string;
  legend: string;
  actionLabel: string;
  actionTiming: string;
  actionHelp: ReactNode;
  fallbackError: string;
  maxLeaves: number;
  maxDepth: number;
  maxNodes?: number;
  maxTerms?: number;
  requireFact?: boolean;
  newAction: () => A;
  parseAction: (value: unknown, game: GameView, target: string) => A;
  renderAction: (props: { value: A; id: string; game: GameView; target: string;
    disabled: boolean; onChange: (action: A) => void }) => ReactNode;
};

const newFact = <A,>(): MixedActionExpression<A> => ({ kind: 'fact', fact: { kind: 'hand', name: 'Shield' } });
const newFactLeaf = (): TruthFact => ({ kind: 'hand', name: 'Shield' });
function structuralError<A>(node: MixedActionExpression<A>, config: MixedActionConfig<A>): string | null {
  const size = mixedActionExpressionSize(node);
  if (size.leaves > config.maxLeaves || size.depth > config.maxDepth)
    return 'Use at most sixteen conditions and four levels of grouping.';
  if (config.maxNodes !== undefined && size.nodes > config.maxNodes)
    return `Use at most ${config.maxNodes} total clauses, including groups.`;
  if (config.maxTerms !== undefined && size.maxTerms > config.maxTerms)
    return `Use at most ${config.maxTerms} conditions in each AND/OR group.`;
  if (node.kind === 'fact') return truthFactExpressionError(node.fact);
  if (node.kind === 'action') return null;
  if (node.terms.length < 2) return 'Join two or more conditions with AND or OR.';
  for (const term of node.terms) {
    const error = structuralError(term, config);
    if (error) return error;
  }
  return null;
}

/** Current-fact eligibility and each action family's parser share one envelope. */
export function mixedActionInputError<A>(value: unknown, game: GameView, target: string,
  config: MixedActionConfig<A>): string | null {
  try {
    parseMixedActionExpression(value, input => {
      const fact = input as TruthFact;
      const error = truthFactExpressionError(fact);
      if (error) throw new Error(error);
      if (invalidTruthFact(fact, game, target)) throw new Error('Resolve the marked current-fact fields.');
      return fact;
    }, input => config.parseAction(input, game, target), { maxDepth: config.maxDepth, maxLeaves: config.maxLeaves,
      ...(config.maxNodes === undefined ? {} : { maxNodes: config.maxNodes }),
      ...(config.maxTerms === undefined ? {} : { maxTerms: config.maxTerms }),
      ...(config.requireFact === undefined ? {} : { requireFact: config.requireFact }) });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : config.fallbackError;
  }
}

/** Preserve the complete original tree, including incomplete numeric drafts.
 * Structural changes never evaluate current facts or select a future branch. */
export function MixedActionFields<A>({ value, game, target, disabled, onChange, config }: {
  value: MixedActionExpression<A>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<A>) => void;
  config: MixedActionConfig<A>;
}) {
  const newAction = (): MixedActionExpression<A> => ({ kind: 'action', action: config.newAction() });
  const attrs = (suffix: string, value: string) => ({ [`data-${config.prefix}-${suffix}`]: value });
  const size = mixedActionExpressionSize(value), error = mixedActionInputError(value, game, target, config);
  const commit = (next: MixedActionExpression<A>) => {
    if (!disabled && !structuralError(next, config)) onChange(next);
  };
  const renderFact = (fact: TruthFact, path: string, replace: (next: TruthFact) => MixedActionExpression<A>,
    remove?: () => MixedActionExpression<A>): ReactElement => {
    const allowed = (next: TruthFact) => !disabled && !structuralError(replace(next), config);
    const change = (next: TruthFact) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): TruthFact => ({ kind, terms: [fact, newFactLeaf()] });
    return <fieldset key={path} {...attrs('fact-path', path)} className="grid min-w-0 gap-2 p-2">
      <legend>{fact.kind === 'and' || fact.kind === 'or' ? `Current-fact group ${path}` : `Current fact ${path}`}</legend>
      {fact.kind === 'and' || fact.kind === 'or' ? <>
        <label htmlFor={`truth-${config.prefix}-${path}-fact-meaning`}>Current-fact group {path} meaning</label>
        <select id={`truth-${config.prefix}-${path}-fact-meaning`} value={fact.kind} disabled={disabled} onChange={event => {
          const kind = event.currentTarget.value;
          if (kind === 'and' || kind === 'or') change({ ...fact, kind });
        }}><option value="and">All conditions · AND</option><option value="or">At least one condition · OR</option></select>
        {fact.terms.map((term, index) => renderFact(term, `${path}.${index + 1}`,
          next => replace({ ...fact, terms: fact.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = fact.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...fact, terms });
          }))}
        <Button type="button" {...attrs('control', `fact-add-${path}`)}
          disabled={!allowed({ ...fact, terms: [...fact.terms, newFactLeaf()] })}
          onClick={() => change({ ...fact, terms: [...fact.terms, newFactLeaf()] })}>Add current fact</Button>
      </> : <TruthFactFields value={fact} game={game} target={target} onChange={change} />}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" {...attrs('control', `fact-${kind}-${path}`)}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group current facts with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" {...attrs('control', `fact-remove-${path}`)} disabled={disabled}
          onClick={() => commit(remove())}>Remove current fact</Button>}
      </div>
    </fieldset>;
  };
  const render = (node: MixedActionExpression<A>, path: string, replace: (next: MixedActionExpression<A>) => MixedActionExpression<A>,
    remove?: () => MixedActionExpression<A>): ReactElement => {
    const id = `truth-${config.prefix}-${path}`;
    const allowed = (next: MixedActionExpression<A>) => !disabled && !structuralError(replace(next), config);
    const change = (next: MixedActionExpression<A>) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): MixedActionExpression<A> => ({ kind, terms: [node, node.kind === 'fact' ? newAction() : newFact<A>()] });
    return <fieldset key={path} {...attrs('path', path)} className="grid min-w-0 gap-2 p-2">
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
          <Button type="button" {...attrs('control', `add-fact-${path}`)}
            disabled={!allowed({ ...node, terms: [...node.terms, newFact<A>()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newFact<A>()] })}>Add current fact</Button>
          <Button type="button" {...attrs('control', `add-action-${path}`)}
            disabled={!allowed({ ...node, terms: [...node.terms, newAction()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newAction()] })}>Add {config.actionLabel}</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: MixedActionExpression<A> = { ...node, terms: [...node.terms, { kind, terms: [newFact<A>(), newAction()] }] };
            return <Button key={kind} type="button" {...attrs('control', `nested-${kind}-${path}`)}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </> : <>
        <label htmlFor={`${id}-timing`}>Condition timing</label>
        <select id={`${id}-timing`} value={node.kind} disabled={disabled} onChange={event => {
          if (event.currentTarget.value === 'fact') change(newFact<A>());
          if (event.currentTarget.value === 'action') change(newAction());
        }}><option value="fact">Current fact · at the answer</option><option value="action">{config.actionTiming}</option></select>
        {node.kind === 'fact' ? renderFact(node.fact, path, fact => replace({ kind: 'fact', fact })) : node.kind === 'action' ? config.renderAction({ value: node.action, id, game, target, disabled,
          onChange: action => change({ ...node, action }) }) : null}
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" {...attrs('control', `${kind}-${path}`)}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" {...attrs('control', `remove-${path}`)} disabled={disabled}
          onClick={() => commit(remove())}>Remove {node.kind === 'and' || node.kind === 'or' ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid={`${config.prefix}-expression`}
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>{config.legend}</legend>
    <p className="fine">Current facts are evaluated when the player answers. They create no promise to keep cards, spice or forces afterward.
      AND requires every condition; OR requires at least one. No makes the whole grouped claim false, not necessarily every condition.
      Only the aggregate answer is shared; an unknown current fact can still allow a definite whole answer.</p>
    <p className="fine">{config.actionHelp}</p>
    <p className="fine">App input limits: {config.maxNodes === undefined ? `${config.maxLeaves} conditions` : `${config.maxNodes} total clauses, including groups`}
      {config.maxTerms !== undefined && `, ${config.maxTerms} conditions per group`} and {config.maxDepth} levels of grouping.
      These are input limits, not additional printed rules.</p>
    <p className="fine">{config.maxNodes === undefined ? `${size.leaves} / ${config.maxLeaves} conditions`
      : `${size.nodes} / ${config.maxNodes} total clauses`} · {size.depth} / {config.maxDepth} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
