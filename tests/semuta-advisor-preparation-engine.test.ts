import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAdvisorPreparationFixture as fixture, actSemutaAdvisorPreparation as act,
  passSemutaAdvisorPreparation as pass, claimSemutaAdvisorPreparation as claim,
  allowSemutaAdvisorPreparation as allow, finishSemutaAdvisorPreparation as finish,
  semutaAdvisorPreparationPlayer as player, semutaAdvisorPreparationInventory as inventory,
  type SemutaAdvisorPreparationFixture,
} from './fixture-semuta-advisor-preparation';

const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active, ready: game.ready,
  auction: game.auction, richeseAuction: game.richeseAuction, richeseBidding: game.richeseBidding,
  movementRemaining: game.movementRemaining, spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
    tanks: player.tanks, forces: player.forces, elites: player.elites, leaders: player.leaders,
    shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorPreparationFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'predict'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === f.territory && step.action.sector === f.sector));
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(player(f.afterSetup, f.atreides).forces[f.location], 10);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.game.phase, 3); assert.equal(f.game.turn, 1); assert.ok(f.game.auction);
  assert.deepEqual(f.originalPreparation, { turn: 1, firstShipment: null, deniedTerritories: [] });
  assert.ok(f.game.players.every(player => !player.shipped && player.moved === 0));
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.game.response?.advisorResume, 'preparation');
  assert.deepEqual(f.game.response?.advisorPreparationSource, f.preparation);
  assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaAdvisorPreparationFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original native advisor-flip cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.advisorPreparation, f.originalPreparation);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), true);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function prevented(game: Game, f: SemutaAdvisorPreparationFixture, claimed: boolean) {
  game = finish(game);
  assert.deepEqual(physical(game), physical(f.game));
  assert.equal(isAdvisor(player(game, f.owner), f.territory), true);
  assert.deepEqual(player(game, f.owner).advisors, player(f.game, f.owner).advisors);
  assert.deepEqual(game.advisorPreparation, { ...f.originalPreparation, deniedTerritories: [f.territory] });
  assert.equal(player(game, f.owner).advisorFlipMovementBlocked, undefined);
  assert.equal(game.log.filter(entry => entry.text.includes('advisor preparation in Arrakeen was prevented')).length,
    f.originalHistory.filter(entry => entry.text.includes('advisor preparation in Arrakeen was prevented')).length + 1);
  assert.ok(viewGame(game, f.owner).advisorPreparation?.blocked?.includes('Karama'));
  reject(game, f.owner, f.nativeAction);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const claimed of [false, true]) void test(
  `Advanced native advisor preparation used cancellation cost ${claimed ? 'claim' : 'pass'} denies only its territory and preserves the original auction`, () => {
    const f = fixture(); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    const before = structuredClone(game); assert.equal(finish(game), game); assert.deepEqual(game, before);
  });

void test('Advanced native advisor preparation allowance actually converts the original whole group without advancing its auction', () => {
  const f = fixture(); nativeSource(f);
  const game = allow(structuredClone(f.game));
  assert.deepEqual(physical(game), physical(f.game));
  assert.deepEqual(game.advisorPreparation, f.originalPreparation);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), false);
  assert.equal(player(game, f.owner).forces[f.location], 1);
  assert.equal(player(game, f.atreides).forces[f.location], 10);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('fresh advisor preparation costs reject stale and underlying controls while the original pre-shipment source stays parked', () => {
  const f = fixture(), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(game, f.spender, { type: 'semutaCommit', event });
  reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
  reject(game, f.owner, f.nativeAction);
  assert.ok(game.auction);
  reject(game, game.auction.active!, { type: 'bid', amount: 0, allyPayment: 0 });
  assert.deepEqual(game.advisorPreparation, f.originalPreparation);
  assert.deepEqual(physical(game), physical(f.game));
  prevented(pass(game), f, false);
});

void test('a changed advisor preparation source rejects before its physical Karama is spent', () => {
  const f = fixture();
  const game = structuredClone(f.game); assert.ok(game.response?.advisorPreparationSource);
  game.response.advisorPreparationSource.turn++;
  reject(game, f.spender, f.action);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(game.discard.some(card => card.id === f.cost), false);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
});

void test('all four minimal policies answer the actual Advanced advisor preparation cost legally', () => {
  const f = fixture(), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
});
