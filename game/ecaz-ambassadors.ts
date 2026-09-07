import type { FactionId } from './catalog';

/** Physical inventory and custody only. Source: GF9 Ecaz & Moritani, printed pp.7–8.
 * One token per listed effect composes the eleven effects with the printed token count.
 * Stable IDs are internal state, never a public hidden-token identity contract.
 * Effects, placement timing, cancellation authorization and visibility are separate.
 */
export type AmbassadorEffect = Exclude<FactionId, 'moritani'>;
export const AMBASSADOR_EFFECTS: readonly AmbassadorEffect[] = Object.freeze([
  'ecaz',
  'atreides',
  'beneGesserit',
  'choam',
  'emperor',
  'fremen',
  'harkonnen',
  'ixians',
  'richese',
  'guild',
  'tleilaxu',
]);
export type AmbassadorToken = {
  id: string;
  effect: AmbassadorEffect;
  zone: 'pool' | 'supply' | 'placed' | 'used' | 'removed';
  location: string | null;
};
export type AmbassadorState = {
  tokens: AmbassadorToken[];
  /** The five random tokens of this cycle, excluding the reusable Ecaz token. */
  cohort: string[];
  placement: { turn: number; count: number; blocked: boolean } | null;
};
export type AmbassadorPlacementContext = {
  turn: number;
  availableSpice: number;
  /** Caller validates map-specific permission, including any mobile stronghold rules. */
  destination: {
    id: string;
    stronghold: boolean;
    inStorm: boolean;
    allowed: boolean;
  };
};

export type AmbassadorEntryContext = Readonly<{
  owner: string;
  ally: string | null;
  entrant: string;
  entrantFaction: FactionId;
  advisors: boolean;
  /** The physical marker, not a subsequently copied effect. */
  effect: AmbassadorEffect;
}>;

/** E3 p.7 entry exclusions only. Caller establishes a real entry at a placed marker. */
export function canTriggerAmbassador(context: AmbassadorEntryContext): boolean {
  return (
    context.entrant !== context.owner &&
    context.entrant !== context.ally &&
    !context.advisors &&
    context.entrantFaction !== context.effect
  );
}

/** E3 p.7: setup's supply is Ecaz plus this cohort, regardless of later custody.
 * Does not authorize triggering BG, consume tokens, or filter by entrant faction.
 */
