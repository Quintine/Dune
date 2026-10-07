import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { strongholdControllers } from '../game/stronghold-cards';
import { ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import type { BattleResolutionQuote } from '../game/battle-resolution-quote';
import type { SukRescueOption } from '../game/suk-graduate';
import {
  classicSkillsStrongholdPlayer as player, createClassicSkillsStrongholdFixture,
  finishClassicSkillsStrongholdBattle, nextClassicSkillsStrongholdStep,
  prepareClassicSkillsStrongholdBattle, quoteClassicSkillsStrongholdBattle,
  revealClassicSkillsStrongholdBattle, type ClassicSkillsStrongholdFixture,
} from './fixture-classic-skills-stronghold';

function custody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(seat => seat.hand)];
  assert.deepEqual(cards.map(card => card.id).sort(), treacheryDeck([]).map(card => card.id).sort());
  const skills = game.leaderSkills!;
  assert.deepEqual([...skills.deck, ...skills.assignments.map(assignment => assignment.skill),
    ...Object.values(skills.offers).flatMap(offer => offer.cards)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  for (const seat of game.players) {
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, count) => sum + count, 0), 20);
    if (seat.elites) {
      const total = seat.faction === 'fremen' ? 3 : 5;
      assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, count) => sum + count, 0), total);
      for (const [key, count] of Object.entries(seat.elites.forces)) assert.ok(count <= (seat.forces[key] ?? 0));
    }
  }
}
function bonus(quote: BattleResolutionQuote, source: Game, actor: string) {
  return source.battle!.attacker === actor ? quote.leaderSkillBonuses.attacker : quote.leaderSkillBonuses.defender;
}
function moneyBeforeCleanup(fixture: ClassicSkillsStrongholdFixture, revealed: Game, cleanup: Game) {
  assert.equal(cleanup.decision?.kind, 'battleCards');
  const quote = quoteClassicSkillsStrongholdBattle(revealed);
  for (const seat of revealed.players) {
    const debit = quote.payments.filter(payment => payment.player === seat.id).reduce((sum, payment) => sum + payment.ownPayment, 0);
    const income = quote.strongholdIncome.filter(receipt => receipt.player === seat.id).reduce((sum, receipt) => sum + receipt.amount, 0);
    const bounty = quote.bounty?.player === seat.id ? quote.bounty.amount : 0;
    assert.equal(player(cleanup, seat.id).spice, seat.spice - debit + income + bounty,
      'Actual own debit, Stronghold bank income and original killed-leader bounty settle before Collection');
  }
  assert.equal(cleanup.lastBattleContext!.winner, quote.winner);
  assert.deepEqual(cleanup.strongholdCards, fixture.afterFirstMentat.strongholdCards,
    'Battle casualties do not steal retained cards before the next END Mentat');
  custody(cleanup);
  return quote;
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('original Advanced classic two-through-six-seat inventories survive real setup and first END Mentat custody without redeal', () => {
  for (let count = 2; count <= 6; count++) {
    const fixture = createClassicSkillsStrongholdFixture({ seatIds: Array.from({ length: count }, (_, index) => `classic-${count}-${index}`), optionalTech: count >= 3 });
    custody(fixture.initial); custody(fixture.afterSetup); custody(fixture.beforeBattle);
    const settled = applyAction(fixture.beforeFirstMentat, fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
    assert.equal(settled.turn, 2);
    assert.equal(settled.strongholdCards!.owners.arrakeen, fixture.owner);
    assert.deepEqual(settled.strongholdCards!.owners, strongholdControllers(fixture.beforeFirstMentat.players, false));
    assert.deepEqual(settled.strongholdCards, fixture.afterFirstMentat.strongholdCards);
    assert.deepEqual(fixture.beforeBattle.players.map(seat => seat.id), fixture.initial.players.map(seat => seat.id));
    if (count >= 3) {
      assert.deepEqual(TECH_TOKENS.map(token => fixture.beforeBattle.techTokens![token.id].owner),
        TECH_TOKENS.map(token => fixture.afterFirstMentat.techTokens![token.id].owner));
      assert.ok(TECH_TOKENS.every(token => fixture.beforeBattle.players.some(seat => seat.id === fixture.beforeBattle.techTokens![token.id].owner)));
    }
  }
});

void test('a fresh authenticated original lobby retains human IDs and input state while composing Strongholds, all fourteen Skills and optional Tech', () => {
  let lobby = createGame('AUTHCLASSIC', newPlayer('human-emperor', 'Emperor', 'emperor'), true);
  joinGame(lobby, newPlayer('human-guild', 'Guild', 'guild'));
  joinGame(lobby, newPlayer('human-atreides', 'Atreides', 'atreides'));
  lobby = applyAction(lobby, lobby.host, { type: 'strongholdCards', enabled: true });
  lobby = applyAction(lobby, lobby.host, { type: 'techTokens', enabled: true });
  const original = structuredClone(lobby);
  const fixture = createClassicSkillsStrongholdFixture({ initial: lobby, optionalTech: true, bankerIncome: true, ownerDial: 6, support: 6 });
  assert.deepEqual(lobby, original);
  assert.deepEqual(fixture.initial.players.map(seat => seat.id), original.players.map(seat => seat.id));
  assert.equal(fixture.owner, 'human-guild');
  assert.equal(fixture.banker, 'human-atreides');
  assert.equal(fixture.afterFirstMentat.strongholdCards!.owners.arrakeen, 'human-guild');
  const rescue = finishClassicSkillsStrongholdBattle(revealClassicSkillsStrongholdBattle(fixture), { stop: 'skill' });
  assert.equal(rescue.decision?.kind, 'sukRescue');
  assert.deepEqual(viewGame(rescue, 'human-atreides').spiceBankerIncome!.deferred, [{ owner: 'human-atreides', amount: 1 }]);
  custody(rescue);
});

for (const scenario of [
  { support: 0, dial: 4, own: 0, casualties: 8 },
  { support: 2, dial: 4, own: 0, casualties: 6 },
  { support: 5, dial: 6, own: 3, casualties: 7 },
  { support: 6, dial: 6, own: 4, casualties: 6 },
]) {
  void test(`Arrakeen original support ${scenario.support}: actual own ${scenario.own}, not bank-funded support, controls Banker while trained Suk rescues physical losses`, () => {
    const fixture = createClassicSkillsStrongholdFixture({ bankerIncome: true, skill: 'suk-graduate', band: 'skilled',
      ownerDial: scenario.dial, support: scenario.support, ownerWeapon: 'projectile', ownerDefense: 'shield', opponentWeapon: 'projectile' });
    const revealed = revealClassicSkillsStrongholdBattle(fixture);
    const quote = quoteClassicSkillsStrongholdBattle(revealed);
    const payment = quote.payments.find(receipt => receipt.player === fixture.owner)!;
    assert.equal(payment.bankSupport, Math.min(2, scenario.support));
    assert.equal(payment.ownPayment, scenario.own);
    assert.equal(quote.casualties!.options[0].normal, scenario.casualties);
    assert.equal(quote.sukGraduate?.mode, 'skilled');
    const before = player(revealed, fixture.owner);
    const bankerBalance = player(revealed, fixture.banker!).spice;
    let game = finishClassicSkillsStrongholdBattle(revealed, { stop: 'skill' });
    const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
    assert.equal(player(game, fixture.owner).spice, before.spice - scenario.own + 3,
      'The bank share is not spendable currency and rescue does not refund originally committed support');
    assert.equal(player(game, fixture.banker!).spice, bankerBalance);
    assert.deepEqual(viewGame(game, fixture.banker!).spiceBankerIncome!.deferred,
      scenario.own === 4 ? [{ owner: fixture.banker!, amount: 1 }] : []);
    const source = game.spiceBankerIncome!.sources.find(receipt => receipt.source.kind === 'battle-support' && receipt.source.bankLegs.some(leg => leg.payer === fixture.owner));
    if (scenario.own) assert.deepEqual(source!.source.bankLegs, [{ payer: fixture.owner, amount: scenario.own }]);
    else assert.equal(source, undefined, 'Zero actual payer debit produces no qualifying bank source');
    const choice = decision.options.findIndex(option => option.normal === 3 && option.elite === 0 && option.kept?.key === fixture.key);
    assert.ok(choice >= 0);
    const action: Action = { type: 'decision', event: decision.event, choice };
    reject(game, fixture.opponent, action);
    reject(game, fixture.owner, { ...action, event: `${decision.event}-old` });
    game = applyAction(game, fixture.owner, action);
    assert.equal(player(game, fixture.owner).forces[fixture.key], 8 - scenario.casualties + 1);
    assert.equal(player(game, fixture.owner).reserves, before.reserves + 2);
    assert.equal(player(game, fixture.owner).tanks, before.tanks + scenario.casualties - 3);
    // User ruling 7 October 2026: rescued counters still count toward the
    // seven Kwisatz Haderach losses, so the counter gains every dialed casualty.
    assert.equal(player(game, fixture.owner).battleLosses, before.battleLosses + scenario.casualties);
    moneyBeforeCleanup(fixture, revealed, game);
    reject(game, fixture.owner, action);
  });
}

void test('four real policies physically choose original Suk rescue before winner-card cleanup and the actual losing-owner Tech reward', () => {
  const fixture = createClassicSkillsStrongholdFixture({ optionalTech: true, bankerIncome: true, skill: 'suk-graduate', band: 'skilled',
    ownerDial: 6, support: 6, ownerWeapon: 'projectile', ownerDefense: 'shield', opponentWeapon: 'projectile' });
  const revealed = revealClassicSkillsStrongholdBattle(fixture);
  const originalTokens = ownedTech(revealed.techTokens, fixture.opponent);
  assert.equal(originalTokens.length, 1, 'Original three-seat assignment supplies a real losing-owner token');
  const originalOwner = player(revealed, fixture.owner);
  const originalEnemy = player(revealed, fixture.opponent);
  const window = finishClassicSkillsStrongholdBattle(revealed, { stop: 'skill' });
  assert.deepEqual(window.techTokens, revealed.techTokens);
  assert.equal(player(window, fixture.opponent).tanks, originalEnemy.tanks + 8);
  assert.equal(player(window, fixture.opponent).leaders.find(leader => leader.id === fixture.planActions[1].action.leader)!.dead, true);
  assert.ok(window.discard.some(card => card.id === fixture.planActions[1].action.weapon), 'Loser played-card cleanup precedes winner rescue');
  assert.ok(window.decision?.kind === 'sukRescue');
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(window, fixture.owner);
    view.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'decision');
    assert.ok(action && typeof action.choice === 'number');
    const rescue: SukRescueOption = window.decision.options[action.choice];
    assert.equal(rescue.normal, 3); assert.equal(rescue.elite, 0); assert.equal(rescue.kept?.key, fixture.key);
    const cleanup = applyAction(window, fixture.owner, action);
    assert.equal(player(cleanup, fixture.owner).forces[fixture.key], 3);
    assert.equal(player(cleanup, fixture.owner).reserves, originalOwner.reserves + 2);
    assert.equal(player(cleanup, fixture.owner).tanks, originalOwner.tanks + 3);
    assert.equal(player(cleanup, fixture.owner).spice, originalOwner.spice - 4 + 3);
    assert.equal(cleanup.decision?.kind, 'battleCards');
    assert.deepEqual(cleanup.techTokens, revealed.techTokens, 'The original reward waits for actual winner cleanup');
    const resolved = finishClassicSkillsStrongholdBattle(cleanup);
    assert.equal(resolved.techTokens![originalTokens[0]].owner, fixture.owner);
    assert.deepEqual(ownedTech(resolved.techTokens, fixture.opponent), []);
    assert.deepEqual(TECH_TOKENS.filter(token => resolved.techTokens![token.id].owner !== revealed.techTokens![token.id].owner).map(token => token.id), originalTokens);
    assert.equal(resolved.lastBattleContext!.winner, fixture.owner);
    assert.equal(resolved.lastBattleContext!.sukRescue!.completed, true);
    custody(resolved);
  }
});

