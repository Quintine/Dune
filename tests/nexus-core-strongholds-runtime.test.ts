import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { maxCombatDial } from '../game/combat';
import { strongholdControllers } from '../game/stronghold-cards';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { advanceClassicIndependentNexus } from './fixture-classic-independent-nexus';
import { reactionAction } from './fixture-classic-independent-nexus-reactions';
import { classicDiscoveryNexusClean as clean } from './fixture-discovery-classic-nexus';
import { createNexusCoreArrakeenFixture, createNexusCoreCarthagFixture,
  revealNexusCoreStrongholdBattle, finishNexusCoreStrongholdBattle,
  callNexusCoreCarthagTraitor, nexusCoreStrongholdPlayer as player } from './fixture-nexus-core-strongholds';

function physicalCounters(game: Game): void {
  for (const seat of game.players)
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, count) => sum + count, 0), 20);
}
function nextMentat(game: Game): Game {
  return advanceClassicIndependentNexus(game, state => state.turn === 3 &&
    state.strongholdCards?.claimedTurn === 2 && clean(state));
}

for (const independent of [false, true]) {
  void test(`earned Arrakeen pays only actual holder support beside native Emperor Cunning${independent ? ' and three real Reinforcements reserves' : ' on base33'}`, () => {
    const f = createNexusCoreArrakeenFixture({ independent });
    assert.equal(f.setup.strongholdCards!.claimedTurn, 0);
    assert.ok(Object.values(f.setup.strongholdCards!.owners).every(owner => owner === null));
    assert.equal(f.claimed.strongholdCards!.owners.arrakeen, f.owner);
    assert.equal(player(f.claimed, f.owner).forces[f.key], 5);
    assert.equal(player(f.claimed, f.owner).reserves, player(f.setup, f.owner).reserves - 5,
      'First end-Mentat ownership follows an original five-counter shipment');
    const before = player(f.game, f.owner), enemy = player(f.game, f.opponent);
    assert.equal(player(f.afterShipment, f.opponent).reserves, player(f.beforeShipment, f.opponent).reserves - 5);
    assert.equal(player(f.afterShipment, f.opponent).spice, player(f.beforeShipment, f.opponent).spice - 3,
      'The real reciprocal Guild alliance retains the rounded half-price tariff for five counters');
    const revealed = revealNexusCoreStrongholdBattle(f);
    const forces = viewGame(revealed, f.owner).battle!.ownForces!;
    assert.equal(forces.normal, 5);
    assert.equal(forces.temporaryElite, 5);
    assert.equal(maxCombatDial(forces), 10);
    assert.equal(revealed.battle!.plans[f.owner].dial, 6);
    assert.equal(revealed.battle!.plans[f.owner].support, 3);
    assert.equal(player(revealed, f.owner).spice, before.spice,
      'Sealing the plan neither pays support early nor credits bank money to the holder');
    const done = finishNexusCoreStrongholdBattle(revealed);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(player(done, f.owner).spice, before.spice - 1 + 2,
      'Actual support3 uses bank2/personal1 before separate native Arrakeen Collection2');
    assert.equal(player(done, f.opponent).spice, enemy.spice - 1 + 2,
      'The opposing Carthag holder pays personal support1 in Arrakeen before its separate native city Collection2');
    assert.equal(player(done, f.owner).reserves, before.reserves - (independent ? 3 : 0));
    assert.equal(player(done, f.owner).tanks, before.tanks + 3 + (independent ? 3 : 0),
      'Three dialed temporary-Sardaukar casualties and three reserve fees retain distinct sources');
    assert.equal(player(done, f.owner).forces[f.key], 2,
      'Reinforcements never adds supported board counters');
    assert.deepEqual(player(done, f.owner).elites, before.elites);
    assert.equal(player(done, f.opponent).tanks, enemy.tanks + 5);
    assert.equal(done.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'emperor').length, 1);
    assert.equal(done.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, independent ? 1 : 0);
    assert.equal(done.nexusSardaukarHistory!.length, 1);
    assert.equal(done.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
    assert.equal(done.strongholdCards!.owners.arrakeen, f.owner);
    assert.equal(done.phase, 7);
    physicalCounters(done);
  });
}

void test('Arrakeen bank support cannot replace the Reinforcements reserve fee or ordinary five-counter dial losses when Cunning is not used', () => {
  const f = createNexusCoreArrakeenFixture();
  const before = player(f.game, f.owner);
  const done = finishNexusCoreStrongholdBattle(revealNexusCoreStrongholdBattle(f, { cunning: false, ownerDial: 5 }));
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(player(done, f.owner).spice, before.spice - 3,
    'Support5 costs personal3 after bank2; no surviving city counter means no Collection2');
  assert.equal(player(done, f.owner).reserves, before.reserves - 3);
  assert.equal(player(done, f.owner).tanks, before.tanks + 8);
  assert.equal(player(done, f.owner).forces[f.key] ?? 0, 0);
  assert.equal(done.nexusCards!.cards!.hands[f.owner], 'emperor');
  assert.equal(done.strongholdCards!.owners.arrakeen, f.owner,
    'Vacating the city through actual dial casualties does not transfer held custody early');
  const settled = nextMentat(done);
  assert.equal(settled.strongholdCards!.owners.arrakeen, null);
  physicalCounters(settled);
});

