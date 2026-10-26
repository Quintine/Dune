import { TERRITORIES } from './board';
import { BribePromiseError, parseBribeClaim } from './bribe-promises';
import { BidPromiseError, parseBidClaim } from './bid-promises';
import { parseRevivalActionClaim, type RevivalActionClaim } from './mixed-revival-question';
import { RevivalExpressionPromiseError, type RevivalExpressionReturn } from './revival-expression-promises';
import {
  MixedActionQuestionError,
  parseMixedActionExpression,
  type CompiledMixedAction,
  type MixedActionExpression,
} from './mixed-action-question';
import {
  parseTravelActionClaim,
  TravelPromiseError,
  type TravelActionClaim,
  type TravelBranchLeaf,
  type TravelEvent,
} from './travel-expression-promises';
import type { TruthFact } from './truthtrance';

export const TURN_ACTION_MAX_LEAVES = 16;
export const TURN_ACTION_MAX_DEPTH = 4;

export type TurnActionLeaf = TravelActionClaim | { kind: 'payment'; recipient: string; minimum: number } |
  { kind: 'bid'; lot: number; minimum: number } | RevivalActionClaim;
export type TurnActionClaim = { turn: number; mixed: MixedActionExpression<TurnActionLeaf> };
export type TurnActionPayment = { recipient: string; amount: number };
export type TurnActionBranchLeaf = TravelBranchLeaf |
  { kind: 'payment'; recipient: string; minimum: number; progress: number; answer: boolean } |
  { kind: 'bid'; lot: number; source: string; minimum: number; answer: boolean } |
  { kind: 'forces'; counter: 'total' | 'normal' | 'elite'; minimum: number; progress: number; answer: boolean } |
  { kind: 'leader'; leader: string; answer: boolean };
export type TurnActionPreparation = {
  bid: { lot: number; source: string; maximum: number; closed: boolean } | null;
  revival: { total: number; normal: number; elite: number; leaders: string[]; closed: boolean } | null;
};
export type TurnActionBid = { lot: number; source: string; amount: number };
export type TurnActionPromise = TurnActionClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  /** Facts are frozen by the game-aware compiler when this answer is accepted. */
  compiled: CompiledMixedAction<TurnActionLeaf>;
  shipment: { pending: boolean; event: TravelEvent | null };
  /** Largest physical ground group after this answer, never a sum of groups. */
  progress: { territory: string; maximum: number }[];
  /** Actual completed ordinary payer actions after this answer. */
  payments: TurnActionPayment[];
  transportClosed: boolean;
  paymentClosed: boolean;
  fulfilled: boolean;
  released: boolean;
  /** Optional only for original shipment/movement/payment records. */
  preparation?: TurnActionPreparation;
};

export class TurnActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnActionError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new TurnActionError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => whole(value) && value > 0;
const physical = (value: unknown): value is number => whole(value) && value <= 20;
const printedTerritory = (value: unknown): value is string =>
  typeof value === 'string' && TERRITORIES.some(destination => destination.id === value);

/** Public leaves carry only their native destination/recipient and minimum. */
export function parseTurnActionLeaf(value: unknown): TurnActionLeaf {
  check(object(value), 'Choose one future ordinary bid, Revival, reserve shipment, ground movement or bribe payment.');
  try {
    if (value.kind === 'bid') {
      check(keys(value, 'kind,lot,minimum'), 'Supply only the current ordinary lot and positive bid minimum.');
      const claim = parseBidClaim({ turn: 1, lot: value.lot, minimum: value.minimum });
      return { kind: 'bid', lot: claim.lot, minimum: claim.minimum };
    }
    if (value.kind === 'forces' || value.kind === 'leader') return parseRevivalActionClaim(value);
    if (value.kind !== 'payment') return parseTravelActionClaim(value);
    check(keys(value, 'kind,minimum,recipient'), 'Supply only the ordinary payment recipient and minimum.');
    const claim = parseBribeClaim({ turn: 1, recipient: value.recipient, minimum: value.minimum });
    return { kind: 'payment', recipient: claim.recipient, minimum: claim.minimum };
  } catch (error) {
    if (error instanceof TravelPromiseError || error instanceof BribePromiseError || error instanceof BidPromiseError ||
      error instanceof RevivalExpressionPromiseError)
      throw new TurnActionError(error.message);
    throw error;
  }
}

