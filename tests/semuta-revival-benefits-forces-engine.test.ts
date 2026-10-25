import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { location } from '../game/board';
import { quoteRevivalCancellation } from '../game/revival-cancellation';
import {
  createSemutaRevivalBenefitsForcesFixture as fixture, actSemutaRevivalBenefitsForces as act,
  passSemutaRevivalBenefitsForces as pass, claimSemutaRevivalBenefitsForces as claim,
  allowSemutaRevivalBenefitsForces as allow, finishSemutaRevivalBenefitsForces as finish,
  semutaRevivalBenefitsForcesPlayer as player, semutaRevivalBenefitsForcesInventory as inventory,
  type SemutaRevivalBenefitsForcesFixture,
} from './fixture-semuta-revival-benefits-forces';

const variants = [
  { kind: 'choamRevival' as const, advanced: false },
  { kind: 'choamRevival' as const, advanced: true },
  { kind: 'revivalLimit' as const, advanced: false },
  { kind: 'revivalLimit' as const, advanced: true },
  { kind: 'revivalDiscount' as const, advanced: false },
  { kind: 'revivalDiscount' as const, advanced: true },
  { kind: 'choamRevival' as const, advanced: false, amount: 4 },
  { kind: 'revivalDiscount' as const, advanced: false, unfunded: true },
];
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order, ready: game.ready,
  revivalRules: game.revivalRules, freeRevival: game.freeRevival, revivalFreeIncome: game.revivalFreeIncome,
  emperorExtra: game.emperorExtra, revivalRequests: game.revivalRequests,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    revived: player.revived, freeForcesRevived: player.freeForcesRevived,
    leaderRevived: player.leaderRevived, leaders: player.leaders, shipped: player.shipped, moved: player.moved })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaRevivalBenefitsForcesFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.setup.advanced, f.advanced);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(f.firstRevival.storm, 18); assert.equal(player(f.firstRevival, f.atreides).tanks, 0);
  assert.equal(player(f.firstRevival, f.atreides).forces['arrakeen:10'], 10);
  assert.deepEqual(f.actions.filter(step => step.action.type === 'stormDial' &&
    f.actions.indexOf(step) < f.actions.findIndex(action => action.action.type === 'richeseBid'))
    .map(step => Number(step.action.amount)).sort((a, b) => a - b), [0, 17]);
  const destination = location(f.shipmentDestination.territory, f.shipmentDestination.sector);
  const shipped = f.kind === 'revivalLimit' ? 5 : 4;
  assert.equal(player(f.shipment.before, f.recipient).spice - player(f.shipment.after, f.recipient).spice, 2 * shipped);
  assert.equal(player(f.shipment.after, f.recipient).forces[destination], shipped);
  assert.ok(f.shipment.steps.some(step => step.actor === f.recipient && step.action.type === 'ship' && step.action.amount === shipped));
  assert.equal(player(f.storm.before, f.recipient).tanks, 0); assert.equal(player(f.storm.after, f.recipient).tanks, shipped);
  assert.equal(player(f.storm.after, f.recipient).forces[destination] ?? 0, 0);
  assert.equal(f.firstStorm.before.storm, 18);
  if (f.kind !== 'choamRevival') {
    assert.ok(f.financingFunding);
    assert.equal(player(f.financingFunding.before, f.spender).spice - player(f.financingFunding.after, f.spender).spice, 6);
    assert.equal(player(f.financingFunding.after, f.atreides).spice, 10);
    assert.equal(player(f.financingFunding.after, f.atreides).bribes, 6);
    assert.equal(player(f.firstShipment.after, f.atreides).spice, 0);
    assert.equal(player(f.firstShipment.after, f.atreides).forces['cielago_north:1'], 5);
    assert.equal(player(f.firstStorm.before, f.atreides).spice, 6 + (f.advanced ? 2 : 0));
    assert.equal(player(f.firstStorm.before, f.atreides).bribes, 0);
    assert.equal(player(f.firstStorm.after, f.atreides).tanks, 5);
  }
  if (f.kind === 'revivalLimit') {
    assert.equal(f.game.turn, 2); assert.equal(f.financingReturn, null);
    assert.ok(f.revival.steps.some(step => step.actor === f.tleilaxu && step.action.type === 'tleilaxuRevivalLimit' && step.action.target === f.recipient));
    assert.equal(f.pending.free, 2); assert.equal(f.pending.cost, 2 * (f.amount - 2));
    assert.equal(f.expected.outcome, 'abandoned');
  } else {
    assert.equal(f.game.turn, f.kind === 'choamRevival' ? 2 : 3);
    if (f.kind === 'choamRevival') {
      assert.equal(f.financingFunding, null); assert.equal(f.financingReturn, null);
      assert.equal(player(f.shipment.before, f.holder).spice, 11);
      assert.equal(f.pending.cost, f.amount); assert.equal(f.pending.free, 0);
      assert.equal(f.expected.outcome, f.amount === 4 ? 'abandoned' : 'revive');
      if (f.amount === 3) assert.equal(f.expected.pending?.cost, 6);
    } else {
      assert.ok(f.financingReturn);
      assert.equal(player(f.financingReturn.before, f.atreides).spice - player(f.financingReturn.after, f.atreides).spice, 6);
      assert.equal(player(f.financingReturn.after, f.atreides).revived, 5);
      assert.equal(player(f.financingReturn.after, f.tleilaxu).spice - player(f.financingReturn.before, f.tleilaxu).spice, 7);
      assert.equal(player(f.shipment.before, f.tleilaxu).spice, 12);
      assert.equal(player(f.shipment.after, f.tleilaxu).spice, 4);
      assert.equal(player(f.storm.before, f.tleilaxu).spice, 4);
      assert.equal(f.shipmentDestination.sector, f.shipment.before.storm % 18 + 1);
      assert.ok(Object.entries(f.shipment.before.spice).every(([key, amount]) =>
        amount === 0 || !key.startsWith(`${f.shipmentDestination.territory}:`)));
      assert.equal(f.pending.amount, 4); assert.equal(f.pending.free, 2);
      assert.equal(f.pending.cost, 2); assert.equal(f.pending.normalCost, 4);
      assert.equal(f.expected.pending?.cost, 4); assert.equal(f.expected.outcome, f.unfunded ? 'unfunded' : 'revive');
      assert.ok(f.revival.steps.some(step => step.action.type === 'passResponse'), 'The earlier own-T limit response is actually allowed');
      if (f.unfunded) {
        assert.ok(f.funding); assert.equal(player(f.funding.after, f.payer).spice, 2);
        assert.ok(f.funding.steps.some(step => step.actor === f.payer && step.action.type === 'bribe' && step.action.target === f.spender));
        assert.equal(player(f.game, f.payer).spice, f.pending.cost);
      }
    }
  }
  assert.equal(f.game.phase, 4); assert.equal(f.game.response?.kind, f.kind);
  assert.equal(f.game.response?.owner, f.owner); assert.equal(f.game.response?.recipient, f.recipient);
  assert.deepEqual(f.game.pendingRevival, f.pending);
  assert.deepEqual(player(f.game, f.recipient), player(f.beforeRevival, f.recipient));
  assert.deepEqual(quoteRevivalCancellation(f.game, f.game.response!), f.expected);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaRevivalBenefitsForcesFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaRevivalDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaRevivalDiscard') throw Error('Use the exact revival-benefit cost');
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(game.pendingRevival, f.pending); assert.equal(game.response ?? null, null);
  assert.equal(game.decision ?? null, null); assert.equal(game.phaseOpening ?? null, null);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
