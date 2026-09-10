import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import {
  nexusGuildCunningFixture,
  originalGuildCunningTurn,
  nexusGuildCunningRequest,
  holdGuildCunningCard,
  nexusGuildCunningAllow,
  nexusGuildCunningInventory,
  nexusGuildCunningReload,
} from './fixture-nexus-guild-cunning';

function stable(g: Game) {
  nexusGuildCunningInventory(g);
  for (const p of g.players)
    assert.deepEqual(
      viewGame(nexusGuildCunningReload(g), p.id),
      viewGame(g, p.id),
    );
  assert.deepEqual(normalizeAutomaticGame(nexusGuildCunningReload(g)), g);
}
function nested() {
  const f = nexusGuildCunningFixture({
    advanced: true,
    opponentFaction: 'beneGesserit',
  });
  const worthless = holdGuildCunningCard(f.g, f.target, 'worthless');
  const karama = holdGuildCunningCard(f.g, f.observer, 'karama');
  let g = originalGuildCunningTurn(f, false);
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(g, f.target, { type: 'decision', accept: false });
  g = applyAction(g, f.owner, {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'hagga_basin',
    sector: 12,
    amount: 5,
  });
  const original = nexusGuildCunningReload(g);
  g = applyAction(g, f.owner, nexusGuildCunningRequest(f, g));
  assert.equal(g.response?.kind, 'nexusGuildCunning');
  const response = structuredClone(g.response);
  g = applyAction(g, f.target, {
    type: 'card',
    card: worthless.id,
    mode: 'cancel',
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  if (g.pendingKarama?.use.kind === 'cancel')
    assert.deepEqual(g.pendingKarama.use.response, response);
  assert.equal(g.discard.filter((c) => c.id === worthless.id).length, 1);
  stable(g);
  return { f, g, original, worthless, karama };
}

void test('Guild Cunning survives an actual paid BG Worthless cancellation and its printed Karama counter with exact original movement and custody', () => {
  for (const counter of [false, true]) {
    const { f, original, worthless, karama, g: pending } = nested();
    let g = counter
      ? applyAction(nexusGuildCunningReload(pending), f.observer, {
          type: 'card',
          card: karama.id,
          mode: 'cancel',
        })
      : nexusGuildCunningAllow(nexusGuildCunningReload(pending));
    assert.equal(
      g.nexusGuildCunningHistory!.at(-1)!.stage,
      counter ? 'secondShipment' : 'canceled',
    );
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((c) => c === 'guild').length,
      1,
    );
    assert.deepEqual(g.players[0].forces, original.players[0].forces);
    assert.equal(g.players[0].spice, original.players[0].spice);
    assert.equal(g.players[0].moved, 1);
    assert.equal(g.players[0].shipped, true);
    assert.equal(g.discard.filter((c) => c.id === worthless.id).length, 1);
    assert.equal(
      g.discard.filter((c) => c.id === karama.id).length,
      counter ? 1 : 0,
    );
    assert.equal(g.pendingKarama, null);
    assert.equal(g.active === f.owner, counter);
    assert.equal(g.movementRemaining!.includes(f.owner), counter);
    stable(g);
    if (counter) {
      g = applyAction(g, f.owner, {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 2,
      });
      if (g.decision?.kind === 'guildShipment')
        g = applyAction(g, f.owner, { type: 'decision', allow: true });
      if (g.decision?.kind === 'advisor')
        g = applyAction(g, f.target, { type: 'decision', accept: false });
      g = nexusGuildCunningAllow(g);
      assert.equal(g.players[0].forces['carthag:11'], 2);
      assert.equal(g.players[0].spice, original.players[0].spice - 1);
      assert.equal(g.nexusGuildCunningHistory!.at(-1)!.stage, 'extraMove');
      stable(g);
    }
  }
});

void test('nested Guild cancellation rejects altered parent, last marker and saved native source without mutation', () => {
  const { f, g: pending, karama } = nested();
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.nexusGuildCunningHistory![0].parent = '[]';
    },
    (g) => {
      g.nexusGuildCunningLast!.stage = 'secondShipment';
    },
    (g) => {
      delete g.nexusGuildCunningLast;
    },
    (g) => {
      delete g.nexusGuildCunningHistory;
    },
    (g) => {
      if (g.pendingKarama!.use.kind === 'cancel')
        g.pendingKarama!.use.response.intent = 'old';
    },
    (g) => {
      if (g.pendingKarama!.use.kind === 'cancel')
        g.pendingKarama!.use.response.owner = f.observer;
    },
    (g) => {
      g.players[0].moved = 0;
    },
    (g) => {
      g.movementRemaining = g.movementRemaining!.filter((id) => id !== f.owner);
    },
  ];
  for (const change of changes) {
    const bad = nexusGuildCunningReload(pending);
    change(bad);
    const original = nexusGuildCunningReload(bad);
    for (const p of bad.players) assert.throws(() => viewGame(bad, p.id));
    assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() =>
      applyAction(bad, f.observer, {
        type: 'card',
        card: karama.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(bad, original);
  }
});
