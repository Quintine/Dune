import { FACTIONS, type FactionId } from './catalog';

/**
 * Physical inventory and hidden custody for the Ecaz & Moritani Discovery
 * variant. Source acquisition: docs/DISCOVERY_COMPONENTS.md.
 *
 * This module does not authorize a spice blow, inspection, reveal, movement,
 * or reward. Callers establish those game conditions and apply emitted effects.
 */
export type DiscoveryTokenType = 'hiereg' | 'smuggler';
export type DiscoveryTokenFace =
  | 'jacurutu-sietch'
  | 'cistern'
  | 'ecological-testing-station'
  | 'shrine'
  | 'orgiz-processing-station'
  | 'treachery-card-stash'
  | 'spice-stash'
  | 'ornithopter';
export type DiscoveryLocationId = Extract<
  DiscoveryTokenFace,
  | 'jacurutu-sietch'
  | 'cistern'
  | 'ecological-testing-station'
  | 'shrine'
  | 'orgiz-processing-station'
>;
export type DiscoveryTokenKind = 'location' | 'instant' | 'carried';

export const JACURUTU_SIETCH: DiscoveryLocationId = 'jacurutu-sietch';

export type DiscoveryLocationDefinition = Readonly<{
  id: DiscoveryLocationId;
  name: string;
  tokenType: DiscoveryTokenType;
  stronghold: boolean;
}>;

export const DISCOVERY_LOCATIONS: readonly DiscoveryLocationDefinition[] =
  Object.freeze([
    Object.freeze({
      id: JACURUTU_SIETCH,
      name: 'Jacurutu Sietch',
      tokenType: 'hiereg',
      stronghold: true,
    }),
    Object.freeze({
      id: 'cistern',
      name: 'Cistern',
      tokenType: 'hiereg',
      stronghold: false,
    }),
    Object.freeze({
      id: 'ecological-testing-station',
      name: 'Ecological Testing Station',
      tokenType: 'hiereg',
      stronghold: false,
    }),
    Object.freeze({
      id: 'shrine',
      name: 'Shrine',
      tokenType: 'hiereg',
      stronghold: false,
    }),
    Object.freeze({
      id: 'orgiz-processing-station',
      name: 'Orgiz Processing Station',
      tokenType: 'smuggler',
      stronghold: false,
    }),
  ] satisfies DiscoveryLocationDefinition[]);

export const DISCOVERY_LOCATION_IDS: readonly DiscoveryLocationId[] =
  Object.freeze(DISCOVERY_LOCATIONS.map((location) => location.id));

export const DISCOVERY_LOCATION_BY_ID: Readonly<
  Record<DiscoveryLocationId, DiscoveryLocationDefinition>
> = Object.freeze(
  Object.fromEntries(
    DISCOVERY_LOCATIONS.map((location) => [location.id, location]),
  ) as Record<DiscoveryLocationId, DiscoveryLocationDefinition>,
);

export function isDiscoveryLocationId(
  value: unknown,
): value is DiscoveryLocationId {
  return (
    typeof value === 'string' &&
    DISCOVERY_LOCATION_IDS.includes(value as DiscoveryLocationId)
  );
}

export type DiscoveryTokenDefinition = Readonly<{
  id: DiscoveryTokenFace;
  name: string;
  type: DiscoveryTokenType;
  kind: DiscoveryTokenKind;
  location: DiscoveryLocationId | null;
}>;

export const DISCOVERY_TOKENS: readonly DiscoveryTokenDefinition[] =
  Object.freeze([
    ...DISCOVERY_LOCATIONS.map((location) =>
      Object.freeze({
        id: location.id,
        name: location.name,
        type: location.tokenType,
        kind: 'location' as const,
        location: location.id,
      }),
    ),
    Object.freeze({
      id: 'treachery-card-stash',
      name: 'Treachery Card Stash',
      type: 'smuggler',
      kind: 'instant',
      location: null,
    }),
    Object.freeze({
      id: 'spice-stash',
      name: 'Spice Stash',
      type: 'smuggler',
      kind: 'instant',
      location: null,
    }),
    Object.freeze({
      id: 'ornithopter',
      name: 'Ornithopter',
      type: 'smuggler',
      kind: 'carried',
      location: null,
    }),
  ] satisfies DiscoveryTokenDefinition[]);

export const DISCOVERY_TOKEN_DEFINITIONS = DISCOVERY_TOKENS;

export const DISCOVERY_TOKEN_BY_ID: Readonly<
  Record<DiscoveryTokenFace, DiscoveryTokenDefinition>
