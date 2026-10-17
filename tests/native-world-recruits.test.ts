import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, RuleError, viewGame, type Action, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  advanceNativeWorldRecruits, assertNativeWorldRecruitsInventory, createNativeWorldRecruitsFixture,
  nativeWorldRecruitsClean, nativeWorldRecruitsPlayer, requestNativeWorldRecruits,
} from './fixture-native-world-recruits';

const play = { type: 'card', card: RECRUITS_CARD_ID } as const;
function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action), RuleError);
  assert.equal(JSON.stringify(game), before);
}

function continueToShipment(game: Game): Game {
  const next = advanceNativeWorldRecruits(game, g => g.turn === 2 && g.phase === 5 && nativeWorldRecruitsClean(g));
  assert.ok(next.active, 'Original next Shipment must have its actual active seat');
  assertNativeWorldRecruitsInventory(next);
  return next;
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`${mode} native Ix deposits paid cyborgs and free suboids, reopens with Recruits, then reprices after population five`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'ixians' });
    const native = fixture.native;
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, native).spice, 10);
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, native).tanks, 14);
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, native).elites!.tanks, 4);
    assert.deepEqual(combatArmy(fixture.game, fixture.visitor, fixture.location), { normal: 1, elite: 0 });
    assert.equal(nativeWorldRecruitsPlayer(fixture.afterShipment, fixture.visitor).spice,
      nativeWorldRecruitsPlayer(fixture.beforeShipment, fixture.visitor).spice - 1);
    const paid = requestNativeWorldRecruits(fixture.game, native, 3, 1, 0);
    assert.equal(paid.price, 3, 'Two free suboids leave one cyborg at its original three-spice price');
    assert.equal(paid.walletDelta, 3);
    assert.equal(paid.free, 2);
    assert.deepEqual(paid.nativeAfter, { normal: 2, elite: 1 });
    let game = applyAction(paid.game, native, { type: 'ready' });
    game = applyAction(game, fixture.owner, play);
    assert.equal(nativeWorldRecruitsPlayer(game, native).spice, 7, 'Activation never refunds the paid cyborg');
    assert.equal(viewGame(game, native).revival.freeRemaining, 2);
    const crossing = requestNativeWorldRecruits(game, native, 2, 2, 2);
    assert.equal(crossing.price, 0);
    assert.equal(crossing.free, 2);
    assert.deepEqual(crossing.nativeAfter, { normal: 2, elite: 3 });
    game = crossing.game;
    const rate = viewGame(game, native).revival;
    assert.equal(rate.homeworldBonus, 0);
    assert.equal(rate.freeRemaining, 0, 'A separate request uses the now-high native World, not the original four-free rate');
    assert.equal(rate.eliteRemaining, 1, 'Ix retains its native multiple-cyborg allowance in both modes');
    rejectsUnchanged(game, native, { type: 'revive', amount: 2, elite: 2 });
    const last = requestNativeWorldRecruits(game, native, 2, 1, 0);
    assert.equal(last.price, 5, 'One paid cyborg plus one paid suboid still costs five');
    assert.equal(last.walletDelta, 5);
    assert.deepEqual(last.nativeAfter, { normal: 3, elite: 4 });
    assert.equal(nativeWorldRecruitsPlayer(last.game, native).freeForcesRevived, 4);
    assert.equal(nativeWorldRecruitsPlayer(last.game, native).revived, 7);
    assert.equal(nativeWorldRecruitsPlayer(last.game, native).spice, 2);
    assert.equal(nativeWorldRecruitsPlayer(last.game, native).tanks, 7);
    assert.equal(nativeWorldRecruitsPlayer(last.game, native).elites!.tanks, 0);
    rejectsUnchanged(last.game, native, { type: 'revive', amount: 1, elite: 0 });
    assert.equal(last.game.discard.filter(c => c.id === RECRUITS_CARD_ID).length, 1);
    continueToShipment(last.game);
  });

  void test(`${mode} the real mixed Ix Tanks retain the player's free-cyborg allocation and its distinct prices`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'ixians' });
    const active = applyAction(fixture.game, fixture.owner, play);
    rejectsUnchanged(active, fixture.native, { type: 'revive', amount: 8, elite: 3, freeElite: 0 });
    rejectsUnchanged(active, fixture.native, { type: 'revive', amount: 7, elite: 3, freeElite: 4 });
    for (const freeElite of [0, 3]) {
      const returned = requestNativeWorldRecruits(structuredClone(active), fixture.native, 7, 3, freeElite);
      assert.equal(returned.free, 4);
      assert.equal(returned.price, freeElite === 0 ? 9 : 6);
      assert.equal(returned.walletDelta, freeElite === 0 ? 9 : 6);
      assert.deepEqual(returned.nativeAfter, { normal: 4, elite: 3 });
      assert.equal(nativeWorldRecruitsPlayer(returned.game, fixture.native).elites!.tanks, 1);
      assert.equal(nativeWorldRecruitsPlayer(returned.game, fixture.native).tanks, 7);
      assertNativeWorldRecruitsInventory(returned.game);
      continueToShipment(returned.game);
    }
  });

  void test(`${mode} native Tleilaxu accepts eleven in one current-rate request without the ordinary seven cap`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'tleilaxu' });
    let game = applyAction(fixture.game, fixture.owner, play);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).spice, 5);
    rejectsUnchanged(game, fixture.native, { type: 'revive', amount: 12, elite: 0 });
    const returned = requestNativeWorldRecruits(game, fixture.native, 11);
    assert.equal(returned.price, 5, 'Six free and five half-price paid forces retain their accepted invoice');
    assert.equal(returned.free, 6);
    assert.equal(returned.walletDelta, 4, 'Original own free-revival income pays one spice separately');
    game = returned.game;
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).spice, 1);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).revived, 11);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).freeForcesRevived, 6);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).tanks, 9);
    assert.deepEqual(returned.nativeAfter, { normal: 11, elite: 0 });
    assert.equal(viewGame(game, fixture.native).revival.limit, 20);
    assert.equal(viewGame(game, fixture.native).revival.forcesRemaining, 9);
    assert.equal(viewGame(game, fixture.native).revival.freeRemaining, 0);
    assert.equal(viewGame(game, fixture.native).revival.homeworldBonus, 0);
    continueToShipment(game);
  });

  void test(`${mode} paid Tleilaxu returns are not refunded and a separate crossing request loses the low-World free bonus`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'tleilaxu' });
    const first = requestNativeWorldRecruits(fixture.game, fixture.native, 8);
    assert.equal(first.price, 5);
    assert.equal(first.free, 3);
    assert.equal(first.walletDelta, 4);
    let game = applyAction(first.game, fixture.owner, play);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).spice, 1);
    assert.equal(viewGame(game, fixture.native).revival.freeRemaining, 3);
    const crossing = requestNativeWorldRecruits(game, fixture.native, 1);
    assert.equal(crossing.free, 1);
    assert.equal(crossing.price, 0);
    assert.equal(crossing.walletDelta, 0, 'Own free-revival income is not awarded a second time');
    game = crossing.game;
    assert.deepEqual(crossing.nativeAfter, { normal: 9, elite: 0 });
    assert.equal(viewGame(game, fixture.native).revival.freeRemaining, 0);
    assert.equal(viewGame(game, fixture.native).revival.homeworldBonus, 0);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).freeForcesRevived, 4);
    rejectsUnchanged(game, fixture.native, { type: 'revive', amount: 2, elite: 0 });
    const paid = requestNativeWorldRecruits(game, fixture.native, 1);
    assert.equal(paid.price, 1);
    assert.equal(paid.walletDelta, 1);
    assert.equal(paid.free, 0);
    assert.deepEqual(paid.nativeAfter, { normal: 10, elite: 0 });
    assert.equal(nativeWorldRecruitsPlayer(paid.game, fixture.native).freeForcesRevived, 4);
    assert.equal(nativeWorldRecruitsPlayer(paid.game, fixture.native).spice, 0);
    continueToShipment(paid.game);
  });

  void test(`${mode} native CHOAM keeps unlimited one-spice returns and prior paid/free ledgers after Recruits`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'choam' });
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, fixture.native).spice, 15, 'Real CHOAM phase income funds the programme');
    const first = requestNativeWorldRecruits(fixture.game, fixture.native, 8);
    assert.equal(first.price, 7);
    assert.equal(first.walletDelta, 7);
    assert.equal(first.free, 1);
    let game = applyAction(first.game, fixture.owner, play);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).spice, 8);
    assert.equal(viewGame(game, fixture.native).revival.limit, 20);
    assert.equal(viewGame(game, fixture.native).revival.freeRemaining, 1);
    const free = requestNativeWorldRecruits(game, fixture.native, 1);
    assert.equal(free.price, 0);
    assert.equal(free.free, 1);
    const paid = requestNativeWorldRecruits(free.game, fixture.native, 3);
    assert.equal(paid.price, 3);
    assert.equal(paid.walletDelta, 3);
    assert.equal(paid.free, 0);
    game = paid.game;
    assert.deepEqual(paid.nativeAfter, { normal: 12, elite: 0 });
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).spice, 5);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).freeForcesRevived, 2);
    assert.equal(nativeWorldRecruitsPlayer(game, fixture.native).revived, 12);
    assert.equal(viewGame(game, fixture.native).revival.forcesRemaining, 8);
    assert.equal(viewGame(game, fixture.native).revival.homeworldBonus, 0);
    rejectsUnchanged(game, fixture.native, { type: 'revive', amount: 6, elite: 0 });
    continueToShipment(game);
  });

  void test(`${mode} native CHOAM can actually return seventeen with Recruits rather than merely quoting unlimited`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'choam' });
    const active = applyAction(fixture.game, fixture.owner, play);
    rejectsUnchanged(active, fixture.native, { type: 'revive', amount: 18, elite: 0 });
    const returned = requestNativeWorldRecruits(active, fixture.native, 17);
    assert.equal(returned.free, 2);
    assert.equal(returned.price, 15);
    assert.equal(returned.walletDelta, 15);
    assert.deepEqual(returned.nativeAfter, { normal: 17, elite: 0 });
    assert.equal(nativeWorldRecruitsPlayer(returned.game, fixture.native).spice, 0);
    assert.equal(nativeWorldRecruitsPlayer(returned.game, fixture.native).tanks, 3);
    assert.equal(viewGame(returned.game, fixture.native).revival.forcesRemaining, 3);
    continueToShipment(returned.game);
  });

  void test(`${mode} ordinary native Richese reopens a ready revival, receives six free plus one paid, and still stops at seven`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'richese' });
    const spice = nativeWorldRecruitsPlayer(fixture.game, fixture.native).spice;
    const first = requestNativeWorldRecruits(fixture.game, fixture.native, 3);
    assert.equal(first.price, 0);
    let game = applyAction(first.game, fixture.native, { type: 'ready' });
    game = applyAction(game, fixture.owner, play);
    assert.equal(viewGame(game, fixture.native).revival.freeRemaining, 3);
    rejectsUnchanged(game, fixture.native, { type: 'revive', amount: 5, elite: 0 });
    const free = requestNativeWorldRecruits(game, fixture.native, 3);
    assert.equal(free.price, 0);
    assert.equal(free.free, 3);
    const paid = requestNativeWorldRecruits(free.game, fixture.native, 1);
    assert.equal(paid.price, 2);
    assert.equal(paid.walletDelta, 2);
    assert.equal(paid.free, 0);
    assert.deepEqual(paid.nativeAfter, { normal: 7, elite: 0 });
    assert.equal(nativeWorldRecruitsPlayer(paid.game, fixture.native).freeForcesRevived, 6);
    assert.equal(nativeWorldRecruitsPlayer(paid.game, fixture.native).tanks, 13);
    assert.equal(nativeWorldRecruitsPlayer(paid.game, fixture.native).spice, spice - 2);
    rejectsUnchanged(paid.game, fixture.native, { type: 'revive', amount: 1, elite: 0 });
    continueToShipment(paid.game);
  });

  void test(`${mode} actual World battle Sardaukar casualties retain the ordinary elite cap despite Recruits`, () => {
    const fixture = createNativeWorldRecruitsFixture({ advanced, faction: 'ixians', imperialCasualties: true });
    assert.equal(fixture.shipmentPrice, 2);
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, fixture.visitor).tanks, 2);
    assert.equal(nativeWorldRecruitsPlayer(fixture.game, fixture.visitor).elites!.tanks, 2);
    let game = applyAction(fixture.game, fixture.owner, play);
    if (advanced) rejectsUnchanged(game, fixture.visitor, { type: 'revive', amount: 2, elite: 2 });
    const returned = requestNativeWorldRecruits(game, fixture.visitor, advanced ? 1 : 2, advanced ? 1 : 2);
    assert.equal(returned.price, 0);
    assert.equal(returned.walletDelta, 0);
    game = returned.game;
    const after = nativeWorldRecruitsPlayer(game, fixture.visitor);
    assert.equal(after.elites!.tanks, advanced ? 1 : 0);
    assert.equal(after.elites!.reserves, advanced ? 4 : 5);
    const worlds = viewGame(game, fixture.visitor).homeworlds?.worlds;
    assert.ok(worlds, 'The visitor needs its native World custody view');
    const destination = worlds.find(w => w.native === fixture.visitor && w.secondary === advanced);
    assert.ok(destination);
    assert.equal((destination.forces[fixture.visitor] ?? { normal: 0, elite: 0 }).elite, advanced ? 4 : 5);
    if (advanced) rejectsUnchanged(game, fixture.visitor, { type: 'revive', amount: 1, elite: 1 });
    continueToShipment(game);
  });
}

