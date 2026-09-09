import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';
import {
  TERROR_KINDS,
  TERROR_STRONGHOLDS,
  type TerrorState,
  type TerrorToken,
} from './moritani-terror';

export type GrummanCollectionContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds' | 'moritaniTerror'
>;
export type GrummanCollectionQuote = {
  player: string;
  population: number | null;
  high: boolean;
  blocked: string | null;
  /** Owner-only physical identities and secret faces; never a public projection. */
  tokens: TerrorToken[];
  destinations: string[];
  removeBlocked: string;
};
export type GrummanCollectionAction =
  | { mode: 'add'; token: string; destination: string }
  | { mode: 'decline' }
  | { mode: 'remove'; token: string };

const removalBlock =
  'Grumman Terror removal awaits a ruling on the removed token’s next custody zone.';

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
          !TERROR_STRONGHOLDS.includes(token.location)
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
    removeBlocked: removalBlock,
  };
}

/** A successful addition and its four bank spice are one quote. No effects,
 * randomness, supply rotation or Mentat placement allowance are consumed here. */
export function quoteGrummanCollectionAction(
  context: GrummanCollectionContext,
  ownerId: string,
  action: GrummanCollectionAction,
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
  if (action.mode === 'remove') fail(removalBlock);
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
