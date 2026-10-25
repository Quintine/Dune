import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteFremenRevivalGrant, validateFremenRevivalGrant } from '../game/fremen-revival-grant';
import {
  createSemutaFremenGrantCostFixture as fixture, actSemutaFremenGrantCost as act,
  passSemutaFremenGrantCost as pass, claimSemutaFremenGrantCost as claim,
  allowSemutaFremenGrantCost as allow, finishSemutaFremenGrantCost as finish,
  semutaFremenGrantCostPlayer as player, semutaFremenGrantCostInventory as inventory,
  semutaFremenGrantCostPhysical as physical, type SemutaFremenGrantCostFixture,
} from './fixture-semuta-fremen-grant-cost';

const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaFremenGrantCostFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.owner).forces['sietch_tabr:14'], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(f.shipment.before.storm, 12);
  assert.equal(player(f.shipment.before, f.recipient).spice - player(f.shipment.after, f.recipient).spice, 6);
  assert.ok(f.shipment.steps.some(step => step.actor === f.recipient && step.action.type === 'ship' && step.action.amount === 3 && step.action.elite === 0));
  assert.equal(player(f.shipment.after, f.recipient).forces[f.location], 3);
  assert.equal(f.storm.before.storm, 12); assert.ok(f.storm.after.storm >= 13 && f.storm.after.storm <= 18);
  assert.equal(player(f.storm.before, f.recipient).tanks, 0); assert.equal(player(f.storm.after, f.recipient).tanks, 3);
  assert.equal(player(f.storm.after, f.recipient).forces[f.location] ?? 0, 0);
  assert.equal(f.alliance.steps.length, 2); assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
  assert.equal(f.alliance.before.nexus, true); assert.equal(player(f.game, f.owner).ally, f.recipient);
  assert.equal(player(f.game, f.recipient).ally, f.owner);
  assert.equal(f.intrinsicBefore.freeRemaining, 1); assert.equal(f.intrinsicBefore.forcesRemaining, 3);
  assert.equal(f.priorRevival.steps[0].actor, f.recipient); assert.deepEqual(f.priorRevival.steps[0].action, f.priorRevivalAction);
  assert.equal(player(f.priorRevival.before, f.recipient).spice, player(f.priorRevival.after, f.recipient).spice);
  assert.equal(player(f.priorRevival.after, f.recipient).revived, 1);
  assert.equal(player(f.priorRevival.after, f.recipient).freeForcesRevived, 1);
  assert.equal(player(f.game, f.recipient).tanks, 2); assert.equal(player(f.game, f.recipient).reserves, 18);
  assert.equal(player(f.game, f.recipient).spice, 4); assert.equal(player(f.game, f.recipient).revived, 1);
  assert.equal(player(f.game, f.recipient).freeForcesRevived, 1);
  assert.equal(f.intrinsic.freeRemaining, 0); assert.equal(f.intrinsic.forcesRemaining, 2);
  assert.equal(f.game.phase, 4); assert.equal(f.game.turn, 2); assert.equal(f.game.pendingRevival ?? null, null);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.response?.kind, 'fremenRevivalGrant'); assert.deepEqual(f.game.response, f.originalResponse);
  assert.deepEqual(f.fremenGrant, { turn: 2, owner: f.owner, recipient: f.recipient });
  assert.deepEqual(quoteFremenRevivalGrant(f.game, f.owner), f.fremenGrant); validateFremenRevivalGrant(f.game, f.fremenGrant);
  assert.deepEqual(f.game.revivalRules, f.originalRules); assert.deepEqual(f.game.freeRevival, f.originalFreeRevival);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration));
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaFremenGrantCostFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaFremenGrantDiscard');
  if (pending.continuation.kind !== 'karamaFremenGrantDiscard') throw Error('Expected the original allied grant cost');
  assert.equal(pending.batch.cause, 'karama:fremenRevivalGrant'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.pendingRevival ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.deepEqual(game.revivalRules, f.originalRules); assert.deepEqual(game.freeRevival, f.originalFreeRevival);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function nativeOutcome(state: Game, f: SemutaFremenGrantCostFixture, canceled: boolean) {
  const game = finish(state);
  assert.equal(game.response ?? null, null); assert.equal(game.pendingRevival ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  if (canceled) {
    assert.deepEqual(game.freeRevival, f.originalFreeRevival);
    assert.deepEqual(game.revivalRules, { ...f.originalRules,
      fremenGrantBlocked: [...(f.originalRules?.fremenGrantBlocked ?? []), f.recipient] });
  } else {
    assert.deepEqual(game.freeRevival, [...f.originalFreeRevival, f.recipient]);
    assert.deepEqual(game.revivalRules, f.originalRules);
  }
  const current = viewGame(game, f.recipient).revival;
  assert.equal(current.freeRemaining, canceled ? 0 : 2); assert.equal(current.forcesRemaining, 2);
  assert.equal(current.limit, f.intrinsic.limit);
  reject(game, f.owner, f.nativeAction);
  const beforeReturn = structuredClone(game), returned = finish(act(structuredClone(game), f.recipient, f.replacementAction));
  assert.equal(returned.response ?? null, null); assert.equal(returned.pendingRevival ?? null, null);
  assert.equal(returned.phase, 4); assert.equal(returned.turn, 2);
  assert.equal(player(returned, f.recipient).reserves, 20); assert.equal(player(returned, f.recipient).tanks, 0);
  assert.equal(player(returned, f.recipient).revived, 3);
  assert.equal(player(returned, f.recipient).freeForcesRevived, canceled ? 1 : 3);
  assert.equal(player(returned, f.recipient).spice, player(beforeReturn, f.recipient).spice - (canceled ? f.deniedCost : f.allowedCost));
  assert.deepEqual(player(returned, f.recipient).forces, player(f.game, f.recipient).forces);
  assert.equal(player(returned, f.recipient).elites?.reserves, player(f.game, f.recipient).elites?.reserves);
  assert.equal(player(returned, f.recipient).elites?.tanks ?? 0, player(f.game, f.recipient).elites?.tanks ?? 0);
  for (const p of game.players.filter(p => p.id !== f.recipient)) {
    assert.equal(player(returned, p.id).spice, p.spice); assert.equal(player(returned, p.id).reserves, p.reserves);
    assert.equal(player(returned, p.id).tanks, p.tanks); assert.deepEqual(player(returned, p.id).forces, p.forces);
  }
  assert.deepEqual(returned.revivalRules, game.revivalRules); assert.deepEqual(returned.freeRevival, game.freeRevival);
  assert.equal(viewGame(returned, f.recipient).revival.forcesRemaining, 0);
  reject(returned, f.recipient, f.replacementAction); reject(returned, f.owner, f.nativeAction);
  assert.deepEqual(inventory(returned), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaFremenGrantCostFixture, claimed: boolean) {
  const game = nativeOutcome(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native Fremen grant cost Semuta ${claimed ? 'claim' : 'pass'} preserves prior free1 and leaves ordinary paid2 legal`, () => {
    const f = fixture({ advanced }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native Fremen grant allowance retains prior usage and makes only the two remaining ordinary returns free', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }); nativeSource(f); const game = nativeOutcome(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native Fremen grant cost rejects stale foreign and underlying grant or revival replies before permission changes', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.recipient, f.replacementAction);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'ready' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native Fremen allied revival-grant costs', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