void test('Carthag actual non-poison Shield saves the normal Prana Bindu-trained disc, whose matching physical defense bonus decides the win', () => {
  const fixture = createClassicSkillsStrongholdFixture({ kind: 'carthag', skill: 'prana-bindu-adept', band: 'normal',
    ownerDefense: 'shield', opponentWeapon: 'poison', ownerDial: 0.5, opponentDial: 1, opponentSupport: 1 });
  const revealed = revealClassicSkillsStrongholdBattle(fixture);
  const cleanup = finishClassicSkillsStrongholdBattle(revealed, { stop: 'cleanup' });
  const quote = moneyBeforeCleanup(fixture, revealed, cleanup);
  assert.deepEqual(bonus(quote, revealed, fixture.owner), { bonus: 1, applied: [{ skill: 'prana-bindu-adept', amount: 1, mode: 'normal' }] });
  assert.equal(quote.effects!.defenderDead, false);
  assert.equal(quote.leaderDeaths.defender, false);
  assert.equal(player(cleanup, fixture.owner).leaders.find(leader => leader.id === fixture.planActions[0].action.leader)!.dead, false);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(quote.scores!.defender, 4.5);
  assert.equal(quote.scores!.attacker, 4);
  const unclaimed = createClassicSkillsStrongholdFixture({ kind: 'carthag', cardHolder: 'unclaimed', skill: 'prana-bindu-adept', band: 'normal',
    ownerDefense: 'shield', opponentWeapon: 'poison', ownerDial: 0.5, opponentDial: 1, opponentSupport: 1 });
  const poisoned = finishClassicSkillsStrongholdBattle(revealClassicSkillsStrongholdBattle(unclaimed), { stop: 'cleanup' });
  assert.equal(player(poisoned, unclaimed.owner).leaders.find(leader => leader.id === unclaimed.planActions[0].action.leader)!.dead, true);
  assert.equal(poisoned.lastBattleContext!.winner, unclaimed.opponent);
});

