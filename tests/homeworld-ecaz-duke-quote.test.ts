import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlayer } from '../game/engine';
import { acquireDuke, captureDuke, consumeDuke, createDukeVidal } from '../game/duke-vidal';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { createHomeworldOccupationHistory, observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import {
  HOMEWORLD_ECAZ_DUKE_SOURCE, HomeworldEcazDukeError,
  quoteHomeworldEcazDuke as quote, createHomeworldEcazDukeReceipt as receipt,
  quoteHomeworldEcazDukeLifecycle as lifecycle, validateHomeworldEcazDukeGrants,
  type HomeworldEcazDukeContext as Context,
} from '../game/homeworld-ecaz-duke';

const player = (g: Context, id: string) => { const p = g.players.find(p => p.id === id); assert.ok(p); return p; };
function observe(g: Context, event: string, cause: 'change' | 'turnStart' = 'change') {
  g.homeworldOccupationHistory = observeHomeworldOccupation(g.homeworldOccupationHistory!, homeworldContext(g),
    g.homeworlds!.custody!, g.turn, cause, event);
}
/** Controlled pure-rule inputs, not a claim of native gameplay chronology.
 * Native20 pools, conserved casualties/visitor1 and the canonical observer
 * produce actual valid qualification history; no engine receipt is installed. */
function position(advanced = true, allied = false): Context {
  const players = ['ecaz', 'guild', 'atreides', 'moritani'].map(faction => {
    const id = faction as 'ecaz' | 'guild' | 'atreides' | 'moritani';
    return newPlayer(id, id, id);
  });
  const context = homeworldContext({ advanced, players });
  const custody = createHomeworldCustody(context);
  const g: Context = { status: 'playing', advanced, turn: 1, players,
    homeworlds: { custody, historyVersion: 1 }, homeworldOccupationPreview: true,
    homeworldOccupationHistory: createHomeworldOccupationHistory(context, custody, 1, 'controlled-native-pools'),
    dukeVidal: createDukeVidal() };
  player(g, 'ecaz').tanks += player(g, 'ecaz').reserves; player(g, 'ecaz').reserves = 0;
  player(g, 'guild').reserves--;
  custody.visitors['homeworld:ecaz'] = { guild: { normal: 1, elite: 0 } };
  observe(g, 'controlled-ecaz-sole-guild');
  if (allied) { player(g, 'guild').ally = 'atreides'; player(g, 'atreides').ally = 'guild'; }
  return g;
}
function grant(g: Context, recipient = 'guild') {
  const offered = quote(g); assert.equal(offered.blocked, null); assert.ok(offered.owner && offered.event);
  const earned = receipt(g, offered.owner, offered.event, recipient);
  (g.homeworldEcazDukeGrants ??= []).push(earned);
  g.dukeVidal = acquireDuke(g.dukeVidal!, recipient, g.turn, HOMEWORLD_ECAZ_DUKE_SOURCE);
  return earned;
}
function depart(g: Context, id = 'guild', event = 'controlled-occupier-departure') {
  const group = g.homeworlds!.custody!.visitors['homeworld:ecaz'][id];
  player(g, id).reserves += group.normal + group.elite;
  delete g.homeworlds!.custody!.visitors['homeworld:ecaz'][id];
  observe(g, event);
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} occupied Ecaz quotes the real sole occupier without acquiring or inventing a grant`, () => {
    const g = position(advanced), before = structuredClone(g), offered = quote(g);
    assert.equal(offered.owner, 'guild'); assert.deepEqual(offered.recipients, ['guild']);
    assert.equal(offered.qualification, 'controlled-ecaz-sole-guild');
    assert.equal(offered.event, JSON.stringify(['homeworldEcazDuke', 1, 'controlled-ecaz-sole-guild', 'guild']));
    assert.equal(offered.nativeAcquisitionBlocked, true); assert.equal(offered.claimed, null); assert.equal(offered.blocked, null);
    assert.deepEqual(receipt(g, 'guild', offered.event!, 'guild'), {
      turn: 1, qualification: offered.qualification, occupier: 'guild', recipient: 'guild',
    });
    assert.deepEqual(g, before); assert.equal(Object.hasOwn(g, 'homeworldEcazDukeGrants'), false);
    const old = structuredClone(g); delete old.homeworldOccupationPreview;
    assert.equal(quote(old).owner, null); assert.equal(quote(old).nativeAcquisitionBlocked, false);
    assert.equal(Object.hasOwn(old, 'homeworldEcazDukeGrants'), false);
  });

  void test(`${band} occupied Ecaz recipient choice belongs to the occupier and rechecks its reciprocal ally`, () => {
    const g = position(advanced); player(g, 'guild').ally = 'atreides';
    assert.deepEqual(quote(g).recipients, ['guild']);
    player(g, 'atreides').ally = 'guild'; const offered = quote(g); assert.ok(offered.event);
    assert.deepEqual(offered.recipients, ['guild', 'atreides']);
    assert.equal(receipt(g, 'guild', offered.event, 'atreides').recipient, 'atreides');
    const before = structuredClone(g);
    assert.throws(() => receipt(g, 'atreides', offered.event!, 'atreides'), HomeworldEcazDukeError);
    assert.throws(() => receipt(g, 'guild', offered.event!, 'moritani'), HomeworldEcazDukeError);
    assert.throws(() => receipt(g, 'guild', `${offered.event}-stale`, 'guild'), HomeworldEcazDukeError);
    player(g, 'atreides').ally = null;
    assert.throws(() => receipt(g, 'guild', offered.event!, 'atreides'), HomeworldEcazDukeError);
    player(g, 'atreides').ally = 'guild'; assert.deepEqual(g, before);
  });

  void test(`${band} occupation priority overrides ordinary native holders and a later loss restores nobody`, () => {
    for (const native of ['ecaz', 'moritani'] as const) {
      const g = position(advanced);
      g.dukeVidal = acquireDuke(g.dukeVidal!, native, g.turn, native);
      const held = structuredClone(g.dukeVidal); assert.equal(quote(g).nativeAcquisitionBlocked, true);
      assert.equal(quote(g).blocked, null); assert.deepEqual(g.dukeVidal, held);
      grant(g); assert.equal(g.dukeVidal!.controller, 'guild');
      depart(g); const ending = lifecycle(g);
      assert.deepEqual(ending, { release: true, owner: 'guild', reason: 'occupationEnded', blocked: null });
      g.dukeVidal = consumeDuke(g.dukeVidal!);
      assert.equal(g.dukeVidal.controller, null); assert.equal(g.dukeVidal.source, null);
      assert.equal(g.dukeVidal.leader.dead, false); assert.equal(g.dukeVidal.leader.deaths, held.leader.deaths);
      assert.equal(quote(g).nativeAcquisitionBlocked, false);
    }
  });

  void test(`${band} the original choice survives use and prevents a second same-turn grant`, () => {
    const g = position(advanced, true), chosen = grant(g, 'atreides');
    assert.deepEqual(lifecycle(g), { release: false, owner: 'atreides', reason: null, blocked: null });
    assert.deepEqual(quote(g).claimed, chosen); assert.equal(quote(g).nativeAcquisitionBlocked, true);
    g.dukeVidal!.leader.usedAt = 'arrakeen';
    assert.equal(lifecycle(g).reason, 'used'); g.dukeVidal = consumeDuke(g.dukeVidal!);
    const offered = quote(g); assert.ok(offered.blocked); assert.equal(offered.nativeAcquisitionBlocked, true);
    assert.throws(() => receipt(g, 'guild', offered.event!, 'guild'), HomeworldEcazDukeError);
    assert.equal(g.homeworldEcazDukeGrants!.length, 1); assert.equal(g.dukeVidal.controller, null);
  });

  void test(`${band} losing the selected ally ends only this grant and does not reopen its choice`, () => {
    const g = position(advanced, true); grant(g, 'atreides');
    player(g, 'atreides').ally = null;
    assert.deepEqual(lifecycle(g), { release: true, owner: 'atreides', reason: 'recipientChanged', blocked: null });
    g.dukeVidal = consumeDuke(g.dukeVidal!);
    assert.deepEqual(quote(g).recipients, ['guild']); assert.ok(quote(g).blocked);
    assert.equal(quote(g).nativeAcquisitionBlocked, true);
    assert.throws(() => receipt(g, 'guild', quote(g).event!, 'guild'), HomeworldEcazDukeError);
  });

  void test(`${band} a continuing qualification offers a fresh choice next turn after unused release`, () => {
    const g = position(advanced, true), prior = grant(g);
    g.turn++; observe(g, 'controlled-next-turn', 'turnStart');
    assert.equal(lifecycle(g).release, true); assert.equal(lifecycle(g).reason, 'turnEnded');
    g.dukeVidal = consumeDuke(g.dukeVidal!);
    const offered = quote(g); assert.equal(offered.blocked, null); assert.equal(offered.claimed, null);
    assert.notEqual(offered.event, JSON.stringify(['homeworldEcazDuke', prior.turn, prior.qualification, prior.occupier]));
    const renewed = grant(g, 'atreides'); assert.equal(renewed.turn, 2);
    assert.equal(g.homeworldEcazDukeGrants!.length, 2); assert.equal(lifecycle(g).release, false);
  });
}

void test('Basic contest/repopulation ends a grant while Advanced retains its observed occupation', () => {
  for (const advanced of [false, true]) for (const change of ['contest', 'repopulation'] as const) {
    const g = position(advanced); grant(g);
    if (change === 'contest') {
      player(g, 'moritani').reserves--;
      g.homeworlds!.custody!.visitors['homeworld:ecaz'].moritani = { normal: 1, elite: 0 };
    } else {
      player(g, 'ecaz').reserves += player(g, 'ecaz').tanks; player(g, 'ecaz').tanks = 0;
    }
    observe(g, `controlled-${change}`);
    assert.equal(lifecycle(g).release, !advanced); assert.equal(quote(g).nativeAcquisitionBlocked, advanced);
    assert.equal(lifecycle(g).reason, advanced ? null : 'occupationEnded');
  }
});

void test('a fresh Advanced sole qualification can replace an unused grant without losing the latest receipt identity', () => {
  const g = position(true); const first = grant(g);
  depart(g); assert.equal(lifecycle(g).release, true); g.dukeVidal = consumeDuke(g.dukeVidal!);
  player(g, 'guild').reserves--;
  g.homeworlds!.custody!.visitors['homeworld:ecaz'].guild = { normal: 1, elite: 0 };
  observe(g, 'controlled-new-sole-guild');
  const second = grant(g); assert.notEqual(second.qualification, first.qualification);
  assert.equal(g.homeworldEcazDukeGrants!.length, 2); assert.equal(lifecycle(g).release, false);
  const used = position(true); grant(used); used.dukeVidal!.leader.usedAt = 'carthag';
  used.dukeVidal = consumeDuke(used.dukeVidal!); depart(used);
  player(used, 'guild').reserves--;
  used.homeworlds!.custody!.visitors['homeworld:ecaz'].guild = { normal: 1, elite: 0 };
  observe(used, 'controlled-new-qualification-after-use');
  assert.match(quote(used).blocked!, /already been used/);
  assert.throws(() => receipt(used, 'guild', quote(used).event!, 'guild'), HomeworldEcazDukeError);
  assert.equal(used.homeworldEcazDukeGrants!.length, 1, 'A new qualification cannot erase actual prior battle use');
});

void test('occupied Ecaz cannot acquire used or dead Duke and supplies no foreign revival', () => {
  const g = position(); g.dukeVidal!.leader.usedAt = 'arrakeen';
  assert.match(quote(g).blocked!, /already been used/); assert.equal(quote(g).nativeAcquisitionBlocked, true);
  delete g.dukeVidal!.leader.usedAt; g.dukeVidal!.leader.dead = true; g.dukeVidal!.leader.deaths = 1;
  const before = structuredClone(g);
  assert.match(quote(g).blocked!, /only Ecaz may revive/);
  assert.throws(() => receipt(g, 'guild', quote(g).event!, 'guild'), HomeworldEcazDukeError);
  assert.deepEqual(g, before); assert.equal(g.dukeVidal!.leader.dead, true);
});

void test('captured and malformed foreign-Ghola custody stay explicitly unsupported and are never erased', () => {
  const g = position(); g.dukeVidal = acquireDuke(g.dukeVidal!, 'ecaz', 1, 'ecaz');
  g.dukeVidal = captureDuke(g.dukeVidal, 'moritani', 'ecaz', 1, 'arrakeen');
  const before = structuredClone(g); assert.match(quote(g).blocked!, /captured, concealed or Ghola/);
  assert.equal(quote(g).nativeAcquisitionBlocked, true); assert.deepEqual(g, before);
  const active = position(); grant(active);
  active.dukeVidal = captureDuke(active.dukeVidal!, 'moritani', 'guild', 1, 'arrakeen');
  const held = structuredClone(active); assert.equal(lifecycle(active).release, false); assert.ok(lifecycle(active).blocked);
  assert.deepEqual(active, held);
  // Deliberately invalid negative input, not an allegedly legal foreign revival.
  const malformed = position(); malformed.dukeVidal!.leader.gholaBy = 'moritani';
  assert.match(quote(malformed).blocked!, /captured, concealed or Ghola/);
});

void test('ordinary native tenure is outside this lifecycle and missing occupation evidence awards nothing', () => {
  const g = position(); g.dukeVidal = acquireDuke(g.dukeVidal!, 'ecaz', 1, 'ecaz');
  assert.deepEqual(lifecycle(g), { release: false, owner: null, reason: null, blocked: null });
  delete g.homeworldOccupationHistory;
  const before = structuredClone(g); assert.ok(quote(g).blocked); assert.equal(quote(g).owner, null);
  assert.throws(() => receipt(g, 'guild', 'invented', 'guild'), HomeworldEcazDukeError); assert.deepEqual(g, before);
});

void test('one original qualification cannot carry duplicate or source-swapped grant choices', () => {
  const g = position(); const original = grant(g);
  const duplicate = structuredClone(g); duplicate.homeworldEcazDukeGrants!.push({ ...original });
  assert.throws(() => validateHomeworldEcazDukeGrants(duplicate), HomeworldEcazDukeError);
  const swapped = structuredClone(g); swapped.homeworldEcazDukeGrants![0].qualification = 'absent-source';
  assert.throws(() => quote(swapped), HomeworldEcazDukeError);
  assert.equal(g.homeworldEcazDukeGrants!.length, 1); assert.equal(quote(g).claimed!.qualification, original.qualification);
});
