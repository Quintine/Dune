import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actResidualPoisonCapture, advanceResidualPoisonCapture, completeResidualPoisonCapture,
  createResidualPoisonCaptureFixture, residualPoisonCaptureClean, residualPoisonCapturePlayer as player,
  useResidualPoisonCapture, type ResidualPoisonCaptureFixture,
} from './fixture-residual-poison-capture';

const physicalLeader = (game: Game, id: string) => {
  const leader = game.players.flatMap(player => player.leaders).find(leader => leader.id === id); assert.ok(leader); return leader;
};
const publicEmperorLeader = (game: Game, f: ResidualPoisonCaptureFixture) =>
  viewGame(game, f.observer).players.find(player => player.id === f.nativeOwner)!.leaders.find(leader => leader.id === f.captive)!;
function source(f: ResidualPoisonCaptureFixture) {
  assert.equal(f.game.advanced, true);
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'start' && step.action.advancedPreview === true));
  assert.ok(f.actions.some(step => step.actor !== f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 2));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.card));
  assert.equal(player(f.afterSetup, f.target).forces['carthag:11'], 10);
  assert.deepEqual(f.shipments.map(shipment => [shipment.step.actor, shipment.step.action.amount]),
    [[f.target, 3], [f.nativeOwner, 1], [f.owner, 1]]);
  for (const shipment of f.shipments) {
    const cost = shipment.step.actor === f.target ? 6 : shipment.step.actor === f.nativeOwner ? 2 : 1;
    assert.equal(player(shipment.before, shipment.step.actor).spice - player(shipment.after, shipment.step.actor).spice, cost);
    assert.equal(player(shipment.before, shipment.step.actor).reserves - player(shipment.after, shipment.step.actor).reserves,
      shipment.step.action.amount);
  }
  assert.equal(f.captureOffer.decision?.kind, 'captureOffer');
  assert.ok(f.actions.some(step => step.actor === f.target && step.action.type === 'decision' && step.action.accept === true));
  assert.ok(f.actions.some(step => step.actor === f.target && step.action.type === 'decision' && step.action.mode === 'keep'));
  assert.equal(physicalLeader(f.afterCapture, f.captive).capturedBy, f.target);
  assert.ok(physicalLeader(f.afterCapture, f.captive).concealed);
  assert.equal(physicalLeader(f.game, f.captive).dead, false);
  assert.equal(physicalLeader(f.game, f.firstHarkonnenLeader).usedAt, 'red_chasm');
  assert.equal(publicEmperorLeader(f.game, f).capturedBy, undefined);
  assert.equal(publicEmperorLeader(f.game, f).dead, false);
  assert.equal(viewGame(f.game, f.observer).players.find(player => player.id === f.target)!.leaders.some(leader => leader.id === f.captive), false);
  assert.equal(f.game.battle!.territory, 'carthag');
  assert.equal(f.game.battle!.attacker, f.target);
  assert.equal(f.game.battle!.defender, f.owner);
  assert.deepEqual(f.game.battle!.plans, {});
  assert.equal(f.game.battle!.preLeader!.closed, false);
  assert.equal(viewGame(f.game, f.owner).residualPoison!.blocked, null);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function death(f: ResidualPoisonCaptureFixture, result: ReturnType<typeof useResidualPoisonCapture>) {
  const before = result.before, after = result.game;
  assert.equal(result.poolIds.length, 5);
  assert.ok(result.poolIds.includes(f.captive));
  assert.equal(result.poolIds.includes(f.firstHarkonnenLeader), false);
  const changed = before.players.flatMap(player => player.leaders)
    .filter(leader => leader.deaths !== physicalLeader(after, leader.id).deaths);
  assert.deepEqual(changed.map(leader => leader.id), [result.victim]);
  assert.equal(physicalLeader(after, result.victim).dead, true);
  assert.equal(physicalLeader(after, result.victim).deaths, physicalLeader(before, result.victim).deaths + 1);
  assert.equal(physicalLeader(after, result.victim).usedAt, undefined);
  assert.equal(physicalLeader(after, result.victim).capturedBy, undefined);
  assert.equal(physicalLeader(after, result.victim).concealed, undefined);
  assert.deepEqual(after.players.map(player => player.spice), before.players.map(player => player.spice),
    'Residual death pays neither a bounty nor the Harkonnen execution2');
  assert.deepEqual(after.players.map(player => ({ forces: player.forces, reserves: player.reserves, tanks: player.tanks })),
    before.players.map(player => ({ forces: player.forces, reserves: player.reserves, tanks: player.tanks })));
  assert.equal(after.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(after).hand.some(card => card.id === f.card), false);
  assert.equal(after.richeseCache!.some(card => card.id === f.card), false);
  assert.equal(after.battle!.event, before.battle!.event);
  assert.deepEqual(after.battle!.plans, {});
  assert.throws(() => actResidualPoisonCapture(after, f.owner, result.action));
}

