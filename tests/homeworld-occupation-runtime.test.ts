import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { occupiedIncomeMovementFixture } from './fixture-homeworld-occupied-income';

function collectionDecision(initial: Game): Game {
  let game = initial;
  for (let n = 0; game.decision?.kind !== 'homeworldOccupiedIncome' && n < 100; n++) {
    if (game.phase === 5 && !game.decision && !game.response && !game.phaseOpening) {
      assert.ok(game.active);
      game = applyAction(game, game.active, { type: 'endMovement' });
      continue;
    }
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = applyAction(game, player.id, action); break; }
    }
    assert.ok(next, 'Original phase/response actions must reach the bank choice.');
    game = next;
  }
  assert.equal(game.phase, 7);
  assert.equal(game.decision?.kind, 'homeworldOccupiedIncome');
  return game;
}

void test('original Movement-to-Collection dispatch preserves a JSON partial bank split and one real Giedi bonus', () => {
  const fixture = occupiedIncomeMovementFixture('caladan', false, true);
  const before = Object.fromEntries(fixture.game.players.map(p => [p.id, p.spice]));
  let game = collectionDecision(fixture.game);
  const offer = viewGame(game, 'owner').homeworldOccupiedIncome!;
  const action = { type: 'decision', event: offer.event, world: offer.world, ownAmount: 1 };
  const waiting = structuredClone(game);
  for (const rejected of [
    { actor: 'ally', action },
    { actor: 'owner', action: { ...action, event: `${offer.event}-stale` } },
    { actor: 'owner', action: { ...action, ownAmount: 3 } },
  ]) {
    assert.throws(() => applyAction(game, rejected.actor, rejected.action));
    assert.deepEqual(game, waiting);
  }
  game = applyAction(JSON.parse(JSON.stringify(game)) as Game, 'owner', action);
  assert.equal(game.players.find(p => p.id === 'owner')!.spice - before.owner, 1);
  assert.equal(game.players.find(p => p.id === 'ally')!.spice - before.ally, 3);
  assert.equal(game.giediCollection!.qualifying, 1);
  assert.equal(game.giediCollection!.awarded, true);
  assert.equal(game.pendingHomeworldOccupiedIncome, null);
  assert.equal(game.decision, null);
  const settled = structuredClone(game);
  assert.throws(() => applyAction(game, 'owner', action));
  assert.deepEqual(game, settled, 'A replay cannot credit either wallet or Giedi again.');
});
