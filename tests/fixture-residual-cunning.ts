import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { validateNexusCards, NEXUS_FACTIONS } from '../game/nexus-cards';
import { residualPoisonCandidates } from '../game/residual-poison';
import { CAPTURE_RESIDUAL_POISON, actResidualPoisonCapture,
  type ResidualPoisonCaptureStep } from './fixture-residual-poison-capture';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { semutaGuildIncomeInventory } from './fixture-semuta-guild-income';

export type ResidualCunningStep = ResidualPoisonCaptureStep;
export const actResidualCunning = actResidualPoisonCapture;
export const residualCunningClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function residualCunningPlayer(game: Game, id: string) {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `The original ${id} seat must remain present`);
  return player;
}
export function residualCunningInventory(game: Game) {
  const treachery = semutaGuildIncomeInventory(game);
  assert.ok(game.nexusCards?.cards);
  const cards = game.nexusCards.cards;
  validateNexusCards(cards, game.players);
  const nexus = [...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort();
  assert.deepEqual(nexus, [...NEXUS_FACTIONS].sort());
  return { treachery, nexus };
}
export function residualCunningPhysical(game: Game) {
  return game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
    tanks: player.tanks, forces: structuredClone(player.forces), elites: structuredClone(player.elites),
    moved: player.moved, shipped: player.shipped }));
}
/** Native setup, no-spend ordinary controls and a genuine one-spice cache bid.
 * The inspected answer itself and sealed plans are explicit owned choices. */
export function nextResidualCunningStep(game: Game): ResidualCunningStep | null {
  if (residualCunningClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'richeseCache' && game.richeseCache?.some(card => card.id === CAPTURE_RESIDUAL_POISON))
      return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: CAPTURE_RESIDUAL_POISON, method: 'onceAround', direction: 'counterclockwise' } };
    if (residualCunningClean(game) && game.richeseAuction?.cardId === CAPTURE_RESIDUAL_POISON &&
      !game.richeseAuction.outcome && game.richeseAuction.active === 'a' && game.richeseAuction.bid === 0)
      return { actor: 'a', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceResidualCunning(game: Game, until: (state: Game) => boolean,
  actions: ResidualCunningStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Residual/Cunning source ended before its owned boundary');
    const step = nextResidualCunningStep(game);
    assert.ok(step, `The native ${game.turn}/${game.phase}/${game.decision?.kind} requires an explicit owned action`);
    game = actResidualCunning(game, step.actor, step.action, actions);
  }
  throw Error('The native Residual/Cunning source did not reach its finite boundary');
}
function orderSpice(game: Game, names: readonly string[]) {
  const cards = names.map(name => {
    const at = game.spiceDeck.findIndex(card => name === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed
      : 'territory' in card && !card.discovery && card.territory === name);
    assert.ok(at >= 0, `The original ${name} Spice Card must remain unopened`);
    return game.spiceDeck.splice(at, 1)[0];
  });
  game.spiceDeck.unshift(...cards);
}

/** Fresh public native start, paid cache purchase, actual natural Nexus and
 * own-faction draw, real opposing shipment, and two actual inspected answers.
 * Only unopened Spice/Nexus positions and scalar lotteries are selected. */
