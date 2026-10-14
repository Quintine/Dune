import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Player } from '../game/engine';
import { createNexusFremenFreeQuotaFixture } from './fixture-nexus-fremen-free-quota';

function pools(player: Player) {
  return { reserves: player.reserves, tanks: player.tanks,
    eliteReserves: player.elites?.reserves ?? 0, eliteTanks: player.elites?.tanks ?? 0,
    eliteRevived: player.elites?.revived ?? 0, revived: player.revived,
    freeForcesRevived: player.freeForcesRevived ?? 0, spice: player.spice };
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} saved exact-three physical receipt adopts its exhausted quota without replaying the actual return`, () => {
    const fixture = createNexusFremenFreeQuotaFixture({ advanced });
    const before = fixture.game.players.find(player => player.id === fixture.owner)!;
    const offer = viewGame(fixture.game, fixture.owner).nexusFremenRevival!;
    const granted = applyAction(fixture.game, fixture.owner,
      { type: 'nexusFremenRevival', event: offer.event });
    const returned = applyAction(granted, fixture.owner, { type: 'revive', amount: 3, elite: 0 });
    const after = returned.players.find(player => player.id === fixture.owner)!;
    assert.equal(after.tanks, before.tanks - 3);
    assert.equal(after.freeForcesRevived, 3);
    // Only historical receipt encoding is changed; both physical snapshots came
    // from the genuine original producer and the actual native return above.
    const legacyReceipt = { event: offer.event, owner: fixture.owner, turn: returned.turn,
      phase: 4, faction: after.faction, advanced, elite: 0,
      before: pools(before), after: pools(after), signature: '' };
    legacyReceipt.signature = JSON.stringify({ ...legacyReceipt, signature: undefined });
    const legacy = JSON.parse(JSON.stringify({ ...returned,
      nexusFremenRevivalHistory: [legacyReceipt] })) as Game;
    delete legacy.revivalRules!.nexusFremen;
    const original = structuredClone(legacy);
    const projected = viewGame(legacy, fixture.owner);
    assert.equal(projected.revival.freeRemaining, 0);
    assert.deepEqual(legacy, original, 'Reading an old encoding cannot rewrite its physical state');
    const adopted = normalizeAutomaticGame(legacy);
    assert.deepEqual(adopted.players, returned.players);
    assert.deepEqual(adopted.nexusCards, returned.nexusCards);
    assert.deepEqual(adopted.ready, returned.ready);
    assert.equal(adopted.phase, 4);
    assert.equal(adopted.nexusFremenRevivalHistory![0].version, 2);
    assert.deepEqual(adopted.nexusFremenRevivalHistory![0].legacyReturn,
      { elite: 0, before: pools(before), after: pools(after) });
    assert.deepEqual(adopted.revivalRules!.nexusFremen,
      { turn: adopted.turn, owners: [fixture.owner] });
    assert.deepEqual(normalizeAutomaticGame(adopted), adopted,
      'A second adoption cannot replay the return or reopen the free quota');
    assert.throws(() => applyAction(adopted, fixture.owner,
      { type: 'nexusFremenRevival', event: offer.event }));
    assert.throws(() => applyAction(adopted, fixture.owner, { type: 'revive', amount: 1, elite: 0 }));
    assert.deepEqual(legacy, original);
    const broken = structuredClone(legacy);
    broken.nexusFremenRevivalHistory![0].signature = 'broken';
    const damaged = structuredClone(broken);
    assert.throws(() => viewGame(broken, fixture.owner));
    assert.throws(() => normalizeAutomaticGame(broken));
    assert.deepEqual(broken, damaged, 'Invalid historical facts fail without repairing or returning any force');
  });
}
