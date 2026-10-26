'use client';

import type { ReactElement } from 'react';
import {
  parseBribeExpression, BRIBE_EXPRESSION_MAX_DEPTH, BRIBE_EXPRESSION_MAX_LEAVES,
  type BribeExpression,
} from '@/game/bribe-expression-promises';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Recipient = { id: string; name: string };
// Every new condition requires the author to choose its public recipient.
const newLeaf = (): BribeExpression => ({ kind: 'payment', recipient: '', minimum: 1 });
export function bribeExpressionInputError(value: unknown): string | null {
  try { parseBribeExpression(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Choose a valid ordinary bribe expression.'; }
}

// Detached placeholders validate only the structure. They allow empty recipient
// choices and invalid numeric drafts to remain visible while the author repairs
// them; the real tree is always passed intact to the parent.
const structuralDraft = (node: BribeExpression): BribeExpression => node.kind === 'payment'
  ? { ...node, recipient: 'recipient', minimum: 1 }
  : { ...node, terms: node.terms.map(structuralDraft) };
const inputSize = (node: BribeExpression): { leaves: number; depth: number } => {
  if (node.kind !== 'and' && node.kind !== 'or') return { leaves: 1, depth: 0 };
  const sizes = node.terms.map(inputSize);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
};

/** Hook-free controlled editor. The server owns recipient eligibility, funding
 * and compliance with the whole answer. */
export function BribeExpressionFields({ value, recipients, disabled, onChange }: {
  value: BribeExpression;
  recipients: readonly Recipient[];
  disabled: boolean;
  onChange: (expression: BribeExpression) => void;
}) {
  const size = inputSize(value), error = bribeExpressionInputError(value);
  const commit = (next: BribeExpression) => {
    if (!disabled && !bribeExpressionInputError(structuralDraft(next))) onChange(next);
  };
  const render = (node: BribeExpression, path: string, replace: (next: BribeExpression) => BribeExpression,
    remove?: () => BribeExpression): ReactElement => {
    const group = node.kind !== 'payment';
    const id = `truth-bribe-expression-${path}`;
    const allowed = (next: BribeExpression) => !disabled && !bribeExpressionInputError(structuralDraft(replace(next)));
    const change = (next: BribeExpression) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): BribeExpression => ({ kind, terms: [node, newLeaf()] });
    return <fieldset key={path} data-bribe-expression-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Bribe group ${path} · ${node.kind.toUpperCase()}` : `Bribe condition ${path}`}</legend>
      {group ? <>
        <label htmlFor={`${id}-meaning`}>Bribe group {path} meaning</label>
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
          <Button type="button" data-bribe-expression-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newLeaf()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newLeaf()] })}>Add bribe condition</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: BribeExpression = { ...node, terms: [...node.terms, { kind, terms: [newLeaf(), newLeaf()] }] };
            return <Button key={kind} type="button" data-bribe-expression-control={`nested-${kind}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </> : <>
        <label htmlFor={`${id}-recipient`}>Bribe recipient</label>
        <select id={`${id}-recipient`} value={recipients.some(recipient => recipient.id === node.recipient) ? node.recipient : ''}
          disabled={disabled} aria-invalid={!recipients.some(recipient => recipient.id === node.recipient)} onChange={event => {
            const recipient = event.currentTarget.value;
            if (recipients.some(choice => choice.id === recipient)) change({ ...node, recipient });
          }}>
          <option value="">Choose a recipient</option>
          {recipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
        </select>
        <label htmlFor={`${id}-minimum`}>Minimum future ordinary bribe payments in spice</label>
        <Input id={`${id}-minimum`} type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required disabled={disabled}
          value={Number.isFinite(node.minimum) ? node.minimum : ''}
          aria-invalid={!!bribeExpressionInputError(node)} onChange={event => change({ ...node, minimum: event.currentTarget.valueAsNumber })} />
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-bribe-expression-control={`${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-bribe-expression-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="bribe-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Ordinary bribe expression</legend>
    <p className="fine">
      AND requires every condition; OR requires at least one. No makes the whole expression false,
      not necessarily every condition. Legal alternatives remain available; the question does not pin a fixed branch.
      Count cumulative future ordinary bribe payments after the answer this turn; smaller payments add together.
      Earlier payments, gifts and ally aid do not count.
    </p>
    <p className="fine">The sender pays immediately; the recipient collects at the next Mentat opening.
      Payments made during Mentat Pause wait until the start of next turn&apos;s Mentat Pause.</p>
    <p className="fine">App input limits: {BRIBE_EXPRESSION_MAX_LEAVES} conditions and {BRIBE_EXPRESSION_MAX_DEPTH} levels of grouping.
      Groups do not count as conditions. These are input limits, not additional printed rules.</p>
    <p className="fine">{size.leaves} / {BRIBE_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {BRIBE_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
