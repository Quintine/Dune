import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { splitLocation } from '../game/board';
import { advanceSemutaHomeworldChoam, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import {
  createSemutaHomeworldChoamMovementFixture, disposeSemutaHomeworldChoamMovement,
  finishSemutaHomeworldChoamMovement,
  semutaHomeworldChoamMovementResources as resources, semutaHomeworldChoamMovementStock as stock,
  withoutSemutaHomeworldChoamMovementHolder,
  type SemutaHomeworldChoamMovementEffect,
} from './fixture-semuta-homeworld-choam-movement';

const effects: SemutaHomeworldChoamMovementEffect[] = ['kulon', 'baliset'];
for (const advanced of [false, true]) for (const effect of effects) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld ${effect}`;
  for (const claim of [false, true]) void test(`${label}: Semuta ${claim ? 'claim' : 'pass'} preserves paid native shipment and applies the printed movement power once`, () => {
    const f = createSemutaHomeworldChoamMovementFixture(effect, advanced);
    const inventory = stock(f.game), paid = resources(f.game);
    assert.equal(player(f.afterShipment, f.owner).spice, player(f.beforeShipment, f.owner).spice - 2,
      'One ordinary off-planet force into desert pays exactly two spice');
    assert.equal(player(f.afterShipment, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 1);
    assert.equal(player(f.afterShipment, f.owner).forces[effect === 'kulon' ? f.origin : f.destination], 1);
    assert.deepEqual(f.afterShipment.homeworlds?.custody, f.setup.homeworlds?.custody);
    if (effect === 'kulon') assert.throws(() => applyAction(f.game, f.owner, f.move));
    else {
      assert.equal(f.game.decision?.kind, 'choamMovement');
      assert.deepEqual(player(f.game, f.target).forces, player(f.beforeMove, f.target).forces);
      assert.equal(player(f.game, f.target).moved, 0, 'Declared move remains wholly uncommitted');
    }
    const offered = disposeSemutaHomeworldChoamMovement(f);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(offered.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(offered, f.owner).hand.some(card => card.id === f.card), false);
    assert.deepEqual(resources(offered), paid, 'Paid prefix, original force custody and wallets are frozen during the offer');
    assert.deepEqual(stock(offered), inventory);
    assert.deepEqual(normalizeAutomaticGame(structuredClone(offered)), offered);
    assert.throws(() => applyAction(offered, f.target, f.move));
    assert.equal(viewGame(offered, f.owner).choamMovementBonus, 0);
    assert.deepEqual(viewGame(offered, f.target).balisetRestrictions, []);
    const event = offered.pendingTreacheryDiscard!.batch.event;
    const resumed = reactSemutaHomeworldChoam(structuredClone(offered), f.holder, claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.deepEqual(resources(resumed), paid);
    assert.deepEqual(stock(resumed), inventory);
    assert.equal(player(resumed, f.holder).hand.filter(card => card.id === f.card).length, claim ? 1 : 0);
    assert.equal(resumed.discard.filter(card => card.id === f.card).length, claim ? 0 : 1);
    assert.equal(resumed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, claim ? 1 : 0);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));
    if (effect === 'kulon') {
      assert.equal(viewGame(resumed, f.owner).choamMovementBonus, 1);
      assert.throws(() => applyAction(resumed, f.owner, f.tooFar!),
        'Exactly one extra range, not two');
      const moved = applyAction(resumed, f.owner, f.move);
      assert.equal(player(moved, f.owner).moved, 1);
      assert.equal(player(moved, f.owner).forces[f.origin] ?? 0, 0);
      assert.equal(player(moved, f.owner).forces[f.destination], 1);
      assert.throws(() => applyAction(moved, f.owner, f.move),
        'Kulon does not grant a second move');
    } else {
      const restrictions = viewGame(resumed, f.target).balisetRestrictions;
      assert.equal(restrictions.length, 1);
      assert.equal(restrictions[0].territory, splitLocation(f.destination).territory);
      assert.equal(resumed.pendingChoamMove, null);
      assert.equal(player(resumed, f.target).moved, 0);
      assert.deepEqual(player(resumed, f.target).forces, player(f.beforeMove, f.target).forces);
      assert.throws(() => applyAction(resumed, f.target, f.move));
      assert.throws(() => applyAction(resumed, f.owner, f.action),
        'The used printed physical card cannot apply a second restriction');
    }
    const completed = finishSemutaHomeworldChoamMovement(resumed, f);
    assert.equal(completed.phase, 7, 'Real endMovement and CHOAM phase controls reach Spice Collection');
    assert.equal(completed.turn, 1);
    assert.equal(player(completed, f.target).moved, 1);
    assert.equal(player(completed, f.owner).reserves, player(f.afterShipment, f.owner).reserves,
      'A response and its suffix never ship the original reserve twice');
    assert.deepEqual(completed.homeworlds?.custody, f.setup.homeworlds?.custody);
    assert.deepEqual(stock(completed), inventory);
  });

  void test(`${label}: singleton exchange is legal at the original full hand limit and entitlement remains private`, () => {
    const f = createSemutaHomeworldChoamMovementFixture(effect, advanced, true);
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const offered = disposeSemutaHomeworldChoamMovement(f);
    const neutral = disposeSemutaHomeworldChoamMovement(f, absent);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true,
      'Exchanging physical Semuta for the singleton needs no fifth slot');
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of offered.players.filter(seat => seat.id !== f.holder)) {
      assert.deepEqual(viewGame(offered, seat.id), viewGame(neutral, seat.id),
        'An uninvolved player cannot infer whether Richese owns Semuta');
      assert.equal(viewGame(offered, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(offered, seat.id,
        { type: 'semutaCommit', event: offered.pendingTreacheryDiscard!.batch.event }));
    }
    const claimed = reactSemutaHomeworldChoam(offered, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === f.card), true);
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
    assert.deepEqual(stock(claimed), stock(f.game));
    assert.equal(player(finishSemutaHomeworldChoamMovement(claimed, f), f.target).moved, 1);
  });

  void test(`${label}: all four minimal bot profiles legally claim or pass then finish the native move`, () => {
    const f = createSemutaHomeworldChoamMovementFixture(effect, advanced);
    const offered = disposeSemutaHomeworldChoamMovement(f);
    for (const difficulty of DIFFICULTIES) {
      let game: Game = structuredClone(offered);
      const own = viewGame(game, f.holder);
      own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0];
      assert.ok(action, `${difficulty} has an entitled neutral receipt action`);
      assert.ok(['semutaCommit', 'semutaPass'].includes(action.type));
      game = applyAction(game, f.holder, action);
      while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
        const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
        if (reaction?.stage !== 'offer') throw Error('Missing neutral discard offer');
        const actor = game.players.find(seat => !reaction.passed.includes(seat.id))!;
        game = applyAction(game, actor.id, { type: 'semutaPass', event: pending.batch.event });
      }
      assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), action.type === 'semutaCommit');
      assert.deepEqual(resources(game), resources(f.game));
      const completed = finishSemutaHomeworldChoamMovement(game, f);
      assert.equal(player(completed, f.target).moved, 1);
      assert.deepEqual(stock(completed), stock(f.game));
    }
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} native Baliset decline and Karama allow the original declared move exactly once`, () => {
  const f = createSemutaHomeworldChoamMovementFixture('baliset', advanced);
  const declined = applyAction(f.game, f.owner, { type: 'decision', decline: true });
  const declared = applyAction(f.game, f.owner, f.action);
  const karama = player(declared, f.canceller).hand.find(card => card.name === 'Karama');
  assert.ok(karama);
  const cancellation = applyAction(declared, f.canceller, { type: 'card', mode: 'cancel', card: karama.id });
  const allowed = advanceSemutaHomeworldChoam(cancellation,
    game => !game.pendingTreacheryDiscard && !game.response && !game.decision && !game.phaseOpening);
  for (const game of [declined, allowed]) {
    assert.equal(player(game, f.target).moved, 1);
    assert.equal(player(game, f.target).forces[f.origin], player(f.beforeMove, f.target).forces[f.origin] - 1);
    assert.equal(player(game, f.target).forces[f.destination], 1);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), true);
    assert.equal(game.discard.some(card => card.id === f.card), false);
    assert.equal(game.pendingChoamMove, null);
    assert.deepEqual(viewGame(game, f.target).balisetRestrictions, []);
    assert.equal(player(game, f.owner).reserves, player(f.afterShipment, f.owner).reserves);
    assert.deepEqual(game.homeworlds?.custody, f.setup.homeworlds?.custody);
    assert.deepEqual(stock(game), stock(f.game));
    assert.throws(() => applyAction(game, f.owner, { type: 'decision', decline: true }));
    assert.throws(() => applyAction(game, f.target, f.move));
  }
});
