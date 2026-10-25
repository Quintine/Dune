import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteMoritaniAllianceCancellation } from '../game/moritani-alliance-cancellation';
import {
  createSemutaMoritaniAllianceFixture as fixture, actSemutaMoritaniAlliance as act,
  passSemutaMoritaniAlliance as pass, claimSemutaMoritaniAlliance as claim,
  allowSemutaMoritaniAlliance as allow, finishSemutaMoritaniAlliance as finish,
  semutaMoritaniAlliancePlayer as player, semutaMoritaniAllianceInventory as inventory,
  type SemutaMoritaniAllianceFixture,
} from './fixture-semuta-moritani-alliance';

const variants = [{ entry: 'shipment' as const }, { entry: 'movement' as const }];
const pieces = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves,
  elites: p.elites, tanks: p.tanks, leaders: p.leaders, shipped: p.shipped, moved: p.moved }));
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order, ready: game.ready,
  movementRemaining: game.movementRemaining, spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  pieces: pieces(game), balances: game.players.map(p => [p.id, p.spice]),
  allies: game.players.map(p => [p.id, p.ally, p.allySinceTurn]), offers: game.allianceOffers, aid: game.aid,
  terror: game.moritaniTerror, arrival: game.pendingArrivalReaction,
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaMoritaniAllianceFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, false); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'moritani', 'emperor', 'guild']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.owner).forces['oh_gap:9'], 6);
  assert.equal(Object.keys(player(f.afterSetup, f.entrant).forces).length, 0);
  assert.equal(Object.keys(player(f.afterSetup, f.richese).forces).length, 0);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.placement.before.turn, 1); assert.equal(f.placement.before.phase, 8);
  assert.ok(f.placement.steps.some(step => step.actor === f.owner && step.action.type === 'decision' &&
    step.action.token === f.token && step.action.territory === f.territory));
  const placed = f.placement.after.moritaniTerror!.tokens.find(token => token.id === f.token);
  assert.equal(placed?.kind, 'robbery'); assert.equal(placed?.status, 'placed'); assert.equal(placed?.location, f.territory);
  assert.equal(f.originalTerror.placementTurn, 1);
  assert.ok(f.paidShipment.steps.some(step => step.actor === f.entrant && step.action.type === 'ship' && step.action.amount === 1));
  assert.equal(player(f.paidShipment.before, f.entrant).spice - player(f.paidShipment.after, f.entrant).spice, f.price);
  assert.equal(player(f.paidShipment.after, f.guild).spice - player(f.paidShipment.before, f.guild).spice, f.price,
    'The ordinary shipment pays its actual tariff to the native Guild');
  assert.equal(player(f.paidShipment.before, f.entrant).reserves - player(f.paidShipment.after, f.entrant).reserves, 1);
  assert.equal(f.price, f.entryKind === 'shipment' ? 1 : 2);
  assert.equal(f.entry.steps[0].actor, f.entrant); assert.deepEqual(f.entry.steps[0].action, f.entryAction);
  if (f.entryKind === 'movement') {
    assert.equal(player(f.entry.before, f.entrant).forces[f.origin], 1);
    assert.equal(player(f.game, f.entrant).forces[f.origin] ?? 0, 0);
    assert.ok(f.entry.steps.some(step => step.action.type === 'move'));
  }
  assert.equal(player(f.game, f.entrant).forces[f.location], 1);
  assert.equal(player(f.game, f.entrant).shipped, true); assert.equal(player(f.game, f.entrant).moved, Number(f.entryKind === 'movement'));
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.advanced, false);
  assert.deepEqual(f.offer.steps, [{ actor: f.owner, action: f.offerAction }]);
  assert.equal(f.game.response?.kind, 'moritaniAlliance'); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.originalEntry.stage, 'allianceResponse'); assert.equal(f.originalEntry.cause, f.entryKind);
  assert.equal(f.originalEntry.amount, 1); assert.equal(f.originalEntry.elite, 0); assert.equal(f.originalEntry.entrant, f.entrant);
  assert.equal(f.originalEntry.territory, f.territory); assert.equal(f.originalEntry.token, f.token);
  assert.deepEqual(f.game.pendingTerrorEntry, f.originalEntry); assert.deepEqual(f.game.moritaniTerror, f.originalTerror);
  assert.equal(player(f.game, f.owner).ally, null); assert.equal(player(f.game, f.entrant).ally, null);
  assert.deepEqual(f.game.allianceOffers, f.originalOffers);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaMoritaniAllianceFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaEcazMoritaniDiscard');
  if (pending.continuation.kind !== 'karamaEcazMoritaniDiscard') throw Error('Use the actual Moritani alliance cost');
  assert.equal(pending.batch.cause, 'karama:moritaniAlliance'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingTerrorEntry, f.originalEntry); assert.deepEqual(physical(game), physical(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaMoritaniAllianceFixture, claimed: boolean) {
  const quote = quoteMoritaniAllianceCancellation(f.game, f.originalResponse); assert.ok(quote);
  assert.equal(state.pendingTreacheryDiscard ?? null, null); assert.equal(state.response ?? null, null);
  assert.deepEqual(state.pendingTerrorEntry, quote.entry); assert.deepEqual(state.decision, quote.decision);
  assert.deepEqual(physical(state), physical(f.game)); assert.deepEqual(state.moritaniTerror, f.originalTerror);
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.deepEqual(steps, []); assert.deepEqual(game.decision, quote.decision);
  assert.equal(game.pendingTerrorEntry?.stage, 'offer'); assert.equal(game.pendingTerrorEntry?.allianceBlocked, true);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.owner, f.offerAction); reject(game, f.spender, f.action);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function revealOnce(source: Game, f: SemutaMoritaniAllianceFixture) {
  let game = act(source, f.revealActor, f.revealAction);
  assert.equal(game.pendingTerrorEntry?.stage, 'robbery'); assert.equal(game.decision?.player, f.owner);
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === f.token)?.status, 'removed');
  assert.deepEqual(pieces(game), pieces(f.game));
  const amount = Math.ceil(player(game, f.entrant).spice / 2), before = structuredClone(game);
  assert.ok(amount > 0); game = act(game, f.robberyActor, f.robberyAction);
  assert.equal(player(game, f.entrant).spice, player(before, f.entrant).spice - amount);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice + amount);
  for (const p of game.players.filter(p => ![f.owner, f.entrant].includes(p.id)))
    assert.equal(p.spice, player(before, p.id).spice);
  assert.deepEqual(pieces(game), pieces(f.game)); assert.equal(game.pendingTerrorEntry ?? null, null);
  assert.equal(game.turn, f.game.turn); assert.equal(game.phase, f.game.phase); assert.equal(game.active, f.entrant);
  assert.equal(player(game, f.owner).ally, null); assert.equal(player(game, f.entrant).ally, null);
  assert.deepEqual(game.allianceOffers, f.originalOffers);
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === f.token)?.status, 'removed');
  reject(game, f.owner, f.revealAction); reject(game, f.owner, f.robberyAction);
  reject(game, f.entrant, f.entryAction); assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `Basic native Enemy of My Enemy after actual ${variant.entry} cost Semuta ${claimed ? 'claim' : 'pass'} restores the original reveal choice and resolves Robbery once`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    revealOnce(game, f);
  },
);

