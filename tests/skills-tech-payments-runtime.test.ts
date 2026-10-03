import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  advanceSkillsTechPaymentsToPhase, createSkillsTechPaymentsFixture,
  nextSkillsTechPaymentsNativeStep, paySkillsTechPaymentsFixture,
  skillsTechPaymentsEmptyDestination, type SkillsTechPaymentsFixture,
} from './fixture-skills-tech-payments';

function wallets(game: Game): Record<string, number> {
  return Object.fromEntries(game.players.map(player => [player.id, player.spice]));
}
function assertPhysicalPayment(before: Game, after: Game): void {
  const cards = (game: Game) => [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort();
  assert.equal(cards(before).length, 33);
  assert.equal(new Set(cards(after)).size, 33);
  assert.deepEqual(cards(after), cards(before), 'Payment must not create, lose or redeal a physical card.');
  assert.deepEqual(after.leaderSkills, before.leaderSkills, 'Normal income does not move a skill card or training disc.');
  for (const player of after.players) assert.equal(player.reserves + player.tanks
    + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
}
function deferred(game: Game, owner: string): { owner: string; amount: number }[] {
  return viewGame(game, owner).spiceBankerIncome!.deferred;
}

/** Native phase-end payout may also auto-skip empty Battle and collect the board.
 * Account for that independent original quote; only Banker waits for Mentat. */
function assertSeparateCollections(fixture: SkillsTechPaymentsFixture, paid: Game, bankerAmount: number, techAmount: number): Game {
  const before = wallets(paid);
  const sources = structuredClone(paid.spiceBankerIncome!.sources);
  const phaseEnd = advanceSkillsTechPaymentsToPhase(paid, paid.phase + 1);
  const expected = phaseEnd.phase === 7
    ? Object.fromEntries(quoteSpiceCollection(paid).receipts.map(receipt => [receipt.player, receipt.balance]))
    : { ...before };
  expected[fixture.tokenOwner] += techAmount;
  assert.deepEqual(wallets(phaseEnd), expected, 'Native Collection plus only the original token owner’s phase-end pile.');
  assert.equal(phaseEnd.techTokens![fixture.token].spice, 0);
  assert.equal(phaseEnd.techTokens![fixture.token].triggeredTurn, techAmount ? paid.turn : undefined);
  assert.deepEqual(deferred(phaseEnd, fixture.owner), bankerAmount ? [{ owner: fixture.owner, amount: bankerAmount }] : []);
  assert.deepEqual(phaseEnd.spiceBankerIncome!.sources, sources, 'A Tech credit is not a qualifying Banker payment.');
  const collection = advanceSkillsTechPaymentsToPhase(phaseEnd, 7);
  const collectionWallets = wallets(collection); // Includes original stronghold/desert Collection, not invented funding.
  assert.deepEqual(deferred(collection, fixture.owner), bankerAmount ? [{ owner: fixture.owner, amount: bankerAmount }] : []);
  const mentat = advanceSkillsTechPaymentsToPhase(collection, 8);
  const expectedMentat = { ...collectionWallets };
  expectedMentat[fixture.owner] += bankerAmount;
  assert.deepEqual(wallets(mentat), expectedMentat);
  assert.deepEqual(deferred(mentat, fixture.owner), []);
  assert.deepEqual(mentat.spiceBankerIncome!.sources, sources, 'Banker collection must not recursively earn Banker income.');
  assert.equal(mentat.techTokens![fixture.token].spice, 0, 'Mentat income does not retrigger technology.');
  const next = nextSkillsTechPaymentsNativeStep(mentat);
  assert.ok(next);
  const continued = applyAction(mentat, next.actor, next.action);
  assert.equal(continued.phase, 8);
  assert.deepEqual(wallets(continued), expectedMentat, 'Further real Mentat readiness cannot credit either pile twice.');
  assert.deepEqual(continued.spiceBankerIncome!.collections, mentat.spiceBankerIncome!.collections);
  assertPhysicalPayment(fixture.beforePayment, continued);
  return continued;
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} Banker + Axlotl: actual four-spice revival delivers forces, keeps both earning stores unspendable, and collects each once at its own boundary`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced });
    const before = fixture.beforePayment;
    const payer = before.players.find(player => player.id === fixture.payer)!;
    assert.equal(fixture.cost, 4);
    assert.equal(before.techTokens!.axlotl.spice, 0);
    const paid = paySkillsTechPaymentsFixture(fixture);
    const revived = paid.players.find(player => player.id === payer.id)!;
    assert.equal(revived.reserves, payer.reserves + 3);
    assert.equal(revived.tanks, payer.tanks - 3);
    assert.equal(revived.revived, payer.revived + 3);
    assert.equal(revived.freeForcesRevived, 1);
    const expected = wallets(before);
    expected[payer.id] -= 4;
    assert.deepEqual(wallets(paid), expected, 'Neither accrued pile is available money during Revival.');
    assert.deepEqual(deferred(paid, fixture.owner), [{ owner: fixture.owner, amount: 1 }]);
    assert.equal(paid.techTokens!.axlotl.spice, 1);
    assert.equal(paid.techTokens!.axlotl.triggeredTurn, paid.turn);
    assert.deepEqual(paid.spiceBankerIncome!.sources.filter(row => row.grant).map(row => row.source.bankLegs),
      [[{ payer: fixture.payer, amount: 4 }]]);

    // A second real free revival is another eligible Axlotl action, not another
    // physical token award. Stage only one conserved Harkonnen reserve casualty.
    const smuggler = paid.players.find(player => player.id === fixture.smugglerOwner)!;
    smuggler.reserves -= 1;
    smuggler.tanks += 1;
    const repeat = applyAction(paid, smuggler.id, { type: 'revive', amount: 1 });
    assert.equal(repeat.players.find(player => player.id === smuggler.id)!.reserves, smuggler.reserves + 1);
    assert.equal(repeat.players.find(player => player.id === smuggler.id)!.tanks, smuggler.tanks - 1);
    assert.deepEqual(wallets(repeat), expected);
    assert.equal(repeat.techTokens!.axlotl.spice, 1);
    assert.deepEqual(deferred(repeat, fixture.owner), [{ owner: fixture.owner, amount: 1 }]);
    assertSeparateCollections(fixture, repeat, 1, 1);
  });

  for (const amount of [1, 2]) void test(`${band} Axlotl free-return trigger is independent of an actual ${amount === 1 ? 'zero' : 'two-spice nonqualifying'} Banker debit`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced, amount });
    const payer = fixture.beforePayment.players.find(player => player.id === fixture.payer)!;
    assert.equal(fixture.cost, amount === 1 ? 0 : 2);
    const paid = paySkillsTechPaymentsFixture(fixture);
    const revived = paid.players.find(player => player.id === payer.id)!;
    assert.equal(revived.spice, payer.spice - fixture.cost);
    assert.equal(revived.reserves, payer.reserves + amount);
    assert.equal(revived.tanks, payer.tanks - amount);
    assert.equal(paid.techTokens!.axlotl.spice, 1);
    assert.deepEqual(deferred(paid, fixture.owner), []);
    assert.equal(paid.spiceBankerIncome!.sources.some(row => row.grant), false);
    assertSeparateCollections(fixture, paid, 0, 1);
  });

  void test(`${band} Smuggler + Banker + Heighliners: five physical counters cost four, two real bank invoices earn only one of each deferred award`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced, kind: 'shipment' });
    const before = fixture.beforePayment;
    const payer = before.players.find(player => player.id === fixture.payer)!;
    assert.equal(fixture.cost, 4);
    let paid = paySkillsTechPaymentsFixture(fixture);
    const shipped = paid.players.find(player => player.id === payer.id)!;
    assert.equal(shipped.reserves, payer.reserves - 5);
    assert.equal(shipped.forces[fixture.destination!], 5);
    assert.equal(shipped.spice, payer.spice - 4);
    const expected = wallets(before);
    expected[payer.id] -= 4;
    assert.deepEqual(wallets(paid), expected);
    assert.equal(paid.techTokens!.heighliners.spice, 1);
    assert.deepEqual(deferred(paid, fixture.owner), [{ owner: fixture.owner, amount: 1 }]);

    // Continue to Emperor using original endMovement; no phase or turn is staged.
    const emperor = paid.players.find(player => player.faction === 'emperor')!;
    for (let i = 0; paid.active !== emperor.id && i < 20; i++) {
      const next = nextSkillsTechPaymentsNativeStep(paid);
      assert.ok(next);
      paid = applyAction(paid, next.actor, next.action);
    }
    assert.equal(paid.phase, 5);
    assert.equal(paid.active, emperor.id);
    const target = skillsTechPaymentsEmptyDestination(paid);
    const secondBefore = paid.players.find(player => player.id === emperor.id)!;
    paid = applyAction(paid, emperor.id, { type: 'ship', ...target, amount: 4 });
    assert.equal(paid.players.find(player => player.id === emperor.id)!.spice, secondBefore.spice - 4);
    assert.equal(paid.players.find(player => player.id === emperor.id)!.reserves, secondBefore.reserves - 4);
    assert.equal(paid.players.find(player => player.id === emperor.id)!.forces[`${target.territory}:${target.sector}`], 4);
    assert.equal(paid.techTokens!.heighliners.spice, 1);
    assert.equal(paid.spiceBankerIncome!.sources.filter(row => row.grant).length, 1);
    assert.deepEqual(deferred(paid, fixture.owner), [{ owner: fixture.owner, amount: 1 }]);
    assertSeparateCollections(fixture, paid, 1, 1);
  });

  for (const smuggler of [true, false]) void test(`${band} Smuggler ${smuggler ? 'free companion drops' : 'decline retains'} the original four-counter invoice across Banker's four-spice threshold`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced, kind: 'shipment', amount: 4, smuggler });
    const before = fixture.beforePayment.players.find(player => player.id === fixture.payer)!;
    const paid = paySkillsTechPaymentsFixture(fixture);
    const after = paid.players.find(player => player.id === fixture.payer)!;
    assert.equal(after.reserves, before.reserves - 4);
    assert.equal(after.forces[fixture.destination!], 4);
    assert.equal(after.spice, before.spice - (smuggler ? 3 : 4));
    assert.equal(paid.techTokens!.heighliners.spice, 1);
    assert.deepEqual(deferred(paid, fixture.owner), smuggler ? [] : [{ owner: fixture.owner, amount: 1 }]);
    assertSeparateCollections(fixture, paid, smuggler ? 0 : 1, 1);
  });

  void test(`${band} actual Smuggler fee goes to Guild, while Heighliners accrues separately and Banker gains nothing`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced, kind: 'shipment', withGuild: true });
    const before = wallets(fixture.beforePayment);
    const guild = fixture.beforePayment.players.find(player => player.faction === 'guild')!;
    const paid = paySkillsTechPaymentsFixture(fixture);
    const expected = { ...before };
    expected[fixture.payer] -= 4;
    expected[guild.id] += 4;
    assert.deepEqual(wallets(paid), expected, 'The original Guild fee excludes both deferred earnings.');
    assert.equal(paid.players.find(player => player.id === fixture.payer)!.forces[fixture.destination!], 5);
    assert.equal(paid.techTokens!.heighliners.spice, 1);
    assert.deepEqual(deferred(paid, fixture.owner), []);
    assertSeparateCollections(fixture, paid, 0, 1);
  });

  void test(`${band} Guild's actual own-bank shipment earns Banker but is excluded from the original Heighliners trigger`, () => {
    const fixture = createSkillsTechPaymentsFixture({ advanced, kind: 'guild-shipment' });
    const before = fixture.beforePayment.players.find(player => player.id === fixture.payer)!;
    const paid = paySkillsTechPaymentsFixture(fixture);
    const after = paid.players.find(player => player.id === fixture.payer)!;
    assert.equal(after.spice, before.spice - 4);
    assert.equal(after.reserves, before.reserves - 8);
    assert.equal(after.forces[fixture.destination!], 8);
    assert.equal(paid.techTokens!.heighliners.spice, 0);
    assert.equal(paid.techTokens!.heighliners.triggeredTurn, undefined);
    assert.deepEqual(deferred(paid, fixture.owner), [{ owner: fixture.owner, amount: 1 }]);
    assertSeparateCollections(fixture, paid, 1, 0);
  });
}

void test('fresh authenticated payment fixture retains original faction identities through setup, real Smuggler invoice and Mentat', () => {
  const initial = createGame('AUTHTECH', newPlayer('human-owner', 'Human owner', 'emperor'), true);
  joinGame(initial, newPlayer('human-companion', 'Human companion', 'harkonnen'));
  joinGame(initial, newPlayer('human-banker', 'Human banker', 'atreides'));
  const identities = initial.players.map(player => ({ id: player.id, name: player.name, faction: player.faction }));
  const fixture = createSkillsTechPaymentsFixture({ initial, kind: 'shipment' });
  assert.equal(fixture.payer, 'human-companion');
  assert.equal(fixture.owner, 'human-banker');
  const paid = paySkillsTechPaymentsFixture(fixture);
  assert.equal(paid.players.find(player => player.id === fixture.payer)!.spice,
    fixture.beforePayment.players.find(player => player.id === fixture.payer)!.spice - 4);
  const mentat = assertSeparateCollections(fixture, paid, 1, 1);
  assert.deepEqual(mentat.players.map(player => ({ id: player.id, name: player.name, faction: player.faction })), identities);
});
