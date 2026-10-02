import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { forceRevivalQuote } from '../game/revival';
import { advanceSpiceBankerIncomeToMentat, nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';
import {
  advanceNativeBankerIncomeToPhase, createNativeBankerIncomeFixture,
  payNativeBankerIncomeFixture, type NativeBankerIncomeOptions,
} from './fixture-native-banker-income';

const nativeCases: NativeBankerIncomeOptions[] = [
  { family: 'ixians' },
  { family: 'ixians', withTleilaxu: true },
  { family: 'tleilaxu' },
  { family: 'choam' },
  { family: 'moritani' },
];

for (const options of nativeCases) {
  void test(`Basic ${options.family}${options.withTleilaxu ? '+Tleilaxu' : ''}: original bank auction buys its card once, defers Banker, and collects only at native Mentat`, () => {
    const fixture = createNativeBankerIncomeFixture(options);
    const buyer = fixture.game.players.find(p => p.id === fixture.payer)!;
    const owner = fixture.game.players.find(p => p.id === fixture.owner)!;
    const purchased = fixture.game.auction!.cards[fixture.game.auction!.index];
    assert.notEqual(buyer.id, owner.id);
    const paid = payNativeBankerIncomeFixture(fixture);
    assert.equal(paid.players.find(p => p.id === buyer.id)!.spice, buyer.spice - 4);
    assert.equal(paid.players.find(p => p.id === buyer.id)!.hand.filter(c => c.id === purchased.id).length, 1);
    assert.equal(paid.players.find(p => p.id === owner.id)!.spice, owner.spice);
    assert.deepEqual(viewGame(paid, owner.id).spiceBankerIncome!.deferred, [{ owner: owner.id, amount: 1 }]);
    assert.deepEqual(paid.spiceBankerIncome!.sources.find(row => row.grant)!.source.bankLegs,
      [{ payer: buyer.id, amount: 4 }]);

    // Ordinary auction/Shipment/Battle/Collection suffixes continue naturally;
    // Collection's own native income is already in this baseline wallet.
    const collection = advanceNativeBankerIncomeToPhase(paid, 7);
    const balance = collection.players.find(p => p.id === owner.id)!.spice;
    assert.deepEqual(viewGame(collection, owner.id).spiceBankerIncome!.deferred, [{ owner: owner.id, amount: 1 }]);
    const mentat = advanceSpiceBankerIncomeToMentat(collection);
    assert.equal(mentat.players.find(p => p.id === owner.id)!.spice, balance + 1);
    assert.deepEqual(viewGame(mentat, owner.id).spiceBankerIncome!.deferred, []);
    assert.equal(mentat.players.find(p => p.id === buyer.id)!.hand.filter(c => c.id === purchased.id).length, 1);
  });
}

void test('Basic native Tleilaxu Banker does not count a real auction paid to Emperor as a bank payment', () => {
  const fixture = createNativeBankerIncomeFixture({ family: 'tleilaxu', payerFaction: 'atreides' });
  const payer = fixture.game.players.find(p => p.id === fixture.payer)!;
  const emperor = fixture.game.players.find(p => p.faction === 'emperor')!;
  const card = fixture.game.auction!.cards[fixture.game.auction!.index];
  const paid = payNativeBankerIncomeFixture(fixture);
  assert.equal(paid.players.find(p => p.id === payer.id)!.spice, payer.spice - 4);
  assert.equal(paid.players.find(p => p.id === emperor.id)!.spice, emperor.spice + 4);
  assert.equal(paid.players.find(p => p.id === payer.id)!.hand.filter(c => c.id === card.id).length, 1);
  assert.deepEqual(viewGame(paid, fixture.owner).spiceBankerIncome!.deferred, []);
});

for (const amount of [1, 3]) {
  void test(`Basic native Tleilaxu revival recipient: ${amount === 1 ? 'zero payer debit/free reward' : 'four-spice player payment'} returns original forces without Banker income`, () => {
    const fixture = createNativeBankerIncomeFixture({ family: 'tleilaxu', kind: 'force-revival', amount });
    const payer = fixture.game.players.find(p => p.id === fixture.payer)!;
    const recipient = fixture.game.players.find(p => p.faction === 'tleilaxu')!;
    const quote = forceRevivalQuote(fixture.game, payer, amount);
    assert.equal(quote.free, 1);
    assert.equal(quote.cost, amount === 1 ? 0 : 4);
    const paid = payNativeBankerIncomeFixture(fixture);
    const revived = paid.players.find(p => p.id === payer.id)!;
    assert.equal(revived.spice, payer.spice - quote.cost);
    assert.equal(revived.reserves, payer.reserves + amount);
    assert.equal(revived.tanks, payer.tanks - amount);
    assert.equal(revived.revived, payer.revived + amount);
    // The printed free-revival bonus comes from the Bank, not from this payer.
    assert.equal(paid.players.find(p => p.id === recipient.id)!.spice, recipient.spice + quote.cost + 1);
    assert.deepEqual(viewGame(paid, fixture.owner).spiceBankerIncome!.deferred, []);
    assert.equal(paid.spiceBankerIncome!.sources.some(row => row.grant), false);
  });
}

void test('Basic native Tleilaxu own paid revival really pays the Bank: another native Banker earns one, not the free-income reward', () => {
  const fixture = createNativeBankerIncomeFixture({
    family: 'tleilaxu', bankerFaction: 'atreides', payerFaction: 'tleilaxu',
    kind: 'force-revival', amount: 6,
  });
  const payer = fixture.game.players.find(p => p.id === fixture.payer)!;
  const owner = fixture.game.players.find(p => p.id === fixture.owner)!;
  const quote = forceRevivalQuote(fixture.game, payer, 6);
  assert.equal(quote.free, 2);
  assert.equal(quote.cost, 4);
  const paid = payNativeBankerIncomeFixture(fixture);
  const revived = paid.players.find(p => p.id === payer.id)!;
  assert.equal(revived.reserves, payer.reserves + 6);
  assert.equal(revived.tanks, payer.tanks - 6);
  assert.equal(revived.spice, payer.spice - 4 + 1);
  assert.equal(paid.players.find(p => p.id === owner.id)!.spice, owner.spice);
  assert.deepEqual(viewGame(paid, owner.id).spiceBankerIncome!.deferred, [{ owner: owner.id, amount: 1 }]);
  assert.deepEqual(paid.spiceBankerIncome!.sources.find(row => row.grant)!.source.bankLegs,
    [{ payer: payer.id, amount: 4 }]);
});

for (const cost of [0, 3, 4]) {
  void test(`canceled native Tleilaxu income: actual payer debit ${cost}, not the extra free reward, controls the Banker threshold`, () => {
    const options: NativeBankerIncomeOptions = cost === 3
      ? { family: 'ixians', withTleilaxu: true, bankerFaction: 'atreides', payerFaction: 'ixians', amount: 2, elite: 2 }
      : { family: 'tleilaxu', bankerFaction: 'atreides', payerFaction: 'emperor', amount: cost === 0 ? 1 : 3 };
    const fixture = createNativeBankerIncomeFixture({ ...options, kind: 'force-revival', stageIncomeCounter: true });
    const payer = fixture.game.players.find(p => p.id === fixture.payer)!;
    const recipient = fixture.game.players.find(p => p.faction === 'tleilaxu')!;
    const owner = fixture.game.players.find(p => p.id === fixture.owner)!;
    const counter = owner.hand.find(card => card.effect === 'karama')!;
    assert.equal(fixture.amount, cost);
    let game = applyAction(fixture.game, fixture.actor, fixture.paymentAction);
    for (let i = 0; game.response?.kind !== 'revivalIncome' && i < 100; i++) {
      const next = nextSpiceBankerIncomeNativeStep(game);
      assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
    assert.ok(game.response?.kind === 'revivalIncome');
    assert.equal(game.response.amount, cost + 1);
    assert.equal(game.players.find(p => p.id === payer.id)!.spice, payer.spice - cost);
    assert.equal(game.players.find(p => p.id === recipient.id)!.spice, recipient.spice);
    assert.deepEqual(viewGame(game, owner.id).spiceBankerIncome!.deferred, []);
    game = applyAction(game, owner.id, { type: 'card', card: counter.id, mode: 'cancel' });
    for (let i = 0; (game.response || game.decision) && i < 100; i++) {
      const next = nextSpiceBankerIncomeNativeStep(game);
      assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
    assert.ok(!game.response && !game.decision && !game.pendingRevival);
    assert.equal(game.players.find(p => p.id === payer.id)!.spice, payer.spice - cost);
    assert.equal(game.players.find(p => p.id === recipient.id)!.spice, recipient.spice);
    assert.equal(game.players.find(p => p.id === owner.id)!.spice, owner.spice);
    assert.equal(game.players.find(p => p.id === payer.id)!.tanks, payer.tanks - options.amount!);
    if (cost === 3) {
      assert.equal(game.players.find(p => p.id === payer.id)!.elites!.tanks, payer.elites!.tanks - 2);
      assert.equal(game.players.find(p => p.id === payer.id)!.elites!.reserves, payer.elites!.reserves + 2);
    }
    assert.equal(game.discard.filter(card => card.id === counter.id).length, 1);
    assert.deepEqual(viewGame(game, owner.id).spiceBankerIncome!.deferred,
      cost === 4 ? [{ owner: owner.id, amount: 1 }] : []);
    assert.equal(game.spiceBankerIncome!.sources.some(row => row.grant), cost === 4);
    if (cost > 0) assert.deepEqual(game.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,
      [{ payer: payer.id, amount: cost }]);
  });
}
