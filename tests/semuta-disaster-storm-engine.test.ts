import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validateStormCancellation } from '../game/disaster-preflight';
import {
  createSemutaDisasterStormFixture as fixture, actSemutaDisasterStorm as act,
  passSemutaDisasterStorm as pass, claimSemutaDisasterStorm as claim,
  allowSemutaDisasterStorm as allow, finishSemutaDisasterStorm as finish,
  semutaDisasterStormPlayer as player, semutaDisasterStormInventory as inventory,
  type SemutaDisasterStormFixture,
} from './fixture-semuta-disaster-storm';

const kinds = ['traversal', 'shipment'] as const;
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active, ready: game.ready,
  stormResolution: game.stormResolution, stormMovementSource: game.stormMovementSource,
  stormDials: game.stormDials, stormPending: game.stormPending, stormDialers: game.stormDialers,
  stormCard: game.stormCard, stormCardKnown: game.stormCardKnown,
  pendingArrivalReaction: game.pendingArrivalReaction, basicAlliedShipment: game.basicAlliedShipment,
  pendingAmbassador: game.pendingAmbassador, pendingTerrorEntry: game.pendingTerrorEntry,
  pendingArrivalOverlap: game.pendingArrivalOverlap, movementRemaining: game.movementRemaining,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaDisasterStormFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'fremen', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.owner).forces['sietch_tabr:14'], 10);
  assert.equal(player(f.afterSetup, f.owner).elites?.reserves, 3);
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'fremenSetup'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.deepEqual(f.actions.filter(step => step.action.type === 'stormDial')
    .map(step => Number(step.action.amount)).sort((a, b) => a - b), [0, f.firstDistance]);
  assert.equal(f.shipment.steps.length, 1); assert.deepEqual(f.shipment.steps[0], { actor: f.owner, action: f.nativeAction });
  assert.equal(player(f.shipment.before, f.owner).spice, player(f.shipment.after, f.owner).spice);
  assert.equal(player(f.shipment.after, f.owner).reserves, player(f.shipment.before, f.owner).reserves - 3);
  assert.equal(player(f.shipment.after, f.owner).elites?.reserves, 2);
  assert.equal(player(f.shipment.after, f.owner).forces[f.key], 3);
  assert.equal(player(f.shipment.after, f.owner).elites?.forces[f.key], 1);
  assert.equal(player(f.shipment.after, f.owner).shipped, true);
  assert.equal(player(f.game, f.owner).forces['sietch_tabr:14'], 10, 'The native protected setup group survives');
  assert.equal(player(f.game, f.owner).forces[f.key], 3); assert.equal(player(f.game, f.owner).elites?.forces[f.key], 1);
  assert.equal(player(f.game, f.owner).tanks, 0); assert.equal(player(f.game, f.owner).elites?.tanks, 0);
  assert.equal(f.game.response?.kind, 'stormProtection'); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  validateStormCancellation(f.game, f.game.response!);
  if (f.kind === 'shipment') {
    assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.storm, 15);
    assert.equal(f.game.active, f.owner); assert.equal(f.game.response?.resume, 'shipment');
    assert.equal(f.game.response?.location, f.key); assert.equal(f.game.response?.amount, 3); assert.equal(f.game.response?.elite, 1);
    assert.equal(f.originalResolution, null); assert.equal(f.beforeStorm, null); assert.equal(f.traversal, null);
    assert.deepEqual(f.originalArrival, [{ entrant: f.owner, territory: f.target, sector: 15,
      amount: 3, elite: 1, cause: 'shipment', resume: 'none', turn: 1, phase: 5 }]);
  } else {
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0); assert.equal(f.game.storm, 14);
    assert.equal(f.game.response?.resume, 'storm'); assert.ok(f.beforeStorm && f.traversal && f.originalResolution);
    assert.equal(f.originalResolution.from, 14); assert.equal(f.originalResolution.traversed, 0);
    assert.ok(f.originalResolution.distance >= 1 && f.originalResolution.distance <= 6);
    assert.deepEqual(f.originalResolution.pending, []); assert.equal(f.originalArrival?.length ?? 0, 0);
    assert.deepEqual(player(f.game, f.owner).forces, player(f.shipment.after, f.owner).forces);
    assert.deepEqual(player(f.game, f.owner).elites?.forces, player(f.shipment.after, f.owner).elites?.forces);
  }
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaDisasterStormFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaDisasterDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:stormProtection');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaDisasterDiscard') throw Error('Use the exact native disaster cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function physicalOutcome(game: Game, f: SemutaDisasterStormFixture, losses: number, eliteLosses: number) {
  assert.equal(player(game, f.owner).tanks, player(f.game, f.owner).tanks + losses);
  assert.equal(player(game, f.owner).elites?.tanks, (player(f.game, f.owner).elites?.tanks ?? 0) + eliteLosses);
  assert.equal(player(game, f.owner).forces[f.key] ?? 0, f.amount - losses);
  assert.equal(player(game, f.owner).elites?.forces[f.key] ?? 0, f.elite - eliteLosses);
  assert.equal(player(game, f.owner).forces['sietch_tabr:14'], 10);
  assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves);
  assert.equal(player(game, f.owner).elites?.reserves, player(f.game, f.owner).elites?.reserves);
  assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
  assert.equal(player(game, f.owner).shipped, player(f.game, f.owner).shipped);
  assert.equal(player(game, f.owner).moved, player(f.game, f.owner).moved);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assert.equal(game.stormResolution ?? null, null); assert.equal(game.storm, f.expectedStorm);
  assert.equal(game.phase, f.kind === 'shipment' ? 5 : 1); assert.equal(game.turn, f.game.turn);
  assert.deepEqual(game.spiceDeck, f.game.spiceDeck); assert.deepEqual(game.spiceDiscard, f.game.spiceDiscard);
  if (f.kind === 'shipment') {
    assert.equal(game.active, f.owner); assert.deepEqual(game.movementRemaining, f.game.movementRemaining);
    assert.deepEqual(game.ready, f.game.ready); assert.deepEqual(game.stormMovementSource ?? null, f.originalStormMovementSource);
  } else {
    assert.equal(game.stormMovementSource ?? null, null);
    assert.notEqual(game.response?.kind, 'stormProtection');
  }
  assert.deepEqual(inventory(game), f.originalInventory);
}
function prevented(game: Game, f: SemutaDisasterStormFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.notEqual(game.decision?.kind, 'stormLosses'); assert.notEqual(game.response?.kind, 'stormProtection');
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  const steps: { actor: string; action: Action }[] = [];
  game = finish(game, f.kind, steps);
  assert.ok(steps.every(step => step.action.type === 'decision' && step.action.done === true));
  physicalOutcome(game, f, 3, 1);
  const snapshot = structuredClone(game); assert.deepEqual(finish(game, f.kind), snapshot);
  return game;
}

