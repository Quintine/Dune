import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { fighterCount } from '../game/advisors';
import { gameDistance, territory } from '../game/board';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { discoveryStormActions } from '../game/discovery-storm-options';
import { PLAYER_CIRCLE_SECTORS } from '../game/player-positions';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type TestingStationContestStep = { actor: string; action: Action };
export type TestingStationContestFixture = {
  initial: Game;
  setup: Game;
  afterSetup: Game;
  /** Natural turn-3 Storm phase with two actual occupants and the ordinary source. */
  game: Game;
  /** The same turn-3 Storm phase before any dial, card or ready: the ordinary window. */
  beforeStorm: Game;
  actions: TestingStationContestStep[];
  staging: string[];
  owner: string;
  second: string;
  token: string;
  parent: string;
  parentSector: number;
  source: { turn: number; kind: string; distance: number };
  /** The two occupants in original storm order. */
  order: [string, string];
  event: string;
};

export type OccupiedDiscoveryLocation = 'cistern' | 'ecological-testing-station' | 'orgiz-processing-station';
export type DiscoveryOccupantsFixture = Pick<TestingStationContestFixture,
  'initial' | 'setup' | 'afterSetup' | 'game' | 'actions' | 'staging' | 'token' | 'parent' | 'parentSector'> & {
  location: OccupiedDiscoveryLocation;
  owners: [string,string];
};

const STATION = 'ecological-testing-station';

/** Printed player-circle storm order for the board's current storm position. */
export function testingStationStormOrder(
  game: Game,
  ids: readonly string[],
): string[] {
  const distance = (id: string) =>
    (PLAYER_CIRCLE_SECTORS[game.playerPositions![id] - 1] - game.storm + 18) %
      18 || 18;
  return [...ids].sort((a, b) => distance(a) - distance(b));
}

export function testingStationOccupants(game: Game): string[] {
  return game.order.filter((id) => {
    const player = game.players.find((candidate) => candidate.id === id);
    return !!player && fighterCount(player, STATION) > 0;
  });
}

const clean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision;

/** Real native continuations; only the target turn-three station window stays open. */
export function nextTestingStationContestStep(
  game: Game,
): TestingStationContestStep | null {
  if (game.status === 'finished') return null;
  if (game.decision?.kind === 'ecologicalStorm') {
    if (game.turn >= 3) return null;
    const actor = game.decision.player;
    const action = discoveryStormActions(viewGame(game,actor)).find(choice => choice.delta === 0);
    assert.ok(action, 'Earlier natural station opportunities must preserve the ordinary distance.');
    return {actor,action};
  }
  if (game.decision?.kind === 'discoveryEntry') {
    const decision = game.decision;
    const offer = viewGame(game, decision.player).discoveryEntry;
    return {
      actor: decision.player,
      action:
        offer && !offer.blocked && offer.sources.length
          ? {
              type: 'decision',
              event: decision.event,
              accept: true,
              groups: offer.sources,
            }
          : { type: 'decision', event: decision.event, accept: false },
    };
  }
  // Optional native offers stay declined so no unrelated ride, Ambassador or
  // Battle can change the two-occupant board under audit.
  if (game.decision?.kind === 'wormRide')
    return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  if (
    game.decision?.kind === 'ecazPlacement' ||
    game.decision?.kind === 'ecazAmbassador'
  )
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  return nextSpiceBankerIncomeNativeStep(game);
}

function step(
  game: Game,
  actions?: TestingStationContestStep[],
): Game {
  const next = nextTestingStationContestStep(game);
  assert.ok(
    next,
    `Original Discovery/Ecaz continuation stopped at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`,
  );
  actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}

export function advanceTestingStationContest(
  state: Game,
  until: (game: Game) => boolean,
  actions?: TestingStationContestStep[],
): Game {
  let game = state;
  for (let n = 0; n < 2600; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = step(game, actions);
  }
  throw Error('Original Discovery/Ecaz chronology did not reach its boundary.');
}

/** Conserved staging only: original unplayed Spice Cards move to the front. */
function frontCard(
  game: Game,
  position: number,
  matches: (card: Game['spiceDeck'][number]) => boolean,
): void {
  const index = game.spiceDeck.findIndex(
    (card, i) => i >= position && matches(card),
  );
  assert.ok(
    index >= position,
    'The original unplayed Spice Card must remain available.',
  );
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}