void test('Habbanya holder-only priority resolves the tie created by the actual normal Warmaster Worthless modifier, never a lower score', () => {
  for (const holder of ['owner', 'unclaimed'] as const) {
    const fixture = createClassicSkillsStrongholdFixture({ kind: 'habbanya_ridge_sietch', cardHolder: holder,
      skill: 'warmaster', band: 'normal', ownerWeapon: 'worthless', ownerDefense: 'shield', opponentDefense: 'shield', opponentDial: 1 });
    const revealed = revealClassicSkillsStrongholdBattle(fixture);
    assert.equal(revealed.battle!.defender, fixture.owner);
    const cleanup = finishClassicSkillsStrongholdBattle(revealed, { stop: 'cleanup' });
    const quote = moneyBeforeCleanup(fixture, revealed, cleanup);
    assert.equal(bonus(quote, revealed, fixture.owner).bonus, 1);
    assert.deepEqual(quote.scores, { attacker: 4, defender: 4 });
    assert.equal(quote.winner, holder === 'owner' ? fixture.owner : fixture.opponent);
    if (holder === 'owner') {
      let lower = prepareClassicSkillsStrongholdBattle(fixture);
      lower = applyAction(lower, fixture.owner, { ...fixture.planActions[0].action, weapon: null });
      lower = applyAction(lower, fixture.opponent, fixture.planActions[1].action);
      const loser = finishClassicSkillsStrongholdBattle(lower, { stop: 'cleanup' });
      assert.equal(loser.lastBattleContext!.winner, fixture.opponent, 'Retained Habbanya custody does not turn a Warmaster-less lower total into a tie');
    }
  }
});

