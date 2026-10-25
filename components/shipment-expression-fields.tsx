'use client';

import type { ReactElement } from 'react';
import {
  SHIPMENT_EXPRESSION_MAX_DEPTH,
  SHIPMENT_EXPRESSION_MAX_LEAVES,
  type ShipmentExpression,
} from '@/game/shipment-promises';
import { shipmentExpressionInputError, shipmentExpressionInputSize } from '@/game/shipment-expression-input';
import { ShipmentClauseFields } from './shipment-claim-fields';
import { Button } from './ui/button';

const newLeaf = (): ShipmentExpression => ({ territory: 'carthag', minimum: 1 });

/** Hook-free controlled tree. Stateful leaf descendants are rendered by React. */
export function ShipmentExpressionFields({ value, id = 'truth-shipment', disabled, onChange }: {
  value: ShipmentExpression;
  id?: string;
  disabled: boolean;
  onChange: (expression: ShipmentExpression) => void;
}) {
  const size = shipmentExpressionInputSize(value);
  const commit = (next: ShipmentExpression) => {
    if (!disabled && !shipmentExpressionInputError(next)) onChange(next);
  };
  const render = (
    node: ShipmentExpression,
    path: string,
    replace: (next: ShipmentExpression) => ShipmentExpression,
    remove?: () => ShipmentExpression,
  ): ReactElement => {
    const group = 'op' in node;
    const allowed = (next: ShipmentExpression) => !disabled && !shipmentExpressionInputError(replace(next));
    const change = (next: ShipmentExpression) => commit(replace(next));
    const wrap = (op: 'and' | 'or'): ShipmentExpression => ({ op, terms: [node, newLeaf()] });
    return <fieldset key={path} data-shipment-expression-path={path} className="grid min-w-0 gap-2 p-2">
      <legend>{group ? `Shipment group ${path} · ${node.op.toUpperCase()}` : `Shipment condition ${path}`}</legend>
      {group ? <>
        <label htmlFor={`${id}-${path}-meaning`}>Shipment group {path} meaning</label>
        <select id={`${id}-${path}-meaning`} value={node.op} disabled={disabled} onChange={event => {
          const op = event.target.value;
          if (op === 'and' || op === 'or') change({ ...node, op });
        }}>
          <option value="and">All conditions · AND</option>
          <option value="or">At least one condition · OR</option>
        </select>
        {node.terms.map((term, index) => render(term, `${path}.${index + 1}`,
          next => replace({ ...node, terms: node.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = node.terms.filter((_, i) => i !== index);
            return replace(terms.length === 1 ? terms[0] : { ...node, terms });
          },
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" data-shipment-expression-control={`add-${path}`}
            disabled={!allowed({ ...node, terms: [...node.terms, newLeaf()] })}
            onClick={() => change({ ...node, terms: [...node.terms, newLeaf()] })}>Add shipment condition</Button>
          {(['and', 'or'] as const).map(op => {
            const next: ShipmentExpression = { ...node, terms: [...node.terms, { op, terms: [newLeaf(), newLeaf()] }] };
            return <Button key={op} type="button" data-shipment-expression-control={`nested-${op}-${path}`}
              disabled={!allowed(next)} onClick={() => change(next)}>Add nested {op.toUpperCase()} group</Button>;
          })}
        </div>
      </> : 'constant' in node ? <p className="notice" role="alert">
        Frozen current facts are unavailable in a pure shipment question. Remove this condition.
      </p> : <ShipmentClauseFields id={`${id}-${path}`} value={node} onChange={change} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" data-shipment-expression-control={`and-${path}`} disabled={!allowed(wrap('and'))}
          onClick={() => change(wrap('and'))}>Group with AND</Button>
        <Button type="button" data-shipment-expression-control={`or-${path}`} disabled={!allowed(wrap('or'))}
          onClick={() => change(wrap('or'))}>Group with OR</Button>
        {remove && <Button type="button" data-shipment-expression-control={`remove-${path}`} disabled={disabled}
          onClick={() => commit(remove())}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} data-testid="shipment-expression"
    className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Shipment expression</legend>
    <p className="fine">
      Every condition describes the same eventual shipment from reserves this turn.
      AND requires all conditions; OR requires at least one. No requires the whole expression to be false,
      not every individual condition. Skipping shipment makes every condition false.
    </p>
    <p className="fine">
      App input limits: {SHIPMENT_EXPRESSION_MAX_LEAVES} shipment conditions and {SHIPMENT_EXPRESSION_MAX_DEPTH} levels of grouping.
      Groups do not count as conditions. These are input limits, not additional printed rules.
    </p>
    <p className="fine">{size.leaves} / {SHIPMENT_EXPRESSION_MAX_LEAVES} shipment conditions · {size.depth} / {SHIPMENT_EXPRESSION_MAX_DEPTH} levels of grouping</p>
    {render(value, '1', next => next)}
  </fieldset>;
}
