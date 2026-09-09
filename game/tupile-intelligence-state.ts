import { FACTIONS, type FactionId } from './catalog';
import { HomeworldCustodyError } from './homeworld-custody';
import type { TupileIntelligenceCategory } from './tupile-intelligence';

export type TupileIntelligenceObservation = {
  event: string;
  owner: string;
  target: string;
  faction: FactionId;
  category: TupileIntelligenceCategory;
  spice: number;
  count: number;
  turn: number;
  phase: number;
  contact: string[];
  signature: string;
};
export type TupileIntelligenceState = {
  version: 1;
  owner: string;
  receipts: TupileIntelligenceObservation[];
  signature: string;
};
type ObservationInput = Omit<TupileIntelligenceObservation, 'signature'> & {
  signature?: string;
};
type PublicSeat = { id: string; faction: FactionId };

function fail(): never {
  throw new HomeworldCustodyError(
    'The saved Tupile intelligence ledger does not match its original private observations and seated factions.',
  );
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const faction = (value: unknown): value is FactionId =>
  FACTIONS.some((candidate) => candidate.id === value);
const keys = (value: unknown, allowed: readonly string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));

/** Consistency signatures bind canonical ordered facts, not cryptographic authority. */
export function tupileIntelligenceObservationSignature(
  observation: Omit<TupileIntelligenceObservation, 'signature'>,
): string {
  return JSON.stringify([
    'tupileIntelligenceObservation',
    observation.event,
    observation.owner,
    observation.target,
    observation.faction,
    observation.category,
    observation.spice,
    observation.count,
    observation.turn,
    observation.phase,
    observation.contact,
  ]);
}
export function tupileIntelligenceStateSignature(
  state: Omit<TupileIntelligenceState, 'signature'>,
): string {
  return JSON.stringify([
    'tupileIntelligenceState',
    state.version,
    state.owner,
    state.receipts.map((receipt) => [
      tupileIntelligenceObservationSignature(receipt),
      receipt.signature,
    ]),
  ]);
}

function validateObservation(
  observation: ObservationInput,
  owner: string,
): void {
  if (
    !keys(observation, [
      'event',
      'owner',
      'target',
      'faction',
      'category',
      'spice',
      'count',
      'turn',
      'phase',
      'contact',
      'signature',
    ]) ||
    !text(observation.event) ||
    observation.owner !== owner ||
    !text(observation.target) ||
    observation.target === owner ||
    !faction(observation.faction) ||
    observation.faction === 'choam' ||
    !['weapons', 'defenses'].includes(observation.category) ||
    !whole(observation.spice) ||
    !whole(observation.count) ||
    !whole(observation.turn) ||
    observation.turn < 1 ||
    !whole(observation.phase) ||
    observation.phase > 8 ||
    !Array.isArray(observation.contact) ||
    observation.contact.length === 0 ||
    new Set(observation.contact).size !== observation.contact.length
  )
    fail();
  const contacts = [
    'homeworld:choam',
    `homeworld:${observation.faction}`,
    ...(observation.faction === 'emperor' ? ['homeworld:emperor:salusa'] : []),
  ];
  if (
    observation.contact.some(
      (location) =>
        typeof location !== 'string' || !contacts.includes(location),
    ) ||
    (observation.signature !== undefined &&
      observation.signature !==
        tupileIntelligenceObservationSignature(observation))
  )
    fail();
}

function validateLedger(state: TupileIntelligenceState): void {
  if (
    !keys(state, ['version', 'owner', 'receipts', 'signature']) ||
    state.version !== 1 ||
    !text(state.owner) ||
    !Array.isArray(state.receipts) ||
    typeof state.signature !== 'string'
  )
    fail();
  const events = new Set<string>(),
    factions = new Set<FactionId>(),
    targets = new Set<string>();
  for (const receipt of state.receipts) {
    validateObservation(receipt, state.owner);
    if (
      typeof receipt.signature !== 'string' ||
      events.has(receipt.event) ||
      factions.has(receipt.faction) ||
      targets.has(receipt.target)
    )
      fail();
    events.add(receipt.event);
    factions.add(receipt.faction);
    targets.add(receipt.target);
  }
  if (state.signature !== tupileIntelligenceStateSignature(state)) fail();
}

/** Only genuine new CHOAM Homeworld setup initializes this ledger. Readers and
 * normalization must not use this constructor to replace a missing saved one. */
export function createTupileIntelligenceState(
  owner: string,
): TupileIntelligenceState {
  if (!text(owner)) fail();
  const state: TupileIntelligenceState = {
    version: 1,
    owner,
    receipts: [],
    signature: '',
  };
  state.signature = tupileIntelligenceStateSignature(state);
  return state;
}

/** Appending consumes a faction's lifetime use and snapshots its authorized
 * answer atomically. The caller proves live eligibility and seated identity. */
export function appendTupileIntelligenceObservation(
  state: TupileIntelligenceState,
  observation: ObservationInput,
): TupileIntelligenceState {
  validateLedger(state);
  validateObservation(observation, state.owner);
  if (
    state.receipts.some(
      (receipt) =>
        receipt.event === observation.event ||
        receipt.faction === observation.faction ||
        receipt.target === observation.target,
    )
  )
    fail();
  const receipt: TupileIntelligenceObservation = {
    ...structuredClone(observation),
    signature: tupileIntelligenceObservationSignature(observation),
  };
  const result = {
    ...state,
    receipts: [...structuredClone(state.receipts), receipt],
  };
  result.signature = tupileIntelligenceStateSignature(result);
  return result;
}

/** Historical answers do not follow current balances, hands or later contact.
 * Only public seated identity and the current turn are needed to validate them. */
export function validateTupileIntelligenceState(
  state: TupileIntelligenceState,
  players: readonly PublicSeat[],
  currentTurn: number,
): void {
  validateLedger(state);
  if (!Array.isArray(players) || !whole(currentTurn) || currentTurn < 1) fail();
  const ids = new Set<string>(),
    factions = new Set<FactionId>();
  for (const seat of players) {
    if (
      !seat ||
      typeof seat !== 'object' ||
      !text(seat.id) ||
      !faction(seat.faction) ||
      ids.has(seat.id) ||
      factions.has(seat.faction)
    )
      fail();
    ids.add(seat.id);
    factions.add(seat.faction);
  }
  if (
    players.filter(
      (seat) => seat.id === state.owner && seat.faction === 'choam',
    ).length !== 1 ||
    state.receipts.some(
      (receipt) =>
        receipt.turn > currentTurn ||
        !players.some(
          (seat) =>
            seat.id === receipt.target && seat.faction === receipt.faction,
        ),
    )
  )
    fail();
}

export function tupileIntelligenceUsedFactions(
  state: TupileIntelligenceState,
): FactionId[] {
  validateLedger(state);
  return state.receipts.map((receipt) => receipt.faction);
}
