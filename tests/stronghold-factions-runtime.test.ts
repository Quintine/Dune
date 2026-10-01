import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, mobileRoutes, splitLocation, territory } from '../game/board';
import { isAuditorLeader, treacheryDeck } from '../game/cards';
import { STRONGHOLD_CARDS, strongholdControllers } from '../game/stronghold-cards';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { createStrongholdFactionsFixture, nextStrongholdFactionsNativeStep, quoteStrongholdFactionsBattle, type StrongholdFactionsFixture, type StrongholdFactionsFixtureOptions } from './fixture-stronghold-factions';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;
function inventory(game: Game) {
  return [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
}
function custody(game: Game) {
  assert.deepEqual(inventory(game), treacheryDeck(['ix', 'choam']).map(c => c.id).sort());
  for (const seat of game.players) {
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, n) => sum + n, 0), 20, seat.faction);
    if (seat.elites) assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, n) => sum + n, 0), seat.faction === 'ixians' ? 7 : seat.faction === 'emperor' ? 5 : 3, seat.faction);
    for (const [key, count] of Object.entries(seat.elites?.forces ?? {})) assert.ok(count <= seat.forces[key]);
  }
}
function prepared(fixture: StrongholdFactionsFixture): Game {
  let game = reload(fixture.game);
  if (fixture.copyAction) game = applyAction(game, fixture.owner, fixture.copyAction);
  for (let count = 0; count < 120; count++) {
    const next = nextStrongholdFactionsNativeStep(game);
    if (!next) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (game.decision?.kind === 'choamBattleFunding' && fixture.fundingAction) game = applyAction(game, fixture.fundingAction.actor, fixture.fundingAction.action);
    else game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native plan boundary did not open');
}
function reveal(fixture: StrongholdFactionsFixture): Game {
  let game = prepared(fixture);
  for (const plan of fixture.planActions) {
    game = applyAction(game, plan.actor, plan.action);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
  }
  assert.ok(game.battle?.revealed);
  return game;
}
function finish(fixture: StrongholdFactionsFixture, state = reveal(fixture), callers: string[] = []) {
  let game = state;
  for (let count = 0; count < 160; count++) {
    if (!game.battle && !game.decision && !game.response && !game.pendingTreacheryDiscard) return game;
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = callers.includes(next.actor);
    game = applyAction(reload(game), next.actor, next.action);
    custody(game);
  }
  throw Error('Actual native battle suffix did not finish');
}
/** Verify source money independently. Ix opening must close before native
 * Collection pays bank stronghold income or removes any board deposits. */
function money(fixture: StrongholdFactionsFixture, revealed: Game, resolved: Game) {
  assert.deepEqual(resolved.strongholdCards, fixture.beforeBattle.strongholdCards, 'battle loss does not transfer retained card custody before final Mentat');
  const quote = quoteStrongholdFactionsBattle(revealed);
  const collection = resolved.phase === 7 && !resolved.phaseOpening ? quoteSpiceCollection({ ...resolved, players: resolved.players.map(p => ({ ...p, spice: 0 })) }).receipts : [];
  for (const seat of revealed.players) {
    const ownPayment = quote.payments.filter(p => p.player === seat.id).reduce((sum, p) => sum + p.ownPayment, 0);
    const stronghold = quote.strongholdIncome.filter(p => p.player === seat.id).reduce((sum, p) => sum + p.amount, 0);
    const bounty = quote.bounty?.player === seat.id ? quote.bounty.amount : 0;
    const choam = quote.choamIncome?.owner === seat.id ? quote.choamIncome.amount : 0;
    const collected = collection.filter(p => p.player === seat.id).reduce((sum, p) => sum + p.strongholds + p.collected, 0);
    assert.equal(player(resolved, seat.id).spice, seat.spice - ownPayment + stronghold + bounty + choam + collected, `${seat.faction}: own debit, module income, native bounty, CHOAM and Collection remain separate`);
  }
  assert.equal(resolved.lastBattleContext?.winner, quote.winner);
  assert.deepEqual(normalizeAutomaticGame(reload(resolved)), resolved, 'JSON normalization cannot repay a resolved native source');
  return quote;
}
function effect(options: StrongholdFactionsFixtureOptions) {
  const fixture = createStrongholdFactionsFixture(options);
  const revealed = reveal(fixture);
  const resolved = finish(fixture, revealed);
  const quote = money(fixture, revealed, resolved);
  return { fixture, revealed, resolved, quote };
}

void test('fresh native 2–6 seats conserve canonical 47 cards, twenty counters, native stars, Auditor and six initially unowned Stronghold Cards', () => {
  for (let count = 2; count <= 6; count++) {
    const fixture = createStrongholdFactionsFixture({ seatIds: Array.from({ length: count }, (_, index) => `seat-${count}-${index}`) });
    custody(fixture.initial); custody(fixture.afterSetup); custody(fixture.beforeBattle);
    assert.equal(fixture.afterSetup.players.find(p => p.faction === 'ixians')!.elites!.reserves, 4);
    assert.equal(fixture.afterSetup.players.find(p => p.faction === 'ixians')!.elites!.forces[MOBILE_LOCATION], 3);
    const choam = fixture.afterSetup.players.find(p => p.faction === 'choam')!;
    assert.equal(choam.leaders.filter(isAuditorLeader).length, 1);
    assert.equal(choam.leaders.filter(l => !isAuditorLeader(l)).length, 5);
    assert.equal(Object.keys(fixture.initial.strongholdCards!.owners).length, 6);
    assert.ok(Object.values(fixture.initial.strongholdCards!.owners).every(owner => owner === null));
    assert.equal(fixture.initial.strongholdCards!.claimedTurn, 0);
    assert.equal(fixture.afterFirstMentat.status, 'playing', 'first custody must not prematurely end a three-hold fixture');
    assert.equal(fixture.afterFirstMentat.turn, 2);
  }
});

void test('original CLI setup remains immutable and first custody is produced by the actual final Mentat action, not a redeal or assigned owner', () => {
  const original = createStrongholdFactionsFixture().initial;
  const before = reload(original);
  const fixture = createStrongholdFactionsFixture({ initial: original });
  assert.deepEqual(original, before);
  assert.deepEqual(fixture.initial, before);
  assert.equal(fixture.beforeFirstMentat.phase, 8);
  assert.equal(fixture.beforeFirstMentat.strongholdCards!.claimedTurn, 0);
  const settled = applyAction(reload(fixture.beforeFirstMentat), fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
  assert.equal(settled.turn, 2);
  assert.deepEqual(settled.strongholdCards, fixture.afterFirstMentat.strongholdCards);
  assert.deepEqual(settled.strongholdCards!.owners, strongholdControllers(fixture.beforeFirstMentat.players, true));
  for (const card of STRONGHOLD_CARDS) assert.equal(fixture.beforeBattle.strongholdCards!.owners[card.id], settled.strongholdCards!.owners[card.id]);
  const absent = createStrongholdFactionsFixture({ initial: original, copyChoices: 0 });
  assert.equal(absent.beforeBattle.strongholdCards!.owners.arrakeen, absent.owner);
  assert.equal(strongholdControllers(absent.beforeBattle.players, true).arrakeen, null);
  assert.equal(absent.game.battle!.strongholdCopy, undefined, 'departed card custody alone supplies no mobile copy');
});

void test('Arrakeen subsidy is capped by actual native Cyborg support, never becomes cash, and CHOAM receives the bank-funded share', () => {
  for (const support of [0, 1, 2, 3]) {
    const { fixture, revealed, quote } = effect({ kind: 'arrakeen', ownerDial: support * 2, support, ownerSpice: Math.max(0, support - 2) });
    const payment = quote.payments.find(p => p.player === fixture.owner)!;
    assert.equal(payment.bankSupport, Math.min(2, support));
    assert.equal(payment.ownPayment, Math.max(0, support - 2));
    assert.equal(quote.choamIncome?.amount ?? 0, Math.floor(support / 2));
    assert.equal(player(revealed, fixture.owner).spice, Math.max(0, support - 2), 'the plan seals without crediting two spendable spice');
    assert.equal(viewGame(revealed, fixture.owner).battle!.ownForces!.normalFixedHalf, true);
  }
  const fixture = createStrongholdFactionsFixture({ kind: 'arrakeen', ownerDial: 6, support: 3, ownerSpice: 0 });
  const ready = prepared(fixture), before = reload(ready);
  assert.throws(() => applyAction(ready, fixture.owner, fixture.planActions[0].action));
  assert.deepEqual(ready, before);
});

void test('native CHOAM donor escrow excludes its own donation from income but includes Arrakeen bank support, with no wallet subsidy', () => {
  const fixture = createStrongholdFactionsFixture({ kind: 'arrakeen', ownerFaction: 'guild', ownerDial: 4, support: 4, allyPayment: 2, choamFunding: 2, ownerSpice: 0 });
  const ready = prepared(fixture);
  assert.equal(player(ready, fixture.owner).ally, fixture.choam);
  assert.equal(player(ready, fixture.choam).ally, fixture.owner);
  assert.equal(player(ready, fixture.choam).spice, 18, 'original native funding action actually paid escrow');
  assert.equal(ready.aid[fixture.choam].amount, 2);
  const revealed = reveal(fixture), resolved = finish(fixture, revealed), quote = money(fixture, revealed, resolved);
  assert.deepEqual(quote.payments.find(p => p.player === fixture.owner), { player: fixture.owner, cost: 2, ownPayment: 0, allyPayment: 2, donor: fixture.choam, bankSupport: 2, freeByTraitor: false });
  assert.equal(quote.choamIncome!.amount, 1, 'bank two earns one; native own-donor two earns nothing');
  assert.equal(resolved.aid[fixture.choam]?.amount ?? 0, 0);
});

void test('Carthag native physical defense gains poison coverage only without a poison-role weapon; Shield still explodes and Tooth still kills', () => {
  for (const scenario of [
    { defense: 'shield', own: undefined, enemy: 'poison', dead: false, explosion: false },
    { defense: 'weirdingWay', own: 'projectile', enemy: 'poison', dead: false, explosion: false },
    { defense: 'shield', own: 'poison', enemy: 'poison', dead: true, explosion: false },
    { defense: 'shield', own: 'chemistry', enemy: 'poison', dead: true, explosion: false },
    { defense: 'worthless', own: undefined, enemy: 'poison', dead: true, explosion: false },
    { defense: 'shield', own: undefined, enemy: 'poisonTooth', dead: true, explosion: false },
    { defense: 'shield', own: undefined, enemy: 'lasgun', dead: true, explosion: true },
  ] as const) {
    const fixture = createStrongholdFactionsFixture({ kind: 'carthag', ownerDefense: scenario.defense, ownerWeapon: scenario.own, opponentWeapon: scenario.enemy });
    let revealed = reveal(fixture);
    while (revealed.decision || revealed.response) {
      const next = nextStrongholdFactionsNativeStep(revealed); assert.ok(next);
      revealed = applyAction(revealed, next.actor, next.action);
    }
    const resolved = finish(fixture, revealed), quote = money(fixture, revealed, resolved);
    const leader = String(fixture.planActions[0].action.leader);
    assert.equal(player(resolved, fixture.owner).leaders.find(l => l.id === leader)!.dead, scenario.dead, JSON.stringify(scenario));
    assert.equal(quote.explosion, scenario.explosion);
  }
});

void test('Habbanya native holder wins a printed-supported tie as defender, but ties do not override mutual traitors', () => {
  const { fixture, revealed, resolved, quote } = effect({ kind: 'habbanya_ridge_sietch', ownerFaction: 'guild' });
  assert.equal(revealed.battle!.defender, fixture.owner);
  assert.equal(quote.scores!.attacker, quote.scores!.defender);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(player(resolved, fixture.opponent).forces[`habbanya_ridge_sietch:${territory('habbanya_ridge_sietch').sectors[0]}`], undefined);
  const mutual = createStrongholdFactionsFixture({ kind: 'habbanya_ridge_sietch', ownerFaction: 'guild', traitors: 'both' });
  const ended = finish(mutual, reveal(mutual), [mutual.owner, mutual.opponent]);
  assert.equal(ended.lastBattleContext!.winner, null);
  custody(ended);
});

void test('Tabr pays floor of opposing declared fractional dial once; native traitor bounty is separate and explosions pay no winner', () => {
  const ordinary = effect({ kind: 'sietch_tabr', ownerDial: 6, support: 3, opponentDial: 1.5 });
  assert.deepEqual(ordinary.quote.strongholdIncome, [{ player: ordinary.fixture.owner, amount: 1 }]);
  const traitor = createStrongholdFactionsFixture({ kind: 'sietch_tabr', ownerDial: 6, support: 3, opponentDial: 1.5, traitors: 'owner' });
  const ended = finish(traitor, reveal(traitor), [traitor.owner]);
  assert.equal(ended.lastBattleContext!.winner, traitor.owner);
  const explosion = effect({ kind: 'sietch_tabr', opponentDial: 1.5, ownerDefense: 'shield', opponentWeapon: 'lasgun' });
  assert.equal(explosion.quote.winner, null);
  assert.deepEqual(explosion.quote.strongholdIncome, []);
});

void test('Tuek pays each actually played Worthless card on defeat and explosion, but pays neither side for mutual traitors', () => {
  const loser = effect({ kind: 'tueks_sietch', ownerWeapon: 'worthless', ownerDefense: 'worthless', opponentDial: 2, opponentSupport: 2 });
  assert.equal(loser.quote.winner, loser.fixture.opponent);
  assert.deepEqual(loser.quote.strongholdIncome, [{ player: loser.fixture.owner, amount: 4 }]);
  for (const field of ['weapon', 'defense'] as const) assert.ok(loser.resolved.discard.some(card => card.id === loser.fixture.planActions[0].action[field]));
  const exploded = effect({ kind: 'tueks_sietch', ownerWeapon: 'worthless', ownerDefense: 'shield', opponentWeapon: 'lasgun' });
  assert.equal(exploded.quote.explosion, true);
  assert.deepEqual(exploded.quote.strongholdIncome, [{ player: exploded.fixture.owner, amount: 2 }]);
  const mutual = createStrongholdFactionsFixture({ kind: 'tueks_sietch', ownerWeapon: 'worthless', ownerDefense: 'worthless', traitors: 'both' });
  const ended = finish(mutual, reveal(mutual), [mutual.owner, mutual.opponent]);
  assert.equal(ended.lastBattleContext!.winner, null);
  assert.equal(ended.log.filter(entry => entry.automatic?.name === 'Stronghold income').length, 0);
  const single = createStrongholdFactionsFixture({ kind: 'tueks_sietch', ownerWeapon: 'worthless', ownerDefense: 'worthless', traitors: 'owner', ownerDial: 6, support: 3 });
  const won = finish(single, reveal(single), [single.owner]);
  assert.equal(won.lastBattleContext!.winner, single.owner);
  const nativeCollection = won.phase === 7 ? quoteSpiceCollection(won).receipts.find(receipt => receipt.player === single.owner)!.collected : 0;
  assert.equal(player(won, single.owner).spice, 20 + 4 + 5 + nativeCollection, 'four Worthless income plus native five-strength traitor bounty; waived support and separate ordinary Collection');
});

void test('native HMS declaration uses current physical control, not donor card custody; rejected event/actor/choice and early plans leave source unchanged', () => {
  const fixture = createStrongholdFactionsFixture();
  const game = fixture.game, before = reload(game), decision = game.decision;
  assert.equal(decision?.kind, 'strongholdCopy');
  if (decision?.kind !== 'strongholdCopy') throw Error('Missing actual native copy decision');
  assert.deepEqual(decision.choices, ['arrakeen', 'sietch_tabr']);
  assert.notEqual(game.strongholdCards!.owners.sietch_tabr, fixture.owner);
  for (const [actor, action] of [
    [fixture.opponent, fixture.copyAction!],
    [fixture.owner, { ...fixture.copyAction!, event: 'foreign-event' }],
    [fixture.owner, { ...fixture.copyAction!, stronghold: 'carthag' }],
    [fixture.opponent, fixture.planActions[1].action],
  ] as const) {
    assert.throws(() => applyAction(game, actor, action));
    assert.deepEqual(game, before);
  }
  const accepted = applyAction(game, fixture.owner, fixture.copyAction!);
  assert.equal(accepted.battle!.strongholdCopy, 'arrakeen');
  assert.throws(() => applyAction(accepted, fixture.owner, fixture.copyAction!));
  const retained = reload(accepted);
  // Move the copy-control marker back to reserves after declaration: the
  // accepted event remains fixed and does not silently ask again.
  const owner = player(retained, fixture.owner);
  owner.reserves += owner.forces['arrakeen:10']; delete owner.forces['arrakeen:10'];
  const normalized = normalizeAutomaticGame(retained);
  assert.equal(normalized.battle!.strongholdCopy, 'arrakeen');
  for (const seat of normalized.players) assert.equal(viewGame(normalized, seat.id).battle!.strongholdEffects[fixture.owner], 'arrakeen');
  const sole = createStrongholdFactionsFixture({ copyChoices: 1 });
  assert.equal(sole.game.battle!.strongholdCopy, 'arrakeen');
  assert.notEqual(sole.game.decision?.kind, 'strongholdCopy');
  custody(normalized);
});

void test('native HMS copies each existing advantage on its interior without relocating the printed battle site', () => {
  for (const copy of ['arrakeen', 'carthag', 'habbanya_ridge_sietch', 'sietch_tabr', 'tueks_sietch'] as const) {
    const options: StrongholdFactionsFixtureOptions = { copy, copyChoices: 1 };
    if (copy === 'arrakeen') { options.ownerDial = 6; options.support = 3; }
    if (copy === 'carthag') { options.ownerDefense = 'shield'; options.opponentWeapon = 'poison'; }
    if (copy === 'sietch_tabr') { options.ownerDial = 6; options.support = 3; options.opponentDial = 1.5; }
    if (copy === 'tueks_sietch') { options.ownerWeapon = 'worthless'; options.opponentDial = 2; options.opponentSupport = 2; }
    const { fixture, revealed, quote } = effect(options);
    assert.equal(revealed.battle!.territory, MOBILE_STRONGHOLD);
    assert.equal(revealed.battle!.strongholdCopy, copy);
    assert.equal(viewGame(revealed, fixture.owner).battle!.strongholdEffects[fixture.owner], copy);
    assert.equal(revealed.mobileStronghold!.location, 'polar_sink:0');
    assert.equal(player(revealed, fixture.owner).forces['polar_sink:0'], undefined, 'interior army does not leak into the pointing territory');
    if (copy === 'arrakeen') assert.equal(quote.payments.find(p => p.player === fixture.owner)!.bankSupport, 2);
    if (copy === 'carthag') assert.equal(revealed.battle!.attacker === fixture.owner ? quote.leaderDeaths.attacker : quote.leaderDeaths.defender, false);
    if (copy === 'habbanya_ridge_sietch') assert.equal(quote.winner, fixture.owner);
    if (copy === 'sietch_tabr') assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: 1 }]);
    if (copy === 'tueks_sietch') assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: 2 }]);
  }
});

