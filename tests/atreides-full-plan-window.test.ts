import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAtreidesFullPlanWindowFixture as fixture,
  actAtreidesFullPlanWindow as act,
  atreidesFullPlanWindowPlayer as player,
  atreidesFullPlanWindowInventory as inventory,
  finishAtreidesFullPlanWindow as finish,
} from './fixture-atreides-full-plan-window';

function rejected(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('actual paid setup and battle retain the special window after declining its first offer', () => {
  const f = fixture();
  assert.equal(f.offer.decision?.kind, 'fullPlanOffer');
  assert.equal(f.game.decision, null);
  assert.equal(f.game.battle?.revealed, false);
  assert.deepEqual(f.game.battle?.plans, {});
  assert.equal(viewGame(f.game, f.owner).atreidesFullPlan?.blocked, null);
  assert.deepEqual(viewGame(f.game, f.owner).atreidesFullPlan?.cards, [f.karama]);
  assert.equal(viewGame(f.game, f.guild).atreidesFullPlan, null);
  assert.deepEqual(inventory(f.game), f.originalInventory);
  const inspecting = act(f.game, f.owner, f.inspect);
  assert.equal(inspecting.decision, null);
  rejected(inspecting, f.owner, f.ownPlan, /requested by special prescience/);
  const read = act(inspecting, f.opponent, f.opponentPlan);
  assert.equal(read.decision, null);
  assert.equal(read.battle?.revealed, false);
  assert.ok(viewGame(read, f.owner).battle?.fullPlanInsight);
  assert.equal(finish(read, f).phase, 7);
});

void test('a target sealed before activation is immediately readable without changing that plan or spending support early', () => {
  const f = fixture();
  const sealed = act(f.game, f.opponent, f.opponentPlan);
  const before = structuredClone(player(sealed, f.opponent));
  assert.equal(viewGame(sealed, f.owner).battle?.plans[f.opponent], undefined);
  const read = act(sealed, f.owner, f.inspect);
  assert.deepEqual(read.battle?.plans, sealed.battle?.plans);
  assert.deepEqual(player(read, f.opponent), before);
  assert.equal(read.response, null);
  assert.equal(read.decision, null);
  const insight = viewGame(read, f.owner).battle?.fullPlanInsight;
  assert.deepEqual(insight?.plan, sealed.battle!.plans[f.opponent]);
  assert.deepEqual(insight?.cards.map(card => card.id), [f.weapon]);
  assert.equal(player(read, f.owner).specialKaramaUsed, true);
  assert.equal(read.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(read), f.originalInventory);
  for (const actor of [f.opponent, f.guild]) {
    assert.equal(viewGame(read, actor).battle?.fullPlanInsight, null);
    assert.equal(viewGame(read, actor).players.find(p => p.id === f.owner)?.hand, undefined);
  }
  rejected(read, f.opponent, { ...f.opponentPlan, dial: 0 }, /not available/);
  rejected(read, f.owner, f.inspect, /already been used/);
  const revealed = act(read, f.owner, f.ownPlan);
  assert.equal(revealed.battle?.revealed, true);
  assert.equal(viewGame(revealed, f.owner).battle?.fullPlanInsight, null);
  assert.equal(finish(revealed, f).phase, 7);
});

void test('own seal then special activation and target-last commitment reveals both once without a read deadlock', () => {
  const f = fixture();
  const sealed = act(f.game, f.owner, f.ownPlan);
  const inspecting = act(sealed, f.owner, f.inspect);
  assert.deepEqual(inspecting.battle?.plans, sealed.battle?.plans);
  assert.equal(inspecting.battle?.revealed, false);
  assert.equal(inspecting.decision, null);
  const revealed = act(inspecting, f.opponent, f.opponentPlan);
  assert.equal(revealed.battle?.revealed, true);
  assert.deepEqual(revealed.battle?.plans[f.owner], sealed.battle?.plans[f.owner]);
  assert.equal(revealed.log.filter(row => row.text === 'Both battle plans are revealed.').length, 1);
  assert.ok(revealed.log.some(row => row.text.includes('Both plans reveal immediately')));
  assert.notEqual(revealed.decision?.kind, 'fullPlanRead');
  rejected(revealed, f.owner, { ...f.ownPlan, dial: 0 }, /not available/);
  const done = finish(revealed, f);
  assert.equal(done.phase, 7);
  assert.equal(done.battle, null);
  assert.deepEqual(inventory(done), f.originalInventory);
});

void test('any one player includes the already sealed own plan without reopening it', () => {
  const f = fixture();
  const sealed = act(f.game, f.owner, f.ownPlan);
  const read = act(sealed, f.owner, { ...f.inspect, target: f.owner });
  assert.deepEqual(viewGame(read, f.owner).battle?.fullPlanInsight?.plan, sealed.battle?.plans[f.owner]);
  assert.deepEqual(read.battle?.plans, sealed.battle?.plans);
  assert.equal(viewGame(read, f.guild).battle?.fullPlanInsight, null);
  assert.equal(finish(read, f).phase, 7);
});

void test('actual preparation, foreign target and public reveal retain their timing and card boundaries', () => {
  const f = fixture();
  const before = viewGame(f.beforePreparation, f.owner).atreidesFullPlan;
  assert.ok(before?.blocked);
  rejected(f.beforePreparation, f.owner, f.inspect);
  rejected(f.game, f.owner, { ...f.inspect, target: f.guild }, /in this battle/);
  rejected(f.game, f.owner, { ...f.inspect, card: f.defense }, /Karama card/);
  let revealed = act(f.game, f.opponent, f.opponentPlan);
  revealed = act(revealed, f.owner, f.ownPlan);
  assert.equal(revealed.battle?.revealed, true);
  assert.match(viewGame(revealed, f.owner).atreidesFullPlan!.blocked!, /already been revealed/);
  rejected(revealed, f.owner, f.inspect, /already been revealed/);
  assert.equal(player(revealed, f.owner).specialKaramaUsed, undefined);
  assert.ok(player(revealed, f.owner).hand.some(card => card.id === f.karama));
});

for (const profile of DIFFICULTIES) {
  void test(`${profile} uses the same legal private late-inspection offer and continues to Collection`, () => {
    const f = fixture();
    const sealed = act(f.game, f.opponent, f.opponentPlan);
    const view = viewGame(sealed, f.owner);
    view.players.find(p => p.id === f.owner)!.bot = profile;
    const action = botActions(view)[0];
    assert.deepEqual(action, f.inspect);
    const read = act(sealed, f.owner, action);
    assert.ok(viewGame(read, f.owner).battle?.fullPlanInsight);
    assert.equal(finish(read, f).phase, 7);
  });
}
