import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { TERRITORIES, distance, location, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const source = 'red_chasm:7';
const karamas = baseDeck().filter((c) => c.effect === 'karama');
const worthless = baseDeck().find((c) => c.kind === 'worthless')!;
const destinations = TERRITORIES.filter((t) => t.type === 'sand').flatMap((t) =>
  t.sectors.filter((s) => s !== 18).map((s) => location(t.id, s)),
);
function target(range: number, from = source) {
  const result = destinations.find(
    (to) =>
      distance(from, to, (key) => splitLocation(key).sector === 18) === range,
  );
  assert.ok(result, `range ${range} from ${from}`);
  return result;
}
function fixture(advanced = false): Game {
  const g = createGame(
    'FREMENMOVEK',
    newPlayer('f', 'Fremen', 'fremen'),
    advanced,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'f',
    order: ['f', 'e', 'b'],
    movementRemaining: ['f', 'e', 'b'],
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 10,
      traitors: [],
    });
  const f = g.players[0];
  f.forces = { [source]: 4 };
  f.reserves = 16;
  f.shipped = true;
  if (advanced)
    f.elites = { forces: { [source]: 1 }, reserves: 2, tanks: 0, revived: 0 };
  return g;
}
function moveAction(range = 2, from = source): Action {
  const to = splitLocation(target(range, from));
  return {
    type: 'move',
    from,
    amount: 4,
    territory: to.territory,
    sector: to.sector,
  };
}
const restore = (g: Game): Game => JSON.parse(JSON.stringify(g));
function declare(g: Game) {
  return applyAction(g, 'f', moveAction());
}
function cancel(g: Game) {
  return applyAction(g, 'e', {
    type: 'card',
    card: karamas[0].id,
    mode: 'cancel',
  });
}
function conserved(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const elites = g.players[0].elites;
  if (elites)
    assert.equal(
      elites.reserves +
        elites.tanks +
        Object.values(elites.forces).reduce((a, b) => a + b, 0),
      3,
    );
}

void test('Fremen range-two movement waits only for a real foreign blocker and serializes the exact unspent group', () => {
  for (const advanced of [false, true]) {
    const initial = fixture(advanced);
    initial.players[1].hand = [karamas[0]];
    initial.players[0].hand = [karamas[1]];
    const pending = declare(initial);
    assert.equal(pending.response?.kind, 'fremenMovement');
    assert.equal(pending.response?.owner, 'f');
    assert.deepEqual(pending.players[0].forces, initial.players[0].forces);
    assert.equal(pending.players[0].moved, 0);
    assert.equal(pending.pendingFremenMove?.turn, 2);
    assert.equal(pending.pendingFremenMove?.move, 0);
    assert.deepEqual(pending.pendingFremenMove?.order.group, [[source, 4]]);
    assert.deepEqual(viewGame(pending, 'f').responseControls?.cancelCards, []);
    assert.throws(() =>
      applyAction(pending, 'f', {
        type: 'card',
        card: karamas[1].id,
        mode: 'cancel',
      }),
    );
    const resumed = applyAction(restore(pending), 'e', {
      type: 'passResponse',
    });
    assert.equal(resumed.response, null);
    assert.equal(resumed.pendingFremenMove, null);
    assert.equal(resumed.players[0].forces[target(2)], 4);
    assert.equal(resumed.players[0].moved, 1);
    if (advanced) assert.equal(resumed.players[0].elites!.forces[target(2)], 1);
    assert.deepEqual(normalizeAutomaticGame(restore(resumed)), resumed);
    assert.throws(() => applyAction(resumed, 'e', { type: 'passResponse' }));
    conserved(resumed);
  }
});

void test('no-card and owner-only Karama tables apply Fremen movement automatically without a confirmation', () => {
  for (const ownerCard of [false, true]) {
    const g = fixture();
    if (ownerCard) g.players[0].hand = [karamas[0]];
    const done = declare(g);
    assert.equal(done.response, null);
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].forces[target(2)], 4);
    assert.equal(done.players[0].hand.length, ownerCard ? 1 : 0);
    conserved(done);
  }
});

