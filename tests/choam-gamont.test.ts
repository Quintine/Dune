import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { TERRITORIES, MOBILE_LOCATION } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const key = (id: string) =>
  `${id}:${TERRITORIES.find((t) => t.id === id)!.sectors[0]}`;
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
function fixture(advanced = false) {
  const g = createGame('GAMONT22', newPlayer('c', 'CHOAM', 'choam'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
    newPlayer('g', 'Guild', 'guild'),
  );
  g.status = 'playing';
  g.phase = 7;
  g.order = ['c', 'e', 'b', 'g'];
  g.storm = 18;
  g.deck = baseDeck();
  for (const p of g.players) {
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.traitorChoices = [];
  }
  player(g, 'e').forces = Object.fromEntries(
    ['arrakeen', 'carthag', 'sietch_tabr'].map((t) => [key(t), 1]),
  );
  player(g, 'e').reserves = 17;
  hold(g, 'c', 'Trip to Gamont');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0);
  const c = g.deck.splice(i, 1)[0];
  player(g, id).hand.push(c);
  return c.id;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players)
    if (!g.ready.includes(p.id)) g = send(g, p.id, { type: 'ready' });
  return g;
}
const done = (g: Game) => send(g, 'c', { type: 'decision', done: true });
const mentat = (g = fixture()) => done(ready(g));
const closing = (g: Game) => done(ready(g));
function trip(g: Game, target = 'e', from = key('arrakeen'), elite = 0) {
  const card = player(g, 'c').hand.find((c) => c.name === 'Trip to Gamont')!.id;
  return send(g, 'c', {
    type: 'card',
    mode: 'choam',
    card,
    target,
    from,
    elite,
  });
}
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
void test('CHOAM tables defer victory until all Mentat actions, market and final opportunity are complete', () => {
  let g = mentat();
  assert.equal(g.phase, 8);
  assert.equal(g.status, 'playing');
  assert.deepEqual(g.winner, []);
  assert.equal(viewGame(g, 'e').mentatVictoryPending, true);
  g = closing(g);
  assert.equal(g.decision?.kind, 'choamMentat');
  assert.equal(g.status, 'playing');
  assert.throws(
    () => send(g, 'e', { type: 'decision', done: true }),
    RuleError,
  );
  g = done(g);
  assert.equal(g.status, 'finished');
  assert.deepEqual(g.winner, ['e']);
  assert.equal(g.turn, 1);
});
void test('Trip to Gamont returns one ordinary force to reserves before victory without losses or income', () => {
  for (const advanced of [false, true]) {
    let g = closing(mentat(contest(fixture(advanced))));
    const before = structuredClone(g);
    g = trip(g);
    assert.equal(player(g, 'e').reserves, 17);
    assert.equal(g.response?.location, key('arrakeen'));
    g = allow(g);
    assert.equal(player(g, 'e').forces[key('arrakeen')], undefined);
    assert.equal(player(g, 'e').reserves, 18);
    assert.equal(player(g, 'e').tanks, before.players[1].tanks);
    assert.equal(player(g, 'e').battleLosses, 0);
    for (const p of g.players)
      assert.equal(p.spice, player(before, p.id).spice);
    assert.equal(g.decision?.kind, 'choamMentat');
    g = done(g);
    assert.equal(g.status, 'playing');
    assert.equal(g.turn, 2);
  }
});
void test('the final opportunity is public and identical whether CHOAM holds the card or has an empty hand', () => {
  const a = fixture(),
    b = structuredClone(a);
  player(b, 'c').hand = [];
  const ga = closing(mentat(a)),
    gb = closing(mentat(b));
  assert.deepEqual(viewGame(ga, 'e').decision, viewGame(gb, 'e').decision);
  assert.equal(viewGame(ga, 'e').choamWorthless, null);
});
void test('Trip may be played during ordinary Mentat and clears readiness before later victory confirmation', () => {
  let g = mentat();
  g = send(g, 'e', { type: 'ready' });
  g = allow(trip(g));
  assert.deepEqual(g.ready, []);
  assert.equal(g.decision, null);
  assert.equal(g.status, 'playing');
  g = done(closing(g));
  assert.equal(g.turn, 2);
});
void test('a Karama cancellation keeps both the selected force and Trip card and does not skip the victory opportunity', () => {
  const initial = fixture();
  const karama = hold(initial, 'e', 'Karama');
  let g = trip(closing(mentat(initial)));
  g = send(g, 'e', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(g.decision?.kind, 'choamMentat');
  assert.equal(player(g, 'e').forces[key('arrakeen')], 1);
  assert.ok(player(g, 'c').hand.some((c) => c.name === 'Trip to Gamont'));
  assert.throws(() => trip(g), RuleError);
  g = done(g);
  assert.deepEqual(g.winner, ['e']);
});
void test('elite recall preserves typed token counts and does not use revival allowance', () => {
  const initial = fixture(true);
  player(initial, 'e').forces[key('arrakeen')] = 2;
  player(initial, 'e').reserves = 16;
  player(initial, 'e').elites = {
    forces: { [key('arrakeen')]: 1 },
    reserves: 4,
    tanks: 0,
    revived: 1,
  };
  const g = allow(trip(mentat(initial), 'e', key('arrakeen'), 1));
  const e = player(g, 'e');
  assert.equal(e.forces[key('arrakeen')], 1);
  assert.equal(e.elites!.forces[key('arrakeen')], undefined);
  assert.equal(e.elites!.reserves, 5);
  assert.equal(e.elites!.revived, 1);
  assert.equal(e.reserves, 17);
  assert.equal(e.tanks, 0);
});
void test('an ordinary recall from a mixed stack preserves the elite on the board', () => {
  const initial = fixture(true);
  player(initial, 'e').forces[key('arrakeen')] = 2;
  player(initial, 'e').reserves = 16;
  player(initial, 'e').elites = {
    forces: { [key('arrakeen')]: 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  const g = allow(trip(mentat(initial)));
  assert.equal(player(g, 'e').forces[key('arrakeen')], 1);
  assert.equal(player(g, 'e').elites!.forces[key('arrakeen')], 1);
  assert.equal(player(g, 'e').elites!.reserves, 4);
});
void test('wrong phase, self targets, reserves, empty sectors, excessive quantities and unavailable force types fail atomically', () => {
  const g = mentat();
  const card = player(g, 'c').hand[0].id;
  const before = structuredClone(g);
  for (const fields of [
    { target: 'c' },
    { target: 'missing' },
    { from: 'reserves' },
    { from: key('red_chasm') },
    { amount: 2 },
    { elite: 1 },
  ])
    assert.throws(
      () =>
        send(g, 'c', {
          type: 'card',
          mode: 'choam',
          card,
          target: 'e',
          from: key('arrakeen'),
          ...fields,
        }),
      RuleError,
    );
  assert.deepEqual(g, before);
  g.phase = 7;
  assert.throws(() => trip(g), RuleError);
});
void test('a target in storm can be recalled and another player’s advisors can be returned', () => {
  const initial = fixture(true);
  initial.storm = TERRITORIES.find((t) => t.id === 'arrakeen')!.sectors[0];
  let g = allow(trip(mentat(initial)));
  assert.equal(player(g, 'e').forces[key('arrakeen')], undefined);
  g = mentat(fixture(true));
  player(g, 'b').forces[key('arrakeen')] = 1;
  player(g, 'b').reserves = 19;
  player(g, 'b').advisors = { arrakeen: {} };
  g = allow(trip(g, 'b'));
  assert.equal(player(g, 'b').reserves, 20);
  assert.equal(player(g, 'b').advisors?.arrakeen, undefined);
});
void test('recalling the last enemy beside Bene Gesserit advisors settles their stance before checking control', () => {
  const initial = fixture(true);
  player(initial, 'b').forces[key('arrakeen')] = 1;
  player(initial, 'b').reserves = 19;
  player(initial, 'b').advisors = { arrakeen: {} };
  const g = allow(trip(mentat(initial)));
  assert.equal(player(g, 'b').advisors?.arrakeen, undefined);
  assert.equal(player(g, 'b').forces[key('arrakeen')], 1);
});
void test('a force inside the mobile stronghold can be recalled without moving the stronghold', () => {
  const initial = fixture(true);
  const ix = newPlayer('i', 'Ixians', 'ixians');
  initial.players.push(ix);
  initial.order.push('i');
  ix.forces = { [MOBILE_LOCATION]: 2 };
  ix.reserves = 18;
  ix.elites = {
    forces: { [MOBILE_LOCATION]: 1 },
    reserves: 6,
    tanks: 0,
    revived: 0,
  };
  initial.mobileStronghold = { location: key('red_chasm') };
  const g = allow(trip(mentat(initial), 'i', MOBILE_LOCATION, 1));
  assert.equal(player(g, 'i').forces[MOBILE_LOCATION], 1);
  assert.equal(player(g, 'i').elites!.reserves, 7);
  assert.deepEqual(g.mobileStronghold, initial.mobileStronghold);
});
void test('a copy acquired in the closing allied exchange can still be played before victory', () => {
  const initial = fixture();
  const old = player(initial, 'c').hand.pop()!;
  player(initial, 'b').hand.push(old);
  player(initial, 'c').ally = 'b';
  player(initial, 'b').ally = 'c';
  const offered = hold(initial, 'c', 'Shield');
  let g = ready(mentat(initial));
  g = send(g, 'c', { type: 'decision', mode: 'trade', card: offered });
  g = send(g, 'b', { type: 'decision', card: old.id });
  g = send(g, 'c', { type: 'decision', accept: true });
  g = done(g);
  assert.equal(g.decision?.kind, 'choamMentat');
  g = allow(trip(g));
  g = done(g);
  assert.equal(g.status, 'playing');
  assert.equal(g.turn, 2);
});
void test('cash-in of a pending Trip card causes no recall and restores the final decision after reconnect', () => {
  const initial = fixture(true);
  contest(initial);
  const karama = hold(initial, 'c', 'Karama');
  let g = closing(mentat(initial));
  const tripCard = player(g, 'c').hand.find(
    (c) => c.name === 'Trip to Gamont',
  )!.id;
  g = trip(g);
  g = send(g, 'c', {
    type: 'card',
    mode: 'special',
    card: karama,
    cards: [tripCard],
  });
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(player(g, 'e').forces[key('arrakeen')], 1);
  assert.equal(g.decision?.kind, 'choamMentat');
  g = done(g);
  assert.deepEqual(g.winner, ['e']);
});
void test('last-turn fallback and Bene Gesserit prediction use the board after Trip resolves', () => {
  const initial = fixture();
  initial.turn = 10;
  player(initial, 'b').prediction = { faction: 'emperor', turn: 10 };
  let g = closing(mentat(initial));
  assert.equal(g.status, 'playing');
  g = allow(trip(g));
  g = done(g);
  assert.deepEqual(g.winner, ['g']);
  const predicted = fixture();
  player(predicted, 'b').prediction = { faction: 'emperor', turn: 1 };
  g = done(closing(mentat(predicted)));
  assert.deepEqual(g.winner, ['b']);
});
void test('bribes and Inflation settle once at Mentat entry even while victory is deferred', () => {
  const initial = fixture();
  player(initial, 'e').bribes = 4;
  initial.inflation = {
    side: 'double',
    placedTurn: 0,
    updatedTurn: 0,
    flipped: false,
  };
  let g = mentat(initial);
  assert.equal(player(g, 'e').spice, 14);
  assert.equal(g.inflation?.side, 'cancel');
  g = closing(g);
  g = allow(trip(g));
  assert.equal(player(g, 'e').spice, 14);
  assert.equal(g.inflation?.side, 'cancel');
  g = done(g);
  assert.equal(player(g, 'e').spice, 14);
});
void test('all AI levels preserve Trip from cash-in and market sale, play it and finish the final window', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture(true);
    player(initial, 'c').bot = difficulty;
    player(initial, 'c').spice = 0;
    hold(initial, 'c', 'Karama');
    let g = mentat(initial);
    const a = botActions(viewGame(g, 'c'))[0];
    assert.equal(a.mode, 'choam');
    g = ready(g);
    const market = botActions(viewGame(g, 'c'))[0];
    assert.equal(market.done, true);
    g = send(g, 'c', market);
    const action = botActions(viewGame(g, 'c'))[0];
    assert.equal(action.mode, 'choam');
    g = allow(send(g, 'c', action));
    const finish = botActions(viewGame(g, 'c'))[0];
    assert.equal(finish.done, true);
    g = send(g, 'c', finish);
    assert.equal(g.status, 'playing');
  }
});
void test('Trip can remove a contesting force and create CHOAM’s win with its tech-token bonus', () => {
  const initial = fixture();
  player(initial, 'c').forces = {
    [key('arrakeen')]: 1,
    [key('tueks_sietch')]: 1,
  };
  player(initial, 'c').reserves = 18;
  initial.techTokens = {
    axlotl: { owner: 'c', spice: 0 },
    heighliners: { owner: 'c', spice: 0 },
    production: { owner: 'c', spice: 0 },
  };
  let g = closing(mentat(initial));
  assert.deepEqual(g.winner, []);
  g = allow(trip(g));
  g = done(g);
  assert.deepEqual(g.winner, ['c']);
  assert.equal(player(g, 'e').reserves, 18);
});
void test('a missing selected force aborts the pending return without discarding Trip or duplicating a reserve', () => {
  let g = trip(closing(mentat(contest(fixture()))));
  delete player(g, 'e').forces[key('arrakeen')];
  player(g, 'e').reserves++;
  const card = player(g, 'c').hand.find((c) => c.name === 'Trip to Gamont')!.id;
  g = allow(g);
  assert.equal(player(g, 'e').reserves, 18);
  assert.ok(player(g, 'c').hand.some((c) => c.id === card));
  assert.equal(g.decision?.kind, 'choamMentat');
});
void test('Bene Gesserit Worthless Karama counter-window retains the final Mentat continuation', () => {
  const initial = fixture(true);
  const worthless = hold(initial, 'b', 'Baliset');
  contest(initial);
  let g = trip(closing(mentat(initial)));
  g = send(g, 'b', { type: 'card', mode: 'cancel', card: worthless });
  assert.equal(g.response?.kind, 'worthlessKarama');
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(player(g, 'e').forces[key('arrakeen')], 1);
  assert.equal(g.decision?.kind, 'choamMentat');
  g = done(g);
  assert.deepEqual(g.winner, ['e']);
});
