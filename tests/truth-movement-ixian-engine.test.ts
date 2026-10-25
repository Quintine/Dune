import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { createTruthMovementIxianFixture as fixture, actTruthMovementIxian as act,
  advanceTruthMovementIxian as advance, truthMovementIxianClean as clean,
  truthMovementIxianPlayer as player, truthMovementIxianInventory as inventory,
  askTruthMovementIxian as ask } from './fixture-truth-movement-ixian';

for (const cancel of [false, true]) void test(`native Advanced Ixian typed promise ${cancel ? 'retains its unused move after prevention' : 'fulfills only after its original range counter'}`, () => {
  const f = fixture();
  let g = ask(f.game, f.asker, f.truthtrance, f.target, 2, f.twoStepDestination);
  assert.ok(viewGame(g, f.target).truthMovementAnswers!.includes('yes'));
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const before = structuredClone(player(g));
  g = act(g, f.target, f.matchingMove);
  assert.equal(g.response?.kind, 'ixMovement');
  assert.deepEqual(player(g).forces, before.forces);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  if (cancel) {
    g = act(g, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.equal(player(g).moved, 0); assert.deepEqual(player(g).forces, before.forces);
    assert.ok(!g.movementPromises![0].fulfilled);
    const replacement = viewGame(g, f.target).movementPromisePolicy?.[0];
    if (replacement?.type === 'move') {
      g = advance(act(g, f.target, replacement), clean);
      assert.equal(g.movementPromises![0].fulfilled, true);
    } else assert.equal(g.movementPromises![0].released, true);
  } else {
    g = advance(g, clean); assert.equal(g.movementPromises![0].fulfilled, true);
    const key = `${f.destination.territory}:${f.destination.sector}`;
    assert.equal(player(g).forces[key], 2); assert.equal(player(g).elites!.forces[key], 2);
  }
  assert.deepEqual(inventory(g), f.originalCards);
});
