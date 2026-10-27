import { TERRITORIES, validLocation } from './board';
import {
  parseMixedActionExpression,
  type CompiledMixedAction,
  type MixedActionExpression,
} from './mixed-action-question';
import { MovementClaimError, parseMovementClaim } from './movement-promises';
import { parseShipmentClaim, ShipmentClaimError } from './shipment-promises';
import type { TruthFact } from './truthtrance';

export const TRAVEL_MAX_DEPTH = 4;
export const TRAVEL_MAX_LEAVES = 16;

/** Shipment leaves all describe one original future reserve-shipment event. */
export type TravelActionClaim = { kind: 'ship' | 'move'; territory: string; minimum: number; sector?: number };
export type TravelClaim = { turn: number; mixed: MixedActionExpression<TravelActionClaim> };
export type TravelEvent = { territory: string; amount: number; sector?: number };
export type MovementSectorProgress = { territory: string; sector: number; maximum: number };
export type TravelBranchLeaf = TravelActionClaim & { answer: boolean };
export type TravelPromise = TravelClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  /** Private residual: facts are frozen at this answer, never reevaluated. */
  compiled: CompiledMixedAction<TravelActionClaim>;
  shipment: { pending: boolean; event: TravelEvent | null };
  /** Largest actual physical ground group per destination after this answer. */
  progress: { territory: string; maximum: number }[];
  /** Present only for original questions naming a specific movement sector. */
  sectorProgress?: MovementSectorProgress[];
  movementClosed: boolean;
  fulfilled: boolean;
  released: boolean;
};

export class TravelPromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelPromiseError';
  }
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new TravelPromiseError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const keys = (value: Record<string, unknown>, expected: string): boolean =>
  Object.keys(value).sort().join(',') === expected;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const turnNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const physical = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 20;
const printedTerritory = (value: unknown): value is string =>
  typeof value === 'string' && TERRITORIES.some(destination => destination.id === value);

/** An optional printed sector names the actual reserve shipment or ground arrival. */
export function parseTravelActionClaim(value: unknown): TravelActionClaim {
  check(object(value) && (keys(value, 'kind,minimum,territory') ||
    keys(value, 'kind,minimum,sector,territory')) &&
    (value.kind === 'ship' || value.kind === 'move'),
  'Choose one reserve shipment or physical ground movement, with its minimum and printed destination.');
  if ('sector' in value) check(printedTerritory(value.territory) &&
    typeof value.sector === 'number' && Number.isSafeInteger(value.sector) &&
    TERRITORIES.find(destination => destination.id === value.territory)!.sectors.includes(value.sector),
  'Choose an actual printed sector in the destination.');
  try {
    const claim = value.kind === 'ship' ? parseShipmentClaim(value) : parseMovementClaim(value);
    // parseShipmentClaim receives a flat leaf above, never its expression form.
    return { kind: value.kind, territory: claim.territory!, minimum: claim.minimum!,
      ...('sector' in value ? { sector: value.sector as number } : {}) };
  } catch (error) {
    if (error instanceof ShipmentClaimError || error instanceof MovementClaimError)
      throw new TravelPromiseError(error.message);
    throw error;
  }
}

/** Fact source authority remains with Truthtrance's game-aware fact decoder.
 * Here the raw tree is retained and bounded, without reading private answers. */
function storedFact(value: unknown, depth = 0): TruthFact {
  check(object(value) && identifier(value.kind) && depth <= TRAVEL_MAX_DEPTH &&
    value.kind !== 'constant' && value.kind !== 'action' && value.kind !== 'fact',
  'Retain the original current-fact statement.');
  if (value.kind === 'and' || value.kind === 'or') {
    check(keys(value, 'kind,terms') && Array.isArray(value.terms) &&
      value.terms.length >= 2 && value.terms.length <= TRAVEL_MAX_LEAVES,
    'Retain a bounded original current-fact group.');
    return { kind: value.kind, terms: value.terms.map(term => storedFact(term, depth + 1)) };
  }
  return value as unknown as TruthFact;
}

