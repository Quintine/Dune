import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaCombatForcesFixture as fixture, actSemutaCombatForces as act,
  passSemutaCombatForces as pass, claimSemutaCombatForces as claim,
  allowSemutaCombatForces as allow, finishSemutaCombatForces as finish,
  semutaCombatForcesPlayer as player, semutaCombatForcesInventory as inventory,
  semutaCombatForcesPhysical as physical, type SemutaCombatForcesFixture,
} from './fixture-semuta-combat-forces';

const variants = [
  { kind: 'eliteStrength' as const, eliteOwner: 'fremen' as const },
  { kind: 'eliteStrength' as const, eliteOwner: 'emperor' as const },
  { kind: 'fremenSupport' as const },
  { kind: 'choamBattleAid' as const },
];
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active,
  order: game.order, ready: game.ready, storm: game.storm, spiceDeck: game.spiceDeck,
  spiceDiscard: game.spiceDiscard, movementRemaining: game.movementRemaining });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaCombatForcesFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'fremen', 'emperor', 'guild']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(player(f.afterSetup, f.emperor).hand.some(card => card.id === f.independentKarama && card.effect === 'karama'));
  assert.notEqual(f.cost, f.independentKarama);
  assert.equal(player(f.afterSetup, f.fremen).forces['sietch_tabr:14'], 10);
  assert.equal(player(f.afterSetup, f.fremen).elites?.reserves, 3);
  assert.equal(player(f.afterSetup, f.emperor).elites?.reserves, 5);
  assert.equal(Object.keys(player(f.afterSetup, f.richese).forces).length, 0,
    'The opposing Richese garrison must be earned by its own actual shipment');
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.shipments.length, 2);
  for (const shipment of f.shipments) {
    assert.ok(shipment.steps.some(step => step.actor === shipment.actor && step.action.type === 'ship' &&
      step.action.amount === 1 && step.action.elite === shipment.elite));
    assert.equal(player(shipment.before, shipment.actor).spice - player(shipment.after, shipment.actor).spice, shipment.cost);
    assert.equal(player(shipment.before, shipment.actor).reserves - player(shipment.after, shipment.actor).reserves, 1);
    assert.equal(player(shipment.after, shipment.actor).forces[f.location], 1);
  }
  assert.equal(player(f.game, f.combatant).elites?.forces[f.location], 1);
  assert.equal(player(f.game, f.opponent).forces[f.location], 1);
  assert.equal(player(f.game, f.fremen).forces['sietch_tabr:14'], 10);
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, f.turn);
  assert.equal(f.game.battle?.revealed, false); assert.deepEqual(f.game.battle?.plans, {});
  assert.deepEqual(f.game.battle, f.originalBattle); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.game.decision ?? null, null);
  assert.equal(player(f.game, f.spender).hand.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(f.game, f.holder).hand.filter(card => card.id === f.semuta).length, 1);
  if (f.combatant === f.emperor) assert.notEqual(f.opponent, f.fremen,
    'Sardaukar never earn their native double-strength check against Fremen');
  if (f.kind === 'fremenSupport') {
    assert.equal(f.game.battle?.eliteBlocked?.includes(f.combatant) ?? false, false);
    assert.ok(f.earlierControls.steps.some(step => step.action.type === 'passResponse'));
  }
  if (f.kind === 'choamBattleAid') {
    assert.equal(f.turn, 2); assert.ok(f.alliance); assert.equal(f.alliance.steps.length, 2);
    assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
    assert.equal(player(f.game, f.holder).ally, f.emperor); assert.equal(player(f.game, f.emperor).ally, f.holder);
    assert.deepEqual(f.game.aid[f.holder], { recipient: f.emperor, amount: 1 });
    assert.ok(f.earlierControls.steps.some(step => step.actor === f.holder && step.action.type === 'decision' && step.action.amount === 1));
    assert.ok(f.earlierControls.steps.some(step => step.action.type === 'passResponse'));
    assert.equal(f.game.battle?.eliteBlocked?.includes(f.emperor) ?? false, false);
  } else assert.equal(f.alliance, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaCombatForcesFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaCombatDiscard');
  if (pending.continuation.kind !== 'karamaCombatDiscard') throw Error('Expected the original combat-power cost');
  assert.equal(pending.batch.cause, `karama:${f.kind}`); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(clock(game), clock(f.game)); assert.equal(game.response ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function beforePlans(state: Game, f: SemutaCombatForcesFixture, canceled: boolean) {
  assert.equal(state.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(physical(state), f.originalPhysical);
  assert.deepEqual(state.battle?.plans, {}); assert.equal(state.battle?.revealed, false);
  if (canceled) {
    assert.deepEqual(state.battle?.powerChecks, f.expected.powerChecks);
    assert.deepEqual(state.response, f.expected.response);
    if (f.kind === 'eliteStrength') assert.deepEqual(state.battle?.eliteBlocked, [f.combatant]);
    if (f.kind === 'fremenSupport') assert.equal(state.battle?.fremenSupportBlocked, true);
    if (f.kind === 'choamBattleAid') assert.equal(state.battle?.choamAidBlocked, true);
  }
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.phase, 6); assert.equal(game.turn, f.turn); assert.equal(game.battle?.event, f.originalBattle.event);
  assert.equal(game.battle?.revealed, false); assert.deepEqual(game.battle?.plans, {});
  assert.deepEqual(game.battle?.powerChecks, []); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(clock(game), clock(f.game));
  if (f.kind === 'eliteStrength') assert.equal(game.battle?.eliteBlocked?.includes(f.combatant) ?? false, canceled);
  if (f.kind === 'fremenSupport') assert.equal(game.battle?.fremenSupportBlocked, canceled);
  if (f.kind === 'choamBattleAid') assert.equal(game.battle?.choamAidBlocked, canceled);
  if (f.kind === 'eliteStrength' && f.combatant === f.fremen) {
    assert.equal(game.battle?.fremenSupportBlocked, false);
    assert.ok(steps.some(step => step.action.type === 'passResponse'), 'The independent support window really receives a pass');
  }
  assert.ok(steps.every(step => step.action.type !== 'battlePlan' && step.action.type !== 'card'));
  if (f.kind === 'choamBattleAid') {
    assert.equal(viewGame(game, f.combatant).aid.available, canceled ? 0 : 1);
    assert.deepEqual(game.aid, f.originalAid, 'The prior real pledge remains escrowed before any plan payment');
  }
  if (canceled) reject(game, f.combatant, f.allowedPlan);
  const plan = canceled ? f.canceledPlan : f.allowedPlan;
  const sealed = act(structuredClone(game), f.combatant, plan);
  assert.equal(sealed.battle?.plans[f.combatant]?.dial, plan.dial);
  assert.equal(sealed.battle?.plans[f.combatant]?.support, plan.support);
  assert.equal(sealed.battle?.plans[f.combatant]?.allyPayment ?? 0, plan.allyPayment);
  assert.equal(sealed.battle?.revealed, false); assert.deepEqual(physical(sealed), f.originalPhysical);
  assert.deepEqual(inventory(sealed), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaCombatForcesFixture, claimed: boolean) {
  const game = beforePlans(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.ok(player(game, f.emperor).hand.some(card => card.id === f.independentKarama));
  reject(game, f.spender, f.action); assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `Advanced native ${variant.kind === 'eliteStrength' ? `${variant.eliteOwner} ` : ''}${variant.kind} cost Semuta ${claimed ? 'claim' : 'pass'} resumes one combat check before plans`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native force-power allowance preserves positive Fedaykin Sardaukar free support and pledged CHOAM aid plans', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    const game = beforePlans(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native force-power cost reactions reject stale foreign and underlying declarations before flags or plans change', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.combatant, f.allowedPlan);
    reject(game, f.opponent, f.opponentPlan); reject(game, f.owner, { type: 'ready' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native elite support and CHOAM battle-aid costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});
