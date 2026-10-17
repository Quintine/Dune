import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { quotePhaseResources } from '../game/phase-resource-quote';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  advanceBankerWorldDefault, bankerWorldBeforeMentat, bankerWorldClean, bankerWorldPlayer,
  bankerWorldWallets, createBankerWorldDefaultFixture, payBankerWorldDefault,
} from './fixture-banker-world-default';

void test('ordinary all14 native World: explicit Guild homeworld withdrawal pays Bank four and defers one without Heighliners income', () => {
  const f = createBankerWorldDefaultFixture(), before = f.game;
  assert.equal(before.status, 'playing');
  assert.equal(before.turn, 1);
  assert.equal(before.phase, 5);
  assert.equal(before.active, f.payer);
  assert.ok(bankerWorldClean(before));
  assert.equal(bankerWorldPlayer(before, f.payer).shipped, false);
  assert.ok(before.homeworlds?.custody && before.nexusCards?.cards && before.discoveries && before.strongholdCards);
  const trained = before.leaderSkills!.assignments.find(a => a.skill === 'spice-banker')!;
  assert.equal(trained.owner, f.owner);
  assert.equal(trained.leader, f.trainer);
  assert.equal(bankerWorldPlayer(before, f.owner).faction, 'richese');
  assert.equal(bankerWorldPlayer(before, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
  assert.equal(f.shipment.actor, f.payer);
  assert.deepEqual(f.shipment.action.homeworldSources, { 'homeworld:guild': { normal: 4, elite: 0 } });
  assert.deepEqual(f.shipment.action.homeworldSources, nativeShipmentSources(viewGame(before, f.payer), 4, 0));
  assert.equal(f.shipment.action.type, 'ship');
  assert.equal(f.shipment.action.amount, 4);
  assert.equal(f.shipment.action.elite, 0);
  const key = `${String(f.shipment.action.territory)}:${String(f.shipment.action.sector)}`;
  assert.ok(before.players.every(p => !p.forces[key]));
  assert.deepEqual(viewGame(before, f.owner).spiceBankerIncome!.deferred, []);

  const wallets = bankerWorldWallets(before), reserves = bankerWorldPlayer(before, f.payer).reserves;
  const paid = payBankerWorldDefault(f);
  assert.deepEqual(bankerWorldWallets(paid), { ...wallets, [f.payer]: wallets[f.payer] - 4 });
  assert.equal(bankerWorldPlayer(paid, f.payer).reserves, reserves - 4);
  assert.equal(bankerWorldPlayer(paid, f.payer).forces[key], 4);
  assert.equal(bankerWorldPlayer(paid, f.payer).shipped, true);
  assert.equal(paid.phase, 5);
  assert.equal(paid.active, f.payer);
  assert.equal(paid.response, null);
  // Guild's own off-planet shipment is explicitly excluded by Heighliners.
  // Tech custody/accrual is not reassigned to make this experiment pay out.
  assert.deepEqual(paid.techTokens, before.techTokens);
  assert.equal(paid.techTokens!.heighliners.spice, 0);
  const sources = paid.spiceBankerIncome!.sources.slice(before.spiceBankerIncome!.sources.length);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].source.kind, 'shipment');
  assert.equal(sources[0].source.turn, 1);
  assert.equal(sources[0].source.phase, 5);
  assert.deepEqual(sources[0].source.bankLegs, [{ payer: f.payer, amount: 4 }]);
  assert.equal(sources[0].source.trainer!.assignment.leader, f.trainer);
  assert.equal(sources[0].source.trainer!.faceUp, true);
  assert.equal(sources[0].source.trainer!.captured, false);
  assert.equal(sources[0].grant!.owner, f.owner);
  assert.equal(sources[0].grant!.amount, 1);
  assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome, {
    deferred: [{ owner: f.owner, amount: 1 }], usedThisPhase: [f.owner],
  });
});

