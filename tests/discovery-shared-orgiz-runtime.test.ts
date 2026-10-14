import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { ORGIZ_PROCESSING_STATION } from '../game/discovery-collection';
import { prepareSharedOrgizCollection, settleSharedOrgiz } from './fixture-discovery-shared-orgiz';

const wallets = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
const transfers = (game: Game) =>
  game.log.filter(entry => entry.automatic?.name === 'Orgiz Processing Station');

for (const scenario of [
  { name: 'an equal split charges the first actual recipient', choice: { kind: 'equal' as const }, payer: 'e' },
  { name: 'a full Ecaz share charges Ecaz', choice: { kind: 'propose' as const, ecazShare: 4 }, payer: 'e' },
  { name: 'a zero Ecaz share charges the ally instead', choice: { kind: 'propose' as const, ecazShare: 0 }, payer: 'g' },
]) {
  void test(`Advanced shared Collection: ${scenario.name}, never an old wallet or an unavailable share`, () => {
    const position = prepareSharedOrgizCollection();
    const lot = position.ordinary.shared[0];
    assert.equal(lot.territory, 'hagga_basin');
    assert.equal(lot.ecaz, position.ecaz);
    assert.equal(lot.ally, position.guild);
    const base = structuredClone(position.game);
    const before = wallets(base);
    const settled = settleSharedOrgiz(position, scenario.choice);
    assert.deepEqual(position.game, base, 'Settling must not mutate the prepared position.');
    const receipt = settled.receipts.at(-1)!;
    assert.equal(receipt.territory, lot.territory);
    assert.equal(receipt.ecazAmount + receipt.allyAmount, lot.amount);
    assert.ok(receipt[scenario.payer === 'e' ? 'ecazAmount' : 'allyAmount'] > 0);
    const expected = { ...before };
    expected[receipt.ecaz] += receipt.ecazAmount;
    expected[receipt.ally] += receipt.allyAmount;
    expected[position.fremen] += 1;
    expected[scenario.payer] -= 1;
    assert.deepEqual(wallets(settled.game), expected);
    // Total spice is conserved by the transfer itself, and the credited total
    // equals the real collected lot.
    assert.equal(Object.values(wallets(settled.game)).reduce((sum, amount) => sum + amount, 0),
      Object.values(before).reduce((sum, amount) => sum + amount, 0) + lot.amount);
    assert.equal(Object.values(settled.game.spice).reduce((sum, amount) => sum + amount, 0),
      Object.values(base.spice).reduce((sum, amount) => sum + amount, 0) - lot.amount);
    const owned = transfers(settled.game);
    assert.equal(owned.length, 1);
    assert.equal(owned[0].automatic?.faction, 'fremen');
    assert.match(owned[0].text, /after the original shared territory allocation/);
    // The occupied location keeps its real garrison and the fremen wallet grows.
    assert.equal(settled.game.players.find(player => player.id === position.fremen)!.forces[`${ORGIZ_PROCESSING_STATION}:0`], 1);
    assert.equal(wallets(settled.game)[position.fremen], before[position.fremen] + 1);
    const stable = JSON.parse(JSON.stringify(settled.game)) as Game;
    assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(stable))), stable);
    assert.equal(viewGame(settled.game, position.ecaz).players
      .find(player => player.id === position.ecaz)!.spice, expected[position.ecaz]);
    assert.equal(viewGame(settled.game, position.ecaz).players
      .find(player => player.id === position.guild)!.spice, undefined,
      'Opposing wallets stay private.');
  });
}

void test('re-settling the same prepaid position is deterministic and never accumulates', () => {
  const position = prepareSharedOrgizCollection();
  const first = settleSharedOrgiz(position, { kind: 'equal' });
  const second = settleSharedOrgiz(position, { kind: 'equal' });
  assert.equal(first.steps.length, second.steps.length);
  assert.deepEqual(wallets(second.game), wallets(first.game));
  assert.deepEqual(transfers(second.game).length, transfers(first.game).length);
  assert.deepEqual(wallets(position.game), wallets(position.before));
  assert.deepEqual(normalizeAutomaticGame(structuredClone(second.game)), second.game);
});
