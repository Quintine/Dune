import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaRevivalBenefitsLeadersFixture as fixture, actSemutaRevivalBenefitsLeaders as act,
  passSemutaRevivalBenefitsLeaders as pass, claimSemutaRevivalBenefitsLeaders as claim,
  allowSemutaRevivalBenefitsLeaders as allow, finishSemutaRevivalBenefitsLeaders as finish,
  semutaRevivalBenefitsLeadersPlayer as player, semutaRevivalBenefitsLeadersInventory as inventory,
  type SemutaRevivalBenefitsLeadersFixture,
} from './fixture-semuta-revival-benefits-leaders';

const variants = [
  { kind: 'earlyRevival' as const, advanced: false }, { kind: 'earlyRevival' as const, advanced: true },
  { kind: 'revivalDiscount' as const, advanced: false }, { kind: 'revivalDiscount' as const, advanced: true },
  { kind: 'foreignGhola' as const, advanced: true },
];
const forceQuotas = (game: Game) => game.players.map(p => ({ id: p.id, reserves: p.reserves, tanks: p.tanks,
  forces: p.forces, elites: p.elites, moved: p.moved, shipped: p.shipped, revived: p.revived,
  freeForcesRevived: p.freeForcesRevived }));
const unpaid = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  forceQuotas: forceQuotas(game), revivalFreeIncome: game.revivalFreeIncome,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, leaders: p.leaders,
    revivalCycle: p.revivalCycle, leaderRevived: p.leaderRevived, gholaBlocked: p.gholaBlocked })),
  pending: game.pendingRevival, rules: game.revivalRules });
