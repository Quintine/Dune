import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { gameDistance, location, territory } from '../game/board';

function fixture(advanced = false): Game {
  const g = createGame(
    'WORMRIDEBOT',
    newPlayer('f', 'Rider', 'fremen'),
    advanced,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 1,
    turn: 2,
    storm: 18,
    active: 'f',
    order: ['f', 'e', 'h'],
    spiceSequence: { pile: 1, skipped: [] },
    wormRides: [],
  });
  for (const p of g.players)
    Object.assign(p, { hand: [], forces: {}, reserves: 20, spice: 10 });
  const source = location(
    'the_great_flat',
    territory('the_great_flat').sectors[0],
  );
  g.players[0].forces = { [source]: 4 };
  g.players[0].reserves = 16;
  g.decision = { kind: 'wormRide', player: 'f', territory: 'the_great_flat' };
  return g;
}
function rides(g: Game, difficulty: Difficulty) {
  const view = viewGame(g, 'f');
  view.players[0].bot = difficulty;
  const before = structuredClone(view);
  const actions = botActions(view);
  assert.deepEqual(view, before);
  assert.ok(
    actions.some((a) => a.type === 'decision' && a.accept === false),
    'Declining a ride remains available.',
  );
  for (const a of actions)
    assert.doesNotThrow(
      () => applyAction(g, 'f', a),
      `${difficulty}: ${JSON.stringify(a)}`,
    );
  const accepted = actions.filter((a) => a.accept === true);
  assert.ok(accepted.length > 0);
  return accepted;
}

void test('all profiles exclude a highly ranked worm origin while retaining legal long-distance rides', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      const g = fixture(advanced);
      for (const sector of territory('the_great_flat').sectors)
        g.spice[location('the_great_flat', sector)] = 100;
      const actions = rides(g, difficulty);
      assert.ok(actions.every((a) => a.territory !== 'the_great_flat'));
      const source = Object.keys(g.players[0].forces)[0];
      assert.ok(
        actions.some(
          (a) =>
            gameDistance(
              g,
              source,
              location(String(a.territory), Number(a.sector)),
            ) > 3,
        ),
        'Riding Shai-Hulud has no ordinary ground-movement range cap.',
      );
      if (difficulty !== 'Easy')
        assert.ok(
          actions.some((a) => a.territory === 'arrakeen'),
          'The free Fremen reinforcement radius does not constrain a worm ride.',
        );
    }
});

void test('worm rides obey destination storm, ally and stronghold occupancy even for Advanced Fremen', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      const g = fixture(advanced);
      g.storm = 10;
      g.players[0].ally = 'e';
      g.players[1].ally = 'f';
      g.players[1].forces = { 'carthag:11': 1, 'polar_sink:0': 1 };
      g.players[1].reserves = 18;
      g.players[2].forces = { 'carthag:11': 1 };
      g.players[2].reserves = 19;
      const actions = rides(g, difficulty);
      assert.ok(
        actions.every((a) => a.sector !== 10 && a.territory !== 'carthag'),
      );
      g.spice['polar_sink:0'] = 100;
      if (difficulty !== 'Easy')
        assert.ok(
          rides(g, difficulty).some((a) => a.territory === 'polar_sink'),
          'Allied occupation does not prohibit Polar Sink.',
        );
    }
});

void test('worm rides select all eligible source sectors and preserve unavoidable elite forces while leaving storm forces behind', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true);
    g.storm = 7;
    g.players[0].forces = {
      'pasty_mesa:5': 2,
      'pasty_mesa:6': 2,
      'pasty_mesa:7': 1,
    };
    g.players[0].reserves = 15;
    g.players[0].elites = {
      forces: { 'pasty_mesa:5': 1, 'pasty_mesa:7': 1 },
      reserves: 1,
      tanks: 0,
      revived: 0,
    };
    g.decision = { kind: 'wormRide', player: 'f', territory: 'pasty_mesa' };
    const action = rides(g, difficulty)[0];
    assert.deepEqual(action.forces, { 'pasty_mesa:5': 2, 'pasty_mesa:6': 2 });
    const next = applyAction(g, 'f', action);
    assert.equal(next.players[0].forces['pasty_mesa:7'], 1);
    assert.equal(next.players[0].elites!.forces['pasty_mesa:7'], 1);
    const destination = location(
      String(action.territory),
      Number(action.sector),
    );
    assert.equal(next.players[0].forces[destination], 4);
    assert.equal(next.players[0].elites!.forces[destination], 1);
    assert.equal(next.players[0].reserves, 15);
  }
});
