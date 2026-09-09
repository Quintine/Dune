import { FACTIONS, type FactionId } from './catalog';

/** Physical inventory is independent of seated factions and enabled modules. */
export const NEXUS_FACTIONS: readonly FactionId[] = Object.freeze(
  FACTIONS.map((faction) => faction.id),
);
export type NexusPlayer = {
  id: string;
  faction: FactionId;
  ally?: string | null;
};
export type NexusState = {
  version: 1;
  deck: FactionId[];
  discard: FactionId[];
  hands: Record<string, FactionId | null>;
};
export type NexusCardMode = 'cunning' | 'betrayal' | 'secretAlly';
export type NexusCardsView = {
  card: FactionId | null;
  deckCount: number;
  discardCount: number;
  held: Record<string, boolean>;
};
export class NexusCardsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NexusCardsError';
  }
}
function requireCards(condition: unknown, message: string): asserts condition {
  if (!condition) throw new NexusCardsError(message);
}
const faction = (value: unknown): value is FactionId =>
  NEXUS_FACTIONS.includes(value as FactionId);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
export function validateNexusPlayers(players: readonly NexusPlayer[]): void {
  requireCards(
    Array.isArray(players) && players.length >= 2 && players.length <= 6,
    'Nexus custody needs two through six seated players.',
  );
  const ids = new Set<string>(),
    factions = new Set<FactionId>();
  for (const player of players) {
    requireCards(
      plain(player) &&
        identifier(player.id) &&
        faction(player.faction) &&
        !ids.has(player.id) &&
        !factions.has(player.faction),
      'Nexus custody needs distinct valid seated identities and factions.',
    );
    ids.add(player.id);
    factions.add(player.faction);
  }
  for (const player of players)
    requireCards(
      player.ally === undefined ||
        player.ally === null ||
        (identifier(player.ally) &&
          player.ally !== player.id &&
          ids.has(player.ally)),
      'A Nexus player has an invalid seated alliance partner.',
    );
  for (const player of players)
    requireCards(
      player.ally === undefined ||
        player.ally === null ||
        players.find((partner) => partner.id === player.ally)!.ally ===
          player.id,
      'Nexus alliances must identify reciprocal seated partners.',
    );
}

/** No alias zones, unknown card, missing seat, duplicated identity or extra
 * private fields may be reconstructed or silently normalized on read. */
