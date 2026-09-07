import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { MOBILE_LOCATION } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, action: Action) =>
  applyAction(g, id, action);
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}
function forces(g: Game, id: string, groups: Record<string, number>) {
  const p = player(g, id);
  p.forces = groups;
  p.reserves = 20 - Object.values(groups).reduce((sum, n) => sum + n, 0);
}
function fixture(advanced = false) {
  const g = createGame('JUBBAT22', newPlayer('c', 'CHOAM', 'choam'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 0;
  g.turn = 2;
  g.storm = 5;
  g.stormPending = 3;
  g.order = ['c', 'e', 'b'];
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
  }
  g.deck = baseDeck();
  forces(g, 'c', { 'red_chasm:7': 4 });
  forces(g, 'e', { 'red_chasm:7': 3 });
  g.spice = { 'red_chasm:7': 8, 'gara_kulon:8': 6, 'basin:9': 4 };
  hold(g, 'c', 'Jubba Cloak');
  return g;
}
function begin(state: Game) {
  let g = state;
  for (const p of g.players) g = send(g, p.id, { type: 'ready' });
  return g;
}
function play(g: Game, territory = 'red_chasm', extra: Partial<Action> = {}) {
  return send(g, 'c', {
    type: 'card',
    mode: 'choam',
    card: player(g, 'c').hand.find((c) => c.name === 'Jubba Cloak')!.id,
    territory,
    ...extra,
  });
}
function contest(g: Game, id = 'e') {
  hold(g, id, 'Karama');
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 30; i++) {
    const p = g.players.find(
      (p) =>
        !viewGame(g, p.id).responseControls?.hasPassed &&
        !!viewGame(g, p.id).responseControls?.cancelCards.length,
    )!;
    g = send(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
const decline = (g: Game) => send(g, 'c', { type: 'decision', decline: true });
function conserve(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
      p.id,
    );
    assert.ok(Object.values(p.forces).every((n) => n > 0));
    if (p.elites) {
      for (const [key, n] of Object.entries(p.elites.forces))
        assert.ok(n >= 0 && n <= (p.forces[key] ?? 0));
    }
  }
}

void test('Jubba protects only CHOAM in one territory in basic and advanced games', () => {
  for (const advanced of [false, true]) {
    const initial = fixture(advanced);
    const card = player(initial, 'c').hand[0].id;
    const g = allow(play(begin(initial)));
    assert.equal(g.storm, 8);
    assert.equal(g.stormResolution, null);
    assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
    assert.equal(player(g, 'c').tanks, 0);
    assert.equal(player(g, 'e').forces['red_chasm:7'], undefined);
    assert.equal(player(g, 'e').tanks, 3);
    assert.equal(g.spice['red_chasm:7'], undefined);
    assert.equal(g.spice['gara_kulon:8'], undefined);
    assert.equal(g.spice['basin:9'], 4);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
    assert.equal(g.decision?.kind, 'choamMarket');
    conserve(g);
  }
});
void test('moving-storm decision and public projection do not reveal Jubba ownership', () => {
  const initial = fixture(),
    empty = structuredClone(initial);
  player(empty, 'c').hand = [];
  const g = begin(initial),
    h = begin(empty);
  assert.deepEqual(g.decision, h.decision);
  assert.deepEqual(g.decision, {
    kind: 'choamStorm',
    player: 'c',
    territories: [{ territory: 'red_chasm', amount: 4, sectors: [7] }],
    protected: [],
  });
  const view = viewGame(g, 'e');
  assert.equal(view.choamWorthless, null);
  assert.equal('stormResolution' in view, false);
  assert.equal('pendingChoamWorthless' in view, false);
  assert.deepEqual(JSON.parse(JSON.stringify(view)).decision, view.decision);
  assert.throws(
    () => send(g, 'e', { type: 'decision', decline: true }),
    /pending decision/,
  );
  assert.equal(player(g, 'c').tanks, 0);
  assert.equal(g.storm, 5);
});
void test('declining resumes exact casualties and cannot execute the storm twice', () => {
  const g = decline(begin(fixture()));
  assert.equal(player(g, 'c').tanks, 4);
  assert.equal(player(g, 'e').tanks, 3);
  assert.equal(g.storm, 8);
  assert.equal(g.stormResolution, null);
  assert.throws(() => decline(g));
  assert.equal(
    g.log.filter((entry) => entry.text.startsWith('Storm moved')).length,
    1,
  );
  conserve(g);
});
void test('Karama cancellation retains Jubba and reoffers a safe decline', () => {
  const initial = fixture();
  const card = hold(initial, 'e', 'Karama');
  let g = send(play(begin(initial)), 'e', {
    type: 'card',
    card,
    mode: 'cancel',
  });
  assert.equal(g.decision?.kind, 'choamStorm');
  assert.equal(player(g, 'c').hand.length, 1);
  assert.equal(viewGame(g, 'c').choamWorthless!.cards.length, 0);
  assert.throws(() => play(g), /blocked this phase/);
  g = decline(g);
  assert.equal(player(g, 'c').tanks, 4);
  assert.equal(g.stormResolution, null);
  conserve(g);
});
void test('one territory protects every crossed sector but not another territory', () => {
  const initial = fixture();
  forces(initial, 'c', {
    'the_minor_erg:6': 2,
    'the_minor_erg:7': 3,
    'the_minor_erg:8': 1,
    'red_chasm:7': 4,
  });
  let g = begin(initial);
  assert.equal(g.decision?.kind, 'choamStorm');
  if (g.decision?.kind === 'choamStorm')
    assert.deepEqual(
      g.decision.territories.find((t) => t.territory === 'the_minor_erg'),
      { territory: 'the_minor_erg', amount: 6, sectors: [6, 7, 8] },
    );
  g = allow(play(g, 'the_minor_erg'));
  assert.equal(g.decision?.kind, 'choamStorm');
  if (g.decision?.kind === 'choamStorm') {
    assert.deepEqual(g.decision.protected, ['the_minor_erg']);
    assert.deepEqual(
      g.decision.territories.map((t) => t.territory),
      ['red_chasm'],
    );
  }
  assert.equal(player(g, 'c').tanks, 0);
  g = decline(g);
  assert.deepEqual(player(g, 'c').forces, {
    'the_minor_erg:6': 2,
    'the_minor_erg:7': 3,
    'the_minor_erg:8': 1,
  });
  assert.equal(player(g, 'c').tanks, 4);
  conserve(g);
});
void test('cashing in the pending physical Jubba aborts its effect and resumes the original storm', () => {
  const initial = fixture(true);
  contest(initial);
  const card = hold(initial, 'c', 'Karama'),
    jubba = player(initial, 'c').hand[0].id;
  let g = play(begin(initial));
  g = send(g, 'c', { type: 'card', mode: 'special', card, cards: [jubba] });
  g = allow(g);
  assert.equal(g.decision?.kind, 'choamStorm');
  assert.deepEqual(g.stormResolution!.choamProtected ?? [], []);
  g = decline(g);
  assert.equal(player(g, 'c').tanks, 4);
  assert.equal(player(g, 'c').spice, 13);
  assert.equal(g.discard.filter((c) => c.id === jubba).length, 1);
  conserve(g);
});
void test('loss of threatened custody during a response does not spend Jubba', () => {
  let g = play(begin(contest(fixture())));
  forces(g, 'c', {});
  g = allow(g);
  assert.equal(player(g, 'c').hand.length, 1);
  assert.equal(g.stormResolution, null);
  assert.equal(g.storm, 8);
  conserve(g);
});
void test('BG Worthless conversion can cancel Jubba without losing its continuation', () => {
  const initial = fixture(true),
    card = hold(initial, 'b', 'Baliset');
  contest(initial);
  let g = send(play(begin(initial)), 'b', {
    type: 'card',
    mode: 'cancel',
    card,
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.decision?.kind, 'choamStorm');
  g = decline(g);
  assert.equal(player(g, 'c').tanks, 4);
  assert.equal(player(g, 'c').hand.length, 1);
  assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  conserve(g);
});
void test('countering BG conversion restores Jubba response and protection exactly once', () => {
  const initial = fixture(true),
    worthless = hold(initial, 'b', 'Baliset'),
    counter = hold(initial, 'e', 'Karama');
  hold(initial, 'b', 'Kulon');
  let g = send(play(begin(initial)), 'b', {
    type: 'card',
    mode: 'cancel',
    card: worthless,
  });
  g = send(g, 'e', { type: 'card', mode: 'cancel', card: counter });
  assert.equal(g.response?.kind, 'choamWorthless');
  g = allow(g);
  assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
  assert.equal(player(g, 'e').tanks, 3);
  assert.equal(g.pendingKarama, null);
  assert.equal(g.stormResolution, null);
  conserve(g);
});
void test('saved pending declaration resumes with equal private views and conserved forces', () => {
  const g = play(begin(contest(fixture(true)))),
    restored = JSON.parse(JSON.stringify(g)) as Game;
  for (const id of ['c', 'e', 'b'])
    assert.deepEqual(
      JSON.parse(JSON.stringify(viewGame(g, id))),
      JSON.parse(JSON.stringify(viewGame(restored, id))),
    );
  const a = allow(g),
    b = allow(restored);
  assert.deepEqual(a, b);
  conserve(a);
});
void test('safe terrain, hidden mobile stronghold and zero distance need no Jubba decision', () => {
  const initial = fixture();
  initial.storm = 8;
  initial.stormPending = 3;
  initial.mobileStronghold = { location: 'red_chasm:7' };
  forces(initial, 'c', {
    'imperial_basin:9': 3,
    'arrakeen:10': 2,
    'carthag:11': 1,
    'shield_wall:9': 2,
    'polar_sink:0': 1,
    [MOBILE_LOCATION]: 1,
  });
  let g = begin(initial);
  assert.notEqual(g.decision?.kind, 'choamStorm');
  assert.equal(player(g, 'c').tanks, 0);
  assert.deepEqual(player(g, 'c').forces, player(initial, 'c').forces);
  const zero = fixture();
  zero.stormPending = 0;
  zero.storm = 7;
  g = begin(zero);
  assert.notEqual(g.decision?.kind, 'choamStorm');
  assert.equal(g.storm, 7);
  assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
  conserve(g);
});
void test('destroyed Shield Wall exposes cities and basin but Jubba protects only one selected territory', () => {
  const initial = fixture();
  initial.storm = 8;
  initial.stormPending = 3;
  initial.shieldWallDestroyed = true;
  forces(initial, 'c', {
    'imperial_basin:9': 3,
    'arrakeen:10': 2,
    'carthag:11': 1,
  });
  let g = begin(initial);
  assert.equal(g.decision?.kind, 'choamStorm');
  if (g.decision?.kind === 'choamStorm')
    assert.equal(g.decision.territories.length, 3);
  g = decline(allow(play(g, 'arrakeen')));
  assert.deepEqual(player(g, 'c').forces, { 'arrakeen:10': 2 });
  assert.equal(player(g, 'c').tanks, 4);
  conserve(g);
});
void test('Jubba cannot target an ally, safe location or act outside its committed-storm window', () => {
  const initial = fixture();
  assert.throws(() => play(initial), /moving storm/);
  const g = begin(initial);
  assert.throws(() => play(g, 'red_chasm', { target: 'e' }), /only CHOAM/);
  assert.throws(() => play(g, 'arrakeen'), /unprotected territory/);
  assert.equal(player(g, 'c').hand.length, 1);
  assert.throws(() => send(g, 'e', { type: 'ready' }), /pending decision/);
});
void test('Jubba protection does not persist into the next committed storm', () => {
  let g = allow(play(begin(fixture())));
  g.choamMarket = null;
  g.decision = null;
  g.ready = [];
  g.turn++;
  g.phase = 0;
  g.storm = 5;
  g.stormPending = 3;
  g = begin(g);
  assert.equal(g.decision?.kind, 'choamStorm');
  if (g.decision?.kind === 'choamStorm')
    assert.deepEqual(g.decision.protected, []);
  g = decline(g);
  assert.equal(player(g, 'c').tanks, 4);
  conserve(g);
});
void test('CHOAM resolves before Fremen protection and chosen elite half-losses', () => {
  const initial = fixture(true);
  player(initial, 'e').faction = 'fremen';
  forces(initial, 'e', { 'red_chasm:7': 5 });
  player(initial, 'e').elites = {
    forces: { 'red_chasm:7': 2 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  let g = begin(initial);
  assert.equal(g.decision?.kind, 'choamStorm');
  g = play(g);
  // With no available cancellation, both powers settle before the casualty choice.
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.decision?.kind, 'stormLosses');
  assert.equal(player(g, 'c').tanks, 0);
  g = send(g, 'e', { type: 'decision', elite: 0 });
  assert.equal(player(g, 'e').forces['red_chasm:7'], 2);
  assert.equal(player(g, 'e').elites!.forces['red_chasm:7'], 2);
  assert.equal(player(g, 'e').tanks, 3);
  assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
  assert.equal(g.stormResolution, null);
  conserve(g);
});
void test('canceling Fremen protection leaves already granted Jubba protection intact', () => {
  const initial = fixture(true);
  player(initial, 'e').faction = 'fremen';
  const card = hold(initial, 'b', 'Karama');
  let g = play(begin(initial));
  g = send(g, 'b', { type: 'passResponse' });
  assert.equal(g.response?.kind, 'stormProtection');
  g = send(g, 'b', { type: 'card', mode: 'cancel', card });
  assert.equal(player(g, 'e').tanks, 3);
  assert.equal(player(g, 'c').tanks, 0);
  conserve(g);
});
void test('each AI difficulty protects the largest threatened group then declines with an empty hand', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture(true);
    forces(initial, 'c', { 'red_chasm:7': 4, 'gara_kulon:8': 2 });
    player(initial, 'c').bot = difficulty;
    player(initial, 'c').spice = 0;
    hold(initial, 'c', 'Karama');
    let g = begin(initial);
    const action = botActions(viewGame(g, 'c'))[0];
    assert.equal(action.mode, 'choam');
    assert.equal(action.territory, 'red_chasm');
    g = allow(send(g, 'c', action));
    assert.equal(g.decision?.kind, 'choamStorm');
    const pass = botActions(viewGame(g, 'c'))[0];
    assert.deepEqual(pass, { type: 'decision', decline: true });
    g = send(g, 'c', pass);
    assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
    assert.equal(player(g, 'c').tanks, 2);
    conserve(g);
  }
});

void test('cash-poor CHOAM AI preserves declared Jubba through its response and nested BG conversion', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture(true);
    player(initial, 'c').bot = difficulty;
    player(initial, 'c').spice = 0;
    hold(initial, 'c', 'Karama');
    const conversion = hold(initial, 'b', 'Baliset');
    const declared = play(begin(initial));
    for (const g of [
      declared,
      send(declared, 'b', { type: 'card', mode: 'cancel', card: conversion }),
    ]) {
      const action = botActions(viewGame(g, 'c'))[0];
      if (g.response?.kind === 'choamWorthless') {
        assert.equal(action, undefined);
        assert.ok(player(g, 'c').hand.some((c) => c.name === 'Jubba Cloak'));
        continue;
      }
      assert.ok(action);
      assert.notEqual(action.mode, 'special');
      const next = send(g, 'c', action);
      assert.ok(player(next, 'c').hand.some((c) => c.name === 'Jubba Cloak'));
      assert.equal(!!player(next, 'c').specialKaramaUsed, false);
    }
  }
});