void test('Advanced all14 native Tleilaxu keeps its unlimited return, accepted low-World invoice and separate own free income', () => {
  const f = createNativeWorldRecruitsFixture({ advanced: true, skills: true, faction: 'tleilaxu',
    training: { emperor: 'mentat', tleilaxu: 'swordmaster-of-ginaz', guild: 'spice-banker' } });
  const active = applyAction(f.game, f.owner, play);
  const returned = requestNativeWorldRecruits(active, f.native, 11);
  assert.deepEqual({ price: returned.price, free: returned.free, wallet: returned.walletDelta },
    { price: 5, free: 6, wallet: 4 });
  assert.deepEqual(returned.nativeAfter, { normal: 11, elite: 0 });
  assert.equal(nativeWorldRecruitsPlayer(returned.game, f.native).spice, 1);
  assert.equal(nativeWorldRecruitsPlayer(returned.game, f.native).revived, 11);
  assert.equal(nativeWorldRecruitsPlayer(returned.game, f.native).freeForcesRevived, 6);
  assert.equal(nativeWorldRecruitsPlayer(returned.game, f.native).tanks, 9);
  const current = viewGame(returned.game, f.native).revival;
  assert.deepEqual({ limit: current.limit, remaining: current.forcesRemaining,
    free: current.freeRemaining, bonus: current.homeworldBonus },
  { limit: 20, remaining: 9, free: 0, bonus: 0 });
  const receipt = returned.game.spiceBankerIncome!.sources.at(-1)!;
  assert.equal(receipt.source.kind, 'force-revival');
  assert.deepEqual(receipt.source.bankLegs, [{ payer: f.native, amount: 5 }],
    'The actual paid invoice, not its net four-spice wallet delta, is the bank leg');
  assert.equal(receipt.grant?.owner, 'guild');
  const next = continueToShipment(returned.game);
  assert.equal(nativeWorldRecruitsPlayer(next, f.native).spice, 1);
  assert.equal(nativeWorldRecruitsPlayer(next, f.native).revived, 11);
  assert.equal(nativeWorldRecruitsPlayer(next, f.native).freeForcesRevived, 6);
  assert.equal(viewGame(next, 'guild').spiceBankerIncome!.deferred
    .find(row => row.owner === 'guild')?.amount, 1, 'Banker is not paid at Revival end');
});
