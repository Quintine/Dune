import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const casualtyEvents = (g: Game) =>
  g.log.filter((e) => e.automatic?.name === 'Battle casualties');
function fixture(winner: FactionId = 'guild') {
  const g = createGame('AUTOLOSS', newPlayer('w', 'Winner', winner));
  g.players.push(newPlayer('l', 'Loser', 'emperor'));
  g.status = 'playing';
  g.advanced = true;
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.active = 'w';
  g.order = ['w', 'l'];
  for (const p of g.players) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
    for (const leader of p.leaders) leader.strength = 0;
  }
  return g;
}
function pass(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 20; i++) {
    const responder =
      g.players.find(
        (p) => p.id !== g.response!.owner && !g.response!.passed.includes(p.id),
      ) ?? g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(responder);
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function fight(state: Game, dial = 2, support = 2) {
  let g = pass(
    applyAction(state, 'w', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'l',
    }),
  );
  for (let i = 0; g.battle?.preparation && i < 10; i++)
    g = pass(
      applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      }),
    );
  assert.equal(g.battle?.preparation ?? null, null);
  g = applyAction(g, 'w', {
    type: 'battlePlan',
    dial,
    support,
    leader: player(g, 'w').leaders[0].id,
    defense: player(g, 'w').hand[0]?.id,
  });
  g = applyAction(g, 'l', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: player(g, 'l').leaders[0].id,
    defense: player(g, 'l').hand[0]?.id,
  });
  g = applyAction(g, 'w', { type: 'traitorCall', call: false });
  return applyAction(g, 'l', { type: 'traitorCall', call: false });
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(p.spice >= 0);
    if (p.faction === 'ixians')
      assert.equal(
        p.elites!.reserves +
          p.elites!.tanks +
          Object.values(p.elites!.forces).reduce((a, b) => a + b, 0),
        7,
      );
  }
}
function giveCard(g: Game, id: string, kind: Card['kind']) {
  const card = baseDeck().find((c) => c.kind === kind)!;
  player(g, id).hand = [card];
  return card.id;
}

void test('sole ordinary advanced casualties settle before returning, conserve forces, and cannot replay after reload', () => {
  const initial = fixture();
  const before = structuredClone(initial);
  const g = fight(initial);
  assert.deepEqual(initial, before);
  assert.equal(g.battle, null);
  assert.notEqual(g.decision?.kind, 'battleLosses');
  assert.equal(player(g, 'w').forces['arrakeen:10'], 3);
  assert.equal(player(g, 'w').tanks, 2);
  // Two support spice were paid, then automatic Arrakeen collection paid two.
  assert.equal(player(g, 'w').spice, 20);
  assert.equal(player(g, 'l').tanks, 5);
  assert.equal(g.phase, 7);
  assert.deepEqual(
    casualtyEvents(g).map((e) => e.automatic),
    [{ faction: 'guild', name: 'Battle casualties' }],
  );
  conserved(g);
  const restored = reload(g);
  const snapshot = structuredClone(restored);
  assert.throws(() =>
    applyAction(restored, 'w', { type: 'decision', choice: 0 }),
  );
  assert.deepEqual(restored, snapshot);
  for (const p of restored.players) {
    const view = viewGame(restored, p.id);
    assert.equal(
      view.log.filter((e) => e.automatic?.name === 'Battle casualties').length,
      1,
    );
  }
  assert.deepEqual(restored, snapshot);
});

void test('multiple physical casualty mixtures still require the winner to choose', () => {
  const initial = fixture('fremen');
  player(initial, 'w').elites = {
    reserves: 2,
    tanks: 0,
    forces: { 'arrakeen:10': 1 },
    revived: 0,
  };
  const g = fight(initial, 2, 0);
  assert.equal(g.decision?.kind, 'battleLosses');
  if (g.decision?.kind !== 'battleLosses')
    throw Error('Missing casualty choice');
  assert.ok(g.decision.options.length > 1);
  assert.ok(g.decision.options.some((c) => c.normal === 2 && c.elite === 0));
  assert.ok(g.decision.options.some((c) => c.normal === 0 && c.elite === 1));
  assert.equal(player(g, 'w').tanks, 0);
  assert.equal(player(g, 'w').forces['arrakeen:10'], 5);
  assert.equal(casualtyEvents(g).length, 0);
  conserved(g);
});

