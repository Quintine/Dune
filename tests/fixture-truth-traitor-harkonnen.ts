import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { nexusTraitorDrawAction, nexusTraitorReturnAction } from '../game/nexus-traitor-options';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actTruthTraitorDecision, truthTraitorDecisionClean, truthTraitorDecisionInventory,
  truthTraitorDecisionPlayer, truthTraitorDecisionTraitors, type TruthTraitorDecisionStep,
} from './fixture-truth-traitor-decision';

export type TruthTraitorHarkonnenStep = TruthTraitorDecisionStep;
export type TruthTraitorHarkonnenTransition = { before: Game; steps: TruthTraitorHarkonnenStep[]; after: Game };
export const actTruthTraitorHarkonnen = actTruthTraitorDecision;
export const truthTraitorHarkonnenClean = truthTraitorDecisionClean;
export const truthTraitorHarkonnenInventory = truthTraitorDecisionInventory;
export const truthTraitorHarkonnenPlayer = truthTraitorDecisionPlayer;
export const truthTraitorHarkonnenTraitors = truthTraitorDecisionTraitors;
export function truthTraitorHarkonnenNexusInventory(game: Game) {
  const cards = game.nexusCards?.cards;
  if (!cards) return [];
  const ids = [...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original Nexus singleton retains one current slot');
  return ids;
}

/** Preserve Truthtrance, every revealed Traitor vote and any native Cunning
 * return. A closing Nexus choice is kept through its real public action. */
export function nextTruthTraitorHarkonnen(game: Game): TruthTraitorHarkonnenStep | null {
  if (game.truthtrance || game.nexusTraitorPending) return null;
  if (game.battle?.revealed && truthTraitorHarkonnenClean(game) && viewGame(game, game.host).battle!.traitorVoters
    .some(actor => game.battle!.traitorCalls[actor] === undefined)) return null;
  if (game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: phase.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export const nextTruthTraitorHarkonnenNativeStep = nextTruthTraitorHarkonnen;
export function advanceTruthTraitorHarkonnen(game: Game, until: (state: Game) => boolean,
  actions: TruthTraitorHarkonnenStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Harkonnen chronology ended before its requested control');
    const next = nextTruthTraitorHarkonnen(game);
    assert.ok(next, `Choose the original Truthtrance, plan, Traitor vote or Nexus return at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actTruthTraitorHarkonnen(game, next.actor, next.action, actions);
  }
  throw Error('The genuine Harkonnen voter source did not reach its finite boundary');
}

/** Public Basic A/H/E seats earn the original Harkonnen opposing Traitor,
 * Atreides Truthtrance and a one-spice Karama purchase. A real turn-two worm
 * alliance supplies either Harkonnen ally support or an unallied Cunning draw.
 * No played cards, alliances, armies, phases or pending controls are installed. */
export function createTruthTraitorHarkonnenFixture(options: { kind?: 'ally' | 'cunning' } = {}) {
  const kind = options.kind ?? 'ally', atreides = 'atreides', harkonnen = 'harkonnen', emperor = 'emperor';
  const asker = atreides, target = harkonnen, beneficiary = kind === 'ally' ? emperor : harkonnen;
  let game = createGame('TRUTHTRAITORHARKONNEN', newPlayer(atreides, 'Atreides', 'atreides'), false);
  joinGame(game, newPlayer(harkonnen, 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTraitorHarkonnenStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthTraitorHarkonnen(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthTraitorHarkonnen(game, until, actions); };
  const transition = (run: () => void): TruthTraitorHarkonnenTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableNexus = kind === 'cunning' ? transition(() => {
    act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  }) : null;
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, []); assert.equal(game.deck.length, 33);
  assert.equal(!!game.nexusCards, kind === 'cunning');
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalCards = truthTraitorHarkonnenInventory(game);
  const originalTraitors = truthTraitorHarkonnenTraitors(game); assert.equal(originalTraitors.length, 15);
  const originalNexusInventory = truthTraitorHarkonnenNexusInventory(game);
  assert.deepEqual(originalNexusInventory, kind === 'cunning' ? [...NEXUS_FACTIONS].sort() : []);
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance');
  const karama = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 3);
  assert.ok(truthtrance && karama); assert.equal(ordinary.length, 3);
  const selected = [truthtrance, ...ordinary, karama];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  const traitorOffers = Object.fromEntries(game.players.map(player => [player.id, [...player.traitorChoices]]));
  const heldOriginal = [...truthTraitorHarkonnenPlayer(game, harkonnen).traitors];
  assert.equal(heldOriginal.length, 4);
  const traitorHeld = heldOriginal.find(id => truthTraitorHarkonnenPlayer(game, atreides).leaders.some(leader => leader.id === id));
  assert.ok(traitorHeld, 'The native four-card Harkonnen packet holds an opposing Atreides identity');
  const traitorSteps: TruthTraitorHarkonnenStep[] = [atreides, emperor].map(actor => {
    const leader = truthTraitorHarkonnenPlayer(game, actor).traitorChoices[0]; assert.ok(leader);
    return { actor, action: { type: 'traitor', leader } };
  });
  for (const step of traitorSteps) act(step.actor, step.action);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.slice(0, 4).map(card => card.id));
  assert.deepEqual(truthTraitorHarkonnenPlayer(game, atreides).forces, { 'arrakeen:10': 10 });
  assert.deepEqual(truthTraitorHarkonnenPlayer(game, harkonnen).forces, { 'carthag:11': 10 });
  assert.equal(truthTraitorHarkonnenPlayer(game, emperor).reserves, 20);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 3 && truthTraitorHarkonnenClean(state) &&
    state.auction?.active === atreides && state.auction.cards[state.auction.index]?.id === karama.id);
  const beforeKaramaPurchase = structuredClone(game);
  const karamaPurchase = transition(() => {
    act(atreides, { type: 'bid', amount: 1, allyPayment: 0 });
    reach(state => truthTraitorHarkonnenClean(state) && truthTraitorHarkonnenPlayer(state, atreides).hand.some(card => card.id === karama.id));
  });
  assert.equal(truthTraitorHarkonnenPlayer(beforeKaramaPurchase, atreides).spice - truthTraitorHarkonnenPlayer(game, atreides).spice, 1);
  reach(state => state.turn === 2 && state.phase === 1 && truthTraitorHarkonnenClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  const beforeWorm = structuredClone(game), beforeWormInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(wormIndex >= 0); const worm = game.spiceDeck.splice(wormIndex, 1)[0]; game.spiceDeck.unshift(worm);
  const wormOrder = { position: 0, from: wormIndex, card: structuredClone(worm) };
  const wormFollowupOrder = [1, 2].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormInventory);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && truthTraitorHarkonnenClean(state));
  const beforeAlliance = structuredClone(game);
  const partners = kind === 'ally' ? [emperor, harkonnen] : [atreides, emperor];
  const alliance = transition(() => {
    act(partners[0], { type: 'alliance', target: partners[1] });
    act(partners[1], { type: 'alliance', target: partners[0] });
  });
  assert.equal(truthTraitorHarkonnenPlayer(game, partners[0]).ally, partners[1]);
  assert.equal(truthTraitorHarkonnenPlayer(game, partners[1]).ally, partners[0]);
  let beforeNexusDraw: Game | null = null, nexusDraw: TruthTraitorHarkonnenTransition | null = null;
  let nexusOrder: { card: 'harkonnen'; position: number; from: number } | null = null;
  if (kind === 'cunning') {
    assert.equal(truthTraitorHarkonnenPlayer(game, harkonnen).ally, null);
    reach(state => state.nexusCards?.phase?.stage === 'drawing' && truthTraitorHarkonnenClean(state));
    const cards = game.nexusCards!.cards!, from = cards.deck.indexOf('harkonnen'); assert.ok(from >= 0);
    assert.equal(cards.hands[harkonnen], null);
    cards.deck.unshift(cards.deck.splice(from, 1)[0]);
    nexusOrder = { card: 'harkonnen', position: 0, from };
    beforeNexusDraw = structuredClone(game);
    nexusDraw = transition(() => { act(harkonnen, { type: 'nexusCardChoice', turn: game.turn,
      card: null, choice: 'draw', ownRedraws: 0 }); });
    assert.equal(game.nexusCards!.cards!.hands[harkonnen], 'harkonnen');
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === beneficiary && truthTraitorHarkonnenClean(state));
  const beforeShipment = structuredClone(game);
  const shipmentStep: TruthTraitorHarkonnenStep = { actor: beneficiary, action: {
    type: 'ship', amount: 1, territory: 'arrakeen', sector: 10, elite: 0, allyPayment: 0,
  } };
  const shipment = transition(() => { act(shipmentStep.actor, shipmentStep.action); reach(truthTraitorHarkonnenClean); });
  assert.equal(truthTraitorHarkonnenPlayer(beforeShipment, beneficiary).spice - truthTraitorHarkonnenPlayer(game, beneficiary).spice, 1);
  assert.equal(truthTraitorHarkonnenPlayer(game, beneficiary).forces['arrakeen:10'], 1);
  assert.equal(truthTraitorHarkonnenPlayer(game, atreides).forces['arrakeen:10'], 10);
  act(beneficiary, { type: 'endMovement' });
  reach(state => state.turn === 2 && state.phase === 6 && truthTraitorHarkonnenClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: TruthTraitorHarkonnenStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !!state.battle && truthTraitorHarkonnenClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game);
  assert.ok(game.battle && !game.battle.revealed && !Object.keys(game.battle.plans).length);
  const beneficiaryLeader = truthTraitorHarkonnenPlayer(game, beneficiary).leaders
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(beneficiaryLeader);
  const atreidesPlan: Action = { type: 'battlePlan', leader: traitorHeld, dial: 0, support: 0, weapon: null, defense: null };
  const beneficiaryPlan: Action = { type: 'battlePlan', leader: beneficiaryLeader.id, dial: 0, support: 0, weapon: null, defense: null };
  const planSteps: TruthTraitorHarkonnenStep[] = [
    { actor: atreides, action: atreidesPlan }, { actor: beneficiary, action: beneficiaryPlan },
  ];
  act(planSteps[0].actor, planSteps[0].action);
  const beforeReveal = structuredClone(game); act(planSteps[1].actor, planSteps[1].action);
  assert.ok(game.battle?.revealed && truthTraitorHarkonnenClean(game));
  assert.deepEqual(game.battle.traitorCalls, {});
  const traitorVoters = [...viewGame(game, game.host).battle!.traitorVoters];
  assert.ok(traitorVoters.includes(harkonnen));
  assert.equal([game.battle.attacker, game.battle.defender].includes(harkonnen), kind === 'cunning');
  const beforeCunning = structuredClone(game), beforeCunningActionCount = actions.length;
  let drawStep: TruthTraitorHarkonnenStep | null = null, cunningDraw: TruthTraitorHarkonnenTransition | null = null;
  let returnHeld: Action | null = null, returnDrawn: Action | null = null, pendingEvent: string | null = null;
  let drawn: string[] = [];
  if (kind === 'cunning') {
    const view = viewGame(game, harkonnen), offer = view.nexusTraitors?.offer; assert.ok(offer && !offer.blocked);
    const action = nexusTraitorDrawAction(view, offer.event, 'cunning'); assert.ok(action);
    drawStep = { actor: harkonnen, action };
    cunningDraw = transition(() => { act(harkonnen, action); });
    const pending = viewGame(game, harkonnen).nexusTraitors?.pending;
    assert.ok(pending && pending.owner === harkonnen && pending.count === 1);
    pendingEvent = pending.event;
    drawn = pending.choices.filter(choice => choice.drawn).map(choice => choice.id); assert.equal(drawn.length, 1);
    returnHeld = nexusTraitorReturnAction(viewGame(game, harkonnen), pending.event, [traitorHeld]);
    returnDrawn = nexusTraitorReturnAction(viewGame(game, harkonnen), pending.event, drawn);
    assert.ok(returnHeld && returnDrawn);
    assert.equal(game.nexusCards!.cards!.hands[harkonnen], null);
    assert.ok(game.nexusCards!.cards!.discard.includes('harkonnen'));
  }
  for (const card of [truthtrance, karama])
    assert.ok(truthTraitorHarkonnenPlayer(game, atreides).hand.some(held => held.id === card.id));
  assert.ok(truthTraitorHarkonnenPlayer(game, harkonnen).traitors.includes(traitorHeld));
  assert.deepEqual(truthTraitorHarkonnenInventory(game), originalCards);
  assert.deepEqual(truthTraitorHarkonnenTraitors(game), originalTraitors);
  assert.deepEqual(truthTraitorHarkonnenNexusInventory(game), originalNexusInventory);
  const source = structuredClone(game);
  const truthStep: TruthTraitorHarkonnenStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  const callStep: TruthTraitorHarkonnenStep = { actor: harkonnen, action: { type: 'traitorCall', call: true } };
  const declineStep: TruthTraitorHarkonnenStep = { actor: harkonnen, action: { type: 'traitorCall', call: false } };
  return { game, source, initial, enableNexus, lobby, setup, beforeStartingDeal, afterSetup,
    beforeKaramaPurchase, karamaPurchase, beforeWorm, wormOrder, wormFollowupOrder, beforeAlliance, alliance,
    beforeNexusDraw, nexusDraw, nexusOrder, beforeShipment, shipmentStep, shipment,
    beforeBattle, battleStep, beforePreparation, beforePlans, beforeReveal,
    beforeCunning, beforeDraw: beforeCunning, beforeCunningActionCount, drawStep, cunningDraw,
    pendingEvent, drawn, returnHeld, returnDrawn,
    kind, asker, target, respondent: target, owner: asker, atreides, emperor, harkonnen,
    beneficiary, opponent: atreides, voter: harkonnen, currentVoter: harkonnen,
    firstVoter: traitorVoters[0], traitorVoters, traitorHeld, traitorCard: traitorHeld, heldOriginal, traitorOffers, traitorSteps,
    truth: truthtrance.id, truthtrance: truthtrance.id, card: truthtrance.id, karama: karama.id,
    leaders: { [atreides]: traitorHeld, [beneficiary]: beneficiaryLeader.id },
    atreidesPlan, beneficiaryPlan, ownPlan: atreidesPlan, targetPlan: beneficiaryPlan, planSteps,
    plans: { [atreides]: atreidesPlan, [beneficiary]: beneficiaryPlan },
    territory: 'arrakeen', sector: 10, location: 'arrakeen:10', event: game.battle!.event,
    truthStep, callStep, declineStep, originalCards, originalInventory: originalCards, originalTraitors,
    originalNexusInventory, originalSpice, dealOrder, spiceOrder, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic Atreides/Harkonnen/Emperor seat order uses original base33 and fifteen native Traitors. Harkonnen keeps its original four-card packet, which genuinely contains the living Atreides leader later sealed by Atreides. No held Traitor exchange is required.',
      'Only native scalar lotteries, five unopened Treachery positions and unopened ordinary Spice/worm positions are selected. Atreides receives its original starting Truthtrance; Harkonnen receives two original ordinary cards and Emperor one. Atreides wins the first original Karama auction lot for one own spice and retains both special cards.',
      'The peaceful first turn completes through actual Storm, Spice, Charity, normal auction, Revival, Movement, Collection and Mentat. A real original turn-two Shai-Hulud opens Nexus. The returned alliance contains both original proposal and acceptance actions.',
      kind === 'ally'
        ? 'No optional module is enabled. Emperor and Harkonnen actually become reciprocal allies at Nexus. Emperor pays one to ship one original reserve into Atreides’ native ten Arrakeen counters and ends Movement. Harkonnen remains outside this battle but is its original allied-support Traitor voter.'
        : 'Only Nexus Cards is enabled by the actual lobby moduleOption. Atreides and Emperor actually ally, leaving Harkonnen unallied. Move only the unopened Harkonnen Nexus singleton before its real closing draw; retain the original all12 inventory. Harkonnen pays one to ship one original reserve into Atreides’ native ten Arrakeen counters and ends Movement.',
      'Choose the actual Arrakeen battle, decline original preparation and seal living native leaders with zero dial, zero support and no weapon or defense. Atreides uses the exact opposing identity originally held by Harkonnen. No revealed-battle Traitor vote has been submitted; the pre-Cunning snapshot is directly usable.',
      kind === 'cunning'
        ? 'The final source actually declares Harkonnen Nexus Cunning after reveal, physically draws one native reserve Traitor, discards its original Nexus singleton and stops at the original pending return. Returned payloads can return the original matching identity or the new draw. Truthtrance, the return and all Traitor votes remain caller-owned.'
        : 'The final source stops before Harkonnen’s allied declaration and its original Karama response. The returned Atreides Karama is genuinely bought and held; no response is preinstalled.',
      'No played phase, wallet, army, leader, hand, alliance, sealed plan, draw history or pending receipt is assigned. Counts are derived from the returned native action log; source construction is not a final assurance campaign.',
    ],
  };
}
export type TruthTraitorHarkonnenFixture = ReturnType<typeof createTruthTraitorHarkonnenFixture>;
