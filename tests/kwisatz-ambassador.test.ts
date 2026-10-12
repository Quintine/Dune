import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { createKwisatzAmbassadorFixture } from './fixture-kwisatz-ambassador';

for (const copied of [false, true]) void test(
  `${copied ? 'copied Bene Gesserit' : 'native Tleilaxu'} Ambassador revives the original first-death KH without consuming ordinary leaders or its entrant`, () => {
    const f = createKwisatzAmbassadorFixture(copied);
    const before = f.game.players.find(p => p.id === f.beneficiary)!;
    assert.equal(f.afterLosses.players.find(p => p.id === f.beneficiary)!.battleLosses, 7);
    assert.equal(before.battleLosses, 10);
    assert.ok(before.leaders.every(leader => !leader.dead));
    assert.equal(before.kwisatz!.dead, true);
    const offer = viewGame(f.game, f.beneficiary).ambassadorEntry!.revival!;
    const kh = offer.leaders.find(leader => leader.id === 'kwisatz');
    assert.ok(kh, 'The separate KH identity is a source-supported own-leader choice');
    for (const p of f.game.players) if (p.id !== f.beneficiary)
      assert.equal(viewGame(f.game, p.id).ambassadorEntry!.revival, null);
    const event = f.game.pendingAmbassador!.event;
    const action = { type: 'decision', event, leader: kh.id };
    assert.throws(() => applyAction(f.game, f.owner, action));
    assert.throws(() => applyAction(f.game, f.beneficiary, { ...action, event: `${event}:stale` }));
    assert.throws(() => applyAction(f.game, f.beneficiary, { ...action, forces: 1 }));
    const done = applyAction(f.game, f.beneficiary, action);
    const after = done.players.find(p => p.id === f.beneficiary)!;
    assert.equal(after.kwisatz!.dead, false);
    assert.equal(after.kwisatz!.revivalCycle, 2, 'The original return advances KH history rather than resetting it');
    assert.equal(after.battleLosses, before.battleLosses);
    assert.equal(after.leaderRevived, before.leaderRevived);
    assert.deepEqual(after.leaders, before.leaders, 'KH is not an ordinary native roster disc');
    assert.equal(after.spice, before.spice);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.tanks, before.tanks);
    assert.equal(done.active, f.entrant);
    assert.equal(done.players.find(p => p.id === f.entrant)!.shipped, true);
    assert.equal(done.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, copied ? 'removed' : 'used');
    assert.throws(() => applyAction(done, f.beneficiary, action));
    const suffix = applyAction(done, f.entrant, { type: 'endMovement' });
    assert.ok(!suffix.movementRemaining!.includes(f.entrant));
    assert.equal(suffix.players.find(p => p.id === f.beneficiary)!.kwisatz!.dead, false);
    assert.throws(() => applyAction(suffix, f.entrant, { type: 'endMovement' }));
  },
);

void test('a prior KH return marker preserves the unresolved repeat-death boundary', () => {
  const f = createKwisatzAmbassadorFixture();
  const repeated = structuredClone(f.game);
  repeated.players.find(p => p.id === f.beneficiary)!.kwisatz!.revivalCycle = 2;
  const offer = viewGame(repeated, f.beneficiary).ambassadorEntry!.revival!;
  assert.equal(offer.leaders.some(leader => leader.id === 'kwisatz'), false);
  assert.throws(() => applyAction(repeated, f.beneficiary,
    { type: 'decision', event: repeated.pendingAmbassador!.event, leader: 'kwisatz' }));
  assert.equal(repeated.players.find(p => p.id === f.beneficiary)!.kwisatz!.dead, true);
  assert.equal(repeated.players.find(p => p.id === f.beneficiary)!.kwisatz!.revivalCycle, 2);
});

void test('a living KH never becomes a free duplicate identity', () => {
  const f = createKwisatzAmbassadorFixture(), alive = structuredClone(f.game);
  alive.players.find(p => p.id === f.beneficiary)!.kwisatz!.dead = false;
  assert.equal(viewGame(alive, f.beneficiary).ambassadorEntry!.revival!.leaders.some(l => l.id === 'kwisatz'), false);
  assert.throws(() => applyAction(alive, f.beneficiary,
    { type: 'decision', event: alive.pendingAmbassador!.event, leader: 'kwisatz' }));
});

for (const copied of [false, true]) void test(
  `all minimal legal bot profiles return the available ${copied ? 'copied' : 'native'} KH alternative`, () => {
    const f = createKwisatzAmbassadorFixture(copied);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(f.game, f.beneficiary);
      view.players.find(p => p.id === f.beneficiary)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action);
      const done = applyAction(f.game, f.beneficiary, action);
      assert.equal(done.players.find(p => p.id === f.beneficiary)!.kwisatz!.dead, false);
      assert.equal(done.players.find(p => p.id === f.beneficiary)!.leaderRevived,
        f.game.players.find(p => p.id === f.beneficiary)!.leaderRevived);
      assert.equal(done.active, f.entrant);
    }
  },
);
