import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  PlanetologistMovement,
  planetologistMoveDraft,
} from '../components/planetologist-movement';
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

function markup(g: Game, viewer = 'p', busy = false) {
  return renderToStaticMarkup(
    createElement(PlanetologistMovement, {
      game: viewGame(g, viewer),
      act() {},
      busy,
      destination,
      sector: 0,
    }),
  );
}

void test('the owner sees both modes, physical source controls and the shared board destination', () => {
  const g = fixture();
  const html = markup(g);
  assert.match(html, /Planetologist movement/);
  assert.match(html, /One territory farther, maximum three/);
  assert.match(html, /Gather from two territories/);
  assert.match(html, /Destination: Polar Sink, sector 0/);
  assert.match(html, /False Wall West, sector 16 · 2 forces/);
  assert.match(html, /Elite from this group · 1 available/);
  assert.match(html, /Select forces from one territory/);
  assert.match(html, /disabled=""/);
  assert.equal(markup(g, 'o'), '');
  assert.ok((markup(g, 'p', true).match(/disabled=""/g) ?? []).length >= 2);
});

void test('drafts send only the public mode and exact physical counts, and both settle through the engine', () => {
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
  assert.deepEqual(range.action, {
    type: 'move',
    planetologist: 'range',
    forces: { [rangeSource]: 2 },
    eliteForces: { [rangeSource]: 1 },
    territory: destination,
    sector: 0,
  });
  assert.equal(Object.hasOwn(range.action!, 'leader'), false);
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
  assert.deepEqual(gather.action, {
    type: 'move',
    planetologist: 'gather',
    forces: { [gatherSources[0]]: 2, [gatherSources[1]]: 3 },
    eliteForces: { [gatherSources[0]]: 1, [gatherSources[1]]: 2 },
    territory: destination,
    sector: 0,
  });
  assert.equal(Object.hasOwn(gather.action!, 'leader'), false);
  const gathered = applyAction(structuredClone(g), 'p', gather.action!);
  assert.equal(gathered.players[0].forces[`${destination}:0`], 5);
  assert.equal(gathered.players[0].elites!.forces[`${destination}:0`], 3);
});

void test('the client rejects wrong origin counts and unavailable elite custody before sending', () => {
  const view = viewGame(fixture(), 'p');
  assert.match(
    planetologistMoveDraft(
      view,
      'gather',
      destination,
      0,
      { [gatherSources[0]]: 1 },
      { [gatherSources[0]]: 0 },
    ).blocked!,
    /exactly two different territories/,
  );
  assert.match(
    planetologistMoveDraft(
      view,
      'range',
      destination,
      0,
      { [rangeSource]: 2 },
      { [rangeSource]: 0 },
    ).blocked!,
    /normal and elite mix/,
  );
  const expansion = fixture();
  expansion.players[1].faction = 'ixians';
  assert.match(
    planetologistMoveDraft(
      viewGame(expansion, 'p'),
      'range',
      destination,
      0,
      { [rangeSource]: 2 },
      { [rangeSource]: 1 },
    ).blocked!,
    /expansion factions awaits/,
  );
});