/** Only the actual Hiereg supply lottery is selected; token identity stays real. */
function selectedTokenLottery<T>(
  game: Game,
  face: DiscoveryTokenFace,
  operation: () => T,
): T {
  const pool = game
    .discoveries!.tokens.filter(
      (token) => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type,
    )
    .map((token) => token.face);
  const index = pool.indexOf(face);
  assert.ok(index >= 0, 'The original requested Discovery token must remain in its printed supply.');
  const scalar = Math.floor(((index + 0.5) / pool.length) * 0x100000000);
  const descriptor = Object.getOwnPropertyDescriptor(
    crypto,
    'getRandomValues',
  );
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      array[0] = scalar;
      return array;
    }
    return Reflect.apply(native, crypto, [array]) as V;
  };
  try {
    return operation();
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Select printed face1 at its actual forecast shuffle after turn-two Storm,
 * not by assigning a later forecast or movement-source field. */
function selectedForecastOne<T>(enabled:boolean,operation:()=>T):T {
  if(!enabled)return operation();
  const descriptor=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  const native=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=<V extends ArrayBufferView|null>(array:V):V=>{
    if(array instanceof Uint32Array&&array.length===1) {
      array[0]=0xffffffff;
      return array;
    }
    return Reflect.apply(native,crypto,[array]) as V;
  };
  try{return operation()}finally{
    if(descriptor)Object.defineProperty(crypto,'getRandomValues',descriptor);
    else Reflect.deleteProperty(crypto,'getRandomValues');
  }
}

/** Held-card staging only: a real unplayed Weather Control card moves to a hand. */
export function holdTestingStationStormCard(
  game: Game,
  owner: string,
  effect: string,
) {
  const card = [...game.deck, ...game.discard, ...game.players.flatMap((p) => p.hand)]
    .find((candidate) => candidate.effect === effect);
  assert.ok(card, 'The original Treachery deck must still hold that card.');
  game.deck = game.deck.filter((candidate) => candidate.id !== card.id);
  game.discard = game.discard.filter((candidate) => candidate.id !== card.id);
  for (const player of game.players)
    player.hand = player.hand.filter((candidate) => candidate.id !== card.id);
  game.players.find((player) => player.id === owner)!.hand.push(card);
  return card;
}

/** Original setup, printed Discovery supply and real reciprocal alliance create
 * two occupants without fabricated counters, wallets, phases or token faces. */
export function createDiscoveryOccupantsFixture(
  options: { location: OccupiedDiscoveryLocation; advanced?: boolean; secondAmount?: number; adjacentBlow?: boolean; ordinaryBlowTerrain?: 'sand' | 'rock'; forecastOne?: boolean },
): DiscoveryOccupantsFixture {
  const advanced = options.advanced ?? false, location = options.location;
  const secondAmount = options.secondAmount ?? 1;
  const card = DISCOVERY_SPICE_CARDS.find(candidate =>
    DISCOVERY_CARD_PLACEMENTS[candidate.discovery].type === DISCOVERY_TOKEN_BY_ID[location].type)!;
  const placement = DISCOVERY_CARD_PLACEMENTS[card.discovery];
  let game = createGame(
    'TESTINGSTATIONCONTEST',
    newPlayer('ecaz', 'Ecaz', 'ecaz'),
    advanced,
    ['ecaz'],
  );
  for (const faction of ['guild', 'fremen', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  game.discoveryEnabled = true;
  for (const player of game.players)
    if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const ecaz = game.players.find((player) => player.faction === 'ecaz')!.id;
  const guild = game.players.find((player) => player.faction === 'guild')!.id;
  assert.notEqual(ecaz, guild);
  const initial = structuredClone(game);
  const actions: TestingStationContestStep[] = [];
  const staging: string[] = [];

  game = initializeDiscoveryGameForAudit(game);
  const setup = structuredClone(game);
  game = advanceTestingStationContest(game, (state) => state.status === 'playing', actions);

  // Printed Hagga Basin Discovery blow on turn one; a real ordinary worm on turn
  // two; everything else stays an original unplayed card of the same deck.
  const wormPosition = advanced ? 2 : 1;
  frontCard(game, 0, (candidate) => 'territory' in candidate && candidate.discovery === card.discovery);
  if (advanced)
    frontCard(game, 1, (candidate) => 'territory' in candidate && !candidate.discovery &&
      candidate.territory !== placement.territory &&
      (!options.ordinaryBlowTerrain || territory(candidate.territory).type === options.ordinaryBlowTerrain));
  frontCard(game, wormPosition, (card) => 'worm' in card && !card.greatMaker);
  for (let position = wormPosition + 1; position < wormPosition + 3; position++)
    frontCard(game, position, (candidate) => 'territory' in candidate && !candidate.discovery &&
      candidate.territory !== placement.territory &&
      (!options.ordinaryBlowTerrain || territory(candidate.territory).type === options.ordinaryBlowTerrain));
  if (options.adjacentBlow)
    frontCard(game,wormPosition+1,candidate => 'territory' in candidate && !candidate.discovery &&
      gameDistance(game,`${placement.territory}:${placement.sector}`,`${candidate.territory}:${candidate.sector}`) === 1);
  staging.push(
    `Reordered original unplayed Spice Cards only: printed ${card.discovery} first, then ordinary Shai-Hulud for turn two.`,
  );
  const afterSetup = structuredClone(game);

  game = selectedTokenLottery(game, location, () =>
    advanceTestingStationContest(
      game,
      (state) =>
        state.discoveries!.tokens.some(
          (token) => token.face === location && token.status === 'placed',
        ),
      actions,
    ),
  );
  const token = game.discoveries!.tokens.find(
    (candidate) => candidate.face === location,
  )!;
  assert.equal(token.status, 'placed');
  assert.equal(token.territory, placement.territory);
  assert.equal(token.sector, placement.sector);
  staging.push(
    'Selected only the actual printed-type supply lottery; the Discovery card places the original token.',
  );

  // Turn one: the collector ships to the token's printed destination, then
  // inspects and reveals the token during the ordinary Collection phase.
  game = advanceTestingStationContest(
    game,
    (state) => state.phase === 5 && state.active === ecaz && clean(state),
    actions,
  );
  const shipment: TestingStationContestStep = {
    actor: ecaz,
    action: {
      type: 'ship',
      territory: placement.territory,
      sector: placement.sector,
      amount: 2,
      elite: 0,
      allyPayment: 0,
    },
  };
  actions.push(structuredClone(shipment));
  game = applyAction(game, shipment.actor, shipment.action);
  game = advanceTestingStationContest(
    game,
    (state) => state.phase === 7 && clean(state) && !state.pendingShipment,
    actions,
  );
  assert.equal(game.turn, 1);
  assert.ok(viewGame(game, ecaz).discoveries!.canInspect.includes(token.id));
  const inspect: TestingStationContestStep = {
    actor: ecaz,
    action: { type: 'discovery', token: token.id, reveal: false },
  };
  const reveal: TestingStationContestStep = {
    actor: ecaz,
    action: { type: 'discovery', token: token.id, reveal: true },
  };
  for (const next of [inspect, reveal]) {
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(
    game.discoveries!.tokens.find((candidate) => candidate.id === token.id)!.revealedTurn,
    1,
  );
  staging.push(
    'Ordinary paid shipment to the printed destination followed by that seat’s real Collection inspection and public reveal.',
  );

  // Turn two: the location's own next-turn free entry, then a real worm Nexus
  // and reciprocal alliance, then the ally's ordinary paid shipment.
  game = advanceTestingStationContest(
    game,
    (state) =>
      state.turn === 2 &&
      state.decision?.kind === 'discoveryEntry' &&
      state.decision.player === ecaz,
    actions,
  );
  const entry = nextTestingStationContestStep(game);
  assert.ok(entry, 'The station occupant must receive its real free-entry choice.');
  assert.equal(entry.action.type, 'decision');
  assert.equal(entry.action.accept, true);
  actions.push(structuredClone(entry));
  game = applyAction(game, entry.actor, entry.action);
  assert.equal(fighterCount(game.players.find((p) => p.id === ecaz)!, location), 2);
  staging.push(
    'The first occupant entered through real next-turn free entry; no force was placed there directly.',
  );

  game = selectedForecastOne(advanced && !!options.forecastOne, () =>
    advanceTestingStationContest(
      game,
      (state) =>
        state.turn === 2 &&
        state.phase === 1 &&
        !!state.nexus &&
        !state.spiceWindow &&
        !state.spiceResolution &&
        clean(state),
      actions,
    ));
  const offer: TestingStationContestStep = { actor: ecaz, action: { type: 'alliance', target: guild } };
  const accept: TestingStationContestStep = { actor: guild, action: { type: 'alliance', target: ecaz } };
  for (const next of [offer, accept]) {
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.players.find((player) => player.id === ecaz)!.ally, guild);
  assert.equal(game.players.find((player) => player.id === guild)!.ally, ecaz);
  game = advanceTestingStationContest(
    game,
    (state) => state.phase === 5 && state.active === guild && clean(state),
    actions,
  );
  const secondShipment: TestingStationContestStep = {
    actor: guild,
    action: {
      type: 'ship',
      territory: location,
      sector: 0,
      amount: secondAmount,
      elite: 0,
      allyPayment: 0,
    },
  };
  actions.push(structuredClone(secondShipment));
  game = applyAction(game, secondShipment.actor, secondShipment.action);
  game = advanceTestingStationContest(game,clean,actions);
  assert.equal(fighterCount(game.players.find((p) => p.id === guild)!, location), secondAmount);
  staging.push(
    'A real worm Nexus produced the reciprocal Ecaz/Guild alliance; the ally then used its own ordinary paid shipment into the occupied revealed location.',
  );
  return {initial,setup,afterSetup,game,actions,staging,location,owners:[ecaz,guild],
    token:token.id,parent:placement.territory,parentSector:placement.sector};
}

/** The original station-specific tail retains its real natural Storm window. */
export function createTestingStationContestFixture(
  options: {advanced?:boolean} = {},
): TestingStationContestFixture {
  const prefix = createDiscoveryOccupantsFixture({...options,location:STATION});
  const {initial,setup,afterSetup,actions,staging} = prefix;
  let game = prefix.game;

  game = advanceTestingStationContest(
    game,
    (state) => state.turn === 3 && state.phase === 0 && clean(state),
    actions,
  );
  const beforeStorm = structuredClone(game);
  game = advanceTestingStationContest(
    game,
    (state) => state.turn === 3 && state.phase === 0 && state.decision?.kind === 'ecologicalStorm',
    actions,
  );
  const frame = game.ecologicalStorm!;
  assert.ok(
    actions.some((next) => next.action.type === 'ship') &&
      actions.some((next) => next.action.type === 'alliance') &&
      actions.some((next) => next.action.type === 'discovery') &&
      actions.some(
        (next) => next.action.type === 'decision' && next.action.accept === true,
      ),
    'The contested station must be reached through real controls only.',
  );
  const occupants = testingStationOccupants(game);
  assert.equal(occupants.length, 2);
  assert.deepEqual(frame.queue?.order, occupants);
  assert.deepEqual(
    occupants,
    testingStationStormOrder(game, occupants),
    'Both occupants must queue in original storm order.',
  );
  const seats = game.players
    .map((player) => player.id)
    .filter((id) => occupants.includes(id));
  if (JSON.stringify(seats) !== JSON.stringify(testingStationStormOrder(game, seats)))
    assert.notDeepEqual(
      occupants,
      seats,
      'The contested queue must use the printed storm order, never seat order.',
    );
  assert.equal(frame.owner, occupants[0]);
  assert.equal(game.decision!.player, frame.owner);
  assert.ok(game.decision?.kind === 'ecologicalStorm');
  assert.equal(frame.event, game.decision!.event);
  assert.notEqual(game.stormMovementSource?.kind, 'weather');
  assert.equal(game.stormMovementSource?.turn, 3);
  assert.equal(game.stormPending, game.stormMovementSource!.distance);
  assert.equal(game.ecologicalStorm!.base, game.stormPending);
  return {
    initial,
    setup,
    afterSetup,
    game,
    beforeStorm,
    actions,
    staging,
    owner: occupants[0],
    second: occupants[1],
    token: prefix.token,
    parent: prefix.parent,
    parentSector: prefix.parentSector,
    source: {
      turn: game.stormMovementSource!.turn,
      kind: game.stormMovementSource!.kind,
      distance: game.stormMovementSource!.distance,
    },
    order: [occupants[0], occupants[1]],
    event: frame.event,
  };
}
