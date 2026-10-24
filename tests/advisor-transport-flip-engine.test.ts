import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorTransportFlipFixture as fixture,
  actAdvisorTransportFlip as act,
  commitAdvisorTransportFlip as commit,
  advisorTransportFlipPlayer as player,
  advisorTransportFlipInventory as inventory,
  passAdvisorTransportFlip as pass,
  finishAdvisorTransportFlip as finish,
} from './fixture-advisor-transport-flip';

function passKind(source: Game, kind: string) {
  let g = source;
  for (let i = 0; g.response?.kind === kind && i < 20; i++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id)); assert.ok(actor);
    g = act(g, actor.id, { type: 'passResponse' });
  }
  assert.notEqual(g.response?.kind, kind); return g;
}

for (const kind of ['cross', 'return'] as const) for (const canceled of [false, true]) {
  void test(`native ${kind} transport stays paid and physically committed after ${canceled ? 'preventing' : 'allowing'} advisor conversion`, () => {
    const f = fixture({ kind }), original = structuredClone(f.game);
    const committed = commit(f.game, f), pending = committed.game;
    assert.deepEqual(f.game, original);
    assert.equal(pending.response?.kind, 'advisorFlip');
    assert.equal(pending.response?.automaticAdvisorFlip?.producer, 'guildTransport');
    assert.ok(committed.price > 0);
    assert.equal(player(pending, f.guild).spice, player(original, f.guild).spice - committed.price);
    assert.equal(player(pending, f.guild).forces[f.from], undefined);
    assert.equal(player(pending, f.guild).moved, 0);
    assert.equal(player(pending, f.guild).shipped, true);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.card));
    if (kind === 'return') assert.equal(player(pending, f.guild).reserves, player(original, f.guild).reserves + 5);
    else assert.equal(player(pending, f.guild).forces[f.to], 5);
    const actor = structuredClone(player(pending, f.guild));
    const done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.card, mode: 'cancel' })
      : pass(pending);
    assert.deepEqual(player(done, f.guild), actor);
    assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    assert.equal(done.discard.filter(c => c.id === f.card).length, canceled ? 1 : 0);
    assert.deepEqual(inventory(done), f.originalInventory);
    const continued = finish(normalizeAutomaticGame(done));
    assert.ok(continued.phase >= 6);
    assert.equal(isAdvisor(player(continued, f.bg), f.territory), canceled);
    assert.deepEqual(inventory(continued), f.originalInventory);
  });
}

void test('a completed cross transport retains an actual legal ordinary ground move after prevention', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  const done = act(pending, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  const price = player(done, f.guild).spice;
  const moved = act(done, f.guild, { type: 'move', from: f.to,
    territory: 'arrakeen', sector: 10, amount: 1 });
  assert.equal(player(moved, f.guild).moved, 1);
  assert.equal(player(moved, f.guild).spice, price);
  assert.equal(player(moved, f.guild).forces['arrakeen:10'], 1);
  assert.equal(moved.discard.filter(c => c.id === f.card).length, 1);
  assert.equal(isAdvisor(player(moved, f.bg), f.territory), true);
});

void test('preventing original transport permission never creates a physical conversion occurrence', () => {
  const f = fixture(), permission = act(f.game, f.guild, f.action);
  assert.equal(permission.response?.kind, 'guildTransportPermission');
  const done = act(permission, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  assert.equal(player(done, f.guild).forces[f.from], 5);
  assert.equal(player(done, f.guild).spice, player(f.game, f.guild).spice);
  assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
  assert.equal(player(done, f.bg).advisors?.[f.territory]?.aloneFlipHold, undefined);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
});

void test('a prevented rate still settles the original physical transport before an unopposed automatic conversion', () => {
  const f = fixture({ kind: 'return' }), permission = act(f.game, f.guild, f.action);
  const rate = passKind(permission, 'guildTransportPermission');
  assert.equal(rate.response?.kind, 'guildRate');
  const done = act(rate, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  assert.equal(player(done, f.guild).forces[f.from], undefined);
  assert.equal(player(done, f.guild).reserves, player(f.game, f.guild).reserves + 5);
  assert.ok(player(done, f.guild).spice < player(f.game, f.guild).spice);
  assert.equal(player(done, f.guild).moved, 0);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), false);
  assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
  assert.equal(done.response, null);
  assert.deepEqual(inventory(done), f.originalInventory);
});

