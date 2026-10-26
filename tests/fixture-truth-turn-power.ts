import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { BattlePowerClaim, NativeBattlePower } from '../game/battle-power-question';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { truthTraitorDecisionTraitors } from './fixture-truth-traitor-decision';
import { actTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer,
  type TruthTurnActionStep } from './fixture-truth-turn-action';
import type { TruthTurnCombatLeaf } from './fixture-truth-turn-combat';

export type TruthTurnPowerLeaf = TruthTurnCombatLeaf |
  { kind: 'battlePower'; battle: string; territory: string; claim: BattlePowerClaim };
export type TruthTurnPowerExpression = MixedActionExpression<TruthTurnPowerLeaf>;
export type TruthTurnPowerStep = TruthTurnActionStep;
export const actTruthTurnPower = actTruthTurnAction;
export const truthTurnPowerPlayer = truthTurnActionPlayer;
export const truthTurnPowerInventory = truthTurnActionInventory;
export const truthTurnPowerTraitors = truthTraitorDecisionTraitors;
export const truthTurnPowerClean = (game: Game) => !game.truthtrance && !game.response && !game.phaseOpening &&
  !game.decision && !game.pendingTreacheryDiscard && !game.pendingShipment && !game.pendingRevival;
export const truthTurnPowerFact = (fact: TruthFact): TruthTurnPowerExpression => ({ kind: 'fact', fact });
export const truthTurnPowerPayment = (recipient: string, minimum = 2): TruthTurnPowerExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnPowerAction = (battle: string, territory: string, claim: BattlePowerClaim): TruthTurnPowerExpression =>
  ({ kind: 'action', action: { kind: 'battlePower', battle, territory, claim: structuredClone(claim) } });
export const truthTurnPowerGroup = (kind: 'and' | 'or', ...terms: TruthTurnPowerExpression[]): TruthTurnPowerExpression =>
  ({ kind, terms });

/** Ordinary native continuation. A requested field is answered with an actual
 * legal original unarmed zero-dial plan element; caller-owned private plans
 * and Truthtrance questions are never submitted by this helper. */
