import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_STRONGHOLD } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import type { FactionId } from '../game/catalog';
import { quotePhaseResources } from '../game/phase-resource-quote';
import { forceRevivalQuote } from '../game/revival';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  createMixedPhaseModulesFixture, createMixedPhaseModulesProgramme, mixedPhaseModulesInventory,
  mixedPhaseModulesPlayer as player, mixedPhaseModulesClean, type MixedPhaseModulesOptions,
} from './fixture-mixed-phase-modules';

const training: Partial<Record<FactionId, LeaderSkillId>> = {
  ixians: 'prana-bindu-adept', tleilaxu: 'swordmaster-of-ginaz', choam: 'killer-medic',
  richese: 'warmaster', ecaz: 'master-of-assassins', moritani: 'mentat',
};
function originalSkills(game: Game) {
  const state = game.leaderSkills; assert.ok(state);
  const identities = [...state.deck, ...Object.values(state.offers).flatMap(offer => offer.cards),
    ...state.assignments.map(assignment => assignment.skill)].sort();
  assert.deepEqual(identities, LEADER_SKILL_CARDS.map(card => card.id).sort());
}
function originalOccupation(game: Game) {
  assert.equal(game.homeworldOccupationPreview, true);
  assert.equal(game.pendingHomeworldOccupiedIncome, null);
  assert.deepEqual(game.homeworldOccupiedIncomeHistory, []);
  assert.ok(game.homeworldOccupiedPercentageLedger);
  if (game.players.some(seat => seat.faction === 'choam')) {
    assert.equal(game.homeworldTupilePreview, true); assert.ok(game.homeworldTupileState);
    assert.equal(game.pendingHomeworldTupileCleanup, null);
  }
  if (game.players.some(seat => seat.faction === 'ecaz')) {
    assert.equal(game.homeworldEcazVictoryPreview, true); assert.equal(game.ecazOccupyPreview, true);
  }
}
function actualTraining(f: ReturnType<typeof createMixedPhaseModulesFixture>, requested: typeof training) {
  originalSkills(f.setup); originalSkills(f.afterSetup); originalOccupation(f.setup);
  const assignments = f.afterSetup.leaderSkills!.assignments;
  assert.equal(assignments.length, f.afterSetup.players.length);
  for (const assignment of assignments) {
    const owner = player(f.afterSetup, assignment.owner);
    assert.ok(owner.leaders.some(leader => leader.id === assignment.leader));
    if (requested[owner.faction]) assert.equal(assignment.skill, requested[owner.faction]);
    assert.ok(f.actions.some(step => step.actor === assignment.owner && step.action.type === 'leaderSkill' &&
      step.action.skill === assignment.skill && step.action.leader === assignment.leader && typeof step.action.event === 'string'));
  }
  assert.ok(!f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory);
  assert.deepEqual(f.staging, []);
}

void test('public mixed and base World Skills starts retain mandatory original occupation state and original fourteen-card offers', () => {
  const cases: MixedPhaseModulesOptions[] = [
    { factions: ['ecaz', 'ixians', 'tleilaxu'], expansions: ['ix', 'choam', 'ecaz'], training: { ecaz: 'spice-banker' } },
    { factions: ['atreides', 'emperor'], expansions: [], training: { emperor: 'bureaucrat' } },
  ];
  for (const options of cases) {
    const f = createMixedPhaseModulesFixture({ ...options, homeworlds: true, skills: true });
    assert.equal(f.skills, true); assert.equal(f.homeworlds, true);
    const option = f.actions.findIndex(step => step.action.type === 'moduleOption' && step.action.module === 'leaderSkills');
    const ready = f.actions.findIndex(step => step.action.type === 'ready');
    assert.ok(option >= 0 && option < ready); assert.equal(f.actions[option].actor, f.initial.host);
    assert.equal(f.lobby.lobbyOptions?.leaderSkills, true);
    assert.equal(f.game.phase, 1); assert.equal(f.game.turn, 1); assert.equal(f.game.advanced, false);
    assert.ok(!f.game.techTokens && !f.game.strongholdCards && !f.game.ecazTreachery);
    actualTraining(f, options.training ?? {});
  }
});

