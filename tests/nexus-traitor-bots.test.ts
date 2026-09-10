import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  nexusTraitorBotActions,
  nexusTraitorDrawAction,
  nexusTraitorReturnAction,
} from '../game/nexus-traitor-options';
import {
  nexusTraitorDraw,
  nexusTraitorFixture,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';

void test('all four profiles complete actual Cunning and Face Dancer exchanges with conserved custody', () => {
  for (const ownerFaction of ['harkonnen', 'tleilaxu'] as const) {
    const initial = nexusTraitorFixture({ ownerFaction });
    for (const difficulty of DIFFICULTIES) {
      const v = viewGame(initial, 'p');
      v.players[0].bot = difficulty;
      const before = structuredClone(v);
      const begin = botActions(v);
      assert.equal(begin.length, 1);
      assert.equal(begin[0].type, 'nexusTraitorDraw');
      assert.deepEqual(v, before);
      const drawn = applyAction(initial, 'p', begin[0]);
      const pending = viewGame(drawn, 'p');
      pending.players[0].bot = difficulty;
      const returns = botActions(pending);
      assert.equal(returns.length, 1);
      assert.equal(returns[0].type, 'nexusTraitorReturn');
      const cards = returns[0].cards as string[];
      assert.equal(cards.length, ownerFaction === 'harkonnen' ? 1 : 2);
      assert.equal(new Set(cards).size, cards.length);
      assert.deepEqual(
        returns[0],
        nexusTraitorReturnAction(
          pending,
          pending.nexusTraitors!.pending!.event,
          cards,
        ),
      );
      const settled = applyAction(drawn, 'p', returns[0]);
      nexusTraitorInventory(settled);
      assert.equal(viewGame(settled, 'p').nexusTraitors!.pending, null);
    }
  }
});

void test('pending exchange outranks preserved controls and automatic flags while Truth outranks exchange and Nullentropy', () => {
  const g = nexusTraitorDraw(nexusTraitorFixture());
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(g, 'p');
    v.players[0].bot = difficulty;
    v.automaticContinuationPending = true;
    v.decision = { kind: 'nullentropy', player: 'p' };
    assert.equal(botActions(v)[0]?.type, 'nexusTraitorReturn');
    v.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
      question: null,
    };
    assert.deepEqual(botActions(v), [{ type: 'truthPass' }]);
    v.truthtrance.passed = ['p'];
    assert.deepEqual(botActions(v), []);
  }
  for (const id of ['q', 'r']) {
    const v = viewGame(g, id);
    v.players.find((p) => p.id === id)!.bot = 'Brutal';
    Object.defineProperty(v.nexusTraitors!.pending!, 'choices', {
      get() {
        throw new Error('Private exchange choices read');
      },
    });
    assert.deepEqual(botActions(v), []);
  }
});

/** Ranking inputs here are explicit authorized projections. Actual exchange
 * execution/custody is covered above; these staged views isolate preferences. */
function rankingFixture(): GameView {
  const g = nexusTraitorFixture({ phase: 6 });
  g.battle = {
    event: 'ranking-battle',
    territory: 'arrakeen',
    attacker: 'p',
    defender: 'q',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  const v = viewGame(g, 'p');
  v.nexusTraitors = {
    offer: null,
    pending: {
      event: 'ranking-exchange',
      owner: 'p',
      mode: 'cunning',
      count: 1,
      choices: [
        v.players[0].leaders[0].id,
        v.players[1].leaders[0].id,
        v.players[2].leaders[0].id,
      ].map((id) => ({ id, revealed: false, drawn: false })),
    },
  };
  return v;
}

void test('ranking reads only authorized choices and public leaders, preserving a revealed opposing traitor', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = rankingFixture();
    v.players[0].bot = difficulty;
    const pending = v.nexusTraitors!.pending!;
    const own = pending.choices[0].id;
    const opposing = pending.choices[1].id;
    const other = pending.choices[2].id;
    for (const player of v.players.slice(1))
      for (const key of ['hand', 'traitors', 'faceDancers', 'spice'])
        Object.defineProperty(player, key, {
          get() {
            throw new Error(`Read opponent ${key}`);
          },
        });
    const b = v.battle!;
    Object.defineProperty(b, 'plans', {
      configurable: true,
      get() {
        throw new Error('Read unrevealed plans');
      },
    });
    assert.deepEqual(botActions(v), [
      { type: 'nexusTraitorReturn', event: pending.event, cards: [own] },
    ]);
    // A public dead leader is expendable when no own identity is offered.
    pending.choices = pending.choices.slice(1);
    v.players[2].leaders[0].dead = true;
    assert.deepEqual(botActions(v), [
      { type: 'nexusTraitorReturn', event: pending.event, cards: [other] },
    ]);
    Object.defineProperty(b, 'plans', {
      value: { q: { leader: other, dial: 0, weapon: null, defense: null } },
      writable: true,
    });
    b.revealed = true;
    assert.deepEqual(botActions(v), [
      { type: 'nexusTraitorReturn', event: pending.event, cards: [opposing] },
    ]);
  }
});

void test('optional bot Cunning waits for an unreplied public traitor call or Mentat; authoritative blocks remain binding', () => {
  const v = rankingFixture();
  v.nexusTraitors = {
    offer: { event: 'offer', mode: 'cunning', draw: 1, blocked: null },
    pending: null,
  };
  const b = v.battle!;
  assert.deepEqual(nexusTraitorBotActions(v), []);
  b.revealed = true;
  b.traitorVoters = ['p', 'q'];
  b.traitorSubmitted = [];
  assert.deepEqual(nexusTraitorBotActions(v), [
    { type: 'nexusTraitorDraw', event: 'offer', mode: 'cunning' },
  ]);
  b.traitorSubmitted = ['p'];
  assert.deepEqual(nexusTraitorBotActions(v), []);
  v.phase = 8;
  assert.equal(nexusTraitorBotActions(v)[0]?.type, 'nexusTraitorDraw');
  v.decision = { kind: 'nullentropy', player: 'p' };
  assert.deepEqual(nexusTraitorBotActions(v), []);
  assert.ok(nexusTraitorDrawAction(v, 'offer', 'cunning'));
  v.decision = null;
  v.nexusTraitors.offer!.blocked = 'Exchange unavailable.';
  assert.deepEqual(nexusTraitorBotActions(v), []);
  const secret = viewGame(
    nexusTraitorFixture({ ownerFaction: 'tleilaxu' }),
    'p',
  );
  assert.equal(nexusTraitorBotActions(secret)[0]?.type, 'nexusTraitorDraw');
  secret.phase = 7;
  assert.deepEqual(nexusTraitorBotActions(secret), []);
});
