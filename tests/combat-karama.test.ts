import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';

function fixture() {
  let g = createGame('COMBATK2', newPlayer('f', 'Fremen', 'fremen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'f', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  g.advanced = true;
  g.phase = 6;
  g.active = 'f';
  g.order = ['f', 'e', 'g'];
  g.storm = 18;
  for (const p of g.players) {
    p.forces = p.id === 'g' ? {} : { 'red_chasm:7': 3 };
    p.reserves = p.id === 'g' ? 20 : 17;
    p.spice = 10;
    p.hand = [];
    p.traitors = [];
  }
  g.players[0].elites = {
    reserves: 2,
    tanks: 0,
    forces: { 'red_chasm:7': 1 },
    revived: 0,
  };
  g.players[1].elites = {
    reserves: 4,
    tanks: 0,
    forces: { 'red_chasm:7': 1 },
    revived: 0,
  };
  g.players[2].hand = baseDeck().filter((c) => c.effect === 'karama');
  return g;
}
function choose(g: Game, target = 'e') {
  return applyAction(g, 'f', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target,
  });
}
function passWindow(state: Game) {
  let g = state;
  const kind = g.response!.kind;
  for (const p of g.players) {
    if (g.response?.kind !== kind) break;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response) g = passWindow(g);
  return g;
}
function cancel(g: Game) {
  return applyAction(g, 'g', {
    type: 'card',
    card: g.players[2].hand[0].id,
    mode: 'cancel',
  });
}
function plan(g: Game, dial: number, support = 0) {
  return applyAction(g, 'f', {
    type: 'battlePlan',
    dial,
    support,
    leader: 'fremen-0',
  });
}
function resolve(state: Game, traitor = false) {
  let g = applyAction(state, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-4',
  });
  g = applyAction(g, 'f', { type: 'traitorCall', call: traitor });
  return applyAction(g, 'e', { type: 'traitorCall', call: false });
}

void test('Fedaykin and free spice support require separate Karama cards; Sardaukar is already ordinary against Fremen', () => {
  let g = choose(fixture());
  assert.equal(g.response?.kind, 'eliteStrength');
  assert.equal(g.response?.owner, 'f');
  const before = structuredClone(g.players[0].elites);
  g = cancel(g);
  assert.equal(g.response?.kind, 'fremenSupport');
  assert.deepEqual(g.battle!.eliteBlocked, ['f']);
  assert.equal(g.battle!.fremenSupportBlocked, undefined);
  g = cancel(g);
  assert.equal(g.response, null);
  assert.equal(g.players[2].hand.length, 0);
  assert.equal(g.battle!.fremenSupportBlocked, true);
  assert.deepEqual(g.players[0].elites, before);
  assert.equal(viewGame(g, 'e').battle!.fremenSupportBlocked, true);
  assert.deepEqual(viewGame(g, 'g').battle!.eliteBlocked, ['f']);
  assert.throws(() => plan(g, 4, 3), /legal force commitment/);
  assert.equal(plan(g, 3, 3).battle!.plans.f.dial, 3);
});
void test('canceling elite strength alone retains Fremen free support and elite token identity in casualties', () => {
  let g = allow(cancel(choose(fixture())));
  assert.throws(() => plan(g, 4), /legal force commitment/);
  g = resolve(plan(g, 3));
  assert.equal(g.players[0].spice, 10);
  if (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'f', { type: 'decision', choice: 0 });
  assert.equal(g.players[0].tanks, 3);
  assert.equal(g.players[0].elites!.tanks, 1);
  assert.equal(g.players[0].elites!.reserves, 2);
});
void test('canceling free support alone keeps Fedaykin doubled, supports half-strength dials and reserves payment privately', () => {
  let g = cancel(passWindow(choose(fixture())));
  assert.deepEqual(g.battle!.eliteBlocked ?? [], []);
  assert.throws(() => plan(g, 4), /legal force commitment/);
  assert.equal(plan(g, 1.5).battle!.plans.f.support, 0);
  g = plan(g, 4, 3);
  assert.equal(viewGame(g, 'e').battle!.plans.f, undefined);
  assert.equal(viewGame(g, 'f').battle!.plans.f.support, 3);
  assert.equal(g.players[0].spice, 10);
  g = resolve(g);
  assert.equal(g.players[0].spice, 7);
});
void test('a traitor winner avoids spice payment even when free support was canceled', () => {
  let g = fixture();
  g.players[0].traitors = ['emperor-4'];
  g = cancel(passWindow(choose(g)));
  g = resolve(plan(g, 4, 3), true);
  assert.equal(g.players[0].spice, 12); // traitor leader bounty
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[0].elites!.forces['red_chasm:7'], 1);
});
void test('combat power responses reject own-power cancellation and premature plans atomically', () => {
  let g = choose(fixture());
  g.players[0].hand = [g.players[2].hand.pop()!];
  const before = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'f', {
        type: 'card',
        card: g.players[0].hand[0].id,
        mode: 'cancel',
      }),
    /another faction/,
  );
  assert.throws(() => plan(g, 0), /response window/);
  assert.deepEqual(g, before);
  g = allow(g);
  assert.equal(plan(g, 4).battle!.plans.f.dial, 4);
  const settled = structuredClone(g);
  assert.throws(() => plan(g, 4, 1), /legal force commitment/);
  assert.deepEqual(g, settled);
});
void test('cancellation expires after its battle and new combat receives fresh power windows', () => {
  let g = cancel(cancel(choose(fixture())));
  g = resolve(plan(g, 0));
  while (g.decision) {
    const d = g.decision;
    g = applyAction(
      g,
      d.player,
      d.kind === 'battleLosses'
        ? { type: 'decision', choice: 0 }
        : { type: 'decision', discard: [] },
    );
  }
  g.phase = 6;
  g.active = 'f';
  g.players[1].forces = { 'red_chasm:7': 3 };
  g.players[1].tanks = 0;
  g.players[1].elites = {
    reserves: 4,
    tanks: 0,
    forces: { 'red_chasm:7': 1 },
    revived: 0,
  };
  g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  g = choose(g);
  assert.equal(g.response?.kind, 'eliteStrength');
  assert.deepEqual(g.battle!.eliteBlocked ?? [], []);
  assert.equal(g.battle!.fremenSupportBlocked ?? false, false);
  assert.equal(plan(allow(g), 4).battle!.plans.f.dial, 4);
});
void test('Emperor elite cancellation reduces Sardaukar against other factions without removing elite tokens', () => {
  let g = fixture();
  g.players[0].forces = {};
  g.players[2].forces = { 'red_chasm:7': 3 };
  g.active = 'e';
  g = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'g',
  });
  assert.equal(g.response?.kind, 'eliteStrength');
  assert.equal(g.response?.owner, 'e');
  g = cancel(g);
  const action = {
    type: 'battlePlan',
    leader: 'emperor-0',
    dial: 4,
    support: 3,
  };
  assert.throws(() => applyAction(g, 'e', action), /legal force commitment/);
  assert.equal(
    applyAction(g, 'e', { ...action, dial: 3 }).battle!.plans.e.dial,
    3,
  );
  assert.equal(g.players[1].elites!.forces['red_chasm:7'], 1);
});
void test('no elite response is offered without elite forces or in basic combat', () => {
  const g = fixture();
  g.players[0].elites!.forces = {};
  g.players[0].elites!.reserves = 3;
  assert.equal(choose(g).response?.kind, 'fremenSupport');
  g.advanced = false;
  assert.equal(choose(g).response, null);
});
