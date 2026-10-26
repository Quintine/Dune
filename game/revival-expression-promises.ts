export { revivalPromiseModeSupported as revivalExpressionPromiseModeSupported } from './revival-promises';

export type RevivalExpressionLeaf =
  | { kind: 'forces'; counter: 'total' | 'normal' | 'elite'; minimum: number }
  | { kind: 'leader'; leader: string };
export type RevivalExpression = RevivalExpressionLeaf |
  { kind: 'and' | 'or'; terms: RevivalExpression[] };
export type RevivalExpressionClaim = { turn: number; claim: RevivalExpression };
export type RevivalExpressionProgress = {
  total: number; normal: number; elite: number; leaders: string[];
};
export type RevivalExpressionPromise = RevivalExpressionClaim & {
  event: string; player: string; asker: string; answer: boolean;
  progress: RevivalExpressionProgress;
  fulfilled?: boolean; released?: boolean;
};
export type RevivalExpressionReturn =
  | { kind: 'forces'; amount: number; elite: number }
  | { kind: 'leader'; leader: string };
export type RevivalExpressionBranchLeaf =
  | { kind: 'forces'; counter: 'total' | 'normal' | 'elite'; minimum: number; progress: number; answer: boolean }
  | { kind: 'leader'; leader: string; answer: boolean };

export const REVIVAL_EXPRESSION_MAX_DEPTH = 4;
export const REVIVAL_EXPRESSION_MAX_LEAVES = 16;

export class RevivalExpressionPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevivalExpressionPromiseError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RevivalExpressionPromiseError(message);
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

/** Software input limits shared with shipment, not a printed question limit.
 * Parse every subtree before any evaluation can short-circuit its answer. */
export function parseRevivalExpression(value: unknown): RevivalExpression {
  let leaves = 0;
  const parse = (input: unknown, depth: number): RevivalExpression => {
    check(object(input) && depth <= REVIVAL_EXPRESSION_MAX_DEPTH,
      'Use a revival expression within four nested groups.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= REVIVAL_EXPRESSION_MAX_LEAVES,
      'Join two or more ordinary revival statements with AND or OR.');
      return { kind: input.kind, terms: input.terms.map(term => parse(term, depth + 1)) };
    }
    check(++leaves <= REVIVAL_EXPRESSION_MAX_LEAVES,
      'Use at most sixteen ordinary revival statements.');
    if (input.kind === 'forces') {
      check(keys(input, 'counter,kind,minimum') &&
        (input.counter === 'total' || input.counter === 'normal' || input.counter === 'elite') &&
        count(input.minimum) && input.minimum >= 1,
      'Choose total, normal or elite physical forces and a minimum from 1 to 20.');
      return { kind: 'forces', counter: input.counter, minimum: input.minimum };
    }
    check(input.kind === 'leader' && keys(input, 'kind,leader') && identifier(input.leader),
      'Choose an exact ordinary leader identity.');
    return { kind: 'leader', leader: input.leader };
  };
  return parse(value, 0);
}

export function parseRevivalExpressionClaim(value: unknown): RevivalExpressionClaim {
  check(object(value) && keys(value, 'claim,turn') && typeof value.turn === 'number' &&
    Number.isSafeInteger(value.turn) && value.turn >= 1,
  'Choose the current turn and an ordinary revival expression.');
  return { turn: value.turn, claim: parseRevivalExpression(value.claim) };
}

export function revivalExpressionText(expression: RevivalExpression,
  leaderName: (id: string) => string = id => id === 'kwisatz' ? 'Kwisatz Haderach' : id): string {
  const text = (node: RevivalExpression): string => {
    if ('terms' in node)
      return `(${node.terms.map(text).join(node.kind === 'and' ? ' AND ' : ' OR ')})`;
    if (node.kind === 'leader') return `revive ${leaderName(node.leader)} through ordinary leader revival`;
    const counters = node.counter === 'total' ? 'physical forces' : `${node.counter} forces`;
    return `revive at least ${node.minimum} ${counters} through ordinary force revival`;
  };
  return text(parseRevivalExpression(expression));
}

function validateProgress(value: unknown): asserts value is RevivalExpressionProgress {
  check(object(value) && keys(value, 'elite,leaders,normal,total') && count(value.total) &&
    count(value.normal) && count(value.elite) && value.total === value.normal + value.elite &&
    Array.isArray(value.leaders) && value.leaders.every(identifier) &&
    new Set(value.leaders).size === value.leaders.length,
  'Retain cumulative typed physical returns and unique returned leader identities.');
}

function evaluate(expression: RevivalExpression, progress: RevivalExpressionProgress): boolean {
  if ('terms' in expression) return expression.kind === 'and' ?
    expression.terms.every(term => evaluate(term, progress)) : expression.terms.some(term => evaluate(term, progress));
  return expression.kind === 'leader' ? progress.leaders.includes(expression.leader) :
    progress[expression.counter] >= expression.minimum;
}

export function evaluateRevivalExpression(expression: RevivalExpression, progress: RevivalExpressionProgress): boolean {
  const parsed = parseRevivalExpression(expression);
  validateProgress(progress);
  return evaluate(parsed, progress);
}

export function liveRevivalExpressionPromises(promises: readonly RevivalExpressionPromise[], player: string,
  turn: number): RevivalExpressionPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function validateReturn(event: RevivalExpressionReturn): void {
  check(object(event) && (event.kind === 'forces' && keys(event, 'amount,elite,kind') && count(event.amount) &&
    count(event.elite) && event.elite <= event.amount ||
    event.kind === 'leader' && keys(event, 'kind,leader') && identifier(event.leader)),
  'Retain the actual typed ordinary return event.');
}

