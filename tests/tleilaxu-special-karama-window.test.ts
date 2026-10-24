import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, executeSpecialKaramaIntent, prepareSpecialKaramaIntent, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createTleilaxuSpecialKaramaFixture as fixture,
  actTleilaxuSpecialKarama as act,
  tleilaxuSpecialKaramaPlayer as player,
  tleilaxuSpecialKaramaInventory as inventory,
  reviveTleilaxuSpecialKarama as revive,
  finishTleilaxuSpecialKarama as finish,
  passTleilaxuSpecialKarama as pass,
} from './fixture-tleilaxu-special-karama';

function rejected(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('native quiet Revival permits any player before a request and spends the original card exactly once', () => {
  const f = fixture(), before = structuredClone(f.game);
  const quote = viewGame(f.game, f.owner).tleilaxuSpecialKarama;
  assert.ok(!f.game.pendingRevival);
  assert.equal(quote?.blocked, null);
  assert.equal(quote?.pending, false);
  assert.deepEqual(quote?.cards, [f.karama]);
  assert.deepEqual(quote?.targets, f.game.players.map(p => ({ player: p.id, blocked: null })));
  for (const actor of [f.target, f.observer]) assert.equal(viewGame(f.game, actor).tleilaxuSpecialKarama, null);
  const stopped = act(f.game, f.owner, f.special);
  assert.deepEqual(f.game, before);
  assert.equal(player(stopped, f.owner).specialKaramaUsed, true);
  assert.equal(player(stopped, f.owner).hand.some(c => c.id === f.karama), false);
  assert.equal(stopped.discard.filter(c => c.id === f.karama).length, 1);
  assert.deepEqual(stopped.revivalPrevention, { player: f.target, turn: stopped.turn });
  assert.deepEqual(player(stopped, f.target), player(before, f.target));
  assert.deepEqual(stopped.ready, before.ready);
  assert.equal(stopped.decision, null);
  assert.equal(stopped.pendingRevival, null);
  assert.deepEqual(inventory(stopped), f.inventory);
  rejected(stopped, f.target, f.ordinaryRevival, /prevented/);
  rejected(stopped, f.target, f.gholaAction, /prevented.*Ghola/);
  rejected(stopped, f.owner, f.special, /already been used/);
  assert.equal(viewGame(stopped, f.target).ghola?.available, false);
});

void test('ready, self and empty-Tanks targets do not narrow quiet declaration permission', () => {
  const f = fixture();
  const ready = act(f.game, f.observer, { type: 'ready' });
  for (const target of [f.owner, f.observer]) {
    assert.equal(player(ready, target).tanks, 0);
    const chosen = act(ready, f.owner, { ...f.special, target });
    assert.equal(chosen.revivalPrevention?.player, target);
    assert.deepEqual(chosen.ready, ready.ready);
    assert.equal(player(chosen, target).tanks, 0);
  }
});

void test('completed paid and free returns retain their quota, pieces and native Tleilaxu income', () => {
  const f = fixture();
  const completed = revive(f.game, f, 3).game;
  assert.equal(player(completed, f.target).tanks, 9);
  assert.equal(player(completed, f.target).revived, 3);
  assert.ok(player(completed, f.target).spice < player(f.game, f.target).spice);
  assert.ok(player(completed, f.owner).spice > player(f.game, f.owner).spice);
  const target = structuredClone(player(completed, f.target));
  const income = player(completed, f.owner).spice;
  const stopped = act(completed, f.owner, f.special);
  assert.deepEqual(player(stopped, f.target), target);
  assert.equal(player(stopped, f.owner).spice, income);
  assert.equal(viewGame(stopped, f.target).revival.prevented, true);
  rejected(stopped, f.target, f.ordinaryRevival);
  rejected(stopped, f.target, f.gholaAction, /prevented.*Ghola/);
  assert.deepEqual(inventory(stopped), f.inventory);
});

void test('the pending normal request remains target-bound and can be declined before a later quiet use', () => {
  const f = fixture();
  const pending = revive(f.game, f).requested;
  const quote = viewGame(pending, f.owner).tleilaxuSpecialKarama;
  assert.equal(quote?.pending, true);
  assert.deepEqual(quote?.targets.map(t => t.player), [f.target]);
  rejected(pending, f.owner, { ...f.special, target: f.observer }, /currently reviving/);
  const stopped = act(pending, f.owner, { type: 'card', card: f.karama, mode: 'special' });
  assert.deepEqual(player(stopped, f.target), player(f.game, f.target));
  assert.equal(stopped.pendingRevival, null);
  const declined = pass(act(pending, f.owner, { type: 'decision', decline: true }));
  assert.equal(player(declined, f.target).tanks, 11);
  assert.equal(viewGame(declined, f.owner).tleilaxuSpecialKarama?.blocked, null);
  assert.equal(act(declined, f.owner, f.special).revivalPrevention?.player, f.target);
});

void test('quiet intent cannot spend after a new pending declaration replaces its source', () => {
  const f = fixture();
  const quiet = prepareSpecialKaramaIntent(f.game, f.owner, f.special);
  assert.equal(quiet.kind, 'tleilaxu');
  assert.equal(quiet.kind === 'tleilaxu' && quiet.revival, null);
  const pending = revive(f.game, f).requested;
  const before = structuredClone(pending);
  assert.throws(() => executeSpecialKaramaIntent(pending, quiet), /original revival declaration/);
  assert.deepEqual(pending, before);
  const intent = prepareSpecialKaramaIntent(pending, f.owner, f.special);
  assert.ok(intent.kind === 'tleilaxu' && intent.revival);
  const disposable = structuredClone(pending);
  executeSpecialKaramaIntent(disposable, intent);
  assert.equal(disposable.revivalPrevention?.player, f.target);
});

void test('the real end of Revival expires prevention and permits five original Ghola counters without normal quota', () => {
  const f = fixture({ priorRevival: true });
  const stopped = act(f.game, f.owner, f.special);
  rejected(stopped, f.target, f.gholaAction, /prevented.*Ghola/);
  const shipment = finish(stopped);
  assert.equal(shipment.phase, 5);
  assert.equal(viewGame(shipment, f.owner).tleilaxuSpecialKarama, null);
  const prior = structuredClone(player(shipment, f.target));
  const returned = pass(act(shipment, f.target, f.gholaAction));
  assert.equal(player(returned, f.target).tanks, prior.tanks - 5);
  assert.equal(player(returned, f.target).reserves, prior.reserves + 5);
  assert.equal(player(returned, f.target).spice, prior.spice);
  assert.equal(player(returned, f.target).revived, prior.revived);
  assert.equal(returned.discard.filter(c => c.id === f.ghola).length, 1);
  assert.deepEqual(inventory(returned), f.inventory);
});

void test('four existing profiles propose legal quiet prevention without a new strategic policy', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const source = structuredClone(f.game);
    player(source, f.owner).bot = difficulty;
    const action = botActions(viewGame(source, f.owner))[0];
    assert.deepEqual(action, f.special);
    const stopped = act(source, f.owner, action);
    rejected(stopped, f.target, f.ordinaryRevival, /prevented/);
    assert.equal(finish(stopped).phase, 5);
    assert.deepEqual(inventory(stopped), f.inventory);
  }
});
