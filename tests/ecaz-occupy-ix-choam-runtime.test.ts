import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { ecazOccupyTerritoryForces } from './fixture-ecaz-occupy';
import {
  nativeIxOccupyCase, nativeChoamOccupyCase, nativeOccupyPlayer,
  type NativeIxOccupyCase, type NativeChoamOccupyCase,
} from './fixture-ecaz-ix-choam';

function forces(game: Game, result: NativeIxOccupyCase | NativeChoamOccupyCase, owner: string): number {
  return ecazOccupyTerritoryForces(game, owner, result.fixture.territory);
}
function cyborgs(game: Game, result: NativeIxOccupyCase): number {
  return nativeOccupyPlayer(game, result.fixture.ally).elites?.forces[result.fixture.location] ?? 0;
}
function conservedIx(game: Game, result: NativeIxOccupyCase): void {
  const ix = nativeOccupyPlayer(game, result.fixture.ally);
  assert.equal(ix.reserves + ix.tanks + Object.values(ix.forces).reduce((sum, count) => sum + count, 0), 20);
  assert.ok(ix.elites);
  assert.equal(ix.elites.reserves + ix.elites.tanks +
    Object.values(ix.elites.forces).reduce((sum, count) => sum + count, 0), 7);
}
function sameEvent(result: NativeIxOccupyCase): void {
  const event = result.before.battle?.ecazOccupy?.event;
  assert.ok(event);
  assert.equal(result.afterLosses.lastBattleContext?.event, event,
    'Typed physical casualties belong to the original Occupy battle.');
  assert.equal(result.game.lastBattleContext?.event, event,
    'Ix substitution and selected-lead cleanup must not create a second battle.');
}