> = Object.freeze(
  Object.fromEntries(
    DISCOVERY_TOKENS.map((definition) => [definition.id, definition]),
  ) as Record<DiscoveryTokenFace, DiscoveryTokenDefinition>,
);

const DISCOVERY_TOKEN_FACES = Object.freeze(
  DISCOVERY_TOKENS.map((definition) => definition.id),
);

export function isDiscoveryTokenFace(
  value: unknown,
): value is DiscoveryTokenFace {
  return (
    typeof value === 'string' &&
    DISCOVERY_TOKEN_FACES.includes(value as DiscoveryTokenFace)
  );
}

export type DiscoverySpiceCardId =
  | 'discovery-hagga-basin'
  | 'discovery-rock-outcroppings'
  | 'discovery-sihaya-ridge'
  | 'discovery-wind-pass-north'
  | 'discovery-funeral-plain'
  | 'discovery-old-gap';
export type DiscoverySpiceCard = Readonly<{
  territory: string;
  amount: 6;
  sector: number;
  discovery: DiscoverySpiceCardId;
}>;
export type DiscoveryCardPlacement = Readonly<{
  type: DiscoveryTokenType;
  territory: string;
  sector: number;
}>;

export const DISCOVERY_SPICE_CARDS: readonly DiscoverySpiceCard[] =
  Object.freeze([
    Object.freeze({
      territory: 'hagga_basin',
      amount: 6,
      sector: 12,
      discovery: 'discovery-hagga-basin',
    }),
    Object.freeze({
      territory: 'rock_outcroppings',
      amount: 6,
      sector: 13,
      discovery: 'discovery-rock-outcroppings',
    }),
    Object.freeze({
      territory: 'sihaya_ridge',
      amount: 6,
      sector: 9,
      discovery: 'discovery-sihaya-ridge',
    }),
    Object.freeze({
      territory: 'wind_pass_north',
      amount: 6,
      sector: 17,
      discovery: 'discovery-wind-pass-north',
    }),
    Object.freeze({
      territory: 'funeral_plain',
      amount: 6,
      sector: 15,
      discovery: 'discovery-funeral-plain',
    }),
    Object.freeze({
      territory: 'oh_gap',
      amount: 6,
      sector: 10,
      discovery: 'discovery-old-gap',
    }),
  ] satisfies DiscoverySpiceCard[]);

export const DISCOVERY_CARD_PLACEMENTS: Readonly<
  Record<DiscoverySpiceCardId, DiscoveryCardPlacement>
> = Object.freeze({
  'discovery-hagga-basin': Object.freeze({
    type: 'hiereg',
    territory: 'gara_kulon',
    sector: 8,
  }),
  'discovery-rock-outcroppings': Object.freeze({
    type: 'hiereg',
    territory: 'meridian',
    sector: 1,
  }),
  'discovery-sihaya-ridge': Object.freeze({
    type: 'hiereg',
    territory: 'cielago_east',
    sector: 3,
  }),
  'discovery-wind-pass-north': Object.freeze({
    type: 'smuggler',
    territory: 'plastic_basin',
    sector: 13,
  }),
  'discovery-funeral-plain': Object.freeze({
    type: 'smuggler',
    territory: 'pasty_mesa',
    sector: 7,
  }),
  'discovery-old-gap': Object.freeze({
    type: 'smuggler',
    territory: 'false_wall_west',
    sector: 17,
  }),
});

const DISCOVERY_CARD_IDS = Object.freeze(
  DISCOVERY_SPICE_CARDS.map((card) => card.discovery),
);

export function isDiscoverySpiceCardId(
  value: unknown,
): value is DiscoverySpiceCardId {
  return (
    typeof value === 'string' &&
    DISCOVERY_CARD_IDS.includes(value as DiscoverySpiceCardId)
  );
}

export type DiscoveryTokenStatus =
  | 'supply'
  | 'placed'
  | 'carried'
  | 'removed';
export type DiscoveryOpaqueTokenId = `discovery-token-${number}`;
export type DiscoveryTokenId = DiscoveryOpaqueTokenId;
export type DiscoveryToken = {
  /** Stable physical identity. It does not reveal the hidden face. */
  id: DiscoveryOpaqueTokenId;
  type: DiscoveryTokenType;
  face: DiscoveryTokenFace;
  status: DiscoveryTokenStatus;
  territory: string | null;
  sector: number | null;
  revealedTurn: number | null;
  /** Caller-authorized faction knowledge; built-in Fremen/Guild peeks need no entry. */
  known: FactionId[];
  owner: string | null;
  acquiredTurn: number | null;
};
export type DiscoveryState = {
  version: 1;
  /** Array order is the private shuffled pool order; projection never exposes it. */
  tokens: DiscoveryToken[];
  /** Revealed location IDs awaiting the next-turn force-entry opportunity. */
  newlyRevealed: DiscoveryOpaqueTokenId[];
};

