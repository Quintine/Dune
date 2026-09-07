import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import {
  PLAYER_CIRCLE_SECTORS,
  STORM_START_SECTOR,
} from '../game/player-positions';

// Primary evidence: GF9 base rulebook pp4,6–7,22, and Nov2020 FAQ p1.
// https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf
// https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf
// The printed Meridian Storm Start is sector1 in this repository's board;
// bottom circle1 lies over Cielago South sector2, then circles proceed CCW.
const factions: FactionId[] = [
  'atreides',
  'harkonnen',
  'emperor',
  'guild',
  'fremen',
  'beneGesserit',
];
function lobby(count = 2, positions?: number[]) {
  let g = createGame('STORM234', newPlayer('p0', 'Player 0', factions[0]));
  for (let i = 0; i < count; i++) {
    if (i) joinGame(g, newPlayer(`p${i}`, `Player ${i}`, factions[i]));
    if (positions && g.playerPositions![`p${i}`] !== positions[i])
      g = applyAction(g, `p${i}`, {
        type: 'seatPosition',
        position: positions[i],
      });
  }
  return g;
}
function started(count = 2, positions?: number[]) {
  let g = lobby(count, positions);
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'p0', { type: 'start' });
  const bg = g.players.find((p) => p.faction === 'beneGesserit');
  if (bg)
    g = applyAction(g, bg.id, {
      type: 'predict',
      faction: 'atreides',
      turn: 10,
    });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  const fremen = g.players.find((p) => p.faction === 'fremen');
  if (fremen)
    g = applyAction(g, fremen.id, {
      type: 'fremenSetup',
      placements: { sietch_tabr: 4, false_wall_south: 3, false_wall_west: 3 },
    });
  assert.equal(g.status, 'playing');
  return g;
}
function confirmStorm(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function reveal(g: Game, a: number, b: number) {
  g = applyAction(g, g.stormDialers[0], { type: 'stormDial', amount: a });
  return applyAction(g, g.stormDialers[1], { type: 'stormDial', amount: b });
}
function forceTotal(g: Game) {
  return g.players.map(
    (p) =>
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
  );
}

void test('new tables use the six fixed printed circles and the Meridian Storm Start', () => {
  assert.equal(STORM_START_SECTOR, 1);
  assert.deepEqual(PLAYER_CIRCLE_SECTORS, [2, 5, 8, 11, 14, 17]);
  for (let count = 2; count <= 6; count++) {
    const g = lobby(count),
      before = JSON.stringify(g);
    assert.equal(g.storm, 1);
    assert.deepEqual(
      viewGame(g, 'p0').playerPositions,
      Object.fromEntries(g.players.map((p, i) => [p.id, i + 1])),
    );
    assert.equal(JSON.stringify(g), before, 'read projection is pure');
  }
});

void test('only the owner can choose an unoccupied circle and readiness resets', () => {
  let g = lobby(3);
  g.players[2].bot = 'Easy';
  g.players.forEach((p) => (p.ready = true));
  for (const position of [0, 7, -1, 1.5, '4', NaN, Infinity]) {
    const before = JSON.stringify(g);
    assert.throws(
      () => applyAction(g, 'p0', { type: 'seatPosition', position }),
      /Player circle/,
    );
    assert.equal(JSON.stringify(g), before);
  }
  assert.throws(
    () =>
      applyAction(g, 'p0', { type: 'seatPosition', position: 4, target: 'p1' }),
    /own/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'seatPosition', position: 2 }),
    /occupied/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'seatPosition', position: 1 }),
    /already/,
  );
  g = applyAction(g, 'p0', { type: 'seatPosition', position: 4 });
  assert.deepEqual(g.playerPositions, { p0: 4, p1: 2, p2: 3 });
  assert.deepEqual(
    g.players.map((p) => p.ready),
    [false, false, true],
  );
  assert.deepEqual(viewGame(g, 'p1').playerPositions, g.playerPositions);
});

void test('join and bot replacement reuse vacancies without moving existing circles', () => {
  let g = lobby(2, [6, 4]);
  g = applyAction(g, 'p0', {
    type: 'addBot',
    faction: 'emperor',
    difficulty: 'Medium',
  });
  const bot = g.players.find((p) => p.bot)!;
  assert.deepEqual(g.playerPositions, { p0: 6, p1: 4, [bot.id]: 1 });
  g = applyAction(g, 'p0', { type: 'removeBot', target: bot.id });
  assert.deepEqual(g.playerPositions, { p0: 6, p1: 4 });
  joinGame(g, newPlayer('replacement', 'Replacement', 'emperor'));
  assert.deepEqual(g.playerPositions, { p0: 6, p1: 4, replacement: 1 });
  g = applyAction(g, 'p1', { type: 'faction', faction: 'guild' });
  assert.deepEqual(g.playerPositions, { p0: 6, p1: 4, replacement: 1 });
  assert.throws(
    () => joinGame(g, newPlayer('replacement', 'Retry', 'fremen')),
    /Already seated/,
  );
});

