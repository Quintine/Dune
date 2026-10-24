import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  HARASS_CARD, MIRROR_CARD, STONE_CARD, finishStoneHarassBattle, holdStoneHarassTraitor,
  sealStoneHarassPlans, stoneHarassFixture, stoneHarassOccupyFixture, stoneHarassPlayer,
} from './fixture-stone-harass';

const seat = (game: Game, id: string) => stoneHarassPlayer(game, id);
const territoryForces = (game: Game, id: string, territory: string) =>
  Object.entries(seat(game, id).forces)
    .filter(([key]) => key.startsWith(`${territory}:`))
    .reduce((sum, [, amount]) => sum + amount, 0);
const discardCount = (game: Game, id: string) =>
  game.discard.filter(card => card.id === id).length;
const handHas = (game: Game, id: string, card: string) =>
  seat(game, id).hand.some(held => held.id === card);
const leaderState = (game: Game, id: string, leader: string) =>
  seat(game, id).leaders.find(candidate => candidate.id === leader)!;
const planOf = (plans: readonly { actor: string; action: Action }[], actor: string) =>
  plans.find(step => step.actor === actor)!.action;

void test('Stone Burner compares the counters the mandatory Harass return leaves, reversing the winner', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'defender' as const, stone: 'opponent' as const,
      attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 0 };
    const plain = stoneHarassFixture({ ...options, playHarass: false });
    const plainDone = finishStoneHarassBattle(sealStoneHarassPlans(plain));
    assert.equal(plainDone.lastBattleContext?.winner, 'd',
      'without the Harass commitment the defender’s five undialed counters decide the ordinary Stone battle');
    assert.equal(territoryForces(plainDone, 'd', plain.territory), 5);
    assert.equal(seat(plainDone, 'd').tanks, 0);
    assert.equal(seat(plainDone, 'a').tanks, 5, 'the defeated attacker loses its whole committed army');
    assert.equal(territoryForces(plainDone, 'a', plain.territory), 0);
    assert.ok(handHas(plainDone, 'd', HARASS_CARD), 'an unused Harass card stays in its owner’s hand');
    assert.equal(discardCount(plainDone, HARASS_CARD), 0);

    const harassed = stoneHarassFixture(options);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(harassed));
    assert.equal(done.lastBattleContext?.winner, 'a',
      'the same orders reverse once the mandatory return leaves the defender no physical counter');
    assert.equal(seat(done, 'd').reserves, 20, 'every undialed defender counter returns to its reserves');
    assert.equal(territoryForces(done, 'd', harassed.territory), 0);
    assert.equal(seat(done, 'd').tanks, 0, 'returned counters are never casualties');
    assert.equal(seat(done, 'a').tanks, 1, 'the winner still loses the counter it dialed');
    assert.equal(territoryForces(done, 'a', harassed.territory), 4);
    assert.ok(handHas(done, 'a', STONE_CARD), 'the winning attacker retains its physical Stone Burner');
    assert.equal(discardCount(done, HARASS_CARD), 1,
      'the used Harass & Withdraw card is discarded exactly once');
    assert.equal(discardCount(done, STONE_CARD), 0);
  }
});

void test('Stone Burner zero/zero comparison awards the aggressor tie to the native attacker', () => {
  for (const advanced of [false, true]) {
    const fixture = stoneHarassFixture({ advanced, harass: 'defender', stone: 'opponent',
      attackerForces: 5, defenderForces: 5, attackerDial: 5, defenderDial: 0 });
    const done = finishStoneHarassBattle(sealStoneHarassPlans(fixture));
    assert.equal(done.lastBattleContext?.winner, 'a',
      'with both sides at zero undialed counters the native attacker wins the tie');
    assert.equal(seat(done, 'a').tanks, 5, 'the winning attacker still loses every counter it dialed');
    assert.equal(territoryForces(done, 'a', fixture.territory), 0);
    assert.equal(seat(done, 'd').reserves, 20);
    assert.equal(territoryForces(done, 'd', fixture.territory), 0);
    assert.equal(seat(done, 'd').tanks, 0);
    assert.equal(discardCount(done, HARASS_CARD), 1);
  }
});