export type ProjectedDiscoveryToken = Omit<
  DiscoveryToken,
  'face' | 'known'
> & {
  face: DiscoveryTokenFace | null;
};
export type DiscoveryView = {
  supplyCount: number;
  tokens: ProjectedDiscoveryToken[];
  newlyRevealed: DiscoveryOpaqueTokenId[];
};

export type DiscoveryRevealOutcome =
  | { kind: 'location'; location: DiscoveryLocationId }
  | { kind: 'treachery-card-stash' }
  | { kind: 'spice-stash'; amount: 7 }
  | { kind: 'ornithopter'; owner: string };

const factionIds = Object.freeze(FACTIONS.map((faction) => faction.id));
const tokenKeys = Object.freeze([
  'acquiredTurn',
  'face',
  'id',
  'known',
  'owner',
  'revealedTurn',
  'sector',
  'status',
  'territory',
  'type',
]);

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isFactionId(value: unknown): value is FactionId {
  return (
    typeof value === 'string' && factionIds.includes(value as FactionId)
  );
}

export function isDiscoveryTokenId(
  value: unknown,
): value is DiscoveryOpaqueTokenId {
  return typeof value === 'string' && /^discovery-token-[1-8]$/.test(value);
}

function validTurn(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function validateRandom(random: () => number, count: number): number {
  const draw = random();
  requireValid(
    Number.isFinite(draw) && draw >= 0 && draw < 1,
    'Discovery random draws must be finite numbers in [0, 1).',
  );
  return Math.floor(draw * count);
}

function isPlacement(type: DiscoveryTokenType, territory: string, sector: number) {
  return Object.values(DISCOVERY_CARD_PLACEMENTS).some(
    (placement) =>
      placement.type === type &&
      placement.territory === territory &&
      placement.sector === sector,
  );
}

export function validateDiscoveryState(state: DiscoveryState): void {
  requireValid(
    state !== null && typeof state === 'object' && !Array.isArray(state),
    'A Discovery state is required.',
  );
  requireValid(
    Object.keys(state).sort().join(',') === 'newlyRevealed,tokens,version' &&
      state.version === 1 &&
      Array.isArray(state.tokens) &&
      Array.isArray(state.newlyRevealed),
    'Invalid Discovery state shape or version.',
  );
  requireValid(
    state.tokens.length === DISCOVERY_TOKENS.length,
    'A Discovery inventory contains eight physical tokens.',
  );
  const ids = new Set<string>();
  const faces = new Set<DiscoveryTokenFace>();
  for (const token of state.tokens) {
    requireValid(
      token !== null &&
        typeof token === 'object' &&
        !Array.isArray(token) &&
        Object.keys(token).sort().join(',') === tokenKeys.join(','),
      'Invalid Discovery token shape.',
    );
    requireValid(
      isDiscoveryTokenId(token.id) && !ids.has(token.id),
      'Discovery physical IDs must be the eight distinct opaque token IDs.',
    );
    ids.add(token.id);
    requireValid(
      isDiscoveryTokenFace(token.face) && !faces.has(token.face),
      'Every Discovery face must appear exactly once.',
    );
    faces.add(token.face);
    const definition = DISCOVERY_TOKEN_BY_ID[token.face];
    requireValid(
      token.type === definition.type,
      'A Discovery token type must match its physical face.',
    );
    requireValid(
      ['supply', 'placed', 'carried', 'removed'].includes(token.status),
      'Invalid Discovery token custody status.',
    );
    requireValid(
      Array.isArray(token.known) &&
        new Set(token.known).size === token.known.length &&
        token.known.every(isFactionId),
      'Discovery private knowledge must contain distinct factions.',
    );
    if (token.status === 'supply') {
      requireValid(
        token.territory === null &&
          token.sector === null &&
          token.revealedTurn === null &&
          token.known.length === 0 &&
          token.owner === null &&
          token.acquiredTurn === null,
        'A supplied Discovery token cannot retain board, reveal, or owner state.',
      );
    } else if (token.status === 'placed') {
      requireValid(
        typeof token.territory === 'string' &&
          token.territory.length > 0 &&
          Number.isSafeInteger(token.sector) &&
          isPlacement(token.type, token.territory, token.sector as number) &&
          (token.revealedTurn === null || validTurn(token.revealedTurn)) &&
          token.owner === null &&
          token.acquiredTurn === null,
        'A placed Discovery token needs a printed destination and valid reveal state.',
      );
      requireValid(
        token.revealedTurn === null || definition.kind === 'location',
        'Only a location Discovery token remains placed after reveal.',
      );
    } else if (token.status === 'carried') {
      requireValid(
        token.face === 'ornithopter' &&
          token.territory === null &&
          token.sector === null &&
          validTurn(token.revealedTurn) &&
          typeof token.owner === 'string' &&
          token.owner.length > 0 &&
          token.acquiredTurn === token.revealedTurn,
        'Only a revealed Ornithopter can be carried by a player.',
      );
    } else {
      requireValid(
        definition.kind !== 'location' &&
          token.territory === null &&
          token.sector === null &&
          validTurn(token.revealedTurn) &&
          token.owner === null &&
          validTurn(token.acquiredTurn),
        'Only a resolved non-location Discovery token can be removed.',
      );
    }
  }
  requireValid(
    faces.size === DISCOVERY_TOKENS.length,
    'The Discovery inventory must retain every printed face.',
  );
  requireValid(
    new Set(state.newlyRevealed).size === state.newlyRevealed.length,
    'Newly revealed Discovery locations must be distinct.',
  );
  for (const id of state.newlyRevealed) {
    const token = state.tokens.find((candidate) => candidate.id === id);
    requireValid(
      token?.status === 'placed' &&
        token.revealedTurn !== null &&
        isDiscoveryLocationId(token.face),
      'A newly revealed entry must identify a revealed location token.',
    );
  }
}

function cloneDiscoveryState(state: DiscoveryState): DiscoveryState {
  return {
    version: 1,
    tokens: state.tokens.map((token) => ({
      id: token.id,
      type: token.type,
      face: token.face,
      status: token.status,
      territory: token.territory,
      sector: token.sector,
      revealedTurn: token.revealedTurn,
      known: [...token.known],
      owner: token.owner,
      acquiredTurn: token.acquiredTurn,
    })),
    newlyRevealed: [...state.newlyRevealed],
  };
}

export function createDiscoveryState(random: () => number): DiscoveryState {
  const faces = [...DISCOVERY_TOKEN_FACES];
  for (let index = faces.length - 1; index > 0; index--) {
    const selected = validateRandom(random, index + 1);
    [faces[index], faces[selected]] = [faces[selected], faces[index]];
  }
  return {
    version: 1,
    tokens: faces.map((face, index) => ({
      id: `discovery-token-${index + 1}`,
      type: DISCOVERY_TOKEN_BY_ID[face].type,
      face,
      status: 'supply',
      territory: null,
      sector: null,
      revealedTurn: null,
      known: [],
      owner: null,
      acquiredTurn: null,
    })),
    newlyRevealed: [],
  };
}

/** Caller has already drawn and resolved the printed Discovery spice blow. */
export function placeDiscovery(
  state: DiscoveryState,
  cardId: DiscoverySpiceCardId,
  random: () => number,
): DiscoveryState {
  validateDiscoveryState(state);
  requireValid(
    isDiscoverySpiceCardId(cardId),
    'Choose a printed Discovery Spice Card.',
  );
  const placement = DISCOVERY_CARD_PLACEMENTS[cardId];
  const eligible = state.tokens.filter(
    (token) => token.status === 'supply' && token.type === placement.type,
  );
  requireValid(
    eligible.length > 0,
    `No ${placement.type} Discovery token remains in the supply.`,
  );
  const selected = eligible[validateRandom(random, eligible.length)];
  const next = cloneDiscoveryState(state);
  const token = next.tokens.find((candidate) => candidate.id === selected.id)!;
  Object.assign(token, {
    status: 'placed' as const,
    territory: placement.territory,
    sector: placement.sector,
  });
  return next;
}

/** Caller authorizes a private look, including an occupying faction's collection look. */
export function rememberDiscoveryFace(
  state: DiscoveryState,
  tokenId: DiscoveryOpaqueTokenId,
  faction: FactionId,
): DiscoveryState {
  validateDiscoveryState(state);
  requireValid(isFactionId(faction), 'Choose a valid faction for Discovery knowledge.');
  const source = state.tokens.find((token) => token.id === tokenId);
  requireValid(
    source?.status === 'placed' && source.revealedTurn === null,
    'Choose a hidden placed Discovery token to inspect.',
  );
  const next = cloneDiscoveryState(state);
  const token = next.tokens.find((candidate) => candidate.id === tokenId)!;
  if (!token.known.includes(faction)) token.known.push(faction);
  return next;
}

/** Reveals custody and emits the effect; the caller applies rewards and authorizes the turn. */
export function revealDiscoveryToken(
  state: DiscoveryState,
  tokenId: DiscoveryOpaqueTokenId,
  turn: number,
  owner?: string,
): { state: DiscoveryState; outcome: DiscoveryRevealOutcome } {
  validateDiscoveryState(state);
  requireValid(validTurn(turn), 'Choose a valid turn for Discovery reveal.');
  const source = state.tokens.find((token) => token.id === tokenId);
  requireValid(
    source?.status === 'placed' && source.revealedTurn === null,
    'Choose a hidden placed Discovery token to reveal.',
  );
  const definition = DISCOVERY_TOKEN_BY_ID[source.face];
  const next = cloneDiscoveryState(state);
  const token = next.tokens.find((candidate) => candidate.id === tokenId)!;
  token.revealedTurn = turn;
  if (definition.kind === 'location') {
    next.newlyRevealed.push(token.id);
    return {
      state: next,
      outcome: { kind: 'location', location: definition.location! },
    };
  }
  token.territory = null;
  token.sector = null;
  token.acquiredTurn = turn;
  if (source.face === 'ornithopter') {
    requireValid(
      typeof owner === 'string' && owner.length > 0,
      'An Ornithopter reveal needs its receiving player.',
    );
    requireValid(
      !next.tokens.some(
        (candidate) =>
          candidate.status === 'carried' && candidate.owner === owner,
      ),
      'That player already carries an Ornithopter.',
    );
    token.status = 'carried';
    token.owner = owner;
    return { state: next, outcome: { kind: 'ornithopter', owner } };
  }
  token.status = 'removed';
  if (source.face === 'spice-stash')
    return { state: next, outcome: { kind: 'spice-stash', amount: 7 } };
  return { state: next, outcome: { kind: 'treachery-card-stash' } };
}

export function clearNewlyRevealed(state: DiscoveryState): DiscoveryState {
  validateDiscoveryState(state);
  const next = cloneDiscoveryState(state);
  next.newlyRevealed = [];
  return next;
}

/** Caller authorizes the owner's one movement action before consuming custody. */
export function consumeOrnithopter(
  state: DiscoveryState,
  owner: string,
): DiscoveryState {
  validateDiscoveryState(state);
  requireValid(
    typeof owner === 'string' && owner.length > 0,
    'Choose an Ornithopter owner.',
  );
  const carried = state.tokens.filter(
    (token) => token.status === 'carried' && token.owner === owner,
  );
  requireValid(
    carried.length === 1,
    'That player does not carry exactly one Ornithopter.',
  );
  const next = cloneDiscoveryState(state);
  const token = next.tokens.find((candidate) => candidate.id === carried[0].id)!;
  token.status = 'removed';
  token.owner = null;
  return next;
}

/**
 * Supply order and faces are never projected. Hidden placed faces are visible
 * only to recorded viewers or the type's printed privileged faction.
 */
export function projectDiscoveryState(
  state: DiscoveryState,
  viewerFaction?: FactionId,
): DiscoveryView {
  validateDiscoveryState(state);
  requireValid(
    viewerFaction === undefined || isFactionId(viewerFaction),
    'Choose a valid faction for the Discovery view.',
  );
  return {
    supplyCount: state.tokens.filter((token) => token.status === 'supply').length,
    tokens: state.tokens
      .filter((token) => token.status !== 'supply')
      .map((token) => {
        const privileged =
          (viewerFaction === 'fremen' && token.type === 'hiereg') ||
          (viewerFaction === 'guild' && token.type === 'smuggler');
        const faceVisible =
          token.revealedTurn !== null ||
          privileged ||
          (viewerFaction !== undefined && token.known.includes(viewerFaction));
        return {
          id: token.id,
          type: token.type,
          face: faceVisible ? token.face : null,
          status: token.status,
          territory: token.territory,
          sector: token.sector,
          revealedTurn: token.revealedTurn,
          owner: token.owner,
          acquiredTurn: token.acquiredTurn,
        };
      }),
    newlyRevealed: [...state.newlyRevealed],
  };
}