void test('Karama preserves forces and movement allowance, while only the current Fremen group move loses range two', () => {
  const initial = fixture(true);
  initial.players[1].hand = [karamas[0]];
  initial.players[0].hand = [baseDeck().find((c) => c.effect === 'hajr')!];
  const hajr = applyAction(initial, 'f', {
    type: 'card',
    card: initial.players[0].hand[0].id,
  });
  const denied = cancel(declare(hajr));
  assert.equal(denied.players[0].moved, 0);
  assert.deepEqual(denied.players[0].forces, initial.players[0].forces);
  assert.deepEqual(denied.players[0].elites, initial.players[0].elites);
  assert.deepEqual(denied.players[0].fremenMovementBlocked, {
    turn: 2,
    move: 0,
  });
  assert.equal(viewGame(denied, 'f').players[0].fremenMovementBlocked, true);
  assert.equal(denied.discard.filter((c) => c.id === karamas[0].id).length, 1);
  assert.throws(() => declare(denied), /more than 1/);
  const shorter = applyAction(restore(denied), 'f', moveAction(1));
  assert.equal(shorter.players[0].moved, 1);
  assert.equal(viewGame(shorter, 'f').players[0].fremenMovementBlocked, false);
  const second = applyAction(shorter, 'f', moveAction(2, target(1)));
  assert.equal(second.players[0].moved, 2);
  conserved(second);
  const later = restore(denied);
  later.turn++;
  assert.equal(viewGame(later, 'f').players[0].fremenMovementBlocked, false);
  assert.equal(declare(later).players[0].moved, 1);
});

void test('city ornithopters and the fixed-range Ornithopter card bypass the Fremen faction movement response', () => {
  for (const mode of ['city', 'card'] as const) {
    const g = fixture();
    g.players[1].hand = [karamas[0]];
    const action = moveAction(3);
    if (mode === 'city') {
      g.players[0].forces['arrakeen:10'] = 1;
      g.players[0].reserves--;
    } else {
      const card = richeseCards().find((c) => c.effect === 'ornithopter')!;
      g.players[0].hand = [card];
      action.movementCard = card.id;
      action.ornithopter = 'range3';
    }
    const done = applyAction(g, 'f', action);
    assert.equal(done.response, null);
    assert.equal(done.pendingFremenMove ?? null, null);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].forces[target(3)], 4);
    assert.equal(done.players[1].hand[0].id, karamas[0].id);
    conserved(done);
  }
});

void test('serialized BG Worthless conversion either cancels Fremen range or restores and applies the original movement exactly once', () => {
  for (const countered of [false, true]) {
    const g = fixture(true);
    g.players[1].hand = [karamas[0]];
    g.players[2].hand = [worthless];
    const pending = declare(g);
    const conversion = applyAction(pending, 'b', {
      type: 'card',
      card: worthless.id,
      mode: 'cancel',
    });
    assert.equal(conversion.response?.kind, 'worthlessKarama');
    assert.deepEqual(conversion.pendingFremenMove, pending.pendingFremenMove);
    assert.deepEqual(conversion.players[0].forces, g.players[0].forces);
    const done = countered
      ? cancel(restore(conversion))
      : applyAction(restore(conversion), 'e', { type: 'passResponse' });
    assert.equal(done.response, null);
    assert.equal(done.pendingKarama ?? null, null);
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.players[0].moved, countered ? 1 : 0);
    assert.equal(
      viewGame(done, 'f').players[0].fremenMovementBlocked,
      !countered,
    );
    assert.equal(done.players[0].forces[countered ? target(2) : source], 4);
    assert.equal(done.discard.filter((c) => c.id === worthless.id).length, 1);
    assert.deepEqual(normalizeAutomaticGame(restore(done)), done);
    conserved(done);
  }
});

