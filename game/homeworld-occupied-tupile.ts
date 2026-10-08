import { nativeHandLimit } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { validateHomeworldOccupationHistory } from './homeworld-occupation-history';
import {
  quoteStableHomeworldOccupation,
  type StableHomeworldOccupationContext,
} from './homeworld-stable-occupation';

export type OccupiedTupileContext = StableHomeworldOccupationContext & {
  homeworldTupilePreview?: true;
};
export type OccupiedTupileSource = Readonly<{
  world: 'homeworld:choam';
  card: 'tupile';
  native: string;
  occupier: string;
  qualification: string;
  /** The original observation, not a current garrison or substitute provider. */
  signature: string;
}>;
export type OccupiedTupileCapacity = Readonly<{
  player: string;
  normal: number;
  occupied: number;
}>;
export type OccupiedTupileAuthority = Readonly<{
  status: 'occupied' | 'unoccupied' | 'unknown';
  provider: string | null;
  source: OccupiedTupileSource | null;
  holders: readonly string[];
  capacities: readonly OccupiedTupileCapacity[];
  /** This gates NEW low-threshold intelligence only, never historical knowledge
   * or the original once-per-faction usage receipts. */
  lowIntelligence: 'available' | 'suppressed' | 'unknown';
  blocked: string | null;
}>;
export type OccupiedTupileLease = Readonly<{
  id: number;
  source: OccupiedTupileSource;
  holders: readonly string[];
  turn: number;
  /** null while current; the immutable removed holders when this lease closes. */
  lost: readonly string[] | null;
}>;
export type OccupiedTupileCleanup = Readonly<{
  event: string;
  lease: number;
  player: string;
  status: 'pending' | 'completed';
}>;
export type OccupiedTupileState = Readonly<{
  version: 1;
  leases: readonly OccupiedTupileLease[];
  current: number | null;
  cleanups: readonly OccupiedTupileCleanup[];
  signature: string;
}>;
export type OccupiedTupileSync = Readonly<{
  state: OccupiedTupileState;
  authority: OccupiedTupileAuthority;
  lease: OccupiedTupileLease | null;
  /** Only these IDs may back Player.tupileHandSlot. A new lease cannot bypass
   * an outstanding original normal-limit cleanup of the same player. */
  slotHolders: readonly string[];
  pending: readonly OccupiedTupileCleanup[];
}>;
export type OccupiedTupileCleanupQuote = Readonly<{
  receipt: OccupiedTupileCleanup;
  source: OccupiedTupileSource;
  limit: number;
  excess: number;
  blocked: string | null;
}>;

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const whole = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function requireTupile(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCustodyError(`Occupied Tupile: ${message}`);
}
function keys(value: unknown, expected: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function sourceCopy(source: OccupiedTupileSource): OccupiedTupileSource {
  return Object.freeze({ world: source.world, card: source.card, native: source.native,
    occupier: source.occupier, qualification: source.qualification, signature: source.signature });
}
function sameSource(a: OccupiedTupileSource, b: OccupiedTupileSource): boolean {
  return a.world === b.world && a.card === b.card && a.native === b.native && a.occupier === b.occupier &&
    a.qualification === b.qualification && a.signature === b.signature;
}
const sameHolders = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);
const cleanupEvent = (lease: OccupiedTupileLease, player: string) =>
  JSON.stringify(['homeworldTupileCleanup', lease.id, lease.source.qualification, player]);

/** Printed original Tupile occupied face (homeworld-cards.ts): one slot EACH,
 * never one per army, and loss of CHOAM's low advantage. Stable history owns all
 * Basic ruling gates and the authorized Advanced retained-occupation lifecycle.
 * The extra preview marker is original fresh-entry-only, not a public option. */
