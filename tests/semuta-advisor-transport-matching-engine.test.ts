import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import { advisorTransportMatchingKey } from '../game/advisor-transport-matching';
import { guildTransportQuote } from '../game/transport-quote';
import { junctionTransportChoice } from '../game/junction-transport-options';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import {
  createSemutaAdvisorTransportMatchingFixture as fixture, actSemutaAdvisorTransportMatching as act,
  passSemutaAdvisorTransportMatching as pass, claimSemutaAdvisorTransportMatching as claim,
  allowSemutaAdvisorTransportMatching as allow, finishSemutaAdvisorTransportMatching as finish,
  semutaAdvisorTransportMatchingPlayer as player, semutaAdvisorTransportMatchingInventory as inventory,
  semutaAdvisorTransportMatchingPhysical as physical, type SemutaAdvisorTransportMatchingFixture,
} from './fixture-semuta-advisor-transport-matching';

const kinds = ['guild', 'junction'] as const, directions = ['fightersToAdvisors', 'advisorsToFighters'] as const;
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  guildTimingGranted: game.guildTimingGranted, guildTimingLocked: game.guildTimingLocked });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorTransportMatchingFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 1);
  assert.equal(player(f.afterSetup, f.spender).forces['arrakeen:10'], 10);
  assert.equal(player(f.afterSetup, f.guild).forces['tueks_sietch:5'], 5);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), 'arrakeen'), true);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(player(f.fighterShipment.before, f.owner).spice - player(f.fighterShipment.after, f.owner).spice, 4);
  assert.deepEqual(f.fighterShipment.steps[0], { actor: f.owner, action: {
    type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0,
  } });
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.owner);
  assert.equal(player(f.game, f.owner).forces['arrakeen:10'], 1);
  assert.equal(player(f.game, f.owner).forces['imperial_basin:9'], 2);
  assert.equal(isAdvisor(player(f.game, f.owner), 'arrakeen'), true);
  assert.equal(isAdvisor(player(f.game, f.owner), 'imperial_basin'), false);
  assert.equal(player(f.game, f.owner).shipped, false); assert.equal(player(f.game, f.owner).moved, 0);
  if (f.kind === 'guild') {
    assert.equal(f.enableHomeworlds, null); assert.equal(f.game.homeworlds ?? null, null);
    assert.ok(f.nexus?.nexus && f.beforeWorm && f.wormOrder && f.alliance);
    assert.deepEqual(f.alliance.steps, [{ actor: f.owner, action: { type: 'alliance', target: f.guild } },
      { actor: f.guild, action: { type: 'alliance', target: f.owner } }]);
    assert.equal(player(f.game, f.owner).ally, f.guild); assert.equal(player(f.game, f.guild).ally, f.owner);
  } else {
    assert.ok(f.enableHomeworlds && f.junctionOffer && f.offerStep);
    assert.deepEqual(f.enableHomeworlds.steps, [{ actor: f.game.host, action: { type: 'homeworlds', enabled: true } }]);
    assert.equal(f.setup.homeworlds?.custody, null); assert.ok(f.afterSetup.homeworlds?.custody);
    assert.equal(f.nexus, null); assert.equal(f.alliance, null); assert.equal(player(f.game, f.owner).ally ?? null, null);
    assert.deepEqual(f.junctionOffer.steps, [f.offerStep]); assert.ok(f.originalOffer);
    assert.equal(f.originalOffer.recipient, f.owner);
  }
  assert.equal(f.game.nexusCards ?? null, null);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.deepEqual(f.game.response, f.originalResponse); assert.equal(f.game.response?.kind, 'advisorFlip');
  assert.deepEqual(f.game.pendingAdvisorTransportMatching, f.originalParent);
  assert.equal(f.originalParent.intent.kind, f.kind); assert.equal(f.originalParent.signature, JSON.stringify(f.originalParent.intent));
  assert.deepEqual(f.originalParent.receipt, f.originalSource); assert.equal(f.originalParent.opportunity, f.opportunity);
  assert.equal(f.originalSource.owner, f.owner); assert.equal(f.originalSource.producer, f.kind);
  assert.equal(f.originalSource.origin, f.origin); assert.equal(f.originalSource.destination, f.destination);
  assert.deepEqual(f.originalSource.group, { [f.sourceLocation]: 1 });
  assert.equal(f.originalSource.advisors, f.direction === 'fightersToAdvisors');
  assert.equal(f.denialKey, advisorTransportMatchingKey(f.originalSource, f.opportunity));
  assert.equal(f.game.pendingGuildTransport ?? null, null); assert.equal(f.game.pendingHomeworldShipment ?? null, null);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration)); assert.equal(f.price, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorTransportMatchingFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Expected the original native transport matching cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAdvisorTransportMatching, f.originalParent);
  assert.deepEqual(game.advisorTransportMatchingDenied ?? [], f.originalDenied);
  assert.deepEqual(game.junctionOffer ?? null, f.originalOffer);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function complete(game: Game, actions: { actor: string; action: Action }[] = []) {
  for (let count = 0; count < 6 && game.response &&
    (game.response.advisorTransportMatchingSource || ['guildTransportPermission', 'guildRate'].includes(game.response.kind)); count++)
    game = allow(game, actions);
  return finish(game, actions);
}
function denied(state: Game, f: SemutaAdvisorTransportMatchingFixture, claimed: boolean) {
  const game = finish(state); assert.equal(game.pendingAdvisorTransportMatching ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.deepEqual(game.junctionOffer ?? null, f.originalOffer);
  assert.deepEqual(game.advisorTransportMatchingDenied, [...f.originalDenied, { owner: f.owner, turn: game.turn, key: f.denialKey }]);
  assert.deepEqual(game.guildTransportBlocked ?? null, f.game.guildTransportBlocked ?? null);
  assert.deepEqual(game.guildRateBlocked ?? null, f.game.guildRateBlocked ?? null);
  assert.equal(player(game, f.owner).shipped, false); assert.equal(player(game, f.owner).moved, 0);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  const view = viewGame(game, f.owner); assert.equal(view.advisorTransportMatchingDenied?.length, 1);
  if (f.kind === 'guild') assert.ok(guildTransportQuote(view, f.nativeAction).unavailableReasons.some(reason => /prevented/.test(reason)));
  else assert.match(junctionTransportChoice(view, f.destinationLocation, f.nativeAction.sources as HomeworldShipmentSources).blocked ?? '', /prevented/);
  reject(game, f.owner, f.nativeAction); reject(game, f.spender, f.action);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function transferred(game: Game, f: SemutaAdvisorTransportMatchingFixture, to = f.destinationLocation, amount = 1) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAdvisorTransportMatching ?? null, null);
  assert.equal(game.pendingGuildTransport ?? null, null); assert.equal(game.pendingHomeworldShipment ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null); assert.deepEqual(clock(game), clock(f.game));
  const owner = player(game, f.owner), original = player(f.game, f.owner);
  assert.equal(owner.forces[f.sourceLocation] ?? 0, original.forces[f.sourceLocation] - amount);
  assert.equal(owner.forces[to], (original.forces[to] ?? 0) + amount);
  assert.equal(owner.spice, original.spice - f.price); assert.equal(owner.reserves, original.reserves); assert.equal(owner.tanks, original.tanks);
  assert.equal(owner.shipped, true); assert.equal(owner.moved, 0);
  assert.equal(isAdvisor(owner, to.split(':')[0]), to === f.destinationLocation ? f.originalSource.advisors : f.direction === 'advisorsToFighters');
  assert.deepEqual(game.homeworlds ?? null, f.game.homeworlds ?? null);
  for (const p of game.players.filter(p => p.id !== f.owner)) {
    const prior = player(f.game, p.id); assert.deepEqual(p.forces, prior.forces);
    assert.equal(p.reserves, prior.reserves); assert.equal(p.tanks, prior.tanks);
    assert.equal(p.spice, prior.spice + Number(f.kind === 'guild' && p.id === f.guild) * f.price);
  }
  if (f.kind === 'junction') assert.equal(game.junctionOffer ?? null, null);
  reject(game, f.owner, f.nativeAction); assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const kind of kinds) for (const direction of directions) for (const claimed of [false, true]) void test(
  `native ${kind} ${direction} matching Karama cost Semuta ${claimed ? 'claim' : 'pass'} keeps payment and packet uncommitted before a real replacement`, () => {
    const f = fixture({ kind, direction }); nativeSource(f); const offered = open(f);
    const game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    transferred(complete(act(game, f.replacementActor, f.replacementAction)), f, f.replacementLocation);
  },
);

