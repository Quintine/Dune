import { bribePromiseRequirements, liveBribePromises, type BribePromise } from './bribe-promises';

export { bribePromiseModeSupported as bribeExpressionPromiseModeSupported } from './bribe-promises';

export type BribeExpression = { kind: 'payment'; recipient: string; minimum: number } |
  { kind: 'and' | 'or'; terms: BribeExpression[] };
export type BribeExpressionClaim = { turn: number; claim: BribeExpression };
export type BribeExpressionPayment = { recipient: string; amount: number };
export type BribeExpressionProgress = BribeExpressionPayment[];
export type BribeExpressionPromise = BribeExpressionClaim & {
  event: string; player: string; asker: string; answer: boolean;
  /** Matching actual ordinary payments after this answer, excluding their later receipt. */
  progress: BribeExpressionProgress;
  fulfilled?: boolean; released?: boolean; order?: number;
};
export type BribeExpressionBranchLeaf = {
  recipient: string; minimum: number; progress: number; answer: boolean;
};

export const BRIBE_EXPRESSION_MAX_DEPTH = 4;
export const BRIBE_EXPRESSION_MAX_LEAVES = 16;

export class BribeExpressionPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BribeExpressionPromiseError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new BribeExpressionPromiseError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => whole(value) && value > 0;
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected;

/** Software limits match revival expressions; spice minima have no artificial cap.
 * Every subtree is parsed before an answer can short-circuit evaluation. */
export function parseBribeExpression(value: unknown): BribeExpression {
  let leaves = 0;
  const parse = (input: unknown, depth: number): BribeExpression => {
    check(object(input) && depth <= BRIBE_EXPRESSION_MAX_DEPTH,
      'Use an ordinary bribe expression within four nested groups.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= BRIBE_EXPRESSION_MAX_LEAVES,
      'Join two or more ordinary bribe statements with AND or OR.');
      return { kind: input.kind, terms: input.terms.map(term => parse(term, depth + 1)) };
    }
    check(++leaves <= BRIBE_EXPRESSION_MAX_LEAVES,
      'Use at most sixteen ordinary bribe statements.');
    check(input.kind === 'payment' && keys(input, 'kind,minimum,recipient') &&
      identifier(input.recipient) && positive(input.minimum),
    'Choose an exact ordinary bribe recipient and a positive safe whole spice minimum.');
    return { kind: 'payment', recipient: input.recipient, minimum: input.minimum };
  };
  return parse(value, 0);
}

export function parseBribeExpressionClaim(value: unknown): BribeExpressionClaim {
  check(object(value) && keys(value, 'claim,turn') && positive(value.turn),
    'Choose the current turn and an ordinary bribe expression.');
  return { turn: value.turn, claim: parseBribeExpression(value.claim) };
}

export function bribeExpressionText(expression: BribeExpression,
  recipientName: (id: string) => string = id => id): string {
  const text = (node: BribeExpression): string => 'terms' in node ?
    `(${node.terms.map(text).join(node.kind === 'and' ? ' AND ' : ' OR ')})` :
    `pay at least ${node.minimum} spice to ${recipientName(node.recipient)} in ordinary bribes`;
  return text(parseBribeExpression(expression));
}

export function bribeExpressionRecipients(expression: BribeExpression): string[] {
  const recipients = new Set<string>();
  const visit = (node: BribeExpression): void => {
    if ('terms' in node) node.terms.forEach(visit);
    else recipients.add(node.recipient);
  };
  visit(parseBribeExpression(expression));
  return [...recipients];
}

function validateProgress(value: unknown): asserts value is BribeExpressionProgress {
  check(Array.isArray(value), 'Retain cumulative ordinary bribe payments by exact recipient.');
  const recipients = new Set<string>();
  for (const payment of value) {
    check(object(payment) && keys(payment, 'amount,recipient') && identifier(payment.recipient) &&
      whole(payment.amount) && !recipients.has(payment.recipient),
    'Retain unique recipients and safe whole cumulative ordinary bribe amounts.');
    recipients.add(payment.recipient);
  }
}