export function quoteOccupiedTupileAuthority(game: OccupiedTupileContext): OccupiedTupileAuthority {
  const native = game.players.find(player => player.faction === 'choam');
  const base = { provider: native?.id ?? null, source: null, holders: Object.freeze([]) as readonly string[],
    capacities: Object.freeze([]) as readonly OccupiedTupileCapacity[] };
  const none: OccupiedTupileAuthority = Object.freeze({ ...base, status: 'unoccupied',
    lowIntelligence: 'available', blocked: null });
  if (!game.homeworldTupilePreview || !native) return none;
  if (!game.homeworldOccupationPreview) return Object.freeze({ ...base, status: 'unknown',
    lowIntelligence: 'unknown', blocked: 'Tupile slots require the original fresh occupation profile.' });
  const quote = quoteStableHomeworldOccupation(game, 'tupile', { basic: 'epoch' });
  const entitlement = quote.entitlement;
  const blocked = quote.blocked ?? (entitlement?.ally === native.id
    ? 'The native CHOAM cannot ally with its own Homeworld occupier.' : null);
  if (blocked) return Object.freeze({ ...base, status: 'unknown', lowIntelligence: 'unknown', blocked });
  if (!entitlement) return none;
  const original = game.homeworldOccupationHistory!.sources.find(source => source.event === entitlement.qualification);
  requireTupile(original && original.cause !== 'setup', 'the original qualification source is missing.');
  const source = sourceCopy({ world: 'homeworld:choam', card: 'tupile', native: native.id,
    occupier: entitlement.occupier, qualification: entitlement.qualification, signature: original.signature });
  const holders = Object.freeze([entitlement.occupier, ...(entitlement.ally ? [entitlement.ally] : [])]);
  const capacities = Object.freeze(holders.map(id => {
    const normal = nativeHandLimit(game.players.find(player => player.id === id)!);
    return Object.freeze({ player: id, normal, occupied: normal + 1 });
  }));
  return Object.freeze({ provider: native.id, source, holders, capacities, status: 'occupied',
    lowIntelligence: 'suppressed', blocked: null });
}

function stateWith(leases: readonly OccupiedTupileLease[], current: number | null,
  cleanups: readonly OccupiedTupileCleanup[]): OccupiedTupileState {
  return Object.freeze({ version: 1, leases: Object.freeze(leases), current, cleanups: Object.freeze(cleanups),
    signature: JSON.stringify([1, leases, current, cleanups]) });
}
export function createOccupiedTupileState(): OccupiedTupileState { return stateWith([], null, []); }

/** Original historical epochs, independently of today's force population. A
 * retained Advanced epoch does not restart at native-high, contest or turn change.
 * Sources remain in history after departure; no private knowledge is erased. */
function originalEpochs(game: OccupiedTupileContext): Map<string, OccupiedTupileSource> {
  const history = game.homeworldOccupationHistory, native = game.players.find(player => player.faction === 'choam');
  requireTupile(history && native && game.homeworlds?.historyVersion === 1,
    'saved leases require their original fresh occupation history and native provider.');
  validateHomeworldOccupationHistory(history, homeworldContext(game), game.turn);
  const epochs = new Map<string, OccupiedTupileSource>();
  let retained: string | null = null;
  for (const observation of history.sources) {
    const snapshot = JSON.parse(history.snapshots[observation.snapshot]) as [string, [string, number, number][]][];
    const row = snapshot.find(([world]) => world === 'homeworld:choam');
    requireTupile(row, 'the original Tupile world is missing from history.');
    const present = row[1].filter(([, normal, elite]) => normal + elite > 0);
    if (retained && !present.some(([id]) => id === retained)) retained = null;
    const candidate = observation.cause !== 'setup' && present.length === 1 && present[0][0] !== native.id
      ? present[0][0] : null;
    if (game.advanced ? !retained && candidate !== null : history.qualifications.some(fact =>
      fact.world === 'homeworld:choam' && fact.event === observation.event)) {
      const occupier = game.advanced ? candidate! : history.qualifications.find(fact =>
        fact.world === 'homeworld:choam' && fact.event === observation.event)!.player;
      epochs.set(observation.event, sourceCopy({ world: 'homeworld:choam', card: 'tupile', native: native.id,
        occupier, qualification: observation.event, signature: observation.signature }));
      if (game.advanced) retained = occupier;
    }
  }
  return epochs;
}

/** Strict JSON ledger validation. Frozen ally grants cannot be rewritten to a
 * current ally, and a closed original epoch cannot be resurrected as a new one. */
