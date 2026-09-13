import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { spiceBankerGame } from './spice-banker-fixture';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validateLeaderSkills } from '../game/leader-skills';

function reject(g: Game, owner: string, action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.equal(JSON.stringify(g), before);
}
function conserve(g: Game) {
  validateLeaderSkills(g.leaderSkills!, g.players);
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
  }
}
const plan = (g: Game, bankerSpice?: unknown): Action => ({
  type: 'battlePlan',
  leader: 'emperor-0',
  dial: 0,
  bankerSpice,
  weapon: g.players[0].hand[0].id,
});
function settle(
  g: Game,
  opponent: Action = { type: 'battlePlan', leader: 'guild-1', dial: 5 },
  calls: [boolean, boolean] = [false, false],
) {
  g = applyAction(g, 'd', opponent);
  g = applyAction(g, 'a', { type: 'traitorCall', call: calls[0] });
  return applyAction(g, 'd', { type: 'traitorCall', call: calls[1] });
}
function traitor(g: Game, owner: number, identity: string) {
  const p = g.players[owner];
  if (p.traitors.includes(identity)) return;
  const zone = [g.traitorReserve!, ...g.players.map((p) => p.traitors)].find(
    (zone) => zone.includes(identity),
  )!;
  assert.ok(zone);
  const old = p.traitors[0];
  zone[zone.indexOf(identity)] = old;
  p.traitors[0] = identity;
}
void test('Spice Banker spends one through three on win or loss and changes score without changing printed disc values', () => {
  for (const amount of [1, 2, 3]) {
    const before = spiceBankerGame();
    const done = settle(applyAction(before, 'a', plan(before, amount)));
    assert.equal(done.players[0].spice, 20 - amount);
    assert.equal(done.lastBattleContext?.winner, amount === 1 ? 'd' : 'a');
    assert.equal(
      done.players[0].leaders[0].strength,
      before.players[0].leaders[0].strength,
    );
    assert.ok(
      done.log.some((l) => l.text.includes(`gained ${amount} battle strength`)),
    );
    conserve(done);
  }
});
void test('Banker own spice and Advanced force support cannot spend the same funds', () => {
  const g = spiceBankerGame(true);
  g.players[0].spice = 5;
  reject(g, 'a', { ...plan(g, 3), support: 3, dial: 3 });
  const sealed = applyAction(g, 'a', { ...plan(g, 3), support: 2, dial: 2 });
  assert.equal(sealed.players[0].spice, 5);
  const done = settle(sealed, {
    type: 'battlePlan',
    leader: 'guild-1',
    dial: 0,
  });
  assert.equal(done.players[0].spice, 0);
  conserve(done);
});
void test('killed Bankers lose the bonus and still pay, while a sole successful traitor caller pays nothing', () => {
  const g = spiceBankerGame();
  const index = g.deck.findIndex((c) => c.kind === 'projectile');
  const weapon = g.deck.splice(index, 1)[0];
  g.players[1].hand.push(weapon);
  const dead = settle(applyAction(g, 'a', plan(g, 3)), {
    type: 'battlePlan',
    leader: 'guild-1',
    dial: 0,
    weapon: weapon.id,
  });
  assert.equal(dead.players[0].leaders[0].dead, true);
  assert.equal(dead.players[0].spice, 17);
  assert.ok(!dead.log.some((l) => l.text.includes('gained 3 battle strength')));
  conserve(dead);
  for (const calls of [
    [true, false],
    [false, true],
    [true, true],
  ] as [boolean, boolean][]) {
    const g = spiceBankerGame();
    traitor(g, 0, 'guild-1');
    traitor(g, 1, 'emperor-0');
    const done = settle(
      applyAction(g, 'a', plan(g, 3)),
      { type: 'battlePlan', leader: 'guild-1', dial: 0 },
      calls,
    );
    assert.equal(done.players[0].spice, calls[0] && !calls[1] ? 23 : 17);
    assert.equal(done.players[0].leaders[0].dead, calls[1]);
    conserve(done);
  }
});
void test('sealed Banker commitments stay private and reject changed funds, quantities or leader custody', () => {
  const g = spiceBankerGame();
  g.players[0].spice = 3;
  const sealed = applyAction(g, 'a', plan(g, 3));
  assert.equal(viewGame(sealed, 'a').battle?.plans.a?.bankerSpice, 3);
  assert.ok(!JSON.stringify(viewGame(sealed, 'd')).includes('bankerSpice'));
  assert.deepEqual(
    normalizeAutomaticGame(JSON.parse(JSON.stringify(sealed))),
    sealed,
  );
  for (const corrupt of [
    (g: Game) => {
      g.discoveryEnabled = true;
    },
    (g: Game) => {
      g.battle!.plans.a.bankerSpice = 4;
    },
    (g: Game) => {
      g.players[0].spice = 2;
    },
    (g: Game) => {
      g.battle!.plans.a.leader = 'emperor-1';
    },
  ]) {
    const bad = structuredClone(sealed);
    corrupt(bad);
    assert.throws(() => viewGame(bad, 'a'));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad, 'd', { type: 'battlePlan', leader: 'guild-1', dial: 0 });
  }
  for (const value of [-1, 4, 1.5, '3', true, null])
    reject(g, 'a', plan(g, value));
  reject(g, 'a', { ...plan(g, 1), leader: 'emperor-1' });
});
void test('captured Bankers spend captor funds, and legacy omitted commitments preserve ordinary plans', () => {
  const g = spiceBankerGame(false, true);
  const done = settle(
    applyAction(g, 'a', { ...plan(g, 3), leader: 'guild-0' }),
    { type: 'battlePlan', leader: 'guild-1', dial: 0 },
  );
  assert.equal(done.players[0].spice, 17);
  assert.equal(done.players[1].spice, 20);
  assert.equal(done.players[1].leaders[0].capturedBy, undefined);
  conserve(done);
  const legacy = spiceBankerGame();
  const old = applyAction(legacy, 'a', plan(legacy));
  assert.equal(old.battle!.plans.a.bankerSpice, undefined);
  const resumed = settle(JSON.parse(JSON.stringify(old)));
  assert.equal(resumed.players[0].spice, 20);
  assert.ok(
    !resumed.log.some((l) => l.automatic?.name === 'Spice Banker payment'),
  );
  conserve(resumed);
});
void test('all four AI profiles have funded Banker battle plans using their private view', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = spiceBankerGame();
    g.players[0].spice = 2;
    const view = viewGame(g, 'a');
    view.players[0].bot = difficulty;
    const actions = botActions(view).filter(
      (a) => a.type === 'battlePlan' && Number(a.bankerSpice) > 0,
    );
    assert.ok(actions.length, difficulty);
    for (const action of actions) {
      assert.ok(Number(action.bankerSpice) <= 2);
      const next = applyAction(g, 'a', action);
      assert.equal(next.players[0].spice, 2);
      conserve(next);
    }
  }
});
