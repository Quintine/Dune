import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
function fixture() {
  const g = createGame(
    'ORNIREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    false,
    ['choam', 'ecaz'],
  );
  g.players.push(
    newPlayer('m', 'Moritani', 'moritani'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: 'r',
    order: ['r', 'm', 'a'],
    movementRemaining: ['r', 'm', 'a'],
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  hold(g, 'r', 'Ornithopter');
  g.players[0].forces = { 'imperial_basin:10': 3 };
  g.players[0].reserves = 17;
  return g;
}
function hold(g: Game, id: string, name: string) {
  const pile = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const i = pile.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = pile.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(c);
  return c.id;
}
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const first = (g: Game, extra: Partial<Action> = {}) =>
  send(g, 'r', {
    type: 'move',
    movementCard: 'richese-ornithopter',
    ornithopter: 'twoGroups',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
    ...extra,
  });
const second = (g: Game, extra: Partial<Action> = {}) =>
  send(g, 'r', {
    type: 'move',
    ornithopterEvent: g.ornithopter!.event,
    forces: { 'imperial_basin:10': 1 },
    territory: 'carthag',
    sector: 11,
    ...extra,
  });
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();

void test('real Sabotage can discard an entrant hand card while Ornithopter remains in played escrow and its second group waits', () => {
  let g = fixture();
  const victim = hold(g, 'r', 'Shield');
  const offered = hold(g, 'm', 'Snooper');
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === 'sabotage')!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  const before = inventory(g);
  g = first(g);
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  assert.equal(g.ornithopter!.completed, 1);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [victim],
  );
  const paused = structuredClone(g);
  assert.throws(() => second(g));
  assert.deepEqual(g, paused);
  g = send(reload(g), 'm', { type: 'decision', reveal: true });
  assert.equal(g.pendingTerrorEntry?.stage, 'gift');
  assert.deepEqual(
    g.discard.map((c) => c.id),
    [victim],
  );
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.ornithopter!.card.id, 'richese-ornithopter');
  g = send(reload(g), 'm', { type: 'decision', card: offered });
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.players[0].moved, 1);
  g = second(g);
  assert.equal(g.ornithopter, null);
  assert.equal(g.players[0].moved, 2);
  assert.equal(
    g.discard.filter((c) => c.id === 'richese-ornithopter').length,
    1,
  );
  assert.deepEqual(inventory(g), before);
});

void test('fixed card range survives a real CHOAM arrival decision and is not reduced to ordinary one-territory range on reload', () => {
  let g = fixture();
  g.players[1].faction = 'choam';
  g.players[1].forces = { 'hagga_basin:12': 1 };
  g.players[1].reserves = 19;
  const before = inventory(g);
  g = first(g, { ornithopter: 'range3', territory: 'hagga_basin', sector: 12 });
  assert.equal(g.decision?.kind, 'choamMovement');
  assert.equal(g.players[0].moved, 0);
  assert.equal(g.ornithopter!.completed, 0);
  assert.equal(g.pendingChoamMove!.ornithopterRange, true);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  g = send(reload(g), 'm', { type: 'decision', decline: true });
  assert.equal(g.players[0].forces['hagga_basin:12'], 1);
  assert.equal(g.players[0].moved, 1);
  assert.equal(g.ornithopter, null);
  assert.deepEqual(inventory(g), before);
});

void test('canceling genuine Ixian normal-range reliance preserves the played card and permits a revised first group', () => {
  let g = fixture();
  g.advanced = true;
  g.players[0].faction = 'ixians';
  g.players[0].elites = {
    forces: { 'imperial_basin:10': 1 },
    reserves: 6,
    tanks: 0,
    revived: 0,
  };
  const k = hold(g, 'a', 'Karama');
  g = first(g, {
    eliteForces: { 'imperial_basin:10': 1 },
    territory: 'hagga_basin',
    sector: 12,
  });
  assert.equal(g.response?.kind, 'ixMovement');
  const event = g.ornithopter!.event;
  g = send(reload(g), 'a', { type: 'card', mode: 'cancel', card: k });
  assert.equal(g.players[0].moved, 0);
  assert.equal(g.ornithopter!.event, event);
  assert.equal(g.ornithopter!.completed, 0);
  g = send(g, 'r', {
    type: 'move',
    ornithopterEvent: event,
    forces: { 'imperial_basin:10': 1 },
    eliteForces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.players[0].moved, 1);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], 1);
  assert.equal(g.ornithopter!.cohort!.elites['imperial_basin:10'] ?? 0, 0);
  g = second(reload(g));
  assert.equal(g.players[0].moved, 2);
  assert.equal(g.ornithopter, null);
  assert.equal(
    g.discard.filter((c) => c.id === 'richese-ornithopter').length,
    1,
  );
});