export function validateOccupiedTupileState(state: OccupiedTupileState, game: OccupiedTupileContext): void {
  requireTupile(keys(state, ['version', 'leases', 'current', 'cleanups', 'signature']) && state.version === 1 &&
    Array.isArray(state.leases) && Array.isArray(state.cleanups) && typeof state.signature === 'string' &&
    (state.current === null || whole(state.current)), 'invalid persisted lease ledger.');
  const epochs = state.leases.length > 0 ? originalEpochs(game) : null;
  requireTupile(state.current === null || state.current === state.leases.length - 1, 'current lease must be the latest original grant.');
  const expected: { event: string; lease: number; player: string }[] = [];
  for (let index = 0; index < state.leases.length; index++) {
    const lease = state.leases[index];
    requireTupile(keys(lease, ['id', 'source', 'holders', 'turn', 'lost']) && lease.id === index &&
      whole(lease.turn) && lease.turn > 0 && lease.turn <= game.turn && Array.isArray(lease.holders) &&
      lease.holders.length >= 1 && lease.holders.length <= 2 && new Set(lease.holders).size === lease.holders.length &&
      keys(lease.source, ['world', 'card', 'native', 'occupier', 'qualification', 'signature']) &&
      text(lease.source.qualification) && text(lease.source.signature), 'invalid frozen original grant.');
    const observation = game.homeworldOccupationHistory!.sources.find(row => row.event === lease.source.qualification);
    requireTupile(observation && observation.turn <= lease.turn, 'grant predates its original qualification source.');
    const original = epochs!.get(lease.source.qualification);
    requireTupile(original && sameSource(original, lease.source) && lease.holders[0] === original.occupier &&
      lease.holders.every((id: string) => game.players.some(player => player.id === id && player.id !== original.native)),
    'grant lost its original source, provider or beneficiary.');
    if (index > 0) {
      const previous = state.leases[index - 1];
      requireTupile(lease.turn >= previous.turn && !(sameSource(previous.source, lease.source) &&
        sameHolders(previous.holders, lease.holders)), 'duplicate or out-of-order original grant.');
      if (!sameSource(previous.source, lease.source)) {
        const sources = game.homeworldOccupationHistory!.sources;
        requireTupile(sources.findIndex(row => row.event === previous.source.qualification) <
          sources.findIndex(row => row.event === lease.source.qualification) &&
          !state.leases.slice(0, index).some(prior => sameSource(prior.source, lease.source)),
        'closed or earlier original epoch was resurrected.');
      }
    }
    if (state.current === index) requireTupile(lease.lost === null, 'current grant was already closed.');
    else {
      const next = state.leases[index + 1];
      requireTupile(!next || keys(next, ['id', 'source', 'holders', 'turn', 'lost']) &&
        keys(next.source, ['world', 'card', 'native', 'occupier', 'qualification', 'signature']) &&
        Array.isArray(next.holders), 'invalid following original grant.');
      const lost = next && sameSource(lease.source, next.source)
        ? lease.holders.filter((id: string) => !next.holders.includes(id)) : lease.holders;
      requireTupile(Array.isArray(lease.lost) && sameHolders(lease.lost, lost), 'closed grant changed its original lost holders.');
      for (const player of lost) expected.push({ event: cleanupEvent(lease, player), lease: index, player });
    }
  }
  requireTupile(state.cleanups.length === expected.length, 'cleanup epochs do not cover exactly the original lost grants.');
  for (let index = 0; index < expected.length; index++) {
    const row = state.cleanups[index], original = expected[index];
    requireTupile(keys(row, ['event', 'lease', 'player', 'status']) && row.event === original.event &&
      row.lease === original.lease && row.player === original.player &&
      (row.status === 'pending' || row.status === 'completed'), 'invalid original cleanup receipt.');
  }
  requireTupile(state.signature === JSON.stringify([1, state.leases, state.current, state.cleanups]), 'saved lease ledger changed.');
}