void test('Stone mode preserves Harass returns while deciding native leader deaths and bounty', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'attacker' as const, stone: 'opponent' as const,
      attackerForces: 5, defenderForces: 5, attackerDial: 2, defenderDial: 0 };
    const ignoredFixture = stoneHarassFixture({ ...options, mode: 'ignore' });
    const ignored = finishStoneHarassBattle(sealStoneHarassPlans(ignoredFixture), { mode: 'ignore' });
    assert.equal(ignored.lastBattleContext?.winner, 'd');
    assert.equal(seat(ignored, 'a').tanks, 2);
    assert.equal(seat(ignored, 'a').reserves, 18);
    assert.equal(discardCount(ignored, HARASS_CARD), 1);
    assert.equal(leaderState(ignored, ignoredFixture.attacker, ignoredFixture.leaders.a).dead, false,
      'an ignored Stone keeps both participating leaders alive');
    assert.equal(leaderState(ignored, ignoredFixture.defender, ignoredFixture.leaders.d).dead, false);

    const killedFixture = stoneHarassFixture({ ...options, mode: 'kill' });
    const killed = finishStoneHarassBattle(sealStoneHarassPlans(killedFixture), { mode: 'kill' });
    assert.equal(killed.lastBattleContext?.winner, killedFixture.defender);
    assert.equal(leaderState(killed, killedFixture.attacker, killedFixture.leaders.a).dead, true,
      'a killing Stone kills both participating leaders');
    assert.equal(leaderState(killed, killedFixture.defender, killedFixture.leaders.d).dead, true);
    assert.equal(leaderState(killed, killedFixture.attacker, killedFixture.leaders.a).deaths, 1);
    assert.equal(leaderState(killed, killedFixture.defender, killedFixture.leaders.d).deaths, 1);
    assert.equal(seat(killed, killedFixture.defender).spice, seat(ignored, ignoredFixture.defender).spice +
      leaderState(killedFixture.game, killedFixture.attacker, killedFixture.leaders.a).strength +
      leaderState(killedFixture.game, killedFixture.defender, killedFixture.leaders.d).strength,
    'the winner collects the bounty of both killed leaders');
    assert.equal(seat(killed, 'a').reserves, 18);
    assert.equal(seat(killed, 'a').tanks, 2);
    assert.equal(discardCount(killed, HARASS_CARD), 1);
  }
});

void test('a same-plan Stone and Harass commitment returns its owner’s counters before the comparison', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'defender' as const, stone: 'harass' as const,
      attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 0 };
    const plain = finishStoneHarassBattle(sealStoneHarassPlans(
      stoneHarassFixture({ ...options, playHarass: false })));
    assert.equal(plain.lastBattleContext?.winner, 'd',
      'the same physical Stone plan wins while its undialed counters still stand');
    assert.equal(territoryForces(plain, 'd', 'arrakeen'), 5);
    assert.equal(seat(plain, 'd').tanks, 0);

    const harassed = stoneHarassFixture(options);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(harassed));
    assert.equal(done.lastBattleContext?.winner, 'a');
    assert.equal(seat(done, 'd').reserves, 20);
    assert.equal(territoryForces(done, 'd', harassed.territory), 0);
    assert.equal(discardCount(done, HARASS_CARD), 1);
    assert.equal(discardCount(done, STONE_CARD), 1,
      'the same plan’s physical Stone is discarded with the defeated side');
  }
});

