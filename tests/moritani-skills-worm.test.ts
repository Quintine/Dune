import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { sandmasterWormCollection } from '../game/sandmaster-worm';

function totalForces(game: Game, player: string) {
  const owner = game.players.find((candidate) => candidate.id === player)!;
  return (
    owner.reserves +
    owner.tanks +
    Object.values(owner.forces).reduce((sum, count) => sum + count, 0)
  );
}

const totalSpiceCards = (game: Game) =>
  game.spiceDeck.length +
  game.spiceDiscard.reduce((sum, pile) => sum + pile.length, 0);

/** Genuine Basic setup through ready, skill, traitor and both force decisions. */
function completedMoritaniFremenSkillsGame(): Game {
  let game = createGame(
    'MORIWORM',
    newPlayer('f', 'Fremen', 'fremen'),
    false,
    ['ecaz'],
  );
  joinGame(game, newPlayer('m', 'Moritani', 'moritani'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });

  const targetIndex = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === 'sandmaster',
  );
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = shuffleIndex-- === targetIndex ? 0 : 0xffffffff;
    return array;
  });
  try {
    game = initializeLeaderSkillsGameForAudit(game);
  } finally {
    mock.restoreAll();
  }
  assert.equal(game.leaderSkills!.offers.f.cards[0], 'sandmaster');

  for (const player of game.players) {
    const offer = game.leaderSkills!.offers[player.id];
    game = applyAction(game, player.id, {
      type: 'leaderSkill',
      event: offer.event,
      skill: player.id === 'f' ? 'sandmaster' : offer.cards[0],
      leader: player.leaders[0].id,
    });
  }
  for (const player of game.players) {
    const current = game.players.find((candidate) => candidate.id === player.id)!;
    game = applyAction(game, player.id, {
      type: 'traitor',
      leader: current.traitorChoices[0],
    });
  }
  game = applyAction(game, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  assert.deepEqual(game.decision, { kind: 'moritaniSetup', player: 'm' });
  game = applyAction(game, 'm', {
    type: 'decision',
    territory: 'polar_sink',
    sector: 0,
  });
  assert.equal(game.status, 'playing');
  assert.deepEqual(
    game.leaderSkills!.assignments.find((assignment) => assignment.owner === 'f'),
    { owner: 'f', leader: 'fremen-0', skill: 'sandmaster' },
  );
  return game;
}

function summonedWormRide(): Game {
  let game = completedMoritaniFremenSkillsGame();
  const fremen = game.players.find((player) => player.id === 'f')!;
  // Stage a conserved turn-two Spice Blow position. Only locations, deck order
  // and phase controls change; all twenty Fremen forces and Spice cards remain.
  fremen.forces = { 'wind_pass_north:17': 4 };
  fremen.reserves = 16;
  fremen.moved = 1;
  game.spice = { 'habbanya_ridge_flat:17': 2 };
  const spiceCardCount = totalSpiceCards(game);
  const priorIndex = game.spiceDeck.findIndex(
    (card) => 'territory' in card && card.territory === 'wind_pass_north',
  );
  assert.ok(priorIndex >= 0);
  const [prior] = game.spiceDeck.splice(priorIndex, 1);
  const wormIndex = game.spiceDeck.findIndex((card) => 'worm' in card);
  assert.ok(wormIndex >= 0);
  const [worm] = game.spiceDeck.splice(wormIndex, 1);
  const nextIndex = game.spiceDeck.findIndex(
    (card) =>
      'territory' in card &&
      card.territory !== 'wind_pass_north' &&
      card.territory !== 'habbanya_ridge_flat',
  );
  assert.ok(nextIndex >= 0);
  const [next] = game.spiceDeck.splice(nextIndex, 1);
  game.spiceDeck = [worm, next, ...game.spiceDeck];
  game.spiceDiscard = [[prior], []];
  assert.equal(totalSpiceCards(game), spiceCardCount);
  Object.assign(game, {
    turn: 2,
    phase: 1,
    storm: 18,
    active: null,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    nexus: false,
    spiceSequence: null,
    spiceResolution: null,
    spiceWindow: null,
    wormRides: [],
    movementRemaining: null,
  });
  assert.equal(totalForces(game, 'f'), 20);

  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  while (game.response) {
    const responder = game.players.find(
      (player) => !game.response!.passed.includes(player.id),
    );
    assert.ok(responder);
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  assert.equal(game.nexus, true);
  for (let round = 0; round < 3 && game.decision?.kind !== 'wormRide'; round += 1)
    for (const player of game.players)
      if (!game.ready.includes(player.id))
        game = applyAction(game, player.id, { type: 'ready' });
  assert.deepEqual(game.decision, {
    kind: 'wormRide',
    player: 'f',
    territory: 'wind_pass_north',
  });
  assert.equal(totalForces(game, 'f'), 20);
  return game;
}

void test('Basic Moritani permits a projected Sandmaster worm collection and one legal bot ride after JSON restoration', () => {
  const pending = summonedWormRide();
  const spiceCardCount = totalSpiceCards(pending);
  const restored = JSON.parse(JSON.stringify(pending)) as Game;
  assert.deepEqual(viewGame(restored, 'f'), viewGame(pending, 'f'));

  const authoritative = sandmasterWormCollection(
    restored,
    'f',
    'habbanya_ridge_flat',
    17,
  );
  const projected = sandmasterWormCollection(
    viewGame(restored, 'f'),
    'f',
    'habbanya_ridge_flat',
    17,
  );
  assert.deepEqual(projected, authoritative);
  assert.deepEqual(authoritative, {
    leader: 'fremen-0',
    key: 'habbanya_ridge_flat:17',
    before: 2,
    blocked: null,
  });

  const botView = viewGame(restored, 'f');
  botView.players.find((player) => player.id === 'f')!.bot = 'Easy';
  const actions = botActions(botView);
  const collecting = actions.find(
    (action) =>
      action.accept === true &&
      action.territory === 'habbanya_ridge_flat' &&
      action.sector === 17 &&
      action.sandmasterCollect === true,
  );
  assert.ok(
    collecting,
    `the minimal bot path should include the legal collection: ${JSON.stringify(actions)}`,
  );

  const beforeSpice = restored.players.find((player) => player.id === 'f')!.spice;
  const done = applyAction(restored, 'f', collecting);
  const rider = done.players.find((player) => player.id === 'f')!;
  assert.equal(rider.spice, beforeSpice + 1);
  assert.equal(done.spice['habbanya_ridge_flat:17'], 1);
  assert.equal(rider.forces['wind_pass_north:17'] ?? 0, 0);
  assert.equal(rider.forces['habbanya_ridge_flat:17'], 4);
  assert.equal(rider.moved, 1);
  assert.equal(totalForces(done, 'f'), 20);
  assert.equal(totalSpiceCards(done), spiceCardCount);
  assert.equal(
    done.log.filter(
      (entry) => entry.automatic?.name === 'Sandmaster collection',
    ).length,
    1,
  );
});
