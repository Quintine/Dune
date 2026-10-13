import { terrorLocationAllowed, type TerrorLocationContext } from './terror-location';
import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';
import {
  returnTerror,
  TERROR_KINDS,
  TERROR_STRONGHOLDS,
  type TerrorState,
  type TerrorToken,
} from './moritani-terror';

export type GrummanCollectionContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds' | 'moritaniTerror'
> & TerrorLocationContext;
export type GrummanCollectionQuote = {
  player: string;
  population: number | null;
  high: boolean;
  blocked: string | null;
  /** Owner-only physical identities and secret faces; never a public projection. */
  tokens: TerrorToken[];
  destinations: string[];
  /** Owner-only placed identities, including historically authorized Cunning locations. */
  removable: TerrorToken[];
  removeBlocked: string | null;
};
export type GrummanCollectionAction =
  | { mode: 'add'; token: string; destination: string }
  | { mode: 'decline' }
  | { mode: 'remove'; token: string };

function fail(message: string): never {
  throw new HomeworldCustodyError(message);
}
function knownKeys(value: unknown, allowed: string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}
function stateFor(
  context: GrummanCollectionContext,
  ownerId: string,
): TerrorState {
  const owners = context.players.filter((player) => player.id === ownerId);
  if (owners.length !== 1 || owners[0].faction !== 'moritani')
    fail('Only Moritani can use the native Grumman collection opportunity.');
  const state = context.moritaniTerror;
  if (
    !knownKeys(state, ['tokens', 'placementTurn', 'supplyEpoch']) ||
    !Array.isArray(state?.tokens) ||
    state.tokens.length !== TERROR_KINDS.length ||
    (state.placementTurn !== undefined &&
      (!Number.isSafeInteger(state.placementTurn) ||
        state.placementTurn < 1)) ||
    (state.supplyEpoch !== undefined &&
      (!Number.isSafeInteger(state.supplyEpoch) || state.supplyEpoch < 0))
  )
    fail(
      'Grumman needs the complete original Terror inventory and placement records.',
    );
  const ids = new Set<string>(),
    kinds = new Set<string>();
  for (const token of state.tokens) {
    if (
      !knownKeys(token, ['id', 'kind', 'location', 'status']) ||
      typeof token.id !== 'string' ||
      !token.id ||
      ids.has(token.id) ||
      !TERROR_KINDS.includes(token.kind) ||
      kinds.has(token.kind) ||
      !['available', 'placed', 'removed', 'extortion'].includes(token.status) ||
      (token.status === 'placed'
        ? typeof token.location !== 'string' ||
          !terrorLocationAllowed(context,token.id,token.location)
        : token.location !== null) ||
      (token.status === 'extortion' && token.kind !== 'extortion')
    )
      fail(
        'Grumman needs six distinct Terror tokens in their valid custody zones.',
      );
    ids.add(token.id);
    kinds.add(token.kind);
  }
  return state;
}

/** Current native population only. The caller owns phase, once-only receipt and
 * pending-entry reservations. Occupied Homeworld lifecycle remains separate. */
export function quoteGrummanCollection(
  context: GrummanCollectionContext,
  ownerId: string,
): GrummanCollectionQuote {
  const state = stateFor(context, ownerId);
  const home = context.homeworlds?.custody
    ? homeworldPopulations(
        homeworldContext(context),
        context.homeworlds.custody,
      ).find(
        (candidate) =>
          candidate.native === ownerId && candidate.card === 'grumman',
      )
    : undefined;
  const high = home?.side === 'high';
  const tokens = high
    ? state.tokens.filter((token) => token.status === 'available')
    : [];
  const destinations = high
    ? TERROR_STRONGHOLDS.filter((destination) =>
        state.tokens.some(
          (token) =>
            token.status === 'placed' && token.location === destination,
        ),
      )
    : [];
  const removable = high
    ? state.tokens.filter((token) => token.status === 'placed')
    : [];
  return {
    player: ownerId,
    population: home?.population ?? null,
    high,
    blocked: !high
      ? 'Grumman needs at least eight native forces for its collection opportunity.'
      : !tokens.length
        ? 'There is no available Terror token to add.'
        : !destinations.length
          ? 'Adding Terror requires an ordinary stronghold already containing a Terror token.'
          : null,
    tokens: tokens.map((token) => ({ ...token })),
    destinations: [...destinations],
    removable: removable.map((token) => ({ ...token })),
    removeBlocked: !high
      ? 'Grumman needs at least eight native forces for its collection opportunity.'
      : !removable.length
        ? 'There is no placed Terror token to return to supply.'
        : null,
  };
}

/** A successful operation and its four bank spice are one quote. Removal
 * rotates hidden supply with private randomness; Mentat usage remains separate. */
export function quoteGrummanCollectionAction(
  context: GrummanCollectionContext,
  ownerId: string,
  action: GrummanCollectionAction,
  random: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
): { state: TerrorState; amount: 0 | 4 } {
  const state = stateFor(context, ownerId);
  if (
    !knownKeys(
      action,
      action?.mode === 'add'
        ? ['mode', 'token', 'destination']
        : action?.mode === 'remove'
          ? ['mode', 'token']
          : ['mode'],
    )
  )
    fail('Choose one Grumman collection operation.');
  if (action.mode === 'decline')
    return { state: structuredClone(state), amount: 0 };
  if (action.mode === 'remove') {
    const quote = quoteGrummanCollection(context, ownerId);
    if (quote.removeBlocked) fail(quote.removeBlocked);
    if (!quote.removable.some((token) => token.id === action.token))
      fail('Choose a currently placed physical Terror token to return to supply.');
    return { state: returnTerror(state, action.token, random), amount: 4 };
  }
  if (action.mode !== 'add') fail('Choose one Grumman collection operation.');
  const quote = quoteGrummanCollection(context, ownerId);
  if (quote.blocked) fail(quote.blocked);
  if (!quote.tokens.some((token) => token.id === action.token))
    fail('Choose an available physical Terror token from your supply.');
  if (!quote.destinations.includes(action.destination))
    fail('Choose an ordinary stronghold already containing Terror.');
  const result = structuredClone(state);
  const token = result.tokens.find(
    (candidate) => candidate.id === action.token,
  )!;
  token.status = 'placed';
  token.location = action.destination;
  return { state: result, amount: 4 };
}