void test('a Mirror Weapon copying the opposing Stone keeps the copied comparison and its own retention', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'attacker' as const, stone: 'opponent' as const, mirror: true,
      attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 5 };
    const fixture = stoneHarassFixture(options);
    assert.equal(fixture.mirrorOwner, 'a');
    const done = finishStoneHarassBattle(sealStoneHarassPlans(fixture),
      { modes: { a: 'ignore', d: 'ignore' } });
    assert.equal(done.lastBattleContext?.winner, 'a',
      'the copied Stone uses the zero/zero aggressor tie after Harass returns the copier’s undialed counters');
    assert.ok(handHas(done, 'a', MIRROR_CARD), 'the winning Mirror keeps its own physical card');
    assert.equal(seat(done, 'a').reserves, 19);
    assert.equal(seat(done, 'a').tanks, 1);
    assert.equal(discardCount(done, HARASS_CARD), 1);
    assert.equal(discardCount(done, MIRROR_CARD), 0);
    assert.equal(discardCount(done, STONE_CARD), 1, 'the defeated original Stone is discarded');
    assert.equal(leaderState(done, 'a', fixture.leaders.a).dead, false);

    const killingFixture = stoneHarassFixture(options);
    const killing = finishStoneHarassBattle(sealStoneHarassPlans(killingFixture),
      { modes: { a: 'kill', d: 'ignore' } });
    assert.equal(leaderState(killing, 'a', killingFixture.leaders.a).dead, true,
      'the independent Mirror mode kills both participating leaders');
    assert.equal(leaderState(killing, 'd', killingFixture.leaders.d).dead, true);
  }
});

void test('legacy unstamped Stone precommit stays public before and after hidden opposing plans', () => {
  const messages: string[] = [];
  for (const hiddenDial of [1, 5]) {
    const ambiguous = stoneHarassFixture({ advanced: true, harass: 'defender', stone: 'opponent',
      attackerForces: 2, attackerElite: 1, attackerDial: 2, attackerSupport: 1,
      defenderForces: 5, defenderDial: hiddenDial });
    // Retain the old unstamped guard here. Fresh v1 battles instead collect
    // their actual physical-total commitments after revealed weapon choices.
    delete ambiguous.game.battle!.stoneAllocationVersion;
    const stonePlan = planOf(ambiguous.plans, 'a');
    const hiddenPlan = planOf(ambiguous.plans, 'd');
    const before = { spice: seat(ambiguous.game, 'a').spice, reserves: seat(ambiguous.game, 'a').reserves,
      hand: seat(ambiguous.game, 'a').hand.map(card => card.id) };
    const attempt = (state: Game) => {
      try {
        applyAction(state, 'a', stonePlan);
        assert.fail('an allocation-dependent Stone commitment was accepted');
      } catch (error) {
        assert.match(String(error), /change the winner/);
        return String(error);
      }
    };
    const first = attempt(ambiguous.game);
    assert.equal(ambiguous.game.battle?.plans.a, undefined,
      'a rejected Stone commitment never becomes a hidden sealed plan');
    assert.deepEqual({ spice: seat(ambiguous.game, 'a').spice,
      reserves: seat(ambiguous.game, 'a').reserves,
      hand: seat(ambiguous.game, 'a').hand.map(card => card.id) }, before);
    const sealed = applyAction(ambiguous.game, 'd', hiddenPlan);
    assert.notEqual(sealed.battle?.plans.d, undefined, 'the unrelated hidden plan seals natively');
    assert.equal(attempt(sealed), first,
      'the same commitment is rejected identically whatever the hidden opposing plan holds');
    messages.push(first);

    const legal = stoneHarassFixture({ advanced: true, harass: 'defender', stone: 'opponent',
      attackerForces: 2, attackerElite: 1, attackerDial: 0, defenderForces: 5, defenderDial: hiddenDial });
    const accepted = applyAction(legal.game, 'd', planOf(legal.plans, 'd'));
    const committed = applyAction(accepted, 'a', planOf(legal.plans, 'a'));
    assert.notEqual(committed.battle?.plans.a, undefined,
      'a physical-commitment-safe Stone plan is accepted regardless of the same hidden opposing plans');
  }
  assert.equal(messages[0], messages[1], 'the public rejection never reads private hands or plans');
});