void test('real HMS relocation, native cyborg casualty/substitution decisions and sealed plans survive JSON without revealing foreign private plans', () => {
  const original = createStrongholdFactionsFixture();
  const route = mobileRoutes(original.afterFirstMentat, 3).find(route => {
    const target = splitLocation(route.at(-1)!);
    return route.length > 1 && target.sector >= 8 && territory(target.territory).type !== 'stronghold';
  });
  assert.ok(route, 'An actual connected native mobile route is available outside this next Storm band');
  const fixture = createStrongholdFactionsFixture({ initial: original.initial, mobileRoute: route, ownerDial: 6, support: 3, opponentDial: 1.5 });
  assert.equal(fixture.game.mobileStronghold!.location, route.at(-1));
  let game = prepared(fixture);
  const first = fixture.planActions[0]; game = applyAction(game, first.actor, first.action);
  const ownView = viewGame(reload(game), fixture.owner), otherView = viewGame(reload(game), fixture.opponent);
  assert.equal(ownView.battle!.plans[fixture.owner].dial, 6);
  assert.deepEqual(otherView.battle!.plans, {});
  assert.equal(otherView.battle!.revealed, false);
  const second = fixture.planActions[1]; game = applyAction(reload(game), second.actor, second.action);
  const quote = quoteStrongholdFactionsBattle(game);
  assert.equal(quote.casualties!.forces.normalFixedHalf, true);
  assert.ok(quote.casualties!.options.every(loss => loss.elite === 3 && loss.normal === 0));
  for (let count = 0; game.decision?.kind !== 'ixSubstitution' && count < 100; count++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    game = applyAction(reload(game), next.actor, next.action);
  }
  assert.equal(game.decision?.kind, 'ixSubstitution');
  assert.equal(player(game, fixture.owner).elites!.tanks, 3);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  const resolved = finish(fixture, game);
  custody(resolved);
});

