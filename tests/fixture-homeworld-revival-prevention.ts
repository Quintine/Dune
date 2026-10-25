import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { distance, location, territory } from '../game/board';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldPopulations } from '../game/homeworld-population';
import { nativeShipmentSources } from '../game/homeworld-options';
import { actTruthMovement, type TruthMovementStep } from './fixture-truth-movement';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type HomeworldRevivalPreventionStep = TruthMovementStep;
export type HomeworldRevivalPreventionTransition = { before: Game; steps: HomeworldRevivalPreventionStep[]; after: Game };
export const actHomeworldRevivalPrevention = actTruthMovement;
export const homeworldRevivalPreventionPlayer = (game: Game, actor = 'fremen') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const homeworldRevivalPreventionClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export function homeworldRevivalPreventionInventory(game: Game) {
  homeworldGameIntegrity(game);
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0);
  for (const player of game.players) {
    const visitors = Object.values(game.homeworlds!.custody!.visitors)
      .map(groups => groups[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((total, group) => total + group.normal + group.elite, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) +
      visitors.reduce((total, group) => total + group.elite, 0), 3);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original Treachery Card retains one physical slot');
  return ids;
}
export const homeworldRevivalPreventionPopulation = (game: Game) => {
  const home = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.native === 'fremen' && home.card === 'southern_hemisphere'); assert.ok(home); return home;
};

/** Original setup and response controls only. The native revivalStop remains
 * owned by Tleilaxu; this helper never chooses prevention or its decline. */
export function nextHomeworldRevivalPrevention(game: Game): HomeworldRevivalPreventionStep | null {
  if (game.truthtrance) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'revivalStop') return null;
    const fremen = homeworldRevivalPreventionPlayer(game, 'fremen');
    if (game.status === 'setup' && game.setupStage === 'forces' && fremen.reserves === 20)
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 },
        elitePlacements: { 'sietch_tabr:14': 3 } } };
    if (game.status === 'playing' && game.turn === 1 && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: 6 } };
    }
    if (game.decision?.kind === 'wormRide' || game.decision?.kind === 'wormPlacement')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export const nextHomeworldRevivalPreventionNativeStep = nextHomeworldRevivalPrevention;
