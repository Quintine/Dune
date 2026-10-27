import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { actChoamCharityFunding } from './fixture-choam-charity-funding';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type FamilyAtomicsStep = StrongholdFactionsNativeStep;
export const actFamilyAtomics = actChoamCharityFunding;
export const familyAtomicsReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const familyAtomicsPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const familyAtomicsClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard && !game.truthtrance;
export const nextFamilyAtomicsStep = nextStrongholdFactionsNativeStep;
export function advanceFamilyAtomics(game: Game, until: (state: Game) => boolean,
  actions: FamilyAtomicsStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Atomics chronology ended before its requested boundary');
    const next = nextFamilyAtomicsStep(game); assert.ok(next, 'The quiet native source needs an actual control');
    game = actFamilyAtomics(game, next.actor, next.action, actions);
  }
  throw Error('The original Atomics chronology did not reach its finite boundary');
}
export function passFamilyAtomicsResponses(game: Game, actions: FamilyAtomicsStep[] = []): Game {
  while (game.response) {
    const next = nextFamilyAtomicsStep(game); assert.ok(next); assert.equal(next.action.type, 'passResponse');
    game = actFamilyAtomics(game, next.actor, next.action, actions);
  }
  return game;
}
export function finishFamilyAtomicsStorm(game: Game, actions: FamilyAtomicsStep[] = []): Game {
  return advanceFamilyAtomics(game, state => state.phase !== 0 && familyAtomicsClean(state), actions);
}
export function familyAtomicsInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.removedTreachery ?? []),
    ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, treacheryDeck(game.expansions).map(card => card.id).sort());
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort();
  assert.deepEqual(traitors, traitorDeck(game.players, false).sort());
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
  return { cards, traitors, spice };
}

/** Original bare A/H/E setup and one paid two-counter shipment. Only original
 * unopened Treachery/Spice positions and scalar lotteries are selected. The
 * blocked route earns Storm10 through the actual FIRST dials (9 + 0), leaving
 * real Imperial Basin11 fighters beyond Storm10 from the Wall's touching9.
 */
export function createFamilyAtomicsFixture(options: {
  advanced?: boolean; geometry?: 'wall' | 'adjacent' | 'blocked'; window?: 'beforeDistance' | 'calculated';
} = {}) {
  const advanced = options.advanced ?? true, geometry = options.geometry ?? 'wall';
  const window = options.window ?? 'calculated';
  assert.ok(!advanced || window === 'calculated', 'Advanced Storm2 reveals its distance immediately; use the original preceding Mentat snapshot');
  const owner = 'harkonnen', observer = 'emperor';
  let game = createGame('FAMILYATOMICS', newPlayer('atreides', 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer(owner, 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: FamilyAtomicsStep[] = [];
  const act = (actor: string, action: Action) => { game = actFamilyAtomics(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFamilyAtomics(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const atomics = game.deck.find(card => card.effect === 'atomics');
  const weather = game.deck.find(card => card.effect === 'weather');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 2);
  assert.ok(atomics && weather); assert.equal(ordinary.length, 2);
  const prefix = [ordinary[0], atomics, ordinary[1], weather];
  const dealOrder = prefix.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), prefix.map(card => card.id));
  const original = familyAtomicsInventory(game);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  const firstBeforeDistance = structuredClone(game), firstDialsFrom = actions.length;
  assert.equal(game.stormPending, null);
  for (const [index, actor] of game.stormDialers.entries())
    act(actor, { type: 'stormDial', amount: geometry === 'blocked' && index === 0 ? 9 : 0 });
  const firstAfterDistance = structuredClone(game), firstDials = structuredClone(actions.slice(firstDialsFrom));
  assert.equal(game.stormPending, geometry === 'blocked' ? 9 : 0);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && familyAtomicsClean(state));
  const shipmentBefore = structuredClone(game), shipmentFrom = actions.length;
  const destination = geometry === 'wall' ? { territory: 'shield_wall', sector: 9 }
    : { territory: 'imperial_basin', sector: 11 };
  const shipmentAction: Action = { type: 'ship', ...destination, amount: 2, elite: 0, allyPayment: 0 };
  act(owner, shipmentAction); reach(familyAtomicsClean);
  const shipment = { before: shipmentBefore, steps: structuredClone(actions.slice(shipmentFrom)), after: structuredClone(game) };
  assert.equal(familyAtomicsPlayer(shipmentBefore, owner).spice - familyAtomicsPlayer(game, owner).spice, 4);
  const location = `${destination.territory}:${destination.sector}`;
  assert.equal(familyAtomicsPlayer(game, owner).forces[location], 2);
  act(owner, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 8 && familyAtomicsClean(state) &&
    state.ready.length === state.players.length - 1);
  const beforeSecondStorm = structuredClone(game), beforeSecondStormActions = structuredClone(actions);
  const revealFrom = actions.length;
  reach(state => state.turn === 2 && state.phase === 0 && familyAtomicsClean(state));
  const afterSecondStormOpening = structuredClone(game), secondStormOpening = structuredClone(actions.slice(revealFrom));
  if (!advanced && window === 'calculated') reach(state => state.stormPending !== null && familyAtomicsClean(state));
  assert.equal(game.turn, 2); assert.equal(game.phase, 0); assert.equal(game.shieldWallDestroyed, false);
  assert.equal(game.storm, geometry === 'blocked' ? 10 : 1);
  if (advanced) assert.equal(game.stormPending, 1, 'The original Advanced card lottery is revealed immediately at turn start');
  else assert.equal(game.stormPending, window === 'beforeDistance' ? null : 2);
  assert.equal(familyAtomicsPlayer(game, owner).forces[location], 2);
  assert.equal(familyAtomicsPlayer(game, owner).tanks, 0);
  assert.ok(familyAtomicsPlayer(game, owner).hand.some(card => card.id === atomics.id));
  assert.deepEqual(familyAtomicsInventory(game), original);
  return { game, initial, lobby, setup, afterSetup, firstBeforeDistance, firstAfterDistance,
    firstDials, beforeSecondStorm, beforeSecondStormActions, afterSecondStormOpening, secondStormOpening,
    owner, observer, advanced, geometry, window, location, destination, card: atomics.id, weather: weather.id,
    action: { type: 'card', card: atomics.id } satisfies Action,
    shipmentAction, shipment, original, dealOrder, spiceOrder, actions, setupActions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, firstDials: firstDials.length, shipment: shipment.steps.length,
      beforeSecondStorm: beforeSecondStormActions.length, secondStormOpening: secondStormOpening.length, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Atreides/Harkonnen/Emperor base setup, native Traitors and starting armies. ` +
      'Select only original unopened Treachery/land-Spice positions and scalar lotteries. Harkonnen actually pays four spice to ship two original reserve counters; every intervening turn, auction and phase control is native. ' +
      (geometry === 'blocked' ? 'Actual first Storm dials9+0 earn Storm10; the surviving shipment is Imperial Basin11. '
        : `Actual first Storm dials0+0 retain Storm1; the surviving shipment is ${location}. `) +
      (advanced ? 'The final actual Mentat Ready automatically opens Storm2 and reveals its original one-sector card; no quiet Advanced turn2/null-distance state is claimed. '
        : 'Basic Storm2 retains its native dial window and is optionally actually calculated. ') +
      'All counts derive from recorded arrays. No held card, force, purse, phase, storm distance, wall, removal or discard is installed.' };
}
export type FamilyAtomicsFixture = ReturnType<typeof createFamilyAtomicsFixture>;