void test('an unaffordable canceled cross tariff leaves the original army and advisor occurrence untouched', () => {
  const f = fixture(), permission = act(f.game, f.guild, f.action);
  const rate = passKind(permission, 'guildTransportPermission');
  assert.equal(rate.response?.kind, 'guildRate');
  const done = act(rate, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  assert.equal(player(done, f.guild).forces[f.from], 5);
  assert.equal(player(done, f.guild).forces[f.to], undefined);
  assert.equal(player(done, f.guild).spice, player(f.game, f.guild).spice);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
  assert.equal(player(done, f.bg).advisors?.[f.territory]?.aloneFlipHold, undefined);
  assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
  assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
  assert.deepEqual(inventory(done), f.originalInventory);
});

void test('a changed committed transport parent rejects before discarding the prevention card', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  pending.pendingAutomaticAdvisorTransport = { ...pending.pendingAutomaticAdvisorTransport!, amount: 4 };
  const before = structuredClone(pending);
  assert.throws(() => applyAction(pending, f.holder, { type: 'card', card: f.card, mode: 'cancel' }));
  assert.deepEqual(pending, before);
  assert.ok(player(pending, f.holder).hand.some(c => c.id === f.card));
});

for (const canceled of [false, true]) {
  void test(`transport arrival resumes its actual Intrusion once after ${canceled ? 'prevented' : 'allowed'} origin conversion`, () => {
    const f = fixture({ intrusion: true }), pending = commit(f.game, f).game;
    const paid = player(pending, f.guild).spice;
    assert.equal(pending.decision, null);
    assert.equal(pending.response?.automaticAdvisorFlip?.producer, 'guildTransport');
    const arrival = canceled
      ? act(pending, f.holder, { type: 'card', card: f.card, mode: 'cancel' })
      : pass(pending);
    assert.equal(arrival.pendingAutomaticAdvisorTransport, undefined);
    assert.equal(arrival.decision?.kind, 'intrusion');
    assert.equal(arrival.decision?.kind === 'intrusion' && arrival.decision.territory, 'imperial_basin');
    assert.equal(player(arrival, f.guild).forces[f.to], 5);
    assert.equal(player(arrival, f.guild).spice, paid);
    assert.equal(player(arrival, f.guild).moved, 0);
    let done = pass(act(arrival, f.bg, { type: 'decision', accept: true }));
    assert.equal(isAdvisor(player(done, f.bg), 'imperial_basin'), true);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    for (let read = 0; read < 3; read++) {
      done = normalizeAutomaticGame(done);
      assert.equal(done.decision, null);
      assert.equal(done.response, null);
      assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
    }
    assert.deepEqual(inventory(done), f.originalInventory);
    assert.ok(finish(done).phase >= 6);
  });
}

void test('four existing profiles resolve both committed transport conversions legally', () => {
  for (const kind of ['cross', 'return'] as const) for (const profile of DIFFICULTIES) {
    const f = fixture({ kind }), pending = commit(f.game, f).game;
    const own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const action = botActions(own)[0]; assert.ok(action);
    const done = pass(act(pending, f.holder, action));
    assert.equal(done.pendingAutomaticAdvisorTransport, undefined);
    assert.equal(player(done, f.guild).moved, 0);
    assert.equal(player(done, f.guild).shipped, true);
    assert.deepEqual(inventory(done), f.originalInventory);
    assert.ok(finish(done).phase >= 6);
  }
});
