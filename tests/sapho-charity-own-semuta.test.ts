import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actSaphoCharityOrder as act, advanceSaphoCharityOrder as advance,
  createSaphoCharitySemutaFixture as fixture, reactSaphoCharitySemuta as react,
  saphoCharityOrderClean as clean, saphoCharityOrderInventory as inventory,
  saphoCharityOrderPlayer as player,
} from './fixture-sapho-charity-order';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** CONTROLLED supplemental custody: the inherited setup conserves original
 * Sapho/Semuta cards rather than earning their purchase, then only the one
 * physical Sapho is transferred to the eventual native Charity claimant. If
 * that hand is full, one ordinary held card is exchanged to the donor so both
 * retain legal hand counts. The bribe, Charity claim and all later actions are
 * executed by the real engine. */
function claimedSource() {
  const f = fixture();
  assert.equal(f.nativeAcquisition, false);
  assert.ok(f.staging.some(row => row.includes('CONTROLLED')));
  const originalQueue = f.game.charityOrder!.remaining;
  const actor = originalQueue.slice(0, -1).find(id => id !== f.holder && id !== f.owner);
  assert.ok(actor, 'A non-Semuta, non-donor claimant retains a later opportunity');
  let game = advance(structuredClone(f.game), state => clean(state) &&
    state.phase === 2 && state.charityOrder?.remaining[0] === actor);
  const donor = player(game, f.owner), claimant = player(game, actor);
  const index = donor.hand.findIndex(card => card.id === f.card);
  assert.ok(index >= 0);
  const [sapho] = donor.hand.splice(index, 1);
  if (claimant.hand.length >= handLimit(claimant)) {
    const swap = claimant.hand.findIndex(card => card.id !== SEMUTA_DRUG_ID);
    assert.ok(swap >= 0);
    donor.hand.push(...claimant.hand.splice(swap, 1));
  }
  claimant.hand.push(sapho);
  assert.ok(donor.hand.length <= handLimit(donor));
  assert.ok(claimant.hand.length <= handLimit(claimant));
  assert.deepEqual(inventory(game), f.originalInventory);
  const recipient = game.players.find(seat => seat.id !== actor)!.id;
  const paid = claimant.spice;
  assert.ok(paid > 0, 'The claimant makes an actual bribe before Charity');
  game = act(game, actor, { type: 'bribe', target: recipient, amount: paid });
  assert.equal(player(game, actor).spice, 0);
  game = act(game, actor, { type: 'charity' });
  game = advance(game, clean);
  assert.equal(player(game, actor).charityTurn, game.turn);
  const option = viewGame(game, actor).saphoOptions.find(row => row.scope === 'charity' && row.mode === 'last');
  assert.ok(option && option.scope === 'charity' && option.resumeOwn);
  return { f, game, actor, action: { type: 'card', card: f.card,
    scope: 'charity', event: option.event, mode: 'last' } satisfies Action };
}

for (const claim of [false, true]) void test(
  `controlled own Charity Sapho suspension survives Semuta ${claim ? 'claim' : 'pass'} without repeating the claim`, () => {
    const { f, game: original, actor, action } = claimedSource();
    const before = structuredClone(player(original, actor));
    const paused = act(original, actor, action);
    assert.equal(paused.pendingTreacheryDiscard?.continuation?.kind, 'saphoCharityDiscard');
    assert.equal(paused.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.ok(paused.charityOrder?.version === 3);
    assert.deepEqual(paused.charityOrder.paused, [actor]);
    assert.equal(paused.charityOrder.remaining.at(-1), actor);
    assert.equal(player(paused, actor).spice, before.spice);
    assert.equal(player(paused, actor).charityTurn, before.charityTurn);
    assert.equal(viewGame(paused, f.holder).semutaReaction?.canCommit, true);
    reject(paused, actor, { type: 'ready' });
    const frame = structuredClone(paused.charityOrder), ready = [...paused.ready];
    let game = react(paused, f.holder, claim);
    game = advance(game, clean);
    assert.deepEqual(game.charityOrder, frame);
    assert.deepEqual(game.ready, ready);
    assert.equal(game.active, frame.remaining[0]);
    assert.equal(player(game, actor).spice, before.spice);
    assert.equal(player(game, actor).charityTurn, before.charityTurn);
    assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), claim);
    assert.equal(game.discard.some(card => card.id === f.card), !claim);
    if (claim) assert.equal(game.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    game = advance(game, state => state.phase === 2 && clean(state) &&
      state.charityOrder?.remaining[0] === actor);
    assert.ok(game.charityOrder?.version === 3 && game.charityOrder.started);
    assert.equal(player(game, actor).spice, before.spice);
    reject(game, actor, { type: 'charity' });
    game = act(game, actor, { type: 'ready' });
    assert.deepEqual(inventory(game), f.originalInventory);
  },
);
