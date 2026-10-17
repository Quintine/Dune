import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  SandmasterMovement,
  sandmasterMoveDraft,
} from '../components/sandmaster-movement';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { GRAPH, location } from '../game/board';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';

const source = location('false_wall_west', 16);
const destination = location('wind_pass', 16);
const spicePile = location('wind_pass', 15);
const move: Action = {
  type: 'move',
  from: source,
  amount: 2,
  elite: 0,
  territory: 'wind_pass',
  sector: 16,
};

function fixture(advanced = false): Game {
  const game = createGame(
    'SANDUI',
    newPlayer('p', 'Mover', 'emperor'),
    advanced,
  );
  joinGame(game, newPlayer('o', 'Observer', 'atreides'));
  Object.assign(game, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['p', 'o'],
    active: 'p',
    movementRemaining: ['p', 'o'],
    spice: { [spicePile]: 3 },
  });
  for (const player of game.players) {
    player.hand = [];
    player.forces = {};
    player.reserves = 20;
    player.shipped = true;
  }
  game.players[0].forces[source] = 2;
  game.players[0].reserves = 18;
  game.leaderSkills = {
    deck: LEADER_SKILL_CARDS.map((card) => card.id).filter(
      (id) => id !== 'sandmaster',
    ),
    offers: {},
    assignments: [{ skill: 'sandmaster', leader: 'emperor-0', owner: 'p' }],
  };
  return game;
}

function markup(game: Game, viewer = 'p', busy = false) {
  return renderToStaticMarkup(
    createElement(SandmasterMovement, {
      game: viewGame(game, viewer),
      move,
      act() {},
      busy,
    }),
  );
}

void test('Sandmaster controls stay absent from other seats and unsupported overlays while the combined ix deck renders', () => {
  const game = fixture();
  assert.equal(markup(game, 'o'), '');

  // The intentional composition change admits the selected ix deck alongside
  // classic seats, so the mover's controls now render for that combination.
  const combined = fixture();
  combined.expansions = ['ix'];
  assert.match(markup(combined), /Sandmaster movement/);

  const unsupported = fixture();
  unsupported.expansions = ['ix'];
  unsupported.kullPreview = true;
  assert.equal(markup(unsupported), '');
});

void test('drafts preserve the ordinary move, accept a connected alternate and allow collecting or declining', () => {
  const game = fixture();
  const view = viewGame(game, 'p');
  const standard = sandmasterMoveDraft(view, move);
  const collected = applyAction(structuredClone(game), 'p', standard.action!);
  assert.equal(collected.players[0].spice, game.players[0].spice + 1);
  assert.equal(collected.spice[spicePile], 2);
  assert.equal(collected.players[0].forces[source] ?? 0, 0);
  assert.equal(collected.players[0].forces[destination], 2);
  assert.equal(collected.players[0].moved, 1);

  assert.ok(GRAPH[source].includes(location('wind_pass', 17)));
  assert.ok(GRAPH[location('wind_pass', 17)].includes(destination));
  const alternate = sandmasterMoveDraft(view, move, {
    [source]: [source, location('wind_pass', 17), destination],
  });
  assert.equal(alternate.blocked, null);
  assert.deepEqual(alternate.choice?.collect, [spicePile]);

  const declined = sandmasterMoveDraft(view, move, undefined, [spicePile]);
  assert.deepEqual(declined.choice?.collect, []);
  const noCollection = applyAction(
    structuredClone(game),
    'p',
    declined.action!,
  );
  assert.equal(noCollection.players[0].spice, game.players[0].spice);
  assert.equal(noCollection.spice[spicePile], 3);

  assert.match(
    sandmasterMoveDraft(view, move, {
      [source]: [source, location('arrakeen', 10), destination],
    }).blocked!,
    /connected route/,
  );
});

void test('all four bot profiles add legal collection to ordinary and admitted combined-deck candidates', () => {
  for (const difficulty of DIFFICULTIES) {
    const game = fixture();
    const view = viewGame(game, 'p');
    view.players.find((player) => player.id === 'p')!.bot = difficulty;
    const candidates = botActions(view).filter(
      (action) => action.type === 'move' && action.sandmaster,
    );
    assert.ok(candidates.length, `${difficulty} omitted Sandmaster collection`);
    assert.ok(
      candidates.every(
        (action) =>
          typeof action.from === 'string' &&
          action.planetologist === undefined &&
          action.movementCard === undefined &&
          action.ornithopterEvent === undefined,
      ),
    );
    const completed = applyAction(game, 'p', candidates[0]);
    const selected = (candidates[0].sandmaster as { collect: string[] }).collect;
    assert.equal(completed.players[0].moved, 1, difficulty);
    assert.equal(completed.players[0].spice, game.players[0].spice + selected.length, difficulty);
    for (const key of selected) assert.equal(completed.spice[key], game.spice[key] - 1, difficulty);

    // The intentional composition change admits the selected ix deck, so the
    // same legal collection candidates are emitted and settle there too.
    const combinedGame = fixture();
    combinedGame.expansions = ['ix'];
    const combined = viewGame(combinedGame, 'p');
    combined.players.find((player) => player.id === 'p')!.bot = difficulty;
    const combinedCandidates = botActions(combined).filter(
      (action) => action.type === 'move' && action.sandmaster,
    );
    assert.ok(
      combinedCandidates.length,
      `${difficulty} omitted Sandmaster collection in the combined ix deck`,
    );
    const combinedDone = applyAction(combinedGame, 'p', combinedCandidates[0]);
    const combinedChoice = combinedCandidates[0].sandmaster;
    assert.ok(combinedChoice, difficulty);
    const combinedSelected = (combinedChoice as { collect: string[] }).collect;
    assert.equal(combinedDone.players[0].moved, 1, difficulty);
    assert.equal(
      combinedDone.players[0].spice,
      combinedGame.players[0].spice + combinedSelected.length,
      difficulty,
    );
    for (const key of combinedSelected)
      assert.equal(combinedDone.spice[key], combinedGame.spice[key] - 1, difficulty);
  }
});