/** The engine owns game-aware fact decoding; retain and bound its original tree. */
function storedFact(value: unknown, depth = 0): TruthFact {
  check(object(value) && identifier(value.kind) && depth <= TURN_ACTION_MAX_DEPTH &&
    value.kind !== 'constant' && value.kind !== 'action' && value.kind !== 'fact',
  'Retain the original current-fact statement.');
  if (value.kind === 'and' || value.kind === 'or') {
    check(keys(value, 'kind,terms') && Array.isArray(value.terms) &&
      value.terms.length >= 2 && value.terms.length <= TURN_ACTION_MAX_LEAVES,
    'Retain a bounded original current-fact group.');
    return { kind: value.kind, terms: value.terms.map(term => storedFact(term, depth + 1)) };
  }
  return value as unknown as TruthFact;
}

function actionKey(action: TurnActionLeaf): string {
  if (action.kind === 'leader') return JSON.stringify([action.kind, action.leader]);
  if (action.kind === 'forces') return JSON.stringify([action.kind, action.counter, action.minimum]);
  if (action.kind === 'bid') return JSON.stringify([action.kind, action.lot, action.minimum]);
  return JSON.stringify(action.kind === 'payment' ? [action.kind, action.recipient, action.minimum] :
    [action.kind, action.territory, action.minimum]);
}

function readCompiled(value: unknown, originals: ReadonlySet<string>): CompiledMixedAction<TurnActionLeaf> {
  let leaves = 0;
  const read = (input: unknown, depth: number): CompiledMixedAction<TurnActionLeaf> => {
    check(object(input) && depth <= TURN_ACTION_MAX_DEPTH,
      'Retain the bounded private answer-time turn-action expression.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= TURN_ACTION_MAX_LEAVES,
      'Retain the private answer-time AND/OR turn-action groups.');
      return { kind: input.kind, terms: input.terms.map(term => read(term, depth + 1)) };
    }
    check(++leaves <= TURN_ACTION_MAX_LEAVES, 'Retain at most sixteen private turn-action clauses.');
    if (input.kind === 'constant') {
      check(keys(input, 'kind,value') && typeof input.value === 'boolean',
        'Retain a definite private frozen fact answer.');
      return { kind: 'constant', value: input.value };
    }
    check(input.kind === 'action' && keys(input, 'action,kind'),
      'Retain a private frozen fact or original future action.');
    const action = parseTurnActionLeaf(input.action);
    check(originals.has(actionKey(action)), 'A private future-action clause must come from the original question.');
    return { kind: 'action', action };
  };
  return read(value, 0);
}

function validateEvent(event: unknown): asserts event is TravelEvent {
  check(object(event) && keys(event, 'amount,territory') && printedTerritory(event.territory) && physical(event.amount),
    'Retain the printed destination and zero to twenty actual physical forces.');
}

