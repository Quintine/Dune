import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advisorMatchingKey, validateAdvisorMatching } from '../game/advisor-matching';
import { isAdvisor } from '../game/advisors';
import {
  createSemutaAdvisorMatchingFixture as fixture, actSemutaAdvisorMatching as act,
  passSemutaAdvisorMatching as pass, claimSemutaAdvisorMatching as claim,
  allowSemutaAdvisorMatching as allow, finishSemutaAdvisorMatching as finish,
  semutaAdvisorMatchingPlayer as player, semutaAdvisorMatchingInventory as inventory,
  semutaAdvisorMatchingPhysical as physical, type SemutaAdvisorMatchingFixture,
} from './fixture-semuta-advisor-matching';

const directions = ['fightersToAdvisors', 'advisorsToFighters'] as const;
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorMatchingFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.advisorSetup.steps[0].actor, f.owner);
  assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup', territory: 'arrakeen', sector: 10 });
  assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), 'arrakeen'), true);
  assert.equal(player(f.afterSetup, f.atreides).forces['arrakeen:10'], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(f.declinedPreparation.before.decision?.kind, 'advisorBattle');
  assert.deepEqual(f.declinedPreparation.steps[0], { actor: f.owner, action: { type: 'decision', accept: false } });
  assert.equal(player(f.shipment.before, f.owner).spice - player(f.shipment.after, f.owner).spice, 2);
  assert.ok(f.shipment.steps.some(step => step.actor === f.owner && step.action.type === 'ship' && step.action.amount === 1));
  const bg = player(f.game, f.owner);
  assert.equal(bg.forces['arrakeen:10'], 1); assert.equal(bg.forces['imperial_basin:9'], 1);
  assert.equal(isAdvisor(bg, 'arrakeen'), true); assert.equal(isAdvisor(bg, 'imperial_basin'), false);
  assert.equal(bg.shipped, true); assert.equal(bg.moved, 0); assert.equal(bg.reserves, 18); assert.equal(bg.spice, 3);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 1); assert.equal(f.game.active, f.owner);
  assert.equal(f.game.response?.kind, 'advisorFlip'); assert.deepEqual(f.game.response, f.originalResponse);
  assert.deepEqual(f.game.pendingAdvisorMatching, f.originalPending);
  assert.equal(f.originalPending.intent.kind, 'movement'); assert.equal(f.originalPending.signature, JSON.stringify(f.originalPending.intent));
  assert.deepEqual(f.originalPending.receipt, f.receipt); assert.deepEqual(f.receipt.group, { [f.sourceLocation]: 1 });
  assert.equal(f.receipt.owner, f.owner); assert.equal(f.receipt.kind, 'movement'); assert.equal(f.receipt.move, 0);
  assert.equal(f.receipt.origin, f.origin); assert.equal(f.receipt.destination, f.destination);
  assert.equal(f.receipt.advisors, f.direction === 'fightersToAdvisors');
  assert.equal(f.denialKey, advisorMatchingKey(f.receipt)); validateAdvisorMatching(f.game, f.receipt);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration));
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorMatchingFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Expected the native incoming matching cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAdvisorMatching, f.originalPending);
  assert.deepEqual(game.advisorMatchingDenied ?? [], f.originalDenied);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaAdvisorMatchingFixture, claimed: boolean) {
  const game = finish(state);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAdvisorMatching ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.deepEqual(game.advisorMatchingDenied, [...f.originalDenied, f.denialKey]);
  assert.equal(player(game, f.owner).moved, 0); assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.owner, f.nativeAction); reject(game, f.spender, f.action);
  const alternative = finish(act(structuredClone(game), f.replacementActor, f.replacementAction));
  assert.equal(alternative.pendingAdvisorMatching ?? null, null); assert.equal(alternative.response ?? null, null);
  assert.equal(alternative.phase, 5); assert.equal(alternative.active, f.owner);
  assert.equal(player(alternative, f.owner).forces['imperial_basin:9'] ?? 0, 0);
  assert.equal(player(alternative, f.owner).forces['imperial_basin:10'], 1);
  assert.equal(player(alternative, f.owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(player(alternative, f.owner), 'arrakeen'), true);
  assert.equal(isAdvisor(player(alternative, f.owner), 'imperial_basin'), false);
  assert.equal(player(alternative, f.owner).moved, 1); assert.equal(player(alternative, f.owner).shipped, true);
  assert.equal(player(alternative, f.owner).spice, 3); assert.equal(player(alternative, f.owner).reserves, 18);
  assert.deepEqual(alternative.advisorMatchingDenied, [...f.originalDenied, f.denialKey]);
  for (const p of game.players.filter(p => p.id !== f.owner)) {
    assert.equal(player(alternative, p.id).spice, p.spice); assert.deepEqual(player(alternative, p.id).forces, p.forces);
    assert.equal(player(alternative, p.id).reserves, p.reserves); assert.equal(player(alternative, p.id).tanks, p.tanks);
  }
  reject(alternative, f.owner, f.replacementAction); assert.deepEqual(inventory(alternative), f.originalInventory); return game;
}

for (const direction of directions) for (const claimed of [false, true]) void test(
  `Advanced native ${direction} matching cost Semuta ${claimed ? 'claim' : 'pass'} preserves both groups and permits the real alternate move`, () => {
    const f = fixture({ direction }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native matching allowance changes only the selected incoming group and commits the original ground move once', () => {
  for (const direction of directions) {
    const f = fixture({ direction }); nativeSource(f); const game = finish(allow(structuredClone(f.game)));
    assert.equal(game.pendingAdvisorMatching ?? null, null); assert.equal(game.response ?? null, null);
    assert.equal(game.phase, 5); assert.equal(game.active, f.owner);
    assert.equal(player(game, f.owner).forces[f.sourceLocation] ?? 0, 0);
    assert.equal(player(game, f.owner).forces[f.destinationLocation], 2);
    assert.equal(isAdvisor(player(game, f.owner), f.destination), f.receipt.advisors);
    assert.equal(player(game, f.owner).moved, 1); assert.equal(player(game, f.owner).shipped, true);
    assert.equal(player(game, f.owner).spice, 3); assert.equal(player(game, f.owner).reserves, 18);
    assert.equal(player(game, f.atreides).forces['arrakeen:10'], 10);
    assert.deepEqual(game.advisorMatchingDenied ?? [], f.originalDenied);
    for (const p of f.game.players.filter(p => p.id !== f.owner)) {
      assert.equal(player(game, p.id).spice, p.spice); assert.deepEqual(player(game, p.id).forces, p.forces);
      assert.equal(player(game, p.id).reserves, p.reserves); assert.equal(player(game, p.id).tanks, p.tanks);
    }
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    reject(game, f.owner, f.nativeAction); assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('native matching cost rejects stale foreign and underlying movement replies before original denial or transfer', () => {
  for (const direction of directions) {
    const f = fixture({ direction }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.replacementAction);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'endMovement' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native incoming advisor-matching costs in both directions', () => {
  for (const direction of directions) {
    const f = fixture({ direction }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
