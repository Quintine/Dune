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
import {
  TERRITORIES,
  gameDistance,
  location,
  splitLocation,
} from '../game/board';

const karamas = baseDeck().filter((c) => c.effect === 'karama');
const source = 'pasty_mesa:5';
function fixture() {
  const g = createGame(
    'FREMENREVIEW',
    newPlayer('f', 'Fremen', 'fremen'),
    true,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('c', 'CHOAM', 'choam'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'f',
    order: ['f', 'e', 'c'],
    movementRemaining: ['f', 'e', 'c'],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      spice: 10,
      hand: [],
      shipped: true,
    });
  g.players[0].forces = { [source]: 4 };
  g.players[0].reserves = 16;
  g.players[0].elites = {
    forces: { [source]: 1 },
    reserves: 2,
    tanks: 0,
    revived: 0,
  };
  g.players[1].hand = [karamas[0]];
  return g;
}
function destination(g: Game, range: number, origins = [source]) {
  const found = TERRITORIES.filter((t) => t.type === 'sand')
    .flatMap((t) =>
      t.sectors.filter((s) => s !== 18).map((s) => location(t.id, s)),
    )
    .find((to) =>
      origins.every(
        (from) =>
          gameDistance(g, from, to, (k) => splitLocation(k).sector === 18) ===
          range,
      ),
    );
  assert.ok(found);
  return splitLocation(found);
}
function move(g: Game, range = 2, extra: Partial<Action> = {}) {
  return applyAction(g, 'f', {
    type: 'move',
    from: source,
    amount: 2,
    ...destination(g, range),
    ...extra,
  });
}
const restore = (g: Game): Game => JSON.parse(JSON.stringify(g));
const cancel = (g: Game) =>
  applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karamas[0].id });

