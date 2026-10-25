import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaStormDancerFixture as fixture, actSemutaStormDancer as act,
  passSemutaStormDancer as pass, claimSemutaStormDancer as claim, allowSemutaStormDancer as allow,
  semutaStormDancerPlayer as player, semutaStormDancerInventory as inventory,
  semutaStormDancerTraitors as traitors, type SemutaStormDancerFixture,
} from './fixture-semuta-storm-dancer';

/** Knowledge source and native replacement/physical state, excluding the two
 * exact hands/discard positions which the Semuta exchange intentionally moves. */
const fixed = (game: Game) => ({ turn: game.turn, phase: game.phase, order: game.order, active: game.active,
  ready: game.ready, phaseOpening: game.phaseOpening, deck: game.deck, richeseCache: game.richeseCache,
  richeseRemoved: game.richeseRemoved, storm: game.storm, stormCard: game.stormCard, stormCardKnown: game.stormCardKnown,
  stormPending: game.stormPending, stormResolution: game.stormResolution, stormMovementSource: game.stormMovementSource,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard, traitorReserve: game.traitorReserve,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, tanks: p.tanks,
    forces: p.forces, elites: p.elites, shipped: p.shipped, moved: p.moved, revived: p.revived,
    faceDancers: p.faceDancers, faceDancerReplacedTurn: p.faceDancerReplacedTurn })) });
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaStormDancerFixture) {
  assert.equal(f.setup.advanced, f.advanced); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(f.faceDancerDeal); assert.equal(player(f.afterSetup, f.dancer).faceDancers!.length, 3);
  assert.deepEqual(player(f.game, f.dancer).faceDancers, f.originalFaceDancers);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening, null);
  if (f.kind === 'faceDancerReplacement') {
    assert.equal(f.game.phase, 8); assert.equal(f.game.turn, 1); assert.ok(f.candidate && f.replacementAction);
    assert.deepEqual(f.replacementAction, { type: 'replaceFaceDancer', leader: f.candidate });
    assert.equal(player(f.trigger.before, f.dancer).faceDancerReplacedTurn, undefined);
    assert.equal(player(f.game, f.dancer).faceDancerReplacedTurn, f.game.turn);
    assert.deepEqual(f.game.traitorReserve, f.trigger.before.traitorReserve);
    assert.equal(f.game.response?.intent, f.candidate);
  } else {
    assert.equal(f.game.phase, 1); assert.equal(f.game.turn, 2); assert.equal(f.advanced, true);
    assert.ok(f.opening && f.beforeOpening);
    assert.deepEqual(f.coexistentOpening, { passed: [], initialize: false });
    assert.equal(f.opening.steps.length, f.game.players.length);
    assert.ok(f.opening.steps.every(step => step.action.type === 'ready'));
    assert.deepEqual(new Set(f.opening.steps.map(step => step.actor)), new Set(f.game.players.map(p => p.id)));
    assert.deepEqual(f.game.response, f.beforeOpening.response);
    assert.equal(f.game.stormCard, f.beforeOpening.stormCard); assert.equal(f.game.stormCardKnown, false);
    assert.equal(viewGame(f.game, f.owner).stormForecast, null);
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 57);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.deepEqual(traitors(f.game), f.originalTraitors);
}
function open(f: SemutaStormDancerFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.continuation.kind, 'karamaTerminalDiscard');
  if (pending.continuation.kind !== 'karamaTerminalDiscard') throw Error('Expected the exact terminal cancellation cost');
  assert.deepEqual(pending.continuation.use.response, f.game.response);
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.equal(game.response, null); assert.equal(game.phaseOpening, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(fixed(game), fixed(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true); return game;
}
function denied(game: Game, f: SemutaStormDancerFixture, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard); assert.equal(game.response, null); assert.equal(game.decision, null);
  assert.deepEqual(fixed(game), fixed(f.game));
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.kind === 'faceDancerReplacement') {
    assert.equal(player(game, f.owner).faceDancerReplacedTurn, game.turn);
    assert.deepEqual(player(game, f.owner).faceDancers, f.originalFaceDancers);
    assert.deepEqual(game.traitorReserve, f.game.traitorReserve);
    for (const card of f.originalFaceDancers) reject(game, f.owner, { type: 'replaceFaceDancer', leader: card.leader });
  } else {
    assert.equal(game.stormCardKnown, false); assert.equal(game.stormCard, f.stormCard);
    assert.equal(viewGame(game, f.owner).stormForecast, null);
  }
  reject(game, f.spender, f.action); return game;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native Face Dancer replacement cost Semuta ${claimed ? 'claim' : 'pass'} preserves original cards, reserve order and spent attempt`, () => {
    const f = fixture({ kind: 'faceDancerReplacement', advanced }); nativeSource(f);
    const offered = open(f), game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    const ready = act(game, f.game.players[0].id, { type: 'ready' });
    assert.equal(ready.phase, 8); assert.equal(ready.turn, 1);
    assert.deepEqual(player(ready, f.owner).faceDancers, f.originalFaceDancers);
    assert.deepEqual(ready.traitorReserve, f.game.traitorReserve);
    assert.equal(player(ready, f.owner).faceDancerReplacedTurn, 1);
    assert.deepEqual(ready.ready, [f.game.players[0].id]);
  },
);

for (const claimed of [false, true]) void test(
  `Advanced native next-Storm cost Semuta ${claimed ? 'claim' : 'pass'} preserves the actual next card and denies its knowledge once`, () => {
    const f = fixture({ kind: 'stormPeek' }); nativeSource(f);
    const offered = open(f), game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    const ready = act(game, f.game.players[0].id, { type: 'ready' });
    assert.equal(ready.phase, 1); assert.equal(ready.turn, 2);
    assert.equal(ready.phaseOpening, null); assert.equal(ready.stormCard, f.stormCard); assert.equal(ready.stormCardKnown, false);
    assert.equal(viewGame(ready, f.owner).stormForecast, null);
    assert.deepEqual(ready.spiceDeck, f.game.spiceDeck); assert.deepEqual(ready.deck, f.game.deck);
    assert.deepEqual(ready.ready, [f.game.players[0].id]);
  },
);

void test('the genuine next-Storm forecast retains native false-opening priority before its original counter', () => {
  const f = fixture({ kind: 'stormPeek' }); nativeSource(f); assert.ok(f.beforeOpening && f.opening);
  reject(f.beforeOpening, f.spender, f.action);
  assert.deepEqual(f.beforeOpening.phaseOpening, { passed: [], initialize: false });
  assert.ok(player(f.beforeOpening, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.beforeOpening, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.opening.after.phaseOpening, null); assert.deepEqual(f.opening.after.response, f.beforeOpening.response);
  assert.equal(f.opening.after.stormCard, f.beforeOpening.stormCard);
  assert.deepEqual(f.opening.after.spiceDeck, f.beforeOpening.spiceDeck);
});

void test('the original forecast and replacement allowance still resolve through their genuine native responses', () => {
  for (const options of [{ kind: 'stormPeek' as const },
    { kind: 'faceDancerReplacement' as const, advanced: false }, { kind: 'faceDancerReplacement' as const, advanced: true }]) {
    const f = fixture(options), game = allow(structuredClone(f.game));
    assert.equal(game.response, null); assert.ok(!game.pendingTreacheryDiscard);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
    if (f.kind === 'stormPeek') {
      assert.equal(game.stormCard, f.stormCard); assert.equal(game.stormCardKnown, true);
      assert.equal(viewGame(game, f.owner).stormForecast, f.stormCard);
      assert.deepEqual(game.deck, f.game.deck); assert.deepEqual(game.spiceDeck, f.game.spiceDeck);
    } else {
      assert.equal(player(game, f.owner).faceDancers!.filter((card, index) =>
        card.leader !== f.originalFaceDancers[index].leader).length, 1);
      assert.equal(player(game, f.owner).faceDancerReplacedTurn, game.turn);
      assert.ok(game.traitorReserve!.includes(f.candidate!));
      reject(game, f.owner, f.replacementAction!);
    }
  }
});

void test('terminal-cost windows reject stale, foreign and underlying replies without leaking another native opportunity', () => {
  for (const options of [{ kind: 'stormPeek' as const },
    { kind: 'faceDancerReplacement' as const, advanced: false }, { kind: 'faceDancerReplacement' as const, advanced: true }]) {
    const f = fixture(options), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.owner, f.replacementAction ?? { type: 'ready' });
    const done = denied(pass(game), f, false);
    reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally answer native forecast and Basic or Advanced Face Dancer cancellation costs', () => {
  for (const options of [{ kind: 'stormPeek' as const },
    { kind: 'faceDancerReplacement' as const, advanced: false }, { kind: 'faceDancerReplacement' as const, advanced: true }]) {
    const f = fixture(options), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
