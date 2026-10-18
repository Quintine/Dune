import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { presenceAt } from '../game/force-presence';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import {
  createFremenCunningModulesFixture, completeFremenCunningModules,
  fremenCunningModulesPlayer as player,
} from './fixture-fremen-cunning-modules';

function physicalNexus(game: Game): void {
  const cards = game.nexusCards!.cards!;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
}
for (const expansions of [['ix'], ['choam']] as const) void test(`Basic selected ${expansions[0]} independent/Nexus uses its actual drawn Fremen Cunning after an empty appearance and real closing Nexus`, () => {
  const fixture = createFremenCunningModulesFixture({ expansions: [...expansions] });
  assert.ok(fixture.afterSetup.ecazTreachery && fixture.afterSetup.nexusCards);
  assert.deepEqual(fixture.afterSetup.expansions, [...expansions]);
  assert.equal(fixture.counterPurchase.step.actor, 'guild');
  assert.equal(fixture.counterPurchase.step.action.type, 'bid');
  assert.equal(player(fixture.counterPurchase.after, 'guild').spice, player(fixture.counterPurchase.before, 'guild').spice - 1);
  assert.ok(player(fixture.counterPurchase.after, 'guild').hand.some(card => card.id === fixture.counterCard && card.effect === 'karama'));
  assert.equal(player(fixture.shipment.after, 'fremen').reserves, player(fixture.shipment.before, 'fremen').reserves - 3);
  assert.equal(player(fixture.shipment.after, 'fremen').spice, player(fixture.shipment.before, 'fremen').spice);
  assert.equal(player(fixture.draw.after, 'guild').ally, 'emperor');
  assert.equal(player(fixture.draw.after, 'emperor').ally, 'guild');
  assert.equal(player(fixture.draw.after, 'fremen').ally, null);
  assert.equal(fixture.draw.after.nexusCards!.cards!.hands.fremen, 'fremen');
  assert.equal(fixture.occurrence.initiallyEmpty, true);
  assert.equal(fixture.occurrence.origin, 'natural');
  assert.equal(fixture.occurrence.pile, 0);
  assert.equal(fixture.occurrence.turn, 3);
  assert.ok(fixture.game.players.every(player => presenceAt(player, fixture.occurrence.territory) === 0));
  assert.equal(fixture.game.spice['red_chasm:7'], 8, 'The accepted appearance is captured before the original devouring');
  const done = completeFremenCunningModules(fixture), game = done.game;
  assert.equal(done.spentResponse.response?.kind, 'nexusFremenCunning');
  assert.equal(done.spentResponse.nexusCards!.cards!.hands.fremen, null);
  assert.equal(done.spentResponse.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(player(done.spentResponse, 'fremen').forces[fixture.sourceKey], 3);
  assert.equal(done.spentResponse.spice['red_chasm:7'], 8);
  assert.equal(done.beforeRide.spice['red_chasm:7'] ?? 0, 0);
  assert.equal(done.beforeRide.spice['hagga_basin:12'], 6);
  assert.equal(done.beforeRide.nexus, true);
  assert.deepEqual([...done.beforeRide.ready].sort(), done.beforeRide.players.map(player => player.id).sort());
  assert.equal(done.beforeRide.decision?.kind, 'nexusFremenCunningRide');
  assert.equal(done.beforeRide.decision?.player, 'fremen');
  assert.equal(done.beforeRide.nexusCards?.phase?.stage, 'spice', 'Original closing-card choices follow the post-negotiation rides');
  assert.equal(game.nexusFremenCunningRides!.find(ride => ride.occurrence.event === fixture.occurrence.event)!.stage, 'complete');
  assert.equal(player(game, 'fremen').forces[fixture.sourceKey] ?? 0, 0);
  assert.equal(player(game, 'fremen').forces['hagga_basin:12'], 3);
  assert.equal(player(game, 'fremen').moved, player(done.beforeRide, 'fremen').moved);
  assert.equal(player(game, 'fremen').reserves, player(done.beforeRide, 'fremen').reserves);
  assert.equal(player(game, 'fremen').spice, player(done.beforeRide, 'fremen').spice);
  assert.equal(game.spice['hagga_basin:12'], 6);
  const canceled = applyAction(done.spentResponse, 'guild', { type: 'card', mode: 'cancel', card: fixture.counterCard });
  assert.equal(canceled.nexusFremenCunningRides!.find(ride => ride.occurrence.event === fixture.occurrence.event)!.stage, 'complete');
  assert.equal(player(canceled, 'fremen').forces[fixture.sourceKey], 3);
  assert.equal(player(canceled, 'fremen').forces['hagga_basin:12'] ?? 0, 0);
  assert.equal(canceled.nexusCards!.cards!.hands.fremen, null);
  assert.equal(canceled.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(canceled.discard.filter(card => card.id === fixture.counterCard).length, 1);
  assert.equal(canceled.spice['red_chasm:7'] ?? 0, 0, 'Canceling the extra ride preserves the original worm destruction');
  physicalNexus(game);
});

void test('Advanced registered Ixians/CHOAM/Ecaz with selected independent decks, World/all14/phase retains typed remote riding and genuine Sandmaster collection', () => {
  const fixture = createFremenCunningModulesFixture({ advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    factions: ['fremen', 'guild', 'emperor', 'ixians', 'choam', 'ecaz'],
    skills: true, homeworlds: true, tech: true, strongholds: true });
  assert.ok(fixture.afterSetup.ecazTreachery && fixture.afterSetup.nexusCards && fixture.afterSetup.homeworlds &&
    fixture.afterSetup.leaderSkills && fixture.afterSetup.techTokens && fixture.afterSetup.strongholdCards);
  assert.equal(fixture.afterSetup.players.length, 6);
  assert.ok(fixture.trainer);
  const assignment = fixture.afterSetup.leaderSkills!.assignments.find(assignment => assignment.owner === 'fremen'); assert.ok(assignment);
  assert.equal(assignment.skill, 'sandmaster');
  assert.equal(assignment.leader, fixture.trainer);
  assert.ok(fixture.actions.some(step => step.actor === 'fremen' && step.action.type === 'leaderSkill' && step.action.skill === 'sandmaster'));
  assert.equal(player(fixture.shipment.after, 'fremen').elites!.reserves, player(fixture.shipment.before, 'fremen').elites!.reserves - 2);
  assert.equal(player(fixture.game, 'fremen').elites!.forces[fixture.sourceKey], 2);
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(fixture.game, 'fremen'); own.players.find(player => player.id === 'fremen')!.bot = difficulty;
    const action = botActions(own)[0]; assert.ok(action);
    const spent = applyAction(fixture.game, 'fremen', action);
    assert.equal(spent.nexusCards!.cards!.hands.fremen, null);
    assert.equal(spent.response?.kind, 'nexusFremenCunning');
  }
  const done = completeFremenCunningModules(fixture, { collect: true });
  assert.equal(done.collection!.leader, fixture.trainer);
  assert.equal(done.collection!.key, 'hagga_basin:12');
  assert.equal(done.collection!.before, 6);
  assert.equal(player(done.afterRide, 'fremen').spice, player(done.beforeRide, 'fremen').spice + 1);
  assert.equal(done.afterRide.spice['hagga_basin:12'], 5);
  assert.equal(player(done.afterRide, 'fremen').forces['hagga_basin:12'], 3);
  assert.equal(player(done.afterRide, 'fremen').elites!.forces['hagga_basin:12'], 2);
  assert.equal(player(done.afterRide, 'fremen').forces[fixture.sourceKey] ?? 0, 0);
  assert.equal(player(done.afterRide, 'fremen').elites!.forces[fixture.sourceKey] ?? 0, 0);
  assert.equal(player(done.afterRide, 'fremen').moved, player(done.beforeRide, 'fremen').moved);
  assert.equal(player(done.afterRide, 'fremen').shipped, player(done.beforeRide, 'fremen').shipped);
  assert.equal(player(done.afterRide, 'fremen').reserves, player(done.beforeRide, 'fremen').reserves);
  for (const [key, amount] of Object.entries(done.beforeRide.spice))
    if (key !== 'hagga_basin:12') assert.equal(done.afterRide.spice[key], amount, 'A remote ride collects from its destination alone');
  const invalidPile: Action = { ...done.ride.action, sandmasterPile: 'wind_pass:14' };
  assert.throws(() => applyAction(done.beforeRide, 'fremen', invalidPile), /pile|spice|Sandmaster/i);
  assert.throws(() => applyAction(done.beforeRide, 'fremen', { ...done.ride.action, sandmasterCollect: 'yes' } as unknown as Action), /Sandmaster|collect/i);
  for (const collect of [false, undefined]) {
    const plain = { ...done.ride.action };
    delete plain.sandmasterCollect; delete plain.sandmasterPile;
    const result = applyAction(done.beforeRide, 'fremen', { ...plain, ...(collect === undefined ? {} : { sandmasterCollect: collect }) });
    assert.equal(player(result, 'fremen').forces['hagga_basin:12'], 3);
    assert.equal(player(result, 'fremen').elites!.forces['hagga_basin:12'], 2);
    assert.equal(player(result, 'fremen').spice, player(done.beforeRide, 'fremen').spice);
    for (const [key, amount] of Object.entries(done.beforeRide.spice))
      assert.equal(result.spice[key], amount, 'Declining collection leaves each existing pile unchanged');
    assert.equal(result.spice['habbanya_erg:16'], 8,
      'The original second Advanced spice pile continues after the first-pile remote ride');
  }
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(done.beforeRide, 'fremen'); own.players.find(player => player.id === 'fremen')!.bot = difficulty;
    const action = botActions(own)[0]; assert.ok(action);
    const result = applyAction(done.beforeRide, 'fremen', action);
    assert.equal(result.nexusFremenCunningRides!.find(ride => ride.occurrence.event === fixture.occurrence.event)!.stage, 'complete');
  }
  physicalNexus(done.game);
});

