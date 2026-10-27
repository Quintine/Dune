import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlayer } from '../game/engine';
import {
  acquireDuke, captureDuke, createDukeVidal, dukeController, executeCapturedDuke,
  expireDuke, releaseCapturedDuke, retireHomeworldDukeTenure, returnedDukeCapture,
} from '../game/duke-vidal';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { createHomeworldOccupationHistory, observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import {
  createHomeworldEcazDukeReceipt, quoteHomeworldEcazDuke,
  quoteHomeworldEcazDukeLifecycle as lifecycle, releaseCapturedHomeworldDuke,
  type HomeworldEcazDukeContext as Context,
} from '../game/homeworld-ecaz-duke';

const player = (g: Context, id: string) => {
  const p = g.players.find(p => p.id === id); assert.ok(p); return p;
};
function observe(g: Context, event: string) {
  g.homeworldOccupationHistory = observeHomeworldOccupation(g.homeworldOccupationHistory!,
    homeworldContext(g), g.homeworlds!.custody!, g.turn, 'change', event);
}
/** Controlled helper positions, not native battle/capture chronology. Original
 * typed pools and canonical observation create the occupied-source receipt;
 * real Duke capture/release/execution helpers then exercise its lifecycle. */
function position(allied = false): Context {
  const players = (['ecaz', 'guild', 'atreides', 'harkonnen'] as const)
    .map(faction => newPlayer(faction, faction, faction));
  const context = homeworldContext({ advanced: true, players });
  const custody = createHomeworldCustody(context);
  const g: Context = { status: 'playing', advanced: true, turn: 1, players,
    homeworlds: { custody, historyVersion: 1 }, homeworldOccupationPreview: true,
    homeworldOccupationHistory: createHomeworldOccupationHistory(context, custody, 1, 'controlled-native-pools'),
    dukeVidal: createDukeVidal() };
  player(g, 'ecaz').tanks += player(g, 'ecaz').reserves;
  player(g, 'ecaz').reserves = 0;
  player(g, 'guild').reserves--;
  custody.visitors['homeworld:ecaz'] = { guild: { normal: 1, elite: 0 } };
  observe(g, 'controlled-guild-occupation');
  if (allied) {
    player(g, 'guild').ally = 'atreides';
    player(g, 'atreides').ally = 'guild';
  }
  const offer = quoteHomeworldEcazDuke(g);
  assert.ok(offer.event && offer.owner); assert.equal(offer.blocked, null);
  const recipient = allied ? 'atreides' : 'guild';
  g.homeworldEcazDukeGrants = [createHomeworldEcazDukeReceipt(g, offer.owner, offer.event, recipient)];
  g.dukeVidal = captureDuke(acquireDuke(g.dukeVidal!, recipient, 1, 'homeworldEcaz'),
    'harkonnen', recipient, 1, 'sietch_tabr');
  return g;
}
function depart(g: Context) {
  const group = g.homeworlds!.custody!.visitors['homeworld:ecaz'].guild;
  player(g, 'guild').reserves += group.normal + group.elite;
  delete g.homeworlds!.custody!.visitors['homeworld:ecaz'].guild;
  observe(g, 'controlled-guild-departure');
}
const noTenure = { controller: null, acquiredTurn: null, source: null };

void test('early captive return restores a still-qualified occupied Ecaz tenure without a second grant', () => {
  const g = position(), before = structuredClone(g);
  assert.equal(lifecycle(g).release, false);
  assert.match(lifecycle(g).blocked!, /captured, concealed or Ghola/);
  const released = releaseCapturedHomeworldDuke(g, 'harkonnen');
  assert.equal(released.controller, 'guild'); assert.equal(released.source, 'homeworldEcaz');
  assert.equal(released.acquiredTurn, 1); assert.equal(released.leader.capturedBy, undefined);
  assert.equal(released.captureVisibility, undefined); assert.equal(released.leader.concealed, undefined);
  assert.deepEqual(g, before);
  g.dukeVidal = released;
  assert.equal(quoteHomeworldEcazDuke(g).claimed?.recipient, 'guild');
  assert.match(quoteHomeworldEcazDuke(g).blocked!, /already chose/);
});

void test('public turn-end retirement preserves the captive disc and later release cannot revive its lease', () => {
  const g = position(), held = g.dukeVidal!;
  held.leader.deaths = 2; held.leader.concealed!.deaths = 2;
  held.leader.usedAt = 'carthag';
  const before = structuredClone(held), retired = expireDuke(held, 1);
  assert.deepEqual(held, before);
  assert.deepEqual(retired.leader, held.leader);
  assert.equal(dukeController(retired), 'harkonnen');
  assert.equal(retired.controller, null); assert.equal(retired.source, null);
  assert.equal(retired.acquiredTurn, null); assert.deepEqual(retired.captureVisibility, noTenure);
  assert.equal(retired.leader.concealed?.controller, 'guild');
  g.dukeVidal = retired;
  const released = releaseCapturedHomeworldDuke(g, 'harkonnen', 2);
  assert.equal(dukeController(released), null); assert.equal(released.source, null);
  assert.equal(released.leader.usedAt, 'carthag'); assert.equal(released.leader.deaths, 2);
  assert.equal(released.leader.concealed, undefined);
  assert.throws(() => releaseCapturedHomeworldDuke(g, 'atreides', 2));
});

void test('departure, replacement qualification and lost recipient are rechecked during actual captive return', () => {
  for (const reason of ['occupationEnded', 'occupationChanged', 'recipientChanged'] as const) {
    const g = position(reason === 'recipientChanged');
    if (reason === 'recipientChanged') player(g, 'atreides').ally = null;
    else {
      depart(g);
      if (reason === 'occupationChanged') {
        player(g, 'guild').reserves--;
        g.homeworlds!.custody!.visitors['homeworld:ecaz'].guild = { normal: 1, elite: 0 };
        observe(g, 'controlled-new-guild-qualification');
      }
    }
    const before = structuredClone(g);
    assert.equal(lifecycle(g).reason, reason); assert.equal(lifecycle(g).release, true);
    assert.equal(lifecycle(g).blocked, null);
    const released = releaseCapturedHomeworldDuke(g, 'harkonnen');
    assert.equal(released.controller, null); assert.equal(released.source, null);
    assert.equal(released.leader.capturedBy, undefined);
    assert.deepEqual(g, before, 'release recheck is pure even before settled-boundary reconciliation');
  }
});

void test('secret execution retains the same public lease until public expiry and retires its visibility only then', () => {
  const living = position(), executed = structuredClone(living);
  executed.dukeVidal = executeCapturedDuke(executed.dukeVidal!, 'harkonnen', 1);
  assert.equal(returnedDukeCapture(executed.dukeVidal), true);
  assert.deepEqual(lifecycle(executed), lifecycle(living), 'actual private death is not a lease-expiry reason');
  const original = structuredClone(executed.dukeVidal);
  const atDeadline = expireDuke(executed.dukeVidal, 1);
  assert.deepEqual(executed.dukeVidal, original);
  assert.deepEqual(atDeadline.leader, original.leader);
  assert.deepEqual(atDeadline.captureVisibility, noTenure);
  assert.equal(returnedDukeCapture(atDeadline), true);
  depart(living); depart(executed);
  assert.deepEqual(lifecycle(executed), lifecycle(living));
  assert.equal(lifecycle(executed).reason, 'occupationEnded');
  executed.dukeVidal = retireHomeworldDukeTenure(executed.dukeVidal, 1);
  assert.equal(returnedDukeCapture(executed.dukeVidal), true);
  assert.equal(executed.dukeVidal.leader.dead, true);
  assert.equal(executed.dukeVidal.leader.deaths, 2);
  assert.equal(executed.dukeVidal.leader.concealed?.controller, 'guild');
});

void test('retired custody still permits the original captor execution and Ecaz-only return mechanisms', () => {
  const g = position();
  const retired = retireHomeworldDukeTenure(g.dukeVidal!, 1);
  const executed = executeCapturedDuke(retired, 'harkonnen', 1);
  assert.equal(returnedDukeCapture(executed), true);
  assert.deepEqual(executed.captureVisibility, noTenure);
  assert.equal(executed.leader.deaths, 2); assert.equal(executed.leader.concealed?.controller, 'guild');
  const revived = acquireDuke(executed, 'ecaz', 1, 'ecazNexus');
  assert.equal(revived.controller, 'ecaz'); assert.equal(revived.source, 'ecazNexus');
  assert.equal(revived.leader.deaths, 2); assert.equal(revived.leader.dead, false);
  assert.equal(revived.captureVisibility, undefined);
  const returned = releaseCapturedDuke(retired, 'harkonnen', 1);
  assert.equal(returned.controller, null); assert.equal(returned.leader.dead, false);
  assert.equal(returned.leader.id, retired.leader.id);
});

void test('non-homeworld captive return and expiry keep their original tenure rules', () => {
  const g = position();
  for (const source of ['ecaz', 'moritani', 'ecazNexus', 'ally'] as const) {
    const captured = captureDuke(acquireDuke(createDukeVidal(), 'guild', 1, source),
      'harkonnen', 'guild', 1, 'sietch_tabr');
    g.dukeVidal = captured;
    assert.deepEqual(expireDuke(captured, 1), captured);
    assert.deepEqual(retireHomeworldDukeTenure(captured, 1), captured);
    assert.deepEqual(releaseCapturedHomeworldDuke(g, 'harkonnen'), releaseCapturedDuke(captured, 'harkonnen', 1));
  }
});

void test('a retired captured or concealed disc still cannot receive a fresh occupied Ecaz grant', () => {
  const g = position();
  const held = retireHomeworldDukeTenure(g.dukeVidal!, 1);
  depart(g);
  player(g, 'guild').reserves--;
  g.homeworlds!.custody!.visitors['homeworld:ecaz'].guild = { normal: 1, elite: 0 };
  observe(g, 'controlled-new-qualification');
  for (const state of [held, executeCapturedDuke(held, 'harkonnen', 1)]) {
    g.dukeVidal = state;
    assert.match(quoteHomeworldEcazDuke(g).blocked!, /captured, concealed or Ghola/);
  }
  // Deliberately invalid negative input: no legal foreign Duke revival is asserted.
  g.dukeVidal = createDukeVidal(); g.dukeVidal.leader.gholaBy = 'atreides';
  assert.match(quoteHomeworldEcazDuke(g).blocked!, /captured, concealed or Ghola/);
});
