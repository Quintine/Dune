import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const sapho = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(sapho);
export const LATE_SAPHO = sapho.id;
export const LATE_SAPHO_STONE = 'richese-stone-burner';
export type SaphoLateStep = { actor: string; action: Action };
export const saphoLatePlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoLateClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actSaphoLate(game: Game, actor: string, action: Action, actions: SaphoLateStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function nextSaphoLateStep(game: Game, stone = false): SaphoLateStep | null {
  const pending = game.pendingTreacheryDiscard;
  if (pending) {
    const reaction = pending.reaction;
    if (reaction?.stage === 'offer') {
      const actor = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(actor);
      return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
    }
    if (pending.reaction) return null; // A committed private choice needs its owner.
    return { actor: game.players[0].id, action: { type: 'advanceBots' } };
  }
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'stoneAllocation' || decision.kind === 'battleLosses') return null;
    if (decision.kind === 'richeseCache') {
      const id = stone && game.turn === 1 ? LATE_SAPHO_STONE : LATE_SAPHO;
      const card = game.richeseCache!.find(card => card.id === id) ?? game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (decision.kind === 'stoneBurner') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, mode: 'ignore' } };
  }
  const lot = game.richeseAuction;
  if (saphoLateClean(game) && lot && !lot.outcome && [LATE_SAPHO, LATE_SAPHO_STONE].includes(lot.cardId) &&
    lot.active === 'emperor' && lot.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSaphoLate(game: Game, until: (state: Game) => boolean,
  actions: SaphoLateStep[] = [], stone = false): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original late Sapho programme ended before its next owned control');
    const step = nextSaphoLateStep(game, stone); assert.ok(step, 'Choose the actual private battle consequence before continuing');
    game = actSaphoLate(game, step.actor, step.action, actions);
  }
  throw Error('The original late Sapho programme did not reach its finite boundary');
}
/** Resolve the actual fresh cost without acknowledging or advancing the
 * original battle opportunity that resumes after its neutral Semuta passes. */
export function settleSaphoLateDiscard(game: Game, actions: SaphoLateStep[] = []): Game {
  return advanceSaphoLate(game, state => !state.pendingTreacheryDiscard, actions);
}

/** Original public host, paid cache Sapho and paid opposing Arrakeen forces.
 * Stone adds a genuine first-turn paid Stone and next-turn paid Sapho, with
 * accepted original circles keeping Richese the second-turn physical attacker.
 * Only unopened Spice positions and scalar lotteries are controlled. */
export function createSaphoLateAggressorFixture(options: { advanced?: boolean; stone?: boolean } = {}) {
  const stone = options.stone ?? false, advanced = options.advanced ?? stone;
  assert.ok(!stone || advanced, 'The bounded mixed physical Stone programme uses Advanced Sardaukar');
  let game = createGame('SAPHOLATEAGGRESSOR', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SaphoLateStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoLate(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoLate(game, until, actions, stone); };
  if (stone) {
    act('richese', { type: 'seatPosition', position: 4 });
    act('emperor', { type: 'seatPosition', position: 5 });
  }
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  for (let count = 0; count < (stone ? 2 : 1) * (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  let acquiredStone: Game | null = null;
  if (stone) {
    reach(state => saphoLatePlayer(state).hand.some(card => card.id === LATE_SAPHO_STONE));
    acquiredStone = structuredClone(game);
  }
  reach(state => saphoLatePlayer(state).hand.some(card => card.id === LATE_SAPHO));
  const acquiredSapho = structuredClone(game), targetTurn = stone ? 2 : 1;
  const shipments: { before: Game; step: SaphoLateStep; after: Game }[] = [], shipped = new Set<string>();
  for (let count = 0; shipped.size < 2 && count < 600; count++) {
    if (game.turn === targetTurn && game.phase === 5 && game.active && saphoLateClean(game) &&
      ['richese', 'emperor'].includes(game.active) && !shipped.has(game.active)) {
      const actor = game.active, before = structuredClone(game), step: SaphoLateStep = { actor, action: {
        type: 'ship', territory: 'arrakeen', sector: 10, amount: stone && actor === 'emperor' ? 6 : 3,
        elite: stone && actor === 'emperor' ? 1 : 0, allyPayment: 0,
      } };
      act(step.actor, step.action); reach(saphoLateClean);
      shipments.push({ before, step, after: structuredClone(game) }); shipped.add(actor);
    } else {
      const step = nextSaphoLateStep(game, stone); assert.ok(step); act(step.actor, step.action);
    }
  }
  assert.equal(shipped.size, 2);
  reach(state => state.phase === 6 && !!state.active && saphoLateClean(state));
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === 'arrakeen'); assert.ok(choice);
  const chooseBattle: SaphoLateStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen', target: choice.chooser === 'richese' ? 'emperor' : 'richese',
  } };
  act(chooseBattle.actor, chooseBattle.action);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && saphoLateClean(state));
  assert.equal(game.battle!.attacker, 'richese', 'Original paid source/circles keep Richese the physical attacker');
  assert.equal(game.battle!.defender, 'emperor');
  const plans: SaphoLateStep[] = ['richese', 'emperor'].map(actor => {
    const leader = saphoLatePlayer(game, actor).leaders.find(leader => leader.strength === 3 && !leader.dead && !leader.usedAt);
    assert.ok(leader, 'Use a genuinely dealt faction leader disc');
    return { actor, action: { type: 'battlePlan', leader: leader.id, dial: stone && actor === 'emperor' ? 3 : 1,
      support: advanced ? 1 : 0, weapon: stone && actor === 'emperor' ? LATE_SAPHO_STONE : null } };
  });
  return { game, lobby, setup, afterSetup, acquiredStone, acquiredSapho, shipments, beforeBattle, chooseBattle, plans,
    owner: 'emperor', opponent: 'richese', location: 'arrakeen:10', card: LATE_SAPHO, stone, advanced,
    sourceActionCount: actions.length, actions,
    staging: ['Original native host/setup, cache1 purchase(s), funded physical/typed shipments and actual chooseBattle create the source. Only unopened land Spice positions/scalar lotteries are selected. The Stone branch uses accepted Richese circle4/Emperor circle5 lobby choices before readiness; no postdeal hand, force, wallet, phase, battle stamp or receipt is installed.'] };
}
export type SaphoLateAggressorFixture = ReturnType<typeof createSaphoLateAggressorFixture>;
export function saphoLateAggressorAction(game: Game, owner = 'emperor'): Action {
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === 'battleAggressor');
  assert.ok(option, 'The genuine owned late aggressor opportunity must be available');
  return { type: 'card', card: LATE_SAPHO, ...option };
}
export function saphoLateOutcomeReady(game: Game, actor: string): Action {
  const window = viewGame(game, actor).battle?.outcomeWindow; assert.ok(window && !window.closed);
  return { type: 'battleOutcomeReady', event: window.event };
}