void test('all four existing projected policies choose legal native current-control copies and affordable native plans without bank cash', () => {
  const fixture = createStrongholdFactionsFixture({ ownerSpice: 0, ownerDefense: 'shield' });
  for (const difficulty of DIFFICULTIES) {
    const copyView = viewGame(fixture.game, fixture.owner);
    copyView.players.find(p => p.id === fixture.owner)!.bot = difficulty;
    const copy = botActions(copyView)[0]; assert.ok(copy);
    let game = applyAction(reload(fixture.game), fixture.owner, copy);
    while (nextStrongholdFactionsNativeStep(game)) {
      const next = nextStrongholdFactionsNativeStep(game)!;
      game = applyAction(game, next.actor, next.action);
    }
    const view = viewGame(game, fixture.owner);
    view.players.find(p => p.id === fixture.owner)!.bot = difficulty;
    const plan = botActions(view).find(action => action.type === 'battlePlan'); assert.ok(plan);
    const accepted = applyAction(game, fixture.owner, plan);
    assert.equal(player(accepted, fixture.owner).spice, 0);
    assert.ok((accepted.battle!.plans[fixture.owner].support ?? 0) <= 2, 'free bank support is capped, not unlimited personal cash');
    custody(accepted);
  }
});

void test('free native Fremen support neither spends Arrakeen allowance nor mints CHOAM income', () => {
  const { fixture, quote } = effect({ kind: 'arrakeen', seatIds: ['i', 'c', 'g', 'e', 'f'], ownerFaction: 'fremen', ownerDial: 3, support: 0, ownerSpice: 0 });
  assert.deepEqual(quote.payments.find(payment => payment.player === fixture.owner), { player: fixture.owner, cost: 0, ownPayment: 0, allyPayment: 0, donor: null, bankSupport: 0, freeByTraitor: false });
  assert.equal(quote.choamIncome, null);
});

