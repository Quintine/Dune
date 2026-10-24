import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorMatchingMoveDirection = 'advisorsToFighters' | 'fightersToAdvisors';
export type AdvisorMatchingMoveStep = { actor: string; action: Action };
export type AdvisorMatchingMoveTransition = { before: Game; steps: AdvisorMatchingMoveStep[]; after: Game };
export const actAdvisorMatchingMove = actAdvisorPreparation;
export const advisorMatchingMovePlayer = advisorPreparationPlayer;
export const advisorMatchingMoveInventory = advisorPreparationInventory;
export const advisorMatchingMoveClean = advisorPreparationClean;

/** Original preparation is declined. Any advisorFlip response after the owned
 * movement declaration remains caller-owned, including a new matching quote. */
export function nextAdvisorMatchingMove(game: Game): AdvisorMatchingMoveStep | null {
  if (game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision?.kind === 'advisorBattle')
    return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorMatchingMove(game: Game, until: (state: Game) => boolean,
  steps: AdvisorMatchingMoveStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native matching-move chronology ended before its requested boundary');
    const next = nextAdvisorMatchingMove(game);
    assert.ok(next, `Choose the original matching response at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorMatchingMove(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor matching source did not reach its finite boundary');
}
export function passAdvisorMatchingMove(game: Game, steps: AdvisorMatchingMoveStep[] = []): Game {
  for (let count = 0; game.response && game.response.kind !== 'advisorFlip' && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorMatchingMove(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.kind === 'advisorFlip'); return game;
}

/** Genuine public Advanced BG/Atreides/Emperor base33 source. An original
 * advisor and a separate paid native fighter are earned before the owned move.
 * No matching rule permission, response, stance or committed move is installed. */
export function createAdvisorMatchingMoveFixture(options: { direction?: AdvisorMatchingMoveDirection } = {}) {
  const direction = options.direction ?? 'advisorsToFighters';
  const bg = 'beneGesserit', holder = 'atreides', emperor = 'emperor';
  let game = createGame('ADVISORMATCHINGMOVE', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), steps: AdvisorMatchingMoveStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorMatchingMove(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorMatchingMove(game, until, steps); };
  const transition = (run: () => void): AdvisorMatchingMoveTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorMatchingMoveInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorMatchingMoveTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorMatchingMove(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorMatchingMovePlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorMatchingMovePlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorMatchingMovePlayer(game, holder).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(bg, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === bg && advisorMatchingMoveClean(state));
  });
  const beforeShipment = structuredClone(game), beforeShipmentActionCount = steps.length;
  const matchingShipmentAction: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 };
  const shipment = transition(() => {
    act(bg, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(advisorMatchingMoveClean);
  });
  const player = advisorMatchingMovePlayer(game, bg);
  assert.equal(advisorMatchingMovePlayer(shipment.before, bg).spice - player.spice, 2);
  assert.equal(game.active, bg); assert.equal(game.phase, 5); assert.ok(advisorMatchingMoveClean(game));
  assert.equal(player.forces['arrakeen:10'], 1); assert.ok(player.advisors?.arrakeen);
  assert.equal(player.forces['imperial_basin:9'], 1); assert.ok(!player.advisors?.imperial_basin);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0);
  assert.equal(advisorMatchingMovePlayer(game, holder).forces['arrakeen:10'], 10);
  assert.ok(advisorMatchingMovePlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorMatchingMoveInventory(game), originalInventory);
  const advisorsToFighters: Action = { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 };
  const fightersToAdvisors: Action = { type: 'move', from: 'imperial_basin:9', territory: 'arrakeen', sector: 10, amount: 1 };
  const ordinaryAction: Action = { type: 'move', from: 'imperial_basin:9', territory: 'imperial_basin', sector: 10, amount: 1 };
  const action = direction === 'advisorsToFighters' ? advisorsToFighters : fightersToAdvisors;
  const origin = direction === 'advisorsToFighters' ? 'arrakeen' : 'imperial_basin';
  const destination = direction === 'advisorsToFighters' ? 'imperial_basin' : 'arrakeen';
  const sourceLocation = direction === 'advisorsToFighters' ? 'arrakeen:10' : 'imperial_basin:9';
  const destinationLocation = direction === 'advisorsToFighters' ? 'imperial_basin:9' : 'arrakeen:10';
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, openingOffer, declinedPreparation,
    beforeShipment, beforeShipmentActionCount, matchingShipmentAction, shipment,
    direction, bg, owner: bg, holder, atreides: holder, emperor, observer: emperor,
    karama: karama.id, card: karama.id, actor: bg, action, origin, destination,
    sourceLocation, destinationLocation, from: sourceLocation, to: destinationLocation, amount: 1,
    advisorsToFighters, fightersToAdvisors, ordinaryAction,
    movementStep: { actor: bg, action } satisfies AdvisorMatchingMoveStep,
    ordinaryStep: { actor: bg, action: ordinaryAction } satisfies AdvisorMatchingMoveStep,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Atreides/Emperor ready/startPreview, native prediction/private Traitor choices, original base33 and no optional module. Original advisorSetup places one peaceful BG advisor beside Atreides’ native ten Arrakeen10 counters.',
      'Select only original scalar shuffle draws, three original unopened Treachery positions and two original unopened ordinary Spice positions. Atreides is actually dealt its original Karama; BG/Emperor receive ordinary cards. No later hand or card acquisition is staged.',
      'Actually complete safe first Storm, both Spice blows, Charity, Bidding and Revival, then decline the original advisor preparation. During its real first turn BG pays two to ship one original reserve into empty Basin9 as a fighter, retaining the original Arrakeen advisor.',
      'Stop with shipment genuinely used and ordinary movement still unused. Both original one-counter move payloads are exposed: advisor Arrakeen10 into own Basin9 fighter, or that fighter into own Arrakeen advisor. The matching rule response/permission and any force/stance/move consumption remain caller-owned outcomes.',
      'An additional ordinary control repositions the genuinely earned Basin fighter from sector9 to empty sector10 of the same territory. It introduces no opposing BG stance; no second manufactured group is claimed.',
      'No played force, phase, wallet, hand, advisor stance, Tanks, prevention, matching response or movement receipt is installed.',
    ] };
}
export type AdvisorMatchingMoveFixture = ReturnType<typeof createAdvisorMatchingMoveFixture>;

/** Branch at the actual earlier unshipped source window. Its logged prefix
 * ends before the separate Basin shipment; the owned payload instead sends a
 * real reserve to the original resident Arrakeen advisor. No later state is set. */
export function createAdvisorMatchingShipmentFixture() {
  const fixture = createAdvisorMatchingMoveFixture();
  const game = structuredClone(fixture.beforeShipment);
  const steps = structuredClone(fixture.steps.slice(0, fixture.beforeShipmentActionCount));
  const action = fixture.matchingShipmentAction;
  assert.equal(advisorMatchingMovePlayer(game, fixture.bg).shipped, false);
  assert.equal(advisorMatchingMovePlayer(game, fixture.bg).moved, 0);
  assert.equal(advisorMatchingMovePlayer(game, fixture.bg).forces['imperial_basin:9'] ?? 0, 0);
  return { ...fixture, game, source: structuredClone(game), beforeAction: structuredClone(game),
    kind: 'shipment' as const, origin: 'reserves', destination: 'arrakeen',
    sourceLocation: 'reserves', destinationLocation: 'arrakeen:10', from: 'reserves', to: 'arrakeen:10',
    actor: fixture.bg, action, amount: 1, cost: 1,
    shipmentStep: { actor: fixture.bg, action } satisfies AdvisorMatchingMoveStep,
    steps, actions: steps, sourceActionCount: steps.length,
    staging: [
      'Use the recorded genuine earlier public Advanced BG/Atreides/Emperor source prefix: original base33, prediction/private Traitors, actual BG advisorSetup beside A10 in Arrakeen10, original A Karama and ordinary BG/Emperor starting cards.',
      'Only original scalar shuffle draws, three original unopened Treachery positions and two original unopened ordinary Spice positions are selected. Native first Storm, both Spice blows, Charity, Bidding and Revival execute; original advisor preparation is actually declined.',
      'Return the actual saved source snapshot before BG’s first shipment, with both shipment and movement unused and no Basin counter present. Its action log ends at that original prefix; the separately recorded Basin shipment belongs only to the ground-move branch.',
      'The owned normal reserve-shipment payload sends one original reserve into BG’s resident Arrakeen advisor group for the normal one-spice stronghold price. Matching response, price payment, physical shipment and allowance consumption remain caller-owned outcomes; no response or permission is installed.',
    ] };
}

/** Submit only the original owned move declaration; never answer its counter. */
export function commitAdvisorMatchingMove(source: Game, fixture: AdvisorMatchingMoveFixture,
  steps: AdvisorMatchingMoveStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorMatchingMove(source, fixture.actor, fixture.action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
export function finishAdvisorMatchingMove(source: Game, steps: AdvisorMatchingMoveStep[] = []): Game {
  return advanceAdvisorMatchingMove(source,
    game => game.phase >= 6 && game.phase <= 7 && advisorMatchingMoveClean(game), steps);
}
