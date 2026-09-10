import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Action } from '../game/engine';
import {
  NEXUS_CHOAM_EFFECTS,
  nexusChoamFixture,
  holdNexusChoamCard,
  nexusChoamRequest,
  nexusChoamAllow,
  nexusChoamInventory,
  nexusChoamReload,
} from './fixture-nexus-choam';

function reject(g: Game, owner: string, action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.equal(JSON.stringify(g), before);
}
for (const effect of NEXUS_CHOAM_EFFECTS) {
  void test(`CHOAM Nexus ${effect} spends Nexus before the response and applies its real effect once`, () => {
    const f = nexusChoamFixture(effect),
      before = structuredClone(f.g);
    const offer = viewGame(f.g, f.owner).choamWorthless!.plays.find(
      (play) =>
        play.source === 'nexus' &&
        play.effect === effect &&
        play.card.id === f.cost.id,
    )!;
    assert.ok(offer && offer.source === 'nexus');
    assert.equal(offer.blocked, null);
    assert.equal(offer.event, nexusChoamRequest(f).nexus);
    let g = applyAction(f.g, f.owner, nexusChoamRequest(f));
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((card) => card === 'choam').length,
      1,
    );
    assert.deepEqual(
      g.players[0].hand.find((card) => card.id === f.cost.id),
      f.cost,
    );
    assert.deepEqual(
      g.players.map((p) => p.forces),
      before.players.map((p) => p.forces),
    );
    g = nexusChoamAllow(nexusChoamReload(g));
    assert.equal(g.nexusChoamLast?.stage, 'complete');
    assert.deepEqual(
      g.discard.find((card) => card.id === f.cost.id),
      f.cost,
    );
    assert.equal(g.discard.filter((card) => card.id === f.cost.id).length, 1);
    assert.equal(
      g.players[0].hand.some((card) => card.id === f.cost.id),
      false,
    );
    if (effect === 'kulon')
      assert.deepEqual(g.choamMovement, { turn: g.turn, bonus: 1 });
    if (effect === 'laLaLa') {
      assert.equal(g.players[1].tanks, 4);
      assert.equal(g.players[1].spice, 20);
      assert.equal(g.pendingRevival, null);
    }
    if (effect === 'gamont') {
      assert.equal(g.players[1].forces['arrakeen:10'], 1);
      assert.equal(g.players[1].reserves, 19);
      assert.equal(g.decision?.kind, 'choamMentat');
    }
    if (effect === 'baliset') {
      assert.deepEqual(g.players[1].forces, before.players[1].forces);
      assert.equal(g.players[1].moved, 0);
      assert.equal(g.pendingChoamMove, null);
    }
    if (effect === 'jubba') {
      assert.equal(g.players[0].forces['red_chasm:7'], 4);
      assert.equal(g.players[1].tanks, 3);
      assert.equal(g.spice['red_chasm:7'], undefined);
    }
    reject(g, f.owner, nexusChoamRequest(f));
    nexusChoamInventory(g);
    for (const p of g.players)
      assert.deepEqual(viewGame(nexusChoamReload(g), p.id), viewGame(g, p.id));
  });
  void test(`CHOAM Nexus ${effect} Karama retains the actual cost and resumes the original public context`, () => {
    const f = nexusChoamFixture(effect);
    let g = applyAction(f.g, f.owner, nexusChoamRequest(f));
    g = applyAction(nexusChoamReload(g), f.target, {
      type: 'card',
      mode: 'cancel',
      card: f.karama,
    });
    assert.equal(g.nexusChoamLast?.stage, 'canceled');
    assert.deepEqual(
      g.players[0].hand.find((card) => card.id === f.cost.id),
      f.cost,
    );
    assert.equal(
      g.discard.some((card) => card.id === f.cost.id),
      false,
    );
    assert.equal(g.discard.filter((card) => card.id === f.karama).length, 1);
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    if (effect === 'kulon') assert.equal(g.choamMovement, undefined);
    if (effect === 'laLaLa') {
      assert.equal(g.players[1].reserves, 19);
      assert.equal(g.players[1].tanks, 1);
      assert.equal(g.players[1].spice, 16);
    }
    if (effect === 'gamont') {
      assert.equal(g.players[1].forces['arrakeen:10'], 2);
      assert.equal(g.decision?.kind, 'choamMentat');
    }
    if (effect === 'baliset') {
      assert.equal(g.players[1].forces['red_chasm:7'], 1);
      assert.equal(g.players[1].moved, 1);
    }
    if (effect === 'jubba') {
      assert.equal(g.decision?.kind, 'choamStorm');
      g = applyAction(g, f.owner, { type: 'decision', decline: true });
      assert.equal(g.players[0].tanks, 4);
      assert.equal(g.players[1].tanks, 3);
    }
    reject(g, f.owner, nexusChoamRequest(f));
    nexusChoamInventory(g);
  });
}
void test('CHOAM Nexus rejects stale events, wrong owner/effect, unsupported Kull and malformed costs immutably', () => {
  const f = nexusChoamFixture('kulon'),
    action = nexusChoamRequest(f);
  for (const bad of [
    { ...action, nexus: 'stale' },
    { ...action, effect: 'kull' },
    { ...action, card: 'unknown' },
    { ...action, effect: 'gamont' },
  ])
    reject(f.g, f.owner, bad);
  reject(f.g, f.target, action);
  const unsupported = viewGame(f.g, f.owner).choamWorthless!.plays.find(
    (play) => play.effect === 'kull',
  );
  assert.ok(unsupported?.blocked);
});
void test('CHOAM Nexus hidden physical cost kinds have identical opponent views until actual discard', () => {
  const f = nexusChoamFixture('kulon'),
    other = structuredClone(f.g);
  const index = other.deck.findIndex((card) => card.kind === 'poison');
  assert.ok(index >= 0);
  const cost = other.deck[index];
  other.deck[index] = other.players[0].hand[0];
  other.players[0].hand[0] = cost;
  const alternate = { ...f, g: other, cost };
  for (const id of [f.target, f.observer])
    assert.deepEqual(viewGame(f.g, id), viewGame(other, id));
  const a = applyAction(f.g, f.owner, nexusChoamRequest(f)),
    b = applyAction(other, f.owner, nexusChoamRequest(alternate));
  for (const id of [f.target, f.observer])
    assert.deepEqual(viewGame(a, id), viewGame(b, id));
  for (const g of [a, b])
    for (const id of [f.target, f.observer]) {
      assert.equal(Object.hasOwn(viewGame(g, id), 'nexusChoamHistory'), false);
      assert.equal(viewGame(g, id).choamWorthless, null);
    }
});
void test('CHOAM Nexus can discard a real Ghola as payment without activating its printed revival effect in Basic or Advanced', () => {
  for (const advanced of [false, true]) {
    const f = nexusChoamFixture('kulon', { advanced, costKind: 'ghola' });
    const before = f.g.players.map((p) => ({
      reserves: p.reserves,
      tanks: p.tanks,
      revived: p.revived,
    }));
    const g = nexusChoamAllow(applyAction(f.g, f.owner, nexusChoamRequest(f)));
    assert.deepEqual(
      g.players.map((p) => ({
        reserves: p.reserves,
        tanks: p.tanks,
        revived: p.revived,
      })),
      before,
    );
    assert.equal(g.discard.find((c) => c.id === f.cost.id)?.effect, 'ghola');
    assert.equal(g.choamMovement?.bonus, 1);
    nexusChoamInventory(g);
  }
});

