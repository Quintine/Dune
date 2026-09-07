import { TERRITORIES } from './board';

export type SharedSpiceLot = {
  territory: string;
  ecaz: string;
  ally: string;
  amount: number;
};
export type AllocationState = {
  lots: SharedSpiceLot[];
  index: number;
  offer: { by: string; ecazShare: number } | null;
  player: string;
};
export type SpiceAllocationAction =
  | { kind: 'propose'; ecazShare: number }
  | { kind: 'accept' }
  | { kind: 'equal' };
export type SpiceAllocationReceipt = {
  territory: string;
  ecaz: string;
  ally: string;
  ecazAmount: number;
  allyAmount: number;
  method: 'agreement' | 'equal';
};
export class SpiceAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpiceAllocationError';
  }
}
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
function requireAllocation(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new SpiceAllocationError(message);
}
function copyLots(
  lots: readonly SharedSpiceLot[],
  allowZero: boolean,
): SharedSpiceLot[] {
  requireAllocation(Array.isArray(lots), 'Shared spice lots must be an array.');
  const territories = new Set<string>();
  let pair: { ecaz: string; ally: string } | undefined;
  return lots.map((lot) => {
    requireAllocation(
      record(lot) &&
        keysAre(lot, ['territory', 'ecaz', 'ally', 'amount']) &&
        typeof lot.territory === 'string' &&
        TERRITORIES.some((t) => t.id === lot.territory && t.type === 'sand') &&
        identifier(lot.ecaz) &&
        identifier(lot.ally) &&
        lot.ecaz !== lot.ally &&
        whole(lot.amount) &&
        (allowZero || lot.amount > 0),
      'Each shared lot needs a desert territory, distinct parties and a valid spice amount.',
    );
    requireAllocation(
      !territories.has(lot.territory),
      'A desert territory appears in more than one shared lot.',
    );
    requireAllocation(
      !pair || (pair.ecaz === lot.ecaz && pair.ally === lot.ally),
      'All shared lots must belong to the same Ecaz alliance.',
    );
    territories.add(lot.territory);
    pair = { ecaz: lot.ecaz, ally: lot.ally };
    return {
      territory: lot.territory,
      ecaz: lot.ecaz,
      ally: lot.ally,
      amount: lot.amount,
    };
  });
}

/** Protocol convention: Ecaz proposes first for each nonzero lot. This does
 * not claim the printed rule prescribes a first proposer. The caller computes
 * collected amounts and binds the protocol to its collection event/version. */
export function createSpiceAllocation(
  lots: readonly SharedSpiceLot[],
): AllocationState | null {
  const active = copyLots(lots, true).filter((lot) => lot.amount > 0);
  return active.length
    ? { lots: active, index: 0, offer: null, player: active[0].ecaz }
    : null;
}

/** Quote a single bilateral choice. No board, resources, private information or
 * random state is read. A valid old state is indistinguishable from its replay
 * here: event binding and exactly-once commitment belong to the caller/CAS. */
export function quoteSpiceAllocation(
  state: AllocationState,
  actor: string,
  action: SpiceAllocationAction,
): { next: AllocationState | null; receipt: SpiceAllocationReceipt | null } {
  requireAllocation(
    record(state) && keysAre(state, ['lots', 'index', 'offer', 'player']),
    'The saved spice allocation has an invalid shape.',
  );
  const lots = copyLots(state.lots, false);
  requireAllocation(
    whole(state.index) && state.index < lots.length,
    'The saved spice allocation has no current lot.',
  );
  const lot = lots[state.index];
  requireAllocation(
    identifier(state.player) &&
      (state.player === lot.ecaz || state.player === lot.ally),
    'The saved allocation player is not a member of this alliance.',
  );
  const offer = state.offer;
  if (offer === null) {
    requireAllocation(
      state.player === lot.ecaz,
      'An unproposed lot begins with Ecaz.',
    );
  } else {
    requireAllocation(
      record(offer) &&
        keysAre(offer, ['by', 'ecazShare']) &&
        (offer.by === lot.ecaz || offer.by === lot.ally) &&
        whole(offer.ecazShare) &&
        offer.ecazShare <= lot.amount &&
        state.player !== offer.by,
      'The saved proposal must await the other party and fit the current lot.',
    );
  }
  requireAllocation(
    identifier(actor) && actor === state.player,
    'This spice allocation choice belongs to the other player.',
  );
  requireAllocation(
    record(action) &&
      ((action.kind === 'propose' && keysAre(action, ['kind', 'ecazShare'])) ||
        ((action.kind === 'accept' || action.kind === 'equal') &&
          keysAre(action, ['kind']))),
    'Choose a proposal, acceptance or equal allocation.',
  );
  if (action.kind === 'propose') {
    requireAllocation(
      whole(action.ecazShare) && action.ecazShare <= lot.amount,
      'Choose a whole-number Ecaz share within the collected amount.',
    );
    return {
      next: {
        lots,
        index: state.index,
        offer: { by: actor, ecazShare: action.ecazShare },
        player: actor === lot.ecaz ? lot.ally : lot.ecaz,
      },
      receipt: null,
    };
  }
  requireAllocation(
    action.kind === 'equal' || offer !== null,
    'There is no proposal to accept.',
  );
  const ecazAmount =
    action.kind === 'equal' ? Math.floor(lot.amount / 2) : offer!.ecazShare;
  const receipt: SpiceAllocationReceipt = {
    territory: lot.territory,
    ecaz: lot.ecaz,
    ally: lot.ally,
    ecazAmount,
    allyAmount: lot.amount - ecazAmount,
    method: action.kind === 'equal' ? 'equal' : 'agreement',
  };
  const index = state.index + 1;
  return {
    next:
      index < lots.length
        ? { lots, index, offer: null, player: lots[index].ecaz }
        : null,
    receipt,
  };
}
