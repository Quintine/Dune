import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { auditCandidates } from '../game/choam-auditor';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { semutaHomeworldWinnerStock as stock } from './fixture-semuta-homeworld-battle-winner';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldChoamBattleKaramaFixture as create,
  disposeSemutaHomeworldChoamBattleKarama as dispose,
  reactSemutaHomeworldChoamBattleKarama as react,
  finishSemutaHomeworldChoamBattleKarama as finish,
  type SemutaHomeworldChoamBattleKaramaFixture,
} from './fixture-semuta-homeworld-choam-battle-karama';

function resources(game: Game) {
  return { custody: structuredClone(game.homeworlds?.custody),
    players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves,
      tanks: p.tanks, forces: structuredClone(p.forces), elites: structuredClone(p.elites),
      leaders: structuredClone(p.leaders), battleLosses: p.battleLosses,
      revived: p.revived, freeForcesRevived: p.freeForcesRevived, ally: p.ally })) };
}

function assertOriginalEconomics(f: SemutaHomeworldChoamBattleKaramaFixture) {
  assert.equal(f.setup.advanced, true);
  assert.deepEqual(stock(f.game), [...treacheryDeck(['choam']), ...richeseCards()].map(c => c.id).sort());
  for (const [index, amount] of [4, 1].entries()) {
    const shipment = f.shipments[index];
    assert.equal(player(shipment.before, shipment.actor).spice, 10);
    assert.equal(player(shipment.after, shipment.actor).spice, 10 - 2 * amount);
    assert.equal(player(shipment.after, shipment.actor).reserves, player(shipment.before, shipment.actor).reserves - amount);
    assert.equal(player(shipment.after, shipment.actor).forces[f.location], amount);
    assert.deepEqual(player(shipment.after, 'a').forces, player(f.setup, 'a').forces);
    assert.deepEqual(player(shipment.after, 'r').forces, player(f.setup, 'r').forces);
  }
  const state = f.acceptedBattle, battle = state.battle!;
  const combatant = (id: string): ResolutionCombatant => {
    const p = player(state, id), plan = battle.plans[id];
    return { id, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
      plan, leader: p.leaders.find(l => l.id === plan.leader),
      forces: { normal: p.forces[f.location], elite: 0, normalFixedHalf: false,
        eliteStrength: 2, freeSupport: false } };
  };
  const quote = quoteBattleResolution({ advanced: true, typedCasualties: true,
    turn: state.turn, territory: battle.territory,
    attacker: combatant(battle.attacker), defender: combatant(battle.defender),
    voters: viewGame(state, state.host).battle!.traitorVoters.map(id => ({ id,
      beneficiary: id, called: false, traitors: player(state, id).traitors })),
    participants: state.players, physicalCards: [state.deck, state.discard,
      state.richeseCache ?? [], state.richeseRemoved ?? [], ...state.players.map(p => p.hand)].flat(),
    pendingAuditorPresent: false, pendingRetentionPresent: false });
  assert.equal(quote.result, 'normal');
  assert.equal(quote.winner, f.canceller);
  assert.deepEqual(quote.payments.find(p => p.player === f.canceller), {
    player: f.canceller, cost: 2, ownPayment: 2, allyPayment: 0,
    donor: null, bankSupport: 0, freeByTraitor: false });
  assert.equal(quote.payments.find(p => p.player === f.owner)!.ownPayment, 0);
  assert.deepEqual(quote.choamIncome, { owner: f.owner, amount: 1 });
  assert.deepEqual(f.nativeIncome.pendingChoamBattleIncome, quote.choamIncome);
  assert.equal(player(f.afterPaidBattle, f.canceller).spice, 2 - 2 + (quote.bounty?.amount ?? 0));
  assert.equal(player(f.afterPaidBattle, f.canceller).forces[f.location], 2);
  assert.equal(player(f.afterPaidBattle, f.canceller).tanks, player(f.beforeBattle, f.canceller).tanks + 2);
  assert.equal(player(f.afterPaidBattle, f.owner).forces[f.location] ?? 0, 0);
  assert.equal(player(f.afterPaidBattle, f.owner).tanks, player(f.beforeBattle, f.owner).tanks + 1);
  assert.deepEqual(f.afterPaidBattle.lastBattle, [f.canceller, f.owner]);
  assert.equal(f.afterPaidBattle.lastBattleContext!.winner, f.canceller);
  assert.equal(player(f.afterPaidBattle, f.canceller).leaders.find(l => l.id === f.winnerLeader)!.strength, 6);
  assert.equal(player(f.afterPaidBattle, f.owner).leaders.find(l => l.id === f.loserLeader)!.dead, f.scope === 'audit');
  if (f.scope === 'audit') {
    assert.deepEqual(quote.bounty, { player: f.canceller, amount: 2 });
    assert.equal(f.game.pendingAuditor!.survived, false);
    assert.equal(player(f.game, f.owner).spice, 9);
    assert.equal(player(f.nativeIncome, f.owner).spice, 8);
    assert.deepEqual(f.usedIds, [f.projectile]);
    assert.ok(player(f.game, f.canceller).hand.some(c => c.id === f.projectile));
    assert.deepEqual(auditCandidates(player(f.game, f.canceller).hand, f.usedIds).map(c => c.id).sort(),
      [f.card, f.unplayedPrivateCard].sort());
    assert.equal(viewGame(f.game, f.owner).auditor?.count, 1);
  }
}