/** New-only ledger initializer. The original expression is inspected, not a
 * compiled branch, because frozen facts can fold an originally named sector. */
export function needsMovementSectorProgress(node: unknown): boolean {
  if (!object(node)) return false;
  if (node.kind === 'action') return object(node.action) && node.action.kind === 'move' &&
    Object.hasOwn(node.action, 'sector');
  return (node.kind === 'and' || node.kind === 'or') && Array.isArray(node.terms) &&
    node.terms.some(needsMovementSectorProgress);
}

function actionKey(action: TravelActionClaim): string {
  return `${action.kind}:${action.territory}:${action.minimum}${action.sector === undefined ? '' : `:sector:${action.sector}`}`;
}

function readCompiled(value: unknown, originals: ReadonlySet<string>): CompiledMixedAction<TravelActionClaim> {
  let leaves = 0;
  const read = (input: unknown, depth: number): CompiledMixedAction<TravelActionClaim> => {
    check(object(input) && depth <= TRAVEL_MAX_DEPTH,
      'Retain the bounded private answer-time travel expression.');
    if (input.kind === 'and' || input.kind === 'or') {
      check(keys(input, 'kind,terms') && Array.isArray(input.terms) && input.terms.length >= 2 &&
        input.terms.length <= TRAVEL_MAX_LEAVES,
      'Retain the private answer-time AND/OR travel groups.');
      return { kind: input.kind, terms: input.terms.map(term => read(term, depth + 1)) };
    }
    check(++leaves <= TRAVEL_MAX_LEAVES, 'Retain at most sixteen private travel clauses.');
    if (input.kind === 'constant') {
      check(keys(input, 'kind,value') && typeof input.value === 'boolean',
        'Retain a definite private frozen fact answer.');
      return { kind: 'constant', value: input.value };
    }
    check(input.kind === 'action' && keys(input, 'action,kind'),
      'Retain a private frozen fact or original travel action.');
    const action = parseTravelActionClaim(input.action);
    check(originals.has(actionKey(action)), 'A private travel clause must come from the original question.');
    return { kind: 'action', action };
  };
  return read(value, 0);
}

function validateEvent(event: unknown): asserts event is TravelEvent {
  // Events are native physical arrivals, which may be at the mobile
  // stronghold or a revealed Discovery. Question claims remain printed-only;
  // the engine independently validates that a dynamic site actually exists.
  check(object(event) && (keys(event, 'amount,territory') || keys(event, 'amount,sector,territory')) &&
    typeof event.territory === 'string' && physical(event.amount) &&
    ('sector' in event ? typeof event.sector === 'number' && Number.isSafeInteger(event.sector) &&
      validLocation(event.territory, event.sector) :
      printedTerritory(event.territory) || validLocation(event.territory, 0)),
    'Retain a structurally valid destination, any actual sector and zero to twenty physical forces.');
}