void test('start chooses both dialers from occupied circles beside Storm Start, not player-array endpoints', () => {
  for (const count of [2, 3, 4, 5, 6]) {
    const assigned = [3, 6, 1, 5, 2, 4].slice(0, count);
    const g = started(count, assigned);
    const expected = g.players
      .map((p, i) => ({ id: p.id, circle: assigned[i] }))
      .sort((a, b) => a.circle - b.circle)
      .map((p) => p.id);
    assert.deepEqual(g.order, expected);
    assert.deepEqual(g.stormDialers, [expected[0], expected.at(-1)]);
    assert.deepEqual(g.lastBattle, g.stormDialers);
    assert.equal(g.storm, 1);
    assert.throws(
      () => applyAction(g, 'p0', { type: 'seatPosition', position: 4 }),
      /not available|Unknown action/,
    );
  }
});

for (const [a, b, final] of [
  [0, 0, 1],
  [0, 1, 2],
  [17, 0, 18],
  [18, 0, 1],
  [19, 20, 4],
  [20, 20, 5],
]) {
  void test(`first storm ${a}+${b} moves from sector1 to sector${final}, including zero and complete circuits`, () => {
    let g = started(3, [3, 6, 1]);
    const [first, second] = g.stormDialers;
    assert.throws(
      () => applyAction(g, first, { type: 'stormDial', amount: 21 }),
      /Storm dial/,
    );
    assert.throws(
      () => applyAction(g, first, { type: 'stormDial', amount: -1 }),
      /Storm dial/,
    );
    assert.throws(
      () => applyAction(g, 'p0', { type: 'stormDial', amount: 1 }),
      /not dialing/,
    );
    g = applyAction(g, first, { type: 'stormDial', amount: a });
    assert.equal(viewGame(g, second).stormRevealed, null);
    assert.equal('stormDials' in viewGame(g, second), false);
    assert.equal(g.stormPending, null);
    assert.throws(
      () => applyAction(g, first, { type: 'stormDial', amount: a }),
      /locked/,
    );
    g = JSON.parse(JSON.stringify(g)) as Game;
    g = applyAction(g, second, { type: 'stormDial', amount: b });
    assert.deepEqual(viewGame(g, 'p0').stormRevealed, {
      [first]: a,
      [second]: b,
    });
    assert.equal(g.stormPending, a + b);
    assert.equal(g.storm, 1, 'movement waits for confirmations');
    g = confirmStorm(g);
    assert.equal(g.storm, final);
    assert.equal(g.phase, 1);
    assert.deepEqual(g.stormDials, {});
    assert.deepEqual(forceTotal(g), [20, 20, 20]);
  });
}

void test('every storm sector chooses the next occupied printed circle counterclockwise, skipping its current circle', () => {
  const firstBySector = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 0, 0];
  const initial = started(6);
  for (let sector = 1; sector <= 18; sector++) {
    let g = structuredClone(initial);
    g.storm = sector;
    g.stormPending = 0;
    g = confirmStorm(g);
    const first = firstBySector[sector - 1];
    assert.deepEqual(
      g.order,
      Array.from({ length: 6 }, (_, i) => `p${(first + i) % 6}`),
      `sector ${sector}`,
    );
  }
});

void test('sparse tables skip empty circles without redistributing four or five players around the map', () => {
  for (const positions of [
    [1, 3, 5, 6],
    [1, 2, 3, 5, 6],
  ]) {
    let g = started(positions.length, positions);
    g.storm = 8;
    g.stormPending = 0;
    g = confirmStorm(g);
    const circles = g.order.map((id) => g.playerPositions![id]);
    assert.deepEqual(
      circles,
      positions.length === 4 ? [5, 6, 1, 3] : [5, 6, 1, 2, 3],
    );
  }
});

void test('first-storm damage follows the traversed sectors; normal Basic starting forces remain sheltered', () => {
  let g = started(6);
  const startingForces = g.players.map((p) => structuredClone(p.forces));
  g.spice = { 'meridian:1': 4, 'cielago_south:2': 7 };
  g = confirmStorm(reveal(g, 20, 20));
  assert.deepEqual(
    g.players.map((p) => p.forces),
    startingForces,
  );
  assert.deepEqual(g.spice, {});
  assert.deepEqual(forceTotal(g), [20, 20, 20, 20, 20, 20]);
  // Exercise the published damage rule if a force is present in exposed sand.
  g = started();
  g.players[0].forces['arrakeen:10']--;
  g.players[0].forces['cielago_south:2'] = 1;
  g.spice = { 'meridian:1': 4, 'cielago_south:2': 7 };
  g = confirmStorm(reveal(g, 0, 1));
  assert.equal(g.players[0].tanks, 1);
  assert.equal(g.players[0].forces['cielago_south:2'] ?? 0, 0);
  assert.deepEqual(g.spice, { 'meridian:1': 4 });
});

