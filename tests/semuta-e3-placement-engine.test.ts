import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaE3PlacementFixture as fixture, actSemutaE3Placement as act,
  passSemutaE3Placement as pass, claimSemutaE3Placement as claim,
  allowSemutaE3Placement as allow, finishSemutaE3Placement as finish,
  semutaE3PlacementPlayer as player, semutaE3PlacementInventory as inventory,
  type SemutaE3PlacementFixture,
} from './fixture-semuta-e3-placement';

const variants = [
  { kind: 'ecazPlacement' as const },
  { kind: 'ecazPlacement' as const, second: true },
  { kind: 'moritaniPlacement' as const },
  { kind: 'moritaniDuke' as const },
];
const physical = (game: Game) => ({ turn: game.turn, phase: game.phase, storm: game.storm,
  order: game.order, active: game.active, ready: game.ready, movementRemaining: game.movementRemaining,
  ecazAmbassadors: game.ecazAmbassadors, ecazPlacementTurn: game.ecazPlacementTurn,
  pendingEcazPlacement: game.pendingEcazPlacement, moritaniTerror: game.moritaniTerror,
  pendingMoritaniPlacement: game.pendingMoritaniPlacement, dukeVidal: game.dukeVidal,
  dukeAcquisitionTurn: game.dukeAcquisitionTurn, freeRevival: game.freeRevival,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    forces: player.forces, reserves: player.reserves, tanks: player.tanks, elites: player.elites,
    leaders: player.leaders, ally: player.ally, shipped: player.shipped, moved: player.moved, revived: player.revived })) });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaE3PlacementFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.game.advanced, false); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', f.owner, 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.originalDuke?.leader.dead ?? false, false);
  if (f.kind === 'ecazPlacement') {
    assert.equal(f.game.phase, 4); assert.ok(f.game.pendingEcazPlacement && f.token && f.territory);
    assert.equal(f.game.pendingEcazPlacement.cost, f.second ? 2 : 1);
    assert.equal(f.game.pendingEcazPlacement.token, f.token); assert.equal(f.game.pendingEcazPlacement.territory, f.territory);
    assert.equal(f.game.ecazAmbassadors?.tokens.find(token => token.id === f.token)?.zone, 'supply');
    assert.deepEqual(player(f.game, f.owner), player(f.declaration.before, f.owner), 'The pending placement is unpaid');
    if (f.second) {
      assert.ok(f.firstPlacement);
      assert.ok(f.firstPlacement.steps.some(step => step.action.type === 'passResponse'));
      assert.equal(player(f.firstPlacement.before, f.owner).spice - player(f.firstPlacement.after, f.owner).spice, 1);
      assert.equal(f.game.ecazAmbassadors?.placement?.count, 1);
      assert.equal(f.game.ecazAmbassadors?.tokens.find(token => token.effect === 'ecaz')?.location, 'sietch_tabr');
    } else assert.equal(f.firstPlacement, null);
  } else if (f.kind === 'moritaniPlacement') {
    assert.equal(f.game.phase, 8); assert.ok(f.game.pendingMoritaniPlacement && f.token);
    assert.equal(player(f.afterSetup, f.owner).forces['oh_gap:9'], 6);
    assert.equal(f.game.pendingMoritaniPlacement.token, f.token);
    assert.equal(f.game.moritaniTerror?.tokens.find(token => token.id === f.token)?.status, 'available');
    assert.equal(f.game.moritaniTerror?.tokens.find(token => token.id === f.token)?.location, null);
    assert.deepEqual(player(f.game, f.owner), player(f.declaration.before, f.owner));
  } else {
    assert.equal(f.game.phase, 5); assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 6);
    assert.equal(f.shipments.length, 3);
    for (const shipment of f.shipments) {
      const step = shipment.steps.find(step => step.action.type === 'ship'); assert.ok(step);
      assert.equal(step.action.amount, 1);
      assert.equal(player(shipment.before, step.actor).spice - player(shipment.after, step.actor).spice, 1);
    }
    assert.equal(player(f.game, f.richese).forces['carthag:11'], 1);
    assert.equal(player(f.game, f.owner).forces['carthag:11'], 1);
    assert.equal(player(f.game, f.owner).forces['arrakeen:10'], 6);
    assert.equal(player(f.game, f.spender).forces['arrakeen:10'], 1);
    assert.deepEqual(f.game.movementRemaining, []); assert.equal(f.game.dukeAcquisitionTurn, 1);
    assert.equal(f.originalDuke?.controller, null); assert.equal(f.originalDuke?.source, null);
    assert.equal(f.originalDuke?.leader.strength, 6);
    assert.deepEqual(f.declaration.steps, [{ actor: f.spender, action: { type: 'endMovement' } }]);
  }
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaE3PlacementFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaEcazMoritaniDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaEcazMoritaniDiscard') throw Error('Use the original native E3 cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function unchangedForcesAndFunds(game: Game, f: SemutaE3PlacementFixture, paid = 0) {
  for (const current of game.players) {
    const original = player(f.game, current.id);
    assert.equal(current.spice, original.spice - (current.id === f.owner ? paid : 0));
    assert.deepEqual(current.forces, original.forces); assert.deepEqual(current.elites, original.elites);
    assert.equal(current.reserves, original.reserves); assert.equal(current.tanks, original.tanks);
    assert.equal(current.revived, original.revived); assert.deepEqual(current.leaders, original.leaders);
    assert.equal(current.ally, original.ally);
  }
  assert.deepEqual(game.freeRevival, f.game.freeRevival); assert.equal(game.pendingRevival ?? null, null);
  assert.deepEqual(game.spiceDeck, f.game.spiceDeck); assert.deepEqual(game.spiceDiscard, f.game.spiceDiscard);
}
function nativeBoundary(game: Game, f: SemutaE3PlacementFixture) {
  assert.equal(game.phase, f.kind === 'ecazPlacement' ? 5 : f.kind === 'moritaniPlacement' ? 8 : 6);
  assert.equal(game.turn, 1); assert.equal(game.status, 'playing');
  if (f.kind === 'ecazPlacement') {
    assert.equal(game.ecazPlacementTurn, 1); assert.equal(game.pendingEcazPlacement ?? null, null);
    assert.deepEqual(game.movementRemaining, game.order); assert.equal(game.active, game.order[0]);
    assert.ok(game.players.every(player => player.shipped === false && player.moved === 0));
    if (f.second) assert.equal(game.ecazAmbassadors?.tokens.find(token => token.effect === 'ecaz')?.location, 'sietch_tabr');
  } else if (f.kind === 'moritaniPlacement') {
    assert.equal(game.moritaniTerror?.placementTurn, 1); assert.equal(game.pendingMoritaniPlacement ?? null, null);
    assert.deepEqual(game.ready, f.game.ready);
  } else {
    assert.equal(game.dukeAcquisitionTurn, 1); assert.deepEqual(game.movementRemaining, []);
    assert.equal(game.choamMarket ?? null, null);
    assert.equal(game.battle ?? null, null);
    assert.equal(player(game, f.owner).forces['arrakeen:10'], 6); assert.equal(player(game, f.owner).forces['carthag:11'], 1);
  }
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.notEqual(game.response?.kind, f.kind);
  assert.deepEqual(inventory(game), f.originalInventory);
}
function dukeClosingMarket(game: Game, f: SemutaE3PlacementFixture) {
  assert.equal(game.phase, 5); assert.equal(game.turn, 1);
  assert.deepEqual(game.movementRemaining, []); assert.equal(game.dukeAcquisitionTurn, 1);
  assert.equal(game.response ?? null, null); assert.equal(game.decision?.kind, 'choamMarket');
  assert.equal(game.decision?.player, f.holder); assert.equal(game.choamMarket?.owner, f.holder);
  assert.equal(game.choamMarket?.resume, 'phase');
}
function prevented(game: Game, f: SemutaE3PlacementFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  unchangedForcesAndFunds(game, f);
  if (f.expected.kind === 'ecazPlacement') {
    assert.deepEqual(game.ecazAmbassadors, f.expected.ambassadors);
    assert.equal(game.ecazAmbassadors?.placement?.blocked, true);
    assert.equal(game.ecazAmbassadors?.tokens.find(token => token.id === f.token)?.zone, 'supply');
  } else if (f.expected.kind === 'moritaniPlacement') {
    assert.deepEqual(game.moritaniTerror, f.expected.terror);
    assert.deepEqual(game.moritaniTerror?.tokens, f.originalTerror?.tokens);
  } else {
    assert.deepEqual(game.dukeVidal, f.originalDuke);
    dukeClosingMarket(game, f);
  }
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  const steps: { actor: string; action: Action }[] = [];
  game = finish(game, f.kind, steps);
  assert.deepEqual(steps, f.kind === 'moritaniDuke'
    ? [{ actor: f.holder, action: { type: 'decision', done: true } }] : []);
  nativeBoundary(game, f);
  assert.deepEqual(finish(game, f.kind), game);
  return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `Basic native ${variant.kind}${'second' in variant ? ' second paid opportunity' : ''} cost ${claimed ? 'claim' : 'pass'} resumes original denial and phase once`, () => {
    const f = fixture(variant); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    reject(game, f.kind === 'moritaniDuke' ? f.spender : f.owner, f.nativeAction);
  });