void test('sole Ixian cyborg casualty preserves optional substitution and exact typed custody', () => {
  const initial = fixture('ixians');
  player(initial, 'w').forces = { 'arrakeen:10': 3 };
  player(initial, 'w').reserves = 17;
  player(initial, 'w').elites = {
    reserves: 6,
    tanks: 0,
    forces: { 'arrakeen:10': 1 },
    revived: 0,
  };
  const g = fight(initial, 2, 1);
  assert.equal(g.decision?.kind, 'ixSubstitution');
  assert.equal(player(g, 'w').tanks, 1);
  assert.equal(player(g, 'w').elites!.tanks, 1);
  assert.equal(player(g, 'w').forces['arrakeen:10'], 2);
  assert.equal(casualtyEvents(g).length, 1);
  conserved(g);
  const declined = applyAction(reload(g), 'w', {
    type: 'decision',
    decline: true,
  });
  assert.equal(player(declined, 'w').elites!.tanks, 1);
  assert.equal(declined.phase, 7);
  const accepted = pass(
    applyAction(reload(g), 'w', {
      type: 'decision',
      sources: { 'arrakeen:10': 1 },
      recover: { 'arrakeen:10': 1 },
    }),
  );
  assert.equal(player(accepted, 'w').tanks, 1);
  assert.equal(player(accepted, 'w').elites!.tanks, 0);
  assert.equal(player(accepted, 'w').elites!.forces['arrakeen:10'], 1);
  assert.equal(accepted.phase, 7);
  assert.equal(casualtyEvents(accepted).length, 1);
  conserved(declined);
  conserved(accepted);
});

void test('automatic casualty settlement still pauses for winner played-card retention', () => {
  const initial = fixture();
  const shield = giveCard(initial, 'w', 'shield');
  const g = fight(initial);
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(player(g, 'w').tanks, 2);
  assert.ok(player(g, 'w').hand.some((c) => c.id === shield));
  const kept = applyAction(reload(g), 'w', { type: 'decision', discard: [] });
  assert.ok(player(kept, 'w').hand.some((c) => c.id === shield));
  assert.equal(kept.phase, 7);
  assert.equal(casualtyEvents(kept).length, 1);
  conserved(kept);
});

void test('winner cleanup after automatic casualties still continues to Moritani ally retention', () => {
  const initial = fixture();
  const m = newPlayer('m', 'Moritani', 'moritani');
  initial.players.push(m);
  initial.order.push(m.id);
  m.ally = 'l';
  player(initial, 'l').ally = m.id;
  const shield = giveCard(initial, 'w', 'shield');
  const snooper = giveCard(initial, 'l', 'snooper');
  let g = fight(initial);
  assert.equal(g.decision?.kind, 'battleCards');
  assert.ok(g.moritaniRetention);
  g = applyAction(reload(g), 'w', { type: 'decision', discard: [shield] });
  assert.equal(g.decision?.kind, 'moritaniRetention');
  assert.ok(player(g, 'l').hand.some((c) => c.id === snooper));
  g = pass(applyAction(reload(g), 'l', { type: 'decision', keep: snooper }));
  assert.equal(g.moritaniRetention, null);
  assert.equal(g.phase, 7);
  assert.equal(g.discard.filter((c) => c.id === shield).length, 1);
  assert.ok(player(g, 'l').hand.some((c) => c.id === snooper));
  assert.equal(player(g, 'w').tanks, 2);
  assert.equal(casualtyEvents(g).length, 1);
  conserved(g);
});