function readPromise(promise: TravelPromise): CompiledMixedAction<TravelActionClaim> {
  check(object(promise) && turnNumber(promise.turn), 'Retain the travel commitment and its current turn.');
  const mixed = parseMixedActionExpression(promise.mixed, storedFact, parseTravelActionClaim, { requireFact: false });
  const originals = new Set<string>();
  const destinations = new Set<string>();
  const sectorDestinations = new Set<string>();
  const visit = (node: MixedActionExpression<TravelActionClaim>): void => {
    if (node.kind === 'action') {
      originals.add(actionKey(node.action));
      if (node.action.kind === 'move') {
        destinations.add(node.action.territory);
        if (node.action.sector !== undefined) sectorDestinations.add(JSON.stringify([node.action.territory, node.action.sector]));
      }
    } else if (node.kind !== 'fact') node.terms.forEach(visit);
  };
  visit(mixed);
  const compiled = readCompiled(promise.compiled, originals);
  check(typeof promise.answer === 'boolean' && typeof promise.fulfilled === 'boolean' &&
    typeof promise.released === 'boolean' && typeof promise.movementClosed === 'boolean' &&
    !(promise.fulfilled && promise.released),
  'Retain a definite whole travel answer and lifecycle.');
  check(object(promise.shipment) && keys(promise.shipment, 'event,pending') &&
    typeof promise.shipment.pending === 'boolean' &&
    (!promise.shipment.pending || promise.shipment.event === null) &&
    (!promise.movementClosed || !promise.shipment.pending),
  'Retain this answer’s single pending or received reserve shipment.');
  if (promise.shipment.event !== null) validateEvent(promise.shipment.event);
  check(Array.isArray(promise.progress), 'Retain this answer’s physical ground-movement maxima.');
  const seen = new Set<string>();
  for (const entry of promise.progress) {
    check(object(entry) && keys(entry, 'maximum,territory') && printedTerritory(entry.territory) &&
      destinations.has(entry.territory) && physical(entry.maximum) && !seen.has(entry.territory),
    'Retain unique named movement destinations and actual physical group maxima.');
    seen.add(entry.territory);
  }
  check(sectorDestinations.size ? Array.isArray(promise.sectorProgress) : !('sectorProgress' in promise),
    'Retain per-sector movement maxima only for original sector-qualified questions.');
  const seenSectors = new Set<string>();
  for (const entry of promise.sectorProgress ?? []) {
    const key = object(entry) ? JSON.stringify([entry.territory, entry.sector]) : '';
    check(object(entry) && keys(entry, 'maximum,sector,territory') && sectorDestinations.has(key) &&
      physical(entry.maximum) && !seenSectors.has(key) &&
      (promise.progress.find(row => row.territory === entry.territory)?.maximum ?? 0) >= entry.maximum,
    'Retain unique named physical sector maxima under the actual territory maximum.');
    seenSectors.add(key);
  }
  return compiled;
}

function actionValue(action: TravelActionClaim, promise: TravelPromise): boolean {
  if (action.kind === 'ship') return promise.shipment.event !== null &&
    promise.shipment.event.territory === action.territory && promise.shipment.event.amount >= action.minimum &&
    (action.sector === undefined || promise.shipment.event.sector === action.sector);
  return ((action.sector === undefined
    ? promise.progress.find(entry => entry.territory === action.territory)?.maximum
    : promise.sectorProgress?.find(entry => entry.territory === action.territory && entry.sector === action.sector)?.maximum
  ) ?? 0) >= action.minimum;
}

function evaluate(node: CompiledMixedAction<TravelActionClaim>, promise: TravelPromise): boolean {
  if (node.kind === 'constant') return node.value;
  if (node.kind === 'action') return actionValue(node.action, promise);
  return node.kind === 'and' ? node.terms.every(term => evaluate(term, promise)) :
    node.terms.some(term => evaluate(term, promise));
}

/** Current value uses this record's actual future events, never projected sums. */
export function travelPromiseValue(promise: TravelPromise): boolean {
  return evaluate(readPromise(promise), promise);
}