void test('native E3 placement and Duke allowance controls commit only the original quoted payment, token or shared disc', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    let game = allow(structuredClone(f.game));
    const paid = f.kind === 'ecazPlacement' ? f.game.pendingEcazPlacement!.cost : 0;
    unchangedForcesAndFunds(game, f, paid);
    if (f.kind === 'ecazPlacement') {
      assert.equal(game.decision?.kind, 'ecazPlacement'); assert.equal(game.pendingEcazPlacement ?? null, null);
      const token = game.ecazAmbassadors?.tokens.find(token => token.id === f.token); assert.ok(token);
      assert.equal(token.zone, 'placed'); assert.equal(token.location, f.territory);
      assert.equal(game.ecazAmbassadors?.placement?.count, f.second ? 2 : 1);
    } else if (f.kind === 'moritaniPlacement') {
      const token = game.moritaniTerror?.tokens.find(token => token.id === f.token); assert.ok(token);
      assert.equal(token.status, 'placed'); assert.equal(token.location, f.territory);
      assert.equal(game.moritaniTerror?.placementTurn, 1);
    } else {
      assert.equal(game.dukeVidal?.controller, f.owner); assert.equal(game.dukeVidal?.source, 'moritani');
      assert.equal(game.dukeVidal?.acquiredTurn, 1); assert.deepEqual(game.dukeVidal?.leader, f.originalDuke?.leader);
      dukeClosingMarket(game, f);
    }
    game = finish(game, f.kind); nativeBoundary(game, f);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('fresh E3 costs reject stale and underlying replies while original token, prior payment and Duke sources stay parked', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.kind === 'moritaniDuke' ? f.spender : f.owner, f.nativeAction);
    reject(game, f.owner, { type: 'decision', decline: true });
    assert.deepEqual(physical(game), physical(f.game));
    prevented(pass(game), f, false);
  }
});

void test('all four minimal policies answer each original Basic E3 placement and acquisition cancellation cost legally', () => {
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
      prevented(game, f, claimed);
    }
  }
});
