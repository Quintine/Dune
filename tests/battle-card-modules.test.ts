import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { TECH_TOKENS } from '../game/tech-tokens';
import {
  MODULE_HARASS, MODULE_REINFORCEMENTS, battleCardModulesPlayer,
  callBattleCardModules, createBattleCardModulesFixture, finishBattleCardModules,
  sealBattleCardModules, type BattleCardModulesFixture,
} from './fixture-battle-card-modules';

const physicalCards = (game: Game) => [
  ...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
].map(card => card.id).sort();

function assertUtilitiesDiscarded(game: Game) {
  for (const id of [MODULE_REINFORCEMENTS, MODULE_HARASS]) {
    assert.equal(game.discard.filter(card => card.id === id).length, 1);
    assert.ok(game.players.every(player => player.hand.every(card => card.id !== id)));
  }
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
}
function assertMandatoryTechTransfer(fixture: BattleCardModulesFixture, done: Game,
  winner: string, loser: string) {
  const lost = TECH_TOKENS.filter(token => fixture.game.techTokens![token.id].owner === loser);
  assert.equal(lost.length, 1, 'The original three-seat distribution gives this loser one actual token');
  for (const token of TECH_TOKENS) {
    assert.equal(done.techTokens![token.id].owner,
      lost.includes(token) ? winner : fixture.game.techTokens![token.id].owner);
    assert.equal(done.techTokens![token.id].spice, 0);
  }
}
function assertOriginalShipmentIncome(fixture: BattleCardModulesFixture) {
  const { beforeShipment: before, beforeBattle: settled } = fixture;
  const recipient = before.techTokens!.heighliners.owner;
  assert.ok(recipient);
  for (const player of before.players) {
    const expected: number = player.spice - (player.id === fixture.opponent ? 4 : 0) +
      (player.faction === 'guild' ? 4 : 0) + (player.id === recipient ? 1 : 0);
    assert.equal(battleCardModulesPlayer(settled, player.id).spice, expected,
      'Paid native shipment, Guild income and exactly one original Heighliners phase-end payment');
  }
  assert.equal(settled.techTokens!.heighliners.triggeredTurn, 2);
  assert.equal(settled.techTokens!.heighliners.spice, 0);
  assert.equal(battleCardModulesPlayer(settled, fixture.opponent).forces[fixture.location], 4);
}

void test('earned Arrakeen pays only actual support: bank-only two versus bank two plus personal one, with genuine R+H losses', () => {
  for (const dial of [2, 3]) {
    const fixture = createBattleCardModulesFixture({ dial,
      slot: dial === 2 ? 'defense' : 'weapon' });
    const { game, owner, opponent } = fixture;
    assert.equal(fixture.beforeMentat.turn, 1);
    assert.equal(fixture.beforeMentat.strongholdCards!.claimedTurn, 0);
    assert.ok(Object.values(fixture.beforeMentat.strongholdCards!.owners).every(id => id === null));
    const earned = applyAction(fixture.beforeMentat, fixture.mentatStep.actor, fixture.mentatStep.action);
    assert.equal(earned.strongholdCards!.claimedTurn, 1);
    assert.equal(earned.strongholdCards!.owners.arrakeen, owner);
    assert.equal(fixture.afterMentat.strongholdCards!.owners.arrakeen, owner);
    assert.equal(viewGame(game, owner).battle!.strongholdEffects[owner], 'arrakeen');
    assertOriginalShipmentIncome(fixture);
    assert.deepEqual(physicalCards(game), physicalCards(fixture.afterSetup));
    const before = battleCardModulesPlayer(game, owner);
    const done = finishBattleCardModules(callBattleCardModules(sealBattleCardModules(fixture)));
    const after = battleCardModulesPlayer(done, owner);
    assert.equal(done.lastBattleContext?.winner, owner);
    assert.equal(after.spice, before.spice - Math.max(0, dial - 2),
      'The subsidy is not a personal two-spice grant and R adds no support cost');
    assert.equal(after.reserves, before.reserves - 3 + 10 - dial);
    assert.equal(after.tanks, before.tanks + 3 + dial);
    assert.equal(after.forces[fixture.location] ?? 0, 0);
    assert.equal(done.strongholdCards!.owners.arrakeen, owner,
      'Harass vacates physical control without fabricating a mid-turn card transfer');
    assert.equal(done.strongholdCards!.claimedTurn, 1);
    assertMandatoryTechTransfer(fixture, done, owner, opponent);
    assertUtilitiesDiscarded(done);
    assert.equal(done.lastBattleContext?.winnerDiscards?.completed, true);
    assert.deepEqual(physicalCards(done), physicalCards(fixture.afterSetup));
  }
});

