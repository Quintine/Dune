import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { casualtyOptions, maxCombatDial } from '../game/combat';
import { TECH_TOKENS, ownedTech } from '../game/tech-tokens';
import { strongholdControllers } from '../game/stronghold-cards';
import { nexusInventory } from './fixture-nexus-cards';
import {
  advanceNexusSkillsModulesBattle, beginNexusSkillsModulesCunning,
  createNexusSkillsModulesBattleFixture, finishNexusSkillsModulesBattle,
  nexusSkillsModulesBattlePlayer as player, prepareNexusSkillsModulesBattle,
  quoteNexusSkillsModulesBattle, revealNexusSkillsModulesBattle, stepNexusSkillsModulesBattle,
  type NexusSkillsModulesBattleFixture,
} from './fixture-nexus-skills-modules-battles';

function custody(game: Game): void {
  nexusInventory(game);
  const skills = game.leaderSkills!;
  assert.deepEqual([...skills.deck, ...skills.assignments.map(assignment => assignment.skill),
    ...Object.values(skills.offers).flatMap(offer => offer.cards)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(seat => seat.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.equal(cards.length, 33); assert.equal(new Set(cards.map(card => card.id)).size, 33);
  for (const seat of game.players) {
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, count) => sum + count, 0), 20);
    if (seat.elites) {
      assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, count) => sum + count, 0),
        seat.faction === 'fremen' ? 3 : 5);
      assert.ok(seat.elites.reserves <= seat.reserves && seat.elites.tanks <= seat.tanks);
      for (const [key, count] of Object.entries(seat.elites.forces)) assert.ok(count <= (seat.forces[key] ?? 0));
    }
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function moneyAtCleanup(fixture: NexusSkillsModulesBattleFixture, revealed: Game, cleanup: Game): void {
  const quote = quoteNexusSkillsModulesBattle(revealed);
  assert.equal(cleanup.decision?.kind, 'battleCards');
  assert.equal(cleanup.lastBattleContext!.winner, quote.winner);
  for (const seat of revealed.players) {
    const debit = quote.payments.filter(payment => payment.player === seat.id).reduce((sum, payment) => sum + payment.ownPayment, 0);
    const income = quote.strongholdIncome.filter(payment => payment.player === seat.id).reduce((sum, payment) => sum + payment.amount, 0);
    const bounty = quote.bounty?.player === seat.id ? quote.bounty.amount : 0;
    assert.equal(player(cleanup, seat.id).spice, seat.spice - debit + income + bounty,
      'Actual payer debit and printed-disc bounty settle once; the bank subsidy is not personal income');
  }
  assert.deepEqual(cleanup.techTokens, revealed.techTokens, 'Winner Tech reward waits for original card cleanup');
  assert.deepEqual(cleanup.strongholdCards, fixture.afterFirstMentat.strongholdCards, 'Battle does not acquire or steal a held Stronghold Card');
  custody(cleanup);
}

