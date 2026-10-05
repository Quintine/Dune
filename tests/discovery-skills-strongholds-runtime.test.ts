import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createStrongholdCards } from '../game/stronghold-cards';
import { ownedTech } from '../game/tech-tokens';
import type { SukRescueOption } from '../game/suk-graduate';
import { quoteClassicSkillsStrongholdBattle } from './fixture-classic-skills-stronghold';
import { advanceClassicDiscoverySkills, classicDiscoverySkillsClean, createClassicDiscoverySkillsFixture,
  settleClassicDiscoverySkillsArrival } from './fixture-discovery-classic-skills';
import { createDiscoverySkillsStrongholdsFixture, discoverySkillsStrongholdsPlayer as player,
  finishDiscoverySkillsStrongholdsBattle, prepareDiscoverySkillsStrongholdsBattle,
  revealDiscoverySkillsStrongholdsBattle } from './fixture-discovery-skills-strongholds';

function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor); view.players.find(seat => seat.id === actor)!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, `${difficulty} has an original owned continuation.`);
    for (const action of actions) {
      const after = applyAction(structuredClone(game), actor, action);
      assert.equal(ordinaryTotal(after, actor), ordinaryTotal(game, actor),
        `${difficulty}'s actual entry, paid shipment or plan preserves its physical force inventory.`);
    }
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function ordinaryTotal(game: Game, actor: string): number {
  const seat = player(game, actor);
  return seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, count) => sum + count, 0);
}

void test('authenticated Advanced original lobby and undealt offers retain identities, unused cards, real training and the first end-Mentat claim before free entry', () => {
  const lobby = createGame('HUMANDISCOVERYSKILLS', newPlayer('human-guild', 'Guild', 'guild'), true);
  joinGame(lobby, newPlayer('human-emperor', 'Emperor', 'emperor'));
  joinGame(lobby, newPlayer('human-harkonnen', 'Harkonnen', 'harkonnen'));
  const unchanged = structuredClone(lobby);
  const fixture = createDiscoverySkillsStrongholdsFixture({ initial: lobby, tech: true });
  assert.deepEqual(lobby, unchanged);
  assert.deepEqual(fixture.setup.players.map(seat => seat.id), lobby.players.map(seat => seat.id));
  assert.deepEqual(fixture.setup.strongholdCards, createStrongholdCards());
  assert.equal(fixture.setup.leaderSkills!.deck.length + Object.values(fixture.setup.leaderSkills!.offers)
    .reduce((sum, offer) => sum + offer.cards.length, 0), 14);
  const claimed = applyAction(structuredClone(fixture.beforeFirstMentat), fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
  assert.equal(claimed.turn, 2);
  assert.equal(claimed.strongholdCards!.owners.arrakeen, fixture.owner);
  assert.equal(claimed.strongholdCards!.claimedTurn, 1);
  const before = player(fixture.entryWindow, fixture.owner);
  legalPolicies(fixture.entryWindow, fixture.owner);
  reject(fixture.entryWindow, fixture.opponent, fixture.entryStep.action);
  const entered = applyAction(structuredClone(fixture.entryWindow), fixture.entryStep.actor, fixture.entryStep.action);
  assert.equal(player(entered, fixture.owner).forces['cistern:0'], 3);
  assert.equal(player(entered, fixture.owner).forces[`${fixture.discovery.parent}:${fixture.discovery.parentSector}`] ?? 0, 0);
  assert.equal(player(entered, fixture.owner).spice, before.spice);
  assert.equal(player(entered, fixture.owner).reserves, before.reserves);
  assert.equal(player(entered, fixture.owner).moved, before.moved);
  assert.equal(player(entered, fixture.owner).shipped, before.shipped);
  assert.equal(viewGame(entered, fixture.owner).leaderSkills!.assignments.find(assignment => assignment.owner === fixture.owner)!.leader, fixture.discovery.leader);
  const admitted = createDiscoverySkillsStrongholdsFixture({ initial: fixture.setup, tech: true });
  assert.deepEqual(admitted.setup, fixture.setup, 'An admitted original setup is never redealt.');
  assert.equal(admitted.game.strongholdCards!.owners.arrakeen, fixture.owner);
});

void test('held Arrakeen support pays only the actual subsidy while trained physical Suk rescue precedes original winner cleanup and Tech reward for all four policies', () => {
  const fixture = createDiscoverySkillsStrongholdsFixture({ tech: true, support: 3, ownerDial: 4,
    ownerWeapon: 'projectile', ownerDefense: 'shield', opponentWeapon: 'projectile' });
  const revealed = revealDiscoverySkillsStrongholdsBattle(fixture);
  const quote = quoteClassicSkillsStrongholdBattle(revealed);
  const payment = quote.payments.find(receipt => receipt.player === fixture.owner)!;
  assert.equal(payment.bankSupport, 2); assert.equal(payment.ownPayment, 1);
  assert.equal(quote.casualties!.options[0].normal, 5);
  assert.equal(quote.sukGraduate?.mode, 'skilled');
  const original = player(revealed, fixture.owner), enemy = player(revealed, fixture.opponent);
  const token = ownedTech(revealed.techTokens, fixture.opponent); assert.equal(token.length, 1);
  const rescue = finishDiscoverySkillsStrongholdsBattle(revealed, { stop: 'skill' });
  assert.ok(rescue.decision?.kind === 'sukRescue');
  assert.equal(player(rescue, fixture.owner).spice, original.spice - 1 + 3, 'Only actual own support is debited; the dead printed enemy disc pays its real bounty.');
  assert.equal(player(rescue, fixture.opponent).tanks, enemy.tanks + 8);
  assert.deepEqual(rescue.techTokens, revealed.techTokens);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(rescue, fixture.owner); view.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'decision');
    assert.ok(action && typeof action.choice === 'number');
    const selected: SukRescueOption = rescue.decision.options[action.choice];
    assert.equal(selected.normal, 3); assert.equal(selected.elite, 0); assert.equal(selected.kept?.key, fixture.key);
    reject(rescue, fixture.opponent, action);
    const cleanup = applyAction(structuredClone(rescue), fixture.owner, action);
    assert.equal(player(cleanup, fixture.owner).forces[fixture.key], 4);
    assert.equal(player(cleanup, fixture.owner).reserves, original.reserves + 2);
    assert.equal(player(cleanup, fixture.owner).tanks, original.tanks + 2);
    assert.equal(player(cleanup, fixture.owner).battleLosses, original.battleLosses + 2);
    assert.equal(ordinaryTotal(cleanup, fixture.owner), ordinaryTotal(revealed, fixture.owner));
    assert.equal(cleanup.decision?.kind, 'battleCards');
    assert.deepEqual(cleanup.techTokens, revealed.techTokens);
    const done = finishDiscoverySkillsStrongholdsBattle(cleanup);
    assert.equal(done.techTokens![token[0]].owner, fixture.owner);
    assert.deepEqual(ownedTech(done.techTokens, fixture.opponent), []);
    assert.equal(done.lastBattleContext!.winner, fixture.owner);
    assert.equal(done.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(viewGame(done, fixture.owner).leaderSkills!.assignments.find(assignment => assignment.owner === fixture.owner)!.faceUp, true);
  }
});