function readPromise(promise: TurnActionPromise): CompiledMixedAction<TurnActionLeaf> {
  const fields = 'answer,asker,compiled,event,fulfilled,mixed,paymentClosed,payments,player,progress,released,shipment,transportClosed,turn';
  check(object(promise) && (keys(promise, fields) || keys(promise,
    'answer,asker,compiled,event,fulfilled,mixed,paymentClosed,payments,player,preparation,progress,released,shipment,transportClosed,turn')) &&
    positive(promise.turn) && identifier(promise.event) && identifier(promise.player) && identifier(promise.asker),
  'Retain the complete original turn-action commitment and its metadata.');
  let mixed: MixedActionExpression<TurnActionLeaf>;
  try {
    mixed = parseMixedActionExpression(promise.mixed, storedFact, parseTurnActionLeaf, {
      requireFact: false, maxDepth: TURN_ACTION_MAX_DEPTH, maxLeaves: TURN_ACTION_MAX_LEAVES,
    });
  } catch (error) {
    if (error instanceof MixedActionQuestionError) throw new TurnActionError(error.message);
    throw error;
  }
  const originals = new Set<string>();
  const destinations = new Set<string>();
  const recipients = new Set<string>();
  const lots = new Set<number>();
  let hasRevival = false;
  const visit = (node: MixedActionExpression<TurnActionLeaf>): void => {
    if (node.kind === 'action') {
      originals.add(actionKey(node.action));
      if (node.action.kind === 'move') destinations.add(node.action.territory);
      if (node.action.kind === 'payment') recipients.add(node.action.recipient);
      if (node.action.kind === 'bid') lots.add(node.action.lot);
      if (node.action.kind === 'forces' || node.action.kind === 'leader') hasRevival = true;
    } else if (node.kind !== 'fact') node.terms.forEach(visit);
  };
  visit(mixed);
  check(!lots.size || !!promise.preparation?.bid, 'Retain the original private lot binding for every ordinary bid leaf.');
  check(!hasRevival || !!promise.preparation?.revival, 'Retain this answer’s ordinary Revival interval.');
  if ('preparation' in promise) {
    const preparation = promise.preparation;
    check(object(preparation) && keys(preparation, 'bid,revival'), 'Retain only the private native preparation stages.');
    if (preparation.bid !== null) {
      const bid = preparation.bid;
      check(object(bid) && keys(bid, 'closed,lot,maximum,source') && positive(bid.lot) && identifier(bid.source) &&
        whole(bid.maximum) && typeof bid.closed === 'boolean' && [...lots].every(lot => lot === bid.lot),
      'Retain one original ordinary lot, source, actual maximum accepted bid and closure.');
    }
    if (preparation.revival !== null) {
      const revival = preparation.revival;
      check(object(revival) && keys(revival, 'closed,elite,leaders,normal,total') && physical(revival.total) &&
        physical(revival.normal) && physical(revival.elite) && revival.total === revival.normal + revival.elite &&
        Array.isArray(revival.leaders) && revival.leaders.every(identifier) &&
        new Set(revival.leaders).size === revival.leaders.length && typeof revival.closed === 'boolean',
      'Retain typed actual ordinary force returns, unique personal leaders and Revival closure.');
    }
  }
  const compiled = readCompiled(promise.compiled, originals);
  check(typeof promise.answer === 'boolean' && typeof promise.fulfilled === 'boolean' &&
    typeof promise.released === 'boolean' && typeof promise.transportClosed === 'boolean' &&
    typeof promise.paymentClosed === 'boolean' && !(promise.fulfilled && promise.released),
  'Retain a definite whole turn-action answer and lifecycle.');
  check(object(promise.shipment) && keys(promise.shipment, 'event,pending') &&
    typeof promise.shipment.pending === 'boolean' && (!promise.shipment.pending || promise.shipment.event === null) &&
    (!promise.transportClosed || !promise.shipment.pending),
  'Retain this answer’s single pending or received reserve shipment.');
  if (promise.shipment.event !== null) validateEvent(promise.shipment.event);
  check(Array.isArray(promise.progress), 'Retain this answer’s physical ground-movement maxima.');
  const seenDestinations = new Set<string>();
  for (const entry of promise.progress) {
    check(object(entry) && keys(entry, 'maximum,territory') && printedTerritory(entry.territory) &&
      destinations.has(entry.territory) && physical(entry.maximum) && !seenDestinations.has(entry.territory),
    'Retain unique named movement destinations and actual physical group maxima.');
    seenDestinations.add(entry.territory);
  }
  check(Array.isArray(promise.payments), 'Retain this answer’s cumulative ordinary payments.');
  const seenRecipients = new Set<string>();
  for (const payment of promise.payments) {
    check(object(payment) && keys(payment, 'amount,recipient') && identifier(payment.recipient) &&
      recipients.has(payment.recipient) && whole(payment.amount) && !seenRecipients.has(payment.recipient),
    'Retain unique named recipients and safe whole cumulative ordinary payment amounts.');
    seenRecipients.add(payment.recipient);
  }
  return compiled;
}