function evaluate(expression: BribeExpression, progress: readonly BribeExpressionPayment[]): boolean {
  if ('terms' in expression) return expression.kind === 'and' ?
    expression.terms.every(term => evaluate(term, progress)) : expression.terms.some(term => evaluate(term, progress));
  return (progress.find(payment => payment.recipient === expression.recipient)?.amount ?? 0) >= expression.minimum;
}

export function evaluateBribeExpression(expression: BribeExpression, progress: readonly BribeExpressionPayment[]): boolean {
  const parsed = parseBribeExpression(expression);
  validateProgress(progress);
  return evaluate(parsed, progress);
}

export function liveBribeExpressionPromises(promises: readonly BribeExpressionPromise[], player: string,
  turn: number): BribeExpressionPromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function readPromise(promise: BribeExpressionPromise): BribeExpression {
  check(object(promise), 'The ordinary bribe expression commitment record is invalid.');
  const { claim } = parseBribeExpressionClaim({ turn: promise.turn, claim: promise.claim });
  validateProgress(promise.progress);
  const recipients = bribeExpressionRecipients(claim);
  check(typeof promise.answer === 'boolean' && optionalBoolean(promise.fulfilled) && optionalBoolean(promise.released) &&
    !(promise.fulfilled && promise.released) && (promise.order === undefined || positive(promise.order)) &&
    promise.progress.every(payment => recipients.includes(payment.recipient)),
  'Retain a definite whole bribe answer and its own matching future payment progress.');
  return claim;
}

/** Only the completed ordinary payer action calls this function. Past payments,
 * gifts, special transfers and the later Mentat receipt never call it again. */