void test('unheld Arrakeen supplies no subsidy; a held Arrakeen card never donates its territory-only bank benefit to the actual nested Cistern battle', () => {
  for (const options of [{ holder: 'unclaimed' as const }, { nestedBattle: true }]) {
    const fixture = createDiscoverySkillsStrongholdsFixture({ ...options, support: 2, ownerDial: 4,
      ownerWeapon: 'projectile', ownerDefense: 'shield', opponentWeapon: 'projectile' });
    const revealed = revealDiscoverySkillsStrongholdsBattle(fixture);
    assert.equal(viewGame(revealed, fixture.owner).battle!.strongholdEffects[fixture.owner], null);
    const quote = quoteClassicSkillsStrongholdBattle(revealed);
    const payment = quote.payments.find(receipt => receipt.player === fixture.owner)!;
    assert.equal(payment.bankSupport, 0); assert.equal(payment.ownPayment, 2);
    const rescue = finishDiscoverySkillsStrongholdsBattle(revealed, { stop: 'skill' });
    assert.equal(player(rescue, fixture.owner).spice, player(revealed, fixture.owner).spice - 2 + 3);
    assert.equal(rescue.lastBattleContext!.territory, options.nestedBattle ? 'cistern' : 'arrakeen');
    assert.equal(rescue.strongholdCards!.owners.arrakeen, options.nestedBattle ? fixture.owner : null);
  }
});