void test('native Guild and Junction matching allowance keeps original permission rate and payment in their real order', () => {
  for (const kind of kinds) for (const direction of directions) {
    const f = fixture({ kind, direction }); nativeSource(f);
    let game = allow(structuredClone(f.game));
    if (kind === 'guild') {
      assert.equal(game.response?.kind, 'guildTransportPermission'); assert.deepEqual(physical(game), f.originalPhysical);
      game = allow(game);
      assert.ok(game.response?.kind === 'guildRate' || game.response?.kind === 'guildIncome');
      if (game.response.kind === 'guildRate') assert.deepEqual(physical(game), f.originalPhysical);
      else {
        assert.equal(player(game, f.owner).shipped, true);
        assert.equal(player(game, f.owner).forces[f.destinationLocation], player(f.game, f.owner).forces[f.destinationLocation] + 1);
        assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice - f.price);
      }
    }
    const steps: { actor: string; action: Action }[] = [], done = transferred(complete(game, steps), f);
    assert.ok(steps.every(step => step.action.type === 'passResponse' || step.action.type === 'decision'));
    assert.ok(player(done, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(done, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native transport denial permits the larger actual two-fighter matching packet in the same unused opportunity', () => {
  for (const kind of kinds) {
    const f = fixture({ kind }), game = denied(pass(open(f)), f, false); assert.ok(f.largerPacket);
    const done = complete(act(game, f.owner, f.largerPacket));
    assert.equal(player(done, f.owner).forces['arrakeen:10'], 3);
    assert.equal(player(done, f.owner).forces['imperial_basin:9'] ?? 0, 0);
    assert.equal(player(done, f.owner).spice, player(f.game, f.owner).spice - f.largerQuote!.price);
    assert.equal(player(done, f.owner).shipped, true); assert.equal(player(done, f.owner).moved, 0);
    assert.deepEqual(done.advisorTransportMatchingDenied, game.advisorTransportMatchingDenied);
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});

void test('native transport matching cost rejects stale foreign and underlying declarations while its exact cost is offered', () => {
  for (const kind of kinds) for (const direction of directions) {
    const f = fixture({ kind, direction }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.replacementAction);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'endMovement' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('controlled changed private transport intent or opportunity rejects the original matching cost before spending', () => {
  for (const kind of kinds) for (const field of ['signature', 'opportunity'] as const) {
    const f = fixture({ kind }), game = structuredClone(f.game);
    // Explicit malformed-receipt supplement only; the native primary source
    // has no installed hand, force, wallet, stance, alliance or grant.
    game.pendingAdvisorTransportMatching![field] += ':changed';
    reject(game, f.spender, f.action); assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  }
});

void test('all four minimal profiles legally claim or pass real Guild and Junction matching costs in both type directions', () => {
  for (const kind of kinds) for (const direction of directions) {
    const f = fixture({ kind, direction }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed);
      assert.ok(proposed.type === 'semutaCommit' || proposed.type === 'semutaPass'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed); const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost); game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});
