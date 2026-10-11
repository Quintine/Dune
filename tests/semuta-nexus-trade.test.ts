import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaNexusTradeFixture, claimSemutaNexusTrade, finishSemutaNexusTradeCollection,
  nextSemutaNexusTradeNativeStep, passSemutaNexusTrade, semutaNexusTradeInventory,
  semutaNexusTradePlayer, type SemutaNexusTradeFixture,
} from './fixture-semuta-nexus-trade';

function openTrade(f: SemutaNexusTradeFixture): Game {
  assert.equal(f.afterFirstStorm.phase, 1);
  assert.ok(Object.values(f.afterSetup.nexusCards!.cards!.hands).every(card => card === null));
  assert.equal(f.beforeAlliance.turn, 2);
  assert.equal(f.beforeAlliance.nexus, true);
  assert.equal(f.beforeDraw.nexusCards!.phase!.occurred, true);
  assert.equal(f.beforeDraw.nexusCards!.phase!.stage, 'drawing');
  assert.deepEqual([...f.beforeDraw.nexusCards!.phase!.eligible].sort(), [f.holder, f.trader].sort());
  assert.equal(semutaNexusTradePlayer(f.beforeDraw, f.allies[0]).ally, f.allies[1]);
  assert.equal(semutaNexusTradePlayer(f.beforeDraw, f.allies[1]).ally, f.allies[0]);
  assert.equal(f.beforeDraw.nexusCards!.cards!.hands[f.trader], null);
  assert.ok(f.afterDraw.nexusCards!.cards!.hands[f.trader], 'Actual closing draw precedes identity staging');
  assert.ok(f.afterDraw.nexusCards!.phase!.done.includes(f.trader));
  assert.equal(semutaNexusTradePlayer(f.game, f.trader).ally, null);
  assert.ok(!f.game.players.some(p => p.faction === 'choam'));
  assert.equal(f.game.nexusCards!.cards!.hands[f.trader], 'choam');
  assert.equal(f.game.phase, 7);
  const own = viewGame(f.game, f.trader);
  assert.equal(own.nexusChoamTrade!.blocked, null);
  assert.equal(own.nexusChoamTrade!.spice, 2);
  assert.deepEqual(own.nexusChoamTrade!.cards.map(card => card.id), [f.cost.id, f.spare.id]);
  const pending = applyAction(f.game, f.trader, f.action);
  assert.equal(semutaNexusTradePlayer(pending, f.trader).spice, semutaNexusTradePlayer(f.game, f.trader).spice + 2);
  assert.equal(pending.nexusCards!.cards!.hands[f.trader], null);
  assert.deepEqual(pending.nexusCards!.cards!.discard.filter(card => card === 'choam'), ['choam']);
  assert.equal(pending.nexusChoamTrades!.length, 1);
  assert.equal(pending.nexusChoamTrades![0].stage, 'discard');
  assert.equal(pending.pendingTreacheryDiscard!.continuation.kind, 'nexusChoamTrade');
  assert.equal(pending.pendingTreacheryDiscard!.batch.cause, 'nexus:choamTrade');
  assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries,
    [{ card: f.cost, discardedBy: f.trader, publicFace: true }]);
  assert.equal(pending.pendingTreacheryDiscard!.reaction!.stage, 'offer');
  for (const player of pending.players) {
    const reaction = viewGame(pending, player.id).semutaReaction!;
    assert.equal(reaction.event, pending.pendingTreacheryDiscard!.batch.event);
    assert.equal(reaction.canCommit, player.id === f.holder);
    assert.equal(reaction.stage, 'offer');
  }
  return pending;
}
function assertCompletedTrade(f: SemutaNexusTradeFixture, completed: Game, claim: boolean): void {
  const before = semutaNexusTradePlayer(f.game, f.trader), after = semutaNexusTradePlayer(completed, f.trader);
  assert.equal(after.spice, before.spice + 2);
  assert.deepEqual(after.hand.map(card => card.id), [f.spare.id]);
  for (const player of completed.players.filter(p => p.id !== f.trader))
    assert.equal(player.spice, semutaNexusTradePlayer(f.game, player.id).spice, 'Semuta and neutral acknowledgements pay no spice');
  assert.equal(completed.pendingTreacheryDiscard, null);
  assert.equal(completed.nexusChoamTrades!.length, 1);
  assert.equal(completed.nexusChoamTrades![0].stage, 'complete');
  assert.deepEqual(completed.nexusChoamTradeLast, { event: f.action.event, stage: 'complete' });
  assert.equal(completed.resolvedTreacheryDiscardSequence, completed.treacheryDiscardSequence);
  const held = semutaNexusTradePlayer(completed, f.holder).hand;
  assert.equal(held.some(card => card.id === f.cost.id), claim);
  assert.equal(held.some(card => card.id === f.semuta), !claim);
  assert.equal(completed.discard.filter(card => card.id === f.cost.id).length, claim ? 0 : 1);
  assert.equal(completed.discard.filter(card => card.id === f.semuta).length, claim ? 1 : 0);
  assert.equal(completed.nexusCards!.cards!.hands[f.trader], null);
  assert.deepEqual(completed.nexusCards!.cards!.discard.filter(card => card === 'choam'), ['choam']);
  assert.deepEqual(semutaNexusTradeInventory(completed), semutaNexusTradeInventory(f.game));
  assert.ok(![...completed.deck, ...completed.discard, ...completed.players.flatMap(p => p.hand)]
    .some(card => card.id === 'choam'), 'A spent Nexus identity is never a Treachery Card');
  assert.throws(() => applyAction(completed, f.trader, f.action), /current CHOAM Nexus trade|Worthless|trade/i);
  const continued = finishSemutaNexusTradeCollection(completed);
  assert.equal(continued.phase, 8, 'The original Collection readiness completes into Mentat');
  assert.equal(continued.nexusChoamTrades!.length, 1);
  assert.equal(continued.nexusChoamTrades![0].stage, 'complete');
  assert.equal(semutaNexusTradePlayer(continued, f.trader).spice, before.spice + 2);
  const next = nextSemutaNexusTradeNativeStep(continued);
  const moved = applyAction(continued, next.actor, next.action);
  assert.equal(moved.nexusChoamTrades!.length, 1);
  assert.equal(moved.nexusChoamTrades![0].stage, 'complete');
  assert.deepEqual(semutaNexusTradeInventory(moved), semutaNexusTradeInventory(f.game));
}

