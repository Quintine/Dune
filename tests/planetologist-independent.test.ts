import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import {
  createPlanetologistIndependentFixture, createPlanetologistEmptyReserveFixture, sealPlanetologistIndependent,
  finishPlanetologistIndependent,
} from './fixture-planetologist-independent';
import {
  assertIndependentSkillsBattleCustody, independentSkillsBattlePlayer,
  quoteIndependentSkillsBattle,
} from './fixture-independent-skills-battle';

void test('native Reinforcements and its Planetologist alternative keep the same score but only the native role spends three reserves', () => {
  for (const alternate of [false, true]) {
    const f = createPlanetologistIndependentFixture({ alternate });
    const before = independentSkillsBattlePlayer(f.game, f.owner);
    const sealed = sealPlanetologistIndependent(f);
    const quote = quoteIndependentSkillsBattle(sealed, { returns: f.returns });
    const trainer = before.leaders.find(leader => leader.id === f.trainer)!;
    assert.equal(quote.scores!.attacker, trainer.strength + 2 + 2);
    assert.equal(quote.leaderSkillBonuses!.attacker.bonus, alternate ? 2 : 0);
    assert.equal(quote.reinforcements?.[0]?.normal ?? 0, alternate ? 0 : 3);
    const done = finishPlanetologistIndependent(sealed, f);
    const own = independentSkillsBattlePlayer(done, f.owner);
    assert.equal(done.phase, 7);
    assert.equal(own.reserves, before.reserves - (alternate ? 0 : 3) + 2);
    assert.equal(own.tanks, before.tanks + (alternate ? 0 : 3) + 2);
    assert.deepEqual(own.forces, {});
    assert.equal(own.spice, before.spice - 2);
    for (const card of ['ecaz-reinforcements', 'ecaz-harass-withdraw'])
      assert.equal(done.discard.filter(entry => entry.id === card).length, 1);
    assertIndependentSkillsBattleCustody(done);
  }
});

void test('Harass as the Planetologist Special makes no return while the distinct defense-slot Reinforcements still pays its own fee', () => {
  const f = createPlanetologistIndependentFixture({ effect: 'harassWithdraw' });
  const before = independentSkillsBattlePlayer(f.game, f.owner);
  const sealed = sealPlanetologistIndependent(f);
  const quote = quoteIndependentSkillsBattle(sealed);
  assert.deepEqual(quote.harassWithdraw ?? [], []);
  assert.deepEqual(quote.reinforcements, [{ player: f.owner, card: 'ecaz-reinforcements', normal: 3, elite: 0 }]);
  assert.equal(quote.leaderSkillBonuses!.attacker.bonus, 2);
  const done = finishPlanetologistIndependent(sealed, f);
  const own = independentSkillsBattlePlayer(done, f.owner);
  assert.equal(own.reserves, before.reserves - 3);
  assert.equal(own.tanks, before.tanks + 3 + 2);
  assert.equal(Object.values(own.forces).reduce((sum, count) => sum + count, 0), 2);
  assertIndependentSkillsBattleCustody(done);
});

void test('Recruits can be spent as a green Planetologist Special without activating global Revival or spending an unused Reinforcements', () => {
  const f = createPlanetologistIndependentFixture({ effect: 'recruits' });
  const before = independentSkillsBattlePlayer(f.game, f.owner);
  const sealed = sealPlanetologistIndependent(f);
  const quote = quoteIndependentSkillsBattle(sealed, { returns: f.returns });
  assert.equal(quote.leaderSkillBonuses!.attacker.bonus, 2);
  assert.deepEqual(quote.reinforcements ?? [], []);
  const done = finishPlanetologistIndependent(sealed, f);
  const own = independentSkillsBattlePlayer(done, f.owner);
  assert.ok(!done.recruits);
  assert.equal(own.reserves, before.reserves + 2);
  assert.equal(own.tanks, before.tanks + 2);
  assert.equal(done.discard.filter(card => card.id === 'ecaz-recruits').length, 1);
  assert.ok(own.hand.some(card => card.id === 'ecaz-reinforcements'));
  assertIndependentSkillsBattleCustody(done);
});