void test('native Ix earns Sietch Tabr, spends original mixed reserves before returning suboids, then receives real victory income and Tech', () => {
  const fixture = createBattleCardModulesFixture({ route: 'ix-sietch' });
  const { game, owner, opponent } = fixture;
  assert.equal(fixture.afterSetup.players.find(player => player.id === owner)!.forces[fixture.location] ?? 0, 0);
  assert.equal(fixture.afterMentat.strongholdCards!.owners.sietch_tabr, owner);
  assert.equal(battleCardModulesPlayer(fixture.afterMentat, owner).forces[fixture.location], 8);
  assertOriginalShipmentIncome(fixture);
  const before = battleCardModulesPlayer(game, owner);
  const preview = viewGame(game, owner).battle!;
  assert.equal(preview.strongholdEffects[owner], 'sietch_tabr');
  assert.equal(preview.reinforcements!.normal, 2);
  assert.equal(preview.reinforcements!.elite, 1);
  assert.equal(before.reserves, 6);
  assert.equal(before.elites!.reserves, 4);
  const done = finishBattleCardModules(callBattleCardModules(sealBattleCardModules(fixture)));
  const after = battleCardModulesPlayer(done, owner);
  assert.equal(done.lastBattleContext?.winner, owner);
  assert.equal(after.reserves, 9, 'Six original reserves minus fee three plus six undialed suboids');
  assert.equal(after.elites!.reserves, 3,
    'Returned normal suboids cannot replace the original cyborg in the normal-first fee');
  assert.equal(after.tanks, 5, 'Three reserve-fee counters plus two dialed suboids');
  assert.equal(after.elites!.tanks, 1);
  assert.equal(after.forces[fixture.location] ?? 0, 0);
  assert.equal(after.forces['hidden_mobile_stronghold:0'], 6, 'Original unrelated mobile army stays untouched');
  assert.equal(after.spice, before.spice + 2, 'Earned Sietch Tabr pays the actual opposing dial');
  assertMandatoryTechTransfer(fixture, done, owner, opponent);
  assertUtilitiesDiscarded(done);
  assert.equal(done.lastBattleContext?.winnerDiscards?.completed, true);
  assert.deepEqual(physicalCards(done), physicalCards(fixture.afterSetup));
});

void test('Basic Tech battle gets the decisive score-only R bonus while Harass returns only the seven undialed counters', () => {
  const fixture = createBattleCardModulesFixture({ advanced: false, ownerLeader: 'weakest', opponentDial: 3 });
  const { owner, opponent, game } = fixture;
  assert.equal(game.strongholdCards, undefined);
  assertOriginalShipmentIncome(fixture);
  let withoutR = applyAction(game, owner, { ...fixture.plans.both.action, weapon: null });
  withoutR = applyAction(withoutR, opponent, fixture.plans.opponent.action);
  const plain = finishBattleCardModules(callBattleCardModules(withoutR));
  assert.equal(plain.lastBattleContext?.winner, opponent);
  assert.equal(battleCardModulesPlayer(plain, owner).reserves, 17);
  assert.equal(battleCardModulesPlayer(plain, owner).tanks, 3);
  const done = finishBattleCardModules(callBattleCardModules(sealBattleCardModules(fixture)));
  const after = battleCardModulesPlayer(done, owner);
  assert.equal(done.lastBattleContext?.winner, owner);
  assert.equal(after.reserves, 14);
  assert.equal(after.tanks, 6);
  assert.equal(after.spice, battleCardModulesPlayer(game, owner).spice);
  assertMandatoryTechTransfer(fixture, done, owner, opponent);
  assertUtilitiesDiscarded(done);
});

void test('an actual conserved opposing traitor cancels Harass, not the Basic reserve fee or the actual winner Tech award', () => {
  const fixture = createBattleCardModulesFixture({ advanced: false, opposingTraitor: true });
  const { owner, opponent } = fixture;
  const done = finishBattleCardModules(callBattleCardModules(sealBattleCardModules(fixture), [opponent]));
  const after = battleCardModulesPlayer(done, owner);
  assert.equal(done.lastBattleContext?.result, 'traitor');
  assert.equal(done.lastBattleContext?.winner, opponent);
  assert.equal(after.reserves, 7, 'The original fee is paid even on the traitor outcome');
  assert.equal(after.tanks, 13, 'All ten on-board counters die when the opposing traitor cancels the return');
  assert.equal(after.forces[fixture.location] ?? 0, 0);
  assertMandatoryTechTransfer(fixture, done, opponent, owner);
  assertUtilitiesDiscarded(done);
  assert.deepEqual(physicalCards(done), physicalCards(fixture.afterSetup));
});

void test('the genuine two-seat Advanced Strongholds-only battle earns Arrakeen without requiring or manufacturing Tech rewards', () => {
  const fixture = createBattleCardModulesFixture({ players: 2, tech: false });
  const { owner } = fixture;
  assert.equal(fixture.game.techTokens, undefined);
  assert.equal(fixture.afterMentat.strongholdCards!.owners.arrakeen, owner);
  const done = finishBattleCardModules(callBattleCardModules(sealBattleCardModules(fixture)));
  const after = battleCardModulesPlayer(done, owner);
  assert.equal(done.lastBattleContext?.winner, owner);
  assert.equal(after.spice, battleCardModulesPlayer(fixture.game, owner).spice - 1);
  assert.equal(after.reserves, 14);
  assert.equal(after.tanks, 6);
  assert.equal(done.techTokens, undefined);
  assertUtilitiesDiscarded(done);
});