for (const advanced of [false, true]) {
  for (const claim of [false, true]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} native Secret Ally public Worthless trade ${claim ? 'claim' : 'pass'} resumes its paid receipt once`, () => {
      const f = createSemutaNexusTradeFixture({ advanced }), pending = openTrade(f);
      const completed = claim ? claimSemutaNexusTrade(pending, f) : passSemutaNexusTrade(pending);
      assertCompletedTrade(f, completed, claim);
    });
  }
  void test(`${advanced ? 'Advanced' : 'Basic'} full Richese hand exchanges Semuta for the exact spent Worthless without overflow`, () => {
    const f = createSemutaNexusTradeFixture({ advanced, fullHand: true }), pending = openTrade(f);
    const holder = semutaNexusTradePlayer(f.game, f.holder);
    assert.equal(holder.hand.length, handLimit(holder));
    const completed = claimSemutaNexusTrade(pending, f);
    assert.equal(semutaNexusTradePlayer(completed, f.holder).hand.length, handLimit(holder));
    assert.deepEqual(semutaNexusTradePlayer(completed, f.holder).hand.map(card => card.id).sort(),
      [...holder.hand.filter(card => card.id !== f.semuta).map(card => card.id), f.cost.id].sort());
    assertCompletedTrade(f, completed, true);
  });
  void test(`${advanced ? 'Advanced Tech/Strongholds' : 'Basic Tech'} and explicit original Skills retain native Semuta/Nexus trade behavior`, () => {
    const f = createSemutaNexusTradeFixture({ advanced, tech: true, strongholds: advanced, skills: true });
    const pending = openTrade(f);
    assert.ok(Object.values(f.afterFirstStorm.techTokens!).every(token => token.owner &&
      f.afterFirstStorm.players.some(player => player.id === token.owner)), 'Original first Storm earns token assignment');
    assert.equal(f.game.leaderSkills!.assignments.length, 4);
    const completed = claimSemutaNexusTrade(pending, f);
    assert.deepEqual(completed.leaderSkills, f.game.leaderSkills);
    assert.deepEqual(completed.techTokens, f.game.techTokens);
    assert.deepEqual(completed.strongholdCards, f.game.strongholdCards);
    assertCompletedTrade(f, completed, true);
  });
}

void test('neutral passes retain the public cost and paid original receipt until the final acknowledgement', () => {
  const f = createSemutaNexusTradeFixture(), pending = openTrade(f);
  let game = pending;
  const event = pending.pendingTreacheryDiscard!.batch.event;
  for (const actor of [f.trader, ...f.allies]) {
    game = applyAction(game, actor, { type: 'semutaPass', event });
    assert.equal(game.nexusChoamTrades![0].stage, 'discard');
    assert.equal(game.pendingTreacheryDiscard!.reaction!.stage, 'offer');
    assert.equal(game.discard.filter(card => card.id === f.cost.id).length, 1);
    assert.equal(semutaNexusTradePlayer(game, f.trader).spice, semutaNexusTradePlayer(f.game, f.trader).spice + 2);
  }
  assert.throws(() => applyAction(game, f.trader, { type: 'ready' }), /discard|Semuta|reaction/i);
  game = applyAction(game, f.holder, { type: 'semutaPass', event });
  assertCompletedTrade(f, game, false);
});

for (const difficulty of DIFFICULTIES) {
  void test(`${difficulty} uses the original trade and exact Semuta decisions through the existing bot API`, () => {
    const f = createSemutaNexusTradeFixture({ fullHand: true });
    const tradeView = viewGame(f.game, f.trader);
    tradeView.players.find(p => p.id === f.trader)!.bot = difficulty;
    let game = applyAction(f.game, f.trader, botActions(tradeView)[0]);
    const event = game.pendingTreacheryDiscard!.batch.event;
    for (const actor of [f.trader, ...f.allies]) {
      const view = viewGame(game, actor);
      view.players.find(p => p.id === actor)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.deepEqual(action, { type: 'semutaPass', event });
      game = applyAction(game, actor, action);
    }
    const own = viewGame(game, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const commit = botActions(own)[0];
    assert.deepEqual(commit, { type: 'semutaCommit', event });
    game = applyAction(game, f.holder, commit);
    assertCompletedTrade(f, game, true);
  });
}
