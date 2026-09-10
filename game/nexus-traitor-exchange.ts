import { FACTIONS, type FactionId } from './catalog';

export type NexusExchangeFaceDancer = { leader: string; revealed: boolean };
export type NexusExchangePlayer = {
  id: string;
  faction: FactionId;
  traitors: string[];
  faceDancers?: NexusExchangeFaceDancer[];
};
export type NexusTraitorSnapshot = {
  reserve: string[];
  players: NexusExchangePlayer[];
};
export type NexusTraitorExchange = {
  version: 1;
  event: string;
  owner: string;
  mode: 'cunning' | 'secretAlly';
  turn: number;
  phase: number;
  stage: 'return' | 'complete';
  drawn: string[];
  before: string[] | NexusExchangeFaceDancer[];
  returned: string[];
  source: {
    ownerFaction: FactionId;
    reserve: string[];
    others: NexusExchangePlayer[];
  };
  settledReserve?: string[];
  signature: string;
};
export type NexusTraitorExchangeResult = {
  state: NexusTraitorSnapshot;
  exchange: NexusTraitorExchange;
};
function requireExchange(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function plain(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function exact(value: unknown, keys: string[]): boolean {
  return (
    plain(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  );
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(identifier) &&
    new Set(value).size === value.length
  );
}
function equal(one: unknown, two: unknown): boolean {
  return JSON.stringify(one) === JSON.stringify(two);
}
function playerTuple(player: NexusExchangePlayer): unknown[] {
  return [
    player.id,
    player.faction,
    player.traitors,
    player.faceDancers?.map((card) => [card.leader, card.revealed]) ?? null,
  ];
}
function validatePlayer(player: NexusExchangePlayer): void {
  requireExchange(
    exact(player, [
      'id',
      'faction',
      'traitors',
      ...(Object.hasOwn(player, 'faceDancers') ? ['faceDancers'] : []),
    ]) &&
      identifier(player.id) &&
      FACTIONS.some((f) => f.id === player.faction) &&
      ids(player.traitors),
    'Invalid traitor exchange seat custody.',
  );
  if (player.faction === 'tleilaxu') {
    requireExchange(
      player.traitors.length === 0 &&
        Array.isArray(player.faceDancers) &&
        player.faceDancers.every(
          (card) =>
            exact(card, ['leader', 'revealed']) &&
            identifier(card.leader) &&
            typeof card.revealed === 'boolean',
        ) &&
        new Set(player.faceDancers.map((card) => card.leader)).size ===
          player.faceDancers.length,
      'Tleilaxu must preserve physical Face Dancer identities and statuses.',
    );
  } else
    requireExchange(
      !Object.hasOwn(player, 'faceDancers'),
      'Only Tleilaxu may hold Face Dancers.',
    );
}
export function validateNexusTraitorSnapshot(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
): void {
  requireExchange(
    ids(universe) &&
      universe.length > 0 &&
      exact(state, ['reserve', 'players']) &&
      ids(state.reserve) &&
      Array.isArray(state.players) &&
      state.players.length >= 2 &&
      state.players.length <= 6,
    'Invalid traitor exchange physical inventory.',
  );
  for (const player of state.players) validatePlayer(player);
  requireExchange(
    new Set(state.players.map((p) => p.id)).size === state.players.length &&
      new Set(state.players.map((p) => p.faction)).size ===
        state.players.length,
    'Traitor exchange seats must have distinct identities and factions.',
  );
  const physical = [
    ...state.reserve,
    ...state.players.flatMap((p) => [
      ...p.traitors,
      ...(p.faceDancers ?? []).map((c) => c.leader),
    ]),
  ];
  requireExchange(
    physical.length === universe.length &&
      new Set(physical).size === physical.length &&
      physical.every((card) => universe.includes(card)),
    'The complete physical traitor census must remain intact.',
  );
}
function count(mode: NexusTraitorExchange['mode']): number {
  return mode === 'cunning' ? 1 : 2;
}
function hand(
  player: NexusExchangePlayer,
): string[] | NexusExchangeFaceDancer[] {
  return player.faction === 'tleilaxu' ? player.faceDancers! : player.traitors;
}
function returnable(value: string[] | NexusExchangeFaceDancer[]): string[] {
  return value
    .filter((card) => typeof card === 'string' || !card.revealed)
    .map((card) => (typeof card === 'string' ? card : card.leader));
}
function setHand(
  player: NexusExchangePlayer,
  value: (string | NexusExchangeFaceDancer)[],
): void {
  if (player.faction === 'tleilaxu')
    player.faceDancers = structuredClone(value) as NexusExchangeFaceDancer[];
  else player.traitors = [...value] as string[];
}
function augmented(
  exchange: NexusTraitorExchange,
  player: NexusExchangePlayer,
): string[] | NexusExchangeFaceDancer[] {
  return player.faction === 'tleilaxu'
    ? [
        ...(structuredClone(exchange.before) as NexusExchangeFaceDancer[]),
        ...exchange.drawn.map((leader) => ({ leader, revealed: false })),
      ]
    : [...(exchange.before as string[]), ...exchange.drawn];
}
function signature(exchange: Omit<NexusTraitorExchange, 'signature'>): string {
  return JSON.stringify([
    'nexusTraitorExchange',
    exchange.version,
    exchange.event,
    exchange.owner,
    exchange.mode,
    exchange.turn,
    exchange.phase,
    exchange.stage,
    exchange.drawn,
    exchange.before.map((card) =>
      typeof card === 'string' ? card : [card.leader, card.revealed],
    ),
    exchange.returned,
    exchange.source.ownerFaction,
    exchange.source.reserve,
    exchange.source.others.map(playerTuple),
    exchange.settledReserve ?? null,
  ]);
}
function validateMode(
  state: NexusTraitorSnapshot,
  owner: string,
  mode: NexusTraitorExchange['mode'],
): NexusExchangePlayer {
  const player = state.players.find((p) => p.id === owner);
  requireExchange(
    player && ['cunning', 'secretAlly'].includes(mode),
    'Choose a supported Harkonnen Nexus exchange.',
  );
  requireExchange(
    mode === 'cunning'
      ? player.faction === 'harkonnen'
      : !state.players.some((p) => p.faction === 'harkonnen'),
    'The Harkonnen Nexus exchange must match the seated factions.',
  );
  return player;
}
export function validateNexusTraitorExchange(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
  exchange: NexusTraitorExchange,
): void {
  validateNexusTraitorSnapshot(state, universe);
  requireExchange(
    exact(exchange, [
      'version',
      'event',
      'owner',
      'mode',
      'turn',
      'phase',
      'stage',
      'drawn',
      'before',
      'returned',
      'source',
      'signature',
      ...(Object.hasOwn(exchange, 'settledReserve') ? ['settledReserve'] : []),
    ]) &&
      exchange.version === 1 &&
      identifier(exchange.event) &&
      identifier(exchange.owner) &&
      Number.isSafeInteger(exchange.turn) &&
      exchange.turn > 0 &&
      Number.isSafeInteger(exchange.phase) &&
      exchange.phase >= 0 &&
      exchange.phase <= 8 &&
      ['return', 'complete'].includes(exchange.stage) &&
      ids(exchange.drawn) &&
      ids(exchange.returned) &&
      Array.isArray(exchange.before) &&
      exact(exchange.source, ['ownerFaction', 'reserve', 'others']) &&
      ids(exchange.source.reserve) &&
      Array.isArray(exchange.source.others),
    'Invalid saved Nexus traitor exchange.',
  );
  const player = validateMode(state, exchange.owner, exchange.mode);
  requireExchange(
    exchange.drawn.length === count(exchange.mode) &&
      equal(
        exchange.drawn,
        exchange.source.reserve.slice(0, count(exchange.mode)),
      ),
    'A Nexus exchange must draw its full original group before returning cards.',
  );
  requireExchange(
    exchange.source.ownerFaction === player.faction,
    'The exchange owner faction must match its original custody.',
  );
  const originalOwner = structuredClone(player);
  setHand(originalOwner, exchange.before);
  validatePlayer(originalOwner);
  const original: NexusTraitorSnapshot = {
    reserve: exchange.source.reserve,
    players: state.players.map((p) =>
      p.id === exchange.owner
        ? originalOwner
        : exchange.source.others.find((other) => other.id === p.id)!,
    ),
  };
  requireExchange(
    exchange.source.others.length === state.players.length - 1 &&
      equal(
        exchange.source.others.map(playerTuple),
        state.players.filter((p) => p.id !== exchange.owner).map(playerTuple),
      ),
    'A Nexus exchange cannot alter another player’s held cards.',
  );
  validateNexusTraitorSnapshot(original, universe);
  const pool = augmented(exchange, player);
  requireExchange(
    exchange.returned.every((card) => returnable(pool).includes(card)),
    'Return only cards from the augmented owner hand.',
  );
  if (exchange.stage === 'return')
    requireExchange(
      exchange.returned.length === 0 &&
        !Object.hasOwn(exchange, 'settledReserve') &&
        equal(hand(player), pool) &&
        equal(
          state.reserve,
          exchange.source.reserve.slice(count(exchange.mode)),
        ),
      'The pending exchange must preserve every drawn and originally held card.',
    );
  else {
    const retained = pool.filter(
      (card) =>
        !exchange.returned.includes(
          typeof card === 'string' ? card : card.leader,
        ),
    );
    requireExchange(
      exchange.returned.length === count(exchange.mode) &&
        ids(exchange.settledReserve) &&
        equal(hand(player), retained) &&
        equal(state.reserve, exchange.settledReserve) &&
        equal(
          [...exchange.settledReserve].sort(),
          [
            ...exchange.source.reserve.slice(count(exchange.mode)),
            ...exchange.returned,
          ].sort(),
        ),
      'The completed exchange must retain its exact selection and shuffled reserve.',
    );
  }
  requireExchange(
    exchange.signature === signature(exchange),
    'The Nexus traitor exchange has lost its original history.',
  );
}
export function beginNexusTraitorExchange(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
  input: Pick<
    NexusTraitorExchange,
    'event' | 'owner' | 'mode' | 'turn' | 'phase'
  >,
): NexusTraitorExchangeResult {
  validateNexusTraitorSnapshot(state, universe);
  const player = validateMode(state, input.owner, input.mode);
  requireExchange(
    state.reserve.length >= count(input.mode),
    'The Traitor Deck must contain the full Nexus draw before any return.',
  );
  const exchange: NexusTraitorExchange = {
    version: 1,
    ...input,
    stage: 'return',
    drawn: state.reserve.slice(0, count(input.mode)),
    before: structuredClone(hand(player)),
    returned: [],
    source: {
      ownerFaction: player.faction,
      reserve: [...state.reserve],
      others: structuredClone(
        state.players.filter((p) => p.id !== input.owner),
      ),
    },
    signature: '',
  };
  const next = structuredClone(state);
  next.reserve = next.reserve.slice(count(input.mode));
  setHand(
    next.players.find((p) => p.id === input.owner)!,
    augmented(exchange, player),
  );
  exchange.signature = signature(exchange);
  validateNexusTraitorExchange(next, universe, exchange);
  return { state: next, exchange };
}
export function finishNexusTraitorExchange(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
  exchange: NexusTraitorExchange,
  selected: readonly string[],
  rng: () => number,
): NexusTraitorExchangeResult {
  validateNexusTraitorExchange(state, universe, exchange);
  requireExchange(
    exchange.stage === 'return',
    'This Nexus exchange is already complete.',
  );
  const player = state.players.find((p) => p.id === exchange.owner)!;
  requireExchange(
    ids(selected) &&
      selected.length === count(exchange.mode) &&
      selected.every((card) => returnable(hand(player)).includes(card)),
    'Return the exact number of distinct cards from your augmented hand.',
  );
  const next = structuredClone(state);
  const retained = hand(player).filter(
    (card) => !selected.includes(typeof card === 'string' ? card : card.leader),
  );
  setHand(
    next.players.find((p) => p.id === exchange.owner)!,
    retained,
  );
  next.reserve.push(...selected);
  for (let i = next.reserve.length - 1; i > 0; i--) {
    const random = rng();
    requireExchange(
      typeof random === 'number' &&
        Number.isFinite(random) &&
        random >= 0 &&
        random < 1,
      'Invalid Nexus exchange shuffle randomness.',
    );
    const j = Math.floor(random * (i + 1));
    [next.reserve[i], next.reserve[j]] = [next.reserve[j], next.reserve[i]];
  }
  const complete: NexusTraitorExchange = {
    ...structuredClone(exchange),
    stage: 'complete',
    returned: [...selected],
    settledReserve: [...next.reserve],
    signature: '',
  };
  complete.signature = signature(complete);
  validateNexusTraitorExchange(next, universe, complete);
  return { state: next, exchange: complete };
}

/** Completed receipts prove the original transition without freezing later
 * global custody. Validate the live census separately after subsequent play. */
export function validateNexusTraitorHistory(
  universe: readonly string[],
  exchange: NexusTraitorExchange,
): void {
  requireExchange(
    exchange?.stage === 'complete' &&
      exchange.source &&
      Array.isArray(exchange.before) &&
      Array.isArray(exchange.returned),
    'Only a completed Nexus exchange has an independent history.',
  );
  const owner: NexusExchangePlayer = {
    id: exchange.owner,
    faction: exchange.source.ownerFaction,
    traitors: [],
  };
  setHand(owner, exchange.before);
  const retained = augmented(exchange, owner).filter(
    (card) =>
      !exchange.returned.includes(
        typeof card === 'string' ? card : card.leader,
      ),
  );
  setHand(owner, retained);
  validateNexusTraitorExchange(
    {
      reserve: exchange.settledReserve!,
      players: [owner, ...structuredClone(exchange.source.others)],
    },
    universe,
    exchange,
  );
}

export function nexusTraitorReturnChoices(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
  exchange: NexusTraitorExchange,
): string[] {
  validateNexusTraitorExchange(state, universe, exchange);
  return exchange.stage === 'return'
    ? returnable(hand(state.players.find((p) => p.id === exchange.owner)!))
    : [];
}
