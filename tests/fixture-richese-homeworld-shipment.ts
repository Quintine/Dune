import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { NoFieldValue } from '../game/richese-no-field';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldPopulations } from '../game/homeworld-population';
import { actTruthMovement, type TruthMovementStep } from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';

export type RicheseHomeworldShipmentStep = TruthMovementStep;
export type RicheseHomeworldShipmentTransition = { before: Game; steps: RicheseHomeworldShipmentStep[]; after: Game };
export const actRicheseHomeworldShipment = actTruthMovement;
export const richeseHomeworldShipmentPlayer = (game: Game, actor = 'richese') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const richeseHomeworldShipmentClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function richeseHomeworldShipmentInventory(game: Game) {
  homeworldGameIntegrity(game);
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0);
  for (const player of game.players) {
    const visitors = Object.values(game.homeworlds!.custody!.visitors)
      .map(groups => groups[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((total, group) => total + group.normal + group.elite, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) +
      visitors.reduce((total, group) => total + group.elite, 0), 5);
  }
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? []),
    ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original main/cache card retains one physical slot');
  return ids;
}
export const richeseHomeworldShipmentPopulation = (game: Game, owner = 'richese') => {
  const home = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.native === owner && home.card === 'richese'); assert.ok(home); return home;
};

/** Native pass/unbid controls only. Cache selection always uses an actual
 * remaining card, so a prior retired lot is never requested again. Emperor
 * really takes ordinary Charity when eligible; no balance is installed. */