void test('Sietch Tabr pays the actual opposing declared dial only after the surviving skilled Mentat bonus makes its holder the winner', () => {
  const fixture = createClassicSkillsStrongholdFixture({ kind: 'sietch_tabr', skill: 'mentat', band: 'skilled',
    ownerDial: 0.5, opponentDial: 2, opponentSupport: 2, opponentLeaderStrength: 5, ownerDefense: 'shield', opponentDefense: 'shield' });
  const revealed = revealClassicSkillsStrongholdBattle(fixture);
  const cleanup = finishClassicSkillsStrongholdBattle(revealed, { stop: 'cleanup' });
  const quote = moneyBeforeCleanup(fixture, revealed, cleanup);
  assert.deepEqual(bonus(quote, revealed, fixture.owner), { bonus: 2, applied: [{ skill: 'mentat', amount: 2, mode: 'skilled' }] });
  assert.deepEqual(quote.scores, { attacker: 7, defender: 7.5 });
  assert.equal(quote.winner, fixture.owner);
  assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: 2 }]);
  let normal = prepareClassicSkillsStrongholdBattle(fixture);
  const otherDisc = player(normal, fixture.owner).leaders.find(leader => leader.strength === 3)!;
  normal = applyAction(normal, fixture.owner, { ...fixture.planActions[0].action, leader: otherDisc.id });
  normal = applyAction(normal, fixture.opponent, fixture.planActions[1].action);
  const lost = finishClassicSkillsStrongholdBattle(normal, { stop: 'cleanup' });
  assert.equal(lost.lastBattleContext!.winner, fixture.opponent);
  assert.equal(player(lost, fixture.owner).spice, player(normal, fixture.owner).spice,
    'The holder gets no Tabr income on the actual loss without its trained Mentat total');
});