for (const lead of ['ecaz', 'ally'] as const)
  for (const commitment of ['funded', 'half'] as const)
    void test(`Native mixed Ix ${commitment} commitment with ${lead} lead settles typed losses, Suboids and lead cards`, () => {
      const result = nativeIxOccupyCase({ lead, commitment });
      const { fixture, actor, before, afterReveal, afterLosses, afterSubstitution, game } = result;
      const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
      const expectedLost = commitment === 'funded' ? 4 : 5;
      const expectedCyborgsLost = commitment === 'funded' ? 2 : 1;
      const profile = viewGame(before, actor).battle?.ecazOccupy?.profile;
      assert.ok(profile);
      assert.equal(profile.forceOwner, fixture.ally);
      assert.equal(profile.payer, actor);
      assert.equal(profile.forces.normalFixedHalf, true, 'Actual Suboids stay half-strength regardless of selected lead.');
      assert.equal(profile.maxSupport, 2, 'Only two actual Cyborgs can receive paid support.');
      assert.equal(profile.fixedEcazDial, 3);
      assert.ok(afterReveal.decision?.kind === 'battleLosses');
      assert.equal(afterReveal.decision.player, actor);
      assert.equal(afterReveal.decision.forceOwner, fixture.ally);
      assert.ok(afterReveal.decision.options.some(loss => loss.normal === (commitment === 'funded' ? 2 : 4) &&
        loss.elite === expectedCyborgsLost), 'The selected dial has a real physical typed winner allocation.');
      assert.equal(forces(afterLosses, result, fixture.ally), 8 - expectedLost);
      assert.equal(cyborgs(afterLosses, result), 2 - expectedCyborgsLost);
      assert.equal(nativeOccupyPlayer(afterLosses, fixture.ally).elites!.tanks -
        nativeOccupyPlayer(before, fixture.ally).elites!.tanks, expectedCyborgsLost);
      assert.ok(afterLosses.decision?.kind === 'ixSubstitution');
      assert.equal(afterLosses.decision.player, fixture.ally);
      assert.equal(afterLosses.decision.losses[fixture.location], expectedCyborgsLost);
      assert.equal(forces(afterSubstitution, result, fixture.ally), 8 - expectedLost,
        'A surviving Suboid is exchanged, not an additional Cyborg created.');
      assert.equal(cyborgs(afterSubstitution, result), 2);
      assert.equal(nativeOccupyPlayer(afterSubstitution, fixture.ally).elites!.tanks,
        nativeOccupyPlayer(before, fixture.ally).elites!.tanks);
      assert.equal(nativeOccupyPlayer(afterSubstitution, fixture.ally).tanks -
        nativeOccupyPlayer(before, fixture.ally).tanks, expectedLost);
      assert.ok(afterSubstitution.decision?.kind === 'battleCards');
      assert.equal(afterSubstitution.decision.player, actor,
        'Native Ix substitution resumes the selected leader/card owner, not the force owner.');
      assert.equal(game.lastBattleContext?.winner, actor);
      assert.equal(forces(game, result, fixture.ecaz), 2);
      assert.equal(forces(game, result, fixture.opponent), 0);
      assert.equal(nativeOccupyPlayer(before, actor).spice - nativeOccupyPlayer(game, actor).spice,
        commitment === 'funded' ? 1 : 0, 'Suboids and fixed Ecaz contribute no paid support.');
      assert.equal(nativeOccupyPlayer(before, nonLead).spice, nativeOccupyPlayer(game, nonLead).spice);
      assert.deepEqual(nativeOccupyPlayer(game, nonLead).hand, nativeOccupyPlayer(before, nonLead).hand);
      assert.ok(game.discard.some(card => card.id === result.shield));
      assert.ok(!nativeOccupyPlayer(game, actor).hand.some(card => card.id === result.shield));
      sameEvent(result);
      for (const checkpoint of [before, afterLosses, afterSubstitution, game]) conservedIx(checkpoint, result);
      assert.ok(game.phase >= 7);
    });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Native Ix zero variable commitment with ${lead} lead still pays the mandatory free Ecaz losses`, () => {
    const result = nativeIxOccupyCase({ lead, commitment: 'zero' });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(forces(game, result, fixture.ecaz), 2);
    assert.equal(forces(game, result, fixture.ally), 8);
    assert.equal(cyborgs(game, result), 2);
    assert.equal(nativeOccupyPlayer(game, fixture.ally).tanks, nativeOccupyPlayer(before, fixture.ally).tanks);
    assert.equal(nativeOccupyPlayer(game, actor).spice, nativeOccupyPlayer(before, actor).spice);
    assert.notEqual(result.afterLosses.decision?.kind, 'ixSubstitution');
    conservedIx(game, result);
  });

void test('Native Karama cancellation with Ecaz lead uses only Ecaz own army and leaves mixed Ix untouched on a win', () => {
  const result = nativeIxOccupyCase({ lead: 'ecaz', canceled: true });
  const { fixture, before, game } = result;
  const profile = viewGame(before, fixture.ecaz).battle?.ecazOccupy?.profile;
  assert.ok(profile?.canceled);
  assert.equal(profile.forceOwner, fixture.ecaz);
  assert.equal(profile.fixedEcazDial, 0);
  assert.equal(profile.forces.normalFixedHalf, false);
  assert.equal(game.lastBattleContext?.winner, fixture.ecaz);
  assert.equal(forces(game, result, fixture.ecaz), 3);
  assert.equal(forces(game, result, fixture.ally), 8);
  assert.equal(cyborgs(game, result), 2);
  assert.equal(nativeOccupyPlayer(before, fixture.ecaz).spice - nativeOccupyPlayer(game, fixture.ecaz).spice, 2);
  assert.equal(nativeOccupyPlayer(game, fixture.ally).tanks, nativeOccupyPlayer(before, fixture.ally).tanks);
  assert.equal(nativeOccupyPlayer(game, fixture.ally).elites!.tanks, nativeOccupyPlayer(before, fixture.ally).elites!.tanks);
  assert.deepEqual(nativeOccupyPlayer(game, fixture.ally).hand, nativeOccupyPlayer(before, fixture.ally).hand);
  assert.notEqual(result.afterLosses.decision?.kind, 'ixSubstitution');
  sameEvent(result);
  conservedIx(game, result);
});

void test('Native Karama cancellation with Ix lead uses Ix own typed army then returns to Ix cards without consuming Ecaz', () => {
  const result = nativeIxOccupyCase({ lead: 'ally', canceled: true });
  const { fixture, before, afterLosses, afterSubstitution, game } = result;
  const profile = viewGame(before, fixture.ally).battle?.ecazOccupy?.profile;
  assert.ok(profile?.canceled);
  assert.equal(profile.forceOwner, fixture.ally);
  assert.equal(profile.fixedEcazDial, 0);
  assert.equal(game.lastBattleContext?.winner, fixture.ally);
  assert.equal(forces(game, result, fixture.ecaz), 5);
  assert.equal(forces(game, result, fixture.ally), 4);
  assert.ok(afterLosses.decision?.kind === 'ixSubstitution');
  assert.equal(afterLosses.decision.player, fixture.ally);
  assert.equal(cyborgs(afterLosses, result), 0);
  assert.equal(cyborgs(afterSubstitution, result), 2);
  assert.ok(afterSubstitution.decision?.kind === 'battleCards');
  assert.equal(afterSubstitution.decision.player, fixture.ally);
  assert.equal(nativeOccupyPlayer(before, fixture.ally).spice - nativeOccupyPlayer(game, fixture.ally).spice, 1);
  assert.deepEqual(nativeOccupyPlayer(game, fixture.ecaz).hand, nativeOccupyPlayer(before, fixture.ecaz).hand);
  assert.equal(nativeOccupyPlayer(game, fixture.ecaz).tanks, nativeOccupyPlayer(before, fixture.ecaz).tanks);
  sameEvent(result);
  conservedIx(game, result);
});

void test('All four native minimal policies can continue after Ecaz-led Ix substitution and selected-card cleanup', () => {
  const { actor, game } = nativeIxOccupyCase({ lead: 'ecaz' });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, actor);
    const player = view.players.find(p => p.id === actor);
    assert.ok(player);
    player.bot = difficulty;
    // "Continue" is the contract: a random deal can leave the actor already in
    // Collection with only an optional card play, so accept any legal policy
    // action and keep asserting the phase the continuation reaches.
    const choices = botActions(view);
    const action = choices.find(candidate => candidate.type === 'ready') ?? choices[0];
    assert.ok(action, `${difficulty} must be able to continue the actual post-Ix phase.`);
    let next = applyAction(game, actor, action);
    while (next.phaseOpening) {
      const pending = next.players.find(p => !next.phaseOpening!.passed.includes(p.id));
      assert.ok(pending);
      next = applyAction(next, pending.id, { type: 'ready' });
    }
    assert.equal(next.phase, 7, 'The policy and native opening acknowledgments reach actual Collection.');
    assert.equal(next.phaseOpening, null);
  }
});

for (const relationship of ['coside', 'opposing'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Native ${relationship} CHOAM with ${lead} lead receives only floor halves of actual other-payer support`, () => {
      const result = nativeChoamOccupyCase({ relationship, lead });
      const { fixture, actor, choam, before, revealed, game } = result;
      const plan = revealed.battle?.plans[actor];
      assert.ok(plan);
      assert.equal(plan.support, 3);
      assert.equal(plan.allyPayment ?? 0, 0);
      assert.equal(plan.dial, 6, 'Three mandatory free Ecaz strength is not three additional support payments.');
      assert.equal(game.lastBattleContext?.winner, actor);
      assert.equal(game.lastBattleContext?.result, 'normal');
      const actorIsChoam = actor === choam;
      const opponentIsChoam = fixture.opponent === choam;
      const income = actorIsChoam || opponentIsChoam ? 1 : 2;
      assert.equal(nativeOccupyPlayer(game, choam).spice - nativeOccupyPlayer(before, choam).spice,
        income - (actorIsChoam || opponentIsChoam ? 3 : 0),
        'Each actual other payer contributes floor(3/2); CHOAM own support goes wholly to the Bank.');
      if (!actorIsChoam)
        assert.equal(nativeOccupyPlayer(before, actor).spice - nativeOccupyPlayer(game, actor).spice, 3);
      const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
      if (nonLead !== choam)
        assert.equal(nativeOccupyPlayer(before, nonLead).spice, nativeOccupyPlayer(game, nonLead).spice);
      assert.equal(forces(game, result, fixture.ecaz), 2);
      assert.equal(forces(game, result, fixture.ally), 5);
      assert.equal(forces(game, result, fixture.opponent), 0);
      assert.ok(game.phase >= 7);
    });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Native coside CHOAM fixed-only ${lead} lead has no bank payment or minted battle income`, () => {
    const result = nativeChoamOccupyCase({ lead, support: 0, opponentSupport: 0 });
    const { fixture, actor, choam, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(nativeOccupyPlayer(game, choam).spice, nativeOccupyPlayer(before, choam).spice);
    assert.equal(nativeOccupyPlayer(game, fixture.ecaz).spice, nativeOccupyPlayer(before, fixture.ecaz).spice);
    assert.equal(game.pendingChoamBattleIncome ?? null, null);
    assert.equal(forces(game, result, fixture.ecaz), 2);
    assert.equal(forces(game, result, fixture.ally), 8);
  });

void test('Native CHOAM funding separates Ecaz own spice from actual prepaid donor spice and excludes donor share from income', () => {
  const result = nativeChoamOccupyCase({ lead: 'ecaz', donorPayment: 2 });
  const { fixture, actor, choam, beforeFunding, before, revealed, game } = result;
  assert.equal(before.aid[choam]?.amount, 2, 'The native CHOAM offer must actually escrow the donor share.');
  assert.equal(nativeOccupyPlayer(beforeFunding, choam).spice - nativeOccupyPlayer(before, choam).spice, 2);
  assert.equal(revealed.battle?.plans[actor]?.allyPayment, 2);
  assert.equal(nativeOccupyPlayer(before, actor).spice - nativeOccupyPlayer(game, actor).spice, 1);
  assert.equal(nativeOccupyPlayer(game, choam).spice - nativeOccupyPlayer(beforeFunding, choam).spice, -1,
    'Two prepaid donor spice yield no CHOAM share; only floor(3/2) enemy income returns.');
  assert.equal(game.lastBattleContext?.winner, fixture.ecaz);
  assert.equal(forces(game, result, fixture.ecaz), 2);
  assert.equal(forces(game, result, fixture.ally), 5);
});

for (const relationship of ['coside', 'opposing'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Native ${relationship} CHOAM ${lead}-led traitor victory excludes all battle income and waives winner support`, () => {
      const result = nativeChoamOccupyCase({ relationship, lead, traitor: true });
      const { fixture, actor, choam, before, revealed, game } = result;
      const opposingLeader = nativeOccupyPlayer(before, fixture.opponent).leaders.find(leader =>
        leader.id === revealed.battle?.plans[fixture.opponent]?.leader);
      assert.ok(opposingLeader);
      const bounty = opposingLeader.strength;
      assert.equal(game.lastBattleContext?.result, 'traitor');
      assert.equal(game.lastBattleContext?.winner, actor);
      assert.equal(nativeOccupyPlayer(game, actor).spice - nativeOccupyPlayer(before, actor).spice, bounty,
        'The successful caller pays no winning support and retains the original leader bounty.');
      assert.equal(nativeOccupyPlayer(game, choam).spice - nativeOccupyPlayer(before, choam).spice,
        choam === fixture.opponent ? -3 : choam === actor ? bounty : 0,
        'No actual support payment generates CHOAM income during traitor combat; original winner bounty is separate.');
      assert.equal(game.pendingChoamBattleIncome ?? null, null);
      assert.equal(forces(game, result, fixture.ecaz), 5);
      assert.equal(forces(game, result, fixture.ally), 8);
      assert.equal(forces(game, result, fixture.opponent), 0);
    });
