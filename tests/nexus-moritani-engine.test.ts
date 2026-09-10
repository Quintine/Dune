import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import {
  nexusMoritaniFixture,
  nexusMoritaniToken,
  nexusMoritaniRequest,
  nexusMoritaniAllow,
  nexusMoritaniReload,
  nexusMoritaniInventory,
  nexusMoritaniArrival,
  holdNexusMoritaniCard,
} from './fixture-nexus-moritani';
function reject(g: Game, id: string, a: Action) {
  const before = nexusMoritaniReload(g);
  assert.throws(() => applyAction(g, id, a));
  assert.deepEqual(g, before);
}
function stable(g: Game) {
  nexusMoritaniInventory(g);
  const before = nexusMoritaniReload(g);
  assert.deepEqual(normalizeAutomaticGame(before), before);
  for (const p of g.players)
    assert.deepEqual(viewGame(nexusMoritaniReload(g), p.id), viewGame(g, p.id));
}
void test('Moritani Cunning places a real available token in sand, rock, Polar Sink or an existing stack in Basic and Advanced', () => {
  for (const advanced of [false, true])
    for (const territory of [
      'red_chasm',
      'sihaya_ridge',
      'polar_sink',
      'arrakeen',
    ]) {
      const f = nexusMoritaniFixture({
          advanced,
          stack: territory === 'arrakeen',
        }),
        before = nexusMoritaniReload(f.g),
        token = nexusMoritaniToken(f.g, 'robbery').id;
      const action = nexusMoritaniRequest(f, 'robbery', territory);
      let g = applyAction(f.g, f.owner, action);
      assert.equal(g.response?.kind, 'moritaniPlacement');
      assert.equal(nexusMoritaniToken(g, 'robbery').status, 'available');
      assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(
        g.nexusCards!.cards!.discard.filter((c) => c === 'moritani').length,
        1,
      );
      assert.deepEqual(g.moritaniTerror, before.moritaniTerror);
      stable(g);
      g = nexusMoritaniAllow(nexusMoritaniReload(g));
      assert.equal(nexusMoritaniToken(g, 'robbery').location, territory);
      assert.equal(nexusMoritaniToken(g, 'robbery').status, 'placed');
      assert.equal(g.moritaniTerror!.placementTurn, g.turn);
      assert.deepEqual(
        g.moritaniTerror!.tokens.filter((t) => t.id !== token),
        before.moritaniTerror!.tokens.filter((t) => t.id !== token),
      );
      assert.deepEqual(
        g.players.map((p) => [p.spice, p.forces, p.reserves, p.tanks]),
        before.players.map((p) => [p.spice, p.forces, p.reserves, p.tanks]),
      );
      if (territory === 'arrakeen')
        assert.equal(
          g.moritaniTerror!.tokens.filter((t) => t.location === 'arrakeen')
            .length,
          2,
        );
      reject(g, f.owner, action);
      stable(g);
    }
});
void test('printed Karama consumes the Mentat opportunity while preserving supply, previous placement and physical counters', () => {
  const f = nexusMoritaniFixture({ stack: true }),
    before = nexusMoritaniReload(f.g),
    action = nexusMoritaniRequest(f, 'robbery', 'arrakeen');
  let g = applyAction(f.g, f.owner, action);
  g = applyAction(nexusMoritaniReload(g), f.target, {
    type: 'card',
    mode: 'cancel',
    card: f.karama,
  });
  assert.equal(g.pendingMoritaniPlacement, null);
  assert.equal(g.response, null);
  assert.deepEqual(g.moritaniTerror!.tokens, before.moritaniTerror!.tokens);
  assert.equal(g.moritaniTerror!.placementTurn, g.turn);
  assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(g.discard.filter((c) => c.id === f.karama).length, 1);
  assert.deepEqual(
    g.players.map((p) => p.spice),
    before.players.map((p) => p.spice),
  );
  reject(g, f.owner, action);
  stable(g);
});
void test('Moritani Cunning offers every static territory without reading token kinds for another seat; hidden declarations stay equivalent', () => {
  const f = nexusMoritaniFixture(),
    a = f.g,
    b = nexusMoritaniReload(a);
  const tokenA = nexusMoritaniToken(a, 'robbery'),
    tokenB = b.moritaniTerror!.tokens.find((t) => t.id === tokenA.id)!,
    other = nexusMoritaniToken(b, 'sabotage');
  [tokenB.kind, other.kind] = [other.kind, tokenB.kind];
  for (const id of [f.target, f.observer])
    assert.deepEqual(viewGame(a, id), viewGame(b, id));
  const offer = viewGame(a, f.owner).nexusMoritani!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.tokens.length, 6);
  assert.equal(offer.destinations.length, TERRITORIES.length);
  const action = nexusMoritaniRequest(f, 'robbery', 'red_chasm');
  const pendingA = applyAction(a, f.owner, action),
    pendingB = applyAction(b, f.owner, action);
  for (const id of [f.target, f.observer]) {
    assert.deepEqual(viewGame(pendingA, id), viewGame(pendingB, id));
    assert.equal(viewGame(pendingA, id).nexusMoritani, null);
    assert.equal(
      Object.hasOwn(viewGame(pendingA, id), 'nexusMoritaniHistory'),
      false,
    );
  }
});
void test('Moritani Cunning rejects stale event, foreign ownership, relocation, unknown supply, Homeworlds and mobile stronghold without spending Nexus', () => {
  const f = nexusMoritaniFixture({ stack: true }),
    action = nexusMoritaniRequest(f);
  for (const bad of [
    { ...action, nexus: 'old' },
    { ...action, token: 'missing' },
    { ...action, token: nexusMoritaniToken(f.g, 'sabotage').id },
    { ...action, territory: 'grumman' },
    { ...action, territory: 'hidden_mobile_stronghold' },
    { ...action, territory: 'unknown' },
  ])
    reject(f.g, f.owner, bad);
  reject(f.g, f.target, action);
  assert.equal(f.g.nexusCards!.cards!.hands[f.owner], 'moritani');
  const noNexus = nexusMoritaniReload(f.g);
  noNexus.nexusCards!.cards!.deck.push('moritani');
  noNexus.nexusCards!.cards!.hands[f.owner] = null;
  reject(noNexus, f.owner, action);
});
void test('Nexus Mentat placement preserves genuine previous Grumman decline or expiry, pays no Collection income and applies the low entry threshold later', () => {
  for (const native of [7, 8]) {
    const f = nexusMoritaniFixture({ homeworlds: true, native, stack: true }),
      receipt = structuredClone(f.g.grummanCollection);
    assert.equal(receipt?.outcome, native === 7 ? 'expired' : 'decline');
    let g = nexusMoritaniAllow(
      applyAction(f.g, f.owner, nexusMoritaniRequest(f)),
    );
    assert.deepEqual(g.grummanCollection, receipt);
    assert.equal(g.players[0].spice, 20);
    g = nexusMoritaniArrival(g, 'red_chasm', 2);
    if (native === 7) assert.equal(g.pendingTerrorEntry ?? null, null);
    else assert.equal(g.pendingTerrorEntry?.stage, 'offer');
    stable(g);
  }
});
for (const kind of ['robbery', 'sabotage', 'sneakAttack'] as const)
  void test(`Nexus ${kind} placed outside a stronghold triggers its existing effect on a later real shipment`, () => {
    const f = nexusMoritaniFixture();
    const victimCard = holdNexusMoritaniCard(f.g, f.target, 'shield');
    let g = nexusMoritaniAllow(
      applyAction(f.g, f.owner, nexusMoritaniRequest(f, kind, 'sihaya_ridge')),
    );
    g = nexusMoritaniArrival(g, 'sihaya_ridge');
    assert.equal(g.pendingTerrorEntry?.stage, 'offer');
    assert.equal(viewGame(g, f.owner).terrorEntry?.kind, kind);
    for (const id of [f.target, f.observer])
      assert.equal(viewGame(g, id).terrorEntry?.kind, undefined);
    const before = nexusMoritaniReload(g);
    g = applyAction(nexusMoritaniReload(g), f.owner, {
      type: 'decision',
      reveal: true,
    });
    if (kind === 'robbery') {
      g = applyAction(g, f.owner, { type: 'decision', choice: 'spice' });
      const taken = Math.ceil(before.players[1].spice / 2);
      assert.equal(g.players[0].spice, before.players[0].spice + taken);
      assert.equal(g.players[1].spice, before.players[1].spice - taken);
    } else if (kind === 'sabotage') {
      assert.equal(g.pendingTerrorEntry?.stage, 'gift');
      g = applyAction(g, f.owner, { type: 'decision', decline: true });
      assert.ok(before.players[1].hand.some((c) => c.id === victimCard.id));
      assert.equal(g.players[1].hand.length, before.players[1].hand.length - 1);
      assert.equal(g.discard.length, before.discard.length + 1);
      assert.ok(
        before.players[1].hand.some((c) => c.id === g.discard.at(-1)!.id),
      );
    } else {
      assert.equal(g.pendingTerrorEntry?.stage, 'sneakAttack');
      g = applyAction(g, f.owner, { type: 'decision', amount: 3 });
      assert.equal(g.players[0].forces['sihaya_ridge:9'], 3);
      assert.equal(g.players[0].reserves, before.players[0].reserves - 3);
      assert.equal(g.players[0].spice, before.players[0].spice);
    }
    assert.equal(nexusMoritaniToken(g, kind).status, 'removed');
    assert.equal(g.pendingTerrorEntry, null);
    assert.equal(g.players[1].forces['sihaya_ridge:9'], 3);
    reject(g, f.owner, { type: 'decision', reveal: true });
    stable(g);
  });
