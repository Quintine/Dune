import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLocation } from '../game/board';
import { viewGame } from '../game/engine';
import { nativeTypedPhase } from './fixture-discovery-native-typed';
import { commitOrgizCollection, prepareOrgizCollection } from './fixture-discovery-orgiz-advanced';

for (const advanced of [true, false]) {
  void test(`${advanced ? 'Advanced territory events' : 'Basic positive deposits'}: original Discovery reveal and later Collection preserve bank income and pay the distinct Orgiz count`, () => {
    const position = prepareOrgizCollection(advanced);
    const count = advanced ? 2 : 3;
    const orgiz = position.discovery.effects.filter(effect => effect.kind === 'orgiz');
    assert.equal(orgiz.length, count);
    assert.deepEqual(orgiz.map(effect => [effect.from, splitLocation(effect.location).territory]), advanced
      ? [['g', 'cielago_south'], ['g', 'hagga_basin']]
      : [['g', 'cielago_south'], ['g', 'hagga_basin'], ['g', 'hagga_basin']]);
    assert.equal(position.ordinary.receipts.find(receipt => receipt.player === 'g')!.collected, 5);
    assert.equal(position.ordinary.receipts.find(receipt => receipt.player === 'a')!.collected, 1);
    assert.equal(position.ordinary.receipts.find(receipt => receipt.player === 'f')!.strongholds, advanced ? 2 : 0);
    assert.deepEqual(position.discovery.receipts.map(({ balance: _, ...facts }) => facts),
      position.ordinary.receipts.map(({ balance: _, ...facts }) => facts));
    assert.equal(position.ordinary.spice[position.haggaKeys[0]], 1);
    assert.equal(position.ordinary.spice[position.haggaKeys[1]], 0);
    assert.equal(position.ordinary.spice[position.cielagoKey], 0);
    assert.equal(position.ordinary.spice[position.untouchedKey], position.boardSpice - 7);

    const collected = commitOrgizCollection(position.game);
    assert.deepEqual(position.game, position.before);
    assert.equal(collected.turn, 2);
    assert.deepEqual(collected.spice, position.ordinary.spice);
    for (const receipt of position.discovery.receipts)
      assert.equal(collected.players.find(player => player.id === receipt.player)!.spice, receipt.balance);
    const ordinaryOwner = position.ordinary.receipts.find(receipt => receipt.player === 'a')!.balance;
    const ordinaryPayer = position.ordinary.receipts.find(receipt => receipt.player === 'g')!.balance;
    assert.equal(collected.players.find(player => player.id === 'a')!.spice, ordinaryOwner + count);
    assert.equal(collected.players.find(player => player.id === 'g')!.spice, ordinaryPayer - count);
    assert.equal(viewGame(collected, 'a').players.find(player => player.id === 'a')!.spice, ordinaryOwner + count);
    assert.equal(collected.players.reduce((sum, player) => sum + player.spice, 0),
      position.ordinary.receipts.reduce((sum, receipt) => sum + receipt.balance, 0));
    assert.equal(collected.players.reduce((sum, player) => sum + player.spice, 0) +
      Object.values(collected.spice).reduce((sum, amount) => sum + amount, 0),
    position.before.players.reduce((sum, player) => sum + player.spice, 0) + position.boardSpice + (advanced ? 2 : 0));
    const theftLogs = collected.log.filter(entry => entry.automatic?.name === 'Orgiz Processing Station');
    assert.equal(theftLogs.length, count);
    // Continue the original phase controls; never rerun or retarget a paid quote.
    const mentat = nativeTypedPhase(collected, 8);
    assert.deepEqual(mentat.players.map(player => player.spice), collected.players.map(player => player.spice));
    assert.equal(mentat.log.filter(entry => entry.automatic?.name === 'Orgiz Processing Station').length, count);
  });
}
