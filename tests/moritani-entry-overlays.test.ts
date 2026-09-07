import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function entered(remainingRide: boolean) {
  const g = createGame('OVERLAY1', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('f', 'Fremen', 'fremen'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    advanced: true,
    phase: 1,
    turn: 2,
    storm: 18,
    order: ['f', 'm', 'a'],
    nexus: true,
    active: null,
  });
  g.deck = baseDeck();
  const fremen = g.players[1];
  fremen.forces = {
    'imperial_basin:10': 3,
    ...(remainingRide ? { 'hagga_basin:11': 1 } : {}),
  };
  fremen.reserves = remainingRide ? 16 : 17;
  hold(g, 'f', 'Karama');
  g.moritaniTerror = createTerrorState(() => 0);
  g.moritaniTerror = placeTerror(
    g.moritaniTerror,
    g.moritaniTerror.tokens.find((t) => t.kind === 'robbery')!.id,
    'arrakeen',
    1,
  );
  g.decision = { kind: 'wormRide', player: 'f', territory: 'imperial_basin' };
  g.wormRides = remainingRide ? ['hagga_basin'] : [];
  return applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  });
}
function summon(g: Game) {
  const card = g.players[1].hand.find((c) => c.effect === 'karama')!.id;
  return applyAction(g, 'f', {
    type: 'card',
    mode: 'special',
    card,
    territory: 'broken_land',
  });
}
function passNexus(state: Game) {
  let g = state;
  for (const p of state.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

for (const remaining of [true, false]) {
  void test(`summoned worm during Terror opens its Nexus before ${remaining ? 'the remaining ride' : 'advancing the phase'}`, () => {
    let g = entered(remaining);
    const custody = structuredClone(g.players[1].forces);
    const pending = structuredClone(g.pendingTerrorEntry);
    g = summon(g);
    assert.equal(g.summonedWorm, null);
    assert.deepEqual(g.pendingTerrorEntry, pending);
    assert.equal(g.summonedNexusBeforeRides, true);
    g = applyAction(reload(g), 'm', { type: 'decision', decline: true });
    assert.equal(g.phase, 1);
    assert.equal(g.nexus, true);
    assert.equal(g.decision, null);
    assert.equal(g.pendingTerrorEntry, null);
    assert.equal(g.summonedNexusBeforeRides, false);
    assert.deepEqual(g.ready, []);
    assert.deepEqual(g.players[1].forces, custody);
    assert.ok(g.players[1].specialKaramaUsed);
    assert.equal(g.discard.filter((c) => c.effect === 'karama').length, 1);
    // A negotiation action must now be available, rather than blocked by a pending ride.
    g = applyAction(g, 'f', { type: 'alliance', target: 'a' });
    g = passNexus(g);
    if (remaining) {
      assert.deepEqual(g.decision, {
        kind: 'wormRide',
        player: 'f',
        territory: 'hagga_basin',
      });
      assert.deepEqual(g.wormRides, []);
    } else {
      assert.equal(g.phase, 2);
      assert.equal(g.nexus, false);
    }
    assert.deepEqual(g.players[1].forces, custody);
  });
}

void test('Truthtrance consuming Robbery overflow finishes Terror but still opens the deferred summoned Nexus', () => {
  let g = entered(true);
  const truth = hold(g, 'm', 'Truthtrance');
  hold(g, 'a', 'Shield');
  g.players[0].hand.push(...g.deck.splice(0, 3));
  g = summon(g);
  g = applyAction(g, 'm', { type: 'decision', reveal: true });
  g = applyAction(g, 'm', { type: 'decision', choice: 'card' });
  assert.equal(g.pendingTerrorEntry?.stage, 'discard');
  assert.equal(g.players[0].hand.length, 5);
  const cardsAfterDraw = g.deck.length;
  g = applyAction(g, 'm', { type: 'card', card: truth });
  for (const id of ['f', 'a']) g = applyAction(g, id, { type: 'truthPass' });
  g = applyAction(g, 'm', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'a',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(reload(g), 'a', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.truthtrance, null);
  assert.equal(g.players[0].hand.length, 4);
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.decision, null);
  assert.equal(g.nexus, true);
  assert.equal(g.phase, 1);
  assert.deepEqual(g.wormRides, ['hagga_basin']);
  assert.equal(g.deck.length, cardsAfterDraw);
  assert.equal(g.discard.filter((c) => c.id === truth).length, 1);
  assert.equal(
    g.moritaniTerror!.tokens.filter((t) => t.status === 'removed').length,
    1,
  );
  g = passNexus(g);
  assert.deepEqual(g.decision, {
    kind: 'wormRide',
    player: 'f',
    territory: 'hagga_basin',
  });
});
