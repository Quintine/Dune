import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  completeSelectedPhaseRecruits, createSelectedPhaseRecruitsFixture,
  selectedPhaseRecruitsInventory as inventory, selectedPhaseRecruitsPlayer as player,
} from './fixture-selected-phase-recruits';

for (const advanced of [false, true]) {
  void test(`public all-six-native selected-family ${advanced ? 'Advanced Stronghold and Tech' : 'Basic Tech'} Recruits earns an extra free return and separate native/token income`, () => {
    const f = createSelectedPhaseRecruitsFixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.deepEqual(f.setup.players.map(seat => seat.faction), ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani']);
    assert.deepEqual(f.setup.expansions, ['ix', 'choam', 'ecaz']);
    assert.ok(f.setup.ecazTreachery && f.setup.techTokens);
    assert.equal(!!f.setup.strongholdCards, advanced);
    assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'ecazTreachery' && step.action.enabled === true));
    assert.ok(!f.game.homeworlds && !f.game.leaderSkills && !f.game.nexusCards && !f.game.discoveryEnabled && !f.game.semutaPreview);
    assert.equal(f.originalInventory.length, 60); assert.deepEqual(inventory(f.game), f.originalInventory);
    assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
    assert.equal(f.beforeAuctionOrder.phase, 1); assert.equal(f.unopenedAuctionOrder.card, RECRUITS_CARD_ID);
    assert.equal(f.acquisition.before.auction?.index, 0);
    assert.equal(f.acquisition.before.auction?.cards[0].id, RECRUITS_CARD_ID);
    assert.equal(f.acquisition.bid.actor, f.owner); assert.equal(f.acquisition.bid.action.amount, 1);
    assert.equal(player(f.acquisition.before, f.owner).spice - player(f.acquisition.after, f.owner).spice, 1);
    assert.ok(player(f.acquisition.after, f.owner).hand.some(card => card.id === RECRUITS_CARD_ID));
    assert.equal(player(f.shipment.after, f.owner).forces[f.casualtyLocation], 3);
    assert.equal(player(f.shipment.before, f.owner).spice - player(f.shipment.after, f.owner).spice, 6);
    assert.equal(f.storm.before.stormMovementSource?.kind, advanced ? 'card' : 'dials');
    assert.equal(player(f.storm.after, f.owner).forces[f.casualtyLocation], undefined);
    assert.equal(player(f.game, f.owner).tanks, 3); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4);
    const ordinary = viewGame(f.game, f.owner).revival;
    assert.equal(ordinary.freeRemaining, 2); assert.equal(ordinary.limit, 3);
    if (advanced) {
      assert.equal(f.game.revivalOrder?.remaining[0], f.owner);
      assert.equal(f.mentat.after.strongholdCards?.claimedTurn, 1);
      assert.equal(f.mentat.after.strongholdCards?.owners.carthag, f.owner);
    }

    const before = structuredClone(f.game);
    const result = completeSelectedPhaseRecruits(f);
    assert.deepEqual(f.game, before, 'Completing the native programme retains its reusable pre-play source');
    assert.deepEqual(result.play.steps[0], { actor: f.owner, action: f.playAction });
    assert.equal(result.play.after.recruits?.turn, 2);
    assert.equal(player(result.play.after, f.owner).hand.some(card => card.id === RECRUITS_CARD_ID), false);
    assert.equal(result.play.after.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
    const doubled = viewGame(result.play.after, f.owner).revival;
    assert.equal(doubled.freeRemaining, 4); assert.equal(doubled.limit, 7);
    assert.equal(player(result.play.after, f.owner).tanks, 3);
    assert.equal(player(result.play.after, f.owner).spice, player(f.game, f.owner).spice);
    assert.throws(() => applyAction(result.play.after, f.owner, f.playAction));

    assert.deepEqual(result.revival.steps[0], { actor: f.owner, action: f.revivalAction });
    const returned = player(result.revival.after, f.owner), prior = player(result.revival.before, f.owner);
    assert.equal(returned.tanks, 0); assert.equal(returned.reserves - prior.reserves, 3);
    assert.equal(returned.revived, 3); assert.equal(returned.freeForcesRevived, 3);
    assert.equal(returned.spice, prior.spice, 'The third counter uses the additional free rate rather than a paid return');
    assert.equal(player(result.revival.after, f.bankOwner).spice - player(result.revival.before, f.bankOwner).spice, 1,
      'Native Tleilaxu free-revival income is one separate bank spice');
    assert.equal(result.revival.after.techTokens?.axlotl.owner, f.bankOwner);
    assert.equal(result.revival.after.techTokens?.axlotl.spice, 1);
    assert.equal(result.revival.after.techTokens?.axlotl.triggeredTurn, 2);
    assert.equal(result.revivalPayout.after.techTokens?.axlotl.spice, 0);
    assert.equal(player(result.revivalPayout.after, f.bankOwner).spice - player(result.revivalPayout.before, f.bankOwner).spice, 1,
      'Original Axlotl payout waits for the actual Revival phase boundary');
    assert.equal(result.game.turn, 2); assert.equal(result.game.phase, 5);
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.equal(result.game.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
    for (const seat of result.game.players)
      assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, amount) => sum + amount, 0), 20);
  });
}
