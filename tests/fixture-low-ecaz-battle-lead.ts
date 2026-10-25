import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  createHomeworldEcazOccupyFixture,
  type HomeworldEcazStep,
} from './fixture-homeworld-ecaz-occupy';
import { truthMovementInventory, truthMovementPlayer } from './fixture-truth-movement';

export type LowEcazBattleLeadStep = HomeworldEcazStep;
export const lowEcazBattleLeadPlayer = truthMovementPlayer;
export const lowEcazBattleLeadInventory = truthMovementInventory;

/** Select only actual original scalar lotteries. Event UUID entropy remains native. */
function originalLotteries<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

export function actLowEcazBattleLead(game: Game, actor: string, action: Action,
  steps: LowEcazBattleLeadStep[] = []): Game {
  const after = originalLotteries(() => applyAction(game, actor, action));
  steps.push({ actor, action: structuredClone(action) }); return after;
}

/** The caller owns the real lead choice and unsealed plans. Original responses
 * may pass; optional Atreides/Emperor battle preparations are declined. */
export function nextLowEcazBattleLead(game: Game): LowEcazBattleLeadStep | null {
  if (game.decision?.kind === 'ecazBattleLead') return null;
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceLowEcazBattleLead(game: Game, until: (state: Game) => boolean,
  steps: LowEcazBattleLeadStep[] = []): Game {
  for (let count = 0; count < 500; count++) {
    if (until(game)) return game;
    const next = nextLowEcazBattleLead(game);
    assert.ok(next, 'Choose the original battle lead or seal a real plan before continuing');
    game = actLowEcazBattleLead(game, next.actor, next.action, steps);
  }
  throw Error('The original Low Ecaz battle did not reach its finite continuation boundary');
}
export function passLowEcazBattleLead(game: Game, steps: LowEcazBattleLeadStep[] = []): Game {
  for (let count = 0; game.response && count < 80; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actLowEcazBattleLead(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response); return game;
}
export function openLowEcazBattleLeadPlans(game: Game, steps: LowEcazBattleLeadStep[] = []): Game {
  return advanceLowEcazBattleLead(game, state => !!state.battle && !state.response &&
    !state.decision && !state.battle.preparation && (!state.battle.preLeader || state.battle.preLeader.closed), steps);
}
export function chooseLowEcazBattleLead(game: Game, lead: string,
  steps: LowEcazBattleLeadStep[] = []): Game {
  const decision = game.decision; assert.ok(decision?.kind === 'ecazBattleLead');
  return actLowEcazBattleLead(game, decision.player,
    { type: 'decision', event: decision.event, lead }, steps);
}

/** Public Basic/Advanced E3 + Homeworlds source. Ecaz's real setup leaves 14
 * native reserves. An actual seven/eight-counter paid city shipment leaves
 * exactly seven/six; a genuine worm Nexus earns its Emperor alliance first.
 * Only original unopened deal/Spice order and scalar lotteries are selected. */
export function createLowEcazBattleLeadFixture(options: { advanced?: boolean; reserves?: 6 | 7 } = {}) {
  const advanced = options.advanced ?? true, reserves = options.reserves ?? 6;
  const setupSteps: LowEcazBattleLeadStep[] = [];
  const dealOrder: { position: number; from: number; card: string }[] = [];
  let beforeStartingDeal: Game | undefined;
  let originalInventory: string[] = [], karama = '';
  const f = originalLotteries(() => createHomeworldEcazOccupyFixture({
    advanced, ecazForces: 14 - reserves,
    finishSetup(initial) {
      let game = structuredClone(initial);
      assert.equal(game.status, 'setup'); assert.ok(game.homeworlds);
      assert.ok(game.players.every(player => player.hand.length === 0));
      originalInventory = lowEcazBattleLeadInventory(game);
      const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 2);
      const counter = game.deck.find(card => card.effect === 'karama');
      assert.equal(ordinary.length, 2); assert.ok(counter); karama = counter.id;
      for (const [position, card] of [...ordinary, counter].entries()) {
        const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
        [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
        dealOrder.push({ position, from, card: card.id });
      }
      beforeStartingDeal = structuredClone(game);
      for (let count = 0; count < 160 && game.status === 'setup'; count++) {
        const next = game.setupStage === 'forces' && lowEcazBattleLeadPlayer(game, 'ecaz').reserves === 20
          ? { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } }
          : nextStrongholdFactionsNativeStep(game);
        assert.ok(next, 'The original native Ecaz setup must have its next real control');
        game = actLowEcazBattleLead(game, next.actor, next.action, setupSteps);
      }
      assert.equal(game.status, 'playing');
      assert.deepEqual(lowEcazBattleLeadPlayer(game, 'ecaz').forces, { 'imperial_basin:9': 6 });
      assert.equal(lowEcazBattleLeadPlayer(game, 'ecaz').reserves, 14);
      assert.deepEqual(lowEcazBattleLeadPlayer(game, 'guild').hand.map(card => card.id), [karama]);
      return game;
    },
  }));
  assert.ok(beforeStartingDeal);
  const startAt = f.actions.findIndex(step => step.action.type === 'start'); assert.ok(startAt >= 0);
  const actions = [...f.actions.slice(0, startAt + 1), ...setupSteps, ...f.actions.slice(startAt + 1)];
  const ecaz = lowEcazBattleLeadPlayer(f.game, f.ecaz);
  assert.equal(ecaz.reserves, reserves); assert.equal(ecaz.forces[f.location], 14 - reserves);
  assert.equal(ecaz.ally, f.ally); assert.equal(lowEcazBattleLeadPlayer(f.game, f.ally).ally, f.ecaz);
  assert.ok(lowEcazBattleLeadPlayer(f.game, f.opponent).hand.some(card => card.id === karama));
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 6);
  assert.ok(f.game.decision?.kind === 'ecazBattleLead');
  assert.deepEqual(lowEcazBattleLeadInventory(f.game), originalInventory);
  homeworldGameIntegrity(f.game);
  const event = f.game.decision.event, source = structuredClone(f.game);
  const leadActions = f.game.decision.choices.map(lead => ({
    actor: f.game.decision!.player,
    action: { type: 'decision', event, lead } as Action,
  }));
  const shipments = actions.filter(step => step.action.type === 'ship');
  return {
    ...f, game: f.game, source, beforeChoice: source, beforeStartingDeal, advanced, reserves,
    ecaz: f.ecaz, ally: f.ally, opponent: f.opponent, holder: f.opponent, karama,
    chooser: f.game.decision.player, event, leadActions,
    cancelAction: { type: 'card', card: karama, mode: 'cancel' } as Action,
    actions, steps: actions, setupSteps, shipments,
    allianceSteps: actions.filter(step => step.action.type === 'alliance'),
    dealOrder, originalInventory, originalCards: originalInventory, sourceActionCount: actions.length,
    originalBalances: Object.fromEntries(f.afterSetup.players.map(player => [player.id, player.spice])),
    balances: Object.fromEntries(f.game.players.map(player => [player.id, player.spice])),
    staging: [
      'Native public Basic/Advanced Ecaz/Emperor/Guild with actual Homeworlds lobby setting and original E3 base 33-card deck. Only three unopened original deal positions, original scalar lotteries and the existing native fixture’s unopened land/worm Spice order are selected. Guild receives its own original Karama. Ecaz actually places six original counters in Imperial Basin, earns its Emperor alliance by actual proposal/acceptance at the second-turn worm Nexus, then pays for one original city shipment of eight counters (seven at the High boundary). Emperor and Guild make their own original paid typed shipments. No bribe, army, reserve, wallet, phase, alliance, hand, receipt, population or lead decision is installed. The source stops at the real chooseBattle-created lead decision; its actual decision.player remains authoritative.',
    ],
  };
}
export type LowEcazBattleLeadFixture = ReturnType<typeof createLowEcazBattleLeadFixture>;
