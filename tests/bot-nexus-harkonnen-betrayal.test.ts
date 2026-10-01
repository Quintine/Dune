import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { GameView } from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createHarkonnenNexusBetrayalFixture } from './fixture-nexus-harkonnen-betrayal';

const scenarios = [
  { advanced: false, remote: false },
  { advanced: true, remote: false },
  { advanced: false, remote: true },
  { advanced: true, remote: true },
] as const;

void test('every minimal policy uses the actual legal cancellation without any rival private estimates', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) {
    const f = createHarkonnenNexusBetrayalFixture(scenario);
    const own = viewGame(f.game, f.holder);
    own.players.find(p => p.id === own.me)!.bot = difficulty;
    for (const rival of own.players.filter(p => p.id !== own.me)) {
      delete rival.hand;
      delete rival.traitors;
      delete rival.spice;
    }
    const actions = botActions(own);
    assert.deepEqual(actions, [{ type: 'nexusHarkonnenBetrayalUse', event: f.event }]);
    const result = applyAction(f.game, f.holder, actions[0]);
    assert.equal(viewGame(result, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.equal(result.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(result.players.find(p => p.id === f.provider)!.traitors.includes(f.identity), false);
    assert.equal(result.pendingNexusHarkonnenReplacement!.identity, f.identity);
    assert.equal(result.nexusCards!.cards!.discard.filter(card => card === 'harkonnen').length, 1);
  }
});

void test('every policy passes an irrelevant face and waits after its acknowledgement or outside public membership', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) {
    const f = createHarkonnenNexusBetrayalFixture({ ...scenario, face: 'richese', secondFace: 'guild', receiverCount: 2 });
    let game = f.game;
    for (const seat of game.players) {
      const own = viewGame(game, seat.id);
      own.players.find(p => p.id === own.me)!.bot = difficulty;
      const reaction = own.nexusHarkonnenBetrayalReaction;
      if (!reaction) break;
      const actions = botActions(own);
      if (!reaction.canPass || reaction.hasPassed) {
        assert.deepEqual(actions, []);
        continue;
      }
      assert.deepEqual(actions, [{ type: 'nexusHarkonnenBetrayalPass', event: f.event }]);
      game = applyAction(game, seat.id, actions[0]);
      const refreshed = viewGame(structuredClone(game), seat.id);
      refreshed.players.find(p => p.id === refreshed.me)!.bot = difficulty;
      if (refreshed.nexusHarkonnenBetrayalReaction) assert.deepEqual(botActions(refreshed), []);
    }
    assert.equal(viewGame(game, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.equal(game.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.equal(game.players.find(p => p.id === f.provider)!.traitors.includes(f.identity), true);
    assert.equal(game.pendingNexusHarkonnenReplacement ?? null, null);
  }
});

void test('canonical response permissions and room scheduling override hints under all four policies', () => {
  for (const difficulty of DIFFICULTIES) {
    const f = createHarkonnenNexusBetrayalFixture();
    const own: GameView = viewGame(f.game, f.holder);
    own.players.find(p => p.id === own.me)!.bot = difficulty;
    for (const reason of ['blocked', 'canUse'] as const) {
      const blocked = structuredClone(own);
      if (reason === 'blocked') blocked.nexusHarkonnenBetrayalReaction!.blocked = 'A committed promise reserves this Nexus card.';
      else blocked.nexusHarkonnenBetrayalReaction!.canUse = false;
      assert.deepEqual(botActions(blocked), [{ type: 'nexusHarkonnenBetrayalPass', event: f.event }]);
    }
    for (const reason of ['canPass', 'hasPassed', 'event', 'paused', 'closed', 'automatic', 'finished', 'human', 'phaseOpening'] as const) {
      const blocked = structuredClone(own);
      if (reason === 'canPass') blocked.nexusHarkonnenBetrayalReaction!.canPass = false;
      else if (reason === 'hasPassed') blocked.nexusHarkonnenBetrayalReaction!.hasPassed = true;
      else if (reason === 'event') blocked.nexusHarkonnenBetrayalReaction!.event = '';
      else if (reason === 'paused' || reason === 'closed') blocked.roomControl = { ...DEFAULT_ROOM_CONTROL, [reason]: true };
      else if (reason === 'automatic') blocked.automaticContinuationPending = true;
      else if (reason === 'human') {
        const seat = blocked.players.find(p => p.id === blocked.me)!;
        delete seat.bot;
        delete seat.autopilot;
      } else if (reason === 'phaseOpening') blocked.phaseOpening = { passed: [] };
      else blocked.status = 'finished';
      assert.deepEqual(botActions(blocked), []);
    }
  }
});

void test('the original native allied counter remains the bot decision before any Nexus cancellation', () => {
  for (const difficulty of DIFFICULTIES) for (const advanced of [false, true]) {
    const f = createHarkonnenNexusBetrayalFixture({ remote: true, advanced });
    assert.ok(f.beforeNativeCounter.response);
    const native = f.beforeNativeCounter;
    for (const seat of native.players) {
      const own = viewGame(native, seat.id);
      own.players.find(p => p.id === own.me)!.bot = difficulty;
      assert.equal(own.nexusHarkonnenBetrayalReaction, null);
      for (const action of botActions(own)) {
        assert.notEqual(action.type, 'nexusHarkonnenBetrayalUse');
        assert.notEqual(action.type, 'nexusHarkonnenBetrayalPass');
        // Exercise actual counter legality, rather than inventing a second gate.
        const result = applyAction(native, seat.id, action);
        assert.equal(result.nexusCards!.cards!.hands[f.holder], 'harkonnen');
        assert.equal(result.pendingNexusHarkonnenReplacement ?? null, null);
      }
    }
  }
});

void test('paced native bot execution uses or acknowledges every required seat without unrelated fallthrough', () => {
  for (const difficulty of DIFFICULTIES) for (const scenario of scenarios) for (const face of ['harkonnen', 'richese'] as const) {
    const f = createHarkonnenNexusBetrayalFixture({ ...scenario, face, secondFace: 'guild', receiverCount: 2 });
    let game = f.game;
    for (const id of f.required) game = applyAction(game, id, { type: 'setAutopilot', difficulty });
    for (let step = 0; step < f.required.length && viewGame(game, f.holder).nexusHarkonnenBetrayalReaction; step++) {
      game = runBots(game, 1);
    }
    assert.equal(viewGame(game, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.equal(game.nexusCards!.cards!.hands[f.holder], face === 'harkonnen' ? null : 'richese');
    assert.equal(game.players.find(p => p.id === f.provider)!.traitors.includes(f.identity), face !== 'harkonnen');
    assert.equal(game.pendingNexusHarkonnenReplacement?.identity ?? null, face === 'harkonnen' ? f.identity : null);
  }
});