export function createResidualCunningFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('RESIDUALCUNNING', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  for (const [id, name, faction] of [['a', 'Atreides', 'atreides'], ['e', 'Emperor', 'emperor'],
    ['g', 'Guild', 'guild']] as const) joinGame(game, newPlayer(id, name, faction));
  const actions: ResidualCunningStep[] = [];
  const act = (actor: string, action: Action) => { game = actResidualCunning(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceResidualCunning(game, until, actions); };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalInventory = residualCunningInventory(game);
  orderSpice(game, ['broken_land', ...(advanced ? ['south_mesa'] : [])]);
  reach(state => state.decision?.kind === 'richeseCache');
  const beforePurchase = structuredClone(game), purchaseStart = actions.length;
  reach(state => residualCunningPlayer(state, 'a').hand.some(card => card.id === CAPTURE_RESIDUAL_POISON) && residualCunningClean(state));
  const acquisition = { before: beforePurchase, actions: structuredClone(actions.slice(purchaseStart)), after: structuredClone(game) };
  reach(state => state.turn === 2 && state.phase === 1 && residualCunningClean(state));
  const afterFirstTurn = structuredClone(game);
  orderSpice(game, ['worm', 'hagga_basin', ...(advanced ? ['red_chasm'] : [])]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && residualCunningClean(state));
  const beforeAlliance = structuredClone(game);
  act('e', { type: 'alliance', target: 'g' });
  act('g', { type: 'alliance', target: 'e' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && residualCunningClean(state));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf('atreides');
  assert.ok(at >= 0, 'The native Atreides Nexus singleton must remain undrawn');
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const beforeDraw = structuredClone(game), drawStart = actions.length;
  for (const actor of game.nexusCards!.phase!.eligible) {
    act(actor, { type: 'nexusCardChoice', turn: game.turn, card: game.nexusCards!.cards!.hands[actor],
      choice: actor === 'a' ? 'draw' : 'keep', ownRedraws: 0 });
  }
  const afterDraw = structuredClone(game), drawActions = structuredClone(actions.slice(drawStart));
  assert.equal(game.nexusCards!.cards!.hands.a, 'atreides');
  reach(state => state.turn === 2 && state.phase === 5 && state.active === 'r' && residualCunningClean(state));
  const beforeShipment = structuredClone(game), shipment: ResidualCunningStep = { actor: 'r',
    action: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } };
  act(shipment.actor, shipment.action); reach(residualCunningClean);
  const afterShipment = structuredClone(game);
  reach(state => state.phase === 6 && residualCunningClean(state));
  assert.ok(game.active === 'r' || game.active === 'a');
  const beforeBattle = structuredClone(game), chooser = game.active, target = chooser === 'r' ? 'a' : 'r';
  const choice: ResidualCunningStep = { actor: chooser,
    action: { type: 'chooseBattle', territory: 'arrakeen', target } };
  act(choice.actor, choice.action);
  reach(state => state.battle?.preparation?.kind === 'prescience' && !state.response && !state.phaseOpening && !state.decision);
  const beforeNative = structuredClone(game), nativeStart = actions.length;
  act('a', { type: 'prescience', field: 'dial' });
  reach(state => !state.response && state.battle?.preparation?.kind === 'prescienceAnswer');
  act('r', { type: 'prescienceAnswer', value: 0 });
  reach(state => !!state.battle?.preLeader?.closed && !state.battle.preparation && residualCunningClean(state));
  const afterNative = structuredClone(game), nativeActions = structuredClone(actions.slice(nativeStart));
  const event = game.battle!.event!, cunningStart = actions.length;
  const cunning: Action = { type: 'nexusAtreides', event, mode: 'cunning', field: 'weapon' };
  act('a', cunning);
  reach(state => !state.response && state.battle?.preparation?.kind === 'nexusPrescienceAnswer');
  act('r', { type: 'nexusPrescienceAnswer', event, value: null });
  const cunningActions = structuredClone(actions.slice(cunningStart));
  assert.equal(game.battle!.nexusInspection!.stage, 'answered');
  assert.deepEqual(game.battle!.nexusInspection!.answers, [null]);
  assert.deepEqual(game.battle!.plans, {});
  assert.equal(game.battle!.preparation ?? null, null);
  assert.ok(residualPoisonCandidates(residualCunningPlayer(game, 'r').leaders, 'arrakeen').length > 1);
  const option = viewGame(game, 'a').residualPoison;
  assert.ok(option && !option.blocked, option?.blocked ?? 'The earned answered-Cunning window must permit the original card');
  const action: Action = { type: 'card', card: CAPTURE_RESIDUAL_POISON, target: 'r', event };
  return { game, advanced, holder: 'a', target: 'r', card: CAPTURE_RESIDUAL_POISON, event, action,
    initial, setup, afterSetup, acquisition, afterFirstTurn, beforeAlliance, beforeDraw, afterDraw, drawActions,
    beforeShipment, shipment, afterShipment, beforeBattle, choice, beforeNative, afterNative, nativeActions,
    cunning, cunningActions, originalInventory, originalPhysical: residualCunningPhysical(game),
    originalPrescience: structuredClone(game.battle!.prescience),
    originalInspection: structuredClone(game.battle!.nexusInspection),
    originalLeaders: structuredClone(residualCunningPlayer(game, 'r').leaders),
    actions, sourceActionCount: actions.length,
    staging: ['Only unopened original Spice/Nexus positions and scalar lotteries are selected. The public start, paid Residual1 lot, E/G alliance, native Atreides own-card draw, Richese1 Arrakeen shipment, battle, native dial0, shared readiness and Cunning weapon-null answer are actual actions.'] };
}
export type ResidualCunningFixture = ReturnType<typeof createResidualCunningFixture>;
export function playResidualCunning(fixture: ResidualCunningFixture, game = structuredClone(fixture.game),
  actions: ResidualCunningStep[] = []) {
  return actResidualCunning(game, fixture.holder, fixture.action, actions);
}
/** Seal real legal surviving native leaders and resolve only this battle's
 * existing votes/disposal/aftermath. No plan, result or later phase is staged. */
export function finishResidualCunning(fixture: ResidualCunningFixture, game: Game,
  actions: ResidualCunningStep[] = []) {
  game = advanceResidualCunning(game, state => !!state.battle?.preLeader?.closed &&
    !state.battle.preparation && residualCunningClean(state), actions);
  const target = residualPoisonCandidates(residualCunningPlayer(game, fixture.target).leaders, 'arrakeen')
    .sort((a, b) => a.strength - b.strength)[0];
  const owner = residualPoisonCandidates(residualCunningPlayer(game, fixture.holder).leaders, 'arrakeen')
    .sort((a, b) => b.strength - a.strength)[0];
  assert.ok(target && owner && owner.strength > target.strength);
  const plans: ResidualCunningStep[] = [
    { actor: fixture.target, action: { type: 'battlePlan', leader: target.id, dial: 0, support: 0 } },
    { actor: fixture.holder, action: { type: 'battlePlan', leader: owner.id, dial: 0, support: 0 } },
  ];
  for (const step of plans) game = actResidualCunning(game, step.actor, step.action, actions);
  const sealed = structuredClone(game);
  game = advanceResidualCunning(game, state => !state.battle && residualCunningClean(state), actions);
  return { game, sealed, plans, actions };
}