export function copiedAmbassadorEffects(
  state: AmbassadorState,
): AmbassadorEffect[] {
  validateAmbassadors(state);
  const supplied = new Set(
    state.tokens
      .filter((token) => state.cohort.includes(token.id))
      .map((token) => token.effect),
  );
  return AMBASSADOR_EFFECTS.filter(
    (effect) => effect !== 'ecaz' && !supplied.has(effect),
  );
}

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function physicalId(effect: AmbassadorEffect) {
  return `ambassador-${AMBASSADOR_EFFECTS.indexOf(effect) + 1}`;
}
export function validateAmbassadors(state: AmbassadorState): void {
  requireValid(
    state.tokens.length === 11,
    'An Ambassador inventory contains eleven physical tokens.',
  );
  requireValid(
    new Set(state.tokens.map((token) => token.id)).size === 11 &&
      new Set(state.tokens.map((token) => token.effect)).size === 11,
    'Ambassador identities and effects must be unique.',
  );
  requireValid(
    state.cohort.length === 5 && new Set(state.cohort).size === 5,
    'An Ambassador cohort contains five distinct random tokens.',
  );
  for (const id of state.cohort)
    requireValid(
      state.tokens.some((token) => token.id === id && token.effect !== 'ecaz'),
      'The random cohort must identify non-Ecaz physical tokens.',
    );
  const locations = new Set<string>();
  for (const token of state.tokens) {
    requireValid(
      AMBASSADOR_EFFECTS.includes(token.effect) &&
        token.id === physicalId(token.effect),
      'Invalid physical Ambassador identity.',
    );
    requireValid(
      ['pool', 'supply', 'placed', 'used', 'removed'].includes(token.zone),
      'Invalid Ambassador custody zone.',
    );
    if (token.zone === 'placed') {
      requireValid(
        typeof token.location === 'string' &&
          token.location.length > 0 &&
          !locations.has(token.location),
        'Placed Ambassadors need distinct territories.',
      );
      locations.add(token.location);
    } else
      requireValid(
        token.location === null,
        'Only placed Ambassadors have a territory.',
      );
    if (token.effect === 'ecaz') {
      requireValid(
        token.zone === 'supply' || token.zone === 'placed',
        'Ecaz remains reusable outside the random cohort.',
      );
    } else if (state.cohort.includes(token.id)) {
      requireValid(
        token.zone === 'supply' ||
          token.zone === 'placed' ||
          token.zone === 'used' ||
          (token.zone === 'removed' && token.effect === 'beneGesserit'),
        'A current cohort token cannot return to the pool early.',
      );
      requireValid(
        token.effect !== 'beneGesserit' || token.zone !== 'used',
        'A triggered Bene Gesserit Ambassador is permanently removed.',
      );
    } else
      requireValid(
        token.zone === 'pool' ||
          (token.effect === 'beneGesserit' && token.zone === 'removed'),
        'Non-cohort random tokens remain in the pool, except permanent removals.',
      );
  }
  if (state.placement !== null)
    requireValid(
      Number.isSafeInteger(state.placement.turn) &&
        state.placement.turn > 0 &&
        Number.isSafeInteger(state.placement.count) &&
        state.placement.count >= 0 &&
        typeof state.placement.blocked === 'boolean',
      'Invalid turn-stamped Ambassador placement allowance.',
    );
}
function clone(state: AmbassadorState): AmbassadorState {
  return {
    tokens: state.tokens.map((token) => ({ ...token })),
    cohort: [...state.cohort],
    placement: state.placement ? { ...state.placement } : null,
  };
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const draw = random();
    requireValid(
      Number.isFinite(draw) && draw >= 0 && draw < 1,
      'Ambassador random draws must be in [0, 1).',
    );
    const selected = Math.floor(draw * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}
function selectCohort(state: AmbassadorState, random: () => number) {
  const pool = state.tokens.filter((token) => token.zone === 'pool');
  requireValid(
    pool.length >= 5,
    'Five unused Ambassador tokens are required for a new cohort.',
  );
  state.cohort = shuffled(pool, random)
    .slice(0, 5)
    .map((token) => token.id);
  for (const token of state.tokens)
    if (state.cohort.includes(token.id)) token.zone = 'supply';
}
export function createAmbassadors(random: () => number): AmbassadorState {
  const state: AmbassadorState = {
    tokens: AMBASSADOR_EFFECTS.map((effect) => ({
      id: physicalId(effect),
      effect,
      zone: effect === 'ecaz' ? 'supply' : 'pool',
      location: null,
    })),
    cohort: [],
    placement: null,
  };
  selectCohort(state, random);
  validateAmbassadors(state);
  return state;
}
function placementFor(state: AmbassadorState, turn: number) {
  requireValid(
    Number.isSafeInteger(turn) &&
      turn > 0 &&
      (!state.placement || turn >= state.placement.turn),
    'Choose a current Ambassador placement turn.',
  );
  return state.placement?.turn === turn
    ? { ...state.placement }
    : { turn, count: 0, blocked: false };
}
export function placeAmbassador(
  state: AmbassadorState,
  tokenId: string,
  context: AmbassadorPlacementContext,
): { state: AmbassadorState; cost: number } {
  validateAmbassadors(state);
  const placement = placementFor(state, context.turn);
  requireValid(
    !placement.blocked,
    'Ambassador placement is blocked for this turn.',
  );
  requireValid(
    Number.isSafeInteger(context.availableSpice) && context.availableSpice >= 0,
    'Use an available integer spice balance.',
  );
  const cost = placement.count + 1;
  requireValid(
    Number.isSafeInteger(cost) && context.availableSpice >= cost,
    'Not enough spice for the next Ambassador placement.',
  );
  const destination = context.destination;
  requireValid(
    typeof destination.id === 'string' &&
      destination.id.length > 0 &&
      destination.stronghold === true &&
      destination.allowed === true &&
      destination.inStorm === false,
    'Choose an eligible stronghold outside the storm.',
  );
  requireValid(
    !state.tokens.some(
      (token) => token.zone === 'placed' && token.location === destination.id,
    ),
    'That stronghold already contains an Ambassador.',
  );
  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  requireValid(
    token?.zone === 'supply',
    'Place an Ambassador from your supply; placed tokens cannot relocate.',
  );
  const next = clone(state);
  const placed = next.tokens.find((candidate) => candidate.id === tokenId)!;
  placed.zone = 'placed';
  placed.location = destination.id;
  next.placement = { ...placement, count: cost };
  validateAmbassadors(next);
  return { state: next, cost };
}
export function blockAmbassadorPlacement(
  state: AmbassadorState,
  turn: number,
): AmbassadorState {
  validateAmbassadors(state);
  const placement = placementFor(state, turn);
  const next = clone(state);
  next.placement = { ...placement, blocked: true };
  return next;
}
function placedToken(state: AmbassadorState, tokenId: string) {
  validateAmbassadors(state);
  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  requireValid(token?.zone === 'placed', 'Choose a placed Ambassador.');
  return token;
}
/** Storm/explosion destruction is not a triggered effect and does not finish a cohort. */
export function destroyAmbassador(
  state: AmbassadorState,
  tokenId: string,
): AmbassadorState {
  placedToken(state, tokenId);
  const next = clone(state);
  const token = next.tokens.find((candidate) => candidate.id === tokenId)!;
  token.zone = 'supply';
  token.location = null;
  validateAmbassadors(next);
  return next;
}
/** Call only when the trigger has committed; effect resolution is outside this module. */
export function triggerAmbassador(
  state: AmbassadorState,
  tokenId: string,
): AmbassadorState {
  const original = placedToken(state, tokenId);
  const next = clone(state);
  const token = next.tokens.find((candidate) => candidate.id === tokenId)!;
  token.zone =
    original.effect === 'ecaz'
      ? 'supply'
      : original.effect === 'beneGesserit'
        ? 'removed'
        : 'used';
  token.location = null;
  validateAmbassadors(next);
  return next;
}
/** Separate from trigger commitment so the engine can finish an effect's continuation first. */
export function replenishAmbassadors(
  state: AmbassadorState,
  random: () => number,
): AmbassadorState {
  validateAmbassadors(state);
  requireValid(
    state.cohort.every((id) =>
      state.tokens.some(
        (token) =>
          token.id === id &&
          (token.zone === 'used' || token.zone === 'removed'),
      ),
    ),
    'Trigger all five random Ambassadors before drawing another cohort.',
  );
  const next = clone(state);
  for (const token of next.tokens)
    if (token.zone === 'used') token.zone = 'pool';
  selectCohort(next, random);
  validateAmbassadors(next);
  return next;
}