void test('pending normal Banker spice cannot fund a real bribe; the final original Collection ready collects exactly once at Mentat 1', () => {
  const f = createBankerWorldDefaultFixture(), paid = payBankerWorldDefault(f);
  const owner = bankerWorldPlayer(paid, f.owner), controls = viewGame(paid, f.owner).bribeOptions;
  assert.equal(controls.blocked, null);
  assert.equal(controls.available, owner.spice);
  assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  const frozen = structuredClone(paid);
  assert.throws(() => applyAction(paid, f.owner,
    { type: 'bribe', target: 'emperor', amount: owner.spice + 1 }), /Spice/);
  assert.deepEqual(paid, frozen);
  // Same legal native action/target succeeds at the actual wallet boundary.
  const affordable = applyAction(paid, f.owner, { type: 'bribe', target: 'emperor', amount: owner.spice });
  assert.equal(bankerWorldPlayer(affordable, f.owner).spice, 0);
  assert.equal(bankerWorldPlayer(affordable, 'emperor').bribes, owner.spice);
  assert.deepEqual(viewGame(affordable, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);

  // Continue the unmodified paid branch: no synthetic army, ownership, phase or
  // wallet edits, and no bribe receipt enters this Mentat income baseline.
  const boundary = bankerWorldBeforeMentat(paid);
  assert.equal(boundary.beforeCollection.phase, 5);
  assert.equal(boundary.collectionAction.action.type, 'endMovement');
  assert.equal(boundary.collectionAction.actor, boundary.beforeCollection.active);
  assert.ok(bankerWorldClean(boundary.beforeCollection));
  // All native Tech/World shipment effects have already settled. Collection's
  // independently quoted stronghold/desert money is distinct from the front.
  assert.deepEqual(quotePhaseResources(boundary.beforeCollection).credits, []);
  const nativeCollection = quoteSpiceCollection(boundary.beforeCollection);
  assert.deepEqual(bankerWorldWallets(boundary.collection),
    Object.fromEntries(nativeCollection.receipts.map(r => [r.player, r.balance])));
  assert.deepEqual(viewGame(boundary.collection, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  assert.equal(boundary.game.turn, 1);
  assert.equal(boundary.game.phase, 7);
  assert.ok(bankerWorldClean(boundary.game));
  assert.equal(boundary.game.ready.length, boundary.game.players.length - 1);
  assert.deepEqual(boundary.action.action, { type: 'ready' });
  assert.ok(!boundary.game.ready.includes(boundary.action.actor));
  assert.deepEqual(bankerWorldWallets(boundary.game), bankerWorldWallets(boundary.collection));
  assert.equal(boundary.game.spiceBankerIncome!.collections.length, 0);
  const wallets = bankerWorldWallets(boundary.game);
  const mentat = applyAction(boundary.game, boundary.action.actor, boundary.action.action);
  assert.equal(mentat.turn, 1);
  assert.equal(mentat.phase, 8);
  assert.deepEqual(bankerWorldWallets(mentat), { ...wallets, [f.owner]: wallets[f.owner] + 1 });
  assert.deepEqual(viewGame(mentat, f.owner).spiceBankerIncome!.deferred, []);
  assert.equal(mentat.spiceBankerIncome!.collections.length, 1);
  const collection = mentat.spiceBankerIncome!.collections[0];
  assert.equal(collection.turn, 1);
  assert.equal(collection.phase, 8);
  assert.deepEqual(collection.credits, [{ owner: f.owner, amount: 1 }]);
  assert.deepEqual(collection.grants, mentat.spiceBankerIncome!.sources.filter(r => r.grant).map(r => r.cursor));
  const nextTurn = advanceBankerWorldDefault(mentat, g => g.turn === 2 && g.phase === 0 && bankerWorldClean(g));
  assert.deepEqual(nextTurn.spiceBankerIncome!.collections, mentat.spiceBankerIncome!.collections);
  assert.deepEqual(bankerWorldWallets(nextTurn), bankerWorldWallets(mentat));
  assert.deepEqual(viewGame(nextTurn, f.owner).spiceBankerIncome!.deferred, []);
});

void test('ordinary World Guild self-shipment below four still debits Bank and withdraws physical homeworld forces, but grants nothing', () => {
  const f = createBankerWorldDefaultFixture(), wallets = bankerWorldWallets(f.game);
  const sources = nativeShipmentSources(viewGame(f.game, f.payer), 3, 0);
  assert.ok(sources);
  const paid = payBankerWorldDefault(f, { ...f.shipment.action, amount: 3, homeworldSources: sources });
  assert.deepEqual(bankerWorldWallets(paid), { ...wallets, [f.payer]: wallets[f.payer] - 3 });
  assert.equal(bankerWorldPlayer(paid, f.payer).reserves, bankerWorldPlayer(f.game, f.payer).reserves - 3);
  assert.equal(bankerWorldPlayer(paid, f.payer).forces[`${String(f.shipment.action.territory)}:${String(f.shipment.action.sector)}`], 3);
  const receipt = paid.spiceBankerIncome!.sources.at(-1)!;
  assert.equal(receipt.source.kind, 'shipment');
  assert.deepEqual(receipt.source.bankLegs, [{ payer: f.payer, amount: 3 }]);
  assert.equal(receipt.grant, null);
  assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred, []);
  assert.deepEqual(paid.techTokens, f.game.techTokens);
});

void test('a played ordinary Skills save without income metadata keeps its legacy payment and Mentat behavior', () => {
  const f = createBankerWorldDefaultFixture();
  // Recreate the pre-cutover serialized shape, not a fresh setup option.
  const legacy = structuredClone(f.game);
  delete legacy.spiceBankerIncomePreview;
  delete legacy.spiceBankerIncome;
  const wallets = bankerWorldWallets(legacy);
  const paid = payBankerWorldDefault({ ...f, game: legacy });
  assert.deepEqual(bankerWorldWallets(paid), { ...wallets, [f.payer]: wallets[f.payer] - 4 });
  assert.equal(paid.spiceBankerIncomePreview, undefined);
  assert.equal(paid.spiceBankerIncome, undefined);
  assert.equal(viewGame(paid, f.owner).spiceBankerIncome, null);
  const boundary = bankerWorldBeforeMentat(paid);
  const mentat = applyAction(boundary.game, boundary.action.actor, boundary.action.action);
  assert.equal(mentat.phase, 8);
  assert.deepEqual(bankerWorldWallets(mentat), bankerWorldWallets(boundary.game));
  assert.equal(mentat.spiceBankerIncome, undefined);
});