void test('multi-sector normal/elite groups retain exact custody through Fremen allowance', () => {
  const g = fixture(),
    f = g.players[0];
  f.forces = { [source]: 3, 'pasty_mesa:6': 3 };
  f.reserves = 14;
  f.elites = {
    forces: { [source]: 1, 'pasty_mesa:6': 1 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  const to = destination(g, 2, [source, 'pasty_mesa:6']);
  const pending = applyAction(g, 'f', {
    type: 'move',
    forces: { [source]: 2, 'pasty_mesa:6': 2 },
    eliteForces: { [source]: 1, 'pasty_mesa:6': 1 },
    ...to,
  });
  assert.equal(pending.response?.kind, 'fremenMovement');
  assert.deepEqual(pending.players[0].forces, f.forces);
  const done = applyAction(restore(pending), 'e', { type: 'passResponse' });
  assert.deepEqual(done.players[0].forces, {
    [source]: 1,
    'pasty_mesa:6': 1,
    [location(to.territory, to.sector)]: 4,
  });
  assert.deepEqual(done.players[0].elites!.forces, {
    [location(to.territory, to.sector)]: 2,
  });
  assert.equal(done.players[0].elites!.reserves, 1);
  assert.equal(done.players[0].reserves, 14);
  assert.equal(done.players[0].moved, 1);
});

void test('restored mismatched group metadata is rejected by explicit and automatic Fremen continuations without mutations', () => {
  const initial = move(fixture());
  const corruptions: ((g: Game) => void)[] = [
    (g) => {
      g.pendingFremenMove!.move++;
    },
    (g) => {
      g.pendingFremenMove!.order.total++;
      g.response!.amount = Number(g.response!.amount) + 1;
    },
    (g) => {
      g.pendingFremenMove!.order.elite++;
    },
    (g) => {
      g.pendingFremenMove!.order.group.push([
        ...g.pendingFremenMove!.order.group[0],
      ]);
    },
    (g) => {
      g.response!.location = 'carthag:11';
    },
    (g) => {
      g.pendingFremenMove!.order.origin = 'red_chasm';
    },
  ];
  for (const corrupt of corruptions) {
    const g = restore(initial);
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => applyAction(g, 'e', { type: 'passResponse' }));
    assert.deepEqual(g, before);
    g.response!.passed = g.players.map((p) => p.id);
    const automaticBefore = structuredClone(g);
    assert.throws(() => normalizeAutomaticGame(g));
    assert.deepEqual(g, automaticBefore);
  }
});

void test('canceling the second distinct Ornithopter group preserves completed first-group custody and forbids reusing arrivals', () => {
  const g = fixture();
  const card = richeseCards().find((c) => c.effect === 'ornithopter')!;
  g.players[0].hand = [card];
  const first = move(g, 1, {
    movementCard: card.id,
    ornithopter: 'twoGroups',
    elite: 1,
  });
  assert.equal(first.players[0].moved, 1);
  assert.equal(first.ornithopter!.completed, 1);
  const event = first.ornithopter!.event;
  const second = move(first, 2, { ornithopterEvent: event, elite: 0 });
  assert.equal(second.pendingFremenMove!.move, 1);
  const denied = cancel(restore(second));
  assert.deepEqual(denied.players[0].forces, first.players[0].forces);
  assert.deepEqual(denied.players[0].elites, first.players[0].elites);
  assert.deepEqual(denied.ornithopter!.cohort, first.ornithopter!.cohort);
  assert.equal(denied.ornithopter!.completed, 1);
  assert.equal(denied.players[0].moved, 1);
  assert.deepEqual(denied.players[0].fremenMovementBlocked, {
    turn: 2,
    move: 1,
  });
  const arrived = destination(g, 1);
  assert.throws(
    () =>
      applyAction(denied, 'f', {
        type: 'move',
        from: location(arrived.territory, arrived.sector),
        amount: 2,
        territory: 'pasty_mesa',
        sector: 5,
        ornithopterEvent: event,
        elite: 1,
      }),
    /original unmoved cohort/,
  );
  const done = move(restore(denied), 1, { ornithopterEvent: event, elite: 0 });
  assert.equal(done.players[0].moved, 2);
  assert.equal(done.ornithopter, null);
  assert.equal(
    done.players[0].forces[location(arrived.territory, arrived.sector)],
    4,
  );
  assert.equal(
    done.players[0].elites!.forces[location(arrived.territory, arrived.sector)],
    1,
  );
  assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
});

void test('legal city access gained by an unspent allied shipment remains independent after Fremen range cancellation', () => {
  const g = fixture();
  const guild = newPlayer('g', 'Guild', 'guild');
  guild.ally = 'f';
  guild.spice = 10;
  g.players.push(guild);
  g.order.push('g');
  g.movementRemaining!.push('g');
  g.players[0].ally = 'g';
  g.players[0].shipped = false;
  const denied = cancel(move(g));
  assert.equal(denied.players[0].shipped, false);
  assert.equal(denied.players[0].moved, 0);
  const access = applyAction(restore(denied), 'f', {
    type: 'guildShip',
    from: 'reserves',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(access.players[0].forces['arrakeen:10'], 1);
  assert.equal(access.players[0].moved, 0);
  assert.equal(viewGame(access, 'f').players[0].fremenMovementBlocked, true);
  const done = move(access, 3, { elite: 1 });
  assert.equal(done.players[0].moved, 1);
  assert.equal(done.pendingFremenMove, null);
  assert.equal(done.response, null);
});

void test('Fremen allowance feeds the exact group into CHOAM Baliset and cancellation resumes it once', () => {
  for (const block of [false, true]) {
    const g = fixture(),
      to = destination(g, 2),
      key = location(to.territory, to.sector);
    const baliset = baseDeck().find((c) => c.name === 'Baliset')!;
    g.players[2].forces = { [key]: 1 };
    g.players[2].reserves = 19;
    g.players[2].hand = [baliset];
    g.players[0].hand = [karamas[1]];
    const pending = move(g, 2, { elite: 1 });
    const choam = applyAction(restore(pending), 'e', { type: 'passResponse' });
    assert.equal(choam.pendingFremenMove, null);
    assert.equal(choam.decision?.kind, 'choamMovement');
    assert.deepEqual(choam.players[0].forces, g.players[0].forces);
    assert.equal(choam.players[0].moved, 0);
    assert.equal('pendingChoamMove' in viewGame(choam, 'c'), false);
    const requested = applyAction(choam, 'c', {
      type: 'card',
      mode: 'choam',
      card: baliset.id,
      target: 'f',
      territory: to.territory,
    });
    assert.equal(requested.response?.kind, 'choamWorthless');
    let done: Game;
    if (block) {
      done = applyAction(requested, 'f', { type: 'passResponse' });
      if (done.response)
        done = applyAction(done, 'e', { type: 'passResponse' });
      assert.equal(done.players[0].moved, 0);
      assert.deepEqual(done.players[0].forces, g.players[0].forces);
      assert.equal(done.players[2].hand.length, 0);
    } else {
      done = applyAction(restore(requested), 'f', {
        type: 'card',
        mode: 'cancel',
        card: karamas[1].id,
      });
      assert.equal(done.players[0].moved, 1);
      assert.equal(done.players[0].forces[key], 2);
      assert.equal(done.players[0].elites!.forces[key], 1);
      assert.equal(done.players[2].hand[0].id, baliset.id);
    }
    assert.equal(done.pendingChoamMove, null);
    assert.equal(done.pendingFremenMove, null);
    assert.equal(done.players[0].fremenMovementBlocked, undefined);
    assert.deepEqual(normalizeAutomaticGame(restore(done)), done);
  }
});
