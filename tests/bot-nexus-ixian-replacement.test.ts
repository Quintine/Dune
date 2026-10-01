import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { GameView } from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createIxianNexusReplacementFixture, settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

void test('all four profiles replace the authorized purchased worthless card and preserve the funded native sale', () => {
  for (const profile of DIFFICULTIES) for (const advanced of [false, true]) for (const karama of [false, true]) {
    const fixture = createIxianNexusReplacementFixture({ advanced, karama, purchasedKind: 'worthless' });
    const own = viewGame(fixture.game, fixture.buyer);
    own.players.find(player => player.id === fixture.buyer)!.bot = profile;
    const actions = botActions(own);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'nexusIxianReplacementUse');
    const result = settleIxianReplacementFixture(applyAction(fixture.game, fixture.buyer, actions[0]));
    const kept = settleIxianReplacementFixture(applyAction(fixture.game, fixture.buyer, { type: 'nexusIxianReplacementPass', event: fixture.event }));
    assert.equal(viewGame(result, fixture.buyer).nexusIxianReplacement, null);
    assert.equal(result.nexusCards?.cards?.hands[fixture.buyer], null);
    assert.equal(result.players.find(player => player.id === fixture.buyer)!.hand.length,
      fixture.game.players.find(player => player.id === fixture.buyer)!.hand.length);
    const nextCard = fixture.nextCard;
    assert.ok(nextCard);
    assert.ok(result.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === nextCard.id));
    assert.deepEqual(result.players.map(player => ({ id: player.id, spice: player.spice })),
      kept.players.map(player => ({ id: player.id, spice: player.spice })));
    assert.equal(result.auction?.index, kept.auction?.index);
    assert.equal(result.phase, kept.phase);
  }
});

void test('all profiles prioritize neutral wrong-face Pass over native bids and retain both owned cards', () => {
  for (const profile of DIFFICULTIES) for (const endingAuction of [false, true]) {
    const fixture = createIxianNexusReplacementFixture({ face: 'richese', endingAuction });
    const own = viewGame(fixture.game, fixture.buyer);
    own.players.find(player => player.id === fixture.buyer)!.bot = profile;
    const actions = botActions(own);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'nexusIxianReplacementPass');
    const result = settleIxianReplacementFixture(applyAction(fixture.game, fixture.buyer, actions[0]));
    assert.equal(viewGame(result, fixture.buyer).nexusIxianReplacement, null);
    assert.equal(result.nexusCards?.cards?.hands[fixture.buyer], 'richese');
    assert.ok(result.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === fixture.purchased.id));
    if (endingAuction) assert.equal(result.auction, null);
    const before = JSON.stringify(result);
    assert.throws(() => applyAction(result, fixture.buyer, actions[0]));
    assert.equal(JSON.stringify(result), before);
  }
});

void test('private eligibility and sole buyer ownership override held-face hints for every profile', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createIxianNexusReplacementFixture();
    const own = viewGame(fixture.game, fixture.buyer);
    own.players.find(player => player.id === fixture.buyer)!.bot = profile;
    for (const restriction of ['canUse', 'blocked'] as const) {
      const blocked = structuredClone(own);
      if (restriction === 'canUse') blocked.nexusIxianReplacement!.canUse = false;
      else blocked.nexusIxianReplacement!.blocked = 'The current source is reserved.';
      const actions = botActions(blocked);
      assert.equal(actions.length, 1);
      assert.equal(actions[0].type, 'nexusIxianReplacementPass');
      const result = applyAction(fixture.game, fixture.buyer, actions[0]);
      assert.equal(result.nexusCards?.cards?.hands[fixture.buyer], 'ixians');
      assert.ok(result.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === fixture.purchased.id));
    }
    own.nexusIxianReplacement!.canPass = false;
    assert.deepEqual(botActions(own), []);
    for (const rival of fixture.game.players.filter(player => player.id !== fixture.buyer)) {
      const view = viewGame(fixture.game, rival.id);
      view.players.find(player => player.id === rival.id)!.bot = profile;
      assert.deepEqual(botActions(view), []);
    }
  }
});

void test('human ownership, room locks and delegated buyers never cause a pending-source bot wait loop', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createIxianNexusReplacementFixture({ endingAuction: true });
    const own: GameView = viewGame(fixture.game, fixture.buyer);
    const seat = own.players.find(player => player.id === fixture.buyer)!;
    delete seat.bot;
    delete seat.autopilot;
    assert.deepEqual(botActions(own), []);
    seat.autopilot = profile;
    for (const restriction of ['paused', 'closed'] as const) {
      const locked = structuredClone(own);
      locked.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
      assert.deepEqual(botActions(locked), []);
    }
    const delegated = structuredClone(fixture.game);
    for (const player of delegated.players) player.bot = profile;
    const result = settleIxianReplacementFixture(runBots(delegated, 1));
    assert.equal(viewGame(result, fixture.buyer).nexusIxianReplacement, null);
    assert.equal(result.nexusCards?.cards?.hands[fixture.buyer], null);
    assert.equal(result.auction, null);
  }
});
