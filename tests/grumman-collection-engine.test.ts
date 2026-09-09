import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { grummanCollectionActions } from '../game/grumman-collection-options';
import {
  grummanCollectionFixture,
  enterGrummanCollection,
  grummanPlayer,
  grummanReload,
  grummanToken,
  addGrummanToken,
  holdGrummanCard,
  stageGrummanArrival,
  enterGrummanStack,
  grummanReject,
  grummanInventory,
} from './fixture-grumman-collection';

function stable(g: Game) {
  grummanInventory(g);
  assert.deepEqual(normalizeAutomaticGame(grummanReload(g)), g);
  for (const p of g.players) {
    const view = viewGame(grummanReload(g), p.id);
    for (const other of view.players.filter((seat) => seat.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
}
function mentat(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 8);
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  return g;
}
function decide(g: Game, extra: Record<string, unknown>) {
  return applyAction(grummanReload(g), 'm', { type: 'decision', ...extra });
}

void test('actual Basic and Advanced Collection opens at native eight, adds exactly one hidden token and pays four once', () => {
  for (const advanced of [false, true]) {
    const initial = grummanCollectionFixture({ advanced });
    const tokens = structuredClone(initial.moritaniTerror);
    let g = enterGrummanCollection(initial);
    assert.equal(g.grummanCollection?.stage, 'choice');
    assert.equal(grummanPlayer(g, 'm').spice, 20);
    assert.deepEqual(g.moritaniTerror, tokens);
    const event = g.grummanCollection!.event;
    const token = grummanToken(g, 'sabotage').id;
    stable(g);
    g = addGrummanToken(grummanReload(g));
    assert.equal(grummanPlayer(g, 'm').spice, 24);
    assert.equal(g.grummanCollection?.outcome, 'add');
    assert.equal(g.grummanCollection?.stage, 'complete');
    assert.equal(g.moritaniTerror?.placementTurn, 1);
    assert.deepEqual(
      g.moritaniTerror?.tokens.filter((t) => t.id !== token),
      tokens!.tokens.filter((t) => t.id !== token),
    );
    assert.deepEqual(grummanToken(g, 'sabotage'), {
      id: token,
      kind: 'sabotage',
      status: 'placed',
      location: 'arrakeen',
    });
    assert.equal(
      g.moritaniTerror?.tokens.filter((t) => t.location === 'arrakeen').length,
      2,
    );
    grummanReject(g, 'm', {
      type: 'decision',
      event,
      mode: 'add',
      token,
      territory: 'arrakeen',
    });
    stable(g);
  }
});

void test('low seven waits without income and expires on Mentat; a current high choice may decline after falling low', () => {
  const low = enterGrummanCollection(grummanCollectionFixture({ native: 7 }));
  assert.equal(low.grummanCollection?.stage, 'waiting');
  assert.equal(low.decision, null);
  assert.equal(viewGame(low, 'm').grummanCollection, null);
  stable(low);
  const expired = mentat(low);
  assert.equal(expired.grummanCollection?.outcome, 'expired');
  assert.equal(grummanPlayer(expired, 'm').spice, 20);
  assert.deepEqual(expired.moritaniTerror, low.moritaniTerror);
  stable(expired);

  const high = enterGrummanCollection(grummanCollectionFixture());
  // Conserved later population change tests use-time eligibility without
  // fabricating a second Collection event or its payment.
  grummanPlayer(high, 'm').reserves--;
  grummanPlayer(high, 'm').forces['polar_sink:0']++;
  const event = high.grummanCollection!.event;
  assert.match(viewGame(high, 'm').grummanCollection!.blocked!, /eight native/);
  grummanReject(
    high,
    'm',
    {
      type: 'decision',
      event,
      mode: 'add',
      token: grummanToken(high, 'sabotage').id,
      territory: 'arrakeen',
    },
    /eight native/,
  );
  const declined = decide(high, { event, decline: true });
  assert.equal(declined.grummanCollection?.outcome, 'decline');
  assert.equal(grummanPlayer(declined, 'm').spice, 20);
  assert.deepEqual(declined.moritaniTerror, high.moritaniTerror);
  stable(declined);
});

void test('owner event, physical availability, destination and pending removal rulings reject before token or spice mutation', () => {
  const g = enterGrummanCollection(grummanCollectionFixture());
  const event = g.grummanCollection!.event;
  const token = grummanToken(g, 'sabotage').id;
  for (const action of [
    { event: 'old-event', mode: 'add', token, territory: 'arrakeen' },
    {
      event,
      mode: 'add',
      token: grummanToken(g, 'robbery').id,
      territory: 'arrakeen',
    },
    { event, mode: 'add', token, territory: 'carthag' },
    { event, mode: 'remove', token: grummanToken(g, 'robbery').id },
    { event, decline: true, token },
  ])
    grummanReject(g, 'm', { type: 'decision', ...action });
  grummanReject(g, 'a', {
    type: 'decision',
    event,
    mode: 'add',
    token,
    territory: 'arrakeen',
  });
  for (const id of ['a', 'g']) {
    const view = viewGame(g, id);
    assert.deepEqual(view.grummanCollection!.tokens, []);
    assert.deepEqual(view.grummanCollection!.destinations, []);
    assert.deepEqual(grummanCollectionActions(view), []);
    assert.ok(view.moritaniTerror!.tokens.every((t) => !('kind' in t)));
  }
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(g, 'm');
    view.players.find((p) => p.id === 'm')!.bot = profile;
    assert.deepEqual(botActions(view), grummanCollectionActions(view));
    const played = applyAction(grummanReload(g), 'm', botActions(view)[0]);
    assert.equal(grummanPlayer(played, 'm').spice, 24);
    stable(played);
  }
});

void test('Collection addition preserves the separate actual Mentat placement and its Karama response', () => {
  const initial = grummanCollectionFixture();
  holdGrummanCard(initial, 'a', 'karama');
  let g = mentat(addGrummanToken(enterGrummanCollection(initial)));
  const token = grummanToken(g, 'assassination').id;
  g = decide(g, { token, territory: 'carthag' });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  assert.equal(grummanToken(g, 'assassination').status, 'available');
  for (let n = 0; g.response && n < 8; n++) {
    const responder = g.players.find(
      (p) => !g.response!.passed.includes(p.id),
    )!;
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  assert.equal(grummanToken(g, 'assassination').location, 'carthag');
  assert.equal(g.moritaniTerror!.placementTurn, 2);
  assert.equal(grummanPlayer(g, 'm').spice, 24);
  assert.equal(g.grummanCollection?.outcome, 'add');
  stable(g);
});

void test('actual stacked entry privately selects either Robbery or Sabotage and consumes only the selected token', () => {
  for (const kind of ['robbery', 'sabotage'] as const) {
    const initial = grummanCollectionFixture();
    const shield = holdGrummanCard(initial, 'a', 'shield');
    holdGrummanCard(initial, 'm', 'worthless');
    const collection = addGrummanToken(enterGrummanCollection(initial));
    let g = enterGrummanStack(stageGrummanArrival(collection));
    assert.equal(g.pendingTerrorEntry?.stage, 'select');
    assert.equal(g.pendingTerrorEntry?.amount, 1);
    assert.equal(grummanPlayer(g, 'a').reserves, 19);
    assert.equal(grummanPlayer(g, 'a').spice, 19);
    const owned = viewGame(g, 'm').terrorEntry!;
    assert.equal(owned.kind, undefined);
    assert.equal(owned.candidates?.length, 2);
    for (const id of ['a', 'g']) {
      assert.equal(viewGame(g, id).terrorEntry?.candidates, undefined);
      assert.equal(viewGame(g, id).terrorEntry?.kind, undefined);
    }
    stable(g);
    grummanReject(g, 'm', { type: 'decision', reveal: true }, /Choose one/);
    grummanReject(
      g,
      'm',
      { type: 'decision', token: grummanToken(g, 'atomics').id },
      /original stacked/,
    );
    const allHidden = decide(g, { decline: true });
    assert.equal(allHidden.pendingTerrorEntry, null);
    assert.deepEqual(allHidden.moritaniTerror, g.moritaniTerror);
    const token = grummanToken(g, kind).id;
    const others = g.moritaniTerror!.tokens.filter((t) => t.id !== token);
    g = decide(g, { token });
    assert.equal(g.pendingTerrorEntry?.stage, 'offer');
    assert.equal(viewGame(g, 'm').terrorEntry?.kind, kind);
    stable(g);
    g = decide(g, { reveal: true });
    if (kind === 'robbery') g = decide(g, { choice: 'spice' });
    else {
      assert.equal(g.pendingTerrorEntry?.stage, 'gift');
      g = decide(g, { decline: true });
    }
    assert.equal(g.pendingTerrorEntry, null);
    assert.equal(grummanToken(g, kind).status, 'removed');
    assert.deepEqual(
      g.moritaniTerror!.tokens.filter((t) => t.id !== token),
      others,
    );
    assert.equal(grummanPlayer(g, 'a').forces['arrakeen:10'], 1);
    assert.equal(grummanPlayer(g, 'a').reserves, 19);
    assert.equal(grummanPlayer(g, 'm').spice, kind === 'robbery' ? 34 : 24);
    assert.equal(
      g.discard.filter((card) => card.id === shield.id).length,
      kind === 'sabotage' ? 1 : 0,
    );
    grummanReject(g, 'm', { type: 'decision', reveal: true });
    stable(g);
  }
});

void test('Karama cancellation restores the selected stacked alliance offer without changing the other hidden token', () => {
  const initial = grummanCollectionFixture();
  const card = holdGrummanCard(initial, 'a', 'karama');
  let g = enterGrummanStack(
    stageGrummanArrival(addGrummanToken(enterGrummanCollection(initial))),
  );
  const token = grummanToken(g, 'robbery').id;
  g = decide(g, { token });
  const others = structuredClone(g.moritaniTerror);
  g = decide(g, { alliance: true });
  assert.equal(g.response?.kind, 'moritaniAlliance');
  g = applyAction(grummanReload(g), 'a', {
    type: 'card',
    card: card.id,
    mode: 'cancel',
  });
  assert.equal(g.response, null);
  assert.equal(g.pendingTerrorEntry?.token, token);
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  assert.equal(viewGame(g, 'm').terrorEntry?.canOfferAlliance, false);
  assert.deepEqual(g.moritaniTerror, others);
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  stable(g);
  g = decide(g, { reveal: true });
  g = decide(g, { choice: 'spice' });
  assert.equal(grummanToken(g, 'sabotage').status, 'placed');
  assert.equal(grummanToken(g, 'robbery').status, 'removed');
  stable(g);
});

void test('signed collection and selected stack reject corrupted phase, completion, candidate or selection on reads and actions', () => {
  const collection = enterGrummanCollection(grummanCollectionFixture());
  const entry = decide(
    enterGrummanStack(stageGrummanArrival(addGrummanToken(collection))),
    { token: grummanToken(collection, 'sabotage').id },
  );
  for (const [source, corrupt] of [
    [
      collection,
      (g: Game) => {
        g.grummanCollection!.stage = 'complete';
      },
    ],
    [
      collection,
      (g: Game) => {
        g.grummanCollection!.turn++;
      },
    ],
    [
      collection,
      (g: Game) => {
        g.decision = null;
      },
    ],
    [
      entry,
      (g: Game) => {
        g.pendingTerrorEntry!.token = grummanToken(g, 'robbery').id;
      },
    ],
    [
      entry,
      (g: Game) => {
        g.pendingTerrorEntry!.candidates!.pop();
      },
    ],
  ] as const) {
    const g = grummanReload(source);
    corrupt(g);
    const before = grummanReload(g);
    for (const p of g.players)
      assert.throws(
        () => viewGame(g, p.id),
        /Grumman|Terror|original|selection/i,
      );
    assert.throws(
      () => normalizeAutomaticGame(g),
      /Grumman|Terror|original|selection/i,
    );
    grummanReject(g, 'm', {
      type: 'decision',
      event: g.grummanCollection?.event,
      decline: true,
    });
    assert.deepEqual(g, before);
  }
});
