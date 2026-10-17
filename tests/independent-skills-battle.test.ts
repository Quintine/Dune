import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import {
  assertIndependentSkillsBattleCustody, createIndependentSkillsBattleFixture,
  createIndependentSkillsBattleSetup, advanceIndependentSkillsBattle, independentSkillsBattleClean,
  finishIndependentSkillsBattle, independentSkillsBattlePlayer,
  quoteIndependentSkillsBattle, type IndependentSkillsBattleFixture,
} from './fixture-independent-skills-battle';

const owner = (fixture: IndependentSkillsBattleFixture, game: Game) =>
  independentSkillsBattlePlayer(game, fixture.owner);
const opponent = (fixture: IndependentSkillsBattleFixture, game: Game) =>
  independentSkillsBattlePlayer(game, fixture.opponent);
const held = (game: Game, id: string) => [...game.deck, ...game.discard, ...game.players.flatMap((p) => p.hand)]
  .filter((card) => card.id === id);

void test('the same-plan programme pays the three-counter fee, returns the undialed complement and scores the real Warmaster bonus', () => {
  for (const advanced of [false, true]) {
    const fixture = createIndependentSkillsBattleFixture({ case: 'same-plan', advanced });
    assert.equal(fixture.location, 'pasty_mesa');
    assert.equal(owner(fixture, fixture.beforeShipment).reserves, 20);
    assert.equal(owner(fixture, fixture.beforeShipment).spice, 10);
    assert.equal(owner(fixture, fixture.afterShipment).reserves, 16);
    assert.equal(owner(fixture, fixture.afterShipment).spice, 2);
    assert.equal(owner(fixture, fixture.afterShipment).forces[fixture.first], 4);
    assert.equal(opponent(fixture, fixture.afterShipment).spice, 13, 'the paid eight-spice shipment reached the Guild');
    assert.deepEqual(owner(fixture, fixture.beforeBattle).forces,
      { [fixture.first]: 2, [fixture.second]: 2 });
    assert.deepEqual(opponent(fixture, fixture.beforeBattle).forces, { [fixture.second]: 5 });
    const worthless = fixture.plans[1].action.weapon;
    const quote = quoteIndependentSkillsBattle(fixture.game, { returns: fixture.returns });
    assert.deepEqual(quote.reinforcements,
      [{ player: fixture.owner, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.leaderSkillBonuses.defender,
      { bonus: 3, applied: [{ skill: 'warmaster', amount: 3, mode: 'skilled' }] });
    assert.deepEqual(quote.leaderSkillBonuses.attacker, { bonus: 0, applied: [] });
    // Dial 2 + Reinforcements 2 + Captain Aramsham 5 beats Staban Tuek 5 + Warmaster 3.
    assert.deepEqual(quote.scores, { attacker: 9, defender: 8 });
    assert.deepEqual(quote.harassWithdraw?.map((entry) => ({
      player: entry.player, returned: entry.returned,
      remaining: { normal: entry.remaining.normal, elite: entry.remaining.elite }, locations: entry.locations })),
      [{ player: fixture.owner, returned: { normal: 2, elite: 0 }, remaining: { normal: 2, elite: 0 },
        locations: { [fixture.first]: { normal: 1, elite: 0 }, [fixture.second]: { normal: 1, elite: 0 } } }]);
    assert.equal(fixture.game.decision?.kind, 'harassWithdraw');
    assert.throws(() => quoteIndependentSkillsBattle(fixture.game,
      { returns: { [fixture.first]: { normal: 1, elite: 0 } } }),
      /exact undialed complement of a legal physical commitment/);
    const done = finishIndependentSkillsBattle(fixture.game, { return: fixture.returns });
    assert.equal(done.phase, 7);
    assert.equal(done.lastBattleContext?.winner, fixture.owner);
    assert.equal(done.lastBattleContext?.result, 'normal');
    assert.equal(owner(fixture, done).reserves, 15, 'twenty reserves, minus four shipped, minus the fee, plus two returned');
    assert.equal(owner(fixture, done).tanks, 5, 'the three fee counters plus the two dialed casualties');
    assert.deepEqual(owner(fixture, done).forces, {});
    assert.equal(owner(fixture, done).spice, advanced ? 0 : 2);
    assert.equal(opponent(fixture, done).tanks, 5, 'the defeated Guild army reached the Tanks');
    assert.deepEqual(opponent(fixture, done).forces, {});
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD, worthless as string]) {
      assert.equal(done.discard.filter((entry) => entry.id === card).length, 1, card);
      assert.ok(done.players.every((player) => !player.hand.some((held) => held.id === card)), card);
    }
    assert.deepEqual(done.lastBattleContext?.mandatoryDiscard?.entries,
      [{ card: worthless, owner: fixture.opponent }]);
    assertIndependentSkillsBattleCustody(done);
  }
});