void test('Tuek pays each actually played Worthless card on both Warmaster-modified wins and losses, but mutual traitors exclude income and comparison', () => {
  for (const losing of [false, true]) {
    const fixture = createClassicSkillsStrongholdFixture({ kind: 'tueks_sietch', skill: 'warmaster', band: 'normal',
      ownerWeapon: 'worthless', ownerDefense: losing ? 'worthless' : 'shield', opponentDefense: 'shield',
      opponentDial: losing ? 2 : 0, opponentSupport: losing ? 2 : 0 });
    const revealed = revealClassicSkillsStrongholdBattle(fixture);
    const cleanup = finishClassicSkillsStrongholdBattle(revealed, { stop: 'cleanup' });
    const quote = moneyBeforeCleanup(fixture, revealed, cleanup);
    assert.deepEqual(bonus(quote, revealed, fixture.owner), { bonus: 1, applied: [{ skill: 'warmaster', amount: 1, mode: 'normal' }] });
    assert.equal(quote.winner, losing ? fixture.opponent : fixture.owner);
    assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: losing ? 4 : 2 }]);
    if (losing) for (const slot of ['weapon', 'defense'] as const)
      assert.ok(cleanup.discard.some(card => card.id === fixture.planActions[0].action[slot]), 'Loss physically discards each paid Worthless card');
  }
  const mutual = createClassicSkillsStrongholdFixture({ kind: 'tueks_sietch', skill: 'warmaster', band: 'normal',
    ownerWeapon: 'worthless', ownerDefense: 'worthless', traitors: 'both', ownerDial: 1, support: 1 });
  const revealed = revealClassicSkillsStrongholdBattle(mutual);
  const ended = finishClassicSkillsStrongholdBattle(revealed, { callers: [mutual.owner, mutual.opponent] });
  assert.equal(ended.lastBattleContext!.winner, null);
  assert.equal(player(ended, mutual.owner).spice, player(revealed, mutual.owner).spice - Number(mutual.planActions[0].action.support),
    'Mutual traitors retain the original support debit and earn neither played-Worthless income nor killed-leader bounty');
  assert.equal(player(ended, mutual.owner).forces[mutual.key] ?? 0, 0);
  assert.equal(player(ended, mutual.opponent).forces[mutual.key] ?? 0, 0);
  for (const slot of ['weapon', 'defense'] as const)
    assert.ok(ended.discard.some(card => card.id === mutual.planActions[0].action[slot]));
  custody(ended);
});

void test('four legal own-seat policies seal an affordable original Arrakeen plan without spending the bank contribution or a future Suk/Tech reward', () => {
  const fixture = createClassicSkillsStrongholdFixture({ kind: 'arrakeen', skill: 'suk-graduate', band: 'skilled', optionalTech: true });
  let game = prepareClassicSkillsStrongholdBattle(fixture);
  const gift = Math.max(1, player(game, fixture.owner).spice - 5);
  game = applyAction(game, fixture.owner, { type: 'bribe', target: fixture.opponent, amount: gift });
  const balance = player(game, fixture.owner).spice;
  reject(game, fixture.owner, { ...fixture.planActions[0].action, dial: 8, support: 8 });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, fixture.owner);
    view.players.find(seat => seat.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'battlePlan');
    assert.ok(action);
    const sealed = applyAction(game, fixture.owner, action);
    assert.equal(player(sealed, fixture.owner).spice, balance, 'Native plans commit support but debit only on resolution');
    assert.deepEqual(sealed.techTokens, game.techTokens);
    let revealed = sealed;
    while (revealed.response || revealed.phaseOpening || revealed.decision?.kind === 'fullPlanOffer') {
      const next = nextClassicSkillsStrongholdStep(revealed); assert.ok(next);
      revealed = applyAction(revealed, next.actor, next.action);
    }
    revealed = applyAction(revealed, fixture.opponent, fixture.planActions[1].action);
    const quote = quoteClassicSkillsStrongholdBattle(revealed);
    const payment = quote.payments.find(receipt => receipt.player === fixture.owner)!;
    assert.equal(payment.bankSupport, Math.min(2, Number(action.support ?? 0)));
    assert.equal(payment.ownPayment, Math.max(0, Number(action.support ?? 0) - 2));
    assert.ok(payment.ownPayment <= balance);
    const ended = finishClassicSkillsStrongholdBattle(revealed);
    assert.equal(ended.lastBattleContext!.winner, quote.winner);
    custody(ended);
  }
});