void test('held Carthag actual Shield protects the normal Prana Bindu-trained disc and its matching physical defense bonus wins; unheld poison still kills', () => {
  for (const holder of ['owner', 'unclaimed'] as const) {
    const fixture = createDiscoverySkillsStrongholdsFixture({ kind: 'carthag', holder, skill: 'prana-bindu-adept', hide: false,
      ownerDial: 0.5, support: 0, opponentDial: 1, opponentSupport: 1, ownerDefense: 'shield', opponentWeapon: 'poison' });
    const revealed = revealDiscoverySkillsStrongholdsBattle(fixture);
    const quote = quoteClassicSkillsStrongholdBattle(revealed);
    assert.equal(quote.winner, holder === 'owner' ? fixture.owner : fixture.opponent);
    const cleanup = finishDiscoverySkillsStrongholdsBattle(revealed, { stop: 'cleanup' });
    assert.equal(player(cleanup, fixture.owner).leaders.find(leader => leader.id === fixture.leader)!.dead, holder !== 'owner');
    if (holder === 'owner') {
      const bonus = quote.leaderSkillBonuses[revealed.battle!.attacker === fixture.owner ? 'attacker' : 'defender'];
      assert.deepEqual(bonus.applied, [{ skill: 'prana-bindu-adept', amount: 1, mode: 'normal' }]);
      assert.equal(player(cleanup, fixture.owner).spice, player(revealed, fixture.owner).spice);
    }
  }
});

void test('held Sietch Tabr victory income and sole Cistern Collection remain separate; Tabr creates no city Collection payment', () => {
  const fixture = createDiscoverySkillsStrongholdsFixture({ kind: 'sietch_tabr', skill: 'planetologist', ownerDial: 2, support: 2,
    opponentDial: 1, opponentSupport: 1, ownerDefense: 'shield' });
  const revealed = revealDiscoverySkillsStrongholdsBattle(fixture), quote = quoteClassicSkillsStrongholdBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: 1 }]);
  const cleanup = finishDiscoverySkillsStrongholdsBattle(revealed, { stop: 'cleanup' });
  const before = player(revealed, fixture.owner).spice;
  assert.equal(player(cleanup, fixture.owner).spice, before - 2 + 1);
  const collected = advanceClassicDiscoverySkills(finishDiscoverySkillsStrongholdsBattle(cleanup), state => state.phase === 7 && classicDiscoverySkillsClean(state));
  assert.equal(player(collected, fixture.owner).forces['cistern:0'], 3);
  assert.equal(player(collected, fixture.owner).forces[fixture.key], 6);
  assert.equal(player(collected, fixture.owner).spice, before - 2 + 1 + 2,
    'Only actual Tabr battle income and sole Cistern Collection pay; Tabr is not an income-paying city.');
  const nextTurn = advanceClassicDiscoverySkills(collected, state => state.turn === 3);
  assert.equal(nextTurn.strongholdCards!.claimedTurn, 2, 'The next real end-Mentat must accept the actually entered nested force keys.');
  assert.equal(nextTurn.strongholdCards!.owners.sietch_tabr, fixture.owner);
  assert.equal(player(nextTurn, fixture.owner).forces['cistern:0'], 3);
});

void test('real held-card nested shipment charges one spice, does not consume free-entry movement, and has four legal native policies', () => {
  const fixture = createDiscoverySkillsStrongholdsFixture();
  const window = fixture.shipmentWindow, before = player(window, fixture.owner);
  legalPolicies(window, fixture.owner);
  let shipped = applyAction(structuredClone(window), fixture.paidShipmentStep.actor, fixture.paidShipmentStep.action);
  shipped = settleClassicDiscoverySkillsArrival(shipped);
  assert.equal(player(shipped, fixture.owner).spice, before.spice - 1);
  assert.equal(player(shipped, fixture.owner).reserves, before.reserves - 1);
  assert.equal(player(shipped, fixture.owner).forces['cistern:0'], 4);
  assert.equal(player(shipped, fixture.owner).moved, before.moved);
  assert.equal(player(shipped, fixture.owner).shipped, true);
  assert.equal(shipped.strongholdCards!.owners.arrakeen, fixture.owner);
  const prepared = prepareDiscoverySkillsStrongholdsBattle(fixture);
  legalPolicies(prepared, fixture.owner);
});

void test('selected canonical unused cards are retained while Basic admission and injected held receipts remain outside original controls', () => {
  const original = createClassicDiscoverySkillsFixture({ advanced: true, strongholdCards: true });
  assert.deepEqual(original.setup.strongholdCards, createStrongholdCards());
  const actualOffers = structuredClone(original.setup);
  const resumed = createDiscoverySkillsStrongholdsFixture({ initial: actualOffers });
  assert.deepEqual(actualOffers, original.setup, 'The authenticated original offers remain untouched.');
  assert.deepEqual(resumed.setup, original.setup);
  assert.equal(resumed.game.leaderSkills!.assignments.find(assignment => assignment.owner === resumed.owner)!.skill, 'planetologist',
    'Human setup continues its actual available offer, not a demanded Suk replacement.');
  assert.throws(() => createClassicDiscoverySkillsFixture({ strongholdCards: true }));
  const forged = structuredClone(original.setup); forged.strongholdCards!.owners.arrakeen = original.collector;
  assert.throws(() => createClassicDiscoverySkillsFixture({ initial: forged }));
});