void test('the trained Suk Graduate rescues both committed casualties without refunding the fee or leaving phantom forces', () => {
  for (const advanced of [false, true]) {
    const fixture = createIndependentSkillsBattleFixture({ case: 'suk', advanced });
    const quote = quoteIndependentSkillsBattle(fixture.game, { returns: fixture.returns });
    // Dial 2 + Reinforcements 2 + Hasimir Fenring 6 against Guild Representative 1 + 2.
    assert.deepEqual(quote.scores, { attacker: 10, defender: 3 });
    assert.equal(quote.leaderSkillBonuses.attacker.bonus, 0);
    const fee = finishIndependentSkillsBattle(fixture.game,
      { return: fixture.returns, until: (state) => state.decision?.kind === 'sukRescue' });
    const rescue = fee.decision;
    assert.equal(rescue?.kind, 'sukRescue');
    assert.equal(rescue?.mode, 'skilled');
    assert.deepEqual(owner(fixture, fee).forces,
      { [fixture.first]: 1, [fixture.second]: 1 }, 'the Harass return left exactly the committed two');
    assert.equal(owner(fixture, fee).reserves, 15, 'the fee preceded the two returned counters');
    assert.equal(owner(fixture, fee).tanks, 3, 'only the Reinforcements fee reached the Tanks');
    assert.equal(owner(fixture, fee).spice, advanced ? 0 : 2);
    const options = rescue?.kind === 'sukRescue' ? rescue.options : [];
    const kept = options.find((option) => option.kept?.kind === 'normal' && option.normal + option.elite === 2);
    assert.ok(kept, 'saving both casualties leaves one counter in its original sector');
    assert.deepEqual(kept.kept, { key: fixture.first, kind: 'normal' });
    assert.deepEqual(options.find((option) => option.normal + option.elite === 0),
      { normal: 0, elite: 0, kept: null });
    const chosen = options.indexOf(kept);
    const done = finishIndependentSkillsBattle(fee,
      { return: fixture.returns, rescue: () => chosen });
    assert.equal(done.lastBattleContext?.sukRescue?.completed, true);
    assert.deepEqual(owner(fixture, done).forces, { [fixture.first]: 1 },
      'one rescued counter stayed in Pasty Mesa sector 5 and the rest returned to reserves');
    assert.equal(owner(fixture, done).reserves, 16, 'the fee was not refunded by the rescue');
    assert.equal(owner(fixture, done).tanks, 3);
    assert.equal(done.pendingSukRescue, null);
    assert.equal(opponent(fixture, done).tanks, 5);
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD]) {
      assert.equal(held(done, card).length, 1, card);
      assert.equal(done.discard.filter((entry) => entry.id === card).length, 1, card);
    }
    assert.equal(done.discard.some((entry) => entry.kind === 'worthless'), false);
    assertIndependentSkillsBattleCustody(done);
  }
});

void test('an opposing real Traitor cancels the Harass return while the fee still reaches the Tanks', () => {
  for (const advanced of [false, true]) {
    const fixture = createIndependentSkillsBattleFixture({ case: 'traitor-cancel', advanced });
    assert.equal(fixture.traitor, fixture.plans[0].action.leader);
    assert.ok(opponent(fixture, fixture.game).traitors.includes(fixture.traitor!));
    const canceled = quoteIndependentSkillsBattle(fixture.game,
      { callers: [fixture.opponent], returns: fixture.returns });
    assert.equal(canceled.result, 'traitor');
    assert.equal(canceled.winner, fixture.opponent);
    assert.equal(canceled.scores, null, 'a revealed Traitor carries no battle totals');
    assert.equal(canceled.harassWithdraw, undefined, 'an opposing successful traitor cancels the return');
    assert.deepEqual(canceled.reinforcements,
      [{ player: fixture.owner, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    const done = finishIndependentSkillsBattle(fixture.game,
      { callers: [fixture.opponent], return: fixture.returns });
    assert.equal(done.lastBattleContext?.result, 'traitor');
    assert.equal(done.lastBattleContext?.winner, fixture.opponent);
    assert.deepEqual(owner(fixture, done).forces, {}, 'the canceled return left no phantom counters');
    assert.equal(owner(fixture, done).reserves, 13, 'twenty reserves, minus four shipped and the fee; nothing returned');
    assert.equal(owner(fixture, done).tanks, 7, 'the fee plus the four counters left in Pasty Mesa');
    assert.deepEqual(opponent(fixture, done).forces, { [fixture.second]: 5 });
    assert.equal(opponent(fixture, done).tanks, 0);
    assert.equal(opponent(fixture, done).spice, 18, 'five spice, the eight-spice shipment and the five-strength bounty');
    assert.deepEqual(done.lastBattleContext?.mandatoryDiscard?.entries,
      [{ card: REINFORCEMENTS_CARD, owner: fixture.owner }, { card: HARASS_WITHDRAW_CARD, owner: fixture.owner }]);
    assertIndependentSkillsBattleCustody(done);
  }
});

void test('normal Bureaucrat remains available in independent all14 play and diverts a real bribe without advancing its escrow', () => {
  const f = createIndependentSkillsBattleSetup({
    skills: { owner: 'planetologist', opponent: 'warmaster', observer: 'bureaucrat' },
  });
  let game = advanceIndependentSkillsBattle(f.afterSetup,
    state => state.phase === 4 && independentSkillsBattleClean(state));
  const payer = independentSkillsBattlePlayer(game, f.owner).spice;
  const payee = independentSkillsBattlePlayer(game, f.opponent).spice;
  game = applyAction(game, f.owner, { type: 'bribe', target: f.opponent, amount: 5 });
  const offer = viewGame(game, f.observer).bureaucrat!.pending!;
  assert.ok(offer);
  game = applyAction(game, f.observer, { type: 'decision', event: offer.event, redirect: true });
  assert.equal(independentSkillsBattlePlayer(game, f.owner).spice, payer - 5);
  assert.equal(independentSkillsBattlePlayer(game, f.opponent).spice, payee);
  assert.equal(independentSkillsBattlePlayer(game, f.opponent).bribes, 3);
  assert.equal(viewGame(game, f.observer).bureaucrat!.usedThisPhase, true);
});