void test('genuine Advanced native Harkonnen Poison death preserves the actually captured nonselected Emperor disc concealed', () => {
  const f = createResidualPoisonCaptureFixture(); source(f);
  const result = useResidualPoisonCapture(f, 'native'); death(f, result);
  assert.equal(physicalLeader(result.game, result.victim).faction, 'harkonnen');
  assert.deepEqual(physicalLeader(result.game, f.captive), physicalLeader(f.game, f.captive));
  assert.deepEqual(publicEmperorLeader(result.game, f), publicEmperorLeader(f.game, f));
  assert.equal(result.game.log.slice(f.game.log.length).some(entry => entry.text.includes(physicalLeader(f.game, f.captive).name)), false);
  const finished = completeResidualPoisonCapture(f, result.game);
  assert.equal(finished.game.battle, null);
  assert.equal(finished.game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(physicalLeader(finished.game, f.captive), physicalLeader(f.game, f.captive));
  assert.equal(player(finished.game).forces['carthag:11'], 1);
  assert.ok(finished.actions.some(step => step.action.type === 'battlePreparationReady'));
  assert.ok(finished.actions.some(step => step.action.type === 'battleOutcomeReady'));
});

void test('genuine Advanced captured Emperor Poison death publishes only its selected normal Tanks death and clears its actual captivity', () => {
  const f = createResidualPoisonCaptureFixture(); source(f);
  const result = useResidualPoisonCapture(f, 'captive'); death(f, result);
  assert.equal(result.victim, f.captive);
  assert.equal(physicalLeader(result.game, f.captive).faction, 'emperor');
  assert.equal(publicEmperorLeader(result.game, f).dead, true);
  assert.equal(publicEmperorLeader(result.game, f).deaths, 1);
  assert.equal(publicEmperorLeader(result.game, f).capturedBy, undefined);
  assert.ok(result.game.log.slice(f.game.log.length).some(entry => entry.text.includes(physicalLeader(f.game, f.captive).name)));
  assert.equal(player(result.game, f.target).leaders.filter(leader => leader.dead).length,
    player(f.game, f.target).leaders.filter(leader => leader.dead).length);
  const finished = completeResidualPoisonCapture(f, result.game);
  assert.equal(finished.game.battle, null);
  assert.equal(physicalLeader(finished.game, f.captive).dead, true);
  assert.equal(physicalLeader(finished.game, f.captive).deaths, 1);
  assert.equal(physicalLeader(finished.game, f.captive).capturedBy, undefined);
  assert.equal(finished.game.discard.filter(card => card.id === f.card).length, 1);
});

void test('all four minimal profiles play the original offered Poison against the real captor then continue the actual shared preparation', () => {
  const f = createResidualPoisonCaptureFixture();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(f.game, f.owner);
    view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'card' && action.card === f.card);
    assert.ok(action, `${difficulty} uses the real offered owned Poison source`);
    assert.equal(action.target, f.target);
    assert.equal(action.event, f.game.battle!.event);
    let game = actResidualPoisonCapture(structuredClone(f.game), f.owner, action);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    const owned = viewGame(game, f.owner);
    owned.players.find(player => player.id === f.owner)!.bot = difficulty;
    const ready = botActions(owned).find(action => action.type === 'battlePreparationReady'); assert.ok(ready);
    game = actResidualPoisonCapture(game, f.owner, ready);
    game = advanceResidualPoisonCapture(game,
      game => !!game.battle?.preLeader?.closed && residualPoisonCaptureClean(game));
    const planning = viewGame(game, f.owner);
    planning.players.find(player => player.id === f.owner)!.bot = difficulty;
    const plan = botActions(planning).find(action => action.type === 'battlePlan'); assert.ok(plan);
    assert.doesNotThrow(() => actResidualPoisonCapture(game, f.owner, plan));
  }
});
