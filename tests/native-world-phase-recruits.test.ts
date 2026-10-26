import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, RuleError, viewGame, type Action, type Game } from '../game/engine';
import { ownedTech } from '../game/tech-tokens';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  advanceNativeWorldRecruits, assertNativeWorldRecruitsInventory, createNativeWorldRecruitsFixture,
  nativeWorldRecruitsClean, nativeWorldRecruitsPlayer as player, nextNativeWorldRecruitsStep,
  requestNativeWorldRecruits, type NativeWorldRecruitsStep,
} from './fixture-native-world-recruits';

const play = { type: 'card', card: RECRUITS_CARD_ID } as const;
const wallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action), RuleError);
  assert.equal(JSON.stringify(game), before);
}
function axlotlProgramme(start: Game, native: string) {
  const token = start.techTokens!.axlotl;
  const owner = token.owner;
  assert.ok(owner, 'The actual first Storm must have assigned Axlotl');
  assert.notEqual(owner, native, 'The invader took any original native token in the real battle');
  assert.equal(token.spice, 0);
  assert.notEqual(token.triggeredTurn, start.turn);
  assert.ok(Object.values(start.techTokens!).every(t => t.owner !== null));
  const income = ownedTech(start.techTokens, owner).length;
  assert.ok(income > 0);
  const ownerWallet = player(start, owner).spice;
  const accrued = (game: Game) => {
    assert.equal(game.techTokens!.axlotl.owner, owner);
    assert.equal(game.techTokens!.axlotl.triggeredTurn, start.turn);
    assert.equal(game.techTokens!.axlotl.spice, income,
      'Further eligible free requests must not accrue another original phase payment');
    assert.equal(player(game, owner).spice, ownerWallet,
      'Accrued Axlotl income is not spendable personal spice before the phase ends');
    assertNativeWorldRecruitsInventory(game);
  };
  const finish = (game: Game) => {
    accrued(game);
    const bribes = viewGame(game, owner).bribeOptions;
    assert.equal(bribes.blocked, null);
    assert.equal(bribes.available, ownerWallet);
    rejectsUnchanged(game, owner, { type: 'bribe', target: native, amount: ownerWallet + income });
    let beforePhaseEnd: Game | undefined;
    let phaseEndStep: NativeWorldRecruitsStep | undefined;
    for (let count = 0; count < 100 && game.phase === 4; count++) {
      const step = nextNativeWorldRecruitsStep(game);
      assert.ok(step);
      const before = structuredClone(game);
      game = applyAction(game, step.actor, step.action);
      if (game.phase !== 4) { beforePhaseEnd = before; phaseEndStep = step; }
      else accrued(game);
    }
    assert.ok(beforePhaseEnd && phaseEndStep, 'The actual final ready must end Revival');
    accrued(beforePhaseEnd);
    assert.equal(game.turn, 2);
    assert.equal(game.phase, 5);
    const afterPhaseEnd = structuredClone(game);
    const expectedWallets = wallets(beforePhaseEnd);
    expectedWallets[owner] += income;
    assert.deepEqual(wallets(afterPhaseEnd), expectedWallets);
    assert.equal(afterPhaseEnd.techTokens!.axlotl.spice, 0);
    assert.equal(afterPhaseEnd.techTokens!.axlotl.triggeredTurn, 2);
    assert.equal(player(afterPhaseEnd, native).revived, player(beforePhaseEnd, native).revived);
    assert.equal(player(afterPhaseEnd, native).freeForcesRevived,
      player(beforePhaseEnd, native).freeForcesRevived);
    const shipmentSteps: { actor: string; action: Action }[] = [];
    const afterShipment = advanceNativeWorldRecruits(afterPhaseEnd,
      g => g.turn === 2 && g.phase === 6 && nativeWorldRecruitsClean(g), shipmentSteps);
    assert.ok(shipmentSteps.some(step => step.action.type === 'endMovement'),
      'Finish the actual next Shipment, not just its opening boundary');
    assert.deepEqual(wallets(afterShipment), expectedWallets,
      'Original Shipment continuation cannot pay Axlotl a second time');
    assert.equal(afterShipment.techTokens!.axlotl.spice, 0);
    assert.equal(afterShipment.techTokens!.axlotl.triggeredTurn, 2);
    for (const boundary of [beforePhaseEnd, afterPhaseEnd, afterShipment])
      assertNativeWorldRecruitsInventory(boundary);
    return { beforePhaseEnd, phaseEndStep, afterPhaseEnd, afterShipment };
  };
  return { owner, income, accrued, finish };
}

