import {
  parseShipmentExpression,
  shipmentClaimText,
  ShipmentClaimError,
  SHIPMENT_EXPRESSION_MAX_DEPTH,
  SHIPMENT_EXPRESSION_MAX_LEAVES,
  type ShipmentExpression,
} from './shipment-promises';
import type { TruthAnswer, TruthFact } from './truthtrance';

/** Public question structure: no frozen answers or other future actions. */
export type MixedShipmentExpression =
  | { kind: 'fact'; fact: TruthFact }
  | { kind: 'shipment'; territory: string; minimum: number }
  | { kind: 'and' | 'or'; terms: MixedShipmentExpression[] };

function check(value: unknown, message: string): asserts value {
  if (!value) throw new ShipmentClaimError(message);
}
function record(value: unknown): Record<string, unknown> {
  check(
    value && typeof value === 'object' && !Array.isArray(value),
    'Choose a current fact, reserve shipment, or AND/OR group.',
  );
  return value as Record<string, unknown>;
}

/** Reuse the authoritative fact decoder, then enforce one budget across both trees. */
export function parseMixedShipmentExpression(
  value: unknown,
  parseFact: (value: unknown) => TruthFact,
): MixedShipmentExpression {
  let leaves = 0;
  let hasFact = false;
  let hasShipment = false;
  const count = (depth: number, leaf: boolean): void => {
    check(
      depth <= SHIPMENT_EXPRESSION_MAX_DEPTH &&
        (!leaf || ++leaves <= SHIPMENT_EXPRESSION_MAX_LEAVES),
      'Truthtrance supports at most 16 logical clauses and four levels of grouping.',
    );
  };
  const countFact = (fact: TruthFact, depth: number): void => {
    count(depth, fact.kind !== 'and' && fact.kind !== 'or');
    if (fact.kind === 'and' || fact.kind === 'or')
      for (const term of fact.terms) countFact(term, depth + 1);
  };
  const parse = (input: unknown, depth: number): MixedShipmentExpression => {
    const v = record(input);
    if (v.kind === 'fact') {
      check(
        Object.keys(v).sort().join(',') === 'fact,kind',
        'Supply only the original current fact, not a frozen answer.',
      );
      const fact = parseFact(v.fact);
      countFact(fact, depth);
      hasFact = true;
      return { kind: 'fact', fact };
    }
    count(depth, v.kind === 'shipment');
    if (v.kind === 'shipment') {
      check(
        Object.keys(v).sort().join(',') === 'kind,minimum,territory',
        'Supply a printed reserve-shipment destination and minimum.',
      );
      const leaf = parseShipmentExpression({
        territory: v.territory,
        minimum: v.minimum,
      });
      check('territory' in leaf, 'Choose a reserve-shipment statement.');
      hasShipment = true;
      return { kind: 'shipment', ...leaf };
    }
    check(
      Object.keys(v).sort().join(',') === 'kind,terms' &&
        (v.kind === 'and' || v.kind === 'or') &&
        Array.isArray(v.terms) &&
        v.terms.length >= 2 &&
        v.terms.length <= SHIPMENT_EXPRESSION_MAX_LEAVES,
      'Join two or more current facts or shipment statements with AND or OR.',
    );
    return { kind: v.kind, terms: v.terms.map((term) => parse(term, depth + 1)) };
  };
  const mixed = parse(value, 0);
  check(
    hasFact && hasShipment,
    'A mixed question must include a current fact and a reserve-shipment statement.',
  );
  return mixed;
}

/** Freeze facts at answer time; later custody changes cannot rewrite the obligation. */
export function compileMixedShipmentExpression(
  mixed: MixedShipmentExpression,
  answerFact: (fact: TruthFact) => TruthAnswer,
): ShipmentExpression {
  if (mixed.kind === 'fact') return { constant: answerFact(mixed.fact) };
  if (mixed.kind === 'shipment')
    return { territory: mixed.territory, minimum: mixed.minimum };
  return {
    op: mixed.kind,
    terms: mixed.terms.map((term) => compileMixedShipmentExpression(term, answerFact)),
  };
}

/** Public text is derived solely from the original question, never compiled answers. */
export function mixedShipmentExpressionText(
  mixed: MixedShipmentExpression,
  factText: (fact: TruthFact) => string,
): string {
  if (mixed.kind === 'fact') return factText(mixed.fact);
  if (mixed.kind === 'shipment')
    return `you ${shipmentClaimText({ territory: mixed.territory, minimum: mixed.minimum })} this turn`;
  return `(${mixed.terms.map((term) => mixedShipmentExpressionText(term, factText))
    .join(mixed.kind === 'and' ? ' AND ' : ' OR ')})`;
}
