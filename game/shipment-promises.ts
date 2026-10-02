import { TERRITORIES, territory } from './board';
import type { MixedShipmentExpression } from './mixed-shipment-question';
import type { TruthAnswer } from './truthtrance';

/** Every shipment leaf describes the same eventual reserve shipment, or its absence. */
export type ShipmentLeaf = { territory: string; minimum: number };
export type ShipmentExpression =
  | ShipmentLeaf
  | { constant: TruthAnswer }
  | { op: 'and' | 'or'; terms: ShipmentExpression[] };
/** Old flat questions and saved promises remain valid without migration. */
export type ShipmentClaim =
  | (ShipmentLeaf & { claim?: never })
  | { claim: ShipmentExpression; territory?: never; minimum?: never };
export const SHIPMENT_EXPRESSION_MAX_DEPTH = 4;
export const SHIPMENT_EXPRESSION_MAX_LEAVES = 16;
export class ShipmentClaimError extends Error {}
/** Only trusted stored mixed claims may contain frozen current-fact answers. */
export type ShipmentParseOptions = { allowConstants?: boolean };
function check(value: unknown, message: string): asserts value {
  if (!value) throw new ShipmentClaimError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function parseLeaf(value: Record<string, unknown>): ShipmentLeaf {
  check(
    typeof value.territory === 'string' &&
      TERRITORIES.some((t) => t.id === value.territory),
    'Choose a printed destination territory.',
  );
  check(
    typeof value.minimum === 'number' &&
      Number.isSafeInteger(value.minimum) &&
      value.minimum >= 1 &&
      value.minimum <= 20,
    'Choose a minimum of one to twenty physical forces.',
  );
  return { territory: value.territory, minimum: value.minimum };
}
/** Bounded software input, not an additional printed limit on asking questions. */
export function parseShipmentExpression(
  value: unknown,
  options: ShipmentParseOptions = {},
): ShipmentExpression {
  let leaves = 0;
  const parse = (value: unknown, depth: number): ShipmentExpression => {
    check(
      object(value) && depth <= SHIPMENT_EXPRESSION_MAX_DEPTH,
      'Use a bounded shipment-only expression with at most four nested groups.',
    );
    if (Object.hasOwn(value, 'op')) {
      check(
        Object.keys(value).sort().join(',') === 'op,terms' &&
          (value.op === 'and' || value.op === 'or') &&
          Array.isArray(value.terms) &&
          value.terms.length >= 2 &&
          value.terms.length <= SHIPMENT_EXPRESSION_MAX_LEAVES,
        'Join two or more shipment statements with AND or OR.',
      );
      return {
        op: value.op,
        terms: value.terms.map((term) => parse(term, depth + 1)),
      };
    }
    if (Object.hasOwn(value, 'constant')) {
      check(
        options.allowConstants === true &&
          Object.keys(value).join(',') === 'constant' &&
          (value.constant === 'yes' ||
            value.constant === 'no' ||
            value.constant === 'unknown') &&
          ++leaves <= SHIPMENT_EXPRESSION_MAX_LEAVES,
        'Frozen fact answers are reserved for internal mixed shipment claims.',
      );
      return { constant: value.constant };
    }
    check(
      Object.keys(value).sort().join(',') === 'minimum,territory' &&
        ++leaves <= SHIPMENT_EXPRESSION_MAX_LEAVES,
      'Use at most sixteen reserve-shipment statements; other fact or action types cannot be mixed in.',
    );
    return parseLeaf(value);
  };
  return parse(value, 0);
}
/** Extract only claim fields; surrounding question and lifecycle metadata stays separate. */
export function parseShipmentClaim(
  value: unknown,
  options: ShipmentParseOptions = {},
): ShipmentClaim {
  check(object(value), 'Choose a valid shipment statement.');
  if (Object.hasOwn(value, 'claim')) {
    check(
      !Object.hasOwn(value, 'territory') && !Object.hasOwn(value, 'minimum'),
      'Choose either a legacy shipment statement or an expression, not both.',
    );
    return { claim: parseShipmentExpression(value.claim, options) };
  }
  check(
    !Object.hasOwn(value, 'op') &&
      !Object.hasOwn(value, 'terms') &&
      !Object.hasOwn(value, 'constant'),
    'Place the shipment expression in its claim field.',
  );
  return parseLeaf(value);
}
export function validShipmentClaim(
  value: unknown,
  options: ShipmentParseOptions = {},
): value is ShipmentClaim {
  try {
    parseShipmentClaim(value, options);
    return true;
  } catch (error) {
    if (error instanceof ShipmentClaimError) return false;
    throw error;
  }
}
export function shipmentExpressionOf(claim: ShipmentClaim): ShipmentExpression {
  return (
    claim.claim ?? { territory: claim.territory!, minimum: claim.minimum! }
  );
}
export function shipmentClaimDestinations(claim: ShipmentClaim): string[] {
  const collect = (expression: ShipmentExpression): string[] =>
    'op' in expression
      ? expression.terms.flatMap(collect)
      : 'constant' in expression
        ? []
        : [expression.territory];
  return [...new Set(collect(shipmentExpressionOf(claim)))];
}
export function shipmentClaimText(
  claim: ShipmentClaim & { mixed?: MixedShipmentExpression },
): string {
  check(!claim.mixed, 'Format a mixed promise using its original public question.');
  const text = (expression: ShipmentExpression): string => {
    check(
      !('constant' in expression),
      'Format a compiled mixed claim using its original question, not its private answers.',
    );
    return 'op' in expression
      ? `(${expression.terms.map(text).join(expression.op === 'and' ? ' AND ' : ' OR ')})`
      : `ship at least ${expression.minimum} physical forces from your reserves to ${territory(expression.territory).name}`;
  };
  return text(shipmentExpressionOf(claim));
}
/** Software readiness boundary; this is not a printed restriction on Truthtrance. */
export function shipmentPromiseModeSupported(game: {
  advanced: boolean;
  expansions: readonly unknown[];
  players: readonly { faction: string }[];
  techTokens?: unknown;
  strongholdCards?: unknown;
  nexusCards?: unknown;
  homeworlds?: unknown;
}): boolean {
  return (
    !game.expansions.length &&
    (!game.advanced ||
      (!game.players.some((player) => player.faction === 'guild') &&
        !game.techTokens &&
        !game.strongholdCards &&
        !game.nexusCards &&
        !game.homeworlds))
  );
}
export type ShipmentPromise = ShipmentClaim & {
  turn: number;
  player: string;
  asker: string;
  answer: boolean;
  /** Public original question; the normalized claim remains private to its respondent. */
  mixed?: MixedShipmentExpression;
  released?: boolean;
  fulfilled?: boolean;
};
export function matchesShipment(
  claim: ShipmentClaim,
  shipment: { territory: string; amount: number } | null,
): boolean | null {
  const matches = (expression: ShipmentExpression): boolean | null => {
    if ('constant' in expression)
      return expression.constant === 'unknown'
        ? null
        : expression.constant === 'yes';
    if ('op' in expression) {
      let unknown = false;
      for (const term of expression.terms) {
        const result = matches(term);
        if (expression.op === 'and' && result === false) return false;
        if (expression.op === 'or' && result === true) return true;
        if (result === null) unknown = true;
      }
      return unknown ? null : expression.op === 'and';
    }
    return !!shipment &&
      shipment.territory === expression.territory &&
      shipment.amount >= expression.minimum;
  };
  return matches(shipmentExpressionOf(claim));
}
export function liveShipmentPromises(
  promises: readonly ShipmentPromise[],
  player: string,
  turn: number,
): ShipmentPromise[] {
  return promises.filter(
    (p) =>
      p.player === player && p.turn === turn && !p.released && !p.fulfilled,
  );
}