for (const options of [
  { name: 'Basic native Ix + Tech', advanced: false, strongholds: false },
  { name: 'Advanced native Ix + Tech + original Strongholds', advanced: true, strongholds: true },
]) {
  void test(`${options.name}: current typed rates, paid ledger and delayed once-only Axlotl survive Recruits`, () => {
    const f = createNativeWorldRecruitsFixture({ ...options, tech: true, faction: 'ixians' });
    const native = f.native;
    const programme = axlotlProgramme(f.game, native);
    assert.deepEqual({ free: viewGame(f.game, native).revival.freeRemaining,
      bonus: viewGame(f.game, native).revival.homeworldBonus }, { free: 2, bonus: 1 });
    const paid = requestNativeWorldRecruits(f.game, native, 3, 1, 0);
    assert.equal(paid.price, 3, 'Two free suboids leave the original three-spice paid cyborg');
    assert.equal(paid.walletDelta, 3);
    assert.equal(paid.free, 2);
    assert.deepEqual(paid.nativeAfter, { normal: 2, elite: 1 });
    programme.accrued(paid.game);
    let game = paid.game;
    if (!options.advanced) {
      game = applyAction(game, native, { type: 'ready' });
      assert.ok(game.ready.includes(native));
    } else {
      assert.equal(game.revivalOrder?.remaining[0], native);
      assert.equal(game.revivalOrder?.started, true, 'Keep the original Advanced opportunity open for later requests');
    }
    const beforePlayWallets = wallets(game);
    game = applyAction(game, f.owner, play);
    assert.deepEqual(wallets(game), beforePlayWallets, 'Recruits never refunds the prior paid cyborg');
    assert.equal(player(game, native).revived, 3);
    assert.equal(player(game, native).freeForcesRevived, 2);
    assert.equal(viewGame(game, native).revival.freeRemaining, 2);
    const crossing = requestNativeWorldRecruits(game, native, 2, 2, 2);
    assert.equal(crossing.price, 0);
    assert.equal(crossing.walletDelta, 0);
    assert.equal(crossing.free, 2);
    assert.deepEqual(crossing.nativeAfter, { normal: 2, elite: 3 });
    programme.accrued(crossing.game);
    const rate = viewGame(crossing.game, native).revival;
    assert.equal(rate.homeworldBonus, 0);
    assert.equal(rate.freeRemaining, 0, 'A separate request reads the current population-five World');
    assert.equal(rate.eliteRemaining, 1, 'The native multi-cyborg allowance remains in both modes');
    rejectsUnchanged(crossing.game, native, { type: 'revive', amount: 2, elite: 2 });
    const last = requestNativeWorldRecruits(crossing.game, native, 2, 1, 0);
    assert.equal(last.price, 5);
    assert.equal(last.walletDelta, 5);
    assert.equal(last.free, 0);
    assert.equal(last.ixSuboidBonus, 2, 'Current High Ix grants two additional physical Suboids for the paid Cyborg');
    assert.deepEqual(last.nativeAfter, { normal: 5, elite: 4 });
    assert.equal(player(last.game, native).tanks, 5);
    assert.equal(player(last.game, native).spice, player(f.game, native).spice - 8);
    assert.equal(player(last.game, native).revived, 7);
    assert.equal(player(last.game, native).freeForcesRevived, 4);
    assert.equal(last.game.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
    rejectsUnchanged(last.game, native, { type: 'revive', amount: 1, elite: 0 });
    programme.accrued(last.game);
    const completed = programme.finish(last.game);
    assert.equal(player(completed.afterPhaseEnd, native).spice, player(f.game, native).spice - 8);
    if (options.strongholds) {
      assert.equal(f.afterSetup.strongholdCards!.claimedTurn, 0);
      assert.ok(Object.values(f.afterSetup.strongholdCards!.owners).every(owner => owner === null));
      assert.equal(f.game.strongholdCards!.claimedTurn, 1, 'Actual first end-Mentat earns original custody');
      assert.deepEqual(completed.afterShipment.strongholdCards, f.game.strongholdCards,
        'No held card is fabricated or reassigned by native Revival or the following Shipment');
    } else assert.equal(f.game.strongholdCards, undefined);
  });
}

void test('Advanced native CHOAM + Tech: unlimited paid/free returns retain their ledgers and one delayed Axlotl payout', () => {
  const f = createNativeWorldRecruitsFixture({ advanced: true, faction: 'choam', tech: true });
  const native = f.native;
  const programme = axlotlProgramme(f.game, native);
  const first = requestNativeWorldRecruits(f.game, native, 8);
  assert.equal(first.price, 7);
  assert.equal(first.walletDelta, 7);
  assert.equal(first.free, 1);
  programme.accrued(first.game);
  const beforePlayWallets = wallets(first.game);
  let game = applyAction(first.game, f.owner, play);
  assert.deepEqual(wallets(game), beforePlayWallets, 'Seven paid returns stay paid when Recruits doubles free use');
  assert.equal(viewGame(game, native).revival.limit, 20, 'Recruits never reduces native unlimited to seven');
  assert.equal(viewGame(game, native).revival.forcesRemaining, 12);
  assert.equal(viewGame(game, native).revival.freeRemaining, 1);
  const free = requestNativeWorldRecruits(game, native, 1);
  assert.equal(free.price, 0);
  assert.equal(free.walletDelta, 0);
  assert.equal(free.free, 1);
  programme.accrued(free.game);
  const paid = requestNativeWorldRecruits(free.game, native, 3);
  assert.equal(paid.price, 3, 'Native CHOAM keeps its original one-spice price after free use');
  assert.equal(paid.walletDelta, 3);
  assert.equal(paid.free, 0);
  game = paid.game;
  assert.deepEqual(paid.nativeAfter, { normal: 12, elite: 0 });
  assert.equal(player(game, native).revived, 12);
  assert.equal(player(game, native).freeForcesRevived, 2);
  assert.equal(player(game, native).spice, player(f.game, native).spice - 10);
  assert.equal(viewGame(game, native).revival.forcesRemaining, 8);
  assert.equal(viewGame(game, native).revival.homeworldBonus, 0);
  programme.accrued(game);
  const completed = programme.finish(game);
  assert.equal(player(completed.afterPhaseEnd, native).spice, player(f.game, native).spice - 10);
});

void test('Basic all14 native Ix: actual paid cyborgs accrue Banker separately from once-only phase-end Axlotl', () => {
  const f = createNativeWorldRecruitsFixture({ skills: true, tech: true, faction: 'ixians',
    training: { emperor: 'mentat', ixians: 'swordmaster-of-ginaz', guild: 'spice-banker' } });
  const native = f.native, banker = 'guild';
  const programme = axlotlProgramme(f.game, native);
  const deferred = (game: Game) => viewGame(game, banker).spiceBankerIncome!.deferred
    .find(row => row.owner === banker)?.amount ?? 0;
  const originalBankerWallet = player(f.game, banker).spice;
  const paid = requestNativeWorldRecruits(f.game, native, 3, 1, 0);
  assert.deepEqual({ cost: paid.price, wallet: paid.walletDelta, free: paid.free },
    { cost: 3, wallet: 3, free: 2 });
  assert.equal(deferred(paid.game), 0, 'The actual three-spice bank payment is below Banker threshold');
  let game = applyAction(paid.game, native, { type: 'ready' });
  game = applyAction(game, f.owner, play);
  assert.equal(player(game, native).spice, player(f.game, native).spice - 3);
  assert.equal(player(game, native).revived, 3);
  assert.equal(player(game, native).freeForcesRevived, 2);
  const crossing = requestNativeWorldRecruits(game, native, 2, 2, 2);
  assert.deepEqual(crossing.nativeAfter, { normal: 2, elite: 3 });
  assert.equal(crossing.price, 0);
  assert.equal(deferred(crossing.game), 0, 'Typed free deposits are not qualifying bank payments');
  assert.equal(viewGame(crossing.game, native).revival.homeworldBonus, 0);
  assert.equal(viewGame(crossing.game, native).revival.freeRemaining, 0);
  rejectsUnchanged(crossing.game, native, { type: 'revive', amount: 2, elite: 2 });
  const last = requestNativeWorldRecruits(crossing.game, native, 2, 1, 0);
  assert.deepEqual({ cost: last.price, wallet: last.walletDelta, free: last.free },
    { cost: 5, wallet: 5, free: 0 });
  assert.equal(last.ixSuboidBonus, 2, 'The High bonus is physical stock, not another paid invoice or ordinary allowance');
  assert.deepEqual(last.nativeAfter, { normal: 5, elite: 4 });
  assert.equal(player(last.game, native).revived, 7);
  assert.equal(player(last.game, native).freeForcesRevived, 4);
  assert.equal(player(last.game, native).tanks, 5);
  assert.equal(player(last.game, native).elites!.tanks, 0);
  assert.equal(deferred(last.game), 1);
  const receipt = last.game.spiceBankerIncome!.sources.at(-1)!;
  assert.equal(receipt.source.kind, 'force-revival');
  assert.deepEqual(receipt.source.bankLegs, [{ payer: native, amount: 5 }]);
  assert.equal(receipt.grant?.owner, banker);
  assert.equal(player(last.game, banker).spice, originalBankerWallet,
    'Normal Banker income stays in front of the shield until Mentat');
  const completed = programme.finish(last.game);
  assert.equal(deferred(completed.afterPhaseEnd), 1, 'Revival end pays Axlotl, not Banker');
  assert.equal(deferred(completed.afterShipment), 1);
  assert.equal(player(completed.afterPhaseEnd, native).spice, player(f.game, native).spice - 8);
  assert.equal(player(completed.afterPhaseEnd, banker).spice,
    originalBankerWallet + (programme.owner === banker ? programme.income : 0));
  game = completed.afterShipment;
  for (let count = 0; count < 300 && !(game.phase === 7 && nativeWorldRecruitsClean(game)); count++) {
    if (!game.battle && game.phase === 6 && nativeWorldRecruitsClean(game)) {
      const choice = viewGame(game, game.active!).battleChoices[0]; assert.ok(choice);
      game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: choice.territory,
        target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
    } else if (game.battle && !game.battle.revealed && nativeWorldRecruitsClean(game) &&
      !game.battle.preparation && game.battle.preLeader?.closed !== false) {
      const actor = [game.battle.attacker, game.battle.defender].find(id => !game.battle!.plans[id]);
      assert.ok(actor);
      const leader = player(game, actor).leaders.filter(disc => !disc.dead && !disc.usedAt)
        .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
      assert.ok(leader);
      game = applyAction(game, actor, { type: 'battlePlan', leader: leader.id, dial: 0, support: 0 });
    } else {
      const step = nextNativeWorldRecruitsStep(game); assert.ok(step);
      game = applyAction(game, step.actor, step.action);
    }
  }
  assert.equal(game.phase, 7);
  assert.equal(deferred(game), 1);
  const beforeMentatWallet = player(game, banker).spice;
  const mentat = advanceNativeWorldRecruits(game, state => state.phase === 8 && nativeWorldRecruitsClean(state));
  assert.equal(deferred(mentat), 0);
  assert.equal(player(mentat, banker).spice, beforeMentatWallet + 1,
    'The one actual qualifying bank invoice is collected only at original Mentat');
  assert.equal(mentat.techTokens!.axlotl.spice, 0);
  assert.equal(mentat.techTokens!.axlotl.triggeredTurn, 2);
  assertNativeWorldRecruitsInventory(mentat);
});
