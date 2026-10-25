import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaCombatDeclarationsFixture as fixture, actSemutaCombatDeclarations as act,
  passSemutaCombatDeclarations as pass, claimSemutaCombatDeclarations as claim,
  allowSemutaCombatDeclarations as allow, finishSemutaCombatDeclarations as finish,
  semutaCombatDeclarationsPlayer as player, semutaCombatDeclarationsInventory as inventory,
  type SemutaCombatDeclarationsFixture,
} from './fixture-semuta-combat-declarations';

const variants = [
  { kind: 'voice' as const, advanced: false },
  { kind: 'voice' as const, advanced: true },
  { kind: 'prescience' as const, advanced: false },
  { kind: 'prescience' as const, advanced: true },
];
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active, ready: game.ready,
  movementRemaining: game.movementRemaining, spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  pendingArrivalReaction: game.pendingArrivalReaction, pendingAmbassador: game.pendingAmbassador,
  pendingTerrorEntry: game.pendingTerrorEntry,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaCombatDeclarationsFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.bg).forces['polar_sink:0'], 1);
  assert.equal(player(f.afterSetup, f.atreides).forces['arrakeen:10'], 10);
  if (f.advanced) assert.ok(f.actions.some(step => step.actor === f.bg && step.action.type === 'advisorSetup' &&
    step.action.territory === 'polar_sink' && step.action.sector === 0));
  assert.ok(f.actions.some(step => step.actor === f.bg && step.action.type === 'predict'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(player(f.shipment.before, f.bg).spice - player(f.shipment.after, f.bg).spice, 2);
  assert.equal(player(f.shipment.after, f.bg).reserves, player(f.shipment.before, f.bg).reserves - 2);
  assert.equal(player(f.shipment.after, f.bg).forces['arrakeen:10'], 2);
  assert.equal(player(f.game, f.bg).forces['arrakeen:10'], 2);
  assert.equal(player(f.game, f.bg).advisors?.arrakeen, undefined);
  assert.equal(player(f.game, f.atreides).forces['arrakeen:10'], 10);
  assert.deepEqual(f.battle.steps[0], { actor: f.chooser, action: f.battleAction });
  assert.equal(f.readiness.steps.length, 2);
  assert.ok(f.readiness.steps.every(step => step.action.type === 'battlePreparationReady' && step.action.event === f.originalBattle.event));
  assert.deepEqual(new Set(f.readiness.steps.map(step => step.actor)), new Set([f.bg, f.atreides]));
  assert.equal(f.originalBattle.preLeader?.closed, true);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, 1);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.game.battle?.territory, 'arrakeen');
  assert.equal(f.game.battle?.revealed, false); assert.deepEqual(f.game.battle?.plans, {});
  assert.deepEqual(f.game.battle, f.originalBattle);
  if (f.kind === 'voice') {
    assert.equal(f.declinedVoice, null);
    assert.deepEqual(f.game.battle?.voice, { target: f.atreides, kind: 'projectile', must: false });
    assert.deepEqual(f.game.battle?.preparation, { kind: 'prescience', owner: f.atreides, beneficiary: f.atreides });
  } else {
    assert.ok(f.declinedVoice);
    assert.deepEqual(f.declinedVoice.steps, [{ actor: f.bg, action: { type: 'declineBattlePower' } }]);
    assert.equal(f.game.battle?.voice, undefined);
    assert.deepEqual(f.game.battle?.prescience, { player: f.atreides, field: 'weapon' });
    assert.equal(Object.hasOwn(f.game.battle!.prescience!, 'value'), false);
    assert.deepEqual(f.game.battle?.preparation, { kind: 'prescienceAnswer', owner: f.bg, beneficiary: f.atreides });
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaCombatDeclarationsFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaCombatDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaCombatDiscard') throw Error('Use the original combat-declaration cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function prevented(game: Game, f: SemutaCombatDeclarationsFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.response ?? null, null);
  assert.deepEqual(physical(game), physical(f.game));
  const battle = structuredClone(f.originalBattle), patch = f.expected.patches;
  if (f.expected.powerChecks !== undefined) battle.powerChecks = structuredClone(f.expected.powerChecks);
  if (patch.deleteVoice) delete battle.voice;
  if (patch.deletePrescience) delete battle.prescience;
  if (patch.deletePreparation) delete battle.preparation;
  if (patch.fullPlanOffered) battle.fullPlanOffered = true;
  assert.deepEqual(game.battle, battle);
  assert.deepEqual(game.decision ?? null, f.expected.decision);
  if (f.kind === 'voice') {
    assert.equal(game.battle?.voice, undefined);
    assert.deepEqual(game.battle?.preparation, f.originalBattle.preparation, 'The original next Prescience belongs to Atreides');
  } else {
    assert.equal(game.battle?.prescience, undefined); assert.equal(game.battle?.preparation, undefined);
  }
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function revealOriginalBattle(game: Game, f: SemutaCombatDeclarationsFixture, preventedPower: boolean) {
  const steps: { actor: string; action: Action }[] = [];
  game = finish(game, steps);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.battle?.preparation, undefined);
  assert.equal(game.battle?.event, f.originalBattle.event); assert.equal(game.battle?.revealed, false);
  assert.deepEqual(game.battle?.plans, {}); assert.equal(game.battle?.preLeader?.closed, true);
  assert.deepEqual(physical(game), physical(f.game));
  if (f.kind === 'prescience' && !preventedPower) {
    assert.ok(steps.some(step => step.actor === f.bg && step.action.type === 'prescienceAnswer' && step.action.value === null));
    assert.equal(game.battle?.prescience?.value, null);
  } else assert.equal(steps.some(step => step.action.type === 'prescienceAnswer'), false);
  if (f.kind === 'voice') assert.equal(game.battle?.voice !== undefined, !preventedPower);
  const first = f.originalBattle.attacker, second = f.originalBattle.defender;
  game = act(game, first, { type: 'battlePlan', ...f.plans[first] });
  assert.equal(game.battle?.event, f.originalBattle.event); assert.equal(game.battle?.revealed, false);
  assert.deepEqual(game.battle?.plans[first], f.plans[first]);
  assert.equal(game.battle?.plans[second], undefined);
  game = act(game, second, { type: 'battlePlan', ...f.plans[second] });
  assert.equal(game.battle?.event, f.originalBattle.event); assert.equal(game.battle?.revealed, true);
  assert.deepEqual(game.battle?.plans[first], f.plans[first]); assert.deepEqual(game.battle?.plans[second], f.plans[second]);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind} used cancellation cost ${claimed ? 'claim' : 'pass'} preserves the original battle and resumes preparation once`, () => {
    const f = fixture(variant); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    revealOriginalBattle(game, f, true);
  });

void test('native Voice and ordinary Prescience allowances retain the actual declaration and its next original control', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    const game = allow(structuredClone(f.game));
    assert.equal(game.response ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
    assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    revealOriginalBattle(game, f, false);
  }
});

void test('fresh combat costs reject stale and underlying answers while both original preparation cursors stay parked', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.owner, f.nativeAction);
    reject(game, f.atreides, { type: 'battlePlan', ...f.plans[f.atreides] });
    reject(game, f.kind === 'voice' ? f.atreides : f.bg, f.kind === 'voice'
      ? { type: 'declineBattlePower' } : { type: 'prescienceAnswer', value: null });
    assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
    prevented(pass(game), f, false);
  }
});

void test('all four minimal policies answer the actual Basic and Advanced combat-declaration costs legally', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