export function nextRicheseHomeworldShipment(game: Game): RicheseHomeworldShipmentStep | null {
  if (game.truthtrance) return null;
  if (richeseHomeworldShipmentClean(game)) {
    if (game.status === 'playing' && game.phase === 2) {
      const emperor = richeseHomeworldShipmentPlayer(game, 'emperor');
      if (emperor.spice < 2 && emperor.charityTurn !== game.turn)
        return { actor: emperor.id, action: { type: 'charity' } };
    }
    if (game.status === 'playing' && game.phase === 5 && game.active === 'emperor')
      return { actor: 'emperor', action: { type: 'endMovement' } };
  }
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise', keepUnbid: false,
    card: game.richeseCache?.[0]?.id,
  });
}
export const nextRicheseHomeworldShipmentNativeStep = nextRicheseHomeworldShipment;
export function advanceRicheseHomeworldShipment(game: Game, until: (state: Game) => boolean,
  actions: RicheseHomeworldShipmentStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Richese programme ended before its requested control');
    const next = nextRicheseHomeworldShipment(game);
    assert.ok(next, `Supply the original owned control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actRicheseHomeworldShipment(game, next.actor, next.action, actions);
  }
  throw Error('The genuine Richese Homeworld shipment source did not reach its finite boundary');
}
export function passRicheseHomeworldShipment(game: Game, actions: RicheseHomeworldShipmentStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actRicheseHomeworldShipment(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function finishRicheseHomeworldShipment(game: Game, actions: RicheseHomeworldShipmentStep[] = []): Game {
  return advanceRicheseHomeworldShipment(game, richeseHomeworldShipmentClean, actions);
}

/** Actual public Basic/Advanced Richese/Emperor with Homeworlds, original35+10
 * cards and undeployed original No-Fields. Native deferred bribes fund one
 * combined invoice without changing either physical army. Stop BEFORE ship. */
export function createRicheseHomeworldShipmentFixture(options: {
  advanced?: boolean; companions?: number; value?: NoFieldValue;
} = {}) {
  const advanced = options.advanced ?? false, companions = options.companions ?? 11, value = options.value ?? 5;
  assert.ok(Number.isSafeInteger(companions) && companions >= 1 && companions <= 16,
    'The bounded native funding programme supports one through sixteen companions');
  const owner = 'richese', holder = 'emperor', territory = 'arrakeen', sector = 10, location = 'arrakeen:10';
  const cost = 1 + companions;
  let game = createGame('RICHESEHOMEWORLDSHIPMENT', newPlayer(owner, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(holder, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: RicheseHomeworldShipmentStep[] = [];
  const act = (actor: string, action: Action) => { game = actRicheseHomeworldShipment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceRicheseHomeworldShipment(game, until, actions); };
  const transition = (run: () => void): RicheseHomeworldShipmentTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['choam']);
  assert.ok(game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalMainDeck = game.deck.map(card => card.id), originalCache = game.richeseCache!.map(card => card.id);
  assert.equal(originalMainDeck.length, 35); assert.equal(originalCache.length, 10);
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(ordinary && karama);
  const deal = [ordinary.id, karama.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalNoField = structuredClone(richeseHomeworldShipmentPlayer(game, owner).noField);
  assert.ok(originalNoField);
  assert.deepEqual(originalNoField.tokens.map(token => token.value).sort((a, b) => a - b), [0, 3, 5]);
  assert.equal(originalNoField.deployed, null); assert.equal(originalNoField.lastShipped, null);
  assert.deepEqual(richeseHomeworldShipmentPlayer(game, owner).hand.map(card => card.id), [ordinary.id]);
  assert.deepEqual(richeseHomeworldShipmentPlayer(game, holder).hand.map(card => card.id), [karama.id]);
  assert.equal(richeseHomeworldShipmentPlayer(game, owner).reserves, 20);
  assert.deepEqual(richeseHomeworldShipmentPlayer(game, owner).forces, {});
  const originalInventory = richeseHomeworldShipmentInventory(game); assert.equal(originalInventory.length, 45);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3, 4, 5].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && richeseHomeworldShipmentClean(state));
  const beforeFunding = structuredClone(game), funding: RicheseHomeworldShipmentTransition[] = [];
  for (let count = 0; richeseHomeworldShipmentPlayer(game, owner).spice < cost && count < 3; count++) {
    const donor = richeseHomeworldShipmentPlayer(game, holder);
    const amount = Math.min(cost - richeseHomeworldShipmentPlayer(game, owner).spice, donor.spice);
    assert.ok(amount > 0, 'Actual Emperor income must fund the next deferred bribe');
    funding.push(transition(() => { act(holder, { type: 'bribe', target: owner, amount }); }));
    const turn = game.turn;
    reach(state => state.turn === turn + 1 && state.phase === 5 && state.active === owner && richeseHomeworldShipmentClean(state));
  }
  assert.ok(richeseHomeworldShipmentPlayer(game, owner).spice >= cost);
  const player = richeseHomeworldShipmentPlayer(game, owner);
  assert.equal(player.reserves, 20); assert.deepEqual(player.forces, {}); assert.equal(player.tanks, 0);
  assert.equal(player.bribes, 0); assert.equal(player.shipped, false); assert.equal(player.moved, 0);
  assert.equal(richeseHomeworldShipmentPopulation(game, owner).side, 'high');
  assert.ok(richeseHomeworldShipmentPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(richeseHomeworldShipmentInventory(game), originalInventory);
  const token = player.noField!.tokens.find(token => token.value === value); assert.ok(token);
  const event = player.noFieldEvent; assert.ok(event);
  const action: Action = { type: 'ship', noField: token.id, event, noFieldReserves: companions,
    territory, sector, allyPayment: 0 };
  const cancel: Action = { type: 'card', card: karama.id, mode: 'cancel' };
  const replacement: Action = { type: 'ship', amount: 1, elite: 0, territory, sector, allyPayment: 0,
    homeworldSources: { 'homeworld:richese': { normal: 1, elite: 0 } } };
  return { game, source: structuredClone(game), beforeShipment: structuredClone(game), initial, enableHomeworlds,
    lobby, setup, beforeStartingDeal, afterSetup, beforeFunding, funding,
    advanced, owner, richese: owner, actor: owner, holder, emperor: holder,
    companions, noFieldReserves: companions, amount: companions, physical: companions, priced: companions + 1,
    cost, shipmentCost: cost, value, markerValue: value, token: token.id, tokenId: token.id, event, shipmentEvent: event,
    territory, sector, location, action, shipmentAction: action,
    shipmentStep: { actor: owner, action } satisfies RicheseHomeworldShipmentStep,
    karama: karama.id, card: karama.id, cancel, cancelAction: cancel, replacement,
    ordinary: ordinary.id, originalNoField, noField: structuredClone(player.noField),
    originalInventory, originalCards: originalInventory, originalMainDeck, originalCache, originalSpice, deal, dealOrder, spiceOrder,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic/Advanced Richese/Emperor lobby enables only Homeworlds, then native ready/start with original main35/cache10 and all three native No-Field components. Only original scalar lotteries, two unopened Treachery positions and six unopened ordinary Spice positions are selected.',
      'Richese really receives an ordinary projectile and Emperor its printed original Karama. Every original Storm, Spice, Charity, native cache/normal auction, Black Market decline in Advanced, Revival, Movement ending and Mentat control is used. Real cache lots are passed and retired, never replaced or acquired by assigning a hand.',
      'The default eleven-companion stronghold invoice needs twelve spice. Emperor really pays Richese a seven-spice bribe during turn one; its pending recipient share becomes available only at the actual Mentat. Richese’s next unused turn retains all twenty original reserves and HIGH population before declaration.',
      'The sixteen-companion cap variant uses an actual ten-spice first bribe, next-turn Emperor Charity for two and a second two-spice bribe, both completed through real Mentat. Its third unused turn has seventeen spendable spice and the same untouched original twenty reserves. Smaller companion requests use only the native funding they need.',
      'Stop BEFORE the marker/physical shipment. The original token/event, opponent-held Karama, quiet unused shipment and exact funded combined invoice remain live caller inputs. No force, wallet, phase, hand, stance, token custody, canceled history or pending proof is installed.',
    ],
  };
}
export type RicheseHomeworldShipmentFixture = ReturnType<typeof createRicheseHomeworldShipmentFixture>;

export function commitRicheseHomeworldShipment(source: Game, fixture: RicheseHomeworldShipmentFixture,
  action: Action = fixture.action, actions: RicheseHomeworldShipmentStep[] = []) {
  const before = structuredClone(source), start = actions.length;
  let game = actRicheseHomeworldShipment(source, fixture.owner, action, actions);
  const requested = structuredClone(game);
  game = finishRicheseHomeworldShipment(game, actions);
  return { game, before, requested, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
}
export function revealRicheseHomeworldShipment(source: Game, fixture: RicheseHomeworldShipmentFixture,
  actions: RicheseHomeworldShipmentStep[] = []) {
  const before = structuredClone(source), start = actions.length, player = richeseHomeworldShipmentPlayer(source, fixture.owner);
  assert.ok(player.noField?.deployed && player.noFieldEvent);
  const action: Action = { type: 'revealNoField', token: player.noField.deployed.tokenId, event: player.noFieldEvent };
  let game = actRicheseHomeworldShipment(source, fixture.owner, action, actions);
  game = finishRicheseHomeworldShipment(game, actions);
  return { game, before, after: structuredClone(game), action, steps: structuredClone(actions.slice(start)) };
}
