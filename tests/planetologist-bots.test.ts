import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { gameDistance, location, splitLocation } from '../game/board';

const destination = location('polar_sink', 0);
const rangeSource = location('false_wall_west', 16);
const gatherSources = [
  location('wind_pass', 14),
  location('wind_pass_north', 17),
] as const;

function fixture(code = 'PLANETBOT'): Game {
  const g = createGame(code, newPlayer('p', 'Pilot', 'emperor'), true);
  g.players.push(newPlayer('o', 'Observer', 'atreides'));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['p', 'o'],
    active: 'p',
    movementRemaining: ['p', 'o'],
  });
  for (const player of g.players) {
    player.hand = [];
    player.forces = {};
    player.reserves = 20;
    player.spice = 10;
  }
  const pilot = g.players[0];
  pilot.forces = {
    [rangeSource]: 2,
    [gatherSources[0]]: 2,
    [gatherSources[1]]: 3,
  };
  pilot.reserves = 13;
  pilot.shipped = true;
  pilot.elites = {
    forces: {
      [rangeSource]: 1,
      [gatherSources[0]]: 1,
      [gatherSources[1]]: 2,
    },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  g.spice[destination] = 100;
  g.leaderSkills = {
    deck: LEADER_SKILL_CARDS.map((card) => card.id).filter(
      (id) => id !== 'planetologist',
    ),
    offers: {},
    assignments: [
      {
        skill: 'planetologist',
        leader: 'emperor-0',
        owner: 'p',
      },
    ],
  };
  return g;
}

function rangeFixture(code: string) {
  const g = fixture(code);
  g.players[0].forces = { [rangeSource]: 2 };
  g.players[0].reserves = 18;
  g.players[0].elites!.forces = { [rangeSource]: 1 };
  g.players[0].elites!.reserves = 4;
  return g;
}

function gatherFixture(code: string) {
  const g = fixture(code);
  delete g.players[0].forces[rangeSource];
  g.players[0].reserves = 15;
  delete g.players[0].elites!.forces[rangeSource];
  g.players[0].elites!.reserves = 2;
  return g;
}

function projection(g: Game, difficulty: Difficulty): GameView {
  const view = viewGame(g, 'p');
  view.players[0].bot = difficulty;
  return view;
}

void test('all profiles propose and can execute both Planetologist movement alternatives', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    const view = projection(g, difficulty);
    const before = structuredClone(view);
    const moves = botActions(view).filter(
      (action) =>
        action.type === 'move' &&
        (action.planetologist === 'range' || action.planetologist === 'gather'),
    );
    assert.deepEqual(view, before, `${difficulty} mutated its private view`);

    const range = moves.find(
      (action) =>
        action.planetologist === 'range' &&
        action.from === rangeSource &&
        gameDistance(
          g,
          rangeSource,
          location(String(action.territory), Number(action.sector)),
          (key) => splitLocation(key).sector === g.storm,
        ) === 2,
    );
    assert.ok(range, `${difficulty} omitted the boosted-range branch`);
    const rangeDestination = location(
      String(range.territory),
      Number(range.sector),
    );
    const ranged = applyAction(structuredClone(g), 'p', range);
    assert.equal(ranged.players[0].forces[rangeDestination], 2);
    assert.equal(ranged.players[0].elites!.forces[rangeDestination], 1);

    const gather = moves.find(
      (action) =>
        action.planetologist === 'gather' &&
        location(String(action.territory), Number(action.sector)) ===
          destination &&
        gatherSources.every(
          (source) =>
            Number((action.forces as Record<string, number>)[source]) > 0,
        ),
    );
    assert.ok(gather, `${difficulty} omitted the two-origin branch`);
    assert.deepEqual(
      new Set(
        Object.keys(gather.forces as Record<string, number>).map(
          (source) => splitLocation(source).territory,
        ),
      ),
      new Set(['wind_pass', 'wind_pass_north']),
    );
    const gathered = applyAction(structuredClone(g), 'p', gather);
    assert.equal(gathered.players[0].forces[destination], 5);
    assert.equal(gathered.players[0].elites!.forces[destination], 3);
    assert.equal(
      Object.values(gathered.players[0].forces).reduce(
        (total, count) => total + count,
        0,
      ),
      7,
    );
    assert.equal(
      Object.values(gathered.players[0].elites!.forces).reduce(
        (total, count) => total + count,
        0,
      ),
      4,
    );
  }
});

void test('each profile actually chooses a useful Planetologist move before ordinary ground moves', () => {
  for (const difficulty of DIFFICULTIES) {
    const rangeGame = rangeFixture(difficulty === 'Easy' ? 'PR3' : 'PR0');
    const range = botActions(projection(rangeGame, difficulty))[0];
    assert.equal(range.type, 'move', difficulty);
    assert.equal(range.planetologist, 'range', difficulty);
    assert.equal(range.from, rangeSource, difficulty);
    assert.equal(
      location(String(range.territory), Number(range.sector)),
      destination,
      difficulty,
    );
    assert.doesNotThrow(() => applyAction(rangeGame, 'p', range));

    const gatherGame = gatherFixture(difficulty === 'Easy' ? 'PG16' : 'PG0');
    const gather = botActions(projection(gatherGame, difficulty))[0];
    assert.equal(gather.type, 'move', difficulty);
    assert.equal(gather.planetologist, 'gather', difficulty);
    assert.equal(
      location(String(gather.territory), Number(gather.sector)),
      destination,
      difficulty,
    );
    assert.deepEqual(
      new Set(Object.keys(gather.forces as Record<string, number>)),
      new Set(gatherSources),
      difficulty,
    );
    assert.doesNotThrow(() => applyAction(gatherGame, 'p', gather));
  }
});

void test('ordinary callers keep ordinary range and an unavailable skill creates no special bot actions', () => {
  const g = fixture();
  g.leaderSkills!.assignments = [];
  g.leaderSkills!.deck.push('planetologist');
  for (const difficulty of DIFFICULTIES) {
    const actions = botActions(projection(g, difficulty));
    assert.equal(
      actions.some((action) => action.planetologist !== undefined),
      false,
      difficulty,
    );
    assert.equal(
      actions.some(
        (action) =>
          action.type === 'move' &&
          action.from === rangeSource &&
          location(String(action.territory), Number(action.sector)) ===
            destination,
      ),
      false,
      `${difficulty} received the unavailable extra range`,
    );
  }
});

void test('bots do not propose the movement profile with an expansion faction present', () => {
  const g = fixture();
  g.players[1].faction = 'ixians';
  for (const difficulty of DIFFICULTIES)
    assert.equal(
      botActions(projection(g, difficulty)).some(
        (action) => action.planetologist !== undefined,
      ),
      false,
      difficulty,
    );
});
