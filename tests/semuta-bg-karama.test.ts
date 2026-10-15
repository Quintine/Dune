import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import {
  createOriginalSemutaBg, createControlledBgClaimedPriceRefund,
  passSemutaBgResponse, settleSemutaBgNative, type SemutaBgUse,
} from './fixture-semuta-bg-karama';
import { reactSemutaSpecial } from './fixture-semuta-special-karama';
import { passSemutaSpecialDiscards } from './fixture-semuta-emperor-share';

const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function ordinaryPriceShipment(game: Game): Action {
  const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm) &&
    game.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination);
  return { type: 'ship', territory: destination.id, sector: destination.sectors.find(s => s !== game.storm)!,
    amount: 3, elite: 0, allyPayment: 0 };
}

for (const use of ['shipment', 'cancel', 'purchase', 'auctionPayment'] as SemutaBgUse[])
  void test(`original BG ${use} keeps both fresh costs and its original native allowance or denial`, () => {
    for (const claim of [false, true]) for (const canceled of [false, true]) {
      const f = createOriginalSemutaBg(use), before = structuredClone(f.beforeCost);
      let game = f.game;
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:conversion');
      assert.equal(game.pendingKarama, null);
      if (use === 'shipment') assert.equal(game.karamaShipping, null);
      reject(game, f.owner, f.action);
      game = reactSemutaSpecial(game, f.holder, claim);
      assert.equal(game.response?.kind, 'worthlessKarama');
      assert.equal(player(game, f.owner).hand.some(c => c.id === f.worthless.id), false);
      assert.ok(viewGame(game, f.counter).responseControls!.cancelCards.includes(f.karama.id));
      if (canceled) {
        game = applyAction(game, f.counter, { type: 'card', mode: 'cancel', card: f.karama.id });
        assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:worthlessKarama');
        game = reactSemutaSpecial(game, f.holder, !claim);
        assert.equal(player(game, f.holder).hand.some(c => c.id === f.karama.id), !claim);
      } else game = passSemutaBgResponse(game);
      assert.equal(game.pendingKarama, null);
      const recovered = player(game, f.holder).hand.find(c => c.id === f.worthless.id);
      assert.equal(!!recovered, claim);
      if (recovered) assert.deepEqual(recovered, f.worthless);
      assert.equal(game.discard.filter(c => c.id === f.semuta).length, claim || canceled ? 1 : 0);
      if (use === 'shipment') {
        if (canceled) {
          assert.equal(game.karamaShipping, null);
          assert.equal(player(game, f.beneficiary).spice, player(before, f.beneficiary).spice);
          assert.equal(player(game, f.beneficiary).reserves, player(before, f.beneficiary).reserves);
          assert.equal(player(game, f.beneficiary).shipped, false);
        } else {
          assert.equal(viewGame(game, f.beneficiary).karamaShipping!.owner, f.owner);
          const shipment = ordinaryPriceShipment(game);
          game = settleSemutaBgNative(applyAction(game, f.beneficiary, shipment));
          assert.equal(player(game, f.beneficiary).spice, player(before, f.beneficiary).spice - 3);
          assert.equal(player(game, f.beneficiary).reserves, player(before, f.beneficiary).reserves - 3);
          assert.equal(player(game, f.guild).spice, player(before, f.guild).spice);
          assert.equal(player(game, f.beneficiary).forces[`${String(shipment.territory)}:${Number(shipment.sector)}`], 3);
          assert.equal(game.karamaShipping, null);
        }
      } else if (use === 'cancel') {
        // Original already-passed seats stay passed: native normalization may
        // finish this restored response automatically. Assert its actual price.
        if (game.response?.kind === 'guildRate') game = passSemutaBgResponse(game, 'guildRate');
        game = settleSemutaBgNative(game);
        assert.equal(player(game, f.guild).spice, player(before, f.guild).spice - (canceled ? 2 : 4));
        assert.equal(player(game, f.guild).reserves, player(before, f.guild).reserves - 2);
        assert.equal(player(game, f.guild).forces[f.target!], 2);
        assert.equal(player(game, f.guild).shipped, true);
        assert.equal(player(game, f.guild).moved, 0);
      } else {
        assert.equal(player(game, f.owner).hand.filter(c => c.id === f.lot).length, canceled ? 0 : 1);
        assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
        assert.equal(player(game, f.owner).hand.some(c => c.id === f.worthless.id), false);
        if (canceled) assert.equal(game.auction!.cards[game.auction!.index].id, f.lot);
      }
    }
  });

