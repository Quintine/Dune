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
import {
  assassinationChoice,
  assassinationGame,
  assassinationToMentat,
  resolveAssassinationBattle,
  stageAssassinationBattle,
} from './moritani-assassinate-fixture';
import { createStrongholdFactionsFixture } from './fixture-stronghold-factions';

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

void test('Moritani assassination samples conserve retired Traitors after real battle and Mentat replacement', () => {
  const start = assassinationGame();
  const inventory = sampleInventory(start);
  assert.ok(inventory.traitors);
  verifySampleCustody(start, inventory);
  const staged = stageAssassinationBattle(start);
  verifySampleCustody(staged, inventory);
  const revealed = assassinationChoice(resolveAssassinationBattle(staged), 'guild-1');
  verifySampleCustody(revealed, inventory);
  const settled = assassinationToMentat(revealed);
  assert.equal(settled.moritaniAssassinate?.opportunities[0].stage, 'replaced');
  verifySampleCustody(settled, inventory);
  const duplicated = structuredClone(settled);
  duplicated.traitorReserve!.push('guild-1');
  assert.throws(() => verifySampleCustody(duplicated, inventory), /physical traitor custody/);
});
void test('native Stronghold sample custody survives real end-Mentat acquisition and retained next-turn ownership', () => {
  const fixture = createStrongholdFactionsFixture();
  const inventory = sampleInventory(fixture.initial);
  assert.equal(inventory.cards.length, 47);
  assert.equal(inventory.strongholds?.length, 6);
  verifySampleCustody(fixture.beforeFirstMentat, inventory);
  verifySampleCustody(fixture.afterFirstMentat, inventory, fixture.beforeFirstMentat);
  assert.equal(fixture.afterFirstMentat.strongholdCards!.claimedTurn, 1);
  const owner = fixture.afterFirstMentat.strongholdCards!.owners.hidden_mobile_stronghold;
  assert.ok(owner, 'actual end-Mentat claims the mobile card');
  verifySampleCustody(fixture.beforeBattle, inventory, fixture.afterFirstMentat);
  const saved = JSON.parse(JSON.stringify(fixture.game));
  verifySampleCustody(saved, inventory, fixture.beforeBattle);
  const missing = structuredClone(fixture.game);
  delete missing.strongholdCards;
  assert.throws(() => verifySampleCustody(missing, inventory), /Stronghold Cards module custody/);
  const missingCard = structuredClone(fixture.game);
  Reflect.deleteProperty(missingCard.strongholdCards!.owners, 'arrakeen');
  assert.throws(() => verifySampleCustody(missingCard, inventory), /Each Stronghold Card/);
  const foreign = structuredClone(fixture.game);
  foreign.strongholdCards!.owners.arrakeen = 'not-a-seat';
  assert.throws(() => verifySampleCustody(foreign, inventory), /current seat/);
  const future = structuredClone(fixture.game);
  future.strongholdCards!.claimedTurn = future.turn + 1;
  assert.throws(() => verifySampleCustody(future, inventory), /future/);
  const transferred = structuredClone(fixture.game);
  const other = transferred.players.find(player => player.id !== owner)!;
  transferred.strongholdCards!.owners.hidden_mobile_stronghold = other.id;
  assert.throws(() => verifySampleCustody(transferred, inventory, fixture.game),
    /holders must persist/);
  const missingCyborg = structuredClone(fixture.game);
  const ixians = missingCyborg.players.find(player => player.faction === 'ixians')!;
  assert.ok(ixians.elites);
  if (ixians.elites.reserves > 0) ixians.elites.reserves--;
  else if (ixians.elites.tanks > 0) ixians.elites.tanks--;
  else {
    const location = Object.keys(ixians.elites.forces).find(key => ixians.elites!.forces[key] > 0);
    assert.ok(location);
    ixians.elites.forces[location]--;
  }
  assert.throws(() => verifySampleCustody(missingCyborg, inventory), /elite custody ixians/);
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
void test('sample custody accounts for foreign Homeworld ordinary and elite forces without counting Salusa twice', () => {
  const { game, inventory } = fixture(true);
  const emperor = game.players.find((seat) => seat.faction === 'emperor')!;
  assert.ok(emperor.elites);
  emperor.reserves -= 3;
  emperor.elites.reserves--;
  game.homeworlds = {
    custody: {
      visitors: { 'homeworld:fremen': { [emperor.id]: { normal: 2, elite: 1 } } },
      salusa: { normal: 1, elite: 0 },
    },
    historyVersion: 1,
  };
  verifySampleCustody(game, inventory);
  const missing = structuredClone(game);
  missing.homeworlds!.custody!.visitors['homeworld:fremen'][emperor.id].normal--;
  assert.throws(() => verifySampleCustody(missing, inventory), /force custody emperor/);
  const missingElite = structuredClone(game);
  missingElite.homeworlds!.custody!.visitors['homeworld:fremen'][emperor.id].elite--;
  missingElite.homeworlds!.custody!.visitors['homeworld:fremen'][emperor.id].normal++;
  assert.throws(() => verifySampleCustody(missingElite, inventory), /elite custody emperor/);
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