function assertDenied(f: SemutaHomeworldChoamBattleKaramaFixture, game: Game, claim: boolean) {
  assert.ok(!game.pendingTreacheryDiscard);
  assert.ok(!game.pendingChoamBattleIncome);
  assert.ok(!game.pendingAuditor);
  assert.ok(!game.auditorInsight);
  assert.ok(!game.response);
  assert.equal(game.decision?.kind, 'choamMarket');
  assert.equal(game.decision!.player, f.owner);
  assert.deepEqual(resources(game), resources(f.gameBeforeCost));
  assert.deepEqual(stock(game), stock(f.setup));
  assert.deepEqual(game.lastBattleContext, f.gameBeforeCost.lastBattleContext);
  assert.equal(player(game, f.owner).spice, f.scope === 'income' ? 8 : 9);
  assert.equal(player(game, f.canceller).spice, f.scope === 'income' ? 0 : 2);
  assert.equal(player(game, f.canceller).hand.some(c => c.id === f.card), false);
  assert.equal(player(game, f.holder).hand.some(c => c.id === f.card), claim);
  assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
  assert.equal(game.discard.filter(c => c.id === f.card).length, Number(!claim));
  assert.equal(game.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, Number(claim));
  assert.ok(player(game, f.canceller).hand.some(c => c.id === f.unplayedPrivateCard));
  if (f.projectile) assert.ok(player(game, f.canceller).hand.some(c => c.id === f.projectile));
  if (f.snooper) assert.equal(game.discard.filter(c => c.id === f.snooper).length, 1);
  assert.throws(() => applyAction(game, f.canceller, f.action));
  if (f.declaration) assert.throws(() => applyAction(game, f.owner, f.declaration!));
  if (claim) assert.throws(() => applyAction(game, f.holder, f.action), 'Recovered Karama cannot replay a completed reward');
}

function assertCollection(f: SemutaHomeworldChoamBattleKaramaFixture, state: Game) {
  const completed = finish(state);
  assert.equal(completed.beforeCollection.decision!.player, f.owner);
  assert.equal(completed.game.phase, 7);
  assert.equal(completed.game.turn, state.turn);
  for (const receipt of completed.collection.receipts)
    assert.equal(player(completed.game, receipt.player).spice, receipt.balance);
  assert.equal(completed.collection.receipts.find(r => r.player === f.canceller)!.collected, 4);
  assert.equal(player(completed.game, f.owner).spice, f.scope === 'income' ? 8 : 9);
  assert.deepEqual(completed.game.spice, completed.collection.spice);
  assert.deepEqual(stock(completed.game), stock(state));
  for (const seat of completed.game.players) {
    assert.deepEqual(seat.forces, player(state, seat.id).forces);
    assert.equal(seat.reserves, player(state, seat.id).reserves);
    assert.equal(seat.tanks, player(state, seat.id).tanks);
  }
  assert.throws(() => applyAction(completed.game, completed.actor, completed.action), 'Original market close cannot credit Collection twice');
}