void test('native CHOAM aid opens a real Karama response only for an actual conserved eligible hand; cancellation cannot leave an affordable phantom ally payment', () => {
  const fixture = createStrongholdFactionsFixture({ ownerFaction: 'guild', copy: 'arrakeen', choamFunding: 2, allyPayment: 2, ownerDial: 4, support: 4, ownerSpice: 0, counter: true });
  let game = applyAction(reload(fixture.game), fixture.owner, fixture.copyAction!);
  assert.equal(game.decision?.kind, 'choamBattleFunding');
  game = applyAction(game, fixture.fundingAction!.actor, fixture.fundingAction!.action);
  assert.equal(game.response?.owner, fixture.choam);
  const counter = player(game, fixture.opponent).hand.find(card => card.effect === 'karama'); assert.ok(counter);
  const before = reload(game);
  const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
  assert.equal(next.actor, fixture.opponent);
  assert.equal(next.action.type, 'passResponse');
  game = applyAction(game, fixture.opponent, { type: 'card', card: counter.id, mode: 'cancel' });
  for (let count = 0; nextStrongholdFactionsNativeStep(game) && count < 120; count++) {
    const step = nextStrongholdFactionsNativeStep(game)!; game = applyAction(game, step.actor, step.action);
  }
  assert.ok(game.battle!.choamAidBlocked);
  assert.ok(game.discard.some(card => card.id === counter.id));
  assert.ok(before.players.find(p => p.id === fixture.opponent)!.hand.some(card => card.id === counter.id), 'original counter custody remains immutable');
  const preserved = reload(game);
  assert.throws(() => applyAction(game, fixture.owner, fixture.planActions[0].action));
  assert.deepEqual(game, preserved);
  const accepted = applyAction(game, fixture.owner, { ...fixture.planActions[0].action, dial: 2, support: 2, allyPayment: 0 });
  assert.equal(player(accepted, fixture.owner).spice, 0);
  custody(accepted);
});

void test('actual native battle, Collection and final Mentat settle current custody and terminal victory once, including retained departure custody until that checkpoint', () => {
  const fixture = createStrongholdFactionsFixture({ ownerDial: 6, support: 3, opponentDial: 1.5 });
  let game = finish(fixture);
  assert.deepEqual(game.strongholdCards, fixture.afterFirstMentat.strongholdCards);
  let finalSource: Game | undefined;
  for (let count = 0; game.status !== 'finished' && count < 300; count++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    const before = reload(game);
    game = applyAction(reload(game), next.actor, next.action);
    if (game.status === 'finished') finalSource = before;
    custody(game);
  }
  assert.equal(game.status, 'finished');
  assert.equal(finalSource!.phase, 8);
  assert.equal(finalSource!.strongholdCards!.claimedTurn, 1);
  assert.equal(game.strongholdCards!.claimedTurn, 2);
  assert.deepEqual(game.strongholdCards!.owners, strongholdControllers(finalSource!.players, true));
  assert.equal(game.lastBattleContext!.winner, fixture.owner);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  assert.equal(nextStrongholdFactionsNativeStep(game), null);
});