void test('Advanced actual Ixian first-Storm HMS placement at the native desert source admits the typed Cunning arrival into its interior', () => {
  const fixture = createFremenCunningModulesFixture({ advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    factions: ['fremen', 'guild', 'emperor', 'ixians', 'choam', 'ecaz'],
    skills: true, homeworlds: true, tech: true, strongholds: true, hmsAtSource: true });
  const placement = fixture.hmsPlacement; assert.ok(placement);
  assert.equal(placement.before.mobileStronghold!.location, null);
  assert.equal(placement.after.mobileStronghold!.location, 'wind_pass:14');
  assert.equal(placement.step.actor, 'ixians');
  assert.equal(fixture.game.mobileStronghold!.location, 'wind_pass:14');
  const done = completeFremenCunningModules(fixture, { destination: { territory: MOBILE_STRONGHOLD, sector: 0 } });
  assert.equal(player(done.afterRide, 'fremen').forces[MOBILE_LOCATION], 3);
  assert.equal(player(done.afterRide, 'fremen').elites!.forces[MOBILE_LOCATION], 2);
  assert.equal(player(done.afterRide, 'fremen').forces[fixture.sourceKey] ?? 0, 0);
  assert.equal(done.afterRide.mobileStronghold!.location, 'wind_pass:14');
  assert.deepEqual(player(done.afterRide, 'ixians').forces, player(done.beforeRide, 'ixians').forces);
  assert.deepEqual(player(done.afterRide, 'ixians').elites, player(done.beforeRide, 'ixians').elites);
  assert.equal(player(done.afterRide, 'fremen').moved, player(done.beforeRide, 'fremen').moved);
  assert.equal(player(done.afterRide, 'fremen').shipped, player(done.beforeRide, 'fremen').shipped);
  assert.equal(player(done.afterRide, 'fremen').reserves, player(done.beforeRide, 'fremen').reserves);
  assert.equal(player(done.afterRide, 'fremen').spice, player(done.beforeRide, 'fremen').spice);
  physicalNexus(done.game);
});
