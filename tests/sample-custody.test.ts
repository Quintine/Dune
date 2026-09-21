import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
} from '../game/engine';
import { sampleInventory, verifySampleCustody } from '../tools/sample-custody';
import { completedMoritaniSkillsGame } from './moritani-skills-fixture';

void test('Moritani Skills sample custody checks the physical skill and Traitor inventories after genuine setup', () => {
  const game = completedMoritaniSkillsGame();
  const inventory = sampleInventory(game);
  assert.ok(inventory.traitors);
  verifySampleCustody(game, inventory);
  const skills = structuredClone(game);
  skills.leaderSkills!.deck.pop();
  assert.throws(() => verifySampleCustody(skills, inventory));
  const missing = structuredClone(game);
  delete missing.leaderSkills;
  assert.throws(() => verifySampleCustody(missing, inventory), /Leader Skills module custody/);
  const traitors = structuredClone(game);
  traitors.players[0].traitors[0] = traitors.players[1].traitors[0];
  assert.throws(() => verifySampleCustody(traitors, inventory), /traitor custody/);
});

function fixture(advanced = false) {
  let game = createGame(
    'SAMPLEQA',
    newPlayer('emperor', 'Emperor', 'emperor'),
    advanced,
  );
  for (const faction of ['fremen', 'atreides', 'harkonnen'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  for (const player of game.players) {
    player.ready = true;
    player.bot = 'Medium';
  }
  game = initializeBaseGameForAudit(game);
  const inventory = sampleInventory(game);
  verifySampleCustody(game, inventory);
  for (let steps = 0; game.status === 'setup' && steps < 30; steps++) {
    const choice = game.players.flatMap((player) =>
      botActions(viewGame(game, player.id)).map((action) => ({
        player,
        action,
      })),
    )[0];
    assert.ok(choice, 'genuine setup has a legal AI choice');
    game = applyAction(game, choice.player.id, choice.action);
    verifySampleCustody(game, inventory);
  }
  assert.equal(game.status, 'playing');
  return { game, inventory };
}

void test('sample custody follows genuine setup and distinct Advanced elite inventories', () => {
  for (const advanced of [false, true]) {
    const { game, inventory } = fixture(advanced);
    verifySampleCustody(JSON.parse(JSON.stringify(game)), inventory);
    const corrupted = structuredClone(game);
    const card = corrupted.deck.pop();
    assert.ok(card);
    assert.throws(
      () => verifySampleCustody(corrupted, inventory),
      /physical card custody/,
    );
  }
});

void test('sample custody detects balanced negative forces and elite subsets outside their group', () => {
  const { game, inventory } = fixture(true);
  const negative = structuredClone(game);
  negative.players[0].tanks = -1;
  negative.players[0].reserves++;
  assert.throws(
    () => verifySampleCustody(negative, inventory),
    /nonnegative forces/,
  );
  const missing = structuredClone(game);
  delete missing.players.find((seat) => seat.faction === 'fremen')!.elites;
  assert.throws(
    () => verifySampleCustody(missing, inventory),
    /missing elite inventory fremen/,
  );
  const misplaced = structuredClone(game);
  const player = misplaced.players.find((seat) => seat.faction === 'emperor')!;
  assert.ok(player.elites);
  player.elites.reserves--;
  player.elites.forces['arrakeen:10'] = 1;
  assert.throws(
    () => verifySampleCustody(misplaced, inventory),
    /elite board subset/,
  );
});

void test('sample custody catches a duplicated base traitor after setup despite preserved hand size', () => {
  const { game, inventory } = fixture();
  const original = game.players[0].traitors[0];
  assert.ok(original);
  const other = game.players.find((player) => player.id !== game.players[0].id)!
    .traitors[0];
  assert.ok(other && other !== original);
  game.players[0].traitors[0] = other;
  assert.throws(
    () => verifySampleCustody(game, inventory),
    /physical traitor custody/,
  );
});

void test('sample custody retains all seven Ixian cyborgs in genuine expansion setup', () => {
  const lobby = createGame(
    'SAMPLEIX',
    newPlayer('ixians', 'Ixians', 'ixians'),
    false,
    ['ix'],
  );
  for (const faction of ['tleilaxu', 'atreides', 'harkonnen'] as const)
    joinGame(lobby, newPlayer(faction, faction, faction));
  for (const player of lobby.players) player.ready = true;
  const game = initializeFactionExpansionsGameForAudit(lobby);
  const inventory = sampleInventory(game);
  verifySampleCustody(game, inventory);
  const player = game.players.find((seat) => seat.faction === 'ixians')!;
  assert.ok(player.elites);
  player.elites.reserves--;
  assert.throws(
    () => verifySampleCustody(game, inventory),
    /elite custody ixians/,
  );
});

void test('resumed sample inventory cannot shrink with a deleted leader and matching Traitor card', () => {
  const { game } = fixture();
  const leader = game.players[0].leaders.pop();
  assert.ok(leader);
  game.traitorReserve = game.traitorReserve?.filter(
    (card) => card !== leader.id,
  );
  for (const player of game.players)
    player.traitors = player.traitors.filter((card) => card !== leader.id);
  assert.throws(
    () => verifySampleCustody(game, sampleInventory(game)),
    /physical traitor custody/,
  );
});