void test('active Occupy with the fixed Ecaz user returns only the fixed counters, flipping the Stone winner', () => {
  const options = { lead: 'ecaz' as const, ecazForces: 5, allyForces: 4, opponentForces: 5, opponentDial: 0 };
  const plain = stoneHarassOccupyFixture({ ...options, harass: false });
  const plainDone = finishStoneHarassBattle(sealStoneHarassPlans(plain));
  assert.equal(plainDone.lastBattleContext?.winner, plain.lead,
    'without the return the combined fixed and variable counters decide the battle');
  assert.equal(seat(plainDone, plain.opponent).tanks, 5, 'the defeated opponent loses its whole army');
  assert.equal(territoryForces(plainDone, plain.ecaz, plain.territory), 2,
    'the winning coalition still pays its original fixed Ecaz commitment');
  assert.equal(territoryForces(plainDone, plain.ally, plain.territory), 4);

  const harassed = stoneHarassOccupyFixture(options);
  const done = finishStoneHarassBattle(sealStoneHarassPlans(harassed));
  assert.equal(done.lastBattleContext?.winner, harassed.opponent,
    'returning only the fixed Ecaz counters reverses the Stone winner');
  assert.equal(seat(done, harassed.ecaz).reserves - seat(harassed.game, harassed.ecaz).reserves, 2,
    'the Ecaz card user returns exactly its own undialed counters');
  assert.equal(seat(done, harassed.ally).reserves - seat(harassed.game, harassed.ally).reserves, 0,
    'the ally’s variable army is untouched by the Ecaz user’s return');
  assert.equal(territoryForces(done, harassed.ally, harassed.territory), 0,
    'the unchanged ally army is destroyed with the defeated coalition');
  assert.equal(discardCount(done, HARASS_CARD), 1);
  assert.ok(handHas(done, harassed.opponent, STONE_CARD), 'the winning opponent retains the physical Stone');
});

void test('active Occupy with the variable ally user returns its own army and leaves the fixed counters', () => {
  const options = { lead: 'ally' as const, ecazForces: 5, allyForces: 4, opponentForces: 3, opponentDial: 0 };
  const plain = stoneHarassOccupyFixture({ ...options, harass: false });
  const plainDone = finishStoneHarassBattle(sealStoneHarassPlans(plain));
  assert.equal(plainDone.lastBattleContext?.winner, plain.lead);
  assert.equal(seat(plainDone, plain.opponent).tanks, 3);

  const harassed = stoneHarassOccupyFixture(options);
  const done = finishStoneHarassBattle(sealStoneHarassPlans(harassed));
  assert.equal(done.lastBattleContext?.winner, harassed.opponent,
    'only the fixed Ecaz counters remain once the ally returns its own variable army');
  assert.equal(seat(done, harassed.ally).reserves - seat(harassed.game, harassed.ally).reserves, 4,
    'the ally card user returns its own whole undialed army');
  assert.equal(seat(done, harassed.ecaz).reserves - seat(harassed.game, harassed.ecaz).reserves, 0,
    'the fixed Ecaz commitment is never recomputed into a return');
  assert.equal(discardCount(done, HARASS_CARD), 1);
});

void test('the opposing active-Occupy Stone precommit never reads the coalition’s private hand', () => {
  const sealed: boolean[] = [];
  for (const holdsHarass of [true, false]) {
    const fixture = stoneHarassOccupyFixture({ lead: 'ecaz', ecazForces: 5, allyForces: 4,
      opponentForces: 5, harass: false });
    if (!holdsHarass) {
      const hand = seat(fixture.game, fixture.lead).hand;
      const index = hand.findIndex(card => card.id === HARASS_CARD);
      assert.ok(index >= 0, 'The fixture stages the physical Harass card in the lead’s hand.');
      fixture.game.deck.push(hand.splice(index, 1)[0]);
    }
    const before = { spice: seat(fixture.game, fixture.lead).spice,
      reserves: seat(fixture.game, fixture.lead).reserves };
    const next = applyAction(fixture.game, fixture.opponent, planOf(fixture.plans, fixture.opponent));
    assert.equal(next.battle?.revealed, false, 'the coalition’s own plan is still outstanding');
    assert.deepEqual({ spice: seat(next, fixture.lead).spice, reserves: seat(next, fixture.lead).reserves },
      before, 'sealing the opposing plan spends nothing of the coalition’s');
    sealed.push(next.battle?.plans[fixture.opponent] !== undefined);
  }
  assert.deepEqual(sealed, [true, true],
    'the same opposing Stone commitment is accepted with or without the coalition’s hidden card');
});

