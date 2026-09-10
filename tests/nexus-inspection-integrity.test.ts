import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  inspectionNative,
  nexusInspectionFixture,
} from './fixture-nexus-inspection';
import {
  nexusAllow,
  nexusInventory,
  nexusPlayer,
  nexusReload,
} from './fixture-nexus-cards';

function play(g: Game, mode = 'cunning', field = 'weapon'): Game {
  return applyAction(g, 'a', {
    type: 'nexusAtreides',
    event: g.battle!.event,
    mode,
    field,
  });
}

function answerAction(g: Game): Action {
  return {
    type: 'nexusPrescienceAnswer',
    event: g.battle!.event,
    value: null,
  };
}

function plan(g: Game, id: string, dial = 0): Action {
  return {
    type: 'battlePlan',
    dial,
    leader: nexusPlayer(g, id).leaders[0].id,
  };
}

function rejectedEverywhere(g: Game, actor: string, action: Action): void {
  const before = JSON.stringify(g);
  for (const seat of g.players) {
    assert.throws(() => viewGame(g, seat.id), /inspection|inspected|Nexus|Prescience|Cunning/i);
    assert.equal(JSON.stringify(g), before);
  }
  assert.throws(
    () => normalizeAutomaticGame(g),
    /inspection|inspected|Nexus|Prescience|Cunning/i,
  );
  assert.equal(JSON.stringify(g), before);
  assert.throws(
    () => applyAction(g, actor, action),
    /inspection|inspected|Nexus|Prescience|Cunning/i,
  );
  assert.equal(JSON.stringify(g), before);
}

function pendingCunning(): Game {
  const g = inspectionNative(nexusInspectionFixture());
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  nexusPlayer(g, 'f').hand.push(g.deck.splice(index, 1)[0]);
  const pending = play(g);
  assert.equal(pending.response?.kind, 'nexusPrescience');
  assert.equal(pending.battle!.nexusInspection!.stage, 'response');
  nexusInventory(pending);
  return pending;
}

void test('deleting the actual Cunning cancellation response cannot silently allow its answer', () => {
  const pending = pendingCunning();
  const corrupted = nexusReload(pending);
  corrupted.response = null;
  rejectedEverywhere(corrupted, 'h', answerAction(corrupted));

  // Explicitly passing the real response remains a valid recoverable path.
  let restored = nexusAllow(normalizeAutomaticGame(nexusReload(pending)));
  restored = applyAction(restored, 'h', answerAction(restored));
  assert.equal(restored.battle!.nexusInspection!.stage, 'answered');
  assert.deepEqual(restored.battle!.nexusInspection!.answers, [null]);
  assert.equal(restored.battle!.prescience!.value, 0);
  assert.equal(
    restored.nexusCards!.cards!.discard.filter((card) => card === 'atreides')
      .length,
    1,
  );
  nexusInventory(restored);
});

void test('Cunning cancellation response owner and intent remain bound on every seat read and continuation', () => {
  const pending = pendingCunning();
  for (const mutate of [
    (g: Game) => {
      g.response!.owner = 'f';
    },
    (g: Game) => {
      g.response!.intent = 'another-battle';
    },
  ]) {
    const corrupted = nexusReload(pending);
    mutate(corrupted);
    rejectedEverywhere(corrupted, 'h', answerAction(corrupted));
  }
});

void test('a completed Cunning inspection cannot change its first native commitment by editing the live value', () => {
  let g = nexusAllow(play(inspectionNative(nexusInspectionFixture())));
  g = applyAction(g, 'h', answerAction(g));
  assert.equal(g.battle!.nexusInspection!.first!.value, 0);
  assert.equal(g.battle!.prescience!.value, 0);
  const corrupted = nexusReload(g);
  corrupted.battle!.prescience!.value = 1;
  rejectedEverywhere(corrupted, 'h', plan(corrupted, 'h', 1));

  const restored = applyAction(
    normalizeAutomaticGame(nexusReload(g)),
    'h',
    plan(g, 'h'),
  );
  assert.equal(restored.battle!.plans.h.dial, 0);
  assert.equal(viewGame(restored, 'h').battle!.ownCommitments.length, 2);
  nexusInventory(restored);
});

void test('a sealed target plan cannot diverge from the real Secret Ally answer before the opponent seals', () => {
  let g = nexusInspectionFixture(true);
  g = applyAction(g, 'h', plan(g, 'h'));
  g = play(g, 'secretAlly', 'dial');
  assert.deepEqual(g.battle!.nexusInspection!.answers, [0]);
  assert.equal(g.battle!.revealed, false);
  assert.deepEqual(viewGame(g, 'a').battle!.plans, {});
  assert.deepEqual(viewGame(g, 'f').battle!.nexusInsights, []);
  const corrupted = nexusReload(g);
  corrupted.battle!.plans.h.dial = 1;
  rejectedEverywhere(corrupted, 'a', plan(corrupted, 'a'));

  const restored = applyAction(
    normalizeAutomaticGame(nexusReload(g)),
    'a',
    plan(g, 'a'),
  );
  assert.equal(restored.battle!.revealed, true);
  assert.equal(restored.battle!.plans.h.dial, 0);
  for (const id of ['a', 'h'])
    assert.equal(viewGame(restored, id).battle!.nexusInsights[0].value, 0);
  nexusInventory(restored);
});
