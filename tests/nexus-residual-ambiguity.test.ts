import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  nexusInspectionFixture,
  inspectionNative,
  inspectionInventory,
} from './fixture-nexus-inspection';
import { nexusAllow, nexusPlayer, nexusReload } from './fixture-nexus-cards';

const residual = 'richese-residual-poison';
function inventory(g: Game): string[] {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
}
function answeredCunning(): Game {
  let g = inspectionNative(
    nexusInspectionFixture(false, 'a', { richese: true }),
    'dial',
    0,
  );
  // Conserved acquisition seam: move the canonical Residual from the cache
  // initialized by the genuine Richese setup. No purchase is claimed here.
  assert.ok(g.richeseCache);
  const index = g.richeseCache.findIndex((c) => c.id === residual);
  nexusPlayer(g, 'a').hand.push(g.richeseCache.splice(index, 1)[0]);
  assert.equal(viewGame(g, 'a').residualPoison!.blocked, null);
  g = nexusAllow(
    applyAction(g, 'a', {
      type: 'nexusAtreides',
      event: g.battle!.event,
      mode: 'cunning',
      field: 'weapon',
    }),
  );
  g = applyAction(g, 'h', {
    type: 'nexusPrescienceAnswer',
    event: g.battle!.event,
    value: null,
  });
  assert.equal(g.battle!.nexusInspection!.stage, 'answered');
  assert.equal(g.battle!.nexusInspection!.mode, 'cunning');
  inspectionInventory(g);
  return g;
}

void test('answered Cunning publicly blocks Residual independently of hidden funding or Ghola, before RNG or mutation', (t) => {
  const original = answeredCunning();
  assert.deepEqual(
    inventory(original),
    [...baseDeck(), ...richeseCards()].map((c) => c.id).sort(),
  );
  const reasons: string[] = [];
  for (const hasGhola of [false, true]) {
    const g = nexusReload(original),
      target = nexusPlayer(g, 'h');
    const index = g.deck.findIndex((c) =>
      hasGhola ? c.effect === 'ghola' : c.kind === 'projectile',
    );
    assert.ok(index >= 0);
    target.hand.push(g.deck.splice(index, 1)[0]);
    target.spice = hasGhola ? 0 : 20;
    const before = nexusReload(g),
      beforeCards = inventory(g);
    const reason = viewGame(g, 'a').residualPoison!.blocked;
    assert.ok(reason);
    assert.match(reason, /two inspected elements.*ruling/i);
    reasons.push(reason);
    for (const p of g.players) assert.doesNotThrow(() => viewGame(g, p.id));
    assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
    let randomCalls = 0;
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      randomCalls++;
      throw Error('Rejected action must not draw a victim');
    });
    try {
      assert.throws(
        () =>
          applyAction(g, 'a', {
            type: 'card',
            card: residual,
            target: 'h',
            event: g.battle!.event,
          }),
        /two inspected elements.*ruling/i,
      );
    } finally {
      random.mock.restore();
    }
    assert.equal(randomCalls, 0);
    assert.deepEqual(g, before);
    assert.deepEqual(inventory(g), beforeCards);
    assert.equal(
      nexusPlayer(g, 'a').hand.filter((c) => c.id === residual).length,
      1,
    );
    assert.equal(g.battle!.prescience!.value, 0);
    assert.deepEqual(g.battle!.nexusInspection!.answers, [null]);
  }
  assert.equal(reasons[0], reasons[1]);
});