function actionValue(action: TurnActionLeaf, promise: TurnActionPromise): boolean {
  if (action.kind === 'bid') return (promise.preparation?.bid?.maximum ?? 0) >= action.minimum;
  if (action.kind === 'forces') return (promise.preparation?.revival?.[action.counter] ?? 0) >= action.minimum;
  if (action.kind === 'leader') return promise.preparation?.revival?.leaders.includes(action.leader) ?? false;
  if (action.kind === 'payment') return (promise.payments.find(payment =>
    payment.recipient === action.recipient)?.amount ?? 0) >= action.minimum;
  if (action.kind === 'ship') return promise.shipment.event !== null &&
    promise.shipment.event.territory === action.territory && promise.shipment.event.amount >= action.minimum;
  return (promise.progress.find(entry => entry.territory === action.territory)?.maximum ?? 0) >= action.minimum;
}

function evaluate(node: CompiledMixedAction<TurnActionLeaf>, promise: TurnActionPromise): boolean {
  if (node.kind === 'constant') return node.value;
  if (node.kind === 'action') return actionValue(node.action, promise);
  return node.kind === 'and' ? node.terms.every(term => evaluate(term, promise)) :
    node.terms.some(term => evaluate(term, promise));
}

function actionClosed(action: TurnActionLeaf, promise: TurnActionPromise): boolean {
  if (action.kind === 'bid') return promise.preparation!.bid!.closed;
  if (action.kind === 'forces' || action.kind === 'leader') return promise.preparation!.revival!.closed;
  return action.kind === 'payment' ? promise.paymentClosed : action.kind === 'ship'
    ? !promise.shipment.pending : promise.transportClosed;
}

function relevantClosed(node: CompiledMixedAction<TurnActionLeaf>, promise: TurnActionPromise): boolean {
  if (node.kind === 'constant') return true;
  if (node.kind === 'action') return actionClosed(node.action, promise);
  return node.terms.every(term => relevantClosed(term, promise));
}

/** Uses only this answer interval's actual events and private frozen facts. */
export function turnActionValue(promise: TurnActionPromise): boolean {
  return evaluate(readPromise(promise), promise);
}

/** Whether the original question names payments, including folded alternatives. */
export function turnActionHasPayments(promise: TurnActionPromise): boolean {
  readPromise(promise);
  const visit = (node: MixedActionExpression<TurnActionLeaf>): boolean => node.kind === 'action'
    ? node.action.kind === 'payment' : node.kind !== 'fact' && node.terms.some(visit);
  return visit(promise.mixed);
}

export function liveTurnActionPromises<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number): T[] {
  check(Array.isArray(promises) && identifier(player) && positive(turn),
    'Choose the turn-action respondent and turn.');
  for (const promise of promises) check(object(promise), 'Retain an original turn-action record.');
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function sameAction(left: TurnActionBranchLeaf, right: TurnActionBranchLeaf): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'leader') return right.kind === 'leader' && left.leader === right.leader;
  if (left.kind === 'forces') return right.kind === 'forces' && left.counter === right.counter && left.progress === right.progress;
  if (left.kind === 'bid') return right.kind === 'bid' && left.lot === right.lot && left.source === right.source;
  if (left.kind === 'payment') return right.kind === 'payment' && left.recipient === right.recipient && left.progress === right.progress;
  return (right.kind === 'ship' || right.kind === 'move') && left.territory === right.territory;
}

/** Called within one record only: payment progress belongs to that interval. */
function mergeBranches(left: TurnActionBranchLeaf[], right: TurnActionBranchLeaf[]): TurnActionBranchLeaf[] | null {
  const merged = left.map(leaf => ({ ...leaf }));
  for (const leaf of right) {
    if (leaf.kind === 'leader') {
      const prior = merged.find(other => sameAction(other, leaf));
      if (prior && prior.answer !== leaf.answer) return null;
      if (!prior) merged.push({ ...leaf });
      continue;
    }
    const same = merged.find(other => sameAction(other, leaf) && other.answer === leaf.answer);
    if (same && same.kind !== 'leader') same.minimum = leaf.answer ? Math.max(same.minimum, leaf.minimum) : Math.min(same.minimum, leaf.minimum);
    else merged.push({ ...leaf });
    const yes = merged.find(other => sameAction(other, leaf) && other.answer);
    const no = merged.find(other => sameAction(other, leaf) && !other.answer);
    if (yes && no && yes.kind !== 'leader' && no.kind !== 'leader' && yes.minimum >= no.minimum) return null;
    if (leaf.kind === 'ship' && leaf.answer && merged.some(other =>
      other.kind === 'ship' && other.answer && other.territory !== leaf.territory)) return null;
  }
  return merged;
}