void test('public Advanced mixed World Skills and phase selections preserve the original requested eligible training', () => {
  const f = createMixedPhaseModulesFixture({ factions: ['ixians', 'ecaz', 'moritani'], expansions: ['ix', 'ecaz'],
    advanced: true, homeworlds: true, skills: true, tech: true, strongholds: true, independent: true,
    training: { ixians: 'mentat', ecaz: 'spice-banker', moritani: 'warmaster' } });
  actualTraining(f, { ixians: 'mentat', ecaz: 'spice-banker', moritani: 'warmaster' });
  assert.equal(f.setup.ecazTreachery, true); assert.ok(f.game.techTokens && f.game.strongholdCards);
  assert.equal(f.originalInventory.length, 50);
});

for (const advanced of [false, true]) void test(`public all-six ${advanced ? 'Advanced World Skills, independent cards and Strongholds' : 'Basic World Skills'} keeps earned native phase income and a real free return`, () => {
  const f = createMixedPhaseModulesProgramme({ advanced, homeworlds: true, skills: true, training,
    independent: advanced });
  actualTraining(f, training); originalSkills(f.game);
  assert.equal(f.originalInventory.length, advanced ? 60 : 57);
  for (const [actor, receipt, location] of [
    ['choam', f.choamShipment, f.choamLocation], ['moritani', f.moritaniShipment, f.casualtyLocation],
  ] as const) {
    const action = receipt.steps[0].action;
    assert.equal(action.type, 'ship'); assert.equal(action.amount, 1);
    assert.deepEqual(action.homeworldSources, nativeShipmentSources(viewGame(receipt.before, actor), 1, 0));
    assert.equal(player(receipt.after, actor).forces[location], 1);
    assert.equal(player(receipt.after, actor).reserves, player(receipt.before, actor).reserves - 1);
    assert.equal(receipt.after.techTokens?.heighliners.spice, 1);
  }
  // Compare the actual current phase invoice; role-bearing profiles need not
  // retain an unrelated no-Skills shipment debit assumption.
  const shipping = quotePhaseResources(f.shipmentPayout.before);
  assert.ok(shipping.credits.some(credit => credit.kind === 'tech' && credit.token === 'heighliners' && credit.amount === 1));
  assert.equal(player(f.shipmentPayout.after, 'ixians').spice, shipping.balances.ixians);
  assert.equal(f.shipmentPayout.after.techTokens?.heighliners.spice, 0);
  if (advanced) {
    assert.equal(f.mentat.after.strongholdCards?.claimedTurn, 1);
    assert.equal(f.mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(f.mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(f.mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  }
  assert.equal(f.storm.before.stormMovementSource?.kind, advanced ? 'card' : 'dials');
  assert.equal(player(f.storm.after, 'moritani').tanks, 1);
  assert.equal(player(f.storm.after, 'moritani').forces[f.casualtyLocation], undefined);
  const quote = forceRevivalQuote(f.revival.before, player(f.revival.before, 'moritani'), 1, 0);
  assert.equal(quote.free, 1); assert.equal(quote.cost, 0);
  assert.deepEqual(f.revival.steps[0], { actor: 'moritani', action: { type: 'revive', amount: 1, elite: 0 } });
  assert.equal(viewGame(f.revival.before, 'moritani').revival.tleilaxuHomeworldIncomeBlocked, false);
  assert.equal(player(f.revival.after, 'moritani').tanks, 0);
  assert.equal(player(f.revival.after, 'moritani').reserves, player(f.revival.before, 'moritani').reserves + 1);
  const revival = quotePhaseResources(f.revivalPayout.before);
  assert.ok(revival.credits.some(credit => credit.kind === 'tech' && credit.token === 'axlotl' && credit.amount === 1));
  assert.equal(player(f.revivalPayout.after, 'tleilaxu').spice, revival.balances.tleilaxu);
  assert.equal(f.revivalPayout.after.techTokens?.axlotl.spice, 0);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 2); assert.ok(mixedPhaseModulesClean(f.game));
  if (advanced) {
    const actor = f.game.active; assert.ok(actor);
    const own = viewGame(f.game, actor); own.players.find(seat => seat.id === actor)!.bot = 'Easy';
    const candidate = botActions(own).find(action => action.type === 'endMovement'); assert.ok(candidate);
    assert.doesNotThrow(() => applyAction(f.game, actor, candidate));
  }
});
