import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSmugglerArtilleryJourney, finishSmugglerArtilleryJourney, revealSmugglerArtilleryJourney,
  settleSmugglerArtilleryJourney, smugglerArtilleryPlayer as player,
} from './fixture-smuggler-artillery-journey';

for (const scenario of [
  { weapon: 'artillery', ownTraitor: false, stunned: true, transfer: 0 },
  { weapon: 'artillery', ownTraitor: true, stunned: false, transfer: 6 },
  { weapon: 'stunner', ownTraitor: false, stunned: false, transfer: 6 },
] as const) {
  void test(`genuine native Ix Smuggler: shielded ${scenario.weapon}, own Traitor ${scenario.ownTraitor}`, () => {
    const f = createSmugglerArtilleryJourney(scenario);
    for (const shipment of f.shipments) {
      assert.equal(player(shipment.before, shipment.actor).spice - player(shipment.after, shipment.actor).spice,
        shipment.actor === f.owner ? 4 : 2);
      assert.equal(player(shipment.before, shipment.actor).reserves - player(shipment.after, shipment.actor).reserves, 2);
      assert.equal(player(shipment.after, shipment.actor).forces['south_mesa:5'], 2);
    }
    for (const movement of f.movements) {
      assert.equal(player(movement.after, movement.actor).forces['south_mesa:5'] ?? 0, 0);
      assert.equal(player(movement.after, movement.actor).forces[f.key], 2);
      assert.equal(player(movement.after, movement.actor).spice, player(movement.before, movement.actor).spice);
    }
    const piles = { ...f.game.spice };
    const wallets = Object.fromEntries(f.game.players.map(p => [p.id, p.spice]));
    const revealed = revealSmugglerArtilleryJourney(f);
    assert.equal(revealed.battle!.smugglerCollection!.strength, f.cap);
    assert.equal(revealed.battle!.smugglerCollection!.amount, f.cap);
    assert.equal(revealed.battle!.smugglerCollection!.stage, 'pending');
    assert.deepEqual(revealed.spice, piles);
    assert.equal(player(revealed, f.owner).spice, wallets[f.owner], 'Reveal-time collection is not yet spendable');

    const { game: settled, resolution } = settleSmugglerArtilleryJourney(revealed, f);
    const receipt = settled.lastBattleContext!.smugglerCollection!;
    assert.equal(settled.decision!.kind, 'battleCards', 'Real winner cleanup exposes payout before ordinary Collection');
    assert.equal(settled.phase, 6);
    assert.equal(settled.lastBattleContext!.winner, f.owner);
    assert.equal(settled.lastBattleContext!.result, scenario.ownTraitor ? 'traitor' : 'normal');
    assert.equal(resolution.effects?.stunned ?? false, scenario.stunned);
    assert.equal(player(settled, f.owner).leaders.find(l => l.id === f.leader)!.dead, false);
    assert.equal(player(settled, f.opponent).leaders.find(l => l.id === f.opposingLeader)!.dead, scenario.ownTraitor);
    assert.equal(receipt.stage, scenario.stunned ? 'void' : 'collected');
    assert.equal(receipt.strength, f.cap, 'Actual zeroing does not rewrite the reveal-time cap');
    assert.equal(receipt.allocations, undefined, 'No pile-selection action was needed');
    assert.deepEqual(settled.spice, { ...piles, [f.key]: f.printedAmount - scenario.transfer });
    const opposingStrength = player(f.game, f.opponent).leaders.find(l => l.id === f.opposingLeader)!.strength;
    assert.equal(player(settled, f.owner).spice,
      wallets[f.owner] + scenario.transfer + (scenario.ownTraitor ? opposingStrength : -1),
      'Only actual Smuggler transfer, paid support, and a real Traitor bounty affect this wallet');
    assert.equal(player(settled, f.opponent).spice, wallets[f.opponent]);
    assert.equal(player(settled, f.owner).forces[f.key], scenario.ownTraitor ? 2 : 1);
    assert.equal(player(settled, f.opponent).forces[f.key] ?? 0, 0);
    if (scenario.ownTraitor) {
      assert.equal(resolution.effects, null, 'The genuine sole own Traitor bypasses Artillery entirely');
      assert.equal(resolution.scores, null);
      assert.ok(player(settled, f.owner).revealedTraitors?.includes(f.opposingLeader));
    } else {
      const ownSide = revealed.battle!.attacker === f.owner ? 'attacker' : 'defender';
      const otherSide = ownSide === 'attacker' ? 'defender' : 'attacker';
      assert.equal(resolution.scores![ownSide], scenario.stunned ? 1 : f.cap + 1);
      if (scenario.stunned) assert.equal(resolution.scores![otherSide], 0, 'Both living leaders really contribute zero');
    }
    const continued = finishSmugglerArtilleryJourney(settled);
    assert.equal(continued.turn, 1);
    assert.equal(continued.phase, 7, 'Keep the original optional cards and continue to native Collection');
    assert.equal(continued.battle, null);
  });
}
