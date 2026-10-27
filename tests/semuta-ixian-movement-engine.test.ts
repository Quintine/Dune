import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Action, type Game, viewGame } from '../game/engine';
import { MOBILE_LOCATION, mobileRouteDistance } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaIxianMovementFixture as fixture, actSemutaIxianMovement as act,
  advanceSemutaIxianMovement as advance, passSemutaIxianMovement as pass,
  claimSemutaIxianMovement as claim, allowSemutaIxianMovement as allow,
  semutaIxianMovementPlayer as player, semutaIxianMovementInventory as inventory,
  semutaIxianMovementClean as clean, semutaIxianMovementStorm as storm,
  type SemutaIxianMovementFixture,
} from './fixture-semuta-ixian-movement';

const forcesAndMoney = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice,
  forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites,
  moved: p.moved, shipped: p.shipped }));
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaIxianMovementFixture) {
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.setup.advanced, f.advanced);
  assert.ok(f.parent.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(f.originalPoint, 'polar_sink:0'); assert.equal(f.game.mobileStronghold?.location, f.originalPoint);
  assert.equal(player(f.game, f.owner).forces[MOBILE_LOCATION], 6);
  assert.equal(player(f.game, f.owner).elites!.forces[MOBILE_LOCATION], 3);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  if (f.kind === 'ixMovement') {
    assert.ok(f.shipment && f.replacement && f.destination && f.replacementDestination);
    assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.owner);
    assert.equal(player(f.shipment.before, f.owner).spice - player(f.shipment.after, f.owner).spice, 2);
    assert.equal(player(f.game, f.owner).forces[f.sourceLocation], 1);
    assert.equal(player(f.game, f.owner).elites!.forces[f.sourceLocation], 1);
    assert.equal(player(f.game, f.owner).moved, 0); assert.equal(player(f.game, f.owner).shipped, true);
    assert.deepEqual(f.game.pendingIxMove, f.pending);
  } else {
    assert.ok(f.route && f.collection.length && f.collectionAmount > 0);
    assert.ok(mobileRouteDistance(f.route) <= 3); assert.equal(f.route[0], f.originalPoint);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0);
    assert.equal(f.beforeDeclaration.decision?.kind, 'mobileStronghold');
    assert.equal(f.nativeAction.collect, true); assert.deepEqual(f.game.pendingMobileMove, f.pending);
    assert.equal(f.stormBefore.turnBeginnings, 0, 'Native Storm initialization follows this actual HMS opportunity');
    for (const pile of f.collection) assert.equal(f.game.spice[pile.location], pile.available);
    assert.equal(f.actions.filter(step => step.action.type === 'endMovement').length, f.game.players.length);
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaIxianMovementFixture) {
  let game = act(structuredClone(f.game), f.spender, f.action);
  if (game.pendingKull?.stage === 'offer') {
    const frame = game.pendingKull;
    game = act(game, frame.player, { type: 'kullDecision', event: frame.event, decline: true });
  }
  const pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.continuation.kind, 'karamaMovementDiscard');
  if (pending.continuation.kind !== 'karamaMovementDiscard') throw Error('Expected the exact movement cancellation cost');
  assert.deepEqual(pending.continuation.use.response, f.game.response);
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.deepEqual(forcesAndMoney(game), forcesAndMoney(f.game));
  assert.deepEqual(game.pendingIxMove, f.game.pendingIxMove); assert.deepEqual(game.pendingMobileMove, f.game.pendingMobileMove);
  assert.deepEqual(game.mobileStronghold, f.game.mobileStronghold); assert.deepEqual(game.spice, f.game.spice);
  assert.deepEqual(game.movementRemaining, f.game.movementRemaining); assert.equal(game.active, f.game.active);
  assert.deepEqual(storm(game), f.stormBefore, 'No native Storm initialization/card draw precedes the cost reaction');
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true); return game;
}
function costCompleted(game: Game, f: SemutaIxianMovementFixture, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
}
function groundDenied(game: Game, f: SemutaIxianMovementFixture, claimed: boolean) {
  costCompleted(game, f, claimed); assert.ok(f.replacement && f.replacementDestination && f.destination);
  assert.equal(game.pendingIxMove, null); assert.equal(game.active, f.owner);
  assert.deepEqual(game.movementRemaining, f.game.movementRemaining);
  assert.deepEqual(forcesAndMoney(game), forcesAndMoney(f.game)); assert.deepEqual(storm(game), f.stormBefore);
  assert.deepEqual(player(game, f.owner).ixMovementBlocked, { turn: f.game.turn, move: player(f.game, f.owner).moved });
  assert.equal(player(game, f.owner).moved, 0); reject(game, f.owner, f.nativeAction);
  game = act(game, f.owner, f.replacement); game = advance(game, clean);
  assert.equal(player(game, f.owner).moved, 1); assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).forces[f.sourceLocation] ?? 0, 0);
  assert.equal(player(game, f.owner).elites!.forces[f.sourceLocation] ?? 0, 0);
  assert.equal(player(game, f.owner).forces[f.replacementDestination], 1);
  assert.equal(player(game, f.owner).elites!.forces[f.replacementDestination], 1);
  assert.equal(player(game, f.owner).forces[f.destination] ?? 0, 0);
  assert.equal(player(game, f.owner).forces[MOBILE_LOCATION], 6);
  assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
  assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves);
  assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.owner, f.nativeAction); return game;
}
function initializedOnce(game: Game, f: SemutaIxianMovementFixture) {
  const after = storm(game);
  assert.equal(after.turnBeginnings, f.stormBefore.turnBeginnings + 1);
  assert.equal(after.revealedCards.length, f.stormBefore.revealedCards.length + Number(f.advanced));
  if (f.advanced) {
    assert.ok(after.revealedCards.at(-1)! >= 1 && after.revealedCards.at(-1)! <= 6);
    assert.deepEqual(game.stormDialers, []);
  } else assert.deepEqual(game.stormDialers, f.game.lastBattle);
}
function hmsDenied(game: Game, f: SemutaIxianMovementFixture, claimed: boolean) {
  costCompleted(game, f, claimed); assert.equal(game.pendingMobileMove, null);
  assert.equal(game.mobileStronghold?.location, f.originalPoint);
  assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
  assert.deepEqual(player(game, f.owner).forces, player(f.game, f.owner).forces);
  for (const pile of f.collection) assert.equal(game.spice[pile.location], pile.available);
  assert.notEqual(game.decision?.kind, 'mobileStronghold'); initializedOnce(game, f);
  const continued = advance(game, state => state.phase === 1 && clean(state));
  assert.equal(continued.turn, 2); assert.equal(continued.mobileStronghold?.location, f.originalPoint);
  assert.equal(player(continued, f.owner).spice, player(f.game, f.owner).spice);
  assert.equal(player(continued, f.owner).forces[MOBILE_LOCATION], 6);
  for (const pile of f.collection) assert.equal(continued.spice[pile.location], pile.available);
  assert.deepEqual(inventory(continued), f.originalInventory); initializedOnce(continued, f); return continued;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native Cyborg-range cost Semuta ${claimed ? 'claim' : 'pass'} keeps the paid group and permits its real one-step replacement`, () => {
    const f = fixture({ advanced }); nativeSource(f); const offered = open(f);
    groundDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native HMS collection cost Semuta ${claimed ? 'claim' : 'pass'} leaves the real Spice pile and begins the original Storm once`, () => {
    const f = fixture({ kind: 'mobileStronghold', advanced }); nativeSource(f); const offered = open(f);
    hmsDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('original Ixian range and positive HMS collection allowances retain their actual native transfers and Storm suffix', () => {
  for (const advanced of [false, true]) for (const kind of ['ixMovement', 'mobileStronghold'] as const) {
    const f = fixture({ advanced, kind }), game = allow(structuredClone(f.game));
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.ok(!game.pendingTreacheryDiscard); assert.deepEqual(inventory(game), f.originalInventory);
    if (kind === 'ixMovement') {
      assert.ok(f.destination); assert.equal(game.pendingIxMove, null);
      assert.equal(player(game, f.owner).forces[f.destination], 1);
      assert.equal(player(game, f.owner).elites!.forces[f.destination], 1);
      assert.equal(player(game, f.owner).forces[f.sourceLocation] ?? 0, 0);
      assert.equal(player(game, f.owner).moved, 1); assert.equal(player(game, f.owner).ixMovementBlocked, undefined);
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
    } else {
      assert.equal(game.pendingMobileMove, null); assert.equal(game.mobileStronghold?.location, f.destination);
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice + f.collectionAmount);
      for (const pile of f.collection) assert.equal(game.spice[pile.location] ?? 0, pile.available - pile.collected);
      initializedOnce(game, f);
    }
  }
});

void test('native Ixian movement cost reactions reject stale, foreign and underlying actions before transfer or Storm initialization', () => {
  for (const advanced of [false, true]) for (const kind of ['ixMovement', 'mobileStronghold'] as const) {
    const f = fixture({ advanced, kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, { type: 'passResponse' });
    if (kind === 'mobileStronghold') reject(game, f.owner, { type: 'ready' });
    const done = kind === 'ixMovement' ? groundDenied(pass(game), f, false) : hmsDenied(pass(game), f, false);
    reject(done, f.holder, { type: 'semutaCommit', event }); reject(done, f.spender, f.action);
  }
});

void test('all four minimal profiles legally answer native Basic and Advanced Cyborg or HMS movement costs', () => {
  for (const advanced of [false, true]) for (const kind of ['ixMovement', 'mobileStronghold'] as const) {
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
      if (kind === 'ixMovement') groundDenied(game, f, claimed); else hmsDenied(game, f, claimed);
    }
  }
});