export function advanceHomeworldRevivalPrevention(game: Game, until: (state: Game) => boolean,
  actions: HomeworldRevivalPreventionStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Fremen chronology ended before its requested control');
    const next = nextHomeworldRevivalPrevention(game);
    assert.ok(next, `Choose the original revivalStop or owned control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actHomeworldRevivalPrevention(game, next.actor, next.action, actions);
  }
  throw Error('The native LOW-Homeworld revival source did not reach its finite boundary');
}
export function passHomeworldRevivalPrevention(game: Game, actions: HomeworldRevivalPreventionStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actHomeworldRevivalPrevention(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function finishHomeworldRevivalPrevention(game: Game, actions: HomeworldRevivalPreventionStep[] = []): Game {
  return advanceHomeworldRevivalPrevention(game, state => state.phase === 5 && homeworldRevivalPreventionClean(state), actions);
}

/** Actual public Advanced Fremen/Tleilaxu + Homeworlds/E1. Ship every ordinary
 * native Fremen reserve into the actual first Storm and allow native half-loss.
 * All three original Fedaykin remain safely in Tabr; no played force, Tank,
 * hand, wallet, phase or revival receipt is assigned. */
export function createHomeworldRevivalPreventionFixture(options: { ghola?: boolean } = {}) {
  const owner = 'tleilaxu', target = 'fremen', withGhola = options.ghola ?? true;
  let game = createGame('HOMEWORLDREVIVALPREVENTION', newPlayer(target, 'Fremen', 'fremen'), true, ['ix']);
  joinGame(game, newPlayer(owner, 'Tleilaxu', 'tleilaxu'));
  const initial = structuredClone(game), actions: HomeworldRevivalPreventionStep[] = [];
  const act = (actor: string, action: Action) => { game = actHomeworldRevivalPrevention(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceHomeworldRevivalPrevention(game, until, actions); };
  const transition = (run: () => void): HomeworldRevivalPreventionTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, ['ix']);
  assert.ok(game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = [...game.deck].map(card => card.id).sort(); assert.equal(originalInventory.length, 47);
  const karama = game.deck.find(card => card.effect === 'karama');
  const targetCard = game.deck.find(card => withGhola ? card.effect === 'ghola' : card.kind === 'projectile');
  assert.ok(karama && targetCard);
  const deal = [targetCard.id, karama.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), fremen = homeworldRevivalPreventionPlayer(game, target);
  assert.equal(game.storm, 1);
  assert.deepEqual(fremen.forces, { 'sietch_tabr:14': 10 });
  assert.deepEqual(fremen.elites?.forces, { 'sietch_tabr:14': 3 });
  assert.equal(fremen.reserves, 10); assert.equal(fremen.elites?.reserves, 0);
  assert.deepEqual(fremen.hand.map(card => card.id), [targetCard.id]);
  assert.deepEqual(homeworldRevivalPreventionPlayer(game, owner).hand.map(card => card.id), [karama.id]);
  assert.equal(homeworldRevivalPreventionPlayer(game, owner).faceDancers?.length, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['hagga_basin', 'sietch_tabr'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  const firstStorm = transition(() => { reach(state => state.turn === 1 && state.phase === 1 && state.storm === 13); });
  assert.deepEqual(firstStorm.steps.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [6, 6]);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && homeworldRevivalPreventionClean(state));
  const beforeShipment = structuredClone(game), destination = 'hagga_basin', sector = 13, key = 'hagga_basin:13';
  assert.ok(territory('the_great_flat').sectors.some(from => distance(location('the_great_flat', from), key) <= 2));
  assert.equal(game.storm, sector);
  const homeworldSources = nativeShipmentSources(viewGame(game, target), 10, 0); assert.ok(homeworldSources);
  const shipmentStep: HomeworldRevivalPreventionStep = { actor: target, action: {
    type: 'ship', amount: 10, elite: 0, territory: destination, sector, allyPayment: 0, homeworldSources,
  } };
  act(shipmentStep.actor, shipmentStep.action);
  const stormProtection = structuredClone(game);
  assert.equal(game.response?.kind, 'stormProtection'); assert.equal(game.response?.resume, 'shipment');
  assert.equal(homeworldRevivalPreventionPlayer(game, target).reserves, 0);
  const halfLoss = transition(() => { reach(homeworldRevivalPreventionClean); });
  const afterLoss = structuredClone(game), lost = homeworldRevivalPreventionPlayer(game, target);
  assert.equal(lost.spice, homeworldRevivalPreventionPlayer(beforeShipment, target).spice);
  assert.equal(lost.tanks, 5); assert.equal(lost.elites?.tanks, 0);
  assert.equal(lost.reserves, 0); assert.equal(homeworldRevivalPreventionPopulation(game).side, 'low');
  assert.deepEqual(lost.forces, { 'sietch_tabr:14': 10, [key]: 5 });
  assert.deepEqual(lost.elites?.forces, { 'sietch_tabr:14': 3 });
  reach(state => state.turn === 2 && state.phase === 4 && homeworldRevivalPreventionClean(state));
  assert.equal(homeworldRevivalPreventionPlayer(game, target).tanks, 5);
  assert.equal(homeworldRevivalPreventionPlayer(game, target).reserves, 0);
  assert.equal(homeworldRevivalPreventionPlayer(game, target).revived, 0);
  assert.equal(homeworldRevivalPreventionPopulation(game).population, 0);
  assert.ok(homeworldRevivalPreventionPlayer(game, owner).hand.some(card => card.id === karama.id));
  assert.deepEqual(homeworldRevivalPreventionInventory(game), originalInventory);
  const special: Action = { type: 'card', card: karama.id, mode: 'special', target };
  const request: Action = { type: 'revive', amount: 4, elite: 0 };
  const ghola: Action | null = withGhola ? { type: 'card', card: targetCard.id, amount: 5, elite: 0 } : null;
  return { game, source: structuredClone(game), initial, enableHomeworlds, lobby, setup, beforeStartingDeal, afterSetup,
    firstStorm, beforeShipment, shipmentStep, stormProtection, halfLoss, afterLoss,
    owner, tleilaxu: owner, target, fremen: target, karama: karama.id, card: karama.id, special, action: special,
    request, ordinaryRevival: request, ghola: withGhola ? targetCard.id : null, gholaAction: ghola,
    destination, territory: destination, sector, location: key, lowPopulation: 0, tanks: 5,
    originalInventory, originalCards: originalInventory, originalSpice, deal, dealOrder, spiceOrder,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Advanced Fremen/Tleilaxu ready/startPreview enables only Homeworlds and the original Ix47 deck. Native Traitor choices, actual three-card Face Dancer deal and Fremen setup place ten original counters including all three Fedaykin in Sietch Tabr14, leaving ten ordinary native reserves at Southern Hemisphere.',
      `Only native scalar lotteries, two unopened Treachery positions and four unopened ordinary Spice positions are selected. Tleilaxu receives its original printed Karama; Fremen receives ${withGhola ? 'the original Ghola' : 'an ordinary projectile'}. No held cards, forecast, phase, wallet, forces or casualty receipts are installed.`,
      'Two actual first-Storm secret dials of six move the real Storm from1 to13. Hagga Basin13 is within two territories of Great Flat15. After actual Spice/Charity/auction/Revival, Fremen really ships all ten ordinary native reserves there free using explicit Homeworld sources. Native stormProtection is allowed; its exact half-loss sends five ordinary counters to Tanks. The five survivors remain at13 and the three Fedaykin remain safely atTabr14.',
      'Real remaining Movement, peaceful Battle, Collection, Mentat, second Storm/Spice/Charity/Bidding reach clean turn-two Revival. Southern Hemisphere stays LOW0 with five actual ordinary Tanks. Original first/next Storm and Homeworld history are retained. The source stops before any four-free request or special Karama, with the original printed low rate and all quotas unused.',
      'The caller owns proactive special prevention, the original reactive revivalStop, its explicit decline, all native income responses and any original Ghola action. The source introduces no low-bonus-only return or phase bypass.',
    ],
  };
}
export type HomeworldRevivalPreventionFixture = ReturnType<typeof createHomeworldRevivalPreventionFixture>;

export function requestHomeworldRevivalPrevention(source: Game, fixture: HomeworldRevivalPreventionFixture,
  actions: HomeworldRevivalPreventionStep[] = []) {
  const before = structuredClone(source), start = actions.length;
  const game = actHomeworldRevivalPrevention(source, fixture.target, fixture.request, actions);
  assert.equal(game.decision?.kind, 'revivalStop');
  return { game, before, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
}
export function allowHomeworldRevivalPrevention(source: Game, fixture: HomeworldRevivalPreventionFixture,
  actions: HomeworldRevivalPreventionStep[] = []) {
  const before = structuredClone(source), start = actions.length;
  assert.equal(source.decision?.kind, 'revivalStop'); assert.equal(source.decision?.player, fixture.owner);
  let game = actHomeworldRevivalPrevention(source, fixture.owner, { type: 'decision', decline: true }, actions);
  game = advanceHomeworldRevivalPrevention(game, homeworldRevivalPreventionClean, actions);
  return { game, before, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
}
