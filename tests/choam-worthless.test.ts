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
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { forceRevivalQuote, newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(advanced = false) {
  const g = createGame('CWORTH22', newPlayer('c', 'CHOAM', 'choam'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 4;
  g.active = 'c';
  g.order = ['c', 'e', 'b'];
  g.storm = 18;
  g.deck = baseDeck();
  g.revivalRules = newRevivalRules();
  for (const p of g.players) {
    p.spice = 10;
    p.tanks = 6;
    p.reserves = 14;
    p.traitorChoices = [];
  }
  hold(g, 'c', 'Kulon');
  hold(g, 'c', 'La La La');
  return g;
}
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0);
  const c = g.deck.splice(i, 1)[0];
  player(g, id).hand.push(c);
  return c.id;
}
const named = (g: Game, name: string) =>
  player(g, 'c').hand.find((c) => c.name === name)!.id;
const play = (g: Game, name: string, target?: string) =>
  send(g, 'c', { type: 'card', mode: 'choam', card: named(g, name), target });
function contest(g: Game, id = 'e') {
  hold(g, id, 'Karama');
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 30; n++)
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
function movement(ornithopters = false) {
  const g = fixture();
  g.phase = 5;
  player(g, 'c').forces = { 'red_chasm:7': 3 };
  player(g, 'c').reserves = 11;
  if (ornithopters) {
    player(g, 'c').forces['arrakeen:10'] = 1;
    player(g, 'c').reserves--;
  }
  return g;
}
function destination(g: Game, range: number) {
  const target = TERRITORIES.flatMap((t) =>
    t.sectors.map((s) => `${t.id}:${s}`),
  ).find(
    (key) =>
      splitLocation(key).sector !== g.storm &&
      gameDistance(
        g,
        'red_chasm:7',
        key,
        (k) => splitLocation(k).sector === g.storm,
      ) === range,
  );
  assert.ok(target, `range ${range}`);
  return splitLocation(target);
}
const move = (g: Game, range: number) => {
  const to = destination(g, range);
  return send(g, 'c', {
    type: 'move',
    forces: { 'red_chasm:7': 2 },
    territory: to.territory,
    sector: to.sector,
  });
};
void test('Kulon adds one range in basic and advanced play only after its Karama response', () => {
  for (const advanced of [false, true]) {
    let g = contest(movement());
    g.advanced = advanced;
    assert.throws(() => move(g, 2), /more than 1/);
    const card = named(g, 'Kulon');
    g = play(g, 'Kulon');
    assert.equal(g.response?.kind, 'choamWorthless');
    assert.ok(player(g, 'c').hand.some((c) => c.id === card));
    g = allow(g);
    assert.equal(g.choamMovement?.bonus, 1);
    assert.ok(g.discard.some((c) => c.id === card));
    assert.throws(() => move(g, 3), /more than 2/);
    g = move(g, 2);
    assert.equal(player(g, 'c').moved, 1);
    assert.throws(() => move(g, 1), /movement is not available/);
  }
});
void test('Kulon adds to ornithopters and keeps the usual storm and alliance entry restrictions', () => {
  let g = movement(true);
  assert.throws(() => move(g, 4), /more than 3/);
  g = allow(play(g, 'Kulon'));
  assert.equal(player(move(g, 4), 'c').moved, 1);
  const storm = TERRITORIES.find(
    (t) => t.type === 'sand' && t.sectors.includes(18),
  )!;
  assert.throws(
    () =>
      send(g, 'c', {
        type: 'move',
        forces: { 'red_chasm:7': 1 },
        territory: storm.id,
        sector: 18,
      }),
    RuleError,
  );
  const to = destination(g, 2);
  player(g, 'c').ally = 'e';
  player(g, 'e').ally = 'c';
  player(g, 'e').forces[`${to.territory}:${to.sector}`] = 1;
  assert.throws(() => move(g, 2), RuleError);
});
void test('Kulon applies to available Hajr movements without granting a third movement and expires next turn', () => {
  let g = movement();
  const hajr = hold(g, 'c', 'Hajr');
  g = send(g, 'c', { type: 'card', card: hajr });
  g = allow(play(g, 'Kulon'));
  g = move(g, 2);
  g = send(g, 'c', {
    type: 'move',
    forces: { 'red_chasm:7': 1 },
    ...(() => {
      const to = destination(g, 2);
      return { territory: to.territory, sector: to.sector };
    })(),
  });
  assert.equal(player(g, 'c').moved, 2);
  assert.equal(viewGame(g, 'c').players[0].movesAllowed, 2);
  g.turn++;
  player(g, 'c').moved = 0;
  player(g, 'c').forces = { 'red_chasm:7': 3 };
  assert.equal(viewGame(g, 'c').choamMovementBonus, 0);
  assert.throws(() => move(g, 2), /more than 1/);
});
void test('Kulon rejects wrong owner, phase, active seat, spent movement and blocked windows atomically', () => {
  const initial = movement();
  const snapshot = structuredClone(initial);
  assert.throws(
    () =>
      send(initial, 'e', {
        type: 'card',
        mode: 'choam',
        card: named(initial, 'Kulon'),
      }),
    RuleError,
  );
  assert.deepEqual(initial, snapshot);
  for (const change of [
    (g: Game) => (g.phase = 4),
    (g: Game) => (g.active = 'e'),
    (g: Game) => (player(g, 'c').moved = 1),
    (g: Game) =>
      (g.response = {
        kind: 'emperorIncome',
        owner: 'e',
        amount: 1,
        passed: [],
      }),
  ]) {
    const g = structuredClone(initial);
    change(g);
    assert.throws(() => play(g, 'Kulon'), RuleError);
  }
});
void test('Karama preserves a Worthless card but prevents retrying its effect during that phase', () => {
  const initial = movement();
  const cancel = hold(initial, 'e', 'Karama');
  const card = named(initial, 'Kulon');
  let g = play(initial, 'Kulon');
  g = send(g, 'e', { type: 'card', card: cancel, mode: 'cancel' });
  assert.equal(g.choamMovement, undefined);
  assert.ok(player(g, 'c').hand.some((c) => c.id === card));
  assert.throws(() => play(g, 'Kulon'), RuleError);
  assert.ok(!viewGame(g, 'c').choamWorthless!.cards.some((c) => c.id === card));
  g.turn++;
  g = allow(play(g, 'Kulon'));
  assert.equal(g.choamMovement?.bonus, 1);
});
void test('La La La proactively removes only remaining ordinary free revivals; paid revival remains legal', () => {
  let g = fixture();
  g = send(g, 'e', { type: 'revive', amount: 1 });
  g = send(g, 'c', { type: 'decision', decline: true });
  assert.equal(player(g, 'e').revived, 1);
  g = allow(play(g, 'La La La', 'e'));
  assert.equal(viewGame(g, 'e').revival.freeRemaining, 0);
  assert.equal(forceRevivalQuote(g, player(g, 'e'), 2).cost, 4);
  g = send(g, 'e', { type: 'revive', amount: 2 });
  assert.equal(player(g, 'e').spice, 6);
  assert.equal(player(g, 'e').revived, 3);
});
void test('every CHOAM table offers the same public free-revival response regardless of its private hand', () => {
  const a = fixture(),
    b = structuredClone(a);
  player(b, 'c').hand = [];
  const ga = send(a, 'e', { type: 'revive', amount: 2 }),
    gb = send(b, 'e', { type: 'revive', amount: 2 });
  assert.equal(ga.decision?.kind, 'choamFreeRevival');
  assert.deepEqual(viewGame(ga, 'e').decision, viewGame(gb, 'e').decision);
  assert.equal(player(ga, 'e').tanks, 6);
  assert.equal(player(ga, 'e').spice, 10);
  assert.throws(
    () => send(ga, 'e', { type: 'decision', decline: true }),
    RuleError,
  );
});
void test('reactive La La La stops an entire mixed free/paid request without charging or consuming quota', () => {
  let g = send(fixture(), 'e', { type: 'revive', amount: 3 });
  g = play(g, 'La La La');
  assert.equal(g.response, null); // No eligible cancel card: the denial has settled.
  g = allow(g);
  assert.equal(g.pendingRevival, null);
  assert.equal(player(g, 'e').spice, 10);
  assert.equal(player(g, 'e').tanks, 6);
  assert.equal(player(g, 'e').revived, 0);
  g = send(g, 'e', { type: 'revive', amount: 3 });
  assert.equal(player(g, 'e').spice, 4);
  assert.equal(player(g, 'e').revived, 3);
});
void test('canceling reactive La La La resumes the original quote exactly once and keeps the card', () => {
  const initial = fixture();
  const card = hold(initial, 'e', 'Karama');
  let g = send(initial, 'e', { type: 'revive', amount: 3 });
  g = play(g, 'La La La');
  g = send(g, 'e', { type: 'card', card, mode: 'cancel' });
  assert.equal(player(g, 'e').spice, 6);
  assert.equal(player(g, 'e').revived, 3);
  assert.equal(g.pendingRevival, null);
  assert.equal(viewGame(g, 'e').revival.freeBlocked, false);
  assert.ok(player(g, 'c').hand.some((c) => c.name === 'La La La'));
});
void test('a cash-in consuming the pending Worthless card aborts its effect and resumes the original revival', () => {
  const initial = fixture(true);
  contest(initial);
  const karama = hold(initial, 'c', 'Karama');
  let g = send(initial, 'e', { type: 'revive', amount: 2 });
  const card = named(g, 'La La La');
  g = play(g, 'La La La');
  g = send(g, 'c', {
    type: 'card',
    mode: 'special',
    card: karama,
    cards: [card],
  });
  g = allow(g);
  assert.equal(player(g, 'e').revived, 2);
  assert.equal(player(g, 'e').spice, 8);
  assert.equal(viewGame(g, 'e').revival.freeBlocked, false);
  assert.equal(player(g, 'c').spice, 13);
});
void test('La La La denial overrides a later Fremen free-revival grant but does not block Ghola', () => {
  const initial = fixture();
  initial.players.push(newPlayer('f', 'Fremen', 'fremen'));
  player(initial, 'f').ally = 'e';
  player(initial, 'e').ally = 'f';
  const ghola = hold(initial, 'e', 'Tleilaxu Ghola');
  let g = allow(play(initial, 'La La La', 'e'));
  g = send(g, 'f', { type: 'grantRevival' });
  assert.equal(forceRevivalQuote(g, player(g, 'e'), 3).cost, 6);
  g = send(g, 'e', { type: 'card', card: ghola, amount: 3 });
  assert.equal(player(g, 'e').spice, 10);
  assert.equal(player(g, 'e').tanks, 3);
  assert.equal(player(g, 'e').revived, 0);
});
void test('the free-revival reaction precedes Tleilaxu special prevention and cancellation restores that continuation', () => {
  const initial = fixture(true);
  initial.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  const karama = hold(initial, 'e', 'Karama');
  let g = send(initial, 'e', { type: 'revive', amount: 2 });
  assert.equal(g.decision?.kind, 'choamFreeRevival');
  g = play(g, 'La La La');
  g = send(g, 'e', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(g.decision?.kind, 'revivalStop');
  assert.equal(player(g, 'e').revived, 0);
  g = send(g, 't', { type: 'decision', decline: true });
  g = allow(g);
  assert.equal(player(g, 'e').revived, 2);
  assert.equal(player(g, 'e').spice, 8);
});
void test('free denial resets on entering a later Revival phase', () => {
  let g = allow(play(fixture(), 'La La La', 'e'));
  g.turn++;
  g.phase = 2;
  g.expansions = [];
  g.deck = [];
  g.discard = [];
  for (const p of g.players) {
    p.hand = [];
    p.spice = 0;
  }
  for (const p of g.players) g = send(g, p.id, { type: 'ready' });
  while (g.decision?.kind === 'choamMarket')
    g = send(g, 'c', { type: 'decision', done: true });
  assert.equal(g.phase, 4);
  assert.equal(viewGame(g, 'e').revival.freeBlocked, false);
  assert.equal(forceRevivalQuote(g, player(g, 'e'), 1).cost, 0);
});
void test('pending Worthless effects and hidden card choices survive JSON reconnects', () => {
  for (const g of [
    play(
      send(contest(fixture()), 'e', { type: 'revive', amount: 2 }),
      'La La La',
    ),
    play(contest(movement()), 'Kulon'),
  ]) {
    assert.equal(g.response?.kind, 'choamWorthless');
    const copy = JSON.parse(JSON.stringify(g));
    assert.deepEqual(viewGame(copy, 'c'), viewGame(g, 'c'));
    assert.equal(viewGame(g, 'e').choamWorthless, null);
    assert.deepEqual(allow(copy), allow(g));
  }
});
void test('AI policies use Kulon, choose whether to deny free revival and budget correctly after denial', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = movement();
    player(g, 'c').bot = difficulty;
    assert.equal(botActions(viewGame(g, 'c'))[0].mode, 'choam');
    g = fixture();
    player(g, 'c').bot = difficulty;
    g = send(g, 'e', { type: 'revive', amount: 2 });
    const action = botActions(viewGame(g, 'c'))[0];
    assert.equal(action.type, difficulty === 'Easy' ? 'decision' : 'card');
    g = send(g, 'c', action);
    g = allow(g);
    if (difficulty !== 'Easy') {
      player(g, 'e').bot = difficulty;
      player(g, 'e').spice = 0;
      assert.ok(!botActions(viewGame(g, 'e')).some((a) => a.type === 'revive'));
    }
  }
});
void test('unsupported Worthless powers and forged targets do not consume cards or change state', () => {
  const g = fixture();
  const baliset = hold(g, 'c', 'Baliset');
  const before = structuredClone(g);
  assert.throws(
    () =>
      send(g, 'c', { type: 'card', mode: 'choam', card: baliset, target: 'e' }),
    RuleError,
  );
  assert.throws(() => play(g, 'La La La', 'missing'), RuleError);
  assert.deepEqual(g, before);
});
