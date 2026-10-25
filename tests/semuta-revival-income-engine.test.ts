import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaRevivalIncomeFixture as fixture, actSemutaRevivalIncome as act,
  advanceSemutaRevivalIncome as advance, passSemutaRevivalIncome as pass,
  claimSemutaRevivalIncome as claim, allowSemutaRevivalIncome as allow,
  semutaRevivalIncomeClean as clean, semutaRevivalIncomePlayer as player,
  semutaRevivalIncomeInventory as inventory, type SemutaRevivalIncomeFixture,
} from './fixture-semuta-revival-income';

/** Include the accepted revival's physical, cash and allowance history. Hand
 * changes are checked separately for the exact two-card Semuta exchange. */
const completed = (game: Game) => ({ turn: game.turn, phase: game.phase, order: game.order,
  active: game.active, ready: game.ready, pendingRevival: game.pendingRevival,
  revivalRules: game.revivalRules, revivalFreeIncome: game.revivalFreeIncome,
  freeRevival: game.freeRevival, emperorExtra: game.emperorExtra, revivalRequests: game.revivalRequests,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, tanks: p.tanks,
    forces: p.forces, elites: p.elites, revived: p.revived, freeForcesRevived: p.freeForcesRevived,
    leaderRevived: p.leaderRevived, revivalCycle: p.revivalCycle, leaders: p.leaders,
    shipped: p.shipped, moved: p.moved, ally: p.ally })) });
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaRevivalIncomeFixture) {
  assert.equal(f.setup.advanced, f.advanced); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(f.afterSetup, f.recipient).hand.some(card => card.id === f.ghola));
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(player(f.shipment.before, f.recipient).spice - player(f.shipment.after, f.recipient).spice, 4);
  assert.ok(f.shipment.steps.some(step => step.actor === f.recipient && step.action.type === 'ship' && step.action.amount === 2));
  assert.equal(player(f.shipment.after, f.recipient).forces['cielago_north:1'], 2);
  assert.equal(f.storm.before.storm, 18); assert.equal(player(f.storm.before, f.recipient).tanks, 0);
  assert.equal(player(f.storm.after, f.recipient).tanks, 2);
  assert.equal(player(f.storm.after, f.recipient).forces['cielago_north:1'] ?? 0, 0);
  assert.equal(player(f.beforeRevival, f.recipient).tanks, 2);
  assert.equal(player(f.game, f.recipient).tanks, 0);
  assert.equal(player(f.game, f.recipient).reserves - player(f.beforeRevival, f.recipient).reserves, 2);
  assert.equal(f.game.response?.kind, 'revivalIncome'); assert.equal(f.game.response?.owner, f.incomeOwner);
  assert.equal(f.game.response?.recipient, f.recipient); assert.equal(f.game.response?.amount, f.amount);
  assert.equal(f.amount, f.kind === 'ordinary' ? 3 : 1);
  assert.ok(!f.game.pendingRevival && !f.game.pendingChoamMarketGhola && !f.game.pendingAmbassador && !f.game.battle);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  if (f.kind === 'ordinary') {
    assert.equal(player(f.beforeRevival, f.recipient).spice - player(f.game, f.recipient).spice, 2);
    assert.equal(player(f.game, f.recipient).revived, 2); assert.equal(player(f.game, f.recipient).freeForcesRevived, 1);
    assert.equal(f.game.revivalFreeIncome?.[f.recipient], f.game.turn);
    assert.ok(player(f.game, f.recipient).hand.some(card => card.id === f.ghola));
  } else {
    assert.equal(player(f.game, f.recipient).spice, player(f.beforeRevival, f.recipient).spice);
    assert.equal(player(f.game, f.recipient).revived, 0); assert.equal(player(f.game, f.recipient).freeForcesRevived ?? 0, 0);
    assert.equal(f.game.revivalFreeIncome?.[f.recipient], undefined);
    assert.ok(f.gholaDiscard); assert.equal(f.gholaDiscard.steps.length, f.game.players.length);
    assert.ok(f.gholaDiscard.steps.every(step => step.action.type === 'semutaPass'));
    assert.deepEqual(new Set(f.gholaDiscard.steps.map(step => step.actor)), new Set(f.game.players.map(p => p.id)));
    assert.equal(f.game.discard.filter(card => card.id === f.ghola).length, 1);
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaRevivalIncomeFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.continuation.kind, 'karamaIncomeDiscard');
  if (pending.continuation.kind !== 'karamaIncomeDiscard') throw Error('Expected the original income cancellation cost');
  assert.equal(pending.continuation.use.response.kind, 'revivalIncome');
  assert.deepEqual(pending.continuation.use.response, f.game.response);
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.equal(game.response, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(completed(game), completed(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true); return game;
}
function denied(game: Game, f: SemutaRevivalIncomeFixture, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard); assert.equal(game.response, null); assert.ok(!game.pendingRevival);
  assert.deepEqual(completed(game), completed(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(player(game, f.incomeOwner).spice, player(f.game, f.incomeOwner).spice);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.kind === 'ghola') assert.equal(game.discard.filter(card => card.id === f.ghola).length, 1);
  reject(game, f.recipient, f.revivalAction); reject(game, f.spender, f.action);
  return game;
}

for (const advanced of [false, true]) for (const kind of ['ordinary', 'ghola'] as const)
  for (const claimed of [false, true]) void test(
    `${advanced ? 'Advanced' : 'Basic'} native ${kind} revival-income cost Semuta ${claimed ? 'claim' : 'pass'} preserves completed returns, payment and quotas`, () => {
      const f = fixture({ advanced, kind }); nativeSource(f);
      const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
      const game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
      reject(game, f.holder, { type: 'semutaCommit', event });
      const before = player(game, f.incomeOwner).spice;
      const next = advance(game, state => state.phase === 5 && clean(state));
      assert.equal(player(next, f.incomeOwner).spice, before);
      assert.equal(player(next, f.recipient).tanks, 0);
      assert.equal(player(next, f.recipient).reserves, player(game, f.recipient).reserves);
      assert.equal(player(next, f.recipient).spice, player(game, f.recipient).spice);
      assert.equal(player(next, f.recipient).revived, player(game, f.recipient).revived);
      assert.equal(player(next, f.recipient).freeForcesRevived, player(game, f.recipient).freeForcesRevived);
      assert.deepEqual(next.revivalFreeIncome, game.revivalFreeIncome);
      assert.deepEqual(inventory(next), f.originalInventory);
    },
  );

void test('native revival-income allowance credits the actual ordinary or Ghola amount once without another return or payment', () => {
  for (const kind of ['ordinary', 'ghola'] as const) {
    const f = fixture({ kind }), before = player(f.game, f.incomeOwner).spice, game = allow(structuredClone(f.game));
    assert.equal(game.response, null); assert.ok(!game.pendingRevival && !game.pendingTreacheryDiscard);
    assert.equal(player(game, f.incomeOwner).spice, before + f.amount);
    assert.deepEqual(player(game, f.recipient), player(f.game, f.recipient));
    assert.deepEqual(game.revivalFreeIncome, f.game.revivalFreeIncome);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.incomeOwner, { type: 'passResponse' });
  }
});

void test('native income-cost reactions reject stale, foreign and underlying replies including the already declined Ghola batch', () => {
  for (const kind of ['ordinary', 'ghola'] as const) {
    const f = fixture({ kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.incomeOwner, { type: 'passResponse' });
    reject(game, f.recipient, f.revivalAction);
    if (f.gholaDiscard) reject(game, f.holder, { type: 'semutaCommit', event: f.gholaDiscard.before.pendingTreacheryDiscard!.batch.event });
    denied(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer actual ordinary and Ghola revival-income cancellation costs', () => {
  for (const advanced of [false, true]) for (const kind of ['ordinary', 'ghola'] as const) {
    const f = fixture({ advanced, kind }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});