void test('native Enemy of My Enemy allowance leaves the committed entry in place and lets the entrant actually accept the alliance', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); let game = allow(structuredClone(f.game));
    assert.equal(game.pendingTerrorEntry?.stage, 'allianceReply'); assert.equal(game.decision?.player, f.entrant);
    assert.deepEqual(physical(game), physical(f.game)); assert.equal(game.pendingTreacheryDiscard ?? null, null);
    game = act(game, f.acceptActor, f.acceptAction);
    assert.equal(player(game, f.owner).ally, f.entrant); assert.equal(player(game, f.entrant).ally, f.owner);
    assert.equal(player(game, f.owner).allySinceTurn, 2); assert.equal(player(game, f.entrant).allySinceTurn, 2);
    assert.equal(game.pendingTerrorEntry ?? null, null); assert.deepEqual(pieces(game), pieces(f.game));
    assert.deepEqual(game.players.map(p => [p.id, p.spice]), f.game.players.map(p => [p.id, p.spice]));
    assert.equal(game.moritaniTerror!.tokens.find(token => token.kind === 'robbery')?.status, 'available');
    assert.equal(game.moritaniTerror!.tokens.filter(token => token.status === 'placed' && token.location === f.territory).length, 0);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.acceptActor, f.acceptAction);
  }
});

void test('after prevented Enemy of My Enemy Moritani may really decline and retain the original hidden token', () => {
  for (const variant of variants) {
    const f = fixture(variant), state = canceled(pass(open(f)), f, false);
    const game = act(state, f.declineActor, f.declineAction);
    assert.equal(game.pendingTerrorEntry ?? null, null); assert.deepEqual(game.moritaniTerror, f.originalTerror);
    assert.deepEqual(physical(game), physical(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
    reject(game, f.owner, f.revealAction); reject(game, f.entrant, f.entryAction);
  }
});

void test('fresh Enemy of My Enemy cost rejects stale and underlying choices while the original hidden-token offer stays parked', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.holder, { type: 'semutaSelect', event, card: f.token });
    reject(game, f.owner, f.offerAction); reject(game, f.revealActor, f.revealAction);
    reject(game, f.declineActor, f.declineAction); reject(game, f.acceptActor, f.acceptAction);
    reject(game, f.spender, { type: 'passResponse' }); reject(game, f.entrant, { type: 'endMovement' });
    assert.deepEqual(game.pendingTerrorEntry, f.originalEntry); assert.deepEqual(physical(game), physical(f.game));
    canceled(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer native committed-shipment and ground-entry alliance costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit');
      assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      canceled(game, f, claimed);
    }
  }
});
