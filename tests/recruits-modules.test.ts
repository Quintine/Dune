import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { ownedTech } from '../game/tech-tokens';
import {
  advanceRecruitsModules, assertRecruitsModulesInventory, createRecruitsModulesFixture,
  recruitsModulesClean, recruitsModulesPlayer, type RecruitsModulesOptions,
} from './fixture-recruits-modules';

/**
 * GF9 Ecaz & Moritani pp11,16: Recruits doubles every player's current free
 * revival rate and raises the ordinary force-revival limit to seven. The
 * independent-profile programme uses the real original first-Storm Axlotl
 * custodian, real battle Tanks and a real Revival; Tech Tokens stay original
 * and the Axlotl payout waits for that Revival phase to end.
 */
const CONFIGURATIONS: { label: string; options: RecruitsModulesOptions }[] = [
  { label: 'Basic classic', options: {} },
  { label: 'Advanced classic with Stronghold Cards', options: { advanced: true, strongholds: true } },
  { label: 'Basic native Ixian', options: { roster: 'ix-native' } },
  { label: 'Advanced native Ixian with Stronghold Cards', options: { roster: 'ix-native', advanced: true, strongholds: true } },
];

for (const { label, options } of CONFIGURATIONS) {
  void test(`${label}: doubled physical revival retains its price and pays Axlotl once at phase end`, () => {
    const fixture = createRecruitsModulesFixture(options);
    const ordinary = new Map(fixture.game.players.map(player =>
      [player.id, viewGame(fixture.game, player.id).revival.freeRemaining]));
    const original = structuredClone(fixture.game);
    assert.throws(() => applyAction(original, fixture.owner, fixture.revivalAction));
    assert.deepEqual(original, fixture.game, 'The old three-force allowance cannot consume these counters');

    const activated = applyAction(fixture.game, fixture.owner, fixture.playAction);
    assert.equal(activated.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
    for (const player of activated.players) {
      const preview = viewGame(activated, player.id).recruitsPreview;
      const rate = preview?.rates.find(entry => entry.player === player.id);
      assert.equal(rate?.limit, 7);
      assert.equal(rate?.freeRate, Math.min(2 * ordinary.get(player.id)!, 7),
        'Every seat retains its own doubled current rate');
    }
    const before = recruitsModulesPlayer(activated, fixture.owner);
    const returned = applyAction(activated, fixture.owner, fixture.revivalAction);
    const owner = recruitsModulesPlayer(returned, fixture.owner);
    assert.equal(owner.revived, fixture.amount);
    assert.equal(owner.freeForcesRevived, fixture.doubled.freeRate);
    assert.equal(owner.reserves, before.reserves + fixture.amount);
    assert.equal(owner.tanks, 0);
    assert.equal(owner.spice, before.spice - 2 * (fixture.amount - fixture.doubled.freeRate),
      'Only paid counters cost spice; pending token income cannot fund this request');
    const accrual = ownedTech(returned.techTokens!, fixture.owner).length;
    assert.equal(returned.techTokens!.axlotl.spice, accrual);

    const second = applyAction(returned, fixture.opponent, fixture.secondRevivalAction);
    assert.equal(recruitsModulesPlayer(second, fixture.opponent).freeForcesRevived, 1);
    assert.equal(second.techTokens!.axlotl.spice, accrual,
      'A second actual free revival does not repeat income');
    assert.equal(recruitsModulesPlayer(second, fixture.owner).spice, owner.spice,
      'Neither free return collects the pending income');

    const settled = advanceRecruitsModules(second, state => state.phase === 5 && recruitsModulesClean(state));
    assert.equal(recruitsModulesPlayer(settled, fixture.owner).spice, owner.spice + accrual,
      'The phase boundary pays the original held income exactly once');
    assert.equal(settled.techTokens!.axlotl.spice, 0);
    assertRecruitsModulesInventory(settled, fixture.afterSetup);
  });
}
