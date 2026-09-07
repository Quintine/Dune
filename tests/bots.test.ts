import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  initializeBaseGameForAudit,
  createGame,
  newPlayer,
  joinGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { FACTIONS } from '../game/catalog';
import { TECH_TOKENS } from '../game/tech-tokens';

function table(advanced = false) {
  const g = createGame(
    'BOTTEST2',
    newPlayer('host', 'Host', 'atreides'),
    advanced,
  );
  for (const [i, f] of FACTIONS.filter((f) => f.expansion === 'base')
    .slice(1)
    .entries()) {
    const p = newPlayer(`bot${i}`, f.name, f.id);
    p.bot = DIFFICULTIES[i % 4];
    joinGame(g, p);
  }
  return g;
}
function invariant(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
      p.faction,
    );
    assert.ok(p.spice >= 0, p.faction);
    const temporary =
      g.decision?.kind === 'handExchange' && g.decision.player === p.id
        ? g.decision.count
        : 0;
    assert.ok(
      p.hand.length <= (p.faction === 'harkonnen' ? 8 : 4) + temporary,
      p.faction,
    );
  }
}
void test('only hosts manage AI seats with valid factions and difficulty', () => {
  let g = createGame('BOTTEST2', newPlayer('host', 'Host', 'atreides'));
  joinGame(g, newPlayer('human', 'Guest', 'fremen'));
  assert.throws(
    () =>
      applyAction(g, 'human', {
        type: 'addBot',
        faction: 'emperor',
        difficulty: 'Easy',
      }),
    /host/,
  );
  assert.throws(
    () =>
      applyAction(g, 'host', {
        type: 'addBot',
        faction: 'unknown',
        difficulty: 'Easy',
      }),
    /Unknown faction/,
  );
  assert.throws(
    () =>
      applyAction(g, 'host', {
        type: 'addBot',
        faction: 'emperor',
        difficulty: 'Cheat',
      }),
    /difficulty/,
  );
  assert.throws(
    () => applyAction(g, 'host', { type: 'removeBot', target: 'human' }),
    /AI seat/,
  );
  g = applyAction(g, 'host', {
    type: 'addBot',
    faction: 'emperor',
    difficulty: 'Brutal',
  });
  assert.equal(g.players[2].bot, 'Brutal');
  assert.equal(g.players[2].ready, true);
  g = applyAction(g, 'host', { type: 'removeBot', target: g.players[2].id });
  assert.equal(g.players.length, 2);
});
void test('bot progression does not mutate its input and stops for humans', () => {
  const g = table();
  const original = structuredClone(g);
  const next = runBots(g);
  assert.deepEqual(g, original);
  assert.equal(next.players[0].ready, false);
  assert.ok(next.players.slice(1).every((p) => p.ready));
  assert.equal(next.botsPending, false);
});
void test('four AI policies complete games through legal actions with conserved forces', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = table();
    g.players.forEach((p) => {
      p.bot = difficulty;
      p.ready = true;
    });
    g = applyAction(g, 'host', { type: 'start' });
    for (let batch = 0; batch < 60 && g.status !== 'finished'; batch++) {
      g = runBots(g);
      invariant(g);
      assert.ok(
        g.botsPending || g.status === 'finished',
        `Stalled ${difficulty}: ${JSON.stringify({ turn: g.turn, phase: g.phase, decision: g.decision, response: g.response, active: g.active, battle: g.battle, ready: g.ready })}`,
      );
    }
    assert.equal(g.status, 'finished', `${difficulty} exceeded action budget`);
  }
});
void test('bot choices are unchanged by opponents hidden hands and decks', () => {
  let g = table();
  g.players.forEach((p) => {
    p.bot = 'Hard';
    p.ready = true;
  });
  g = applyAction(g, 'host', { type: 'start' });
  const before = botActions(viewGame(g, 'bot0'));
  g.players.find((p) => p.id === 'host')!.hand = [];
  g.deck.reverse();
  assert.deepEqual(botActions(viewGame(g, 'bot0')), before);
});

void test('four AI policies finish tech-token games while conserving forces and public token ownership', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = applyAction(table(), 'host', { type: 'techTokens', enabled: true });
    g.players.forEach((p) => {
      p.bot = difficulty;
      p.ready = true;
    });
    g = applyAction(g, 'host', { type: 'start' });
    for (let batch = 0; batch < 80 && g.status !== 'finished'; batch++) {
      g = runBots(g);
      invariant(g);
      assert.ok(
        g.botsPending || g.status === 'finished',
        `Tech game stalled for ${difficulty}: ${JSON.stringify({ phase: g.phase, decision: g.decision, response: g.response })}`,
      );
      for (const token of TECH_TOKENS) {
        const state = g.techTokens![token.id];
        assert.ok(g.players.some((p) => p.id === state.owner));
        assert.ok(state.spice >= 0 && state.spice <= 3);
        if (g.phase !== token.phase) assert.equal(state.spice, 0);
      }
    }
    assert.equal(
      g.status,
      'finished',
      `${difficulty} exceeded tech-game budget`,
    );
  }
});

void test('all four AI profiles complete Advanced base scenarios from the shared staged initializer without stalling', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = table(true);
    g.players.forEach((p) => {
      p.bot = difficulty;
      p.ready = true;
    });
    // The public gate remains closed. Exercise genuine Advanced setup through
    // the same staged initializer before testing the implemented game systems.
    g = initializeBaseGameForAudit(g);
    for (let batch = 0; batch < 100 && g.status !== 'finished'; batch++) {
      g = runBots(g);
      invariant(g);
      for (const p of g.players)
        if (p.elites) {
          assert.equal(
            p.elites.reserves +
              p.elites.tanks +
              Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
            p.faction === 'fremen' ? 3 : 5,
          );
          assert.ok(p.elites.revived <= 1);
          assert.ok(p.elites.reserves <= p.reserves);
          assert.ok(p.elites.tanks <= p.tanks);
          for (const [key, n] of Object.entries(p.elites.forces))
            assert.ok(n <= p.forces[key]);
        }
      assert.ok(
        g.botsPending || g.status === 'finished',
        `Advanced subsystem stall ${difficulty}: ${JSON.stringify({ turn: g.turn, phase: g.phase, decision: g.decision, response: g.response, active: g.active, battle: g.battle })}`,
      );
    }
    assert.equal(g.status, 'finished');
  }
});

void test('AI finishes games containing Sandtrout while preserving its set-aside card through the phase machine', () => {
  for (const difficulty of ['Hard', 'Brutal'] as const) {
    let g = table();
    g.players.forEach((p) => {
      p.bot = difficulty;
      p.ready = true;
    });
    g = applyAction(g, 'host', { type: 'start' });
    g.spiceDeck.unshift({ sandtrout: true });
    for (let batch = 0; batch < 80 && g.status !== 'finished'; batch++) {
      g = runBots(g);
      invariant(g);
      assert.ok(
        g.botsPending || g.status === 'finished',
        `Sandtrout stalled ${difficulty}`,
      );
      const troutCount =
        Number(!!g.sandtrout) +
        [...g.spiceDeck, ...g.spiceDiscard.flat()].filter(
          (c) => 'sandtrout' in c,
        ).length;
      assert.equal(troutCount, 1);
    }
    assert.equal(g.status, 'finished');
  }
});
