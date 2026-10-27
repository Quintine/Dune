import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, executeSpecialKaramaIntent, viewGame,
  type Action, type Game, type SpecialKaramaIntent,
} from '../game/engine';
import { quoteRevivalResume } from '../game/revival-resume';
import {
  holdRevivalCard, homeworldRevivalFixture, revivalInventory, revivalPlayer,
} from './fixture-homeworld-revival';
import { reachAdvancedRevivalOrderActor } from './fixture-advanced-revival-order';

const p = (game: Game) => revivalPlayer(game, 'e');
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Original Advanced Homeworld setup and native ordered phase progression.
 * This controlled supplement stages four Imperial stars and two normal forces
 * in Tanks, leaving Salusa at one, and transfers an actual Karama from the
 * deck. Its later revivalStop is a real accepted action, not installed. */
function source() {
  let game = homeworldRevivalFixture({ advanced: true, tleilaxu: true });
  const owner = p(game);
  assert.equal(owner.reserves, 20);
  assert.equal(owner.elites!.reserves, 5);
  owner.reserves -= 6; owner.tanks += 6;
  owner.elites!.reserves -= 4; owner.elites!.tanks += 4;
  game.homeworlds!.custody!.salusa!.elite = 1;
  const card = holdRevivalCard(game, 'e', 'karama');
  revivalInventory(game);
  game = reachAdvancedRevivalOrderActor(game, 'e');
  assert.equal(game.phase, 4);
  assert.ok(!game.decision && !game.response && !game.phaseOpening);
  assert.ok(viewGame(game, 'e').revival.sardaukarFreeBlock);
  return { game, card };
}

function request(game: Game) {
  const pending = applyAction(game, 'e', { type: 'revive', amount: 1, elite: 1 });
  assert.equal(pending.decision?.kind, 'revivalStop');
  assert.equal(pending.decision?.player, 't');
  assert.ok(pending.pendingRevival);
  return pending;
}
function allow(state: Game) {
  let game = applyAction(reload(state), 't', { type: 'decision', decline: true });
  for (let n = 0; game.response && n < 20; n++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id));
    assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response ?? null, null);
  assert.equal(game.pendingRevival ?? null, null);
  revivalInventory(game);
  return game;
}

void test('unstamped pre-policy pending free-star quote resumes its original accepted terms once', () => {
  const { game } = source();
  const accepted = request(game);
  // Controlled historical receipt: represent an already accepted old-policy
  // free star by changing only the frozen quote on the real pending stop.
  // This is not presented as a naturally captured pre-upgrade room.
  const legacy = reload(accepted), receipt = legacy.pendingRevival!;
  delete receipt.salusaFreePolicy;
  receipt.free = 1; receipt.cost = 0; receipt.normalCost = 0;
  assert.equal(receipt.player, 'e');
  assert.equal(receipt.kind, 'forces');
  assert.equal(receipt.amount, 1);
  assert.equal(receipt.elite, 1);
  const before = structuredClone(legacy), quote = quoteRevivalResume(legacy, 'finish');
  assert.equal(quote.outcome, 'revive');
  assert.deepEqual(quote.pending, receipt);
  assert.deepEqual(legacy, before);
  const settled = allow(legacy);
  assert.equal(p(settled).spice, p(legacy).spice);
  assert.equal(p(settled).tanks, p(legacy).tanks - 1);
  assert.equal(p(settled).elites!.tanks, p(legacy).elites!.tanks - 1);
  assert.equal(p(settled).elites!.revived, 1);
  assert.equal(p(settled).revived, 1);
  assert.equal(p(settled).freeForcesRevived, 1);
  assert.equal(settled.homeworlds!.custody!.salusa!.elite, 2);
  reject(settled, 't', { type: 'decision', decline: true });
});

void test('new stamped Low pending quote settles the paid star, preserving the free allowance', () => {
  const { game } = source();
  const accepted = request(game), receipt = accepted.pendingRevival!;
  assert.equal(receipt.salusaFreePolicy, 1);
  assert.equal(receipt.free, 0);
  assert.equal(receipt.normalCost, 2);
  assert.equal(receipt.cost, 2);
  const restored = reload(accepted), before = structuredClone(restored);
  const quote = quoteRevivalResume(restored, 'finish');
  assert.equal(quote.outcome, 'revive');
  assert.deepEqual(quote.pending, receipt);
  assert.deepEqual(restored, before);
  const settled = allow(restored);
  assert.equal(p(settled).spice, p(restored).spice - 2);
  assert.equal(p(settled).tanks, p(restored).tanks - 1);
  assert.equal(p(settled).elites!.tanks, p(restored).elites!.tanks - 1);
  assert.equal(p(settled).elites!.revived, 1);
  assert.equal(p(settled).revived, 1);
  assert.equal(p(settled).freeForcesRevived, 0);
  assert.equal(settled.homeworlds!.custody!.salusa!.elite, 2);
  assert.equal(viewGame(settled, 'e').revival.freeRemaining, 1);
  reject(settled, 't', { type: 'decision', decline: true });
});

void test('only an internal pre-policy special intent can finish its already accepted Low star selection', () => {
  const { game, card } = source();
  const action: Action = { type: 'card', mode: 'special', card, amount: 1, elite: 1 };
  reject(game, 'e', action);
  reject(game, 'e', { ...action, legacySalusaIntent: true });
  reject(game, 'e', { ...action, salusaFreePolicy: undefined });
  // The old normalized record simulates an already accepted internal Kull
  // intent. It is not constructed from a player action and does not claim an
  // actual Kull/Homeworld production path or captured persisted transaction.
  const legacy: SpecialKaramaIntent = { kind: 'emperorForces', owner: 'e', card,
    turn: game.turn, phase: game.phase, amount: 1, elite: 1 };
  const resumed = reload(game), original = structuredClone(resumed);
  executeSpecialKaramaIntent(resumed, legacy);
  assert.equal(p(resumed).tanks, p(original).tanks - 1);
  assert.equal(p(resumed).elites!.tanks, p(original).elites!.tanks - 1);
  assert.equal(p(resumed).elites!.revived, p(original).elites!.revived);
  assert.equal(p(resumed).spice, p(original).spice);
  assert.equal(p(resumed).specialKaramaUsed, true);
  assert.equal(resumed.discard.filter(held => held.id === card).length, 1);
  assert.equal(resumed.homeworlds!.custody!.salusa!.elite, 2);
  revivalInventory(resumed);
});