void test('unmoved No-Field revelation materializes eligible quota while a moved marker and its revealed forces never requalify', () => {
  for (const moved of [false, true]) {
    let g = fixture();
    g.players[0].noField = createRicheseNoField([
      'opaque-a',
      'opaque-b',
      'opaque-c',
    ]);
    g.players[0].noField = deployRicheseNoField(g.players[0].noField, {
      tokenId: 'opaque-b',
      controller: 'r',
      location: { territory: 'imperial_basin', sector: 10 },
    });
    g.players[0].noFieldEvent = 'marker-original';
    g = first(
      g,
      moved
        ? { forces: {}, noField: 'opaque-b', event: 'marker-original' }
        : {},
    );
    const event = g.ornithopter!.event;
    assert.equal(!!g.ornithopter!.cohort!.noField, !moved);
    g = send(reload(g), 'r', {
      type: 'revealNoField',
      token: 'opaque-b',
      event: g.players[0].noFieldEvent,
    });
    if (moved) {
      const before = structuredClone(g);
      assert.throws(
        () =>
          second(g, {
            forces: { 'arrakeen:10': 1 },
            territory: 'imperial_basin',
            sector: 10,
          }),
        /cohort/,
      );
      assert.deepEqual(g, before);
    } else {
      assert.equal(g.ornithopter!.cohort!.forces['imperial_basin:10'], 5);
      g = second(g, { forces: { 'imperial_basin:10': 5 } });
      assert.equal(g.players[0].forces['carthag:11'], 5);
      assert.equal(g.ornithopter, null);
    }
    assert.ok(event);
    assert.equal(
      g.players[0].reserves +
        g.players[0].tanks +
        Object.values(g.players[0].forces).reduce((a, b) => a + b, 0),
      20,
    );
  }
});

void test('merged arrivals cannot increase typed original quota and a missing restored cohort must fail closed', () => {
  let g = fixture();
  g.players[0].forces = { 'imperial_basin:10': 2, 'arrakeen:10': 1 };
  g = first(g, { forces: { 'imperial_basin:10': 2 } });
  const before = structuredClone(g);
  assert.throws(
    () =>
      second(g, {
        forces: { 'arrakeen:10': 2 },
        territory: 'imperial_basin',
        sector: 10,
      }),
    /cohort/,
  );
  assert.deepEqual(g, before);
  const broken = reload(g);
  delete broken.ornithopter!.cohort;
  const snapshot = structuredClone(broken);
  assert.throws(
    () =>
      second(broken, {
        forces: { 'arrakeen:10': 2 },
        territory: 'imperial_basin',
        sector: 10,
      }),
    /cohort|inconsistent|custody/,
  );
  assert.deepEqual(broken, snapshot);
});

void test('opponent projections do not expose unmoved cohort marker identity or denomination and endMovement discards escrow once', () => {
  const views = [];
  for (const value of [0, 3, 5] as const) {
    let g = fixture();
    const ids = ['private-zero', 'private-three', 'private-five'];
    g.players[0].noField = createRicheseNoField(ids);
    g.players[0].noField = deployRicheseNoField(g.players[0].noField, {
      tokenId: ids[[0, 3, 5].indexOf(value)],
      controller: 'r',
      location: { territory: 'carthag', sector: 11 },
    });
    g.players[0].noFieldEvent = 'marker-private';
    g = first(g);
    const other = viewGame(g, 'a');
    assert.equal(other.ornithopter, null);
    for (const id of ids)
      assert.equal(JSON.stringify(other).includes(id), false);
    views.push(other);
    assert.ok(viewGame(g, 'r').ornithopter!.active!.cohort!.noField);
    const before = inventory(g);
    g = send(reload(g), 'r', { type: 'endMovement' });
    assert.equal(g.ornithopter, null);
    assert.equal(
      g.discard.filter((c) => c.id === 'richese-ornithopter').length,
      1,
    );
    assert.deepEqual(inventory(g), before);
  }
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
});