for (const skills of [false, true]) {
  void test(`earned Carthag physical Shield survives poison after an original Harkonnen call is canceled${skills ? ' with its actually trained all14 disc behind the shield' : ' on base33'}`, () => {
    const f = createNexusCoreCarthagFixture({ skills, independent: skills });
    const before = player(f.game, f.owner);
    assert.equal(f.claimed.strongholdCards!.owners.carthag, f.owner);
    assert.equal(f.claimed.strongholdCards!.claimedTurn, 1);
    assert.equal(player(f.afterShipment, f.opponent).reserves, player(f.beforeShipment, f.opponent).reserves - 1);
    assert.equal(player(f.afterShipment, f.opponent).spice, player(f.beforeShipment, f.opponent).spice - 1);
    const revealed = revealNexusCoreStrongholdBattle(f);
    const called = callNexusCoreCarthagTraitor(revealed);
    assert.equal(player(called, f.opponent).leaders.find(disc => disc.id === f.opponentLeader)!.dead, false,
      'The original call is pending, not already a paid traitor outcome');
    const event = called.pendingNexusHarkonnenBetrayal!.source.event;
    const canceled = reactionAction(called, f.opponent, { type: 'nexusHarkonnenBetrayalUse', event });
    assert.equal(canceled.nexusCards!.cards!.hands[f.opponent], null);
    assert.equal(player(canceled, f.owner).traitors.includes(f.opponentLeader), false);
    assert.equal(canceled.traitorReserve!.includes(f.opponentLeader), true);
    const done = finishNexusCoreStrongholdBattle(canceled);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(player(done, f.owner).leaders.find(disc => disc.id === f.ownerLeader)!.dead, false);
    assert.equal(player(done, f.owner).forces[f.key], before.forces[f.key] - 1);
    assert.equal(player(done, f.owner).tanks, before.tanks + 1);
    assert.equal(player(done, f.owner).reserves, before.reserves);
    assert.equal(player(done, f.owner).hand.some(card => card.id === f.defense), true,
      'Snooper protection never replaces the physical Shield or moves it to a new hand');
    assert.equal(player(done, f.opponent).tanks, player(f.game, f.opponent).tanks + 1);
    const top = done.traitorReserve![0];
    const mentat = nextMentat(done);
    assert.equal(mentat.nexusHarkonnenReplacementHistory!.length, 1);
    assert.equal(mentat.nexusHarkonnenReplacementHistory![0].drawn, top);
    assert.equal(player(mentat, f.owner).traitors.length, before.traitors.length);
    assert.equal(mentat.strongholdCards!.owners.carthag, f.owner);
    physicalCounters(mentat);
  });
}

void test('a retained Carthag card cannot protect an empty defense; actual loss changes control now but held custody only at Mentat', () => {
  const f = createNexusCoreCarthagFixture({ skills: true });
  let game = callNexusCoreCarthagTraitor(revealNexusCoreStrongholdBattle(f, { shield: false }));
  game = reactionAction(game, f.opponent, { type: 'nexusHarkonnenBetrayalUse',
    event: game.pendingNexusHarkonnenBetrayal!.source.event });
  const done = finishNexusCoreStrongholdBattle(game);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.equal(player(done, f.owner).leaders.find(disc => disc.id === f.ownerLeader)!.dead, true);
  assert.equal(player(done, f.owner).forces[f.key] ?? 0, 0);
  assert.equal(player(done, f.owner).tanks, player(f.game, f.owner).tanks + 10);
  assert.equal(player(done, f.owner).hand.some(card => card.id === f.defense), true,
    'An unplayed Shield stays physically held and grants no Carthag defense');
  assert.equal(strongholdControllers(done.players, false).carthag, f.opponent);
  assert.equal(done.strongholdCards!.owners.carthag, f.owner);
  assert.equal(done.strongholdCards!.claimedTurn, 1);
  const mentat = nextMentat(done);
  assert.equal(mentat.strongholdCards!.owners.carthag, f.opponent);
  assert.equal(mentat.strongholdCards!.claimedTurn, 2);
  assert.equal(player(mentat, f.owner).hand.some(card => card.id === f.defense), true);
  physicalCounters(mentat);
});

void test('passing the real Harkonnen Nexus acknowledgment retains the original single-traitor outcome and does not spend or replace the held card', () => {
  const f = createNexusCoreCarthagFixture();
  let game = callNexusCoreCarthagTraitor(revealNexusCoreStrongholdBattle(f));
  game = reactionAction(game, f.opponent, { type: 'nexusHarkonnenBetrayalPass',
    event: game.pendingNexusHarkonnenBetrayal!.source.event });
  const done = finishNexusCoreStrongholdBattle(game);
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(player(done, f.opponent).leaders.find(disc => disc.id === f.opponentLeader)!.dead, true);
  assert.equal(player(done, f.owner).traitors.includes(f.opponentLeader), true);
  assert.equal(player(done, f.owner).tanks, player(f.game, f.owner).tanks,
    'A successful single-traitor call does not pay the ordinary half-dial casualty');
  assert.equal(done.nexusCards!.cards!.hands[f.opponent], 'harkonnen');
  assert.deepEqual(done.nexusCards!.cards!.discard, []);
  assert.equal(done.pendingNexusHarkonnenReplacement, null);
  assert.equal(done.strongholdCards!.owners.carthag, f.owner);
  physicalCounters(done);
});