function syncResult(state: OccupiedTupileState, authority: OccupiedTupileAuthority): OccupiedTupileSync {
  const lease = state.current === null ? null : state.leases[state.current];
  const pending = Object.freeze(state.cleanups.filter(row => row.status === 'pending'));
  const slotHolders = Object.freeze(authority.status === 'occupied' && lease && authority.source &&
    sameSource(lease.source, authority.source) && sameHolders(lease.holders, authority.holders)
    ? lease.holders.filter(id => !pending.some(row => row.player === id)) : []);
  return Object.freeze({ state, authority, lease, slotHolders, pending });
}

/** Persist next state and backing flags atomically at the original occupation
 * observation / reciprocal-alliance boundary. Repeated view/sync is idempotent.
 * Unknown Basic expiry cannot invent departure, cleanup or a new beneficiary.
 * No card/spice draw occurs here. Parent owns control-suffix suspension/restoration. */
export function syncOccupiedTupileLease(game: OccupiedTupileContext, state: OccupiedTupileState): OccupiedTupileSync {
  validateOccupiedTupileState(state, game);
  const authority = quoteOccupiedTupileAuthority(game);
  if (authority.status === 'unknown' || !game.homeworldTupilePreview) return syncResult(state, authority);
  const current = state.current === null ? null : state.leases[state.current];
  if (current && authority.source && sameSource(current.source, authority.source) &&
    sameHolders(current.holders, authority.holders) || !current && !authority.source) return syncResult(state, authority);
  if (authority.source && (!current || !sameSource(current.source, authority.source))) requireTupile(
    !state.leases.some(lease => sameSource(lease.source, authority.source!)), 'a cleared original occupation epoch cannot grant again.');
  const leases = [...state.leases], cleanups = [...state.cleanups];
  if (current) {
    const lost = Object.freeze(authority.source && sameSource(current.source, authority.source)
      ? current.holders.filter(id => !authority.holders.includes(id)) : [...current.holders]);
    leases[current.id] = Object.freeze({ ...current, lost });
    for (const player of lost) cleanups.push(Object.freeze({ event: cleanupEvent(current, player),
      lease: current.id, player, status: 'pending' }));
  }
  let next: number | null = null;
  if (authority.source) {
    next = leases.length;
    leases.push(Object.freeze({ id: next, source: sourceCopy(authority.source),
      holders: Object.freeze([...authority.holders]), turn: game.turn, lost: null }));
  }
  return syncResult(stateWith(leases, next, cleanups), authority);
}

/** Read-only normal-limit projection; the parent filters actual HELD card IDs
 * against its original committed/reserved-card protections. No face aliases,
 * occupied-limit allowance or random discard is used for this cleanup. */
export function quoteOccupiedTupileCleanup(game: OccupiedTupileContext, state: OccupiedTupileState,
  event: string): OccupiedTupileCleanupQuote {
  validateOccupiedTupileState(state, game);
  const receipt = state.cleanups.find(row => row.event === event);
  requireTupile(receipt && receipt.status === 'pending', 'cleanup event is missing, completed or replayed.');
  const player = game.players.find(seat => seat.id === receipt.player)!;
  const limit = nativeHandLimit(player), authority = quoteOccupiedTupileAuthority(game);
  return Object.freeze({ receipt, source: state.leases[receipt.lease].source, limit,
    excess: Math.max(0, player.hand.length - limit), blocked: authority.blocked });
}

/** The original queue validates actor/event and protected distinct held IDs,
 * performs exactly the quoted excess discards, then commits this next ledger in
 * the SAME transaction. A pure receipt cannot prevent double physical discard
 * by a caller that neglects atomic persistence. Complete zero-excess plans too.
 * Later leases cannot reuse/consume a completed original cleanup event. */
export function completeOccupiedTupileCleanup(game: OccupiedTupileContext, state: OccupiedTupileState,
  event: string, player: string): OccupiedTupileState {
  const quote = quoteOccupiedTupileCleanup(game, state, event);
  requireTupile(quote.receipt.player === player && !quote.blocked && quote.excess === 0,
    'wrong original cleanup owner, blocked source or remaining normal-limit excess.');
  const cleanups = state.cleanups.map(row => row.event === event ? Object.freeze({ ...row, status: 'completed' as const }) : row);
  return stateWith([...state.leases], state.current, cleanups);
}
