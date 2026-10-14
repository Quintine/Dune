import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import {
  createHomeworldBankerFixture, homeworldBankerGroup, homeworldBankerPlayer,
  advanceHomeworldBanker, homeworldBankerClean, settleHomeworldBankerInvoice, declareHomeworldBankerInvoice,
} from './fixture-homeworld-banker-income';

void test('world-to-world native fees remain Bank payments and fund only deferred Banker income', () => {
  const f = createHomeworldBankerFixture();
  const before = f.beforePledge;
  const actor = homeworldBankerPlayer(before,f.payer);
  const choice = homeworldShipmentChoice(viewGame(before,f.payer),'homeworld:guild',
    {[homeworldBankerGroup(before,f.payer)]:{normal:4,elite:0}});
  assert.ok(choice.action,choice.blocked ?? undefined);
  const done = advanceHomeworldBanker(applyAction(before,f.payer,choice.action),homeworldBankerClean);
  assert.equal(homeworldBankerPlayer(done,f.payer).spice,actor.spice-4);
  assert.equal(homeworldBankerPlayer(done,f.payer).reserves,actor.reserves-4);
  assert.equal(done.homeworlds!.custody!.visitors['homeworld:guild'][f.payer].normal,4);
  assert.deepEqual(done.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,[{payer:f.payer,amount:4}]);
  assert.deepEqual(viewGame(done,f.trainer).spiceBankerIncome!.deferred,[{owner:f.trainer,amount:1}]);
  assert.equal(homeworldBankerPlayer(done,f.trainer).spice,homeworldBankerPlayer(before,f.trainer).spice);
});

void test('Junction-sponsored board return charges the real Bank tariff without manufacturing Guild income', () => {
  const f = createHomeworldBankerFixture();
  let game = advanceHomeworldBanker(f.setup,g=>g.turn===1&&g.phase===5&&g.active==='harkonnen'&&homeworldBankerClean(g));
  const offer = viewGame(game,'guild').junctionTransport!;
  assert.equal(offer.canOffer,true);
  game = applyAction(game,'guild',{type:'offerJunctionTransport',event:offer.offerEvent,rate:'half'});
  const before = game, actor = homeworldBankerPlayer(game,'harkonnen');
  const source = Object.keys(actor.forces).find(key=>key.startsWith('carthag:'))!;
  const choice = junctionTransportChoice(viewGame(game,'harkonnen'),'homeworld:harkonnen',
    {[source]:{normal:8,elite:0}});
  assert.ok(choice.action,choice.blocked ?? undefined);
  assert.equal(choice.cost,4);
  const done = applyAction(game,'harkonnen',choice.action);
  assert.equal(homeworldBankerPlayer(done,'harkonnen').spice,actor.spice-4);
  assert.equal(homeworldBankerPlayer(done,'harkonnen').reserves,actor.reserves+8);
  assert.equal(homeworldBankerPlayer(done,'harkonnen').forces[source],actor.forces[source]-8);
  assert.equal(homeworldBankerPlayer(done,'guild').spice,homeworldBankerPlayer(before,'guild').spice);
  assert.deepEqual(done.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,[{payer:'harkonnen',amount:4}]);
  assert.deepEqual(viewGame(done,f.trainer).spiceBankerIncome!.deferred,[{owner:f.trainer,amount:1}]);
  assert.equal(homeworldBankerPlayer(done,f.trainer).spice,homeworldBankerPlayer(before,f.trainer).spice);
});

void test('the first eligible declared contribution controls the combined low-world Bank threshold without private choice', () => {
  for (const payerShare of [5,6]) {
    const f = createHomeworldBankerFixture({stronghold:true,payerShare});
    const done = settleHomeworldBankerInvoice(f,declareHomeworldBankerInvoice(f),true);
    const expected = payerShare===5
      ? [{payer:f.payer,amount:3},{payer:f.ally,amount:3}]
      : [{payer:f.payer,amount:4},{payer:f.ally,amount:2}];
    const receipt = done.spiceBankerIncome!.sources.at(-1)!;
    assert.deepEqual(receipt.source.bankLegs,expected);
    assert.equal(receipt.grant?.owner ?? null,payerShare===5?null:f.trainer);
    assert.equal(homeworldBankerPlayer(done,f.payer).spice,
      homeworldBankerPlayer(f.beforePledge,f.payer).spice-f.payerShare);
    assert.equal(homeworldBankerPlayer(done,f.ally).spice,
      homeworldBankerPlayer(f.beforePledge,f.ally).spice-f.allyShare);
    assert.equal(done.homeworldOccupiedPercentageLedger!.receipts.at(-1)!.source.amount,9);
  }
});
