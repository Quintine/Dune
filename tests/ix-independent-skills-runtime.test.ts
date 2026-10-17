import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  advanceIxIndependentSkills, assertIxIndependentSkillsCustody, createIxIndependentSkillsFixture,
  createIxIndependentSkillsRevivalFixture, finishIxIndependentSkillsBattle,
  ixIndependentSkillsClean, ixIndependentSkillsPlayer as player, ixIndependentSkillsPolicyActions,
  quoteIxIndependentSkillsBattle,
  revealIxIndependentSkillsBattle, stepIxIndependentSkills,
} from './fixture-ix-independent-skills';

void test('original Ix deal and paid shipment preserve Cyborg/Suboid custody through the typed Harass commitment', () => {
  for (const advanced of [false, true]) {
    const f = createIxIndependentSkillsFixture({ advanced });
    assert.equal(f.beforeIxCard.setupStage, 'skillTreachery');
    assert.ok(f.beforeIxCard.players.every(p => p.hand.length === 0));
    assert.equal(f.beforeIxCard.ixSetupCards!.length, 3);
    assert.equal(f.offered.setupStage, 'leaderSkills');
    assert.equal(player(f.offered, f.ixians).hand[0].id, f.ixCard.action.card);
    assert.equal(f.afterSetup.leaderSkills!.assignments.find(a => a.owner === f.ixians)!.skill, 'suk-graduate');
    const before = player(f.beforeShipment, f.ixians), shipped = player(f.afterShipment, f.ixians);
    assert.equal(before.reserves, 14); assert.equal(before.elites!.reserves, 4);
    assert.equal(shipped.reserves, 10); assert.equal(shipped.elites!.reserves, 2);
    assert.equal(shipped.spice, before.spice - 8, 'four desert shipments cost two spice per physical force');
    assert.equal(player(f.afterShipment, f.opponent).spice, player(f.beforeShipment, f.opponent).spice + 8);
    assert.equal(shipped.forces[f.first], 4); assert.equal(shipped.elites!.forces[f.first], 2);
    const moved = player(f.afterMove, f.ixians);
    for (const key of [f.first, f.second]) {
      assert.equal(moved.forces[key], 2); assert.equal(moved.elites!.forces[key], 1);
    }
    const revealed = revealIxIndependentSkillsBattle(f), quote = quoteIxIndependentSkillsBattle(f, revealed);
    assert.deepEqual(quote.reinforcements,
      [{ player: f.ixians, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.scores, { attacker: advanced ? 8.5 : 9.5, defender: 1 },
      'Suboids always fight at half strength; unsupported Advanced Cyborgs are half their Basic strength');
    const withdrawal = quote.harassWithdraw![0];
    assert.deepEqual(withdrawal.returned, { normal: 1, elite: 1 });
    assert.deepEqual(withdrawal.locations, f.returns);
    assert.equal(withdrawal.remaining.normal, 1); assert.equal(withdrawal.remaining.elite, 1);
    assert.equal(revealed.decision?.kind, 'harassWithdraw');
    if (revealed.decision?.kind !== 'harassWithdraw') throw Error('Missing original typed withdrawal control');
    const event = revealed.decision.event;
    assert.throws(() => stepIxIndependentSkills(revealed, { actor: f.ixians,
      action: { type: 'decision', event,
        returns: { [f.first]: { normal: 2, elite: 0 } } } }), /undialed|physical|return|allocation/i);
    const rescue = finishIxIndependentSkillsBattle(f, { state: revealed, stop: 'rescue' });
    const p = player(rescue, f.ixians);
    assert.equal(p.reserves, 9); assert.equal(p.elites!.reserves, 3);
    assert.equal(p.tanks, 3); assert.equal(p.elites!.tanks, 0, 'only Suboids paid the reserve fee');
    assert.equal(p.forces[f.first], 1); assert.equal(p.elites!.forces[f.first], 1);
    assert.equal(p.forces[f.second], 1); assert.equal(p.elites!.forces[f.second] ?? 0, 0);
    assertIxIndependentSkillsCustody(rescue);
  }
});

void test('the real trained Suk rescues a committed Cyborg and Suboid without refunding reserve fees', () => {
  for (const advanced of [false, true]) {
    const f = createIxIndependentSkillsFixture({ advanced });
    const rescue = finishIxIndependentSkillsBattle(f, { stop: 'rescue' });
    assert.equal(rescue.decision?.kind, 'sukRescue');
    if (rescue.decision?.kind !== 'sukRescue') throw Error('Missing original native rescue controls');
    assert.equal(rescue.decision.mode, 'skilled');
    assert.ok(rescue.decision.options.some(o => o.normal === 1 && o.elite === 1 &&
      o.kept?.kind === 'elite' && o.kept.key === f.first));
    const saved = finishIxIndependentSkillsBattle(f, { state: rescue });
    assert.equal(saved.lastBattleContext!.winner, f.ixians);
    assert.equal(saved.lastBattleContext!.sukRescue!.completed, true);
    const p = player(saved, f.ixians);
    assert.equal(p.reserves, 10); assert.equal(p.elites!.reserves, 3);
    assert.equal(p.tanks, 3); assert.equal(p.elites!.tanks, 0);
    assert.equal(p.forces[f.first], 1); assert.equal(p.elites!.forces[f.first], 1);
    assert.equal(p.forces[f.second] ?? 0, 0);
    assert.equal(p.spice, 2, 'unsupported Cyborgs do not invent a support charge');
    assert.equal(player(saved, f.opponent).tanks, 5);
    for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
      assert.equal(saved.discard.filter(c => c.id === id).length, 1);
    assertIxIndependentSkillsCustody(saved);
    const lost = finishIxIndependentSkillsBattle(f, { state: rescue, rescue: 'none' });
    assert.equal(player(lost, f.ixians).reserves, 9);
    assert.equal(player(lost, f.ixians).elites!.reserves, 3);
    assert.equal(player(lost, f.ixians).tanks, 5);
    assert.equal(player(lost, f.ixians).elites!.tanks, 1);
    assert.equal(player(lost, f.ixians).forces[f.first] ?? 0, 0);
    assertIxIndependentSkillsCustody(lost);
  }
});

void test('Recruits counts prior native free returns, preserves the cap and charges the paid Cyborg surcharge', () => {
  for (const advanced of [false, true]) {
    const f = createIxIndependentSkillsRevivalFixture({ advanced });
    const original = viewGame(f.beforeRecruits, f.ixians).revival;
    assert.equal(original.limit, 3); assert.equal(original.freeRemaining, 1);
    assert.equal(player(f.beforeRecruits, f.ixians).tanks, 5);
    assert.equal(player(f.beforeRecruits, f.ixians).elites!.tanks, 1);
    assert.equal(player(f.beforeRecruits, f.ixians).spice, 5, 'real turn-one escrow settled at the real Mentat Pause');
    assert.equal(viewGame(f.beforePlay, f.ixians).revival.freeRemaining, 0);
    assert.equal(player(f.beforePlay, f.ixians).spice, player(f.beforeRecruits, f.ixians).spice);
    assert.equal(player(f.beforePlay, f.tleilaxu).spice, player(f.beforeRecruits, f.tleilaxu).spice + 1,
      'native Tleilaxu receive one spice from the Bank for the real free revival');
    const active = viewGame(f.beforeRevival, f.ixians).revival;
    assert.equal(active.limit, 7); assert.equal(active.freeRemaining, 1);
    assert.equal(viewGame(f.beforeRevival, f.tleilaxu).revival.limit, 20,
      'the global card never reduces native unlimited revival to seven');
    assert.deepEqual(f.price, { free: 1, normalCost: 5, cost: 5 },
      'one free Suboid plus one paid Suboid at two and one paid Cyborg at three');
    const before = player(f.beforeRevival, f.ixians), after = player(f.afterRevival, f.ixians);
    assert.equal(after.spice, before.spice - 5);
    assert.equal(player(f.afterRevival, f.tleilaxu).spice, player(f.beforeRevival, f.tleilaxu).spice + 5,
      'the actual paid native revival reaches Tleilaxu, not an invented Bank sink');
    assert.equal(after.reserves, before.reserves + 3); assert.equal(after.elites!.reserves, before.elites!.reserves + 1);
    assert.equal(after.tanks, before.tanks - 3); assert.equal(after.elites!.tanks, 0);
    assert.equal(after.revived, 4); assert.equal(after.freeForcesRevived, 2);
    assert.equal(f.afterRevival.discard.filter(c => c.id === RECRUITS_CARD_ID).length, 1);
    assert.equal(viewGame(f.afterRevival, f.ixians).revival.freeRemaining, 0);
    assertIxIndependentSkillsCustody(f.afterRevival);
  }
});

void test('all four minimal policies can seal native paid plans and execute projected typed withdrawal and rescue controls', () => {
  const f = createIxIndependentSkillsFixture({ advanced: true });
  const revealed = revealIxIndependentSkillsBattle(f);
  const rescue = finishIxIndependentSkillsBattle(f, { state: revealed, stop: 'rescue' });
  for (const difficulty of DIFFICULTIES) {
    const plan = ixIndependentSkillsPolicyActions(f.game, f.ixians, difficulty).find(a => a.type === 'battlePlan'); assert.ok(plan);
    const sealed = stepIxIndependentSkills(f.game, { actor: f.ixians, action: plan });
    assert.equal(player(sealed, f.ixians).reserves, player(f.game, f.ixians).reserves,
      'sealing alone cannot spend the fee or dial physical counters');
    assert.equal(player(sealed, f.ixians).spice, player(f.game, f.ixians).spice);
    assert.equal(player(sealed, f.ixians).tanks, 0);
    const returns = ixIndependentSkillsPolicyActions(revealed, f.ixians, difficulty).find(a => a.type === 'decision'); assert.ok(returns);
    const allocated = stepIxIndependentSkills(revealed, { actor: f.ixians, action: returns });
    const committed = finishIxIndependentSkillsBattle(f, { state: allocated, stop: 'rescue' });
    assert.equal(player(committed, f.ixians).reserves, 9);
    assert.equal(player(committed, f.ixians).elites!.reserves, 3);
    assert.equal(player(committed, f.ixians).tanks, 3);
    const choice = ixIndependentSkillsPolicyActions(rescue, f.ixians, difficulty).find(a => a.type === 'decision'); assert.ok(choice);
    const saved = stepIxIndependentSkills(rescue, { actor: f.ixians, action: choice });
    const done = advanceIxIndependentSkills(saved, g => g.phase === 7 && ixIndependentSkillsClean(g));
    assert.equal(player(done, f.ixians).tanks, 3, 'policy rescue saves the commitment, never the fee');
    assert.equal(player(done, f.ixians).elites!.tanks, 0);
    assertIxIndependentSkillsCustody(done);
  }
});

void test('original native Tech and Stronghold phases keep the typed Suboid fee outside Suk and carry the winner into paid Recruits', () => {
  const f = createIxIndependentSkillsRevivalFixture({ advanced: true, tech: true, strongholds: true });
  const revealed = revealIxIndependentSkillsBattle(f);
  const quote = quoteIxIndependentSkillsBattle(f, revealed);
  assert.deepEqual(quote.reinforcements,
    [{ player: f.ixians, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
  assert.deepEqual(quote.harassWithdraw![0].locations, f.returns);
  const rescue = finishIxIndependentSkillsBattle(f, { state: revealed, stop: 'rescue' });
  const initial = player(f.game, f.ixians), charged = player(rescue, f.ixians);
  assert.equal(charged.reserves, initial.reserves - 3 + 2,
    'Three actual Suboids pay before the physical Suboid and Cyborg return');
  assert.equal(charged.elites!.reserves, initial.elites!.reserves + 1);
  assert.equal(charged.tanks, 3);
  assert.equal(charged.elites!.tanks, 0);
  const saved = finishIxIndependentSkillsBattle(f, { state: rescue });
  assert.equal(saved.lastBattleContext!.sukRescue!.completed, true);
  assert.equal(player(saved, f.ixians).tanks, 3, 'Suk cannot rescue the reserve fee');
  assert.equal(player(saved, f.ixians).elites!.tanks, 0);
  assert.equal(f.afterBattle.techTokens!.production.owner, f.ixians,
    'The real winner takes the original unowned token, not a staged claim');
  assert.equal(f.beforeRevival.strongholdCards!.claimedTurn, 1);
  assert.equal(f.beforeRevival.strongholdCards!.owners.hidden_mobile_stronghold, f.ixians);
  assert.deepEqual(f.price, { free: 1, normalCost: 5, cost: 5 });
  const before = player(f.beforeRevival, f.ixians), after = player(f.afterRevival, f.ixians);
  assert.equal(after.spice, before.spice - 5);
  assert.equal(player(f.afterRevival, f.tleilaxu).spice, player(f.beforeRevival, f.tleilaxu).spice + 5,
    'Native paid Cyborg/Suboid revival still pays the real Tleilaxu recipient');
  assert.equal(after.reserves, before.reserves + 3);
  assert.equal(after.elites!.reserves, before.elites!.reserves + 1);
  assert.equal(after.tanks, before.tanks - 3);
  assert.equal(after.elites!.tanks, 0);
  assert.equal(viewGame(f.afterRevival, f.ixians).revival.freeRemaining, 0);
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD, RECRUITS_CARD_ID])
    assert.equal(f.afterRevival.discard.filter(card => card.id === id).length, 1);
  assertIxIndependentSkillsCustody(saved);
  assertIxIndependentSkillsCustody(f.afterRevival);
});
