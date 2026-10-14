import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  emperorNexusPools, validateEmperorNexusRevival,
} from '../game/nexus-emperor-secret-ally';
import { forceRevivalQuote, forceRevivalRemaining, revivalPrevented } from '../game/revival';
import { ownedTech } from '../game/tech-tokens';
import { homeworldRevivalDeploymentChoice } from '../game/homeworld-revival-deployment-options';
import {
  advanceNexusEmperorExtra, createNexusEmperorExtraFixture, nexusEmperorExtraClean,
  nexusEmperorExtraInventory, nexusEmperorExtraPlayer as player, settleNexusEmperorExtra,
} from './fixture-nexus-emperor-extra';

function grant(game: Game, owner: string, elite = 0): Action {
  const offer = viewGame(game, owner).nexusEmperorSecretAlly;
  assert.ok(offer);
  return { type: 'nexusEmperorRevive', event: offer.event, elite };
}
function receipt(game: Game, stage: 'requested' | 'returned' | 'denied') {
  assert.equal(game.nexusEmperorSecretHistory?.length, 1);
  const record = game.nexusEmperorSecretHistory![0];
  assert.ok('version' in record && record.version === 2);
  assert.equal(record.stage, stage);
  validateEmperorNexusRevival(game, record);
  return record;
}
function spent(game: Game, owner: string): void {
  assert.equal(game.nexusCards!.cards!.hands[owner], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  assert.equal(viewGame(game, owner).nexusEmperorSecretAlly, null);
  nexusEmperorExtraInventory(game);
}
function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function allow(game: Game, native: string): Game {
  assert.equal(game.decision?.kind, 'revivalStop');
  assert.equal(game.decision!.player, native);
  return settleNexusEmperorExtra(applyAction(game, native, { type: 'decision', decline: true }));
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} genuine Emperor grant returns exactly three without a leader, payment or ordinary quota`, () => {
    const f = createNexusEmperorExtraFixture({ advanced });
    const before = player(f.game, f.owner), beforePools = emperorNexusPools(before);
    const action = grant(f.game, f.owner);
    rejected(f.game, f.opponent, action);
    rejected(f.game, f.partner, action);
    rejected(f.game, f.owner, { type: 'nexusEmperorRevive', event: 'stale', elite: 0 });
    rejected(f.game, f.owner, { type: 'nexusEmperorRevive', event: f.event, elite: 1 });
    const returned = settleNexusEmperorExtra(applyAction(f.game, f.owner, action));
    const holder = player(returned, f.owner), record = receipt(returned, 'returned');
    assert.equal(record.event, f.event);
    assert.deepEqual(record.before, beforePools);
    assert.deepEqual(record.after, { ...beforePools, reserves: before.reserves + 3, tanks: before.tanks - 3 });
    assert.deepEqual(emperorNexusPools(holder), record.after);
    assert.deepEqual(holder.leaders, before.leaders);
    assert.equal(holder.leaderRevived, before.leaderRevived);
    assert.deepEqual(returned.emperorExtra, f.game.emperorExtra);
    assert.equal(returned.pendingRevival, null);
    spent(returned, f.owner);
    rejected(returned, f.owner, action);
  });

  void test(`${band} extra-first preserves the full ordinary free/paid quote and real phase continuation`, () => {
    const f = createNexusEmperorExtraFixture({ advanced });
    const quote = forceRevivalQuote(f.game, player(f.game, f.owner), 3);
    const extra = settleNexusEmperorExtra(applyAction(f.game, f.owner, grant(f.game, f.owner)));
    assert.deepEqual(forceRevivalQuote(extra, player(extra, f.owner), 3), quote);
    assert.equal(forceRevivalRemaining(extra, player(extra, f.owner)), 3);
    const ordinary = settleNexusEmperorExtra(applyAction(extra, f.owner, { type: 'revive', amount: 3 }));
    const holder = player(ordinary, f.owner);
    assert.equal(holder.reserves, player(f.game, f.owner).reserves + 6);
    assert.equal(holder.tanks, player(f.game, f.owner).tanks - 6);
    assert.equal(holder.revived, 3);
    assert.equal(holder.freeForcesRevived, quote.free);
    assert.equal(holder.spice, player(extra, f.owner).spice - quote.cost);
    rejected(ordinary, f.owner, { type: 'revive', amount: 1 });
    receipt(ordinary, 'returned');
    const next = advanceNexusEmperorExtra(ordinary, state => state.turn === 3 && state.phase === 4 && nexusEmperorExtraClean(state));
    assert.equal(player(next, f.owner).tanks, holder.tanks);
    assert.equal(player(next, f.owner).revived, 0);
    assert.equal(player(next, f.owner).freeForcesRevived, 0);
    receipt(next, 'returned');
    const nextQuote = forceRevivalQuote(next, player(next, f.owner), 2);
    const later = settleNexusEmperorExtra(applyAction(next, f.owner, { type: 'revive', amount: 2 }));
    assert.equal(player(later, f.owner).tanks, 0);
    assert.equal(player(later, f.owner).spice, player(next, f.owner).spice - nextQuote.cost);
    spent(later, f.owner);
  });

  void test(`${band} three prior ordinary counters do not reduce the independent printed three grant`, () => {
    const f = createNexusEmperorExtraFixture({ advanced });
    const ordinary = settleNexusEmperorExtra(applyAction(f.game, f.owner, { type: 'revive', amount: 3 }));
    assert.equal(forceRevivalRemaining(ordinary, player(ordinary, f.owner)), 0);
    const before = emperorNexusPools(player(ordinary, f.owner));
    const extra = settleNexusEmperorExtra(applyAction(ordinary, f.owner, grant(ordinary, f.owner)));
    assert.deepEqual(emperorNexusPools(player(extra, f.owner)), { ...before, reserves: before.reserves + 3, tanks: before.tanks - 3 });
    assert.equal(player(extra, f.owner).revived, 3);
    assert.deepEqual(extra.emperorExtra, ordinary.emperorExtra);
    receipt(extra, 'returned');
    rejected(extra, f.owner, { type: 'revive', amount: 1 });
    spent(extra, f.owner);
  });

  void test(`${band} genuine single-E1 Ix counters retain native typed custody and available-count caps`, () => {
    const f = createNexusEmperorExtraFixture({ advanced, profile: 'ixians' });
    const ordinary = settleNexusEmperorExtra(applyAction(f.game, f.owner, { type: 'revive', amount: 1, elite: 1 }));
    const before = player(ordinary, f.owner), beforePools = emperorNexusPools(before);
    assert.equal(before.elites!.tanks, 2);
    rejected(ordinary, f.owner, grant(ordinary, f.owner, 3));
    const extra = settleNexusEmperorExtra(applyAction(ordinary, f.owner, grant(ordinary, f.owner, 2)));
    assert.deepEqual(emperorNexusPools(player(extra, f.owner)), {
      ...beforePools, reserves: before.reserves + 3, tanks: before.tanks - 3,
      eliteReserves: before.elites!.reserves + 2, eliteTanks: 0, eliteRevived: before.elites!.revived + 2,
    });
    assert.equal(player(extra, f.owner).revived, 1);
    assert.equal(player(extra, f.owner).elites!.revived, 3, 'Ix follows its native count cap, not the Advanced Fedaykin cap');
    assert.equal(forceRevivalRemaining(extra, player(extra, f.owner)), 2);
    const continued = settleNexusEmperorExtra(applyAction(extra, f.owner, { type: 'revive', amount: 1, elite: 0 }));
    assert.equal(player(continued, f.owner).revived, 2);
    assert.equal(player(continued, f.owner).tanks, 3);
    receipt(continued, 'returned');
    spent(continued, f.owner);
  });
}

void test('native Tleilaxu Allow waits for original physical return, awards free income once, and triggers real Axlotl custody', () => {
  const f = createNexusEmperorExtraFixture({ advanced: true, profile: 'tleilaxu', tech: true });
  const native = f.partner, beforePools = emperorNexusPools(player(f.game, f.owner));
  const nativeSpice = player(f.game, native).spice;
  const declared = applyAction(f.game, f.owner, grant(f.game, f.owner));
  const requested = receipt(declared, 'requested');
  assert.deepEqual(requested.before, beforePools);
  assert.equal(requested.after, null);
  assert.deepEqual(emperorNexusPools(player(declared, f.owner)), beforePools);
  assert.equal(player(declared, native).spice, nativeSpice);
  assert.deepEqual(declared.techTokens, f.game.techTokens);
  spent(declared, f.owner);
  const returned = allow(declared, native);
  receipt(returned, 'returned');
  assert.equal(player(returned, f.owner).reserves, beforePools.reserves + 3);
  assert.equal(player(returned, f.owner).tanks, beforePools.tanks - 3);
  assert.equal(player(returned, native).spice, nativeSpice + 1);
  assert.equal(returned.revivalFreeIncome![f.owner], returned.turn);
  assert.equal(returned.techTokens!.axlotl.triggeredTurn, returned.turn);
  assert.equal(returned.techTokens!.axlotl.spice, ownedTech(returned.techTokens!, returned.techTokens!.axlotl.owner!).length);
  const tokens = structuredClone(returned.techTokens);
  const ordinary = allow(applyAction(returned, f.owner, { type: 'revive', amount: 2 }), native);
  assert.equal(player(ordinary, native).spice, nativeSpice + 1, 'Later ordinary free returns cannot award a second bank income');
  assert.deepEqual(ordinary.techTokens, tokens, 'The same physical Axlotl token does not accrue twice this turn');
  assert.equal(player(ordinary, f.owner).revived, 2);
  assert.equal(player(ordinary, f.owner).freeForcesRevived, 2);
  assert.equal(player(ordinary, f.owner).tanks, 3);
  receipt(ordinary, 'returned');
  spent(ordinary, f.owner);
});

void test('native Tleilaxu prior free return earns once; the later extra source does not earn or consume ordinary quota again', () => {
  const f = createNexusEmperorExtraFixture({ advanced: true, profile: 'tleilaxu' });
  const ordinary = allow(applyAction(f.game, f.owner, { type: 'revive', amount: 2 }), f.partner);
  const nativeSpice = player(ordinary, f.partner).spice, before = emperorNexusPools(player(ordinary, f.owner));
  const declared = applyAction(ordinary, f.owner, grant(ordinary, f.owner));
  receipt(declared, 'requested');
  const extra = allow(declared, f.partner);
  assert.deepEqual(emperorNexusPools(player(extra, f.owner)), { ...before, reserves: before.reserves + 3, tanks: before.tanks - 3 });
  assert.equal(player(extra, f.partner).spice, nativeSpice);
  assert.equal(forceRevivalRemaining(extra, player(extra, f.owner)), 1);
  const price = forceRevivalQuote(extra, player(extra, f.owner), 1);
  assert.equal(price.free, 0);
  const paid = allow(applyAction(extra, f.owner, { type: 'revive', amount: 1 }), f.partner);
  assert.equal(player(paid, f.owner).spice, player(extra, f.owner).spice - price.cost);
  assert.equal(player(paid, f.partner).spice, nativeSpice + price.cost);
  assert.equal(player(paid, f.owner).revived, 3);
  assert.equal(player(paid, f.owner).freeForcesRevived, 2);
  receipt(paid, 'returned');
  spent(paid, f.owner);
});

void test('native Tleilaxu Prevent spends the actual two cards with no Nexus refund, force return, Tech accrual or income', () => {
  const f = createNexusEmperorExtraFixture({ advanced: true, profile: 'tleilaxu', tech: true });
  const before = emperorNexusPools(player(f.game, f.owner)), nativeSpice = player(f.game, f.partner).spice;
  const karama = player(f.game, f.partner).hand.find(card => card.effect === 'karama');
  assert.ok(karama);
  const declared = applyAction(f.game, f.owner, grant(f.game, f.owner));
  receipt(declared, 'requested');
  const denied = settleNexusEmperorExtra(applyAction(declared, f.partner, { type: 'card', card: karama.id, mode: 'special' }));
  const record = receipt(denied, 'denied');
  assert.deepEqual(record.after, before);
  assert.deepEqual(emperorNexusPools(player(denied, f.owner)), before);
  assert.equal(player(denied, f.partner).spice, nativeSpice);
  assert.equal(player(denied, f.partner).specialKaramaUsed, true);
  assert.equal(denied.discard.filter(card => card.id === karama.id).length, 1);
  assert.ok(!player(denied, f.partner).hand.some(card => card.id === karama.id));
  assert.deepEqual(denied.techTokens, f.game.techTokens);
  assert.deepEqual(denied.revivalFreeIncome, f.game.revivalFreeIncome);
  assert.deepEqual(denied.emperorExtra, f.game.emperorExtra);
  assert.equal(denied.pendingRevival, null);
  assert.equal(denied.decision, null);
  assert.equal(denied.response, null);
  assert.ok(revivalPrevented(denied, f.owner));
  rejected(denied, f.owner, { type: 'revive', amount: 1 });
  spent(denied, f.owner);
  const next = advanceNexusEmperorExtra(denied, state => state.turn === 3 && state.phase === 4 && nexusEmperorExtraClean(state));
  assert.equal(player(next, f.owner).tanks, before.tanks);
  assert.equal(revivalPrevented(next, f.owner), false);
  receipt(next, 'denied');
  spent(next, f.owner);
});

void test('Basic native Tleilaxu returns the extra source without an Advanced stop but keeps real once-only free income', () => {
  const f = createNexusEmperorExtraFixture({ advanced: false, profile: 'tleilaxu' });
  const nativeSpice = player(f.game, f.partner).spice;
  const declared = applyAction(f.game, f.owner, grant(f.game, f.owner));
  assert.notEqual(declared.decision?.kind, 'revivalStop');
  const extra = settleNexusEmperorExtra(declared);
  receipt(extra, 'returned');
  assert.equal(player(extra, f.owner).tanks, 5);
  assert.equal(player(extra, f.owner).revived, 0);
  assert.equal(player(extra, f.owner).freeForcesRevived, 0);
  assert.equal(player(extra, f.partner).spice, nativeSpice + 1);
  const ordinary = settleNexusEmperorExtra(applyAction(extra, f.owner, { type: 'revive', amount: 2 }));
  assert.equal(player(ordinary, f.partner).spice, nativeSpice + 1);
  assert.equal(player(ordinary, f.owner).revived, 2);
  assert.equal(player(ordinary, f.owner).freeForcesRevived, 2);
  receipt(ordinary, 'returned');
  spent(ordinary, f.owner);
});

void test('the saved native stop cannot replay a different or repriced independent source', () => {
  const f = createNexusEmperorExtraFixture({ advanced: true, profile: 'tleilaxu' });
  const requested = applyAction(f.game, f.owner, grant(f.game, f.owner));
  for (const mutate of [
    (game: Game) => { game.pendingRevival!.amount = 4; },
    (game: Game) => { game.pendingRevival!.cost = 1; },
    (game: Game) => { game.pendingRevival!.nexusEmperorEvent = 'different-source'; },
    (game: Game) => { game.nexusEmperorSecretHistory![0].signature = 'unsigned'; },
  ]) {
    const changed = structuredClone(requested);
    mutate(changed);
    rejected(changed, f.partner, { type: 'decision', decline: true });
  }
  assert.equal(player(requested, f.owner).tanks, 8);
  receipt(requested, 'requested');
  spent(requested, f.owner);
});

void test('original bot policy applies a legal independent Emperor grant on the genuine native chronology', () => {
  const f = createNexusEmperorExtraFixture({ advanced: true });
  const view = viewGame(f.game, f.owner);
  view.players.find(seat => seat.id === f.owner)!.bot = 'Easy';
  const [action] = botActions(view);
  assert.ok(action);
  const returned = settleNexusEmperorExtra(applyAction(f.game, f.owner, action));
  receipt(returned, 'returned');
  assert.equal(player(returned, f.owner).tanks, player(f.game, f.owner).tanks - 3);
  assert.equal(player(returned, f.owner).revived, 0);
  spent(returned, f.owner);
});

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} actual Nexus-returned Fedaykin deploys once through its original Homeworld continuation`, () => {
    const f = createNexusEmperorExtraFixture({ advanced, profile: 'fremen', homeworlds: true });
    const before = structuredClone(player(f.game, f.owner));
    const nativeBefore = player(f.game, f.partner).spice;
    let game = applyAction(f.game, f.owner, grant(f.game, f.owner, 1));
    if (game.decision?.kind === 'revivalStop')
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    assert.equal(player(game, f.owner).tanks, before.tanks - 3);
    assert.equal(player(game, f.owner).reserves, before.reserves + 3);
    assert.equal(player(game, f.owner).elites!.tanks, 0);
    assert.equal(player(game, f.owner).elites!.revived, 1);
    assert.equal(player(game, f.owner).revived, 0);
    assert.equal(player(game, f.owner).freeForcesRevived, 0);
    receipt(game, 'returned');
    const view = viewGame(game, f.owner);
    const target = view.homeworldRevivalDeployment?.destinations.find(option => !option.blocked);
    assert.ok(target);
    const action = homeworldRevivalDeploymentChoice(view, target.id).action;
    assert.ok(action);
    const originalStars = player(game, f.owner).elites!.forces[target.id] ?? 0;
    const placed = settleNexusEmperorExtra(applyAction(game, f.owner, action));
    assert.equal(player(placed, f.owner).elites!.forces[target.id], originalStars + 1);
    assert.equal(player(placed, f.owner).reserves, before.reserves + 2);
    assert.equal(player(placed, f.owner).spice, before.spice);
    assert.equal(player(placed, f.owner).revived, 0);
    assert.equal(player(placed, f.owner).freeForcesRevived, 0);
    assert.equal(player(placed, f.partner).spice, nativeBefore + 1);
    receipt(placed, 'returned');
    rejected(placed, f.owner, action);
    spent(placed, f.owner);
  });
}
