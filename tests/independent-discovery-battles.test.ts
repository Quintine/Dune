import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game } from '../game/engine';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { JACURUTU_SIETCH } from '../game/discoveries';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  completeIndependentDiscoveryBattle, createIndependentDiscoveryBattleFixture,
  independentDiscoveryBattlePlayer as player, reviveIndependentDiscoveryBattle,
  smokeIndependentDiscoveryBattle, type IndependentDiscoveryBattleFixture,
} from './fixture-independent-discovery-battles';

function nativePool(game: Game, world: string) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(group => group.id === world)!.forces.emperor;
}
function originalSource(f: IndependentDiscoveryBattleFixture) {
  assert.equal(f.placed.discoveries!.tokens.find(token => token.id === f.token)!.face, JACURUTU_SIETCH);
  assert.equal(f.placed.discoveries!.tokens.find(token => token.id === f.token)!.revealedTurn, null);
  assert.ok(f.inspected.discoveries!.tokens.find(token => token.id === f.token)!.known.includes('emperor'));
  assert.equal(f.revealed.discoveries!.tokens.find(token => token.id === f.token)!.revealedTurn, 1);
  assert.equal(f.purchased.bids.length, 3);
  assert.ok(f.purchased.bids.every(bid => bid.step.actor === 'emperor' && bid.step.action.amount === 1));
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD, RECRUITS_CARD_ID])
    assert.ok(player(f.game, f.owner).hand.some(card => card.id === id), 'Only original actually purchased cards reach the battle');
  const prior = player(f.beforeEntry, f.owner), entered = player(f.afterEntry, f.owner);
  assert.equal(entered.forces[f.nested], 3);
  assert.equal(entered.forces[`${f.parent.territory}:${f.parent.sector}`] ?? 0, 0);
  assert.equal(entered.reserves, prior.reserves);
  assert.equal(entered.spice, prior.spice);
  assert.equal(entered.moved, prior.moved);
  assert.equal(entered.shipped, prior.shipped, 'The real next-turn nested entry consumes no ordinary shipment');
  assert.deepEqual(f.afterEntry.homeworlds, f.beforeEntry.homeworlds);
  assert.equal(player(f.game, f.opponent).forces[f.nested], 2);
  assert.equal(f.shipments[1].step.action.territory, JACURUTU_SIETCH);
  assert.ok(player(f.shipments[1].after, f.opponent).spice < player(f.shipments[1].before, f.opponent).spice,
    'The enemy army uses its actual printed paid nested shipment');
  assert.deepEqual(f.fee, { normal: 3, elite: 0 });
  assert.equal(f.game.nexusCards?.cards?.hands.emperor ?? null, null);
  assert.equal(f.game.nexusCards?.cards?.hands.guild ?? null, null, 'Selected Nexus is not a claim that an undrawn card was earned');
}
function settled(f: IndependentDiscoveryBattleFixture, game: Game) {
  const before = player(f.game, f.owner), after = player(game, f.owner);
  assert.equal(game.lastBattleContext!.territory, JACURUTU_SIETCH);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(after.forces[f.nested] ?? 0, 0);
  assert.equal(after.reserves, before.reserves - 3 + 2);
  assert.equal(after.tanks, before.tanks + 4, 'Three actual reserve-fee counters and one dialed normal casualty reach Tanks');
  assert.equal(after.elites?.tanks ?? 0, before.elites?.tanks ?? 0);
  assert.equal(after.elites?.reserves ?? 0, (before.elites?.reserves ?? 0) + (game.advanced ? 2 : 0));
  assert.equal(player(game, f.opponent).tanks, player(f.game, f.opponent).tanks + 2);
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
    assert.equal(game.discard.filter(card => card.id === id).length, 1);
  assert.ok(after.hand.some(card => card.id === RECRUITS_CARD_ID));
}

for (const nexus of [true, false]) void test(`original Basic classic Discovery placement${nexus ? ' with Nexus' : ' without Nexus'}, inspection and free nested entry feed real Reinforcements and Harass battle settlement`, () => {
  const f = createIndependentDiscoveryBattleFixture({ advanced: false, expansions: [],
    homeworlds: false, skills: false, tech: false, strongholds: false, nexus });
  originalSource(f);
  assert.equal(f.game.discoveryEnabled, true);
  assert.equal(f.game.ecazTreachery, true);
  assert.equal(!!f.game.nexusCards, nexus);
  assert.equal(f.game.turn, 2);
  assert.equal(f.game.battle!.territory, JACURUTU_SIETCH);
  const result = completeIndependentDiscoveryBattle(f);
  assert.equal(result.revealed.battle!.plans.emperor.weapon, REINFORCEMENTS_CARD);
  assert.equal(result.revealed.battle!.plans.emperor.defense, HARASS_WITHDRAW_CARD);
  settled(f, result.game);
});

void test('original selected-family World/all14/phase Discovery battle pays native reserve fee, returns Sardaukar and revives actual losses through paid Recruits', () => {
  const f = createIndependentDiscoveryBattleFixture({ advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    homeworlds: true, skills: true, tech: true, strongholds: true });
  originalSource(f);
  assert.ok(f.game.homeworlds && f.game.leaderSkills && f.game.techTokens && f.game.strongholdCards);
  assert.equal(player(f.afterEntry, f.owner).elites!.forces[f.nested], 2);
  assert.ok(f.plans[0].action.reinforcementsSources);
  const { game } = completeIndependentDiscoveryBattle(f);
  settled(f, game);
  assert.deepEqual(nativePool(game, 'homeworld:emperor'), {
    normal: nativePool(f.game, 'homeworld:emperor').normal - 3,
    elite: nativePool(f.game, 'homeworld:emperor').elite,
  });
  assert.deepEqual(nativePool(game, 'homeworld:emperor:salusa'), {
    normal: nativePool(f.game, 'homeworld:emperor:salusa').normal,
    elite: nativePool(f.game, 'homeworld:emperor:salusa').elite + 2,
  });
  const revived = reviveIndependentDiscoveryBattle(f, game);
  assert.equal(revived.before.turn, 3);
  assert.equal(revived.before.phase, 4);
  assert.equal(player(revived.before, f.owner).tanks, 4);
  assert.equal(revived.activated.recruits!.player, f.owner);
  assert.equal(revived.activated.recruits!.turn, 3);
  assert.equal(revived.revived.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
  assert.equal(player(revived.revived, f.owner).tanks, 2);
  assert.equal(player(revived.revived, f.owner).reserves, player(revived.activated, f.owner).reserves + 2);
  assert.equal(player(revived.revived, f.owner).spice, player(revived.activated, f.owner).spice,
    'The doubled printed free allowance pays no invented income or extra invoice');
  assert.deepEqual(nativePool(revived.revived, 'homeworld:emperor'), {
    normal: nativePool(revived.activated, 'homeworld:emperor').normal + 2,
    elite: nativePool(revived.activated, 'homeworld:emperor').elite,
  });
  assert.equal(revived.game.phase, 5);
});

void test('all four minimal policies retain source-bearing positive Reinforcements plans in a genuinely revealed nested Discovery battle', () => {
  const report = smokeIndependentDiscoveryBattle({ advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    homeworlds: true, skills: true, tech: true, strongholds: true });
  assert.equal(report.length, 4);
  assert.ok(report.every(result => result.plan.dial > 0 && result.sources));
});