void test('CHOAM Nexus Baliset survives a real paid Nullentropy search and restores its original movement response before allow or cancellation', () => {
  for (const cancel of [false, true]) {
    const f = nexusChoamFixture('baliset', { opponentFaction: 'richese' });
    let g = f.g;
    const index = g.richeseCache!.findIndex(
      (card) => card.effect === 'nullentropyBox',
    );
    assert.ok(index >= 0);
    const box = g.richeseCache!.splice(index, 1)[0];
    g.players[1].hand.push(box);
    for (const kind of ['shield', 'projectile']) {
      const i = g.deck.findIndex((card) => card.kind === kind);
      assert.ok(i >= 0);
      g.discard.push(g.deck.splice(i, 1)[0]);
    }
    g = applyAction(g, f.owner, nexusChoamRequest(f));
    const response = structuredClone(g.response),
      move = structuredClone(g.pendingChoamMove);
    g = applyAction(g, f.target, { type: 'card', card: box.id });
    assert.equal(g.decision?.kind, 'nullentropy');
    assert.deepEqual(g.pendingNullentropy!.resume.response, response);
    assert.deepEqual(g.pendingChoamMove, move);
    assert.equal(g.players[1].spice, 18);
    nexusChoamInventory(g);
    for (const p of g.players)
      assert.deepEqual(viewGame(nexusChoamReload(g), p.id), viewGame(g, p.id));
    const selected = g.discard[0].id;
    g = applyAction(nexusChoamReload(g), f.target, {
      type: 'decision',
      event: g.pendingNullentropy!.event,
      card: selected,
    });
    assert.deepEqual(g.response, response);
    g = cancel
      ? applyAction(g, f.target, {
          type: 'card',
          mode: 'cancel',
          card: f.karama,
        })
      : nexusChoamAllow(g);
    assert.equal(g.nexusChoamLast?.stage, cancel ? 'canceled' : 'complete');
    assert.equal(g.players[1].forces['red_chasm:7'], cancel ? 1 : 3);
    assert.equal(g.players[1].spice, 18);
    assert.equal(g.discard.filter((card) => card.id === box.id).length, 1);
    assert.ok(g.players[1].hand.some((card) => card.id === selected));
    nexusChoamInventory(g);
  }
});

void test('CHOAM Nexus legitimately fizzles after native Karama cash-in spends its payment, resuming movement or storm once', () => {
  for (const effect of ['baliset', 'jubba'] as const) {
    const f = nexusChoamFixture(effect);
    const karama = holdNexusChoamCard(f.g, f.owner, 'karama');
    let g = applyAction(f.g, f.owner, nexusChoamRequest(f));
    g = applyAction(g, f.owner, {
      type: 'card',
      mode: 'special',
      card: karama.id,
      cards: [f.cost.id],
    });
    g = nexusChoamAllow(nexusChoamReload(g));
    assert.equal(g.nexusChoamLast?.stage, 'fizzled');
    assert.equal(
      g.nexusCards!.cards!.discard.filter((card) => card === 'choam').length,
      1,
    );
    assert.equal(g.discard.filter((card) => card.id === f.cost.id).length, 1);
    assert.equal(g.discard.filter((card) => card.id === karama.id).length, 1);
    assert.equal(g.players[0].spice, 23);
    if (effect === 'baliset') {
      assert.equal(g.players[1].forces['red_chasm:7'], 1);
      assert.equal(g.players[1].moved, 1);
    } else {
      assert.equal(g.decision?.kind, 'choamStorm');
      g = applyAction(g, f.owner, { type: 'decision', decline: true });
      assert.equal(g.players[0].tanks, 4);
      assert.equal(g.players[1].tanks, 3);
    }
    reject(g, f.owner, nexusChoamRequest(f));
    nexusChoamInventory(g);
  }
});