/** Leave the original outcome window open. One-plan Sapho keeps the sealed
 * opposing plan; final-window Sapho may follow its own actual acknowledgement
 * and must reset both acknowledgement marks without replaying any original vote. */
export function prepareSaphoLateOutcome(fixture: SaphoLateAggressorFixture, options: {
  useAt?: 'none' | 'onePlan' | 'window'; readyBeforeUse?: boolean;
} = {}) {
  const useAt = options.useAt ?? 'none';
  let game = structuredClone(fixture.game), used: Action | null = null, afterUse: Game | null = null;
  let beforeUse: Game | null = null, afterDiscard: Game | null = null, acknowledged: Game | null = null;
  const actions: SaphoLateStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoLate(game, actor, action, actions); };
  act(fixture.plans[0].actor, fixture.plans[0].action);
  const onePlan = structuredClone(game);
  if (useAt === 'onePlan') {
    beforeUse = structuredClone(game); used = saphoLateAggressorAction(game, fixture.owner);
    act(fixture.owner, used); afterUse = structuredClone(game);
    game = settleSaphoLateDiscard(game, actions); afterDiscard = structuredClone(game);
  }
  act(fixture.plans[1].actor, fixture.plans[1].action);
  const revealed = structuredClone(game);
  game = advanceSaphoLate(game, state => !!state.battle?.outcomeWindow && !state.battle.outcomeWindow.closed && saphoLateClean(state), actions, fixture.stone);
  const opened = structuredClone(game);
  if (useAt === 'window') {
    if (options.readyBeforeUse) {
      act(fixture.owner, saphoLateOutcomeReady(game, fixture.owner)); acknowledged = structuredClone(game);
    }
    beforeUse = structuredClone(game); used = saphoLateAggressorAction(game, fixture.owner);
    act(fixture.owner, used); afterUse = structuredClone(game);
    game = settleSaphoLateDiscard(game, actions); afterDiscard = structuredClone(game);
  }
  return { game, onePlan, revealed, opened, beforeUse, used, afterUse, afterDiscard, acknowledged, useAt, actions };
}

/** Readies and later Stone/typed losses are chosen solely from actual owned
 * controls. No acknowledgement invents a new plan, weapon choice or vote. */
export function completeSaphoLateAggressor(fixture: SaphoLateAggressorFixture,
  programme: ReturnType<typeof prepareSaphoLateOutcome>, undialed = 2) {
  let game = structuredClone(programme.game);
  const actions: SaphoLateStep[] = [], readies: SaphoLateStep[] = [], allocations: {
    before: Game; step: SaphoLateStep; after: Game;
  }[] = [];
  for (let count = 0; count < 700; count++) {
    if (!game.battle && saphoLateClean(game)) return { game, actions, readies, allocations };
    if (game.pendingTreacheryDiscard) {
      game = settleSaphoLateDiscard(game, actions); continue;
    }
    const decision = !game.response && !game.phaseOpening ? game.decision : null;
    const window = game.battle?.outcomeWindow;
    let step: SaphoLateStep | null;
    if (window && !window.closed && saphoLateClean(game)) {
      const actor = [window.attacker, window.defender].find(actor => !window.ready.includes(actor)); assert.ok(actor);
      step = { actor, action: saphoLateOutcomeReady(game, actor) }; readies.push(structuredClone(step));
    } else if (decision?.kind === 'stoneAllocation') {
      const offer = viewGame(game, decision.player).battle!.stoneAllocation; assert.ok(offer && offer.totals.includes(undialed));
      step = { actor: decision.player, action: { type: 'decision', event: offer.event, undialed } };
      const before = structuredClone(game); game = actSaphoLate(game, step.actor, step.action, actions);
      allocations.push({ before, step, after: structuredClone(game) }); continue;
    } else if (decision?.kind === 'battleLosses') step = { actor: decision.player, action: { type: 'decision', choice: 0 } };
    else step = nextSaphoLateStep(game, fixture.stone);
    assert.ok(step, 'Complete the real late Sapho native consequence explicitly');
    game = actSaphoLate(game, step.actor, step.action, actions);
  }
  throw Error('The original late Sapho outcome did not complete its finite native continuation');
}