void test('all four bots propose legal range-one replacements from the projected cancellation without consuming another move', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true);
    g.players[1].hand = [karamas[0]];
    const denied = cancel(declare(g));
    const view = viewGame(restore(denied), 'f');
    view.players[0].bot = difficulty;
    assert.equal(view.players[0].fremenMovementBlocked, true);
    const actions = botActions(view).filter((a) => a.type === 'move');
    assert.ok(actions.length > 0);
    for (const a of actions) {
      assert.ok(
        distance(
          String(a.from),
          location(String(a.territory), Number(a.sector)),
        ) <= 1,
      );
      assert.doesNotThrow(() => applyAction(denied, 'f', a));
    }
    const done = applyAction(denied, 'f', actions[0]);
    assert.equal(done.players[0].moved, 1);
    conserved(done);
  }
});

void test('a mismatched restored Fremen movement intent fails before applying the pending group', () => {
  const g = fixture();
  g.players[1].hand = [karamas[0]];
  const pending = declare(g);
  pending.pendingFremenMove!.turn--;
  const before = structuredClone(pending);
  assert.throws(() => applyAction(pending, 'e', { type: 'passResponse' }));
  assert.deepEqual(pending, before);
});

void test('all four defender bots act on public threatened forces without reading the Fremen hand or balance', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[1].hand = [karamas[0]];
    g.players[1].forces = { [target(2)]: 2 };
    g.players[1].reserves = 18;
    const pending = declare(g);
    const view = viewGame(pending, 'e');
    view.players[1].bot = difficulty;
    const snapshot = structuredClone(view);
    const actions = botActions(view);
    assert.deepEqual(view, snapshot);
    assert.equal(actions.length, 1);
    const cancels = ['Hard', 'Brutal'].includes(difficulty);
    assert.equal(actions[0].type, cancels ? 'card' : 'passResponse');
    if (cancels) assert.equal(actions[0].mode, 'cancel');
    const changed = restore(pending);
    changed.players[0].spice = 9999;
    changed.players[0].hand = [
      baseDeck().find((c) => c.kind === 'projectile')!,
    ];
    const changedView = viewGame(changed, 'e');
    changedView.players[1].bot = difficulty;
    assert.deepEqual(botActions(changedView), actions);
    const done = applyAction(pending, 'e', actions[0]);
    assert.equal(done.players[0].moved, cancels ? 0 : 1);
    conserved(done);
  }
});

void test('canceling Fremen range during two-group Ornithopter preserves its event and allows a shorter first group', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[1].hand = [karamas[0]];
    const card = richeseCards().find((c) => c.effect === 'ornithopter')!;
    g.players[0].hand = [card];
    const pending = applyAction(g, 'f', {
      ...moveAction(),
      amount: 2,
      movementCard: card.id,
      ornithopter: 'twoGroups',
    });
    assert.equal(pending.response?.kind, 'fremenMovement');
    const event = pending.ornithopter!.event;
    const denied = cancel(restore(pending));
    assert.equal(denied.ornithopter!.event, event);
    assert.equal(denied.ornithopter!.completed, 0);
    const view = viewGame(denied, 'f');
    view.players[0].bot = difficulty;
    const moves = botActions(view).filter((a) => a.type === 'move');
    assert.ok(moves.length > 0);
    for (const a of moves) {
      assert.equal(a.ornithopterEvent, event);
      assert.ok(
        distance(
          String(a.from),
          location(String(a.territory), Number(a.sector)),
        ) <= 1,
      );
      assert.doesNotThrow(() => applyAction(denied, 'f', a));
    }
    const first = applyAction(denied, 'f', {
      ...moveAction(1),
      amount: 2,
      ornithopterEvent: event,
    });
    assert.equal(first.ornithopter!.completed, 1);
    assert.equal(viewGame(first, 'f').players[0].fremenMovementBlocked, false);
    const second = applyAction(restore(first), 'f', {
      ...moveAction(2),
      amount: 2,
      ornithopterEvent: event,
    });
    assert.equal(second.players[0].moved, 2);
    assert.equal(second.ornithopter, null);
    assert.equal(second.discard.filter((c) => c.id === card.id).length, 1);
    conserved(second);
  }
});