void test('a poisoned Planetologist loses alternate strength without retroactively activating Reinforcements or suppressing normal Harass', () => {
  const f = createPlanetologistIndependentFixture({ poison: true });
  const before = independentSkillsBattlePlayer(f.game, f.owner);
  const sealed = sealPlanetologistIndependent(f);
  const quote = quoteIndependentSkillsBattle(sealed, { returns: f.returns });
  assert.equal(quote.leaderDeaths.attacker, true);
  assert.equal(quote.leaderSkillBonuses!.attacker.bonus, 0);
  assert.deepEqual(quote.reinforcements ?? [], []);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  const done = finishPlanetologistIndependent(sealed, f);
  const own = independentSkillsBattlePlayer(done, f.owner);
  assert.equal(own.leaders.find(leader => leader.id === f.trainer)!.dead, true);
  assert.equal(own.reserves, before.reserves + 2);
  assert.equal(own.tanks, before.tanks + 2);
  assert.ok(done.leaderSkills!.deck.includes('planetologist'));
  assertIndependentSkillsBattleCustody(done);
});

void test('the independent green alternate role also preserves Basic support and cannot be declared using another leader', () => {
  const f = createPlanetologistIndependentFixture({ advanced: false });
  const own = independentSkillsBattlePlayer(f.game, f.owner);
  const other = own.leaders.find(leader => !leader.dead && leader.id !== f.trainer)!;
  assert.throws(() => applyAction(f.game, f.owner, { ...f.plans[0].action, leader: other.id }));
  const done = finishPlanetologistIndependent(sealPlanetologistIndependent(f), f);
  assert.equal(done.phase, 7);
  assert.equal(independentSkillsBattlePlayer(done, f.owner).spice, own.spice);
  assert.equal(independentSkillsBattlePlayer(done, f.owner).tanks, own.tanks + 2);
  assertIndependentSkillsBattleCustody(done);
});

void test('zero reserves block native Reinforcements before a later Harass return but not its printed Planetologist substitution', () => {
  const f = createPlanetologistEmptyReserveFixture();
  const before = independentSkillsBattlePlayer(f.game, f.owner);
  assert.equal(before.reserves, 0);
  assert.throws(() => applyAction(f.game, f.owner, { ...f.plans[0].action, planetologistSpecial: false }));
  const sealed = sealPlanetologistIndependent(f);
  const quote = quoteIndependentSkillsBattle(sealed);
  assert.deepEqual(quote.reinforcements ?? [], []);
  assert.equal(quote.payments.find(payment => payment.player === f.owner)!.cost, 0);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 4, elite: 0 });
  const done = finishPlanetologistIndependent(sealed, f);
  const own = independentSkillsBattlePlayer(done, f.owner);
  assert.equal(done.phase, 7);
  assert.equal(own.reserves, 4);
  assert.equal(own.tanks, 1);
  assert.equal(Object.values(own.forces).reduce((sum, count) => sum + count, 0), 15);
  assertIndependentSkillsBattleCustody(done);
});

void test('a truthful named Reinforcements promise at zero reserves finds and executes the Planetologist alternative', () => {
  const f = createPlanetologistEmptyReserveFixture();
  let game = structuredClone(f.game);
  const index = game.deck.findIndex(card => card.effect === 'truthtrance');
  assert.ok(index >= 0);
  const truth = game.deck.splice(index, 1)[0];
  independentSkillsBattlePlayer(game, f.observer).hand.push(truth);
  game = applyAction(game, f.observer, { type: 'card', card: truth.id });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id))!;
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  game = applyAction(game, f.observer, { type: 'truthAsk', question: {
    kind: 'battlePlan', target: f.owner, claim: { kind: 'and', terms: [
      { kind: 'weapon', name: 'Reinforcements' },
      { kind: 'dial', compare: 'eq', value: 0.5 },
      { kind: 'support', compare: 'eq', value: 0 },
    ] },
  } });
  assert.ok(viewGame(game, f.owner).truthBattleAnswers!.includes('yes'));
  game = applyAction(game, f.owner, { type: 'truthAnswer', answer: 'yes' });
  const witness = viewGame(game, f.owner).battle!.compliantPlan;
  assert.ok(witness);
  game = applyAction(game, f.owner, { type: 'battlePlan', ...witness });
  game = applyAction(game, f.opponent, f.plans[1].action);
  const done = finishPlanetologistIndependent(game, f);
  const own = independentSkillsBattlePlayer(done, f.owner);
  assert.equal(done.phase, 7);
  assert.equal(own.reserves, 0);
  assert.equal(own.tanks, 1);
  assert.equal(Object.values(own.forces).reduce((sum, count) => sum + count, 0), 19);
  assert.ok(own.hand.some(card => card.id === 'ecaz-harass-withdraw'));
  assert.equal(done.discard.filter(card => card.id === 'ecaz-reinforcements').length, 1);
  assertIndependentSkillsBattleCustody(done);
});