/** Lazy signed DNF; native ledgers retain costs, entitlements and feasibility. */
export function* turnActionBranches(promise: TurnActionPromise): Generator<TurnActionBranchLeaf[]> {
  const compiled = readPromise(promise);
  if (promise.fulfilled || promise.released) { yield []; return; }
  function* alternatives(node: CompiledMixedAction<TurnActionLeaf>, answer: boolean): Generator<TurnActionBranchLeaf[]> {
    if (node.kind === 'constant') { if (node.value === answer) yield []; return; }
    if (node.kind === 'action') {
      const action = node.action;
      const achieved = actionValue(action, promise);
      if (achieved || actionClosed(action, promise)) { if (achieved === answer) yield []; return; }
      if (action.kind === 'bid') yield [{ ...action, source: promise.preparation!.bid!.source, answer }];
      else if (action.kind === 'forces') yield [{ ...action, progress: promise.preparation!.revival![action.counter], answer }];
      else if (action.kind === 'payment') yield [{ ...action, answer,
        progress: promise.payments.find(payment => payment.recipient === action.recipient)?.amount ?? 0 }];
      else yield [{ ...action, answer }];
      return;
    }
    const conjunction = node.kind === 'and' ? answer : !answer;
    if (!conjunction) {
      for (const term of node.terms) yield* alternatives(term, answer);
      return;
    }
    const terms = node.terms;
    function* combine(index: number, prefix: TurnActionBranchLeaf[]): Generator<TurnActionBranchLeaf[]> {
      if (index === terms.length) { yield prefix; return; }
      for (const suffix of alternatives(terms[index], answer)) {
        const merged = mergeBranches(prefix, suffix);
        if (merged) yield* combine(index + 1, merged);
      }
    }
    yield* combine(0, []);
  }
  yield* alternatives(compiled, promise.answer);
}

function settle<T extends TurnActionPromise>(promise: T, update: T): T {
  const compiled = readPromise(update);
  const satisfied = evaluate(compiled, update);
  check(promise.answer || !satisfied, 'This action conflicts with your whole Truthtrance turn-action No answer.');
  return promise.answer && satisfied || !promise.answer && relevantClosed(compiled, update)
    ? { ...update, fulfilled: true } : update;
}

/** Only an actually accepted ordinary declaration counts for its original lot.
 * Repeated declarations retain their largest amount, never their sum or invoice. */