void test('an original converted price retains exact Caladan withdrawal and bank-only world payment after cost recovery', () => {
  for (const claim of [false, true]) {
    const f = createOriginalSemutaBg('shipment', true);
    const before = structuredClone(f.beforeCost);
    let game = passSemutaBgResponse(reactSemutaSpecial(f.game, f.holder, claim));
    const quote = homeworldShipmentChoice(viewGame(game, f.beneficiary), 'homeworld:emperor',
      { 'homeworld:atreides': { normal: 3, elite: 0 } });
    assert.ok(quote.action, quote.blocked ?? undefined); assert.equal(quote.cost, 2);
    game = settleSemutaBgNative(applyAction(game, f.beneficiary, quote.action));
    assert.equal(player(game, f.beneficiary).spice, player(before, f.beneficiary).spice - 2);
    assert.equal(player(game, f.beneficiary).reserves, player(before, f.beneficiary).reserves - 3);
    assert.equal(player(game, f.guild).spice, player(before, f.guild).spice);
    assert.deepEqual(game.homeworlds!.custody!.visitors['homeworld:emperor'][f.beneficiary], { normal: 3, elite: 0 });
    assert.equal(player(game, f.holder).hand.some(c => c.id === f.worthless.id), claim);
    assert.equal(game.karamaShipping, null);
  }
});

void test('a controlled real CHOAM rediscard cannot revive refund eligibility for a recovered converted price cost', () => {
  const f = createControlledBgClaimedPriceRefund();
  let game = applyAction(f.game, f.owner, { type: 'card', card: f.worthless.id,
    mode: 'shipment', target: f.beneficiary });
  game = passSemutaBgResponse(reactSemutaSpecial(game, f.holder, true));
  const cashoutSpice = player(game, f.holder).spice;
  game = applyAction(game, f.holder, { type: 'card', mode: 'special', card: f.cashout.id,
    cards: [f.worthless.id] });
  game = passSemutaSpecialDiscards(game);
  assert.equal(player(game, f.holder).spice, cashoutSpice + 3);
  assert.equal(game.discard.filter(c => c.id === f.worthless.id).length, 1);
  const before = structuredClone(player(game, f.beneficiary));
  game = applyAction(game, f.beneficiary, ordinaryPriceShipment(game));
  game = applyAction(game, f.guild, { type: 'card', mode: 'special', card: f.stop.id });
  game = passSemutaSpecialDiscards(game);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.worthless.id), false);
  assert.equal(game.discard.filter(c => c.id === f.worthless.id).length, 1);
  assert.equal(player(game, f.beneficiary).spice, before.spice);
  assert.equal(player(game, f.beneficiary).reserves, before.reserves);
  assert.equal(player(game, f.beneficiary).shipped, true);
  assert.equal(player(game, f.beneficiary).moved, 0);
  assert.equal(game.karamaShipping, null);
});

void test('recovering a Worthless does not grant its new faction the native BG conversion role', () => {
  const f = createOriginalSemutaBg();
  let game = reactSemutaSpecial(f.game, f.holder, true);
  game = applyAction(game, f.counter, { type: 'card', card: f.karama.id, mode: 'cancel' });
  game = reactSemutaSpecial(game, f.holder, false);
  assert.equal(game.karamaShipping, null);
  assert.equal(game.active, f.beneficiary);
  assert.equal(player(game, f.beneficiary).shipped, false);
  assert.deepEqual(player(game, f.holder).hand.find(c => c.id === f.worthless.id), f.worthless);
  reject(game, f.holder, { type: 'card', card: f.worthless.id, mode: 'shipment', target: f.beneficiary });
});

void test('changed source and stale conversion/counter events cannot redirect the original physical cost or power', () => {
  const f = createOriginalSemutaBg();
  const event = f.game.pendingTreacheryDiscard!.batch.event;
  reject(f.game, f.owner, { type: 'semutaCommit', event });
  const changed = structuredClone(f.game);
  const continuation = changed.pendingTreacheryDiscard!.continuation;
  assert.ok(continuation?.kind === 'bgKaramaCostDiscard' && continuation.use.kind === 'shipment');
  continuation.use.recipient = f.guild;
  reject(changed, f.holder, { type: 'semutaCommit', event });
  let game = reactSemutaSpecial(f.game, f.holder, false);
  game = applyAction(game, f.counter, { type: 'card', card: f.karama.id, mode: 'cancel' });
  reject(game, f.holder, { type: 'semutaCommit', event });
  game = reactSemutaSpecial(game, f.holder, true);
  assert.equal(game.karamaShipping, null);
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.karama.id).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.worthless.id).length, 1);
});