void test('a successful opposing traitor call cancels the withdrawal before any counter returns', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'defender' as const, stone: 'opponent' as const,
      attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 0,
      traitorableLeaders: true };
    const fixture = stoneHarassFixture(options);
    holdStoneHarassTraitor(fixture.game, fixture.attacker, fixture.leaders[fixture.defender]);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(fixture), { traitors: [fixture.attacker] });
    assert.equal(done.lastBattleContext?.result, 'traitor');
    assert.equal(done.lastBattleContext?.winner, fixture.attacker);
    assert.equal(seat(done, fixture.defender).reserves, 15,
      'an opposing successful call cancels the return entirely');
    assert.equal(territoryForces(done, fixture.defender, fixture.territory), 0);
    assert.equal(seat(done, fixture.defender).tanks, 5);
    assert.equal(leaderState(done, fixture.defender, fixture.leaders[fixture.defender]).dead, true);
    assert.equal(discardCount(done, HARASS_CARD), 1,
      'the used Harass card is discarded even when its effect was canceled');
  }
});

void test('an own successful traitor call leaves the withdrawal standing', () => {
  for (const advanced of [false, true]) {
    const options = { advanced, harass: 'defender' as const, stone: 'opponent' as const,
      attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 0,
      traitorableLeaders: true };
    const fixture = stoneHarassFixture(options);
    holdStoneHarassTraitor(fixture.game, fixture.defender, fixture.leaders[fixture.attacker]);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(fixture), { traitors: [fixture.defender] });
    assert.equal(done.lastBattleContext?.result, 'traitor');
    assert.equal(done.lastBattleContext?.winner, fixture.defender);
    assert.equal(seat(done, fixture.defender).reserves, 20,
      'the withdrawn counters still return for the called traitor’s own side');
    assert.equal(territoryForces(done, fixture.defender, fixture.territory), 0);
    assert.equal(seat(done, fixture.attacker).tanks, 5);
    assert.equal(leaderState(done, fixture.attacker, fixture.leaders[fixture.attacker]).dead, true);
    assert.equal(discardCount(done, HARASS_CARD), 1);
  }
});

void test('a multi-sector withdrawal uses the native allocation decision and returns only undialed counters', () => {
  const fixture = stoneHarassFixture({ advanced: true, harass: 'defender', stone: 'opponent',
    attackerForces: 5, defenderForces: 5, attackerDial: 1, defenderDial: 2, attackerSupport: 1,
    territory: 'imperial_basin', sector: 9, secondSector: 11, split: 2 });
  assert.deepEqual(seat(fixture.game, 'd').forces['imperial_basin:11'], 2);
  const revealed = sealStoneHarassPlans(fixture);
  assert.equal(revealed.decision?.kind, 'harassWithdraw',
    'the native allocation decision is offered for a partial multi-sector return');
  assert.equal(revealed.decision?.player, fixture.defender);
  const done = finishStoneHarassBattle(revealed);
  assert.equal(done.lastBattleContext?.winner, fixture.attacker);
  assert.equal(seat(done, fixture.defender).reserves, 18, 'only the three undialed counters return');
  assert.equal(seat(done, fixture.defender).tanks, 2, 'the two dialed counters are lost with the battle');
  assert.equal(territoryForces(done, fixture.defender, fixture.territory), 0);
  assert.equal(seat(done, fixture.attacker).tanks, 1);
  assert.equal(discardCount(done, HARASS_CARD), 1);
});