/** Predict the exact price/free-event income independently. The last usable
 * counter's disposal may make that income auto-allow, while a reclaimed cost
 * may leave the same native income window actionable. */
function settled(game: Game, f: SemutaRevivalBenefitsForcesFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingRevival ?? null, null);
  assert.equal(game.pendingKarama ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.revivalRules, f.expected.rules);
  const returned = f.expected.outcome === 'revive', quote = f.expected.pending;
  const nativeIncome = returned && f.expectedResume?.nextResponse?.kind === 'revivalIncome'
    ? f.expectedResume.nextResponse : null;
  const income = game.response ? structuredClone(game.response) : null;
  const outstanding = income?.kind === 'revivalIncome' ? income.amount! : 0;
  const credited = (nativeIncome?.amount ?? 0) - outstanding;
  assert.ok(outstanding === 0 || outstanding === nativeIncome?.amount);
  assert.ok(credited === 0 || credited === nativeIncome?.amount);
  if (income) {
    assert.equal(income.kind, 'revivalIncome'); assert.ok(nativeIncome);
    assert.equal(income.owner, nativeIncome.owner); assert.equal(income.recipient, nativeIncome.recipient);
    assert.equal(income.amount, nativeIncome.amount);
  }
  const original = player(f.game, f.recipient), recipient = player(game, f.recipient);
  assert.equal(recipient.tanks, original.tanks - (returned ? f.amount : 0));
  assert.equal(recipient.reserves, original.reserves + (returned ? f.amount : 0));
  assert.equal(recipient.revived, original.revived + (returned ? f.amount : 0));
  assert.equal(recipient.freeForcesRevived ?? 0, (original.freeForcesRevived ?? 0) + (returned ? quote!.free : 0));
  assert.equal(player(game, f.payer).spice, player(f.game, f.payer).spice - (returned ? quote!.cost : 0) +
    (f.payer === f.tleilaxu ? credited : 0));
  assert.equal(player(game, f.tleilaxu).spice, player(f.game, f.tleilaxu).spice -
    (returned && f.payer === f.tleilaxu ? quote!.cost : 0) + credited);
  assert.deepEqual(recipient.forces, original.forces); assert.deepEqual(recipient.elites, original.elites);
  assert.deepEqual(game.freeRevival, f.game.freeRevival);
  assert.equal(game.active, f.game.active); assert.deepEqual(game.ready, f.game.ready);
  assert.equal(game.phase, 4); assert.equal(game.turn, f.game.turn);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (returned) {
    const resumed = f.expectedResume; assert.ok(resumed);
    assert.equal(resumed.outcome, 'revive'); assert.equal(resumed.pending.cost, quote!.cost);
    assert.ok(nativeIncome); assert.equal(nativeIncome.owner, f.tleilaxu);
    assert.equal(nativeIncome.recipient, f.payer); assert.equal(nativeIncome.amount, f.payer === f.tleilaxu ? 1 : quote!.cost);
    if (resumed.freeIncome) {
      assert.equal(resumed.freeIncome.player, f.payer);
      assert.equal(game.revivalFreeIncome?.[f.payer], f.game.turn);
    } else assert.deepEqual(game.revivalFreeIncome, f.game.revivalFreeIncome);
  } else {
    assert.equal(income, null); assert.deepEqual(game.revivalFreeIncome, f.game.revivalFreeIncome);
  }
  const beforeIncome = structuredClone(game), steps: { actor: string; action: Action }[] = [];
  game = finish(game, steps);
  assert.ok(steps.every(step => step.action.type === 'passResponse'));
  assert.equal(game.response ?? null, null); assert.equal(game.pendingRevival ?? null, null);
  assert.equal(player(game, f.tleilaxu).spice, player(beforeIncome, f.tleilaxu).spice + outstanding);
  for (const id of game.players.map(player => player.id).filter(id => id !== f.tleilaxu))
    assert.deepEqual(player(game, id), player(beforeIncome, id));
  assert.equal(player(game, f.recipient).tanks, recipient.tanks);
  assert.equal(player(game, f.recipient).reserves, recipient.reserves);
  assert.equal(player(game, f.recipient).revived, recipient.revived);
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind}${'amount' in variant ? ' above normal cap' : ''}${'unfunded' in variant ? ' unfunded' : ''} cost ${claimed ? 'claim' : 'pass'} precedes its original return outcome`, () => {
    const f = fixture(variant); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = settled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
    reject(game, f.recipient, f.nativeAction);
  });

void test('native benefit allowances complete the original cheap/granted return once without spending either held card', () => {
  for (const variant of variants.filter(variant => !('unfunded' in variant))) {
    const f = fixture(variant); nativeSource(f);
    let game = allow(structuredClone(f.game));
    const beforeIncome = structuredClone(game), income = game.response?.kind === 'revivalIncome' ? game.response.amount! : 0;
    assert.equal(f.allowedResume.outcome, 'revive'); assert.equal(f.allowedResume.pending.cost, f.pending.cost);
    const expectedIncome = f.allowedResume.nextResponse?.kind === 'revivalIncome' ? f.allowedResume.nextResponse.amount! : 0;
    const credited = expectedIncome - income;
    assert.ok(credited === 0 || credited === expectedIncome);
    assert.equal(player(game, f.payer).spice, player(f.game, f.payer).spice - f.pending.cost +
      (f.payer === f.tleilaxu ? credited : 0));
    assert.equal(player(game, f.tleilaxu).spice, player(f.game, f.tleilaxu).spice -
      (f.payer === f.tleilaxu ? f.pending.cost : 0) + credited);
    if (f.allowedResume.freeIncome) assert.equal(game.revivalFreeIncome?.[f.payer], f.game.turn);
    assert.equal(player(game, f.recipient).tanks, player(f.game, f.recipient).tanks - f.amount);
    assert.equal(player(game, f.recipient).reserves, player(f.game, f.recipient).reserves + f.amount);
    assert.equal(player(game, f.recipient).revived, player(f.game, f.recipient).revived + f.amount);
    game = finish(game);
    assert.equal(player(game, f.tleilaxu).spice, player(beforeIncome, f.tleilaxu).spice + income);
    assert.equal(game.pendingRevival ?? null, null); assert.equal(game.response ?? null, null);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('abandoned and unfunded native requests preserve a real smaller return opportunity', () => {
  for (const variant of [variants[2], variants[6], variants[7]]) {
    const f = fixture(variant), game = settled(claim(open(f), f.holder), f, true);
    const amount = f.kind === 'revivalDiscount' ? 2 : 3, before = structuredClone(game);
    let next = act(game, f.recipient, { type: 'revive', amount, elite: 0 });
    next = finish(next);
    assert.equal(player(next, f.recipient).tanks, player(before, f.recipient).tanks - amount);
    assert.equal(player(next, f.recipient).reserves, player(before, f.recipient).reserves + amount);
    assert.equal(player(next, f.recipient).revived, player(before, f.recipient).revived + amount);
    assert.equal(next.pendingRevival ?? null, null); assert.equal(next.response ?? null, null);
    assert.deepEqual(inventory(next), f.originalInventory);
  }
});

void test('fresh revival-benefit costs reject stale, foreign and underlying actions while the original request is unpaid', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.recipient, f.nativeAction);
    reject(game, f.owner, { type: 'passResponse' });
    assert.deepEqual(game.pendingRevival, f.pending); assert.deepEqual(physical(game), physical(f.game));
    settled(pass(game), f, false);
  }
});

void test('all four minimal policies answer the actual force-benefit cancellation costs legally', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      settled(game, f, claimed);
    }
  }
});