function leader(game: Game, id: string) {
  const found = game.players.flatMap(p => p.leaders).find(l => l.id === id); assert.ok(found); return found;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaRevivalBenefitsLeadersFixture) {
  assert.equal(f.setup.advanced, f.advanced); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.setup.semutaPreview, true); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(player(f.afterSetup, f.owner).hand[0].kind, 'poison');
  assert.equal(player(f.afterSetup, f.opponent).hand[0].kind, 'poison');
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  for (const shipment of f.shipments) {
    assert.equal(player(shipment.before, shipment.actor).spice - player(shipment.after, shipment.actor).spice, 2);
    assert.equal(player(shipment.after, shipment.actor).forces[f.location], 1);
    assert.ok(shipment.steps.some(step => step.action.type === 'ship' && step.action.amount === 1));
  }
  assert.ok(f.planSteps.every(step => step.action.dial === 0 && step.action.support === 0 && step.action.defense === null));
  const votes = f.battleResolution.filter(step => step.action.type === 'traitorCall');
  assert.equal(votes.length, 2); assert.ok(votes.every(step => step.action.call === false));
  assert.deepEqual(new Set(votes.map(step => step.actor)), new Set([f.owner, f.opponent]));
  assert.equal(leader(f.afterBattle, f.ownLeader).dead, true); assert.equal(leader(f.afterBattle, f.ownLeader).deaths, 1);
  assert.equal(leader(f.afterBattle, f.foreignLeader).dead, true); assert.equal(leader(f.afterBattle, f.foreignLeader).deaths, 1);
  assert.equal(f.afterBattle.lastBattleContext?.winner, f.owner);
  assert.equal(player(f.afterBattle, f.owner).forces[f.location], 1);
  assert.equal(player(f.afterBattle, f.opponent).tanks, 1);
  const played = f.planSteps.map(step => String(step.action.weapon)).sort();
  assert.deepEqual(f.disposals.flatMap(disposal => disposal.cards).sort(), played);
  assert.ok(f.disposals.every(disposal => disposal.steps.every(step => step.action.type === 'semutaPass')));
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4); assert.ok(!f.game.battle);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.response?.recipient, f.recipient); assert.deepEqual(f.game.pendingRevival, f.pending);
  assert.equal(player(f.game, f.payer).spice, player(f.beforeRequest, f.payer).spice);
  assert.ok(player(f.game, f.payer).spice >= f.normalCost);
  assert.equal(leader(f.game, f.targetLeader).dead, true); assert.equal(leader(f.game, f.ownLeader).dead, true);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  if (f.kind === 'revivalDiscount') {
    assert.ok(f.priorEarly); assert.equal(f.priorEarly.before.response?.kind, 'earlyRevival');
    assert.ok(f.priorEarly.steps.every(step => step.action.type === 'passResponse'));
    assert.equal(f.priorEarly.after.response?.kind, 'revivalDiscount');
    assert.equal(f.discountedCost, 1); assert.equal(f.normalCost, 2); assert.equal(f.expected.outcome, 'revive');
    assert.equal(f.expected.pending?.cost, 2);
  } else assert.equal(f.expected.outcome, 'abandoned');
  if (f.kind === 'foreignGhola') {
    assert.equal(f.advanced, true); assert.equal(f.targetLeader, f.foreignLeader);
    assert.equal(player(f.game, f.owner).leaders.filter(l => !l.dead).length, 4);
    assert.equal(leader(f.game, f.foreignLeader).gholaBy, undefined);
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaRevivalBenefitsLeadersFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.continuation.kind, 'karamaRevivalDiscard');
  if (pending.continuation.kind !== 'karamaRevivalDiscard') throw Error('Expected the original unpaid revival-benefit cost');
  assert.deepEqual(pending.continuation.use.response, f.game.response);
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.equal(game.response, null); assert.deepEqual(unpaid(game), unpaid(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory); assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  return game;
}
function denied(state: Game, f: SemutaRevivalBenefitsLeadersFixture, claimed: boolean) {
  const game = finish(state);
  assert.ok(!game.pendingTreacheryDiscard); assert.equal(game.pendingRevival ?? null, null);
  assert.equal(game.response, null); assert.equal(game.phase, 4); assert.equal(game.turn, 2);
  assert.deepEqual(game.revivalRules, f.expected.rules); assert.deepEqual(forceQuotas(game), forceQuotas(f.game));
  assert.deepEqual(game.revivalFreeIncome, f.game.revivalFreeIncome);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  for (const p of f.game.players.filter(p => p.id !== f.payer)) assert.equal(player(game, p.id).spice, p.spice);
  const returns = f.expected.outcome === 'revive';
  assert.equal(player(game, f.payer).spice, player(f.game, f.payer).spice - (returns ? f.expected.pending!.cost : 0));
  assert.equal(leader(game, f.targetLeader).dead, !returns); assert.equal(leader(game, f.targetLeader).deaths, 1);
  assert.equal(player(game, f.owner).leaderRevived, returns);
  if (f.kind === 'earlyRevival') assert.ok(game.revivalRules!.earlyBlocked.includes(`${f.owner}:${f.targetLeader}`));
  if (f.kind === 'foreignGhola') {
    assert.equal(player(game, f.owner).gholaBlocked?.[f.targetLeader], game.turn);
    assert.equal(leader(game, f.targetLeader).gholaBy, undefined);
  }
  if (f.kind === 'revivalDiscount') {
    assert.equal(game.revivalRules!.fullPrice, true); assert.equal(leader(game, f.foreignLeader).dead, true);
  }
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.owner, f.nativeAction); reject(game, f.spender, f.action); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native leader ${variant.kind} cost Semuta ${claimed ? 'claim' : 'pass'} resumes only the original unpaid request`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native leader benefit allowance pays the original discounted price and returns only the requested disc once', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = finish(allow(structuredClone(f.game)));
    assert.equal(game.pendingRevival ?? null, null); assert.equal(game.response, null);
    assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice - f.discountedCost);
    assert.equal(leader(game, f.targetLeader).dead, false); assert.equal(leader(game, f.targetLeader).deaths, 1);
    assert.equal(player(game, f.owner).leaderRevived, true); assert.deepEqual(forceQuotas(game), forceQuotas(f.game));
    assert.equal(leader(game, f.targetLeader).gholaBy ?? null, f.kind === 'foreignGhola' ? f.owner : null);
    if (f.kind === 'foreignGhola') assert.equal(leader(game, f.ownLeader).dead, true);
    else assert.equal(leader(game, f.foreignLeader).dead, true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.owner, f.nativeAction);
  }
});

void test('native leader revival-cost reactions reject stale, foreign and underlying replies before repricing or return', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, { type: 'passResponse' });
    for (const disposal of f.disposals)
      reject(game, f.holder, { type: 'semutaCommit', event: disposal.before.pendingTreacheryDiscard!.batch.event });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally answer native leader early, discount and foreign-Ghola revival costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