for (const advanced of [false, true]) for (const count of [3, 4, 5, 6]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Tech ${count}: original Storm assignment, saved hands/offers, alliance and closing Emperor draw are replayable`, () => {
    const fixture = createNexusSkillsModulesBattleFixture({ advanced, tech: true, strongholds: advanced,
      seatIds: Array.from({ length: count }, (_, index) => `human-${advanced}-${count}-${index}`) });
    for (const game of [fixture.initial, fixture.afterSetup, fixture.afterFirstStorm, fixture.afterFirstMentat, fixture.afterDraw, fixture.beforeBattle]) custody(game);
    assert.ok(TECH_TOKENS.some(token => fixture.beforeFirstStorm.techTokens![token.id].owner === null));
    const storm = stepNexusSkillsModulesBattle(fixture.beforeFirstStorm, fixture.firstStormStep);
    assert.deepEqual(storm, fixture.afterFirstStorm);
    assert.ok(TECH_TOKENS.every(token => storm.techTokens![token.id].owner));
    assert.equal(new Set(TECH_TOKENS.map(token => storm.techTokens![token.id].owner)).size, 3);
    const mentat = stepNexusSkillsModulesBattle(fixture.beforeFirstMentat, fixture.firstMentatStep);
    assert.deepEqual(mentat, fixture.afterFirstMentat);
    if (advanced) {
      assert.deepEqual(mentat.strongholdCards!.owners, strongholdControllers(fixture.beforeFirstMentat.players, false));
      assert.equal(mentat.strongholdCards!.owners.arrakeen, fixture.owner);
      assert.equal(strongholdControllers(fixture.beforeBattle.players, false).arrakeen, null,
        'Real later contested positions differ from retained first-Mentat custody');
    }
    let allied = fixture.beforeAlliance;
    for (const action of fixture.allianceActions) allied = stepNexusSkillsModulesBattle(allied, action);
    assert.equal(player(allied, fixture.observer).ally, fixture.partner);
    assert.equal(player(allied, fixture.partner).ally, fixture.observer);
    assert.equal(player(fixture.beforeDraw, fixture.owner).ally, null);
    const drawn = stepNexusSkillsModulesBattle(fixture.beforeDraw, fixture.drawAction);
    assert.deepEqual(drawn, fixture.afterDraw);
    assert.equal(drawn.nexusCards!.cards!.hands[fixture.owner], 'emperor');
    let saved = structuredClone(fixture.initial);
    while (saved.setupStage === 'prediction') saved = stepNexusSkillsModulesBattle(saved);
    const resumed = createNexusSkillsModulesBattleFixture({ initial: saved, skill: 'warmaster' });
    assert.deepEqual(resumed.initial, saved);
    assert.deepEqual(resumed.initial.players.map(seat => [seat.id, seat.hand]), saved.players.map(seat => [seat.id, seat.hand]));
    assert.deepEqual(resumed.initial.leaderSkills!.offers, saved.leaderSkills!.offers);
    const unavailable = LEADER_SKILL_CARDS.find(card => !saved.leaderSkills!.offers[fixture.owner]?.cards.includes(card.id))!;
    reject(fixture.beforeBattle, fixture.observer, fixture.battleAction.action);
    assert.throws(() => createNexusSkillsModulesBattleFixture({ initial: saved, skill: unavailable.id }));
    assert.deepEqual(saved, resumed.initial);
  });
}

for (const band of ['normal', 'skilled'] as const) {
  void test(`held Arrakeen + ${band} Warmaster: bank two reduces debit, not three supported temporary-counter casualties or printed bounty`, () => {
    const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, band, ownerWeapon: 'projectile', ownerDefense: 'worthless' });
    const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
    const forces = viewGame(revealed, fixture.owner).battle!.ownForces!;
    const quote = quoteNexusSkillsModulesBattle(revealed);
    assert.equal(forces.normal, 7); assert.equal(forces.elite, 0); assert.equal(forces.temporaryElite, 5);
    assert.equal(maxCombatDial(forces), 12);
    const payment = quote.payments.find(payment => payment.player === fixture.owner)!;
    assert.equal(payment.bankSupport, 2); assert.equal(payment.ownPayment, 1); assert.equal(payment.allyPayment, 0);
    assert.deepEqual(quote.casualties!.options.map(loss => [loss.normal, loss.elite, loss.paidNormal, loss.paidElite]),
      [[3, 0, 3, 0], [4, 0, 3, 0], [5, 0, 3, 0]]);
    const bonus = revealed.battle!.attacker === fixture.owner ? quote.leaderSkillBonuses.attacker : quote.leaderSkillBonuses.defender;
    assert.equal(bonus.bonus, band === 'skilled' ? 3 : 1);
    const opposingDisc = player(revealed, fixture.opponent).leaders.find(disc => disc.id === revealed.battle!.plans[fixture.opponent].leader)!;
    assert.equal(quote.bounty!.amount, opposingDisc.strength);
    let losses = finishNexusSkillsModulesBattle(revealed, { stop: 'losses' });
    assert.ok(losses.decision?.kind === 'battleLosses');
    reject(losses, fixture.opponent, { type: 'decision', choice: 2 });
    losses = applyAction(losses, fixture.owner, { type: 'decision', choice: 2 });
    assert.equal(player(losses, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 5);
    assert.deepEqual(player(losses, fixture.owner).elites, player(revealed, fixture.owner).elites);
    assert.equal(losses.nexusSardaukarHistory!.at(-1)!.casualties!.outcome, 'complete');
    moneyAtCleanup(fixture, revealed, losses);
    const token = ownedTech(revealed.techTokens, fixture.opponent); assert.equal(token.length, 1);
    const done = finishNexusSkillsModulesBattle(losses);
    assert.equal(done.techTokens![token[0]].owner, fixture.owner);
    assert.deepEqual(ownedTech(done.techTokens, fixture.opponent), []);
    custody(done);
  });
}

for (const band of ['normal', 'skilled'] as const) for (const support of [3, 6]) {
  void test(`${band} Suk with held Arrakeen support ${support}: original support eligibility survives bank subsidy and rescue settles before winner reward`, () => {
    const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, skill: 'suk-graduate', band,
      support, ownerDial: support === 6 ? 10 : 6, ownerDefense: 'shield' });
    const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
    const quote = quoteNexusSkillsModulesBattle(revealed);
    const physicalLoss = support === 6 ? 6 : band === 'normal' ? 4 : 5;
    const payment = quote.payments.find(payment => payment.player === fixture.owner)!;
    assert.equal(payment.bankSupport, 2); assert.equal(payment.ownPayment, support - 2);
    if (support === 6) {
      assert.deepEqual(quote.casualties!.options, [{ normal: 6, elite: 0, paidNormal: 6, paidElite: 0 }]);
      assert.notDeepEqual(quote.casualties!.options, casualtyOptions(quote.casualties!.forces, 10, payment.ownPayment));
    }
    let game: Game;
    if (support === 3) {
      const losses = finishNexusSkillsModulesBattle(revealed, { stop: 'losses' });
      assert.ok(losses.decision?.kind === 'battleLosses');
      game = applyAction(losses, fixture.owner, { type: 'decision', choice: band === 'normal' ? 1 : 2 });
    } else game = finishNexusSkillsModulesBattle(revealed, { stop: band === 'skilled' ? 'rescue' : 'cleanup' });
    const before = player(revealed, fixture.owner);
    if (band === 'skilled') {
      const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
      const pending = game.pendingSukRescue!;
      assert.equal(pending.commitment.forces.temporaryElite, 5);
      assert.ok(pending.losses);
      assert.equal(pending.losses.normal, physicalLoss); assert.equal(pending.losses.paidNormal, support);
      assert.equal(game.nexusSardaukarHistory!.at(-1)!.casualties!.outcome, 'pending');
      assert.equal(player(game, fixture.owner).tanks, before.tanks);
      assert.deepEqual(game.techTokens, revealed.techTokens);
      const choice = decision.options.findIndex(option => option.normal === 3 && option.elite === 0 && option.kept?.key === fixture.key && option.kept.kind === 'normal');
      assert.ok(choice >= 0);
      const action: Action = { type: 'decision', event: decision.event, choice };
      reject(game, fixture.opponent, action);
      reject(game, fixture.owner, { ...action, event: `${decision.event}-stale` });
      game = applyAction(game, fixture.owner, action);
      reject(game, fixture.owner, action);
    }
    const saved = band === 'skilled' ? 3 : 1, kept = band === 'skilled' ? 1 : 0;
    assert.equal(player(game, fixture.owner).forces[fixture.key], 7 - physicalLoss + kept);
    assert.equal(player(game, fixture.owner).reserves, before.reserves + saved - kept);
    assert.equal(player(game, fixture.owner).tanks, before.tanks + physicalLoss - saved);
    // User ruling 7 October 2026: rescued counters still count toward the
    // seven Kwisatz Haderach losses, so the counter gains every dialed casualty.
    assert.equal(player(game, fixture.owner).battleLosses, before.battleLosses + physicalLoss);
    assert.deepEqual(player(game, fixture.owner).elites, before.elites);
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.nexusSardaukarHistory!.at(-1)!.casualties!.outcome, 'complete');
    moneyAtCleanup(fixture, revealed, game);
    custody(finishNexusSkillsModulesBattle(game));
  });
}

void test('actual starred Sardaukar block ordinary-as-Sardaukar Cunning; native typed Suk rescue keeps the selected star rather than creating an elite Tank', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, skill: 'suk-graduate', ownerElites: 1,
    ownerDial: 5, support: 3, ownerDefense: 'shield' });
  const prepared = prepareNexusSkillsModulesBattle(fixture);
  const offer = viewGame(prepared, fixture.owner).nexusSardaukar!.offer!;
  reject(prepared, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
  assert.equal(prepared.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  const revealed = revealNexusSkillsModulesBattle(fixture, { state: prepared });
  const own = viewGame(revealed, fixture.owner).battle!.ownForces!;
  assert.equal(own.normal, 7); assert.equal(own.elite, 1); assert.equal(own.temporaryElite ?? 0, 0);
  let game = finishNexusSkillsModulesBattle(revealed, { stop: 'losses' });
  assert.ok(game.decision?.kind === 'battleLosses');
  const loss = game.decision.options.findIndex(option => option.normal === 4 && option.elite === 1); assert.ok(loss >= 0);
  game = applyAction(game, fixture.owner, { type: 'decision', choice: loss });
  const rescue = game.decision; assert.ok(rescue?.kind === 'sukRescue');
  const choice = rescue.options.findIndex(option => option.normal === 2 && option.elite === 1 && option.kept?.kind === 'elite'); assert.ok(choice >= 0);
  const original = player(revealed, fixture.owner);
  const physicalRescue = structuredClone(game);
  game = applyAction(game, fixture.owner, { type: 'decision', event: rescue.event, choice });
  assert.equal(player(game, fixture.owner).forces[fixture.key], 4);
  assert.equal(player(game, fixture.owner).elites!.forces[fixture.key], 1);
  assert.equal(player(game, fixture.owner).reserves, original.reserves + 2);
  assert.equal(player(game, fixture.owner).elites!.reserves, original.elites!.reserves);
  assert.equal(player(game, fixture.owner).tanks, original.tanks + 2);
  assert.equal(player(game, fixture.owner).elites!.tanks, original.elites!.tanks);
  moneyAtCleanup(fixture, revealed, game);
  custody(finishNexusSkillsModulesBattle(game));
  const normalChoice = rescue.options.findIndex(option => option.normal === 3 && option.elite === 0 && option.kept?.kind === 'normal');
  assert.ok(normalChoice >= 0);
  const ordinary = applyAction(physicalRescue, fixture.owner, { type: 'decision', event: rescue.event, choice: normalChoice });
  assert.equal(player(ordinary, fixture.owner).forces[fixture.key], 4);
  assert.equal(player(ordinary, fixture.owner).elites!.forces[fixture.key] ?? 0, 0);
  assert.equal(player(ordinary, fixture.owner).reserves, original.reserves + 2);
  assert.equal(player(ordinary, fixture.owner).elites!.reserves, original.elites!.reserves);
  assert.equal(player(ordinary, fixture.owner).tanks, original.tanks + 2);
  assert.equal(player(ordinary, fixture.owner).elites!.tanks, original.elites!.tanks + 1,
    'An unsaved actual starred casualty enters starred Tanks; temporary ordinary roles never do');
  moneyAtCleanup(fixture, revealed, ordinary);
  custody(finishNexusSkillsModulesBattle(ordinary));
});

void test('held Carthag physical Shield provides poison protection after first-Mentat positions change, preserving the actual skilled Suk entitlement', () => {
  for (const strongholds of [false, true]) {
    const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds, kind: 'carthag', skill: 'suk-graduate',
      ownerDefense: 'shield', opponentWeapon: 'poison' });
    const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
    const quote = quoteNexusSkillsModulesBattle(revealed);
    const death = revealed.battle!.attacker === fixture.owner ? quote.leaderDeaths.attacker : quote.leaderDeaths.defender;
    assert.equal(death, !strongholds);
    assert.equal(!!quote.sukGraduate, strongholds);
    if (strongholds) {
      assert.equal(fixture.afterFirstMentat.strongholdCards!.owners.carthag, fixture.owner);
      assert.equal(strongholdControllers(fixture.beforeBattle.players, false).carthag, null);
      const rescue = finishNexusSkillsModulesBattle(revealed, { stop: 'rescue' });
      assert.equal(rescue.decision?.kind, 'sukRescue');
      const cleanup = finishNexusSkillsModulesBattle(rescue, { stop: 'cleanup' });
      assert.equal(player(cleanup, fixture.owner).leaders.find(disc => disc.id === fixture.trainer)!.dead, false);
      moneyAtCleanup(fixture, revealed, cleanup);
    } else {
      const cleanup = finishNexusSkillsModulesBattle(revealed, { stop: 'cleanup' });
      assert.equal(player(cleanup, fixture.owner).leaders.find(disc => disc.id === fixture.trainer)!.dead, true);
      assert.equal(cleanup.leaderSkills!.assignments.some(assignment => assignment.leader === fixture.trainer), false);
      assert.equal(cleanup.leaderSkills!.deck.filter(skill => skill === 'suk-graduate').length, 1);
      assert.equal(cleanup.pendingSukRescue ?? null, null);
      const printed = player(revealed, fixture.owner).leaders.find(disc => disc.id === fixture.trainer)!.strength;
      assert.equal(quote.bounty!.amount, printed);
      moneyAtCleanup(fixture, revealed, cleanup);
    }
  }
});

void test('several losing-owner tokens are actually earned by first-turn combat; original rescue, winner disposal, loser retention, mandatory token selection and inspection remain separate', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, opponentTokens: 'several', opponentNexus: 'moritani',
    skill: 'suk-graduate', ownerDefense: 'shield', opponentDefense: 'shield' });
  assert.equal(fixture.warmupAfterBattle!.lastBattleContext!.winner, fixture.opponent);
  assert.equal(ownedTech(fixture.afterFirstStorm.techTokens, fixture.opponent).length, 1);
  const original = ownedTech(fixture.game.techTokens, fixture.opponent); assert.equal(original.length, 2);
  const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
  const cleanup = finishNexusSkillsModulesBattle(revealed, { stop: 'cleanup' });
  moneyAtCleanup(fixture, revealed, cleanup);
  const defense = fixture.planActions[0].action.defense!;
  const disposal: Action = { type: 'decision', discard: [defense] };
  reject(cleanup, fixture.opponent, disposal);
  const disposed = applyAction(cleanup, fixture.owner, disposal);
  assert.equal(player(disposed, fixture.owner).hand.some(card => card.id === defense), false);
  assert.equal(disposed.discard.filter(card => card.id === defense).length, 1);
  const retention = finishNexusSkillsModulesBattle(disposed, { stop: 'retention' });
  assert.ok(retention.decision?.kind === 'moritaniRetention' && retention.decision.source === 'nexus');
  assert.deepEqual(retention.techTokens, revealed.techTokens);
  const keep: Action = { type: 'decision', event: retention.decision.event, keep: fixture.planActions[1].action.defense! };
  reject(retention, fixture.owner, keep);
  reject(retention, fixture.opponent, { ...keep, event: `${retention.decision.event}-old` });
  const retained = applyAction(retention, fixture.opponent, keep);
  assert.equal(player(retained, fixture.opponent).hand.some(card => card.id === keep.keep), true);
  assert.equal(retained.nexusCards!.cards!.discard.filter(card => card === 'moritani').length, 1);
  for (const token of original) {
    const choice = finishNexusSkillsModulesBattle(retained, { stop: 'tech' });
    assert.ok(choice.decision?.kind === 'techToken');
    assert.deepEqual(choice.decision.choices, original);
    reject(choice, fixture.opponent, { type: 'decision', token });
    reject(choice, fixture.owner, { type: 'decision', decline: true });
    const selected = applyAction(choice, fixture.owner, { type: 'decision', token });
    assert.equal(selected.techTokens![token].owner, fixture.owner);
    assert.equal(selected.techTokens![original.find(id => id !== token)!].owner, fixture.opponent);
    const inspection = finishNexusSkillsModulesBattle(selected, { stop: 'inspection' });
    assert.ok(inspection.decision?.kind === 'nexusChoamInspection');
    assert.equal(viewGame(inspection, fixture.owner).nexusChoamInspection!.canInspect, false,
      'Spent Emperor Cunning is not a held CHOAM card and cannot inspect a fresh card');
    const decline: Action = { type: 'decision', event: inspection.decision.event, inspect: false };
    reject(inspection, fixture.opponent, decline);
    reject(inspection, fixture.owner, { ...decline, event: `${inspection.decision.event}-old` });
    const declined = applyAction(inspection, fixture.owner, decline);
    reject(declined, fixture.owner, decline);
    custody(finishNexusSkillsModulesBattle(declined));
  }
});

void test('physical Karama cancellation leaves held Arrakeen support legal and does not fabricate temporary roles or spend Tech', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, counter: true, ownerDial: 4, support: 4 });
  let game = beginNexusSkillsModulesCunning(fixture);
  assert.equal(game.response?.kind, 'nexusSardaukar');
  reject(game, fixture.owner, { type: 'card', card: fixture.counter!, mode: 'cancel' });
  game = applyAction(game, fixture.opponent, { type: 'card', card: fixture.counter!, mode: 'cancel' });
  game = advanceNexusSkillsModulesBattle(game, state => !state.response && !state.phaseOpening && !state.decision);
  assert.equal(game.nexusSardaukarLast!.stage, 'canceled');
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.temporaryElite ?? 0, 0);
  assert.equal(game.discard.filter(card => card.id === fixture.counter).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  const revealed = revealNexusSkillsModulesBattle(fixture, { state: game });
  const payment = quoteNexusSkillsModulesBattle(revealed).payments.find(payment => payment.player === fixture.owner)!;
  assert.equal(payment.bankSupport, 2); assert.equal(payment.ownPayment, 2);
  moneyAtCleanup(fixture, revealed, finishNexusSkillsModulesBattle(revealed, { stop: 'cleanup' }));
});

void test('Basic Tech keeps the original blocked Cunning offer, no Advanced support fee, and mandatory physical winner reward', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ advanced: false, tech: true });
  const prepared = prepareNexusSkillsModulesBattle(fixture);
  const offer = viewGame(prepared, fixture.owner).nexusSardaukar!.offer!;
  reject(prepared, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
  assert.equal(maxCombatDial(viewGame(prepared, fixture.owner).battle!.ownForces!), 7);
  const revealed = revealNexusSkillsModulesBattle(fixture);
  const quote = quoteNexusSkillsModulesBattle(revealed);
  assert.deepEqual(quote.payments, []); assert.equal(quote.casualties, null); assert.equal(quote.basicWinnerLosses, 6);
  const cleanup = finishNexusSkillsModulesBattle(revealed, { stop: 'cleanup' });
  assert.equal(player(cleanup, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 6);
  assert.equal(cleanup.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  moneyAtCleanup(fixture, revealed, cleanup);
  const token = ownedTech(revealed.techTokens, fixture.opponent); assert.equal(token.length, 1);
  const done = finishNexusSkillsModulesBattle(cleanup);
  assert.equal(done.techTokens![token[0]].owner, fixture.owner);
  custody(done);
});

void test('a sealed plan and later battle reject stale Cunning; the physical spent group expires through actual END Mentat and next Storm', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, secondBattle: true, ownerDial: 6, support: 3 });
  let sealed = prepareNexusSkillsModulesBattle(fixture);
  const event = viewGame(sealed, fixture.owner).nexusSardaukar!.offer!.event;
  sealed = applyAction(sealed, fixture.owner, { ...fixture.planActions[0].action, dial: 4, support: 4 });
  reject(sealed, fixture.owner, { type: 'nexusSardaukar', event });
  assert.equal(sealed.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
  const oldEvent = revealed.nexusSardaukarLast!.event;
  let game = finishNexusSkillsModulesBattle(revealed);
  const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'carthag', target: actor === fixture.owner ? fixture.opponent : fixture.owner });
  game = prepareNexusSkillsModulesBattle(fixture, game);
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.normal, 1);
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.temporaryElite ?? 0, 0);
  reject(game, fixture.owner, { type: 'nexusSardaukar', event: oldEvent });
  const candidates = (id: string) => player(game, id).leaders.filter(disc => !disc.dead && !disc.usedAt &&
    !game.leaderSkills!.assignments.some(assignment => assignment.leader === disc.id));
  for (const id of [fixture.owner, fixture.opponent]) {
    game = applyAction(game, id, { type: 'battlePlan', leader: candidates(id)[0].id, dial: 0, support: 0, weapon: null, defense: null });
    while (game.phaseOpening || game.response || game.decision?.kind === 'fullPlanOffer') game = stepNexusSkillsModulesBattle(game);
  }
  game = finishNexusSkillsModulesBattle(game);
  game = advanceNexusSkillsModulesBattle(game, state => state.turn === 3 && state.phase === 1 && !state.response && !state.phaseOpening && !state.decision);
  assert.equal(viewGame(game, fixture.owner).nexusSardaukar!.active, false);
  assert.equal(game.nexusSardaukarHistory![0].receipt.turn, 2);
  assert.equal(game.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
  reject(game, fixture.owner, { type: 'nexusSardaukar', event: oldEvent });
  custody(game);
});

void test('four original legal policies rescue three physical ordinary counters and retain their native support budget before cleanup and Tech transfer', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: true, strongholds: true, skill: 'suk-graduate', support: 6,
    ownerDial: 10, ownerDefense: 'shield' });
  const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
  const rescue = finishNexusSkillsModulesBattle(revealed, { stop: 'rescue' });
  assert.ok(rescue.decision?.kind === 'sukRescue');
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(rescue, fixture.owner);
    view.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'decision');
    assert.ok(action && typeof action.choice === 'number');
    const option: (typeof rescue.decision.options)[number] = rescue.decision.options[action.choice];
    assert.equal(option.normal, 3); assert.equal(option.elite, 0); assert.equal(option.kept?.key, fixture.key);
    const cleanup = applyAction(rescue, fixture.owner, action);
    assert.equal(player(cleanup, fixture.owner).forces[fixture.key], 2);
    assert.equal(player(cleanup, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 3);
    assert.equal(player(cleanup, fixture.owner).spice, player(revealed, fixture.owner).spice - 4);
    moneyAtCleanup(fixture, revealed, cleanup);
    custody(finishNexusSkillsModulesBattle(cleanup));
    let prepared = prepareNexusSkillsModulesBattle(fixture);
    const openingView = viewGame(prepared, fixture.owner);
    openingView.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const cunning = botActions(openingView).find(action => action.type === 'nexusSardaukar'); assert.ok(cunning);
    prepared = applyAction(prepared, fixture.owner, cunning);
    prepared = advanceNexusSkillsModulesBattle(prepared, state => !state.response && !state.phaseOpening && !state.decision);
    const planView = viewGame(prepared, fixture.owner);
    planView.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const plan = botActions(planView).find(action => action.type === 'battlePlan'); assert.ok(plan);
    assert.equal(typeof plan.support, 'number');
    assert.ok(Number(plan.support) <= player(prepared, fixture.owner).spice + 2);
    const committed = applyAction(prepared, fixture.owner, plan);
    assert.ok(committed.battle!.plans[fixture.owner]);
    assert.equal(player(committed, fixture.owner).spice, player(prepared, fixture.owner).spice,
      'The legal bot seals its budget; no debit is taken before actual battle resolution');
  }
});

void test('Advanced Strongholds without Tech retain the same original Skills/Nexus Arrakeen rescue and physical inventory', () => {
  const fixture = createNexusSkillsModulesBattleFixture({ tech: false, strongholds: true, skill: 'suk-graduate',
    support: 6, ownerDial: 10, ownerDefense: 'shield' });
  const revealed = revealNexusSkillsModulesBattle(fixture, { cunning: true });
  const quote = quoteNexusSkillsModulesBattle(revealed);
  assert.equal(quote.payments.find(payment => payment.player === fixture.owner)!.ownPayment, 4);
  const cleanup = finishNexusSkillsModulesBattle(revealed, { stop: 'cleanup' });
  assert.equal(player(cleanup, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 3);
  assert.equal(cleanup.pendingTech ?? null, null);
  moneyAtCleanup(fixture, revealed, cleanup);
  custody(finishNexusSkillsModulesBattle(cleanup));
});
