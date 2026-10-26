import {
  allianceClaimText, alliancePromisesMatch, findAlliancePromisePlan,
  type AllianceOpportunity, type AlliancePromise,
} from './alliance-promises';

export const ALLIANCE_EXPRESSION_MAX_LEAVES = 16;
export const ALLIANCE_EXPRESSION_MAX_DEPTH = 4;

export type AllianceExpression =
  | { kind: 'partner'; partner: string }
  | { kind: 'and' | 'or'; terms: AllianceExpression[] };
export type AllianceExpressionClaim = { turn: number; claim: AllianceExpression };
export type AllianceExpressionPromise = AllianceExpressionClaim & {
  event: string;
  /** Original private ordinary-Nexus interval; never public question text. */
  source: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
export type AllianceExpressionContext = {
  players: readonly { id: string; ally: string | null }[];
  offers: Readonly<Record<string, string>>;
};
export type AllianceAction = { type: 'alliance'; target: string | null };

export class AllianceExpressionPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllianceExpressionPromiseError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new AllianceExpressionPromiseError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected;

/** These input limits match the other full expression families. Parse every
 * branch before evaluation, including clauses behind a decisive AND or OR. */
export function parseAllianceExpression(value: unknown): AllianceExpression {
  let leaves = 0;
  const parse = (input: unknown, depth: number): AllianceExpression => {
    check(object(input) && depth <= ALLIANCE_EXPRESSION_MAX_DEPTH,
      'Use an alliance expression within four nested groups.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= ALLIANCE_EXPRESSION_MAX_LEAVES,
      'Join two or more final alliance statements with AND or OR.');
      return { kind: input.kind, terms: input.terms.map(term => parse(term, depth + 1)) };
    }
    check(++leaves <= ALLIANCE_EXPRESSION_MAX_LEAVES && input.kind === 'partner' &&
      keys(input, 'kind,partner') && identifier(input.partner),
    'Choose at most sixteen exact final alliance partners.');
    return { kind: 'partner', partner: input.partner };
  };
  return parse(value, 0);
}

export function parseAllianceExpressionClaim(value: unknown): AllianceExpressionClaim {
  check(object(value) && keys(value, 'claim,turn') && typeof value.turn === 'number' &&
    Number.isSafeInteger(value.turn) && value.turn >= 1,
  'Choose the current turn and a final alliance expression.');
  return { turn: value.turn, claim: parseAllianceExpression(value.claim) };
}

function evaluate(expression: AllianceExpression, ally: string | null): boolean {
  if (expression.kind === 'partner') return ally === expression.partner;
  return expression.kind === 'and' ? expression.terms.every(term => evaluate(term, ally)) :
    expression.terms.some(term => evaluate(term, ally));
}

/** Positive truth at one final native pair, independent of the whole answer. */
export function evaluateAllianceExpression(expression: AllianceExpression, ally: string | null): boolean {
  return evaluate(parseAllianceExpression(expression), ally);
}

export function allianceExpressionText(expression: AllianceExpression,
  playerName: (id: string) => string = id => id): string {
  const text = (node: AllianceExpression): string => node.kind === 'partner' ?
    allianceClaimText({ turn: 1, partner: node.partner }, playerName) :
    `(${node.terms.map(text).join(node.kind === 'and' ? ' AND ' : ' OR ')})`;
  return text(parseAllianceExpression(expression));
}

export function liveAllianceExpressionPromises(promises: readonly AllianceExpressionPromise[], player: string,
  opportunity: AllianceOpportunity): AllianceExpressionPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === opportunity.turn &&
    promise.source === opportunity.source && !promise.fulfilled && !promise.released);
}

/** A whole No negates the complete expression. No interim membership settles
 * an answer; the engine owns the original ordinary Nexus closing event. */
export function allianceExpressionPromisesMatch(promises: readonly AllianceExpressionPromise[], player: string,
  opportunity: AllianceOpportunity, ally: string | null): boolean {
  return liveAllianceExpressionPromises(promises, player, opportunity)
    .map(promise => evaluateAllianceExpression(promise.claim, ally) === promise.answer).every(Boolean);
}

/** Enumerate truth-compatible final identities, not promises of foreign
 * consent. Keep current membership first so a legal no-op stays preferred. */
export function allianceExpressionOutcomes(scalars: readonly AlliancePromise[],
  expressions: readonly AllianceExpressionPromise[], player: string, opportunity: AllianceOpportunity,
  context: AllianceExpressionContext): (string | null)[] {
  const owner = context.players.find(seat => seat.id === player);
  if (!owner) return [];
  const candidates = new Set<string | null>([owner.ally, null,
    ...context.players.filter(seat => seat.id !== player).map(seat => seat.id)]);
  return [...candidates].filter(ally => alliancePromisesMatch(scalars, player, opportunity, ally) &&
    allianceExpressionPromisesMatch(expressions, player, opportunity, ally));
}

/** Reuse the native scalar witness for each compatible outcome. Local exact
 * outcome clauses are never persisted/projected and cannot invent a foreign
 * acceptance, break or invitation. Return every owned route so the engine can
 * try its original financial/preparation constraints without pinning an OR. */
export function findAllianceExpressionPlans(scalars: readonly AlliancePromise[],
  expressions: readonly AllianceExpressionPromise[], player: string, opportunity: AllianceOpportunity,
  context: AllianceExpressionContext): AllianceAction[][] {
  if (!liveAllianceExpressionPromises(expressions, player, opportunity).length) {
    const plan = findAlliancePromisePlan(scalars, player, opportunity, context);
    return plan === null ? [] : [plan];
  }
  const plans: AllianceAction[][] = [];
  const seen = new Set<string>();
  for (const ally of allianceExpressionOutcomes(scalars, expressions, player, opportunity, context)) {
    const exact: AlliancePromise[] = (ally === null ? context.players.filter(seat => seat.id !== player)
      .map(seat => ({ partner: seat.id, answer: false })) : [{ partner: ally, answer: true }])
      .map((claim, index) => ({ ...claim, turn: opportunity.turn, source: opportunity.source,
        event: `alliance-expression-outcome-${index}`, player,
        asker: context.players.find(seat => seat.id !== player)?.id ?? player }));
    const plan = findAlliancePromisePlan([...scalars, ...exact], player, opportunity, context);
    if (plan === null) continue;
    const key = JSON.stringify(plan);
    if (!seen.has(key)) { seen.add(key); plans.push(plan); }
  }
  return plans;
}

export function validateAllianceExpressionPromises(promises: readonly AllianceExpressionPromise[],
  playerIds: readonly string[]): void {
  check(Array.isArray(promises), 'The alliance expression commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    check(object(promise), 'The alliance expression commitment record is invalid.');
    const { claim } = parseAllianceExpressionClaim({ turn: promise.turn, claim: promise.claim });
    const validPartners = (node: AllianceExpression): boolean => node.kind === 'partner' ?
      playerIds.includes(node.partner) && node.partner !== promise.player : node.terms.every(validPartners);
    check(identifier(promise.event) && !events.has(promise.event) && identifier(promise.source) &&
      identifier(promise.player) && identifier(promise.asker) && playerIds.includes(promise.player) &&
      playerIds.includes(promise.asker) && promise.player !== promise.asker && validPartners(claim) &&
      typeof promise.answer === 'boolean' && optionalBoolean(promise.fulfilled) && optionalBoolean(promise.released) &&
      !(promise.fulfilled && promise.released),
    'The alliance expression lost its Nexus source, event or participants.');
    events.add(promise.event);
  }
}