export function nextTruthTurnPowerNative(game: Game): TruthTurnPowerStep | null {
  if (game.truthtrance) return null;
  if (game.status === 'setup' && game.setupStage === 'prediction')
    return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
  if (truthTurnPowerClean(game) && game.battle?.preparation?.kind === 'prescienceAnswer') {
    const owner = game.battle.preparation.owner, field = game.battle.prescience!.field;
    const leader = truthTurnPowerPlayer(game, owner).leaders.find(disc => !disc.dead && !disc.usedAt); assert.ok(leader);
    return { actor: owner, action: { type: 'prescienceAnswer', value: field === 'dial' ? 0 : field === 'leader' ? leader.id : null } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function nextTruthTurnPower(game: Game): TruthTurnPowerStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnPowerNative(game);
}
export function advanceTruthTurnPower(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnPowerStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine power source ended before its native boundary');
    const next = nativeOnly ? nextTruthTurnPowerNative(game) : nextTruthTurnPower(game);
    assert.ok(next, 'Supply the actual private plan or Truthtrance control');
    game = actTruthTurnPower(game, next.actor, next.action, actions);
  }
  throw Error('The original native power chronology did not reach its finite boundary');
}
export function settleTruthTurnPower(game: Game, actions: TruthTurnPowerStep[] = []): Game {
  return advanceTruthTurnPower(game, truthTurnPowerClean, actions, true);
}

/** Original public Basic A/BG/E base33. Select unopened deal/lot/Spice
 * positions and scalar lotteries only. All setup, auction, Nexus consent,
 * paid shipment and battle preparation are actual engine actions. */
export function createTruthTurnPowerFixture(options: {
  power?: NativeBattlePower; remote?: boolean; window?: NativeBattlePower;
} = {}) {
  const power = options.power ?? 'voice', remote = options.remote ?? false;
  const atreides = 'atreides', bg = 'beneGesserit', emperor = 'emperor';
  const target = power === 'voice' ? bg : atreides;
  const asker = remote ? (power === 'voice' ? atreides : bg) : emperor;
  const recipient = asker, beneficiary = remote ? emperor : target;
  let game = createGame('TRUTHTURNPOWER', newPlayer(atreides, 'Atreides', 'atreides'), false);
  joinGame(game, newPlayer(bg, 'Bene Gesserit', 'beneGesserit'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTurnPowerStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthTurnPower(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthTurnPower(game, until, actions, true); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.equal(game.deck.length, 33);
  assert.ok(game.players.every(player => player.hand.length === 0));
  act(bg, { type: 'predict', faction: atreides, turn: 10 });
  const originalCards = truthTurnPowerInventory(game), originalTraitors = truthTurnPowerTraitors(game);
  assert.equal(originalTraitors.length, 15);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const shield = game.deck.find(card => card.kind === 'shield');
  const projectile = game.deck.find(card => card.kind === 'projectile');
  const karama = game.deck.find(card => card.effect === 'karama');
  const poison = game.deck.find(card => card.kind === 'poison');
  const snooper = game.deck.find(card => card.kind === 'snooper');
  assert.ok(truth && shield && projectile && karama && poison && snooper);
  const ordinary = [shield, projectile], deal = game.players.map(player =>
    player.id === asker ? truth.id : ordinary.shift()!.id);
  const dealOrder = [...deal, karama.id, poison.id, snooper.id].map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthTurnPowerPlayer(game, asker).hand.map(card => card.id), [truth.id]);
  assert.deepEqual(truthTurnPowerPlayer(game, bg).forces, { 'polar_sink:0': 1 });
  assert.deepEqual(truthTurnPowerPlayer(game, atreides).forces, { 'arrakeen:10': 10 });
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  reach(beforeIxSpiceDraw); const spiceOrder = orderIxSpiceCards(game, ['land', 'land']);
  reach(state => state.phase === 3 && truthTurnPowerClean(state) && !!state.auction);
  assert.equal(game.auction!.cards[0].id, karama.id);
  reach(state => state.phase === 3 && truthTurnPowerClean(state) && state.auction?.active === asker);
  const beforePurchase = structuredClone(game), purchaseAt = actions.length;
  act(asker, { type: 'bid', amount: 1 });
  reach(state => truthTurnPowerClean(state) && truthTurnPowerPlayer(state, asker).hand.some(card => card.id === karama.id));
  const purchase = { before: beforePurchase, steps: structuredClone(actions.slice(purchaseAt)), after: structuredClone(game) };
  assert.ok(truthTurnPowerPlayer(game, asker).hand.some(card => card.id === karama.id));
  let beforeNexus: Game | null = null, nexusActions: TruthTurnPowerStep[] = [];
  let nexusSpiceOrder: ReturnType<typeof orderIxSpiceCards> = [];
  if (remote) {
    reach(state => state.turn === 2 && beforeIxSpiceDraw(state));
    nexusSpiceOrder = orderIxSpiceCards(game, ['worm', 'land']);
    reach(state => state.turn === 2 && state.phase === 1 && !!state.nexus && !state.spiceWindow &&
      !state.spiceResolution && truthTurnPowerClean(state));
    beforeNexus = structuredClone(game); const from = actions.length;
    act(target, { type: 'alliance', target: emperor }); act(emperor, { type: 'alliance', target });
    assert.equal(truthTurnPowerPlayer(game, target).ally, emperor);
    assert.equal(truthTurnPowerPlayer(game, emperor).ally, target);
    reach(state => !state.nexus && truthTurnPowerClean(state));
    nexusActions = structuredClone(actions.slice(from));
  }
  const shipper = remote ? emperor : bg, territory = remote && power === 'prescience' ? 'imperial_basin' : 'arrakeen';
  const sector = 10;
  const shipmentAction: Action = { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 };
  type Shipment = { before: Game; steps: TruthTurnPowerStep[]; after: Game };
  let shipment: Shipment | null = null, opponentShipment: Shipment | null = null;
  reach(state => state.turn === (remote ? 2 : 1) && state.phase === 5 && truthTurnPowerClean(state));
  const shippers = game.order.filter(actor => actor === shipper || (remote && power === 'prescience' && actor === bg));
  for (const actor of shippers) {
    reach(state => state.phase === 5 && state.active === actor && truthTurnPowerClean(state));
    const before = structuredClone(game), from = actions.length;
    act(actor, shipmentAction); reach(truthTurnPowerClean);
    const transition = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.equal(truthTurnPowerPlayer(before, actor).spice - truthTurnPowerPlayer(game, actor).spice,
      territory === 'imperial_basin' ? 2 : 1);
    if (actor === shipper) shipment = transition; else opponentShipment = transition;
    act(actor, { type: 'endMovement' });
  }
  assert.ok(shipment); const beforeShipment = shipment.before;
  reach(state => state.phase === 6 && !!state.active && !state.battle && truthTurnPowerClean(state));
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === territory &&
    [candidate.attacker, candidate.defender].includes(beneficiary)); assert.ok(choice);
  act(choice.chooser, { type: 'chooseBattle', territory,
    target: choice.chooser === choice.attacker ? choice.defender : choice.attacker });
  reach(state => !!state.battle?.preparation && truthTurnPowerClean(state));
  const beforeVoice = structuredClone(game), beforeVoiceActions = structuredClone(actions);
  const window = options.window ?? power;
  if (window === 'prescience') reach(state => state.battle?.preparation?.kind === 'prescience' && truthTurnPowerClean(state));
  assert.ok(game.battle?.event); const event = game.battle.event;
  assert.equal(game.battle.preparation?.kind, window);
  assert.ok(truthTurnPowerPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.equal(truthTurnPowerPlayer(game, target).ally === recipient, false);
  assert.ok(!game.nexusCards && !game.homeworlds && !game.leaderSkills && !game.techTokens && !game.strongholdCards);
  assert.deepEqual(truthTurnPowerInventory(game), originalCards);
  assert.deepEqual(truthTurnPowerTraitors(game), originalTraitors);
  const claim: BattlePowerClaim = power === 'voice' ? { kind: 'voiceCommand', cardType: 'shield', must: false }
    : { kind: 'prescienceField', field: 'dial' };
  const nativeAction: Action = power === 'voice' ? { type: 'voice', kind: 'shield', must: false }
    : { type: 'prescience', field: 'dial' };
  const payment: Action = { type: 'bribe', target: recipient, amount: 2 };
  const mixed = truthTurnPowerGroup('and', truthTurnPowerAction(event, territory, claim), truthTurnPowerPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnPowerPlayer(game, target).spice };
  return { game, source: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    asker, target, recipient, power, remote, window, beneficiary, event, battle: event, territory,
    truth: truth.id, karama: karama.id, claim, nativeAction, payment, mixed, question, spiceFact,
    atreides, bg, emperor, shipper, beforeShipment, shipmentAction, shipment, opponentShipment, beforeNexus, nexusActions,
    beforeVoice, beforeVoiceActions, purchase, dealOrder, spiceOrder, nexusSpiceOrder,
    originalCards, originalTraitors, originalSpice, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, beforeVoice: beforeVoiceActions.length,
      nativeKaramaPurchase: purchase.steps.length, nativeNexusConsentAndClose: nexusActions.length,
      nativeShipment: shipment.steps.length, nativeOpponentShipment: opponentShipment?.steps.length ?? 0 },
    sourceDisclosure: `Actual public Basic A/BG/E base33 setup, original prediction/Traitor choices and native first Storm. ` +
      'Select only original unopened starting deal, ordinary Karama lot and Spice positions plus scalar lotteries. The asker really buys its original Karama for one spice. ' +
      (remote ? 'Actually finish turn1, open the turn2 ordinary Worm Nexus, submit reciprocal native alliance invitations and close the Nexus. ' +
        (power === 'voice' ? 'Emperor pays one spice for an original reserve in original Atreides Arrakeen. '
          : 'BG and Emperor each pay two spice to ship one original reserve into Imperial Basin; the sanctuary Polar Sink never supplies a battle. ')
        : 'BG pays one spice to ship one original reserve into Atreides original Arrakeen10. ') +
      'Choose the resulting original battle and stop at native Voice or ordered Prescience. Counts derive from the actual action arrays. No hand, wallet, force, alliance, battle, declaration, power, clock, receipt or promise is installed.',
  };
}
export type TruthTurnPowerFixture = ReturnType<typeof createTruthTurnPowerFixture>;

export function declareTruthTurnPower(f: TruthTurnPowerFixture, source = f.game, actions: TruthTurnPowerStep[] = []) {
  let game = actTruthTurnPower(source, f.asker, { type: 'card', card: f.truth }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnPower(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthTurnPower(game: Game, asker: string, target: string, mixed: TruthTurnPowerExpression,
  actions: TruthTurnPowerStep[] = []): Game {
  return actTruthTurnPower(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnPower(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnPowerStep[] = []): Game {
  return actTruthTurnPower(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnPower(f: TruthTurnPowerFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, actions: TruthTurnPowerStep[] = []) {
  const declared = declareTruthTurnPower(f, source, actions);
  const asked = askTruthTurnPower(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnPower(asked, f.target, answer, actions), asked, declared, actions };
}
export function truthTurnPowerPromise(game: Game, target = game.turnActionPromises![0].player) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function finishTruthTurnPowerBattle(game: Game, f: TruthTurnPowerFixture,
  actions: TruthTurnPowerStep[] = []): Game {
  game = advanceTruthTurnPower(game, state => !state.battle || (!state.battle.preparation && truthTurnPowerClean(state)), actions, true);
  if (!game.battle) return game;
  for (const actor of [game.battle.attacker, game.battle.defender]) {
    if (game.battle?.plans[actor]) continue;
    const inspection = game.battle?.prescience;
    const inspected = inspection && inspection.player !== actor;
    const leader = truthTurnPowerPlayer(game, actor).leaders.find(disc => !disc.dead && !disc.usedAt); assert.ok(leader);
    game = actTruthTurnPower(game, actor, { type: 'battlePlan',
      leader: inspected && inspection.field === 'leader' ? inspection.value : leader.id,
      dial: inspected && inspection.field === 'dial' ? inspection.value : 0, support: 0,
      weapon: inspected && inspection.field === 'weapon' ? inspection.value : null,
      defense: inspected && inspection.field === 'defense' ? inspection.value : null }, actions);
  }
  assert.ok(game.battle?.revealed);
  return advanceTruthTurnPower(game, state => !state.battle || state.battle.event !== f.event, actions, true);
}
export function finishTruthTurnPower(game: Game, actions: TruthTurnPowerStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnPower(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnPowerClean(state), actions);
}