for (const kind of kinds) for (const claimed of [false, true]) void test(
  `native Advanced ${kind} Storm protection cost ${claimed ? 'claim' : 'pass'} precedes full casualties and exact original continuation`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
    reject(game, f.spender, f.action);
  });

for (const kind of kinds) for (const elite of [0, 1]) void test(
  `native Advanced ${kind} allowance keeps its real half-casualty chooser and ${elite} elite loss`, () => {
    const f = fixture({ kind }); nativeSource(f);
    let game = allow(structuredClone(f.game));
    assert.equal(game.pendingTreacheryDiscard ?? null, null);
    assert.equal(game.decision?.kind, 'stormLosses');
    if (game.decision?.kind !== 'stormLosses') throw Error('Use the actual typed casualty decision');
    assert.equal(game.decision.player, f.owner); assert.equal(game.decision.key, f.key);
    assert.equal(game.decision.amount, 2); assert.equal(game.decision.minElite, 0); assert.equal(game.decision.maxElite, 1);
    assert.equal(game.decision.resume, kind === 'traversal' ? 'storm' : 'shipment');
    assert.equal(player(game, f.owner).forces[f.key], 3); assert.equal(player(game, f.owner).tanks, 0);
    assert.equal(player(game, f.owner).elites?.forces[f.key], 1);
    if (kind === 'traversal') {
      assert.equal(game.stormResolution?.traversed, 1); assert.deepEqual(game.stormResolution?.pending, []);
    } else assert.deepEqual(game.pendingArrivalReaction, f.originalArrival);
    game = act(game, f.owner, { type: 'decision', elite });
    game = finish(game, kind);
    physicalOutcome(game, f, 2, elite);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    reject(game, f.owner, { type: 'decision', elite });
  });

void test('fresh disaster costs reject stale and underlying replies without consuming the original traversal or arrival', () => {
  for (const kind of kinds) {
    const f = fixture({ kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'decision', elite: 0 });
    reject(game, f.owner, kind === 'shipment' ? f.nativeAction : { type: 'ready' });
    assert.deepEqual(physical(game), physical(f.game));
    prevented(pass(game), f, false);
  }
});

void test('the offered Fremen Storm cost rejects a mismatched queued arrival before any Semuta reply', () => {
  const f = fixture({ kind: 'shipment' }); nativeSource(f);
  // Negative receipt control after actual cost admission: the earned journey
  // and physical cohort stay intact; this does not widen native pre-cost rules.
  const game = structuredClone(open(f)), event = game.pendingTreacheryDiscard!.batch.event;
  assert.equal(game.pendingArrivalReaction?.length, 1);
  game.pendingArrivalReaction![0].amount++;
  reject(game, f.holder, { type: 'semutaCommit', event });
  reject(game, f.holder, { type: 'semutaPass', event });
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(game.pendingTreacheryDiscard?.batch.event, event);
});

void test('all four minimal policies answer both actual disaster-cost sources legally', () => {
  for (const kind of kinds) {
    const f = fixture({ kind }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