export function recordBribeExpressionPayment(promises: readonly BribeExpressionPromise[], player: string,
  turn: number, payment: BribeExpressionPayment): BribeExpressionPromise[] {
  check(object(payment) && keys(payment, 'amount,recipient') && identifier(payment.recipient) && positive(payment.amount),
    'Retain the exact recipient and positive safe whole ordinary bribe payment.');
  const updates = new Map<BribeExpressionPromise, BribeExpressionPromise>();
  for (const promise of liveBribeExpressionPromises(promises, player, turn)) {
    const claim = readPromise(promise);
    if (!bribeExpressionRecipients(claim).includes(payment.recipient)) continue;
    const old = promise.progress.find(entry => entry.recipient === payment.recipient)?.amount ?? 0;
    const next = old + payment.amount;
    check(Number.isSafeInteger(next), 'The cumulative ordinary bribe amount exceeds the safe integer range.');
    const progress = promise.progress.map(entry => ({ ...entry }));
    const entry = progress.find(entry => entry.recipient === payment.recipient);
    if (entry) entry.amount = next;
    else progress.push({ recipient: payment.recipient, amount: next });
    const satisfied = evaluate(claim, progress);
    check(promise.answer || !satisfied,
      'This payment conflicts with your whole Truthtrance ordinary bribe No answer.');
    updates.set(promise, { ...promise, progress, ...(promise.answer && satisfied ? { fulfilled: true } : {}) });
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

function mergeBranches(left: BribeExpressionBranchLeaf[], right: BribeExpressionBranchLeaf[]): BribeExpressionBranchLeaf[] | null {
  const merged = left.map(leaf => ({ ...leaf }));
  for (const leaf of right) {
    const same = merged.find(other => other.recipient === leaf.recipient && other.answer === leaf.answer);
    if (same) same.minimum = leaf.answer ? Math.max(same.minimum, leaf.minimum) : Math.min(same.minimum, leaf.minimum);
    else merged.push({ ...leaf });
    const yes = merged.find(other => other.recipient === leaf.recipient && other.answer);
    const no = merged.find(other => other.recipient === leaf.recipient && !other.answer);
    if (yes && no && yes.minimum >= no.minimum) return null;
  }
  return merged;
}

/** Whole No uses De Morgan; a No to AND leaves alternatives. No route is stored,
 * and each leaf retains its own answer interval for later joint composition. */
export function* bribeExpressionBranches(promise: BribeExpressionPromise): Generator<BribeExpressionBranchLeaf[]> {
  const expression = readPromise(promise);
  if (promise.fulfilled || promise.released) { yield []; return; }
  function* alternatives(node: BribeExpression, answer: boolean): Generator<BribeExpressionBranchLeaf[]> {
    if (node.kind === 'payment') {
      if (evaluate(node, promise.progress)) { if (answer) yield []; return; }
      yield [{ recipient: node.recipient, minimum: node.minimum,
        progress: promise.progress.find(entry => entry.recipient === node.recipient)?.amount ?? 0, answer }];
      return;
    }
    const conjunction = node.kind === 'and' ? answer : !answer;
    if (!conjunction) {
      for (const term of node.terms) yield* alternatives(term, answer);
      return;
    }
    const terms = node.terms;
    function* combine(index: number, prefix: BribeExpressionBranchLeaf[]): Generator<BribeExpressionBranchLeaf[]> {
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

type Bounds = Map<string, { minimum: number; maximum: number }>;
function addBound(bounds: Bounds, recipient: string, minimum: number, maximum: number): Bounds | null {
  const old = bounds.get(recipient) ?? { minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
  const next = { minimum: Math.max(old.minimum, minimum), maximum: Math.min(old.maximum, maximum) };
  if (next.minimum > next.maximum) return null;
  const merged = new Map(bounds);
  merged.set(recipient, next);
  return merged;
}
function addLeaf(bounds: Bounds, leaf: BribeExpressionBranchLeaf): Bounds | null {
  return addBound(bounds, leaf.recipient, leaf.answer ? Math.max(0, leaf.minimum - leaf.progress) : 0,
    leaf.answer ? Number.MAX_SAFE_INTEGER - leaf.progress : leaf.minimum - leaf.progress - 1);
}

/** Minimal additional payments per legal route across scalar and whole answers.
 * Same-recipient requirements share payments; distinct recipients spend separate
 * spice. The caller owns purse availability and actual ordinary payment timing. */
export function* bribeCompletionCandidates(atomics: readonly BribePromise[], expressions: readonly BribeExpressionPromise[],
  player: string, turn: number): Generator<BribeExpressionPayment[]> {
  if (bribePromiseRequirements(atomics, player, turn) === null) return;
  let initial: Bounds | null = new Map();
  for (const promise of liveBribePromises(atomics, player, turn)) {
    initial = addLeaf(initial, promise);
    if (!initial) return;
  }
  const live = liveBribeExpressionPromises(expressions, player, turn);
  for (const promise of live) {
    readPromise(promise);
    // An allocation to another answer must also fit nonselected-branch ledgers.
    for (const payment of promise.progress) {
      initial = addBound(initial, payment.recipient, 0, Number.MAX_SAFE_INTEGER - payment.amount);
      if (!initial) return;
    }
  }
  const seen = new Set<string>();
  function* combine(index: number, bounds: Bounds): Generator<BribeExpressionPayment[]> {
    if (index === live.length) {
      const payments: BribeExpressionPayment[] = [];
      let total = 0;
      for (const [recipient, { minimum }] of bounds) {
        total += minimum;
        if (!Number.isSafeInteger(total)) return;
        if (minimum > 0) payments.push({ recipient, amount: minimum });
      }
      const key = JSON.stringify([...payments].sort((left, right) => left.recipient.localeCompare(right.recipient)));
      if (!seen.has(key)) { seen.add(key); yield payments; }
      return;
    }
    for (const branch of bribeExpressionBranches(live[index])) {
      let next: Bounds | null = bounds;
      for (const leaf of branch) {
        next = addLeaf(next, leaf);
        if (!next) break;
      }
      if (next) yield* combine(index + 1, next);
    }
  }
  yield* combine(0, initial);
}

export function validateBribeExpressionPromises(promises: readonly BribeExpressionPromise[], players: readonly string[]): void {
  check(Array.isArray(promises), 'The ordinary bribe expression commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    const claim = readPromise(promise);
    const satisfied = evaluate(claim, promise.progress);
    check(identifier(promise.event) && !events.has(promise.event) && identifier(promise.player) && identifier(promise.asker) &&
      players.includes(promise.player) && players.includes(promise.asker) && promise.player !== promise.asker &&
      bribeExpressionRecipients(claim).every(recipient => players.includes(recipient) && recipient !== promise.player) &&
      (promise.answer || !satisfied) && (!promise.answer || promise.released || !!promise.fulfilled === satisfied),
    'The ordinary bribe expression lost its event, participants or whole-answer progress.');
    events.add(promise.event);
  }
}
