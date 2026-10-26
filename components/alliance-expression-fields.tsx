'use client';

import type { ReactElement } from 'react';
import {
  parseAllianceExpression, ALLIANCE_EXPRESSION_MAX_DEPTH, ALLIANCE_EXPRESSION_MAX_LEAVES,
  type AllianceExpression,
} from '@/game/alliance-expression-promises';
import { Button } from './ui/button';

type Partner = { id: string; name: string };
const newLeaf = (): AllianceExpression => ({ kind: 'partner', partner: '' });
export function allianceExpressionInputError(value: unknown, partners: readonly Partner[]): string | null {
  try {
    const expression = parseAllianceExpression(value);
    const visit = (node: AllianceExpression): void => {
      if (node.kind === 'partner') {
        if (!partners.some(partner => partner.id === node.partner)) throw new Error('Choose a current named other alliance partner.');
      } else node.terms.forEach(visit);
    };
    visit(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Choose a valid final-alliance expression.';
  }
}

// Detached placeholders validate only structure, leaving incomplete public
// partner choices visible and repairable in the original controlled tree.
const structuralDraft = (node: AllianceExpression): AllianceExpression => node.kind === 'partner'
  ? { ...node, partner: 'partner' }
  : { ...node, terms: node.terms.map(structuralDraft) };
const inputSize = (node: AllianceExpression): { leaves: number; depth: number } => {
  if (node.kind === 'partner') return { leaves: 1, depth: 0 };
  const sizes = node.terms.map(inputSize);
  return { leaves: sizes.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(0, ...sizes.map(child => child.depth)) };
};

/** Public partner choices never predict another player's consent. The server
 * owns feasibility and final actual membership at the original Nexus close. */
export function AllianceExpressionFields({ value, partners, disabled, onChange }: {
  value: AllianceExpression;
  partners: readonly Partner[];
  disabled: boolean;
  onChange: (expression: AllianceExpression) => void;
}) {
  const size = inputSize(value), error = allianceExpressionInputError(value, partners);
  const structuralError = (next: AllianceExpression) => {
    try { parseAllianceExpression(structuralDraft(next)); return false; } catch { return true; }
  };
  const commit = (next: AllianceExpression) => {
    if (!disabled && !structuralError(next)) onChange(next);
  };
  const render = (node: AllianceExpression, path: string, replace: (next: AllianceExpression) => AllianceExpression,
    remove?: () => AllianceExpression): ReactElement => {
    const group = node.kind !== 'partner', id = `truth-alliance-expression-${path}`;
    const allowed = (next: AllianceExpression) => !disabled && !structuralError(replace(next));
    const change = (next: AllianceExpression) => commit(replace(next));
    const wrap = (kind: 'and' | 'or'): AllianceExpression => ({ kind, terms: [node, newLeaf()] });
    return <fieldset key={path} data-alliance-expression-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Alliance group ${path} · ${node.kind.toUpperCase()}` : `Alliance condition ${path}`}</legend>
      {group ? <>
        <label htmlFor={`${id}-meaning`}>Alliance group {path} meaning</label>
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
          <Button type="button" data-alliance-expression-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newLeaf()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newLeaf()] })}>Add alliance condition</Button>
          {(['and', 'or'] as const).map(kind => {
            const next: AllianceExpression = { ...node, terms: [...node.terms, { kind, terms: [newLeaf(), newLeaf()] }] };
            return <Button key={kind} type="button" data-alliance-expression-control={`nested-${kind}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {kind.toUpperCase()} group</Button>;
          })}
        </div>
      </> : <>
        <label htmlFor={`${id}-partner`}>Named alliance partner</label>
        <select id={`${id}-partner`} value={partners.some(partner => partner.id === node.partner) ? node.partner : ''}
          disabled={disabled} aria-invalid={!partners.some(partner => partner.id === node.partner)} onChange={event => {
            const partner = event.currentTarget.value;
            if (partners.some(choice => choice.id === partner)) change({ ...node, partner });
          }}>
          <option value="">Choose a partner</option>
          {partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
      </>}
      <div className="flex flex-wrap gap-2">
        {(['and', 'or'] as const).map(kind => <Button key={kind} type="button" data-alliance-expression-control={`${kind}-${path}`}
          disabled={!allowed(wrap(kind))} onClick={() => change(wrap(kind))}>Group with {kind.toUpperCase()}</Button>)}
        {remove && <Button type="button" data-alliance-expression-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="alliance-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Final alliance expression · Current Nexus</legend>
    <p className="fine">Each condition concerns actual membership when this Nexus closes. Offers alone are not alliances.
      AND requires every condition; OR requires at least one. No makes the whole expression false, not necessarily every condition.
      Legal alternatives remain available; the question does not pin a fixed branch.</p>
    <p className="fine">Yes and No settle only at the actual Nexus close. Forming an alliance does not fulfill the answer early.
      You cannot promise the other player’s consent. If future consent is needed, unknown may apply; ask again or save the card.</p>
    <p className="fine">App input limits: {ALLIANCE_EXPRESSION_MAX_LEAVES} conditions and {ALLIANCE_EXPRESSION_MAX_DEPTH} levels of grouping.
      Groups do not count as conditions. These are input limits, not additional printed rules.</p>
    <p className="fine">{size.leaves} / {ALLIANCE_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {ALLIANCE_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {error && <p role="alert">{error}</p>}
    {render(value, '1', next => next)}
  </fieldset>;
}
