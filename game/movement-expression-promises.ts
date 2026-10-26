import { TERRITORIES } from './board';
import { MovementClaimError, movementClaimText, parseMovementClaim, type MovementEvent } from './movement-promises';

export { movementPromiseModeSupported as movementExpressionPromiseModeSupported } from './movement-promises';

export type MovementExpression = { kind: 'move'; territory: string; minimum: number } |
  { kind: 'and' | 'or'; terms: MovementExpression[] };
export type MovementExpressionClaim = { turn: number; claim: MovementExpression };
export type MovementExpressionProgressEntry = { territory: string; maximum: number };
export type MovementExpressionProgress = MovementExpressionProgressEntry[];
export type MovementExpressionEvent = MovementEvent;
export type MovementExpressionPromise = MovementExpressionClaim & {
  event: string; player: string; asker: string; answer: boolean;
  /** Largest actual physical ground move to each named destination after this answer. */
  progress: MovementExpressionProgress;
  fulfilled?: boolean; released?: boolean;
};

export const MOVEMENT_EXPRESSION_MAX_DEPTH = 4;
export const MOVEMENT_EXPRESSION_MAX_LEAVES = 16;

export class MovementExpressionPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovementExpressionPromiseError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new MovementExpressionPromiseError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 20;
const printedTerritory = (value: unknown): value is string =>
  typeof value === 'string' && TERRITORIES.some(destination => destination.id === value);

/** Validate every subtree before evaluation can short-circuit. The scalar
 * parser remains the authority for printed destinations and physical minima. */
export function parseMovementExpression(value: unknown): MovementExpression {
  let leaves = 0;
  const parse = (input: unknown, depth: number): MovementExpression => {
    check(object(input) && depth <= MOVEMENT_EXPRESSION_MAX_DEPTH,
      'Use a ground-movement expression within four nested groups.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= MOVEMENT_EXPRESSION_MAX_LEAVES,
      'Join two or more ground-movement statements with AND or OR.');
      return { kind: input.kind, terms: input.terms.map(term => parse(term, depth + 1)) };
    }
    check(++leaves <= MOVEMENT_EXPRESSION_MAX_LEAVES,
      'Use at most sixteen ground-movement statements.');
    check(input.kind === 'move' && keys(input, 'kind,minimum,territory'),
      'Choose one physical ground-movement minimum and printed destination.');
    try { return { kind: 'move', ...parseMovementClaim(input) }; }
    catch (error) {
      if (error instanceof MovementClaimError) throw new MovementExpressionPromiseError(error.message);
      throw error;
    }
  };
  return parse(value, 0);
}

export function parseMovementExpressionClaim(value: unknown): MovementExpressionClaim {
  check(object(value) && keys(value, 'claim,turn') && typeof value.turn === 'number' &&
    Number.isSafeInteger(value.turn) && value.turn >= 1,
  'Choose the current turn and a ground-movement expression.');
  return { turn: value.turn, claim: parseMovementExpression(value.claim) };
}

export function movementExpressionText(expression: MovementExpression): string {
  const text = (node: MovementExpression): string => 'terms' in node ?
    `(${node.terms.map(text).join(node.kind === 'and' ? ' AND ' : ' OR ')})` : movementClaimText(node);
  return text(parseMovementExpression(expression));
}

export function movementExpressionTerritories(expression: MovementExpression): string[] {
  const destinations = new Set<string>();
  const visit = (node: MovementExpression): void => {
    if ('terms' in node) node.terms.forEach(visit);
    else destinations.add(node.territory);
  };
  visit(parseMovementExpression(expression));
  return [...destinations];
}

function validateProgress(value: unknown): asserts value is MovementExpressionProgress {
  check(Array.isArray(value), 'Retain the largest future physical ground move by named destination.');
  const destinations = new Set<string>();
  for (const entry of value) {
    check(object(entry) && keys(entry, 'maximum,territory') && printedTerritory(entry.territory) &&
      count(entry.maximum) && !destinations.has(entry.territory),
    'Retain unique printed destinations and physical ground-movement maxima from zero to twenty.');
    destinations.add(entry.territory);
  }
}

function evaluate(expression: MovementExpression, progress: readonly MovementExpressionProgressEntry[]): boolean {
  if ('terms' in expression) return expression.kind === 'and' ?
    expression.terms.every(term => evaluate(term, progress)) : expression.terms.some(term => evaluate(term, progress));
  return (progress.find(entry => entry.territory === expression.territory)?.maximum ?? 0) >= expression.minimum;
}

export function evaluateMovementExpression(expression: MovementExpression,
  progress: readonly MovementExpressionProgressEntry[]): boolean {
  const parsed = parseMovementExpression(expression);
  validateProgress(progress);
  return evaluate(parsed, progress);
}

export function liveMovementExpressionPromises<T extends MovementExpressionPromise>(promises: readonly T[], player: string,
  turn: number): T[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function readPromise(promise: MovementExpressionPromise): MovementExpression {
  check(object(promise), 'The ground-movement expression commitment record is invalid.');
  const { claim } = parseMovementExpressionClaim({ turn: promise.turn, claim: promise.claim });
  validateProgress(promise.progress);
  const destinations = movementExpressionTerritories(claim);
  check(typeof promise.answer === 'boolean' && optionalBoolean(promise.fulfilled) && optionalBoolean(promise.released) &&
    !(promise.fulfilled && promise.released) && promise.progress.every(entry => destinations.includes(entry.territory)),
  'Retain a definite whole movement answer and its own matching future physical move progress.');
  return claim;
}

/** Call only after a committed ordinary physical ground move. Shipments,
 * ambassador moves and marker pieces are not qualifying forces. A marker-only
 * event may have amount zero, which cannot advance a positive minimum. */
export function recordMovementExpressionEvent<T extends MovementExpressionPromise>(promises: readonly T[], player: string,
  turn: number, event: MovementEvent): T[] {
  check(object(event) && keys(event, 'amount,territory') && identifier(event.territory) && count(event.amount),
    'Retain the exact destination and zero to twenty actual physical ground-moving forces.');
  const updates = new Map<T, T>();
  for (const promise of liveMovementExpressionPromises(promises, player, turn)) {
    const claim = readPromise(promise);
    if (!movementExpressionTerritories(claim).includes(event.territory)) continue;
    const old = promise.progress.find(entry => entry.territory === event.territory)?.maximum ?? 0;
    if (event.amount <= old) continue;
    const progress = promise.progress.map(entry => ({ ...entry }));
    const entry = progress.find(entry => entry.territory === event.territory);
    if (entry) entry.maximum = event.amount;
    else progress.push({ territory: event.territory, maximum: event.amount });
    const satisfied = evaluate(claim, progress);
    check(promise.answer || !satisfied,
      'This ground movement conflicts with your whole Truthtrance movement No answer.');
    updates.set(promise, { ...promise, progress, ...(promise.answer && satisfied ? { fulfilled: true } : {}) });
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

export function validateMovementExpressionPromises(promises: readonly MovementExpressionPromise[], players: readonly string[]): void {
  check(Array.isArray(promises), 'The ground-movement expression commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    const claim = readPromise(promise);
    const satisfied = evaluate(claim, promise.progress);
    check(identifier(promise.event) && !events.has(promise.event) && identifier(promise.player) && identifier(promise.asker) &&
      players.includes(promise.player) && players.includes(promise.asker) && promise.player !== promise.asker &&
      (promise.answer || !satisfied) && (!promise.answer || promise.released || !!promise.fulfilled === satisfied),
    'The ground-movement expression lost its event, participants or whole-answer progress.');
    events.add(promise.event);
  }
}
