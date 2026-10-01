import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createIxianNexusBetrayalFixture } from './fixture-nexus-ixian-betrayal';

const scenarios = [
  { kind: 'bidding', advanced: false },
  { kind: 'bidding', advanced: true },
  { kind: 'technology', advanced: true },
] as const;

void test('all four profiles prevent both actual native advantages using only their own legal source projection', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) {
    const fixture = createIxianNexusBetrayalFixture(scenario);
    const own = viewGame(fixture.game, fixture.holder);
    own.players.find(seat => seat.id === fixture.holder)!.bot = difficulty;
    for (const rival of own.players.filter(seat => seat.id !== own.me)) {
      delete rival.hand;
      delete rival.spice;
    }
    const actions = botActions(own);
    assert.deepEqual(actions, [{ type: 'nexusIxianBetrayalUse', event: fixture.event }]);
    const result = applyAction(fixture.game, fixture.holder, actions[0]);
    assert.equal(viewGame(result, fixture.holder).nexusIxianBetrayalReaction, null);
    assert.equal(result.nexusCards!.cards!.hands[fixture.holder], null);
    assert.ok(result.nexusCards!.cards!.discard.includes('ixians'));
    assert.deepEqual(result.players.map(seat => ({ id: seat.id, spice: seat.spice, hand: seat.hand })),
      fixture.game.players.map(seat => ({ id: seat.id, spice: seat.spice, hand: seat.hand })));
    if (scenario.kind === 'bidding') {
      assert.equal(result.auction!.cards.length, fixture.nativeCount);
      assert.equal(result.ixAuction, null);
    } else {
      assert.equal(result.pendingIxTechnology, null);
      assert.equal(result.ixTechnologyTurn, result.turn);
      assert.deepEqual(result.auction!.cards, fixture.game.auction!.cards);
    }
  }
});

void test('all profiles acknowledge irrelevant faces and every required seat exactly once without bidding fallthrough or deadlock', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) {
    const fixture = createIxianNexusBetrayalFixture({ ...scenario, face: 'richese', secondFace: 'guild', receiverCount: 2 });
    let game = structuredClone(fixture.game);
    for (const seat of game.players) {
      const own = viewGame(game, seat.id);
      own.players.find(player => player.id === seat.id)!.bot = difficulty;
      const reaction = own.nexusIxianBetrayalReaction;
      if (!reaction) break;
      const actions = botActions(own);
      if (!reaction.canPass || reaction.hasPassed) {
        assert.deepEqual(actions, []);
        continue;
      }
      assert.deepEqual(actions, [{ type: 'nexusIxianBetrayalPass', event: fixture.event }]);
      game = applyAction(game, seat.id, actions[0]);
      const passed = viewGame(game, seat.id);
      passed.players.find(player => player.id === seat.id)!.bot = difficulty;
      if (passed.nexusIxianBetrayalReaction) assert.deepEqual(botActions(passed), []);
    }
    assert.equal(viewGame(game, fixture.holder).nexusIxianBetrayalReaction, null);
    assert.equal(game.nexusCards!.cards!.hands[fixture.holder], 'richese');
    if (scenario.kind === 'bidding') {
      assert.equal(game.decision?.kind, 'ixAuction');
      assert.equal(game.ixAuction!.cards.length, fixture.nativeCount + 1);
    } else {
      assert.ok(fixture.selected);
      assert.equal(game.auction!.cards[game.auction!.index].id, fixture.selected.id);
      assert.equal(game.players.find(seat => seat.id === fixture.provider)!.hand.some(card => card.id === fixture.selected!.id), false);
      assert.equal(game.pendingIxTechnology, null);
    }
  }
});

void test('seat-private ownership, expired events and room scheduling gates override held-card hints for every policy', () => {
  for (const difficulty of DIFFICULTIES) {
    const fixture = createIxianNexusBetrayalFixture();
    const own: GameView = viewGame(fixture.game, fixture.holder);
    own.players.find(seat => seat.id === own.me)!.bot = difficulty;
    for (const reason of ['blocked', 'canUse'] as const) {
      const blocked = structuredClone(own);
      if (reason === 'blocked') blocked.nexusIxianBetrayalReaction!.blocked = 'A committed promise reserves this Nexus card.';
      else blocked.nexusIxianBetrayalReaction!.canUse = false;
      assert.deepEqual(botActions(blocked), [{ type: 'nexusIxianBetrayalPass', event: fixture.event }]);
    }
    for (const reason of ['canPass', 'hasPassed', 'event', 'paused', 'closed', 'automatic', 'finished'] as const) {
      const blocked = structuredClone(own);
      if (reason === 'canPass') blocked.nexusIxianBetrayalReaction!.canPass = false;
      else if (reason === 'hasPassed') blocked.nexusIxianBetrayalReaction!.hasPassed = true;
      else if (reason === 'event') blocked.nexusIxianBetrayalReaction!.event = '';
      else if (reason === 'paused' || reason === 'closed') blocked.roomControl = { ...DEFAULT_ROOM_CONTROL, [reason]: true };
      else if (reason === 'automatic') blocked.automaticContinuationPending = true;
      else blocked.status = 'finished';
      assert.deepEqual(botActions(blocked), []);
    }
    for (const seat of fixture.game.players.filter(seat => seat.id !== fixture.holder)) {
      const rival = viewGame(fixture.game, seat.id);
      rival.players.find(player => player.id === seat.id)!.bot = difficulty;
      assert.deepEqual(botActions(rival), []);
    }
  }
});

void test('human seats wait for delegation; the real bot runner executes Use or every neutral Pass for all profiles', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) {
    for (const face of ['ixians', 'richese'] as const) {
      const fixture = createIxianNexusBetrayalFixture({ ...scenario, face, secondFace: 'guild', receiverCount: 2 });
      const human = viewGame(fixture.game, fixture.holder);
      const seat = human.players.find(player => player.id === human.me)!;
      delete seat.bot;
      delete seat.autopilot;
      assert.deepEqual(botActions(human), []);
      let delegated = fixture.game;
      for (const id of fixture.required) delegated = applyAction(delegated, id, { type: 'setAutopilot', difficulty });
      let result = delegated;
      for (let step = 0; step < fixture.required.length && viewGame(result, fixture.holder).nexusIxianBetrayalReaction; step++) {
        result = runBots(result, 1);
      }
      assert.equal(viewGame(result, fixture.holder).nexusIxianBetrayalReaction, null);
      assert.equal(result.nexusCards!.cards!.hands[fixture.holder], face === 'ixians' ? null : 'richese');
      if (scenario.kind === 'bidding') {
        assert.equal(face === 'ixians' ? result.auction!.cards.length : result.ixAuction!.cards.length,
          fixture.nativeCount + (face === 'ixians' ? 0 : 1));
      } else {
        assert.equal(result.auction!.cards[result.auction!.index].id,
          face === 'ixians' ? fixture.game.auction!.cards[fixture.game.auction!.index].id : fixture.selected!.id);
      }
    }
  }
});
