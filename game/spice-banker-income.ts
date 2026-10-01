import { LEADER_SKILL_CARDS } from './leader-skill-cards';
import type { LeaderSkillAssignment, SkillRoster } from './leader-skills';

export type BankerIncomeSourceKind =
  | 'auction'
  | 'shipment'
  | 'force-revival'
  | 'leader-revival'
  | 'kh-revival'
  | 'emperor-extra-revival'
  | 'battle-support';
export type BankerIncomeContext = {
  turn: number;
  phase: number;
  players: SkillRoster;
  assignments: readonly LeaderSkillAssignment[];
};
export type BankerIncomeAuthority = {
  kind: BankerIncomeSourceKind;
  event: string;
  turn: number;
  phase: number;
  /** Only positive, actually paid final BANK legs of this one native payment. */
  bankLegs: { payer: string; amount: number }[];
  trainer: {
    assignment: LeaderSkillAssignment;
    faceUp: boolean;
    captured: boolean;
    selected: boolean;
    resolved: boolean;
    survived: boolean;
  } | null;
};
export type BankerIncomeGrant = { owner: string; amount: 1; stamp: string };
export type BankerIncomeReceipt = {
  cursor: number;
  previous: string;
  source: BankerIncomeAuthority;
  grant: BankerIncomeGrant | null;
  signature: string;
};
export type BankerIncomeCredit = { owner: string; amount: number };
export type BankerIncomeCollectionAuthority = { event: string; turn: number; phase: 8 };
export type BankerIncomeCollection = BankerIncomeCollectionAuthority & {
  cursor: number;
  previous: string;
  grants: number[];
  credits: BankerIncomeCredit[];
  signature: string;
};
export type BankerIncomeState = {
  version: 1;
  seats: string[];
  sources: BankerIncomeReceipt[];
  collections: BankerIncomeCollection[];
  cursor: number;
  head: string;
  signature: string;
};
export class BankerIncomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankerIncomeError';
  }
}
const LIMIT = 50_000;
const sourcePhases: Record<BankerIncomeSourceKind, number> = {
  auction: 3, shipment: 5, 'force-revival': 4, 'leader-revival': 4,
  'kh-revival': 4, 'emperor-extra-revival': 4, 'battle-support': 6,
};
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value;
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const array = (value: unknown): boolean => Array.isArray(value);
function requireIncome(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BankerIncomeError(message);
}
function keys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
/** Fixed-size consistency checksum, not authentication of a rewritten save. */
function signature(value: unknown): string {
  const serialized = JSON.stringify(value);
  let first = 2166136261;
  let second = 3339675911;
  for (let i = 0; i < serialized.length; i++) {
    const code = serialized.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}
const validSignature = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
function sourceFields(source: BankerIncomeAuthority): unknown[] {
  const trainer = source.trainer;
  return [source.kind, source.event, source.turn, source.phase,
    source.bankLegs.map((leg) => [leg.payer, leg.amount]), trainer === null ? null : [
      trainer.assignment.skill, trainer.assignment.leader, trainer.assignment.owner,
      trainer.faceUp, trainer.captured, trainer.selected, trainer.resolved, trainer.survived,
    ]];
}
function receiptSignature(receipt: BankerIncomeReceipt): string {
  return signature(['banker-income-source', receipt.cursor, receipt.previous,
    sourceFields(receipt.source), receipt.grant === null ? null :
      [receipt.grant.owner, receipt.grant.amount, receipt.grant.stamp]]);
}
function collectionSignature(collection: BankerIncomeCollection): string {
  return signature(['banker-income-collection', collection.cursor, collection.previous,
    collection.event, collection.turn, collection.phase, collection.grants,
    collection.credits.map((credit) => [credit.owner, credit.amount])]);
}
function stateSignature(state: BankerIncomeState): string {
  return signature(['banker-income-state', state.version, state.seats,
    state.sources.length, state.collections.length, state.cursor, state.head]);
}
function stamp(turn: number, phase: number): string {
  return JSON.stringify([turn, phase, 'spice-banker']);
}
function validateContext(context: BankerIncomeContext): string[] {
  requireIncome(keys(context, ['turn', 'phase', 'players', 'assignments']) &&
    whole(context.turn) && context.turn > 0 && whole(context.phase) && context.phase <= 8 &&
    array(context.players) && context.players.length >= 2 && context.players.length <= 6 &&
    array(context.assignments), 'Invalid Banker income native context.');
  const seats: string[] = [];
  const leaders = new Set<string>();
  for (const player of context.players) {
    requireIncome(keys(player, ['id', 'leaders']) && text(player.id) && array(player.leaders) &&
      !seats.includes(player.id), 'Invalid Banker income native roster.');
    seats.push(player.id);
    for (const leader of player.leaders) {
      requireIncome(leader && typeof leader === 'object' && !Array.isArray(leader) &&
        Object.keys(leader).every((key) => ['id', 'dead', 'capturedBy', 'gholaBy'].includes(key)) &&
        text(leader.id) && typeof leader.dead === 'boolean' && !leaders.has(leader.id) &&
        (leader.capturedBy === undefined || text(leader.capturedBy)) &&
        (leader.gholaBy === undefined || text(leader.gholaBy)), 'Invalid Banker income native leader.');
      leaders.add(leader.id);
    }
  }
  const skills = new Set<string>();
  const owners = new Set<string>();
  for (const assignment of context.assignments) {
    requireIncome(keys(assignment, ['skill', 'leader', 'owner']) &&
      LEADER_SKILL_CARDS.some((card) => card.id === assignment.skill) &&
      !skills.has(assignment.skill) && !owners.has(assignment.owner) &&
      context.players.some((player) => player.id === assignment.owner &&
        player.leaders.some((leader) => leader.id === assignment.leader)),
    'Invalid Banker income native skill assignment.');
    skills.add(assignment.skill);
    owners.add(assignment.owner);
  }
  return seats.sort();
}
function validateSource(context: BankerIncomeContext, source: BankerIncomeAuthority, current: boolean): void {
  requireIncome(keys(source, ['kind', 'event', 'turn', 'phase', 'bankLegs', 'trainer']) &&
    Object.hasOwn(sourcePhases, source.kind) && text(source.event) &&
    whole(source.turn) && source.turn > 0 && whole(source.phase) &&
    source.phase === sourcePhases[source.kind] &&
    (source.turn < context.turn || (source.turn === context.turn && source.phase <= context.phase)) &&
    (!current || (source.turn === context.turn && source.phase === context.phase)) &&
    array(source.bankLegs) && source.bankLegs.length <= context.players.length,
  'Invalid, unsupported or stale Banker income payment source.');
  const payers = new Set<string>();
  for (const leg of source.bankLegs) {
    requireIncome(keys(leg, ['payer', 'amount']) && text(leg.payer) &&
      context.players.some((player) => player.id === leg.payer) && !payers.has(leg.payer) &&
      whole(leg.amount) && leg.amount > 0, 'Banker income requires distinct actual positive BANK payer legs.');
    payers.add(leg.payer);
  }
  const trainer = source.trainer;
  if (trainer === null) return;
  requireIncome(keys(trainer, ['assignment', 'faceUp', 'captured', 'selected', 'resolved', 'survived']) &&
    keys(trainer.assignment, ['skill', 'leader', 'owner']) &&
    trainer.assignment.skill === 'spice-banker' && text(trainer.assignment.leader) &&
    text(trainer.assignment.owner) &&
    [trainer.faceUp, trainer.captured, trainer.selected, trainer.resolved, trainer.survived]
      .every((value) => typeof value === 'boolean') &&
    (!trainer.selected || (!trainer.faceUp && source.kind === 'battle-support')) &&
    (source.kind === 'battle-support' || (!trainer.selected && trainer.resolved && trainer.survived)),
  'Invalid Banker income trainer posture or resolved survival.');
  const native = context.players.find((player) => player.id === trainer.assignment.owner)
    ?.leaders.find((leader) => leader.id === trainer.assignment.leader);
  requireIncome(native, 'Banker income trainer is not its original native disc.');
  if (current) {
    requireIncome(!native.dead && !!native.capturedBy === trainer.captured &&
      context.assignments.some((assignment) => assignment.skill === 'spice-banker' &&
        assignment.owner === trainer.assignment.owner && assignment.leader === trainer.assignment.leader),
    'Banker income source lacks the actual living native trainer and physical skill.');
  }
}
export function validateBankerIncomeSource(context: BankerIncomeContext, source: BankerIncomeAuthority): void {
  validateContext(context);
  validateSource(context, source, true);
}
function expectedGrant(source: BankerIncomeAuthority, used: ReadonlySet<string>): BankerIncomeGrant | null {
  const trainer = source.trainer;
  const phaseStamp = stamp(source.turn, source.phase);
  if (trainer === null || trainer.captured || !trainer.survived ||
    (source.kind === 'battle-support' && !trainer.resolved) ||
    (!trainer.faceUp && !(trainer.selected && trainer.resolved)) || used.has(phaseStamp) ||
    !source.bankLegs.some((leg) => leg.payer !== trainer.assignment.owner && leg.amount >= 4)) return null;
  return { owner: trainer.assignment.owner, amount: 1, stamp: phaseStamp };
}
function creditsFor(seats: readonly string[], pending: readonly BankerIncomeReceipt[]): BankerIncomeCredit[] {
  return seats.flatMap((owner) => {
    const amount = pending.reduce((total, receipt) => total + (receipt.grant?.owner === owner ? 1 : 0), 0);
    return amount === 0 ? [] : [{ owner, amount }];
  });
}
function sameCredits(left: readonly BankerIncomeCredit[], right: readonly BankerIncomeCredit[]): boolean {
  return left.length === right.length && left.every((credit, index) =>
    keys(credit, ['owner', 'amount']) && credit.owner === right[index].owner && credit.amount === right[index].amount);
}
/** Closed history checks original entitlement, never current life, card custody or wallet. */
export function validateBankerIncomeState(state: BankerIncomeState, context: BankerIncomeContext): void {
  const seats = validateContext(context);
  requireIncome(keys(state, ['version', 'seats', 'sources', 'collections', 'cursor', 'head', 'signature']) &&
    state.version === 1 && array(state.seats) &&
    state.seats.length === seats.length && state.seats.every((seat, index) => seat === seats[index]) &&
    array(state.sources) && array(state.collections) && whole(state.cursor) &&
    state.cursor === state.sources.length + state.collections.length && state.cursor <= LIMIT &&
    validSignature(state.head) && validSignature(state.signature), 'Malformed Banker income history.');
  let head = signature(['banker-income-genesis', seats]);
  let sourceIndex = 0;
  let collectionIndex = 0;
  let lastTurn = 0;
  let lastPhase = 0;
  const events = new Set<string>();
  const used = new Set<string>();
  const collectedTurns = new Set<number>();
  let pending: BankerIncomeReceipt[] = [];
  for (let cursor = 1; cursor <= state.cursor; cursor++) {
    const receipt = state.sources[sourceIndex];
    const collection = state.collections[collectionIndex];
    const isSource = receipt?.cursor === cursor;
    requireIncome(isSource !== (collection?.cursor === cursor), 'Missing or duplicate Banker income history cursor.');
    let event: string;
    let turn: number;
    let phase: number;
    if (isSource) {
      requireIncome(keys(receipt, ['cursor', 'previous', 'source', 'grant', 'signature']) &&
        receipt.previous === head && validSignature(receipt.signature), 'Corrupt Banker income source head.');
      validateSource(context, receipt.source, false);
      const grant = expectedGrant(receipt.source, used);
      requireIncome(grant === null ? receipt.grant === null :
        keys(receipt.grant, ['owner', 'amount', 'stamp']) && receipt.grant.owner === grant.owner &&
        receipt.grant.amount === 1 && receipt.grant.stamp === grant.stamp, 'Corrupt Banker income deferred grant.');
      requireIncome(receipt.signature === receiptSignature(receipt), 'Corrupt Banker income source signature.');
      if (grant !== null) {
        used.add(grant.stamp);
        pending.push(receipt);
      }
      ({ event, turn, phase } = receipt.source);
      head = receipt.signature;
      sourceIndex++;
    } else {
      requireIncome(keys(collection, ['cursor', 'previous', 'event', 'turn', 'phase', 'grants', 'credits', 'signature']) &&
        collection.previous === head && text(collection.event) && whole(collection.turn) && collection.turn > 0 &&
        collection.phase === 8 && !collectedTurns.has(collection.turn) &&
        (collection.turn < context.turn || (collection.turn === context.turn && context.phase === 8)) &&
        Array.isArray(collection.grants) && collection.grants.length === pending.length &&
        collection.grants.every((grant, index) => grant === pending[index].cursor) &&
        Array.isArray(collection.credits) && sameCredits(collection.credits, creditsFor(seats, pending)) &&
        validSignature(collection.signature) && collection.signature === collectionSignature(collection),
      'Corrupt, incomplete or replayed Banker income collection.');
      ({ event, turn, phase } = collection);
      collectedTurns.add(turn);
      pending = [];
      head = collection.signature;
      collectionIndex++;
    }
    requireIncome(!events.has(event) && (turn > lastTurn || (turn === lastTurn && phase >= lastPhase)),
      'Duplicate or out-of-order Banker income native event.');
    events.add(event);
    lastTurn = turn;
    lastPhase = phase;
  }
  requireIncome(head === state.head && sourceIndex === state.sources.length &&
    collectionIndex === state.collections.length && state.signature === stateSignature(state),
  'Corrupt Banker income current head or signature.');
}
export function createBankerIncomeState(context: BankerIncomeContext): BankerIncomeState {
  const seats = validateContext(context);
  const state: BankerIncomeState = {
    version: 1, seats, sources: [], collections: [], cursor: 0,
    head: signature(['banker-income-genesis', seats]), signature: '',
  };
  state.signature = stateSignature(state);
  return state;
}
function requireFreshEvent(state: BankerIncomeState, event: string): void {
  requireIncome(state.cursor < LIMIT && !state.sources.some((receipt) => receipt.source.event === event) &&
    !state.collections.some((collection) => collection.event === event),
  'Banker income native event was already committed or history is full.');
}
export function quoteBankerIncome(state: BankerIncomeState, context: BankerIncomeContext, authority: BankerIncomeAuthority): {
  next: BankerIncomeState; receipt: BankerIncomeReceipt;
} {
  validateBankerIncomeState(state, context);
  validateSource(context, authority, true);
  requireFreshEvent(state, authority.event);
  const used = new Set(state.sources.flatMap((receipt) => receipt.grant === null ? [] : [receipt.grant.stamp]));
  const receipt: BankerIncomeReceipt = {
    cursor: state.cursor + 1, previous: state.head, source: structuredClone(authority),
    grant: expectedGrant(authority, used), signature: '',
  };
  receipt.signature = receiptSignature(receipt);
  const next = structuredClone(state);
  next.sources.push(receipt);
  next.cursor = receipt.cursor;
  next.head = receipt.signature;
  next.signature = stateSignature(next);
  return { next, receipt: structuredClone(receipt) };
}
/** Caller commits this ledger and original native payment/suffix in the same room write. */
export function commitBankerIncome(state: BankerIncomeState, context: BankerIncomeContext,
  authority: BankerIncomeAuthority, receipt: BankerIncomeReceipt): BankerIncomeState {
  const quote = quoteBankerIncome(state, context, authority);
  requireIncome(keys(receipt, ['cursor', 'previous', 'source', 'grant', 'signature']), 'Malformed Banker income receipt.');
  validateSource(context, receipt.source, true);
  requireIncome(receipt.cursor === quote.receipt.cursor && receipt.previous === quote.receipt.previous &&
    (quote.receipt.grant === null ? receipt.grant === null : keys(receipt.grant, ['owner', 'amount', 'stamp']) &&
      receipt.grant.owner === quote.receipt.grant.owner && receipt.grant.amount === 1 &&
      receipt.grant.stamp === quote.receipt.grant.stamp) &&
    receipt.signature === quote.receipt.signature && receipt.signature === receiptSignature(receipt),
  'Banker income receipt is foreign, stale or disagrees with independent native authority.');
  return quote.next;
}
export function quoteBankerIncomeCollection(state: BankerIncomeState, context: BankerIncomeContext,
  authority: BankerIncomeCollectionAuthority): {
    next: BankerIncomeState; collection: BankerIncomeCollection; credits: BankerIncomeCredit[];
  } {
  validateBankerIncomeState(state, context);
  requireIncome(keys(authority, ['event', 'turn', 'phase']) && text(authority.event) &&
    authority.turn === context.turn && authority.phase === 8 && context.phase === 8,
  'Banker income collects only at the actual current native Mentat opening.');
  requireFreshEvent(state, authority.event);
  requireIncome(!state.collections.some((collection) => collection.turn === authority.turn),
    'Banker income already collected at this turn\'s Mentat opening.');
  const collected = new Set(state.collections.flatMap((collection) => collection.grants));
  const pending = state.sources.filter((receipt) => receipt.grant !== null && !collected.has(receipt.cursor));
  const credits = creditsFor(state.seats, pending);
  const collection: BankerIncomeCollection = {
    ...authority, cursor: state.cursor + 1, previous: state.head,
    grants: pending.map((receipt) => receipt.cursor), credits, signature: '',
  };
  collection.signature = collectionSignature(collection);
  const next = structuredClone(state);
  next.collections.push(collection);
  next.cursor = collection.cursor;
  next.head = collection.signature;
  next.signature = stateSignature(next);
  return { next, collection: structuredClone(collection), credits: structuredClone(credits) };
}
export function commitBankerIncomeCollection(state: BankerIncomeState, context: BankerIncomeContext,
  authority: BankerIncomeCollectionAuthority, collection: BankerIncomeCollection): BankerIncomeState {
  const quote = quoteBankerIncomeCollection(state, context, authority);
  requireIncome(keys(collection, ['cursor', 'previous', 'event', 'turn', 'phase', 'grants', 'credits', 'signature']) &&
    collection.cursor === quote.collection.cursor && collection.previous === quote.collection.previous &&
    collection.event === authority.event && collection.turn === authority.turn && collection.phase === 8 &&
    Array.isArray(collection.grants) && collection.grants.length === quote.collection.grants.length &&
    collection.grants.every((grant, index) => grant === quote.collection.grants[index]) &&
    Array.isArray(collection.credits) && sameCredits(collection.credits, quote.credits) &&
    collection.signature === quote.collection.signature && collection.signature === collectionSignature(collection),
  'Banker income collection is foreign, stale, incomplete or corrupt.');
  return quote.next;
}
export function projectBankerIncome(state: BankerIncomeState, context: BankerIncomeContext): {
  deferred: BankerIncomeCredit[]; usedThisPhase: string[];
} {
  validateBankerIncomeState(state, context);
  const collected = new Set(state.collections.flatMap((collection) => collection.grants));
  const pending = state.sources.filter((receipt) => receipt.grant !== null && !collected.has(receipt.cursor));
  return {
    deferred: creditsFor(state.seats, pending),
    usedThisPhase: state.sources.flatMap((receipt) =>
      receipt.grant?.stamp === stamp(context.turn, context.phase) ? [receipt.grant.owner] : []),
  };
}
