import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES } from '../game/board';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { holdSemutaHomeworldChoamCard, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import {
  actSaphoStartedMovement as act,
  advanceSaphoStartedMovement as advance,
  createSaphoStartedMovementFixture as fixture,
  saphoStartedMovementAction as saphoAction,
  saphoStartedMovementClean as clean,
  saphoStartedMovementInventory as inventory,
  saphoStartedMovementPlayer as player,
} from './fixture-sapho-started-movement';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Reach Emperor's actual turn after Richese's original paid shipment and
 * completed earlier turns. Only the inherited unopened setup/deck choices and
 * genuine public actions are used; no post-deal player or queue is staged. */
function source() {
  const f = fixture();
  let game = advance(structuredClone(f.game), state =>
    state.phase === 5 && clean(state) && state.active === f.owner);
  assert.equal(player(game, f.owner).shipped, false);
  assert.equal(player(game, f.owner).moved, 0);
  assert.ok(game.movementRemaining?.some(id => id !== f.owner));
  const prior = saphoAction(game, 'last', f.owner);
  const beforeShipment = structuredClone(game);
  const declared = act(game, f.owner, {
    type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0,
  });
  game = advance(declared, clean);
  assert.equal(game.active, f.owner);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  assert.equal(player(beforeShipment, f.owner).reserves - player(game, f.owner).reserves, 1);
  assert.equal(player(beforeShipment, f.owner).spice - player(game, f.owner).spice, 2);
  assert.equal(player(game, f.owner).forces['polar_sink:0'], 1);
  assert.deepEqual(inventory(game), f.originalInventory);
  return { f, game, prior, beforeShipment, declared };
}

void test('Basic Sapho last suspends the holder after a real paid shipment and resumes its movement once', () => {
  const { f, game: original, prior } = source();
  const option = viewGame(original, f.owner).saphoOptions.find(row => row.scope === 'movement' && row.mode === 'last');
  assert.ok(option, 'The holder can put its already-started turn last after the shipment finishes');
  const proposed: Action = { type: 'card', card: f.card, scope: option.scope, mode: option.mode, event: option.event };
  assert.notEqual(option.event, prior.event);
  reject(original, f.owner, prior);
  const before = structuredClone(player(original, f.owner));
  let game = advance(act(original, f.owner, proposed), clean);
  assert.equal(game.active, f.guild, 'The original next Guild turn precedes the suspended owner');
  assert.ok(game.movementRemaining?.includes(f.owner));
  assert.equal(game.saphoMovementLast?.player, f.owner);
  assert.equal(player(game, f.owner).spice, before.spice);
  assert.equal(player(game, f.owner).reserves, before.reserves);
  assert.deepEqual(player(game, f.owner).forces, before.forces);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);

  game = advance(game, state => state.phase === 5 && clean(state) && state.active === f.owner);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  assert.equal(player(game, f.owner).forces['polar_sink:0'], 1);
  reject(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
  game = act(game, f.owner, { type: 'endMovement' });
  assert.notEqual(game.phase, 5);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('Basic own-last cannot be played while the original shipment is awaiting an owned continuation', () => {
  const { f, prior, declared } = source();
  assert.ok(!clean(declared), 'The actual paid shipment opens an original response');
  assert.equal(viewGame(declared, f.owner).saphoOptions.some(row => row.scope === 'movement'), false);
  reject(declared, f.owner, prior);
  assert.ok(player(declared, f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(declared), f.originalInventory);
});

void test('Basic own-last preserves a completed ground movement without granting another', () => {
  const { f, game: original } = source();
  let moved: Game | undefined;
  let destination: string | undefined;
  for (const place of TERRITORIES) {
    for (const sector of place.sectors) {
      try {
        moved = act(original, f.owner, { type: 'move', from: 'polar_sink:0', territory: place.id,
          sector, amount: 1, elite: 0 });
        destination = `${place.id}:${sector}`;
        break;
      } catch { /* Try another physical destination using the native validator. */ }
    }
    if (moved) break;
  }
  assert.ok(moved && destination, 'The real force has at least one legal movement');
  let game = advance(moved, clean);
  assert.equal(player(game, f.owner).moved, 1);
  const action = saphoAction(game, 'last', f.owner);
  game = advance(act(game, f.owner, action), clean);
  game = advance(game, state => state.phase === 5 && clean(state) && state.active === f.owner);
  assert.equal(player(game, f.owner).moved, 1);
  assert.equal(player(game, f.owner).forces[destination], 1);
  reject(game, f.owner, { type: 'move', from: destination, territory: 'polar_sink', sector: 0, amount: 1, elite: 0 });
  game = act(game, f.owner, { type: 'endMovement' });
  assert.notEqual(game.phase, 5);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('the minimal bot can use the actual Basic own-last opportunity', () => {
  const { f, game } = source();
  const view = viewGame(game, f.owner);
  view.players.find(seat => seat.id === f.owner)!.bot = 'Easy';
  const action = botActions(view).find(candidate => candidate.type === 'card' && candidate.card === f.card &&
    candidate.scope === 'movement' && candidate.mode === 'last');
  assert.ok(action);
  const next = advance(act(structuredClone(game), f.owner, action), clean);
  assert.notEqual(next.active, f.owner);
  assert.equal(player(next, f.owner).shipped, true);
  assert.deepEqual(inventory(next), f.originalInventory);
});

for (const claim of [false, true]) {
  void test(`a conserved physical Semuta ${claim ? 'claim' : 'pass'} resumes the same suspended Basic turn`, () => {
    const { f, game: original } = source();
    const game = structuredClone(original);
    // Controlled supplemental custody: move the original drug to Richese;
    // no physical card is minted, and the paid shipment remains a real action.
    holdSemutaHomeworldChoamCard(game, 'richese', 'Semuta Drug');
    assert.deepEqual(inventory(game), f.originalInventory);
    const action = saphoAction(game, 'last', f.owner);
    const offered = act(game, f.owner, action);
    assert.ok(offered.pendingTreacheryDiscard);
    assert.equal(offered.active, f.owner);
    assert.equal(viewGame(offered, 'richese').semutaReaction?.canCommit, true);
    const resumed = reactSemutaHomeworldChoam(offered, 'richese', claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.active, f.guild);
    assert.equal(player(resumed, f.owner).shipped, true);
    assert.equal(player(resumed, 'richese').hand.some(card => card.id === f.card), claim);
    assert.equal(resumed.discard.some(card => card.id === SEMUTA_DRUG_ID), claim);
    assert.deepEqual(inventory(resumed), f.originalInventory);
    const returned = advance(resumed, state => state.phase === 5 && clean(state) && state.active === f.owner);
    assert.equal(player(returned, f.owner).shipped, true);
    reject(returned, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
  });
}