void test('Weather Control may replace revealed first dials, including zero, without changing the Storm Start', () => {
  for (const distance of [0, 2]) {
    let g = started();
    const weather = baseDeck().find((c) => c.effect === 'weather')!;
    placeFixtureHand(g, 0, [weather]);
    g = reveal(g, 20, 20);
    g = applyAction(g, 'p1', { type: 'ready' });
    g = applyAction(g, 'p0', {
      type: 'card',
      card: weather.id,
      amount: distance,
    });
    assert.deepEqual(g.ready, []);
    assert.equal(g.storm, 1);
    g = confirmStorm(g);
    assert.equal(g.storm, 1 + distance);
    assert.ok(g.discard.some((c) => c.id === weather.id));
  }
});

void test('later Basic storms use the last battle-wheel users and the 1–3 dial limits', () => {
  let g = confirmStorm(reveal(started(4), 0, 0));
  g.phase = 8;
  g.lastBattle = ['p2', 'p1'];
  g.ready = [];
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 0);
  assert.deepEqual(g.stormDialers, ['p2', 'p1']);
  for (const amount of [0, 4, 20])
    assert.throws(
      () => applyAction(g, 'p2', { type: 'stormDial', amount }),
      /Storm dial/,
    );
  g = confirmStorm(reveal(g, 1, 3));
  assert.equal(g.storm, 5);
  assert.deepEqual(g.order, ['p2', 'p3', 'p0', 'p1']);
});

void test('with no battles, the same last wheel users dial the next Basic storm', () => {
  let g = confirmStorm(reveal(started(4, [3, 6, 1, 5]), 0, 0));
  const dialers = [...g.stormDialers];
  g.phase = 8;
  g.ready = [];
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.turn, 2);
  assert.deepEqual(g.stormDialers, dialers);
  assert.deepEqual(g.stormDialers, ['p2', 'p1']);
});

void test('legacy reads derive circles without mutation and the first authoritative action preserves pending state', () => {
  let g = started(4);
  delete g.playerPositions;
  g.turn = 3;
  g.phase = 1;
  g.storm = 7;
  g.order = ['p3', 'p1', 'p0', 'p2'];
  g.stormDialers = ['p1', 'p3'];
  g.stormDials = { p1: 2 };
  g.decision = {
    kind: 'wormProtection',
    player: 'p0',
    territory: 'cielago_south',
    ally: 'p1',
  };
  const before = structuredClone(g);
  assert.deepEqual(viewGame(g, 'p1').playerPositions, {
    p0: 1,
    p1: 2,
    p2: 3,
    p3: 4,
  });
  assert.deepEqual(g, before);
  g = applyAction(g, 'p0', { type: 'advanceBots' });
  assert.equal(g.storm, before.storm);
  assert.equal(g.phase, before.phase);
  assert.deepEqual(g.order, before.order);
  assert.deepEqual(g.stormDialers, before.stormDialers);
  assert.deepEqual(g.stormDials, before.stormDials);
  assert.deepEqual(g.decision, before.decision);
  assert.deepEqual(
    g.players.map((p) => p.hand),
    before.players.map((p) => p.hand),
  );
  assert.equal(
    g.log.filter((entry) =>
      entry.text.startsWith('Assigned printed player circles'),
    ).length,
    1,
  );
  g = applyAction(JSON.parse(JSON.stringify(g)) as Game, 'p0', {
    type: 'advanceBots',
  });
  assert.equal(
    g.log.filter((entry) =>
      entry.text.startsWith('Assigned printed player circles'),
    ).length,
    1,
  );
  g.phase = 0;
  g.decision = null;
  g.stormPending = 1;
  g.ready = [];
  g = confirmStorm(g);
  assert.equal(g.storm, 8);
  assert.deepEqual(
    g.order,
    ['p3', 'p0', 'p1', 'p2'],
    'next completed storm uses corrected circles',
  );
});

void test('an old lobby normalizes its positions and begins at the corrected Storm Start', () => {
  let g = lobby(3);
  delete g.playerPositions;
  g.storm = 18;
  assert.equal(viewGame(g, 'p0').storm, 1);
  assert.equal(g.storm, 18, 'lobby projection does not write saved state');
  g = applyAction(g, 'p0', { type: 'seatPosition', position: 6 });
  assert.equal(g.storm, 1);
  assert.deepEqual(g.playerPositions, { p0: 6, p1: 2, p2: 3 });
  assert.equal(
    g.log.filter((entry) =>
      entry.text.startsWith('Assigned printed player circles'),
    ).length,
    0,
  );
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'p0', { type: 'start' });
  assert.equal(g.storm, 1);
  assert.deepEqual(g.stormDialers, ['p1', 'p0']);
});
