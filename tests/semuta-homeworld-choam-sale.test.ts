import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { createSemutaHomeworldChoamSaleFixture, playSemutaHomeworldChoamSale } from './fixture-semuta-homeworld-choam-sale';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { semutaHomeworldChoamMovementStock as stock, semutaHomeworldChoamMovementResources as resources } from './fixture-semuta-homeworld-choam-movement';

for (const advanced of [false, true]) for (const kind of ['worthless', 'duplicate'] as const) {
  for (const claim of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} market Semuta ${claim ? 'claim' : 'pass'} preserves its actual payout and original close`, () => {
    const f = createSemutaHomeworldChoamSaleFixture(kind, advanced, true);
    const pending = playSemutaHomeworldChoamSale(f);
    assert.ok(pending.pendingTreacheryDiscard);
    assert.equal(player(pending, f.owner).spice, player(f.game, f.owner).spice + f.price);
    assert.equal(player(pending, f.owner).hand.some(c => c.id === f.card), false);
    assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
    if (f.witness) assert.ok(player(pending, f.owner).hand.some(c => c.id === f.witness));
    if (kind === 'worthless') {
      assert.equal(player(f.afterShipment!, f.owner).spice, player(f.beforeShipment!, f.owner).spice - 10);
      assert.equal(player(pending, f.owner).reserves, 10);
      assert.equal(player(pending, f.owner).forces['habbanya_ridge_sietch:17'], 10);
    } else assert.equal(player(pending, f.owner).reserves, 20);
    const paid = resources(pending), event = pending.pendingTreacheryDiscard.batch.event;
    assert.throws(() => applyAction(pending, f.owner, { type: 'decision', done: true }));
    const done = reactSemutaHomeworldChoam(pending, f.holder, claim);
    assert.equal(player(done, f.holder).hand.some(c => c.id === f.card), claim);
    assert.equal(player(done, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
    assert.equal(player(done, f.holder).hand.length, player(f.game, f.holder).hand.length);
    assert.deepEqual(resources(done), paid, 'Recovery cannot repeat payout, refund shipment or move a counter');
    assert.deepEqual(stock(done), stock(f.game));
    if (f.witness) assert.ok(player(done, f.owner).hand.some(c => c.id === f.witness));
    assert.throws(() => applyAction(done, f.owner, f.action));
    assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
    const next = applyAction(done, f.owner, { type: 'decision', done: true });
    assert.equal(next.phase, kind === 'worthless' ? 6 : 1);
    assert.equal(next.turn, f.game.turn);
    assert.equal(player(next, f.owner).spice, player(done, f.owner).spice);
    assert.equal(player(next, f.owner).reserves, player(done, f.owner).reserves);
    assert.equal(next.pendingTreacheryDiscard, null);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} high Tupile still rejects Worthless sale before payment or disposal`, () => {
  const f = createSemutaHomeworldChoamSaleFixture('worthless', advanced);
  const before = structuredClone(f.highMarket);
  assert.throws(() => applyAction(f.highMarket, f.owner, f.action));
  assert.deepEqual(f.highMarket, before);
});

for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) void test(`${difficulty} legally settles the native Homeworld market disposal`, () => {
  for (const advanced of [false, true]) for (const kind of ['worthless', 'duplicate'] as const) {
    const f = createSemutaHomeworldChoamSaleFixture(kind, advanced);
    let game = playSemutaHomeworldChoamSale(f);
    const paid = player(game, f.owner).spice;
    const view = viewGame(game, f.holder);
    view.players.find(p => p.id === f.holder)!.bot = difficulty;
    const action = botActions(view)[0]; assert.ok(action);
    game = applyAction(game, f.holder, action);
    const event = game.pendingTreacheryDiscard?.batch.event;
    for (const p of game.players) if (game.pendingTreacheryDiscard?.reaction?.stage === 'offer'
      && !game.pendingTreacheryDiscard.reaction.passed.includes(p.id))
      game = applyAction(game, p.id, { type: 'semutaPass', event });
    assert.equal(game.pendingTreacheryDiscard, null);
    assert.equal(player(game, f.owner).spice, paid);
    const claimed = player(game, f.holder).hand.some(c => c.id === f.card);
    assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claimed);
    assert.deepEqual(stock(game), stock(f.game));
    const next = applyAction(game, f.owner, { type: 'decision', done: true });
    assert.equal(next.phase, kind === 'worthless' ? 6 : 1);
  }
});
