import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { maxCombatDial } from '../game/combat';
import { nexusInventory } from './fixture-nexus-cards';
import {
  advanceClassicNexusSkillsBattle, beginClassicNexusSkillsCunning,
  classicNexusSkillsBattlePlayer as player, createClassicNexusSkillsBattleFixture,
  finishClassicNexusSkillsBattle, prepareClassicNexusSkillsBattle,
  quoteClassicNexusSkillsBattle, revealClassicNexusSkillsBattle, stepClassicNexusSkillsBattle,
  type ClassicNexusSkillsBattleFixture,
} from './fixture-classic-nexus-skills-battles';

function custody(game: Game): void {
  nexusInventory(game);
  const skills = game.leaderSkills!;
  assert.deepEqual([...skills.deck, ...skills.assignments.map(assignment => assignment.skill),
    ...Object.values(skills.offers).flatMap(offer => offer.cards)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  for (const seat of game.players) if (seat.elites) {
    assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, count) => sum + count, 0),
      seat.faction === 'fremen' ? 3 : 5);
    for (const [key, count] of Object.entries(seat.elites.forces)) assert.ok(count <= (seat.forces[key] ?? 0));
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function moneyAtCleanup(revealed: Game, cleanup: Game): void {
  const quote = quoteClassicNexusSkillsBattle(revealed);
  assert.equal(cleanup.decision?.kind, 'battleCards');
  assert.equal(cleanup.lastBattleContext!.winner, quote.winner);
  for (const seat of revealed.players) {
    const payment = quote.payments.filter(payment => payment.player === seat.id).reduce((sum, payment) => sum + payment.ownPayment, 0);
    const bounty = quote.bounty?.player === seat.id ? quote.bounty.amount : 0;
    assert.equal(player(cleanup, seat.id).spice, seat.spice - payment + bounty,
      'Original battle payment and printed-disc bounty settle once before Collection');
  }
  assert.deepEqual(quote.strongholdIncome, []);
  custody(cleanup);
}
function lossWindow(fixture: ClassicNexusSkillsBattleFixture): { revealed: Game; game: Game } {
  const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
  const game = finishClassicNexusSkillsBattle(revealed, { stop: 'losses' });
  assert.equal(game.decision?.kind, 'battleLosses');
  return { revealed, game };
}

for (const advanced of [false, true]) for (const count of [3, 4, 5, 6]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${count}-seat original setup, Mentat, reciprocal alliance and closing draw preserve physical sources and actor IDs`, () => {
    const fixture = createClassicNexusSkillsBattleFixture({ advanced,
      seatIds: Array.from({ length: count }, (_, index) => `original-${advanced}-${count}-${index}`) });
    for (const game of [fixture.initial, fixture.afterSetup, fixture.afterFirstMentat, fixture.beforeDraw, fixture.afterDraw, fixture.beforeBattle]) custody(game);
    const mentat = stepClassicNexusSkillsBattle(fixture.beforeFirstMentat, fixture.firstMentatStep);
    assert.equal(mentat.turn, 2);
    assert.deepEqual(mentat, fixture.afterFirstMentat);
    let alliance = fixture.beforeAlliance;
    for (const action of fixture.allianceActions) alliance = stepClassicNexusSkillsBattle(alliance, action);
    assert.equal(player(alliance, fixture.observer).ally, fixture.partner);
    assert.equal(player(alliance, fixture.partner).ally, fixture.observer);
    assert.equal(player(fixture.beforeDraw, fixture.owner).ally, null);
    assert.ok(fixture.beforeDraw.nexusCards!.phase!.eligible.includes(fixture.owner));
    assert.equal(fixture.beforeDraw.nexusCards!.cards!.hands[fixture.owner], null);
    const drawn = stepClassicNexusSkillsBattle(fixture.beforeDraw, fixture.drawAction);
    assert.deepEqual(drawn, fixture.afterDraw);
    assert.equal(drawn.nexusCards!.cards!.hands[fixture.owner], 'emperor');
    assert.equal(drawn.nexusCards!.cards!.deck.includes('emperor'), false);
    assert.deepEqual(fixture.beforeBattle.players.map(seat => seat.id), fixture.initial.players.map(seat => seat.id));
    assert.deepEqual([...fixture.afterSetup.spiceDeck, ...fixture.afterSetup.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort(),
      [...fixture.beforeBattle.spiceDeck, ...fixture.beforeBattle.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort());
    assert.deepEqual([...fixture.afterSetup.traitorReserve!, ...fixture.afterSetup.players.flatMap(seat => seat.traitors)].sort(),
      [...fixture.beforeBattle.traitorReserve!, ...fixture.beforeBattle.players.flatMap(seat => seat.traitors)].sort());
  });
}

void test('original undealt authenticated CLI setup is consumed without replacing saved offers or actor identities', () => {
  const original = createClassicNexusSkillsBattleFixture({ seatIds: ['human-emperor', 'human-guild', 'human-atreides', 'human-fremen'] }).initial;
  const before = structuredClone(original);
  const fixture = createClassicNexusSkillsBattleFixture({ initial: original, skill: 'warmaster', ownerDial: 4, support: 4 });
  assert.deepEqual(original, before);
  assert.deepEqual(fixture.initial, original);
  assert.equal(fixture.owner, 'human-emperor'); assert.equal(fixture.opponent, 'human-guild');
  const revealed = revealClassicNexusSkillsBattle(fixture);
  const quote = quoteClassicNexusSkillsBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(revealed.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  moneyAtCleanup(revealed, finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' }));
});

for (const band of ['normal', 'skilled'] as const) {
  void test(`native Advanced Cunning plus ${band} Warmaster counts five ordinary counters temporarily, never creates elite Tanks or discounted support`, () => {
    const fixture = createClassicNexusSkillsBattleFixture({ skill: 'warmaster', band, ownerWeapon: 'projectile', ownerDefense: 'worthless' });
    const original = structuredClone(player(fixture.game, fixture.owner));
    const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
    const quote = quoteClassicNexusSkillsBattle(revealed);
    const ownForces = viewGame(revealed, fixture.owner).battle!.ownForces!;
    assert.equal(ownForces.normal, 7); assert.equal(ownForces.elite, 0); assert.equal(ownForces.temporaryElite, 5);
    assert.equal(maxCombatDial(ownForces), 12);
    assert.equal(quote.winner, fixture.owner);
    const bonus = revealed.battle!.attacker === fixture.owner ? quote.leaderSkillBonuses.attacker : quote.leaderSkillBonuses.defender;
    assert.deepEqual(bonus, { bonus: band === 'skilled' ? 3 : 1,
      applied: [{ skill: 'warmaster', amount: band === 'skilled' ? 3 : 1, mode: band }] });
    const ownScore = revealed.battle!.attacker === fixture.owner ? quote.scores!.attacker : quote.scores!.defender;
    const disc = player(revealed, fixture.owner).leaders.find(leader => leader.id === revealed.battle!.plans[fixture.owner].leader)!;
    assert.equal(ownScore, 6 + disc.strength + bonus.bonus);
    const opposingDisc = player(revealed, fixture.opponent).leaders.find(leader => leader.id === revealed.battle!.plans[fixture.opponent].leader)!;
    assert.equal(quote.bounty!.amount, opposingDisc.strength, 'Leader Skill strength is not part of printed-disc bounty');
    assert.equal(quote.bounty!.player, fixture.owner);
    const payment = quote.payments.find(payment => payment.player === fixture.owner)!;
    assert.equal(payment.ownPayment, 3); assert.equal(payment.bankSupport, 0); assert.equal(payment.allyPayment, 0);
    assert.deepEqual(quote.casualties!.options.map(loss => [loss.normal, loss.elite, loss.paidNormal, loss.paidElite]),
      [[3, 0, 3, 0], [4, 0, 3, 0], [5, 0, 3, 0]]);
    let game = finishClassicNexusSkillsBattle(revealed, { stop: 'losses' });
    game = applyAction(game, fixture.owner, { type: 'decision', choice: 2 });
    assert.equal(player(game, fixture.owner).forces[fixture.key], 2);
    assert.equal(player(game, fixture.owner).tanks, original.tanks + 5);
    assert.deepEqual(player(game, fixture.owner).elites, original.elites);
    assert.equal(game.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    moneyAtCleanup(revealed, game);
    const finished = finishClassicNexusSkillsBattle(game);
    assert.deepEqual(player(finished, fixture.owner).elites, original.elites);
    assert.equal(viewGame(finished, fixture.owner).nexusSardaukar!.active, false);
    custody(finished);
  });
}

for (const band of ['normal', 'skilled'] as const) {
  void test(`the original ${band} Warmaster modifier decides a native Cunning battle rather than merely decorating a larger dial`, () => {
    const fixture = createClassicNexusSkillsBattleFixture({ skill: 'warmaster', band, ownerDial: 0, support: 0,
      opponentDial: band === 'normal' ? 0.5 : 5, opponentSupport: band === 'normal' ? 0 : 5 });
    const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
    const quote = quoteClassicNexusSkillsBattle(revealed);
    const ownScore = revealed.battle!.attacker === fixture.owner ? quote.scores!.attacker : quote.scores!.defender;
    const opposingScore = revealed.battle!.attacker === fixture.owner ? quote.scores!.defender : quote.scores!.attacker;
    const disc = player(revealed, fixture.owner).leaders.find(leader => leader.id === revealed.battle!.plans[fixture.owner].leader)!;
    assert.ok(disc.strength < opposingScore);
    assert.ok(ownScore > opposingScore);
    assert.equal(quote.winner, fixture.owner);
    assert.equal(quote.payments.find(payment => payment.player === fixture.owner)!.ownPayment, 0);
    assert.equal(quote.casualties!.forces.temporaryElite, 5);
    assert.equal(quote.casualties!.options[0].normal, 0);
    moneyAtCleanup(revealed, finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' }));
  });
}

void test('a killed skilled Warmaster loses the actual physical skill and pays only printed-disc bounty', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ skill: 'warmaster', opponentWeapon: 'projectile' });
  const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
  const quote = quoteClassicNexusSkillsBattle(revealed);
  assert.equal(quote.winner, fixture.owner, 'Actual dial six exceeds the opposing surviving printed disc even when the skilled leader dies');
  const bonus = revealed.battle!.attacker === fixture.owner ? quote.leaderSkillBonuses.attacker : quote.leaderSkillBonuses.defender;
  assert.equal(bonus.bonus, 0);
  const disc = player(revealed, fixture.owner).leaders.find(leader => leader.id === fixture.trainer)!;
  assert.equal(quote.bounty!.amount, disc.strength);
  assert.equal(quote.bounty!.player, fixture.owner);
  const cleanup = finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' });
  assert.equal(player(cleanup, fixture.owner).leaders.find(leader => leader.id === fixture.trainer)!.dead, true);
  assert.equal(cleanup.leaderSkills!.assignments.some(assignment => assignment.leader === fixture.trainer), false);
  assert.equal(cleanup.leaderSkills!.deck.filter(skill => skill === 'warmaster').length, 1);
  moneyAtCleanup(revealed, cleanup);
});

for (const band of ['normal', 'skilled'] as const) {
  void test(`actual ${band} native Emperor Suk rescues Cunning ordinary casualties before winner cleanup, paying original support once`, () => {
    const fixture = createClassicNexusSkillsBattleFixture({ skill: 'suk-graduate', band, ownerDefense: 'shield' });
    const original = structuredClone(player(fixture.game, fixture.owner));
    const { revealed, game: losses } = lossWindow(fixture);
    const choice = band === 'normal' ? 1 : 2;
    const physicalLoss = band === 'normal' ? 4 : 5;
    const saved = band === 'normal' ? 1 : 3;
    assert.ok(losses.decision?.kind === 'battleLosses');
    assert.equal(losses.decision.options[choice].normal, physicalLoss);
    assert.equal(losses.decision.options[choice].elite, 0);
    reject(losses, fixture.opponent, { type: 'decision', choice });
    let game = applyAction(losses, fixture.owner, { type: 'decision', choice });
    if (band === 'skilled') {
      const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
      assert.equal(game.pendingSukRescue!.commitment.forces.temporaryElite, 5);
      assert.deepEqual(game.pendingSukRescue!.pool, [{ key: fixture.key, normal: 7, elite: 0 }]);
      assert.deepEqual(game.pendingSukRescue!.losses, losses.decision.options[choice]);
      assert.equal(game.nexusSardaukarHistory![0].casualties!.outcome, 'pending');
      assert.equal(player(game, fixture.owner).tanks, original.tanks);
      const rescue = decision.options.findIndex(option => option.normal === 3 && option.elite === 0 && option.kept?.key === fixture.key && option.kept.kind === 'normal');
      assert.ok(rescue >= 0);
      const action: Action = { type: 'decision', event: decision.event, choice: rescue };
      reject(game, fixture.opponent, action);
      reject(game, fixture.owner, { ...action, event: `${decision.event}-stale` });
      game = applyAction(game, fixture.owner, action);
      reject(game, fixture.owner, action);
    }
    assert.equal(player(game, fixture.owner).forces[fixture.key], 7 - physicalLoss + (band === 'skilled' ? 1 : 0));
    assert.equal(player(game, fixture.owner).reserves, original.reserves + saved - (band === 'skilled' ? 1 : 0));
    assert.equal(player(game, fixture.owner).tanks, original.tanks + physicalLoss - saved);
    assert.equal(player(game, fixture.owner).battleLosses, original.battleLosses + physicalLoss - saved);
    assert.deepEqual(player(game, fixture.owner).elites, original.elites);
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
    assert.equal(player(game, fixture.owner).spice, player(revealed, fixture.owner).spice - 3);
    moneyAtCleanup(revealed, game);
    custody(finishClassicNexusSkillsBattle(game));
  });
}

void test('a killed skilled native Suk disc creates no rescue entitlement and returns its singleton skill to the original deck', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ skill: 'suk-graduate', opponentWeapon: 'projectile', ownerWeapon: 'worthless' });
  const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
  assert.equal(quoteClassicNexusSkillsBattle(revealed).sukGraduate, undefined);
  const cleanup = finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' });
  assert.equal(cleanup.pendingSukRescue ?? null, null);
  assert.equal(player(cleanup, fixture.owner).leaders.find(leader => leader.id === fixture.trainer)!.dead, true);
  assert.equal(cleanup.leaderSkills!.deck.filter(skill => skill === 'suk-graduate').length, 1);
  assert.equal(player(cleanup, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 3);
  moneyAtCleanup(revealed, cleanup);
});

void test('original physical Karama cancels Cunning, spends each singleton once, and leaves a legal ordinary Warmaster plan', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ counter: true, ownerDial: 4, support: 4 });
  const prepared = prepareClassicNexusSkillsBattle(fixture);
  const elites = structuredClone(player(prepared, fixture.owner).elites);
  let game = beginClassicNexusSkillsCunning(fixture, prepared);
  assert.equal(game.response?.kind, 'nexusSardaukar');
  game = applyAction(game, fixture.opponent, { type: 'card', card: fixture.counter!, mode: 'cancel' });
  game = advanceClassicNexusSkillsBattle(game, state => !state.response && !state.decision && !state.phaseOpening);
  assert.equal(game.nexusSardaukarLast!.stage, 'canceled');
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.temporaryElite ?? 0, 0);
  assert.deepEqual(player(game, fixture.owner).elites, elites);
  assert.equal(game.discard.filter(card => card.id === fixture.counter).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  const revealed = revealClassicNexusSkillsBattle(fixture, { state: game });
  assert.equal(quoteClassicNexusSkillsBattle(revealed).payments.find(payment => payment.player === fixture.owner)!.ownPayment, 4);
  moneyAtCleanup(revealed, finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' }));
});

void test('sealing the original Advanced plan blocks late Cunning without spending its held Emperor card', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ ownerDial: 4, support: 4 });
  let game = prepareClassicNexusSkillsBattle(fixture);
  const event = viewGame(game, fixture.owner).nexusSardaukar!.offer!.event;
  game = applyAction(game, fixture.owner, fixture.planActions[0].action);
  assert.match(viewGame(game, fixture.owner).nexusSardaukar!.offer!.blocked!, /committed/);
  reject(game, fixture.owner, { type: 'nexusSardaukar', event });
  assert.equal(game.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  game = applyAction(game, fixture.opponent, fixture.planActions[1].action);
  moneyAtCleanup(game, finishClassicNexusSkillsBattle(game, { stop: 'cleanup' }));
});

void test('Basic retains the explicit blocked Sardaukar offer while the original skilled Warmaster plan legally wins without doubled forces or spice support', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ advanced: false });
  const prepared = prepareClassicNexusSkillsBattle(fixture);
  const offer = viewGame(prepared, fixture.owner).nexusSardaukar!.offer!;
  assert.match(offer.blocked!, /Advanced advantage/);
  reject(prepared, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
  assert.equal(maxCombatDial(viewGame(prepared, fixture.owner).battle!.ownForces!), 7);
  const revealed = revealClassicNexusSkillsBattle(fixture);
  const quote = quoteClassicNexusSkillsBattle(revealed);
  assert.deepEqual(quote.payments, []);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(viewGame(revealed, fixture.owner).battle!.ownForces!.temporaryElite ?? 0, 0);
  assert.equal(quote.casualties, null);
  assert.equal(quote.basicWinnerLosses, 6);
  const cleanup = finishClassicNexusSkillsBattle(revealed, { stop: 'cleanup' });
  assert.equal(player(cleanup, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 6);
  assert.equal(cleanup.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  moneyAtCleanup(revealed, cleanup);
});

void test('completed Cunning expires for the actual second battle in the same turn and cannot reuse its spent source', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ secondBattle: true });
  const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
  const oldEvent = revealed.nexusSardaukarLast!.event;
  let game = finishClassicNexusSkillsBattle(revealed);
  assert.equal(game.turn, 2); assert.equal(game.phase, 6);
  const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'carthag', target: actor === fixture.owner ? fixture.opponent : fixture.owner });
  game = prepareClassicNexusSkillsBattle(fixture, game);
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.normal, 1);
  assert.equal(viewGame(game, fixture.owner).battle!.ownForces!.temporaryElite ?? 0, 0);
  assert.equal(maxCombatDial(viewGame(game, fixture.owner).battle!.ownForces!), 1);
  assert.equal(viewGame(game, fixture.owner).nexusSardaukar!.active, false);
  reject(game, fixture.owner, { type: 'nexusSardaukar', event: oldEvent });
  custody(game);
});

void test('real END Mentat and next Storm do not reactivate historical temporary roles', () => {
  const fixture = createClassicNexusSkillsBattleFixture();
  const revealed = revealClassicNexusSkillsBattle(fixture, { cunning: true });
  const oldEvent = revealed.nexusSardaukarLast!.event;
  let game = finishClassicNexusSkillsBattle(revealed);
  game = advanceClassicNexusSkillsBattle(game, state => state.turn === 3 && state.phase === 1 && !state.phaseOpening && !state.response && !state.decision);
  assert.equal(viewGame(game, fixture.owner).nexusSardaukar!.active, false);
  assert.equal(game.nexusSardaukarHistory![0].receipt.turn, 2);
  assert.equal(game.nexusSardaukarHistory![0].casualties!.outcome, 'complete');
  reject(game, fixture.owner, { type: 'nexusSardaukar', event: oldEvent });
  custody(game);
});

void test('minimal legal Easy bot path resolves the real typed Suk rescue before human winner-card cleanup', () => {
  const fixture = createClassicNexusSkillsBattleFixture({ skill: 'suk-graduate', ownerDefense: 'shield' });
  const { revealed, game: losses } = lossWindow(fixture);
  let game = applyAction(losses, fixture.owner, { type: 'decision', choice: 2 });
  assert.equal(game.decision?.kind, 'sukRescue');
  const view = viewGame(game, fixture.owner);
  view.players.find(seat => seat.id === fixture.owner)!.bot = 'Easy';
  const action = botActions(view).find(action => action.type === 'decision');
  assert.ok(action && typeof action.choice === 'number');
  assert.ok(game.decision?.kind === 'sukRescue');
  assert.equal(game.decision.options[action.choice].normal, 3);
  assert.equal(game.decision.options[action.choice].elite, 0);
  game = applyAction(game, fixture.owner, action);
  assert.equal(player(game, fixture.owner).forces[fixture.key], 3);
  assert.equal(player(game, fixture.owner).tanks, player(revealed, fixture.owner).tanks + 2);
  assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
  moneyAtCleanup(revealed, game);
  custody(finishClassicNexusSkillsBattle(game));
});
