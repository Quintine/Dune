import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nexusTleilaxuBotActions } from '../game/nexus-tleilaxu-options';

/** Synthetic authorized offer: this tests shared bot policy, not acquisition
 * or source-effect execution, which belong to the engine suite. */
function fixture(): GameView {
  const g = createGame('DANCERBOTS', newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'a',
    order: ['t', 'a', 'h'],
  });
  const v = viewGame(g, 't');
  v.nexusCards = {
    card: 'tleilaxu',
    deckCount: 11,
    discardCount: 0,
    held: { t: true, a: false, h: false },
    turn: null,
    choices: [],
    waiting: [],
  };
  v.nexusTleilaxu = {
    cunning: { event: 'dancer-event', count: 1, blocked: null },
  };
  return v;
}

void test('every bot profile takes the complete offered replacement off turn without a choice handshake', () => {
  for (const difficulty of DIFFICULTIES)
    for (const count of [1, 2, 3]) {
      const v = fixture();
      v.players[0].bot = difficulty;
      v.nexusTleilaxu!.cunning!.count = count;
      v.decision = { kind: 'nullentropy', player: 'a' };
      const before = structuredClone(v);
      assert.deepEqual(botActions(v), [
        { type: 'nexusFaceDancers', event: 'dancer-event' },
      ]);
      assert.deepEqual(v, before);
    }
});

void test('all bot profiles preserve Truth, closing draw, automatic and preceding exchange priorities', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = fixture();
    v.players[0].bot = difficulty;
    v.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
      question: null,
    };
    assert.deepEqual(botActions(v), [{ type: 'truthPass' }]);
    v.truthtrance = null;
    v.automaticContinuationPending = true;
    assert.deepEqual(botActions(v), []);
    v.automaticContinuationPending = false;
    v.nexusCards!.waiting = ['a'];
    assert.deepEqual(botActions(v), []);
    v.nexusCards!.waiting = [];
    v.nexusTraitors = {
      offer: null,
      pending: {
        event: 'exchange',
        owner: 'h',
        mode: 'cunning',
        count: 1,
        choices: [],
      },
    };
    assert.deepEqual(botActions(v), []);
    v.nexusTraitors = null;
    v.nexusTleilaxu!.cunning!.blocked = 'Cunning is unavailable.';
    assert.deepEqual(nexusTleilaxuBotActions(v), []);
    v.nexusTleilaxu = null;
    assert.deepEqual(nexusTleilaxuBotActions(v), []);
  }
});

void test('replacement policy never reads any private hand, traitor, dancer or spice field', () => {
  const v = fixture();
  v.players[0].bot = 'Brutal';
  for (const player of v.players)
    for (const field of ['hand', 'traitors', 'faceDancers', 'spice'])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`Read private ${field}`);
        },
      });
  assert.deepEqual(botActions(v), [
    { type: 'nexusFaceDancers', event: 'dancer-event' },
  ]);
  v.me = 'a';
  assert.deepEqual(nexusTleilaxuBotActions(v), []);
});