/** Only completed ordinary native returns call this function. Each answer has
 * its own future interval; past returns and special/card returns are not added. */
export function recordRevivalExpressionReturn(promises: readonly RevivalExpressionPromise[], player: string,
  turn: number, event: RevivalExpressionReturn): RevivalExpressionPromise[] {
  validateReturn(event);
  const updates = new Map<RevivalExpressionPromise, RevivalExpressionPromise>();
  for (const promise of liveRevivalExpressionPromises(promises, player, turn)) {
    const claim = parseRevivalExpression(promise.claim);
    validateProgress(promise.progress);
    check(typeof promise.answer === 'boolean', 'Retain a definite revival expression answer.');
    const old = promise.progress;
    if (event.kind === 'forces' && event.amount === 0 || event.kind === 'leader' && old.leaders.includes(event.leader))
      continue;
    const progress: RevivalExpressionProgress = event.kind === 'forces' ? {
      total: old.total + event.amount, normal: old.normal + event.amount - event.elite,
      elite: old.elite + event.elite, leaders: [...old.leaders],
    } : { ...old, leaders: [...old.leaders, event.leader] };
    validateProgress(progress);
    const satisfied = evaluate(claim, progress);
    check(promise.answer || !satisfied,
      'This ordinary return conflicts with your whole Truthtrance revival No answer.');
    updates.set(promise, { ...promise, progress, ...(promise.answer && satisfied ? { fulfilled: true } : {}) });
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Keep the strongest bound for each counter/polarity and reject contradictory
 * same-counter or named-disc requirements before expanding the next subtree. */
function mergeBranches(left: RevivalExpressionBranchLeaf[], right: RevivalExpressionBranchLeaf[]):
RevivalExpressionBranchLeaf[] | null {
  const merged = left.map(leaf => ({ ...leaf }));
  for (const leaf of right) {
    if (leaf.kind === 'leader') {
      const prior = merged.find(other => other.kind === 'leader' && other.leader === leaf.leader);
      if (prior && prior.answer !== leaf.answer) return null;
      if (!prior) merged.push({ ...leaf });
      continue;
    }
    const same = merged.find(other => other.kind === 'forces' && other.counter === leaf.counter && other.answer === leaf.answer);
    if (same?.kind === 'forces') same.minimum = leaf.answer ? Math.max(same.minimum, leaf.minimum) : Math.min(same.minimum, leaf.minimum);
    else merged.push({ ...leaf });
    const positive = merged.find(other => other.kind === 'forces' && other.counter === leaf.counter && other.answer);
    const negative = merged.find(other => other.kind === 'forces' && other.counter === leaf.counter && !other.answer);
    if (positive?.kind === 'forces' && negative?.kind === 'forces' && positive.minimum >= negative.minimum) return null;
  }
  return merged;
}

/** Lazy alternatives retain original minima plus this answer's counter
 * progress. Whole No uses De Morgan, never a No imposed on every AND child.
 * Native allowance, prices and cross-counter feasibility remain quote-owned. */
export function* revivalExpressionBranches(promise: RevivalExpressionPromise): Generator<RevivalExpressionBranchLeaf[]> {
  const expression = parseRevivalExpression(promise.claim);
  validateProgress(promise.progress);
  check(typeof promise.answer === 'boolean', 'Retain a definite revival expression answer.');
  if (promise.fulfilled || promise.released) { yield []; return; }
  function* alternatives(node: RevivalExpression, answer: boolean): Generator<RevivalExpressionBranchLeaf[]> {
    if (node.kind === 'forces' || node.kind === 'leader') {
      if (evaluate(node, promise.progress)) { if (answer) yield []; return; }
      yield [node.kind === 'forces' ? { ...node, progress: promise.progress[node.counter], answer } : { ...node, answer }];
      return;
    }
    const conjunction = node.kind === 'and' ? answer : !answer;
    if (!conjunction) {
      for (const term of node.terms) yield* alternatives(term, answer);
      return;
    }
    const terms = node.terms;
    function* combine(index: number, prefix: RevivalExpressionBranchLeaf[]): Generator<RevivalExpressionBranchLeaf[]> {
      if (index === terms.length) { yield prefix; return; }
      for (const suffix of alternatives(terms[index], answer)) {
        const merged = mergeBranches(prefix, suffix);
        if (merged) yield* combine(index + 1, merged);
      }
    }
    yield* combine(0, []);
  }
  if (promise.answer && evaluate(expression, promise.progress)) { yield []; return; }
  yield* alternatives(expression, promise.answer);
}

export function validateRevivalExpressionPromises(promises: readonly RevivalExpressionPromise[], players: readonly string[]): void {
  check(Array.isArray(promises), 'The revival expression commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    check(object(promise), 'The revival expression commitment record is invalid.');
    const { claim } = parseRevivalExpressionClaim({ turn: promise.turn, claim: promise.claim });
    validateProgress(promise.progress);
    const satisfied = evaluate(claim, promise.progress);
    check(identifier(promise.event) && !events.has(promise.event) &&
      identifier(promise.player) && identifier(promise.asker) && players.includes(promise.player) &&
      players.includes(promise.asker) && promise.player !== promise.asker && typeof promise.answer === 'boolean' &&
      optionalBoolean(promise.fulfilled) && optionalBoolean(promise.released) && !(promise.fulfilled && promise.released) &&
      (promise.answer || !satisfied) &&
      (!promise.answer || promise.released || !!promise.fulfilled === satisfied),
    'The revival expression lost its event, participants or whole-answer progress.');
    events.add(promise.event);
  }
}
