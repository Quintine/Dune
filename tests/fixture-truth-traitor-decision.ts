import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep, type TruthMovementTransition,
} from './fixture-truth-movement';

export type TruthTraitorDecisionStep = TruthMovementStep;
export const actTruthTraitorDecision = actTruthMovement;
export const truthTraitorDecisionClean = truthMovementClean;
export const truthTraitorDecisionInventory = truthMovementInventory;
export const truthTraitorDecisionPlayer = truthMovementPlayer;
export const truthTraitorDecisionTraitors = (game: Game) => {
  const cards = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])];
  assert.equal(new Set(cards).size, cards.length, 'Each original Traitor has one current location');
  return cards.sort();
};

/** Never declare or answer Truthtrance, seal a private plan, or submit a
 * revealed-battle Traitor vote on behalf of the caller. */
export function nextTruthTraitorDecision(game: Game): TruthTraitorDecisionStep | null {
  if (game.truthtrance) return null;
  if (game.battle?.revealed && truthTraitorDecisionClean(game) && viewGame(game, game.host).battle!.traitorVoters
    .some(actor => game.battle!.traitorCalls[actor] === undefined)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export const nextTruthTraitorDecisionNativeStep = nextTruthTraitorDecision;
export function advanceTruthTraitorDecision(game: Game, until: (state: Game) => boolean,
  actions: TruthTraitorDecisionStep[] = []): Game {
  for (let count = 0; count < 800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original battle ended before its requested control');
    const next = nextTruthTraitorDecision(game);
    assert.ok(next, `Choose the original Truthtrance, private plan or Traitor vote: ${JSON.stringify({
      turn: game.turn, phase: game.phase, decision: game.decision?.kind,
      truth: game.truthtrance?.stage, revealed: game.battle?.revealed,
    })}`);
    game = actTruthTraitorDecision(game, next.actor, next.action, actions);
  }
  throw Error('The genuine Basic Traitor-decision source did not reach its finite boundary');
}

/** Genuine public Basic two-seat source. Only original unopened Treachery and
 * Spice positions and original scalar lotteries are selected. Emperor keeps
 * an actually offered opposing Traitor; that living native disc is really
 * sealed in Atreides' unarmed plan. Stop before every original Traitor vote. */
export function createTruthTraitorDecisionFixture() {
  const atreides = 'atreides', emperor = 'emperor', asker = atreides, target = emperor;
  let game = createGame('TRUTHTRAITORDECISION', newPlayer(atreides, 'Atreides', 'atreides'), false);
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTraitorDecisionStep[] = [];
  const act = (actor: string, action: Action) => {
    game = actTruthTraitorDecision(game, actor, action, actions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceTruthTraitorDecision(game, until, actions);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, []); assert.equal(game.deck.length, 33);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthTraitorDecisionInventory(game);
  const originalTraitors = truthTraitorDecisionTraitors(game);
  assert.equal(originalTraitors.length, 10);
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance');
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  assert.ok(truthtrance && ordinary);
  const deal = [truthtrance.id, ordinary.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  const traitorOffers = Object.fromEntries(game.players.map(player => [player.id, [...player.traitorChoices]]));
  const traitorHeld = truthTraitorDecisionPlayer(game, target).traitorChoices
    .find(id => truthTraitorDecisionPlayer(game, atreides).leaders.some(leader => leader.id === id));
  assert.ok(traitorHeld, 'The native Emperor packet offers an opposing Atreides Traitor');
  const atreidesTraitor = truthTraitorDecisionPlayer(game, atreides).traitorChoices[0];
  assert.ok(atreidesTraitor);
  const traitorSteps: TruthTraitorDecisionStep[] = [
    { actor: atreides, action: { type: 'traitor', leader: atreidesTraitor } },
    { actor: emperor, action: { type: 'traitor', leader: traitorHeld } },
  ];
  for (const step of traitorSteps) act(step.actor, step.action);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthTraitorDecisionPlayer(game, asker).hand.map(card => card.id), [truthtrance.id]);
  assert.deepEqual(truthTraitorDecisionPlayer(game, target).hand.map(card => card.id), [ordinary.id]);
  assert.deepEqual(truthTraitorDecisionPlayer(game, atreides).forces, { 'arrakeen:10': 10 });
  assert.deepEqual(truthTraitorDecisionPlayer(game, emperor).forces, {});
  assert.equal(truthTraitorDecisionPlayer(game, emperor).reserves, 20);
  assert.deepEqual(truthTraitorDecisionPlayer(game, target).traitors, [traitorHeld]);
  const startingPositions = Object.fromEntries(game.players.map(player => [player.id, {
    forces: structuredClone(player.forces), reserves: player.reserves, spice: player.spice,
  }]));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === atreides && truthTraitorDecisionClean(state));
  const beforeAtreidesEnd = structuredClone(game);
  act(atreides, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === emperor && truthTraitorDecisionClean(state));
  const beforeShipment = structuredClone(game);
  const shipmentStep: TruthTraitorDecisionStep = { actor: emperor, action: {
    type: 'ship', amount: 1, territory: 'arrakeen', sector: 10, elite: 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action);
  reach(truthTraitorDecisionClean);
  const shipment: TruthMovementTransition = { before: beforeShipment, step: shipmentStep, after: structuredClone(game) };
  assert.equal(truthTraitorDecisionPlayer(game, emperor).forces['arrakeen:10'], 1);
  assert.equal(truthTraitorDecisionPlayer(game, emperor).reserves, 19);
  assert.equal(truthTraitorDecisionPlayer(beforeShipment, emperor).spice - truthTraitorDecisionPlayer(game, emperor).spice, 1);
  act(emperor, { type: 'endMovement' });
  reach(state => state.phase === 6 && truthTraitorDecisionClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === 'arrakeen');
  assert.ok(choice);
  const battleStep: TruthTraitorDecisionStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !!state.battle && truthTraitorDecisionClean(state) && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game);
  assert.ok(game.battle && !game.battle.revealed && !Object.keys(game.battle.plans).length);
  const opposingLeader = truthTraitorDecisionPlayer(game, emperor).leaders
    .filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(opposingLeader);
  const atreidesPlan: Action = { type: 'battlePlan', leader: traitorHeld, dial: 0, support: 0, weapon: null, defense: null };
  const emperorPlan: Action = { type: 'battlePlan', leader: opposingLeader.id, dial: 0, support: 0, weapon: null, defense: null };
  const planSteps: TruthTraitorDecisionStep[] = [
    { actor: atreides, action: atreidesPlan }, { actor: emperor, action: emperorPlan },
  ];
  act(planSteps[0].actor, planSteps[0].action);
  const beforeReveal = structuredClone(game);
  act(planSteps[1].actor, planSteps[1].action);
  assert.ok(game.battle?.revealed && truthTraitorDecisionClean(game));
  assert.deepEqual(game.battle.traitorCalls, {});
  const traitorVoters = [...viewGame(game, game.host).battle!.traitorVoters];
  const voter = traitorVoters.find(actor => game.battle!.traitorCalls[actor] === undefined);
  assert.ok(voter && traitorVoters.includes(target));
  assert.ok(truthTraitorDecisionPlayer(game, asker).hand.some(card => card.id === truthtrance.id));
  assert.deepEqual(truthTraitorDecisionInventory(game), originalCards);
  assert.deepEqual(truthTraitorDecisionTraitors(game), originalTraitors);
  const source = structuredClone(game);
  const truthStep: TruthTraitorDecisionStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  const callStep: TruthTraitorDecisionStep = { actor: target, action: { type: 'traitorCall', call: true } };
  const declineStep: TruthTraitorDecisionStep = { actor: target, action: { type: 'traitorCall', call: false } };
  return { game, source, initial, lobby, setup, beforeStartingDeal, afterSetup, beforeAtreidesEnd,
    beforeShipment, shipment, shipmentStep, beforeBattle, battleStep, beforePreparation, beforePlans, beforeReveal,
    asker, target, atreides, emperor, owner: asker, respondent: target, voter, currentVoter: voter, traitorVoters,
    truth: truthtrance.id, truthtrance: truthtrance.id, card: truthtrance.id, ordinary: ordinary.id,
    traitorHeld, traitorCard: traitorHeld, traitorOffers, traitorSteps,
    leaders: { [atreides]: traitorHeld, [emperor]: opposingLeader.id },
    atreidesPlan, emperorPlan, ownPlan: atreidesPlan, targetPlan: emperorPlan,
    plans: { [atreides]: atreidesPlan, [emperor]: emperorPlan }, planSteps,
    territory: 'arrakeen', sector: 10, location: 'arrakeen:10', event: game.battle.event,
    truthStep, callStep, declineStep, deal, dealOrder, spiceOrder, originalSpice, startingPositions,
    originalCards, originalInventory: originalCards, originalTraitors,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic Atreides/Emperor ready/start with the original base33, native ten-leader Traitor deck and no optional modules. Only native scalar lotteries, two unopened starting Treachery positions and two unopened ordinary Spice positions are selected. UUID and non-scalar entropy remain native.',
      'Atreides is actually dealt Truthtrance; Emperor receives an ordinary projectile. Emperor actually chooses its offered opposing Atreides Traitor during original setup. No Traitor exchange or played hand, disc, phase, force, wallet or receipt is installed.',
      'Complete actual safe Storm, Spice Blow, Charity, Bidding and Revival. Atreides ends its unused Movement; Emperor pays one spice to ship one original reserve into native Atreides ten at Arrakeen10 and really ends Movement. Choose the resulting native battle, decline original preparation and seal both actual zero-dial unarmed plans with living original leaders.',
      'The Atreides plan uses Emperor’s actually held opposing Traitor. Stop immediately after original plan reveal, with Truthtrance held and no Traitor votes submitted. Both possible declaration choices remain caller-owned; this source makes no promise about the eventual winner.',
    ],
  };
}
export type TruthTraitorDecisionFixture = ReturnType<typeof createTruthTraitorDecisionFixture>;

export function askTruthTraitorDecision(game: Game, asker: string, card: string, target: string) {
  const battle = game.battle; assert.ok(battle?.event);
  game = actTruthTraitorDecision(game, asker, { type: 'card', card });
  for (const player of game.players) if (!game.truthtrance!.passed.includes(player.id))
    game = actTruthTraitorDecision(game, player.id, { type: 'truthPass' });
  return actTruthTraitorDecision(game, asker, { type: 'truthAsk', question: {
    kind: 'traitorCall', target, battle: battle.event, territory: battle.territory,
  } });
}
