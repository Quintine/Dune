import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteMovementPhaseStart } from '../game/movement-phase-quote';
import {
  createSemutaSpiritualForesightFixture as fixture, actSemutaSpiritualForesight as act,
  passSemutaSpiritualForesight as pass, claimSemutaSpiritualForesight as claim,
  semutaSpiritualForesightInventory as inventory, semutaSpiritualForesightPlayer as player,
  type SemutaSpiritualForesightFixture,
} from './fixture-semuta-spiritual-foresight';

const resources = (game: Game) => ({
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    moved: player.moved, shipped: player.shipped, revived: player.revived, ally: player.ally,
    advisors: player.advisors })),
  active: game.active, order: game.order, ready: game.ready,
  turn: game.turn, phase: game.phase, movementRemaining: game.movementRemaining,
  guildTimingGranted: game.guildTimingGranted, guildTimingLocked: game.guildTimingLocked,
  advisorPreparation: game.advisorPreparation,
});
const variants = [
  { kind: 'advisor' as const, advanced: false },
  { kind: 'atreidesSpice' as const, advanced: false },
  { kind: 'atreidesSpice' as const, advanced: true },
];
const openingVariants = [
  { kind: 'atreidesSpice' as const, advanced: true, openingDecision: 'advisorBattle' as const },
  { kind: 'atreidesSpice' as const, advanced: true, openingDecision: 'guildTiming' as const },
];
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function nativeSource(f: SemutaSpiritualForesightFixture) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquisition.after, f.holder).hand.some(card => card.id === f.semuta));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 1);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening ?? null, null); assert.deepEqual(f.game.decision, f.originalDecision);
  if (f.openingDecision) assert.equal(f.originalDecision?.kind, f.openingDecision);
  else assert.equal(f.originalDecision, null);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
  if (f.kind === 'advisor') {
    assert.ok(f.shipment && f.beforeShipment && f.advisorChoice);
    assert.equal(f.game.advanced, false);
    assert.equal(player(f.beforeShipment, f.spender).spice - player(f.game, f.spender).spice, 2);
    assert.equal(player(f.beforeShipment, f.spender).reserves - player(f.game, f.spender).reserves, 1);
    assert.equal(player(f.game, f.spender).forces['polar_sink:0'], 1);
    assert.equal(player(f.game, f.spender).shipped, true);
    assert.equal(player(f.game, f.spender).moved, 0);
    assert.equal(f.game.response?.spiritualAdvisorSource, undefined);
    assert.equal(f.game.response?.advisorAmbassadorEvent, undefined);
    assert.equal(f.game.response?.advisorRevivalEvent, undefined);
    assert.ok(!f.game.pendingSpiritualAdvisor);
  } else {
    assert.equal(f.game.spicePeekKnown, false);
    assert.deepEqual(f.game.spiceDeck, f.beforeMovement.spiceDeck);
    assert.deepEqual(f.game.spiceDiscard, f.beforeMovement.spiceDiscard);
  }
}
function open(f: SemutaSpiritualForesightFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'karamaTerminalDiscard');
  assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ id: entry.card.id, by: entry.discardedBy, public: entry.publicFace })),
    [{ id: f.cost, by: f.spender, public: true }]);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.response, null, 'The original terminal response waits for its cost reaction');
  assert.equal(game.decision, null, 'The coexisting native opening decision is parked while the cost is fresh');
  assert.deepEqual(game.pendingArrivalReaction, f.game.pendingArrivalReaction,
    'The original paid shipment entry waits through the cost response');
  if (pending.continuation.kind !== 'karamaTerminalDiscard') throw Error('Use the terminal cost continuation');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.equal(pending.continuation.use.kind, 'cancel');
  assert.equal(pending.continuation.use.response.kind, f.kind);
  assert.equal(pending.continuation.use.response.owner, f.owner);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.decision, f.originalDecision);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(game.spiceDeck, f.game.spiceDeck);
  assert.deepEqual(game.spiceDiscard, f.game.spiceDiscard);
  assert.equal(game.spicePeekKnown, f.game.spicePeekKnown);
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}
function prevented(game: Game, f: SemutaSpiritualForesightFixture, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard); assert.ok(!game.pendingKarama);
  assert.equal(game.response, null); assert.equal(game.phaseOpening ?? null, null);
  assert.deepEqual(game.decision, f.originalDecision);
  // The spender's physical cost is intentionally absent from its hand; all
  // native force/payment/phase source fields stay unchanged.
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(game.spiceDeck, f.game.spiceDeck);
  assert.deepEqual(game.spiceDiscard, f.game.spiceDiscard);
  assert.equal(game.spicePeekKnown, f.game.spicePeekKnown);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.kind === 'advisor') {
    assert.ok(f.beforeShipment);
    assert.equal(f.game.pendingArrivalReaction?.length, 1);
    assert.equal(game.pendingArrivalReaction, null,
      'Native continuation consumes the original paid entry once after prevention');
    assert.deepEqual(player(game, f.owner), player(f.game, f.owner));
    assert.equal(player(game, f.spender).forces['polar_sink:0'], 1);
    assert.equal(player(game, f.spender).shipped, true);
    assert.equal(player(game, f.spender).moved, 0);
    assert.equal(player(f.beforeShipment, f.spender).spice - player(game, f.spender).spice, 2);
    assert.ok(!game.pendingSpiritualAdvisor);
  } else assert.equal(game.spicePeekKnown, false);
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} genuine ${variant.kind} cancellation offers its printed cost for Semuta ${claimed ? 'claim' : 'pass'}`, () => {
    const f = fixture(variant); nativeSource(f);
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(pending, f) : pass(pending), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
  });

for (const variant of openingVariants) for (const claimed of [false, true]) void test(
  `Advanced foresight ${claimed ? 'claimed' : 'passed'} cost restores the actual unanswered ${variant.openingDecision} opening`, () => {
    const f = fixture(variant); nativeSource(f);
    const original = f.originalDecision; assert.ok(original);
    assert.equal(original.kind, variant.openingDecision);
    const beforeQuote = quoteMovementPhaseStart(f.game);
    assert.equal(beforeQuote.kind, 'initialize');
    if (beforeQuote.kind !== 'initialize') throw Error('The source must be its actual movement opening');
    assert.deepEqual(beforeQuote.decision, original);
    if (original.kind === 'advisorBattle') {
      assert.equal(original.player, f.bg);
      assert.ok(original.territories.includes('arrakeen'));
      assert.equal(player(f.afterSetup, f.bg).forces['arrakeen:10'], 1);
      assert.ok(player(f.afterSetup, f.bg).advisors?.arrakeen);
    } else {
      assert.equal(original.kind, 'guildTiming');
      assert.equal(original.player, 'guild');
      assert.equal(f.game.players.some(player => player.faction === 'beneGesserit'), false);
      assert.ok(f.game.players.some(player => player.id === original.player && player.faction === 'guild'));
    }
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const underlying: Action = original.kind === 'advisorBattle'
      ? { type: 'decision', accept: false } : { type: 'decision', take: false };
    reject(pending, original.player, underlying);
    const game = prevented(claimed ? claim(pending, f) : pass(pending), f, claimed);
    assert.deepEqual(game.decision, original, 'Neither the used-cost child nor prevention answers or regenerates the native decision');
    const afterQuote = quoteMovementPhaseStart(game);
    assert.equal(afterQuote.kind, 'initialize');
    if (afterQuote.kind !== 'initialize') throw Error('The original movement opening must remain available');
    assert.deepEqual(afterQuote.decision, original);
    reject(game, f.holder, { type: 'semutaCommit', event });
  });

for (const variant of variants) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind} allowance control earns the actual packet or peek without spending either card`, () => {
    const f = fixture(variant); nativeSource(f);
    let game = structuredClone(f.game);
    for (let count = 0; game.response?.kind === f.kind && count < game.players.length; count++) {
      const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
      game = act(game, actor.id, { type: 'passResponse' });
    }
    assert.equal(game.response, null); assert.ok(!game.pendingTreacheryDiscard);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(game.spiceDeck, f.game.spiceDeck); assert.deepEqual(game.spiceDiscard, f.game.spiceDiscard);
    if (f.kind === 'advisor') {
      assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves - 1);
      assert.equal(player(game, f.owner).forces['polar_sink:0'], (player(f.game, f.owner).forces['polar_sink:0'] ?? 0) + 1);
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
      assert.deepEqual(player(game, f.spender), player(f.game, f.spender));
    } else {
      assert.equal(game.spicePeekKnown, true);
      assert.deepEqual(resources(game), resources(f.game));
    }
    assert.deepEqual(inventory(game), f.originalInventory);
  });

void test('actual terminal-cost suspension rejects underlying replies and stale Semuta events without replaying the source', () => {
  for (const variant of variants) {
    const f = fixture(variant), pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    reject(pending, f.spender, f.action);
    reject(pending, f.owner, { type: 'passResponse' });
    reject(pending, pending.active!, { type: 'endMovement' });
    const game = prevented(claim(pending, f), f, true);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
  }
});

void test('all four minimal policies resolve each real terminal-cost source without repeating shipment or drawing Spice', () => {
  for (const variant of [...variants, ...openingVariants]) {
    const f = fixture(variant), pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(pending, f.holder);
      own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
      assert.equal(action.event, event);
      let game = act(structuredClone(pending), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