export function liveTravelPromises<T extends TravelPromise>(promises: readonly T[], player: string, turn: number): T[] {
  check(Array.isArray(promises) && promises.every((promise): boolean => object(promise)) && identifier(player) && turnNumber(turn),
    'Choose the travel respondent and turn.');
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function mergeBranches(left: TravelBranchLeaf[], right: TravelBranchLeaf[]): TravelBranchLeaf[] | null {
  const merged = left.map(leaf => ({ ...leaf }));
  for (const leaf of right) {
    const same = merged.find(other => other.kind === leaf.kind && other.territory === leaf.territory &&
      other.sector === leaf.sector && other.answer === leaf.answer);
    if (same) same.minimum = leaf.answer ? Math.max(same.minimum, leaf.minimum) : Math.min(same.minimum, leaf.minimum);
    else merged.push({ ...leaf });
    // A No rules out a Yes only when every location satisfying the Yes also
    // satisfies that No. A territory-wide Yes may use another legal sector.
    for (const yes of merged.filter(other => other.kind === leaf.kind && other.territory === leaf.territory && other.answer))
      for (const no of merged.filter(other => other.kind === leaf.kind && other.territory === leaf.territory && !other.answer))
        if (yes.minimum >= no.minimum && (no.sector === undefined || yes.sector === no.sector)) return null;
    // Every positive shipment leaf describes the same one physical shipment.
    if (leaf.kind === 'ship' && leaf.answer && merged.some(other =>
      other.kind === 'ship' && other.answer && (other.territory !== leaf.territory ||
        other.sector !== undefined && leaf.sector !== undefined && other.sector !== leaf.sector))) return null;
  }
  return merged;
}

/** Lazy signed DNF. A whole No negates the whole tree; no branch is selected
 * at answer time. Native quotes still decide physical feasibility and routes. */
export function* travelBranches(promise: TravelPromise): Generator<TravelBranchLeaf[]> {
  const compiled = readPromise(promise);
  if (promise.fulfilled || promise.released) { yield []; return; }
  function* alternatives(node: CompiledMixedAction<TravelActionClaim>, answer: boolean): Generator<TravelBranchLeaf[]> {
    if (node.kind === 'constant') { if (node.value === answer) yield []; return; }
    if (node.kind === 'action') {
      const achieved = actionValue(node.action, promise);
      const closed = node.action.kind === 'ship' ? !promise.shipment.pending : promise.movementClosed;
      if (achieved || closed) { if (achieved === answer) yield []; return; }
      yield [{ ...node.action, answer }];
      return;
    }
    const conjunction = node.kind === 'and' ? answer : !answer;
    if (!conjunction) {
      for (const term of node.terms) yield* alternatives(term, answer);
      return;
    }
    const terms = node.terms;
    function* combine(index: number, prefix: TravelBranchLeaf[]): Generator<TravelBranchLeaf[]> {
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

function settle<T extends TravelPromise>(promise: T, update: T): T {
  const satisfied = travelPromiseValue(update);
  check(promise.answer || !satisfied, 'This travel action conflicts with your whole Truthtrance travel No answer.');
  return promise.answer && satisfied ? { ...update, fulfilled: true } : update;
}

/** Call once for the completed ordinary reserve shipment, or its actual skip.
 * A later answer starts with pending=false and never receives an older event. */
export function recordTravelShipment<T extends TravelPromise>(promises: readonly T[], player: string, turn: number,
  event: TravelEvent | null): T[] {
  if (event !== null) validateEvent(event);
  const live = liveTravelPromises(promises, player, turn);
  const updates = new Map<T, T>();
  for (const promise of live) {
    readPromise(promise);
    if (!promise.shipment.pending) continue;
    const namesSector = (node: MixedActionExpression<TravelActionClaim>): boolean => node.kind === 'action'
      ? node.action.kind === 'ship' && node.action.sector !== undefined
      : node.kind !== 'fact' && node.terms.some(namesSector);
    // Only a sector-aware question receives the new receipt field. Original
    // sectorless records keep their original serialized event shape.
    const receipt = event === null ? null : { territory: event.territory, amount: event.amount,
      ...(event.sector !== undefined && namesSector(promise.mixed) ? { sector: event.sector } : {}) };
    updates.set(promise, settle(promise, { ...promise, shipment: { pending: false, event: receipt } }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Call only for an actual ordinary physical ground group. Several smaller
 * groups never combine into one minimum; markers and shipments do not count. */
export function recordTravelMovement<T extends TravelPromise>(promises: readonly T[], player: string, turn: number,
  event: TravelEvent): T[] {
  validateEvent(event);
  const updates = new Map<T, T>();
  for (const promise of liveTravelPromises(promises, player, turn)) {
    readPromise(promise);
    if (promise.movementClosed || event.amount === 0) continue;
    let named = false;
    const visit = (node: MixedActionExpression<TravelActionClaim>): void => {
      if (node.kind === 'action') named ||= node.action.kind === 'move' && node.action.territory === event.territory;
      else if (node.kind !== 'fact') node.terms.forEach(visit);
    };
    visit(promise.mixed);
    if (!named) continue;
    const old = promise.progress.find(entry => entry.territory === event.territory)?.maximum ?? 0;
    const namesSector = (node: MixedActionExpression<TravelActionClaim>): boolean => node.kind === 'action'
      ? node.action.kind === 'move' && node.action.territory === event.territory && node.action.sector === event.sector && event.sector !== undefined
      : node.kind !== 'fact' && node.terms.some(namesSector);
    const sectorNamed = event.sector !== undefined && namesSector(promise.mixed);
    const oldSector = sectorNamed ? promise.sectorProgress!.find(entry => entry.territory === event.territory &&
      entry.sector === event.sector)?.maximum ?? 0 : 0;
    if (event.amount <= old && (!sectorNamed || event.amount <= oldSector)) continue;
    const progress = promise.progress.map(entry => ({ ...entry }));
    if (event.amount > old) {
      const entry = progress.find(candidate => candidate.territory === event.territory);
      if (entry) entry.maximum = event.amount;
      else progress.push({ territory: event.territory, maximum: event.amount });
    }
    let sectorProgress = promise.sectorProgress;
    if (sectorNamed && event.amount > oldSector) {
      sectorProgress = promise.sectorProgress!.map(entry => ({ ...entry }));
      const entry = sectorProgress.find(candidate => candidate.territory === event.territory && candidate.sector === event.sector);
      if (entry) entry.maximum = event.amount;
      else sectorProgress.push({ territory: event.territory, sector: event.sector!, maximum: event.amount });
    }
    updates.set(promise, settle(promise, { ...promise, progress,
      ...(sectorProgress ? { sectorProgress } : {}) }));
  }
  return promises.map(promise => updates.get(promise) ?? promise);
}

/** Close this actual respondent's travel turn. Ending cannot evade a Yes. */
export function finishTravelTurn<T extends TravelPromise>(promises: readonly T[], player: string, turn: number): T[] {
  liveTravelPromises(promises, player, turn);
  return promises.map(promise => {
    if (promise.player !== player || promise.turn !== turn) return promise;
    readPromise(promise);
    const closed = { ...promise, movementClosed: true, shipment: { ...promise.shipment, pending: false } };
    check(promise.released || travelPromiseValue(closed) === promise.answer,
      'Complete your whole Truthtrance travel Yes answer before ending movement.');
    return { ...closed, fulfilled: !promise.released };
  });
}

/** Validate stored structure/progress; game-aware raw fact authority and native
 * movement/shipment legality remain the integrating engine's responsibility. */
export function validateTravelPromises(promises: readonly TravelPromise[], players: readonly string[]): void {
  check(Array.isArray(promises) && Array.isArray(players), 'Retain the travel commitment records and participants.');
  const events = new Set<string>();
  for (const promise of promises) {
    const compiled = readPromise(promise);
    const satisfied = evaluate(compiled, promise);
    check(identifier(promise.event) && !events.has(promise.event) && identifier(promise.player) && identifier(promise.asker) &&
      players.includes(promise.player) && players.includes(promise.asker) && promise.player !== promise.asker &&
      (promise.released || (promise.answer || !satisfied) &&
        (!promise.answer || promise.fulfilled === satisfied) &&
        (!promise.fulfilled || satisfied === promise.answer) &&
        (!promise.movementClosed || promise.fulfilled)),
    'The travel commitment lost its event, participants or whole-answer progress.');
    events.add(promise.event);
  }
}