for (const scope of ['income', 'audit'] as const) {
  for (const full of [false, true]) for (const claim of [false, true])
    void test(`Advanced Homeworld CHOAM ${scope}: ${full ? 'full' : 'thin'} Richese ${claim ? 'claims' : 'passes'} paid Emperor Karama before native denial`, () => {
      const f = create(scope, full);
      assertOriginalEconomics(f);
      const pending = dispose(f), cost = pending.pendingTreacheryDiscard;
      assert.ok(cost, 'Actual printed cancellation cost pauses before denying the original reward');
      assert.equal(cost.continuation.kind, 'karamaBattleDiscard');
      assert.deepEqual(cost.batch.entries.map(c => ({ card: c.card.id, owner: c.discardedBy })), [{ card: f.card, owner: f.canceller }]);
      assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
      assert.deepEqual(resources(pending), resources(f.gameBeforeCost));
      assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
      assert.throws(() => applyAction(pending, f.canceller, f.action));
      assert.throws(() => applyAction(pending, f.owner, { type: 'decision', done: true }));
      assert.throws(() => applyAction(pending, f.owner, { type: 'ready' }));
      assert.throws(() => applyAction(pending, f.owner, { type: 'semutaCommit', event: cost.batch.event }));
      assert.throws(() => applyAction(pending, f.holder, { type: 'semutaCommit', event: `${cost.batch.event}-stale` }));
      const done = react(pending, f.holder, claim);
      assertDenied(f, done, claim);
      if (full) assert.equal(player(done, f.holder).hand.length, handLimit(player(done, f.holder)));
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: cost.batch.event }));
      assert.throws(() => applyAction(done, f.owner, { type: 'semutaPass', event: cost.batch.event }));
      assertCollection(f, done);
    });

  for (const full of [false, true]) void test(`Advanced Homeworld CHOAM ${scope}: ${full ? 'full' : 'thin'} private original Semuta entitlement never leaks to other seats`, () => {
    const f = create(scope, full), pending = dispose(f);
    const neutral = dispose(f, withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder));
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of pending.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(viewGame(pending, seat.id), viewGame(neutral, seat.id));
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(pending, seat.id, { type: 'semutaCommit', event: pending.pendingTreacheryDiscard!.batch.event }));
    }
    const claimed = react(pending, f.holder, true), passed = react(neutral, f.holder, false);
    assertDenied(f, claimed, true);
    assert.ok(!passed.pendingTreacheryDiscard && !passed.response && !passed.pendingAuditor && !passed.auditorInsight);
    assert.equal(passed.decision?.kind, 'choamMarket');
    assert.equal(passed.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(player(passed, f.holder).hand.some(c => c.id === f.card), false);
    assert.deepEqual(resources(claimed), resources(passed));
    if (scope === 'audit') {
      assert.deepEqual(auditCandidates(player(claimed, f.canceller).hand, f.usedIds).map(c => c.id), [f.unplayedPrivateCard]);
      assert.ok(!viewGame(claimed, f.owner).auditor);
      assert.ok(!viewGame(claimed, f.owner).auditorInsight);
    }
    assertCollection(f, claimed);
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty} legally handles Advanced Homeworld ${scope} cancellation then original CHOAM market`, () => {
    const f = create(scope), pending = dispose(f), own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action && (action.type === 'semutaCommit' || action.type === 'semutaPass'));
    let game = applyAction(pending, f.holder, action);
    if (game.pendingTreacheryDiscard) game = react(game, f.holder, false);
    assertDenied(f, game, action.type === 'semutaCommit');
    const closing = viewGame(game, f.owner);
    closing.players.find(p => p.id === f.owner)!.bot = difficulty;
    const close = botActions(closing)[0];
    assert.ok(close);
    const collection = quoteSpiceCollection(game);
    const completed = applyAction(game, f.owner, close);
    assert.equal(completed.phase, 7);
    assert.equal(player(completed, f.owner).spice, f.scope === 'income' ? 8 : 9);
    assert.equal(player(completed, f.canceller).forces[f.location], 2);
    assert.equal(player(completed, f.owner).tanks, 1);
    for (const receipt of collection.receipts)
      assert.equal(player(completed, receipt.player).spice, receipt.balance);
    assert.deepEqual(completed.spice, collection.spice);
    assert.deepEqual(completed.lastBattleContext, game.lastBattleContext);
  });
}