export function recordTurnActionBid<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number, event: TurnActionBid): T[] {
  check(object(event) && keys(event, 'amount,lot,source') && positive(event.lot) && identifier(event.source) && positive(event.amount),
    'Retain the original ordinary lot, private source and positive actual accepted bid.');
  const updates = new Map<T, T>();
  for (const promise of liveTurnActionPromises(promises, player, turn)) {
    readPromise(promise);
    const stage = promise.preparation?.bid;
    if (!stage || stage.closed || stage.source !== event.source || stage.lot !== event.lot || event.amount <= stage.maximum) continue;
    updates.set(promise, settle(promise, { ...promise, preparation: { ...promise.preparation!,
      bid: { ...stage, maximum: event.amount } } }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Close this physical ordinary lot, or one respondent's actual opportunity. */
export function closeTurnActionBidding<T extends TurnActionPromise>(promises: readonly T[], turn: number,
  source: string, player?: string): T[] {
  check(Array.isArray(promises) && positive(turn) && identifier(source) &&
    (player === undefined || identifier(player)), 'Choose the original ordinary lot and optional respondent.');
  for (const promise of promises) check(object(promise), 'Retain an original turn-action record.');
  return promises.map(promise => {
    if (promise.turn !== turn || player !== undefined && promise.player !== player || promise.fulfilled || promise.released) return promise;
    readPromise(promise);
    const stage = promise.preparation?.bid;
    if (!stage || stage.closed || stage.source !== source) return promise;
    return settle(promise, { ...promise, preparation: { ...promise.preparation!, bid: { ...stage, closed: true } } });
  });
}

/** Completed ordinary native returns only. Card/special/foreign returns must
 * not call this hook, and each personal identity is recorded only once. */
export function recordTurnActionRevival<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number, event: RevivalExpressionReturn): T[] {
  check(object(event) && (event.kind === 'forces' && keys(event, 'amount,elite,kind') && physical(event.amount) &&
    physical(event.elite) && event.elite <= event.amount ||
    event.kind === 'leader' && keys(event, 'kind,leader') && identifier(event.leader)),
  'Retain an actual typed ordinary force return or personal leader identity.');
  const updates = new Map<T, T>();
  for (const promise of liveTurnActionPromises(promises, player, turn)) {
    readPromise(promise);
    const stage = promise.preparation?.revival;
    if (!stage || stage.closed || event.kind === 'forces' && event.amount === 0 ||
      event.kind === 'leader' && stage.leaders.includes(event.leader)) continue;
    const revival = event.kind === 'forces' ? { ...stage, total: stage.total + event.amount,
      normal: stage.normal + event.amount - event.elite, elite: stage.elite + event.elite, leaders: [...stage.leaders] } :
      { ...stage, leaders: [...stage.leaders, event.leader] };
    updates.set(promise, settle(promise, { ...promise, preparation: { ...promise.preparation!, revival } }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** The respondent's ordinary Revival stage closes independently of transport. */
export function closeTurnActionRevival<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number): T[] {
  const live = new Set(liveTurnActionPromises(promises, player, turn));
  return promises.map(promise => {
    if (!live.has(promise)) return promise;
    readPromise(promise);
    const stage = promise.preparation?.revival;
    if (!stage || stage.closed) return promise;
    return settle(promise, { ...promise, preparation: { ...promise.preparation!, revival: { ...stage, closed: true } } });
  });
}

/** Exactly one original completed future reserve shipment or actual skip. */
export function recordTurnActionShipment<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number, event: TravelEvent | null): T[] {
  if (event !== null) validateEvent(event);
  const updates = new Map<T, T>();
  for (const promise of liveTurnActionPromises(promises, player, turn)) {
    readPromise(promise);
    if (!promise.shipment.pending) continue;
    updates.set(promise, settle(promise, { ...promise,
      shipment: { pending: false, event: event === null ? null : { ...event } } }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Only an ordinary physical ground group counts, never a shipment or marker. */
export function recordTurnActionMovement<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number, event: TravelEvent): T[] {
  validateEvent(event);
  const updates = new Map<T, T>();
  for (const promise of liveTurnActionPromises(promises, player, turn)) {
    readPromise(promise);
    if (promise.transportClosed || event.amount === 0) continue;
    const named = (node: MixedActionExpression<TurnActionLeaf>): boolean => node.kind === 'action'
      ? node.action.kind === 'move' && node.action.territory === event.territory
      : node.kind !== 'fact' && node.terms.some(named);
    if (!named(promise.mixed)) continue;
    const old = promise.progress.find(entry => entry.territory === event.territory)?.maximum ?? 0;
    if (event.amount <= old) continue;
    const progress = promise.progress.map(entry => ({ ...entry }));
    const entry = progress.find(candidate => candidate.territory === event.territory);
    if (entry) entry.maximum = event.amount;
    else progress.push({ territory: event.territory, maximum: event.amount });
    updates.set(promise, settle(promise, { ...promise, progress }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Call only at the actual completed ordinary payer action, never at receipt. */
export function recordTurnActionPayment<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number, payment: TurnActionPayment): T[] {
  check(object(payment) && keys(payment, 'amount,recipient') && identifier(payment.recipient) && positive(payment.amount),
    'Retain the exact recipient and positive safe whole ordinary payment.');
  const updates = new Map<T, T>();
  for (const promise of liveTurnActionPromises(promises, player, turn)) {
    readPromise(promise);
    if (promise.paymentClosed) continue;
    const named = (node: MixedActionExpression<TurnActionLeaf>): boolean => node.kind === 'action'
      ? node.action.kind === 'payment' && node.action.recipient === payment.recipient
      : node.kind !== 'fact' && node.terms.some(named);
    if (!named(promise.mixed)) continue;
    const old = promise.payments.find(entry => entry.recipient === payment.recipient)?.amount ?? 0;
    const amount = old + payment.amount;
    check(Number.isSafeInteger(amount), 'The cumulative ordinary payment exceeds the safe integer range.');
    const payments = promise.payments.map(entry => ({ ...entry }));
    const entry = payments.find(candidate => candidate.recipient === payment.recipient);
    if (entry) entry.amount = amount;
    else payments.push({ recipient: payment.recipient, amount });
    updates.set(promise, settle(promise, { ...promise, payments }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Close transport only; a later ordinary payment can still complete the tree.
 * The native joint solver, rather than this ledger, rejects own illegal closure. */
export function closeTurnActionTransport<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number): T[] {
  const live = new Set(liveTurnActionPromises(promises, player, turn));
  return promises.map(promise => {
    if (!live.has(promise)) return promise;
    readPromise(promise);
    return settle(promise, { ...promise, transportClosed: true,
      shipment: { ...promise.shipment, pending: false } });
  });
}

/** Actual turn expiry closes every family. The engine owns own-expiry preflight;
 * an externally impossible unsatisfied answer becomes a released terminal row. */
export function finishTurnActionTurn<T extends TurnActionPromise>(promises: readonly T[], player: string,
  turn: number): T[] {
  const live = new Set(liveTurnActionPromises(promises, player, turn));
  return promises.map(promise => {
    if (!live.has(promise)) return promise;
    readPromise(promise);
    const closed = { ...promise, transportClosed: true, paymentClosed: true,
      shipment: { ...promise.shipment, pending: false }, ...(promise.preparation ? { preparation: {
        bid: promise.preparation.bid ? { ...promise.preparation.bid, closed: true } : null,
        revival: promise.preparation.revival ? { ...promise.preparation.revival, closed: true } : null,
      } } : {}) };
    const fulfilled = turnActionValue(closed) === promise.answer;
    return { ...closed, fulfilled, released: !fulfilled };
  });
}

/** Structure/progress only: root retains fact authority, nonally targeting and
 * native payment/force legality. Impossible live Yes routes are not released here. */
export function validateTurnActionPromises(promises: readonly TurnActionPromise[], players: readonly string[]): void {
  check(Array.isArray(promises) && Array.isArray(players), 'Retain the turn-action commitments and participants.');
  const events = new Set<string>();
  for (const promise of promises) {
    const compiled = readPromise(promise);
    const satisfied = evaluate(compiled, promise);
    const allClosed = promise.transportClosed && promise.paymentClosed &&
      (!promise.preparation?.bid || promise.preparation.bid.closed) &&
      (!promise.preparation?.revival || promise.preparation.revival.closed);
    const recipientsValid = (node: MixedActionExpression<TurnActionLeaf>): boolean => node.kind === 'action'
      ? node.action.kind !== 'payment' || players.includes(node.action.recipient) && node.action.recipient !== promise.player
      : node.kind === 'fact' || node.terms.every(recipientsValid);
    check(!events.has(promise.event) && players.includes(promise.player) && players.includes(promise.asker) &&
      promise.player !== promise.asker && recipientsValid(promise.mixed) &&
      (promise.released || (promise.answer || !satisfied) &&
        (!promise.answer || promise.fulfilled === satisfied) &&
        (!promise.fulfilled || satisfied === promise.answer && (promise.answer || relevantClosed(compiled, promise))) &&
        (!allClosed || promise.fulfilled)),
    'The turn-action commitment lost its event, participants or whole-answer progress.');
    events.add(promise.event);
  }
}
