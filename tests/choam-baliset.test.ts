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
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const card = g.deck.splice(i, 1)[0];
  p(g, id).hand.push(card);
  return card.id;
}
function fixture(advanced = false, distance = 1) {
  const g = createGame('BALISET2', newPlayer('c', 'CHOAM', 'choam'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.order = ['e', 'c', 'b'];
  g.active = 'e';
  g.storm = 18;
  g.deck = baseDeck();
  for (const player of g.players) {
    player.forces = {};
    player.spice = 20;
    player.reserves = 20;
  }
  p(g, 'e').forces = { 'red_chasm:7': 3 };
  p(g, 'e').reserves = 17;
  const key = TERRITORIES.flatMap((t) =>
    t.sectors.map((s) => `${t.id}:${s}`),
  ).find(
    (key) =>
      splitLocation(key).territory !== 'red_chasm' &&
      splitLocation(key).sector !== 18 &&
      gameDistance(
        g,
        'red_chasm:7',
        key,
        (k) => splitLocation(k).sector === 18,
      ) === distance,
  )!;
  assert.ok(key);
  p(g, 'c').forces[key] = 1;
  p(g, 'c').reserves = 19;
  hold(g, 'c', 'Baliset');
  return g;
}
const dest = (g: Game) => splitLocation(Object.keys(p(g, 'c').forces)[0]);
const move = (g: Game, extra: Partial<Action> = {}) =>
  send(g, 'e', {
    type: 'move',
    from: 'red_chasm:7',
    amount: 2,
    ...dest(g),
    ...extra,
  });
const play = (g: Game, extra: Partial<Action> = {}) =>
  send(g, 'c', {
    type: 'card',
    mode: 'choam',
    card: p(g, 'c').hand.find((c) => c.name === 'Baliset')!.id,
    target: 'e',
    territory: dest(g).territory,
    ...extra,
  });
function contest(g: Game, id = 'e') {
  hold(g, id, 'Karama');
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 30; i++)
    g = send(
      g,
      g.players.find(
        (p) =>
          !viewGame(g, p.id).responseControls?.hasPassed &&
          !!viewGame(g, p.id).responseControls?.cancelCards.length,
      )!.id,
      {
        type: 'passResponse',
      },
    );
  assert.equal(g.response, null);
  return g;
}
void test('CHOAM movement window reveals the same intent with or without Baliset', () => {
  const initial = fixture();
  const empty = structuredClone(initial);
  p(empty, 'c').hand = [];
  const g = move(initial),
    h = move(empty);
  assert.deepEqual(g.decision, h.decision);
  assert.equal(g.decision?.kind, 'choamMovement');
  assert.equal(p(g, 'e').forces['red_chasm:7'], 3);
  assert.equal(p(g, 'e').moved, 0);
  assert.throws(
    () => send(g, 'e', { type: 'endMovement' }),
    /pending decision/,
  );
  assert.equal(viewGame(g, 'e').choamWorthless, null);
  assert.equal('pendingChoamMove' in viewGame(g, 'e'), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(viewGame(g, 'e'))).decision,
    viewGame(g, 'e').decision,
  );
});
void test('allowing a CHOAM response resumes the original movement once', () => {
  let g = move(fixture());
  g = send(g, 'c', { type: 'decision', decline: true });
  assert.equal(p(g, 'e').forces['red_chasm:7'], 1);
  assert.equal(p(g, 'e').moved, 1);
  assert.equal(g.pendingChoamMove, null);
  assert.throws(() => send(g, 'c', { type: 'decision', decline: true }));
});
void test('Baliset blocks a declared move atomically in basic and advanced games', () => {
  for (const advanced of [false, true]) {
    let g = contest(fixture(advanced));
    const key = Object.keys(p(g, 'c').forces)[0];
    g = play(move(g));
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.equal(g.response?.recipient, 'e');
    assert.equal(g.response?.location, key);
    assert.equal(p(g, 'c').hand.length, 1);
    g = allow(JSON.parse(JSON.stringify(g)));
    assert.equal(p(g, 'c').hand.length, 0);
    assert.equal(p(g, 'e').moved, 0);
    assert.equal(p(g, 'e').forces['red_chasm:7'], 3);
    assert.equal(p(g, 'e').forces[key], undefined);
    assert.equal(g.pendingChoamMove, null);
    assert.throws(() => move(g), /Baliset prevents/);
  }
});
void test('canceling Baliset keeps the card and resumes exact elite custody', () => {
  const initial = fixture(true);
  p(initial, 'e').elites = {
    forces: { 'red_chasm:7': 2 },
    reserves: 3,
    tanks: 0,
    revived: 0,
  };
  const card = hold(initial, 'e', 'Karama');
  let g = play(move(initial, { elite: 1 }));
  g = send(g, 'e', { type: 'card', mode: 'cancel', card });
  const key = Object.keys(p(g, 'c').forces)[0];
  assert.equal(p(g, 'e').elites!.forces[key], 1);
  assert.equal(p(g, 'e').elites!.forces['red_chasm:7'], 1);
  assert.equal(p(g, 'e').moved, 1);
  assert.equal(p(g, 'c').hand.length, 1);
  assert.deepEqual(viewGame(g, 'e').balisetRestrictions, []);
  assert.throws(() => play(g), /blocked this phase/);
});
void test('proactive Baliset restricts only the selected player and territory', () => {
  let g = allow(play(fixture()));
  const key = Object.keys(p(g, 'c').forces)[0];
  p(g, 'b').forces = { 'red_chasm:7': 1 };
  g.active = 'b';
  g = send(g, 'b', {
    type: 'move',
    from: 'red_chasm:7',
    amount: 1,
    ...dest(g),
  });
  assert.equal(g.decision?.kind, 'choamMovement');
  g = send(g, 'c', { type: 'decision', decline: true });
  assert.equal(p(g, 'b').forces[key], 1);
  g.active = 'e';
  assert.throws(() => move(g), /Baliset prevents/);
});
void test('Baliset permits ordinary shipment into the restricted territory', () => {
  let g = allow(play(fixture()));
  g = send(g, 'e', { type: 'ship', amount: 1, ...dest(g) });
  assert.equal(p(g, 'e').forces[Object.keys(p(g, 'c').forces)[0]], 1);
  assert.equal(g.decision?.kind, 'advisor');
});
void test('restrictions expire with the phase/turn and cease while CHOAM is absent', () => {
  const initial = allow(play(fixture()));
  const absent = structuredClone(initial);
  p(absent, 'c').forces = {};
  const destination = dest(initial);
  const moved = send(absent, 'e', {
    type: 'move',
    from: 'red_chasm:7',
    amount: 1,
    ...destination,
  });
  assert.equal(p(moved, 'e').moved, 1);
  const next = structuredClone(initial);
  next.turn++;
  assert.equal(move(next).decision?.kind, 'choamMovement');
  initial.phase = 6;
  assert.deepEqual(viewGame(initial, 'e').balisetRestrictions, []);
});
void test('invalid target, unoccupied territory and wrong phase never discard Baliset', () => {
  const g = fixture();
  assert.throws(() => play(g, { target: 'c' }), /another player/);
  assert.throws(() => play(g, { territory: 'arrakeen' }), /CHOAM occupies/);
  g.phase = 4;
  assert.throws(() => play(g), /Shipment and Movement/);
  assert.equal(p(g, 'c').hand.length, 1);
});
void test('storm and force validation occur before exposing a CHOAM window', () => {
  const g = fixture();
  g.storm = dest(g).sector;
  assert.throws(() => move(g));
  assert.equal(g.decision, null);
  g.storm = 18;
  assert.throws(() => move(g, { amount: 4 }));
  assert.equal(g.decision, null);
});
void test('cashing in a pending Baliset resumes movement without imposing a restriction', () => {
  const initial = fixture(true);
  contest(initial);
  const card = hold(initial, 'c', 'Karama');
  const baliset = p(initial, 'c').hand.find((c) => c.name === 'Baliset')!.id;
  let g = play(move(initial));
  g = send(g, 'c', { type: 'card', mode: 'special', card, cards: [baliset] });
  g = allow(g);
  assert.equal(p(g, 'e').moved, 1);
  assert.deepEqual(viewGame(g, 'e').balisetRestrictions, []);
  assert.equal(p(g, 'c').spice, 23);
});
void test('resumption rechecks force custody and routes without spending an invalid move', () => {
  for (const change of ['forces', 'storm']) {
    let g = move(fixture());
    if (change === 'forces') p(g, 'e').forces = {};
    else g.storm = dest(g).sector;
    g = send(g, 'c', { type: 'decision', decline: true });
    assert.equal(p(g, 'e').moved, 0);
    assert.equal(g.pendingChoamMove, null);
  }
});
void test('CHOAM losing occupation during the response cancels the effect without discarding', () => {
  let g = play(move(contest(fixture())));
  p(g, 'c').forces = {};
  g = allow(g);
  assert.equal(p(g, 'e').moved, 1);
  assert.equal(p(g, 'c').hand.length, 1);
  assert.deepEqual(viewGame(g, 'e').balisetRestrictions, []);
});
void test('all four AI levels can block an enemy and pass with an empty hand', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = move(fixture());
    p(g, 'c').bot = difficulty;
    const action = botActions(viewGame(g, 'c'))[0];
    assert.equal(action.type, 'card');
    const blocked = send(g, 'c', action);
    assert.equal(blocked.response, null);
    assert.equal(p(blocked, 'e').moved, 0);
    assert.equal(p(blocked, 'c').hand.length, 0);
    p(g, 'c').hand = [];
    assert.equal(
      send(g, 'c', botActions(viewGame(g, 'c'))[0]).players.find(
        (p) => p.id === 'e',
      )!.moved,
      1,
    );
  }
});
void test('Ixian cyborg transport responds before the CHOAM destination decision', () => {
  let g = fixture(false, 2);
  p(g, 'e').faction = 'ixians';
  p(g, 'e').elites = {
    forces: { 'red_chasm:7': 1 },
    reserves: 6,
    tanks: 0,
    revived: 0,
  };
  contest(g, 'b');
  g = move(g, { elite: 1 });
  assert.equal(g.response?.kind, 'ixMovement');
  assert.equal(g.decision, null);
  g = allow(g);
  assert.equal(g.decision?.kind, 'choamMovement');
  g = allow(play(g));
  assert.equal(p(g, 'e').moved, 0);
  assert.equal(p(g, 'e').elites?.forces['red_chasm:7'], 1);
});
void test('Baliset does not prevent moving between sectors inside the occupied territory', () => {
  let g = fixture();
  const t = TERRITORIES.find(
    (t) => t.sectors.length > 1 && !t.sectors.includes(18),
  )!;
  p(g, 'c').forces = { [`${t.id}:${t.sectors[0]}`]: 1 };
  p(g, 'e').forces = { [`${t.id}:${t.sectors[0]}`]: 2 };
  g = allow(play(g));
  g = send(g, 'e', {
    type: 'move',
    from: `${t.id}:${t.sectors[0]}`,
    amount: 1,
    territory: t.id,
    sector: t.sectors[1],
  });
  assert.equal(p(g, 'e').moved, 1);
  assert.equal(g.decision, null);
});
void test('AI excludes restricted movement destinations while retaining shipment candidates', () => {
  const g = allow(play(fixture()));
  const target = dest(g).territory;
  p(g, 'e').bot = 'Brutal';
  g.spice[Object.keys(p(g, 'c').forces)[0]] = 100;
  const actions = botActions(viewGame(g, 'e'));
  assert.ok(actions.some((a) => a.type === 'ship' && a.territory === target));
  assert.ok(!actions.some((a) => a.type === 'move' && a.territory === target));
});
void test('AI considers its remaining Hajr movement and Kulon plus ornithopter range', () => {
  const g = fixture();
  p(g, 'c').forces = { 'red_chasm:7': 3, 'arrakeen:10': 1 };
  p(g, 'c').bot = 'Brutal';
  p(g, 'c').shipped = true;
  p(g, 'c').moved = 1;
  g.hajr = ['c'];
  g.active = 'c';
  g.choamMovement = { turn: g.turn, bonus: 1 };
  const target = TERRITORIES.flatMap((t) =>
    t.sectors.map((s) => `${t.id}:${s}`),
  ).find(
    (k) =>
      gameDistance(
        g,
        'red_chasm:7',
        k,
        (k) => splitLocation(k).sector === 18,
      ) === 4,
  )!;
  assert.ok(target);
  g.spice[target] = 100;
  const to = splitLocation(target);
  const action = botActions(viewGame(g, 'c')).find(
    (a) =>
      a.type === 'move' &&
      a.from === 'red_chasm:7' &&
      a.territory === to.territory &&
      a.sector === to.sector,
  );
  assert.ok(action);
  const after = send(g, 'c', action);
  assert.equal(p(after, 'c').moved, 2);
});
void test('a cash-poor CHOAM AI keeps Baliset to answer an enemy movement', () => {
  const initial = fixture(true);
  hold(initial, 'c', 'Karama');
  p(initial, 'c').spice = 0;
  p(initial, 'c').bot = 'Brutal';
  const g = move(initial);
  assert.equal(botActions(viewGame(g, 'c'))[0].mode, 'choam');
});
void test('Bene Gesserit Worthless-as-Karama resumes Baliset movement through its counter window', () => {
  const initial = fixture(true);
  const card = hold(initial, 'b', 'Kulon');
  contest(initial);
  let g = play(move(initial));
  g = send(g, 'b', { type: 'card', mode: 'cancel', card });
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(p(g, 'e').moved, 1);
  assert.equal(p(g, 'c').hand.length, 1);
  assert.equal(g.pendingChoamMove, null);
});
void test('countering the Bene Gesserit conversion returns to the pending Baliset response', () => {
  const initial = fixture(true);
  const card = hold(initial, 'b', 'Kulon');
  const counter = hold(initial, 'c', 'Karama');
  hold(initial, 'b', 'La La La');
  let g = play(move(initial));
  g = send(g, 'b', { type: 'card', mode: 'cancel', card });
  g = send(g, 'c', { type: 'card', mode: 'cancel', card: counter });
  assert.equal(g.response?.kind, 'choamWorthless');
  g = allow(g);
  assert.equal(p(g, 'e').moved, 0);
  assert.equal(p(g, 'e').forces['red_chasm:7'], 3);
  assert.equal(g.pendingChoamMove, null);
});
void test('resuming a multisector group preserves selected elites in every source', () => {
  const initial = fixture(true);
  const t = TERRITORIES.find(
    (t) => t.sectors.length > 1 && !t.sectors.includes(18),
  )!;
  const sources = t.sectors.slice(0, 2).map((s) => `${t.id}:${s}`);
  const destination = TERRITORIES.flatMap((t) =>
    t.sectors.map((s) => `${t.id}:${s}`),
  ).find(
    (k) =>
      splitLocation(k).territory !== t.id &&
      splitLocation(k).sector !== 18 &&
      sources.every(
        (from) =>
          gameDistance(
            initial,
            from,
            k,
            (k) => splitLocation(k).sector === 18,
          ) <= 1,
      ),
  )!;
  assert.ok(destination);
  p(initial, 'c').forces = { [destination]: 1 };
  p(initial, 'e').forces = Object.fromEntries(sources.map((k) => [k, 3]));
  p(initial, 'e').elites = {
    reserves: 2,
    tanks: 0,
    revived: 0,
    forces: { [sources[0]]: 2, [sources[1]]: 1 },
  };
  let g = send(initial, 'e', {
    type: 'move',
    forces: { [sources[0]]: 2, [sources[1]]: 1 },
    eliteForces: { [sources[0]]: 1, [sources[1]]: 1 },
    ...splitLocation(destination),
  });
  g = send(JSON.parse(JSON.stringify(g)), 'c', {
    type: 'decision',
    decline: true,
  });
  assert.equal(p(g, 'e').forces[destination], 3);
  assert.equal(p(g, 'e').elites?.forces[destination], 2);
  assert.equal(p(g, 'e').elites?.forces[sources[0]], 1);
  assert.equal(p(g, 'e').elites?.forces[sources[1]] ?? 0, 0);
});
void test('Bene Gesserit advisors keep advisor status and arrival lock after CHOAM allows movement', () => {
  let g = fixture(true);
  p(g, 'b').faction = 'guild';
  p(g, 'e').faction = 'beneGesserit';
  p(g, 'e').advisors = { red_chasm: { lockedTurn: g.turn } };
  const target = dest(g).territory;
  g = move(g);
  g = send(g, 'c', { type: 'decision', decline: true });
  assert.equal(p(g, 'e').advisors?.[target].lockedTurn, g.turn);
  assert.equal(p(g, 'e').moved, 1);
});
