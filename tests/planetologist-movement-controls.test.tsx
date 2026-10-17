import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { planetologistMoveDraft } from '../components/planetologist-movement';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { location } from '../game/board';

const destination = 'polar_sink';
const rangeSource = location('false_wall_west', 16);
const gatherSources = [
  location('wind_pass', 14),
  location('wind_pass_north', 17),
] as const;

function fixture(): Game {
  const g = createGame('PLANETUI', newPlayer('p', 'Pilot', 'emperor'), true);
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


void test('range and gather controls settle the selected physical normal and elite counters through the engine', () => {
  const g = fixture();
  const view = viewGame(g, 'p');
  const range = planetologistMoveDraft(
    view,
    'range',
    destination,
    0,
    { [rangeSource]: 2 },
    { [rangeSource]: 1 },
  );
  assert.equal(range.blocked, null);
  const ranged = applyAction(structuredClone(g), 'p', range.action!);
  assert.equal(ranged.players[0].forces[`${destination}:0`], 2);
  assert.equal(ranged.players[0].elites!.forces[`${destination}:0`], 1);

  const gather = planetologistMoveDraft(
    view,
    'gather',
    destination,
    0,
    { [gatherSources[0]]: 2, [gatherSources[1]]: 3 },
    { [gatherSources[0]]: 1, [gatherSources[1]]: 2 },
  );
  assert.equal(gather.blocked, null);
  const gathered = applyAction(structuredClone(g), 'p', gather.action!);
  assert.equal(gathered.players[0].forces[`${destination}:0`], 5);
  assert.equal(gathered.players[0].elites!.forces[`${destination}:0`], 3);
});