void test('Weather Control and Family Atomics settle before Jubba targets are frozen', () => {
  let g = fixture();
  g.storm = 8;
  g.stormPending = 0;
  forces(g, 'c', { 'arrakeen:10': 4 });
  forces(g, 'e', { 'shield_wall:8': 3 });
  const atomics = hold(g, 'e', 'Family Atomics');
  const weather = hold(g, 'b', 'Weather Control');
  g = send(g, 'e', { type: 'card', card: atomics });
  g = send(g, 'b', { type: 'card', card: weather, amount: 2 });
  assert.equal(player(g, 'e').tanks, 3);
  g = begin(g);
  assert.equal(g.decision?.kind, 'choamStorm');
  if (g.decision?.kind === 'choamStorm') {
    assert.deepEqual(g.decision.territories, [
      { territory: 'arrakeen', amount: 4, sectors: [10] },
    ]);
  }
  g = allow(play(g, 'arrakeen'));
  assert.equal(g.storm, 10);
  assert.equal(player(g, 'c').forces['arrakeen:10'], 4);
  conserve(g);
});

void test('initial storm position and sector eighteen wrap expose the same crossed sectors', () => {
  for (const from of [0, 18]) {
    let g = fixture();
    g.storm = from;
    g.turn = from === 0 ? 1 : 2;
    g.stormPending = null;
    g.stormDialers = ['c', 'e'];
    forces(g, 'c', { 'meridian:1': 4, 'cielago_north:3': 2 });
    g = send(g, 'c', { type: 'stormDial', amount: 1 });
    g = send(g, 'e', { type: 'stormDial', amount: 1 });
    g = begin(g);
    assert.equal(g.decision?.kind, 'choamStorm');
    if (g.decision?.kind === 'choamStorm')
      assert.deepEqual(g.decision.territories, [
        { territory: 'meridian', amount: 4, sectors: [1] },
      ]);
    g = allow(play(g, 'meridian'));
    assert.equal(g.storm, 2);
    assert.deepEqual(player(g, 'c').forces, {
      'meridian:1': 4,
      'cielago_north:3': 2,
    });
    conserve(g);
  }
});
