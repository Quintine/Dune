import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { MOBILE_LOCATION } from '../game/board';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import {
  assertNativeFamilyReinforcementsInventory,
  createNativeFamilyReinforcementsFixture,
  finishNativeFamilyReinforcementsBattle,
  nativeFamilyReinforcementsClean,
  nativeFamilyReinforcementsPlayer as player,
  revealNativeFamilyReinforcementsBattle,
  sealNativeFamilyReinforcementsPlan,
  type NativeFamilyReinforcementsFixture,
  type NativeFamilyReinforcementsStep,
} from './fixture-native-family-reinforcements';

function assertDisposed(game: Game,
  fixture: NativeFamilyReinforcementsFixture): void {
  assert.equal(game.battle, null);
  assert.ok(nativeFamilyReinforcementsClean(game));
  assert.equal(game.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  assert.ok(!player(game, fixture.owner).hand.some(c => c.id === REINFORCEMENTS_CARD));
  assertNativeFamilyReinforcementsInventory(game);
}

for (const advanced of [false, true]) {
  for (const faction of ['ixians', 'tleilaxu', 'choam'] as const) {
    for (const slot of ['weapon', 'defense'] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} native ${faction} ${slot}: fee3/+2 wins without more physical dial or support`, () => {
        const f = createNativeFamilyReinforcementsFixture({ faction, advanced, slot });
        const own = player(f.game, f.owner), opponent = player(f.game, f.opponent);
        const preview = viewGame(f.game, f.owner).battle!.reinforcements;
        assert.equal(preview?.blocked, null);

        const first = sealNativeFamilyReinforcementsPlan(structuredClone(f.game), f.planActions[0]);
        assert.equal(player(first, f.owner).reserves, own.reserves, 'A private plan does not spend the eventual reveal fee');
        assert.equal(player(first, f.owner).tanks, own.tanks);
        const revealed = sealNativeFamilyReinforcementsPlan(first, f.planActions[1]);
        assert.deepEqual(player(revealed, f.owner).forces, own.forces, 'Reinforcements has not shipped an army into the battle');
        assert.deepEqual(player(revealed, f.owner).elites?.forces, own.elites?.forces);

        const continuation: NativeFamilyReinforcementsStep[] = [];
        const done = finishNativeFamilyReinforcementsBattle(revealed, { actions: continuation });
        const after = player(done, f.owner);
        assert.equal(done.lastBattleContext!.result, 'normal');
        assert.equal(done.lastBattleContext!.winner, f.owner);
        assert.equal(after.reserves, own.reserves - 3);
        assert.equal(after.elites?.reserves, own.elites?.reserves, 'Normal reserves pay before untouched cyborg reserves');
        assert.equal(after.tanks, 5, 'Fee3 plus exactly two original physical committed tokens');
        assert.equal(after.battleLosses, 5);
        assert.equal(after.elites?.tanks ?? 0, faction === 'ixians' ? 1 : 0);
        assert.equal(after.forces[f.location], 1);
        assert.equal(after.elites?.forces[f.location] ?? 0, faction === 'ixians' ? 1 : 0);
        assert.equal(player(done, f.opponent).reserves, opponent.reserves);
        assert.equal(player(done, f.opponent).tanks, 3);
        if (faction === 'choam' && advanced) assert.ok(continuation.some(s =>
          s.action.type === 'decision' && s.action.audit === false), 'The surviving original Auditor still offers its real inspection');
        assertDisposed(done, f);

        // Holding all original armies, leaders, dial and support fixed, remove
        // only R: total 3.5 (Ix) or 4 (others) loses to the same printed five.
        // R adds precisely two strength, not extra supported physical tokens.
        const plain = structuredClone(f.planActions[0]);
        plain.action.weapon = null; plain.action.defense = null;
        let control = sealNativeFamilyReinforcementsPlan(structuredClone(f.game), plain);
        control = sealNativeFamilyReinforcementsPlan(control, f.planActions[1]);
        control = finishNativeFamilyReinforcementsBattle(control);
        assert.equal(control.lastBattleContext!.winner, f.opponent);
        assert.equal(player(control, f.owner).reserves, own.reserves);
        assert.equal(player(control, f.owner).tanks, 3);
        assertNativeFamilyReinforcementsInventory(control);

        const impossible = structuredClone(f.planActions[0].action);
        impossible.dial = faction === 'ixians' ? 6.5 : 5;
        impossible.support = advanced ? faction === 'ixians' ? 2 : 3 : 0;
        const unchanged = structuredClone(f.game);
        assert.throws(() => applyAction(f.game, f.owner, impossible), 'The +2 card does not allow dialing two additional tokens');
        assert.deepEqual(f.game, unchanged);
        if (faction === 'ixians' && advanced) {
          const overSupported = { ...f.planActions[0].action, support: 3 };
          assert.throws(() => applyAction(f.game, f.owner, overSupported), 'The original suboid cannot receive spice support');
          assert.deepEqual(f.game, unchanged);
        }
      });
    }
  }

  // Distinct native consequences, rather than repeated roster/default rows:
  // cyborg losses/explosion, Tleilaxu's genuine Face Dancer window, and the
  // Auditor's exceptional-outcome continuation all retain the revealed fee.
  for (const { faction, outcome } of [
    { faction: 'ixians', outcome: 'loser' },
    { faction: 'ixians', outcome: 'explosion' },
    { faction: 'tleilaxu', outcome: 'loser' },
    { faction: 'tleilaxu', outcome: 'traitor' },
    { faction: 'choam', outcome: 'traitor' },
    { faction: 'choam', outcome: 'explosion' },
  ] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} native ${faction} ${outcome}: revealed fee and mandatory discard survive native aftermath`, () => {
      const f = createNativeFamilyReinforcementsFixture({ faction, advanced, outcome,
        slot: advanced ? 'defense' : 'weapon' });
      const before = player(f.game, f.owner), continuation: NativeFamilyReinforcementsStep[] = [];
      const done = finishNativeFamilyReinforcementsBattle(revealNativeFamilyReinforcementsBattle(f), {
        callers: outcome === 'traitor' ? [f.opponent] : [], actions: continuation,
      });
      const own = player(done, f.owner);
      assert.equal(done.lastBattleContext!.result, outcome === 'loser' ? 'normal' : outcome);
      assert.equal(done.lastBattleContext!.winner, outcome === 'explosion' ? null : f.opponent);
      assert.equal(own.reserves, before.reserves - 3);
      assert.equal(own.elites?.reserves, before.elites?.reserves);
      assert.equal(own.tanks, 6, 'Fee3 and only the three original losing/exploding counters');
      assert.equal(own.battleLosses, 6);
      assert.equal(own.elites?.tanks ?? 0, faction === 'ixians' ? 2 : 0);
      assert.equal(own.forces[f.location] ?? 0, 0);
      assert.equal(own.spice, before.spice - Number(f.planActions[0].action.support), 'Only the printed physical support is paid, with no support for fee counters or +2');
      if (faction === 'choam' && advanced) assert.ok(continuation.some(s =>
        s.action.type === 'decision' && s.action.audit === false), 'The dead or surviving Auditor is handled by its original control');
      if (faction === 'tleilaxu' && outcome === 'loser') assert.ok(continuation.some(s =>
        s.action.type === 'decision' && s.action.reveal === false), 'The actual matching native Face Dancer is offered after the Guild victory');
      assertDisposed(done, f);
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} selected Ix+CHOAM: nine paid suboids leave a real one-suboid/two-cyborg fee`, () => {
    const f = createNativeFamilyReinforcementsFixture({ advanced, faction: 'ixians', mixedFee: true,
      expansions: ['ix', 'choam'], slot: advanced ? 'weapon' : 'defense' });
    const own = player(f.game, f.owner);
    assert.equal(own.reserves, 5);
    assert.equal(own.elites!.reserves, 4);
    const done = finishNativeFamilyReinforcementsBattle(revealNativeFamilyReinforcementsBattle(f));
    const after = player(done, f.owner);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(after.reserves, 2);
    assert.equal(after.elites!.reserves, 2, 'Exactly two original cyborgs supplement the one remaining suboid');
    assert.equal(after.tanks, 4, 'Three fee tokens plus one half-strength dialed suboid');
    assert.equal(after.elites!.tanks, 2, 'Reserve cyborg fee enters matching elite Tanks, not normal Tanks');
    assert.equal(after.battleLosses, 4);
    assert.equal(after.forces[f.location], 8);
    assert.equal(after.elites!.forces[f.location] ?? 0, 0);
    assert.equal(after.forces[MOBILE_LOCATION], 6);
    assert.equal(after.elites!.forces[MOBILE_LOCATION], 3);
    assertDisposed(done, f);
  });
}
