import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { isAdvisor } from '../game/advisors';
import { actFutureShipment, nextFutureShipmentStep, futureShipmentClean, futureShipmentPlayer } from './fixture-truthtrance-future-shipment';
import { truthMovementInventory } from './fixture-truth-movement';

export type TruthtranceAdvancedShipmentPreparationKind = 'bgCharity' | 'elite';
export type TruthtranceAdvancedShipmentPreparationStep = { actor: string; action: Action };
export const actTruthtranceAdvancedShipmentPreparation = actFutureShipment;
export const truthtranceAdvancedShipmentPreparationPlayer = futureShipmentPlayer;
export const truthtranceAdvancedShipmentPreparationInventory = truthMovementInventory;
export const truthtranceAdvancedShipmentPreparationClean = futureShipmentClean;

/** Actual public setup/readiness controls. An earned owned preparation stays
 * caller-controlled instead of being skipped by a generic Ready action. */
export function nextTruthtranceAdvancedShipmentPreparation(game: Game): TruthtranceAdvancedShipmentPreparationStep | null {
  if (!game.response && !game.phaseOpening && !game.truthtrance && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'emperor', turn: 10 } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup &&
        viewGame(game, bg.id).setupPending.includes(bg.id))
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    if (game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.status === 'playing' && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial',
        amount: game.turn === 1 ? actor === game.stormDialers[0] ? 11 : 0 : 1 } };
    }
    if ([2, 4].includes(game.phase) && game.players.some(p => viewGame(game, p.id).shipmentPreparation?.actions.length)) return null;
  }
  return nextFutureShipmentStep(game);
}
export const nextTruthtranceAdvancedShipmentPreparationStep = nextTruthtranceAdvancedShipmentPreparation;
export function advanceTruthtranceAdvancedShipmentPreparation(game: Game, until: (state: Game) => boolean,
  actions: TruthtranceAdvancedShipmentPreparationStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextTruthtranceAdvancedShipmentPreparation(game);
    assert.ok(step, `Choose the original question, preparation or shipment at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actTruthtranceAdvancedShipmentPreparation(game, step.actor, step.action, actions);
  }
  throw Error('The original Advanced shipment-preparation chronology did not reach its finite boundary');
}

/** Public Advanced-only sources. BG's real wealthy Charity and Emperor's
 * real elite-only Tanks are earned without assigning played resource state. */
export function createTruthtranceAdvancedShipmentPreparationFixture(options: { kind: TruthtranceAdvancedShipmentPreparationKind }) {
  const { kind } = options, asker = 'atreides', target = kind === 'bgCharity' ? 'beneGesserit' : 'emperor';
  const roster = kind === 'bgCharity' ? ['beneGesserit', 'emperor'] as const : ['emperor', 'harkonnen', 'guild'] as const;
  let game = createGame('TRUTHADVANCEDSHIPMENTPREPARATION', newPlayer(asker, 'Atreides', 'atreides'), false);
  for (const faction of roster) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: TruthtranceAdvancedShipmentPreparationStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceAdvancedShipmentPreparation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceAdvancedShipmentPreparation(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  const rules = transition(() => { act(game.host, { type: 'rules', advanced: true }); });
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.advancedPreview, true);
  assert.deepEqual(game.expansions, []); assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = truthtranceAdvancedShipmentPreparationInventory(game); assert.equal(originalInventory.length, 33);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const printed = game.deck.find(card => card.effect === 'karama');
  const shield = game.deck.find(card => card.kind === 'shield'), snooper = game.deck.find(card => card.kind === 'snooper');
  const ordinary = game.deck.find(card => card.kind === 'projectile'), auctionFace = game.deck.find(card => card.name === 'Baliset');
  assert.ok(truth && printed && shield && snooper && ordinary && auctionFace);
  const selected = kind === 'bgCharity' ? [truth, shield, printed] : [truth, printed, shield, snooper, ordinary];
  const deckSelection = [...selected, ...(kind === 'elite' ? [auctionFace] : [])];
  const dealOrder = deckSelection.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: TruthtranceAdvancedShipmentPreparationStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextTruthtranceAdvancedShipmentPreparation(game); assert.ok(step);
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (kind === 'elite' ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['hagga_basin', 'carthag', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  const firstStorm = transition(() => { reach(state => state.turn === 1 && state.phase === 1); });
  assert.equal(game.storm, 12);
  let purchase: ReturnType<typeof transition> | null = null, beforeBid: Game | null = null;
  let shipment: ReturnType<typeof transition> | null = null, beforeStormMovement: Game | null = null;
  let stormLoss: ReturnType<typeof transition> | null = null, originalStormSource: Game['stormMovementSource'] | null = null;
  let auctionCard: string | null = null;
  if (kind === 'elite') {
    reach(state => state.turn === 1 && state.phase === 3 && truthtranceAdvancedShipmentPreparationClean(state) &&
      !!state.auction && state.auction.active === asker && state.auction.bid === 0);
    beforeBid = structuredClone(game); auctionCard = game.auction!.cards[game.auction!.index].id;
    assert.equal(auctionCard, auctionFace.id);
    purchase = transition(() => {
      act(asker, { type: 'bid', amount: 4 });
      reach(state => state.turn === 1 && state.phase === 4 && truthtranceAdvancedShipmentPreparationClean(state));
    });
    assert.equal(truthtranceAdvancedShipmentPreparationPlayer(game, 'emperor').spice, 14);
    assert.equal(truthtranceAdvancedShipmentPreparationPlayer(game, asker).spice, 6);
    assert.ok(truthtranceAdvancedShipmentPreparationPlayer(game, asker).hand.some(card => card.id === auctionCard));
    reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthtranceAdvancedShipmentPreparationClean(state));
    shipment = transition(() => {
      act(target, { type: 'ship', territory: 'hagga_basin', sector: 13, amount: 2, elite: 2, allyPayment: 0 });
      reach(truthtranceAdvancedShipmentPreparationClean);
    });
    assert.equal(truthtranceAdvancedShipmentPreparationPlayer(shipment.before, target).spice - truthtranceAdvancedShipmentPreparationPlayer(game, target).spice, 4);
    assert.equal(truthtranceAdvancedShipmentPreparationPlayer(game, target).spice, 10);
    assert.equal(truthtranceAdvancedShipmentPreparationPlayer(game, target).elites?.forces['hagga_basin:13'], 2);
    reach(state => state.turn === 2 && state.phase === 0 && !state.response && !state.phaseOpening && state.stormPending === 1);
    beforeStormMovement = structuredClone(game); originalStormSource = structuredClone(game.stormMovementSource);
    stormLoss = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
    assert.equal(game.storm, 13); assert.equal(truthtranceAdvancedShipmentPreparationPlayer(game, target).elites?.tanks, 2);
    reach(state => state.turn === 2 && state.phase === 4 && truthtranceAdvancedShipmentPreparationClean(state));
    const p = truthtranceAdvancedShipmentPreparationPlayer(game, target);
    assert.equal(p.spice, 10); assert.equal(p.reserves, 18); assert.equal(p.tanks, 2);
    assert.equal(p.elites?.reserves, 3); assert.equal(p.elites?.tanks, 2); assert.equal(p.elites?.revived, 0);
    assert.ok(p.hand.some(card => card.id === printed.id));
  } else {
    reach(state => state.turn === 1 && state.phase === 2 && truthtranceAdvancedShipmentPreparationClean(state));
    const p = truthtranceAdvancedShipmentPreparationPlayer(game, target); assert.ok(advisorSetup);
    assert.equal(p.spice, 5); assert.equal(p.reserves, 19); assert.equal(p.tanks, 0);
    assert.equal(p.forces['arrakeen:10'], 1); assert.equal(isAdvisor(p, 'arrakeen'), true);
    assert.ok(!p.hand.some(card => card.effect === 'karama'));
  }
  const source = structuredClone(game), minimum = kind === 'bgCharity' ? 7 : 19;
  const question: TruthQuestion = { kind: 'shipment', target, territory: 'carthag', minimum };
  const declarationStep: TruthtranceAdvancedShipmentPreparationStep = { actor: asker, action: { type: 'card', card: truth.id } };
  const askStep: TruthtranceAdvancedShipmentPreparationStep = { actor: asker, action: { type: 'truthAsk', question } };
  const charityAction: Action = { type: 'charity' }, revivalAction: Action = { type: 'revive', amount: 1, elite: 1, freeElite: 1 };
  const rateAction: Action | null = kind === 'elite' ? { type: 'card', card: printed.id, mode: 'shipment', target } : null;
  const shipmentAction: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: minimum,
    elite: kind === 'elite' ? 4 : 0, allyPayment: 0 };
  assert.ok(truthtranceAdvancedShipmentPreparationPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.deepEqual(truthtranceAdvancedShipmentPreparationInventory(game), originalInventory);
  return { game, source, beforeQuestion: source, advanced: true as const, kind, asker, target, emperor: 'emperor', guild: kind === 'elite' ? 'guild' : null,
    card: truth.id, truth: truth.id, truthtrance: truth.id, karama: printed.id,
    targetKarama: kind === 'elite' ? printed.id : null, counterHolder: kind === 'bgCharity' ? 'emperor' : null,
    question, minimum, impossibleMinimum: minimum + 1, territory: 'carthag', sector: 11, location: 'carthag:11',
    declarationStep, askStep, charityAction, revivalAction, rateAction, shipmentAction,
    initial, rules, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalCards: originalInventory, originalSpice, spiceOrder,
    firstStorm, beforeBid, auctionCard, purchase, shipment, beforeStormMovement, originalStormSource, stormLoss,
    balances: Object.fromEntries(game.players.map(p => [p.id, p.spice])),
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public classic lobby rules advanced:true, real Ready and start advancedPreview:true, original base33 and no modules. Only original unopened starting/auction deck positions, safe original Spice positions and native scalar lotteries are selected. No played hand, wallet, phase, force, Tank, elite or promise is installed.',
      kind === 'bgCharity'
        ? 'Original A/BG/E deal gives A Truthtrance, BG an ordinary card and Emperor printed Karama. BG really places its starting advisor beside native A10 Arrakeen, retaining five spice and nineteen reserves. Stop at original first Charity, before wealthy Advanced BG actually claims two. The seven-force city question needs that real owned preparation; no Karama is held by its target. The independently held original Emperor card can actually cancel that Charity.'
        : 'Original A/E/H/G deal gives A Truthtrance, E printed Karama, H its two ordinary cards and G an ordinary card. An actual A bid4 buys the selected original ordinary first auction lot and pays E four through native seller income. E then really pays four for two Sardaukar at Hagga13 after first dials11+0→12. Original next StormCard1 reaches13 and kills both. Native turn2 phases/auction passes reach Revival with E10 cash, eighteen reserves and two actual elite-only Tanks. One free elite return plus the held original Karama can fund nineteen city counters; the one-elite limit prevents a twentieth.',
    ],
  };
}
export type TruthtranceAdvancedShipmentPreparationFixture = ReturnType<typeof createTruthtranceAdvancedShipmentPreparationFixture>;

export function askTruthtranceAdvancedShipmentPreparation(game: Game, fixture: TruthtranceAdvancedShipmentPreparationFixture,
  minimum = fixture.minimum, actions: TruthtranceAdvancedShipmentPreparationStep[] = []): Game {
  game = actTruthtranceAdvancedShipmentPreparation(game, fixture.asker, fixture.declarationStep.action, actions);
  game = advanceTruthtranceAdvancedShipmentPreparation(game, state => state.truthtrance?.stage === 'ask', actions);
  return actTruthtranceAdvancedShipmentPreparation(game, fixture.asker,
    { type: 'truthAsk', question: { ...fixture.question, minimum } }, actions);
}
