import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { faction } from '../game/catalog';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function setup() {
  const g = createGame('MORITANI', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.status = 'setup';
  g.order = ['m', 'a', 'e'];
  g.moritaniTerror = createTerrorState(() => 0.4);
  for (const p of g.players) {
    p.spice = faction(p.faction).spice;
    p.traitors = [p.leaders[0].id];
  }
  g.players[1].traitors = [];
  g.players[1].traitorChoices = [g.players[1].leaders[0].id];
  return g;
}
function lastSetup(g = setup()) {
  return applyAction(g, 'a', {
    type: 'traitor',
    leader: g.players[1].traitorChoices[0],
  });
}
function playing(choam = false) {
  const g = setup();
  g.status = 'playing';
  g.phase = 7;
  g.players[1].traitors = [g.players[1].leaders[0].id];
  g.players[1].traitorChoices = [];
  g.players[0].reserves = 14;
  g.players[0].forces = { 'polar_sink:0': 6 };
  if (choam) {
    const p = newPlayer('c', 'CHOAM', 'choam');
    g.players.push(p);
    g.order.push(p.id);
  }
  return g;
}
function mentat(state = playing()) {
  let g = state;
  for (const p of state.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.decision?.kind === 'choamMarket')
    g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.phase, 8);
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 12; i++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function declare(
  g: Game,
  token = g.moritaniTerror!.tokens[0].id,
  territory = 'arrakeen',
) {
  return applyAction(g, 'm', { type: 'decision', token, territory });
}

void test('Moritani waits for other setup choices and then places exactly six with fourteen reserves and twelve spice', () => {
  const initial = setup();
  reject(initial, 'm', { type: 'decision', territory: 'arrakeen', sector: 10 });
  const ready = lastSetup(initial);
  assert.deepEqual(ready.decision, { kind: 'moritaniSetup', player: 'm' });
  assert.equal(ready.status, 'setup');
  const g = applyAction(ready, 'm', {
    type: 'decision',
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.status, 'playing');
  assert.equal(g.players[0].forces['arrakeen:10'], 6);
  assert.equal(g.players[0].reserves, 14);
  assert.equal(g.players[0].spice, 12);
  assert.equal(g.players[0].tanks, 0);
  assert.deepEqual(g.moritaniTerror, initial.moritaniTerror);
  reject(g, 'm', { type: 'decision', territory: 'carthag', sector: 11 });
});

void test('BG starting choices delay Moritani and advisors make the entire territory occupied', () => {
  const initial = setup();
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  bg.traitors = [bg.leaders[0].id];
  bg.prediction = { faction: 'moritani', turn: 2 };
  initial.players.push(bg);
  initial.order.push(bg.id);
  initial.advanced = true;
  let g = lastSetup(initial);
  assert.equal(g.decision, null);
  g = applyAction(g, 'b', {
    type: 'advisorSetup',
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.decision?.kind, 'moritaniSetup');
  // Persist an advisor stance with an opponent in the territory, as an advanced table can contain.
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.players[1].reserves = 19;
  g.players[3].advisors = { arrakeen: {} };
  reject(g, 'm', { type: 'decision', territory: 'arrakeen', sector: 10 });
  // Advisors alone still count as occupancy, irrespective of automatic stance cleanup.
  g.players[1].forces = {};
  g.players[1].reserves = 20;
  reject(g, 'm', { type: 'decision', territory: 'arrakeen', sector: 10 });
});

void test('setup validates printed sectors but does not impose shipment storm restrictions', () => {
  const g = lastSetup();
  for (const [territory, sector] of [
    ['arrakeen', 8],
    ['mobile_stronghold', 0],
    ['unknown', 1],
    ['arrakeen', '10'],
  ])
    reject(g, 'm', { type: 'decision', territory, sector });
  g.storm = 10;
  const placed = applyAction(g, 'm', {
    type: 'decision',
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(placed.players[0].forces['arrakeen:10'], 6);
});

void test('Mentat placement precedes victory and finishing the opportunity performs the deferred check', () => {
  const g = playing();
  g.players[1].forces = {
    'arrakeen:10': 1,
    'carthag:11': 1,
    'tueks_sietch:5': 1,
  };
  g.players[1].reserves = 17;
  const opened = mentat(g);
  assert.equal(opened.status, 'playing');
  assert.deepEqual(opened.winner, []);
  assert.equal(viewGame(opened, 'a').mentatVictoryPending, true);
  const done = applyAction(opened, 'm', { type: 'decision', decline: true });
  assert.equal(done.status, 'finished');
  assert.deepEqual(done.winner, ['a']);
  assert.equal(done.moritaniTerror!.placementTurn, done.turn);
});

void test('hidden declarations keep custody and public response identical for different secret tokens', () => {
  const initial = mentat();
  initial.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const first = declare(initial, initial.moritaniTerror!.tokens[0].id);
  const second = declare(initial, initial.moritaniTerror!.tokens[1].id);
  assert.deepEqual(first.moritaniTerror, initial.moritaniTerror);
  assert.deepEqual(first.response, {
    kind: 'moritaniPlacement',
    owner: 'm',
    passed: [],
  });
  assert.deepEqual(viewGame(first, 'a'), viewGame(second, 'a'));
  assert.equal(viewGame(first, 'm').moritaniTerror!.tokens.length, 6);
  assert.deepEqual(viewGame(first, 'a').moritaniTerror!.tokens, []);
  assert.equal(viewGame(first, 'a').moritaniPendingPlacement, null);
  assert.deepEqual(
    viewGame(JSON.parse(JSON.stringify(first)), 'm').moritaniPendingPlacement,
    first.pendingMoritaniPlacement,
  );
  const g = allow(JSON.parse(JSON.stringify(first)));
  assert.equal(g.moritaniTerror!.tokens[0].location, 'arrakeen');
  assert.equal(g.moritaniTerror!.placementTurn, g.turn);
  assert.equal(g.pendingMoritaniPlacement, null);
  const publicToken = viewGame(g, 'a').moritaniTerror!.tokens[0];
  assert.equal(publicToken.location, 'arrakeen');
  assert.equal('kind' in publicToken, false);
  assert.equal(
    g.moritaniTerror!.tokens.filter((t) => t.status === 'available').length,
    5,
  );
  reject(g, 'm', {
    type: 'decision',
    token: g.moritaniTerror!.tokens[1].id,
    territory: 'carthag',
  });
});

void test('Karama prevents relocation without moving the hidden token and consumes this turn’s opportunity', () => {
  let g = playing();
  g.turn = 2;
  const id = g.moritaniTerror!.tokens[0].id;
  g.moritaniTerror = placeTerror(g.moritaniTerror!, id, 'carthag', 1);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = declare(mentat(g), id, 'arrakeen');
  const originalTokens = structuredClone(g.moritaniTerror!.tokens);
  g = applyAction(g, 'a', { type: 'card', mode: 'cancel', card: karama.id });
  assert.deepEqual(g.moritaniTerror!.tokens, originalTokens);
  assert.equal(g.moritaniTerror!.placementTurn, 2);
  assert.equal(g.pendingMoritaniPlacement, null);
  assert.equal(g.response, null);
  assert.ok(g.discard.some((c) => c.id === karama.id));
  reject(g, 'm', { type: 'decision', token: id, territory: 'arrakeen' });
});

void test('a later Mentat opportunity relocates the same token into storm without duplicating it', () => {
  const initial = playing();
  initial.turn = 2;
  initial.storm = 10;
  const id = initial.moritaniTerror!.tokens[0].id;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror!,
    id,
    'carthag',
    1,
  );
  const g = allow(declare(mentat(initial), id, 'arrakeen'));
  assert.equal(g.moritaniTerror!.placementTurn, 2);
  assert.equal(g.moritaniTerror!.tokens.length, 6);
  assert.equal(
    g.moritaniTerror!.tokens.filter((t) => t.status === 'placed').length,
    1,
  );
  assert.deepEqual(
    g.moritaniTerror!.tokens.find((t) => t.id === id),
    {
      ...initial.moritaniTerror!.tokens[0],
      location: 'arrakeen',
    },
  );
  assert.equal(
    g.moritaniTerror!.tokens.some((t) => t.location === 'carthag'),
    false,
  );
  assert.deepEqual(g.players, initial.players);
});

void test('declining survives reload, invalid placements are atomic and stale pending settlement cannot commit', () => {
  const opened = mentat();
  for (const territory of ['polar_sink', 'mobile_stronghold', 'homeworld'])
    reject(opened, 'm', {
      type: 'decision',
      token: opened.moritaniTerror!.tokens[0].id,
      territory,
    });
  reject(opened, 'a', { type: 'decision', decline: true });
  const declined = JSON.parse(
    JSON.stringify(
      applyAction(opened, 'm', { type: 'decision', decline: true }),
    ),
  ) as Game;
  assert.equal(declined.moritaniTerror!.placementTurn, declined.turn);
  assert.equal(declined.decision, null);
  reject(declined, 'm', {
    type: 'decision',
    token: declined.moritaniTerror!.tokens[0].id,
    territory: 'arrakeen',
  });
  opened.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const stale = declare(opened);
  stale.pendingMoritaniPlacement!.turn--;
  stale.response!.passed = ['a', 'e'];
  reject(stale, 'm', { type: 'passResponse' });
});

void test('CHOAM retains its closing market and Mentat opportunity after Moritani completes placement', () => {
  let g = mentat(playing(true));
  g = applyAction(g, 'm', { type: 'decision', decline: true });
  assert.equal(g.phase, 8);
  assert.equal(g.status, 'playing');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.decision?.kind, 'choamMentat');
  assert.equal(g.phase, 8);
  g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 0);
  assert.equal(g.moritaniTerror!.placementTurn, 1);
});

void test('all four AI profiles provide legal Moritani setup and placement choices', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const state of [lastSetup(), mentat()]) {
      state.players[0].bot = difficulty;
      const actions = botActions(viewGame(state, 'm'));
      assert.ok(actions.length > 0, difficulty + ':' + state.decision?.kind);
      for (const action of actions)
        assert.doesNotThrow(() => applyAction(state, 'm', action));
    }
  }
});