export function validateNexusCards(
  state: NexusState,
  players: readonly NexusPlayer[],
): void {
  validateNexusPlayers(players);
  requireCards(
    plain(state) &&
      Object.keys(state).length === 4 &&
      ['version', 'deck', 'discard', 'hands'].every((key) =>
        Object.hasOwn(state, key),
      ) &&
      state.version === 1 &&
      Array.isArray(state.deck) &&
      Array.isArray(state.discard) &&
      plain(state.hands),
    'The saved Nexus inventory has an invalid shape.',
  );
  requireCards(
    Object.keys(state.hands).length === players.length &&
      players.every((player) => Object.hasOwn(state.hands, player.id)),
    'Nexus hands must match the complete seated roster.',
  );
  const physical: FactionId[] = [];
  for (const pile of [state.deck, state.discard])
    for (const card of pile) {
      requireCards(
        faction(card),
        'The Nexus inventory contains an unknown physical card.',
      );
      physical.push(card);
    }
  for (const player of players) {
    const card = state.hands[player.id];
    requireCards(
      card === null || faction(card),
      'Each Nexus hand holds at most one physical card.',
    );
    if (card !== null) physical.push(card);
  }
  requireCards(
    physical.length === NEXUS_FACTIONS.length &&
      new Set(physical).size === NEXUS_FACTIONS.length,
    'The Nexus inventory must conserve exactly one card for each of the twelve factions.',
  );
}
function shuffle(
  cards: readonly FactionId[],
  random: () => number,
): FactionId[] {
  requireCards(
    typeof random === 'function',
    'Nexus shuffling needs server randomness.',
  );
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index--) {
    const value = random();
    requireCards(
      Number.isFinite(value) && value >= 0 && value < 1,
      'Nexus random draws must be finite from zero inclusive to one exclusive.',
    );
    const selected = Math.floor(value * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}
export function createNexusCards(
  players: readonly NexusPlayer[],
  random: () => number,
): NexusState {
  validateNexusPlayers(players);
  return {
    version: 1,
    deck: shuffle(NEXUS_FACTIONS, random),
    discard: [],
    hands: Object.fromEntries(players.map((player) => [player.id, null])),
  };
}
function owner(
  state: NexusState,
  player: string,
  players: readonly NexusPlayer[],
): NexusPlayer {
  validateNexusCards(state, players);
  const seat = players.find((candidate) => candidate.id === player);
  requireCards(seat && identifier(player), 'Choose a seated Nexus card owner.');
  return seat;
}
function requireUnallied(player: NexusPlayer): void {
  requireCards(
    player.ally === undefined || player.ally === null,
    'An allied player cannot draw or replace a Nexus card.',
  );
}
function drawInto(
  state: NexusState,
  player: string,
  random: () => number,
): void {
  if (!state.deck.length) {
    requireCards(
      state.discard.length > 0,
      'There is no physical Nexus card to draw.',
    );
    state.deck = shuffle(state.discard, random);
    state.discard = [];
  }
  state.hands[player] = state.deck.shift()!;
}

/** The engine authorizes the phase opportunity or immediate own-faction redraw.
 * Drawing one's faction never discards it automatically in either rules mode. */
export function drawNexusCard(
  state: NexusState,
  player: string,
  players: readonly NexusPlayer[],
  random: () => number,
): NexusState {
  requireUnallied(owner(state, player, players));
  requireCards(
    state.hands[player] === null,
    'Discard a held Nexus card before drawing its replacement.',
  );
  const result = structuredClone(state);
  drawInto(result, player, random);
  return result;
}
export function replaceNexusCard(
  state: NexusState,
  player: string,
  players: readonly NexusPlayer[],
  random: () => number,
): NexusState {
  requireUnallied(owner(state, player, players));
  requireCards(
    state.hands[player] !== null,
    'Hold a Nexus card before replacing it.',
  );
  const result = structuredClone(state);
  result.discard.push(result.hands[player]!);
  result.hands[player] = null;
  drawInto(result, player, random);
  return result;
}
/** Used cards and cards forfeited upon joining any alliance take the same
 * physical route. The caller separately proves which discard is mandatory. */
export function discardNexusCard(
  state: NexusState,
  player: string,
  players: readonly NexusPlayer[],
): NexusState {
  owner(state, player, players);
  requireCards(
    state.hands[player] !== null,
    'Hold a Nexus card before discarding it.',
  );
  const result = structuredClone(state);
  result.discard.push(result.hands[player]!);
  result.hands[player] = null;
  return result;
}

export function nexusCardMode(
  card: FactionId,
  ownerFaction: FactionId,
  seatedFactions: readonly FactionId[],
): NexusCardMode {
  requireCards(
    faction(card) &&
      faction(ownerFaction) &&
      Array.isArray(seatedFactions) &&
      seatedFactions.every(faction) &&
      new Set(seatedFactions).size === seatedFactions.length &&
      seatedFactions.includes(ownerFaction),
    'Nexus effects need a known card and its actual seated faction roster.',
  );
  return card === ownerFaction
    ? 'cunning'
    : seatedFactions.includes(card)
      ? 'betrayal'
      : 'secretAlly';
}
export function projectNexusCards(
  state: NexusState,
  viewer: string,
  players: readonly NexusPlayer[],
): NexusCardsView {
  owner(state, viewer, players);
  return {
    card: state.hands[viewer],
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    held: Object.fromEntries(
      players.map((player) => [player.id, state.hands[player.id] !== null]),
    ),
  };
}
