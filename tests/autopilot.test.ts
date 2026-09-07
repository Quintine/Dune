import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';

function lobby() {
  const g = createGame('AUTOPIL', newPlayer('a', 'Owner', 'atreides'));
  joinGame(g, newPlayer('e', 'Guest', 'emperor'));
  return g;
}
function playing() {
  const g = lobby();
  g.status = 'playing';
  g.phase = 4;
  g.order = ['a', 'e'];
  g.players.forEach((p) => {
    p.traitors = [p.leaders[0].id];
    p.traitorChoices = [];
    p.hand = [];
  });
  return applyAction(g, 'a', { type: 'advanceBots' });
}
function control(g: Game, difficulty: Difficulty | null, id = 'a') {
  return applyAction(g, id, { type: 'setAutopilot', difficulty });
}
function gameplay(g: Game) {
  const copy = structuredClone(g);
  copy.log = [];
  for (const p of copy.players) delete p.autopilot;
  return copy;
}
function rejectsUnchanged(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

void test('human owners can enable, change and disable all policies without becoming native bots', () => {
  let g = playing();
  const original = structuredClone(g);
  for (const difficulty of DIFFICULTIES) {
    const before = structuredClone(g);
    g = control(g, difficulty);
    assert.deepEqual(gameplay(g), gameplay(before));
    assert.equal(g.players[0].autopilot, difficulty);
    assert.equal(g.players[0].bot, undefined);
    assert.equal(g.players[1].autopilot, undefined);
    assert.ok(g.log.length > before.log.length);
  }
  g = control(g, null);
  assert.equal(g.players[0].autopilot, undefined);
  assert.deepEqual(gameplay(g), gameplay(original));
  assert.equal(original.players[0].autopilot, undefined);
  g = control(g, 'Medium', 'e');
  assert.equal(g.players[1].autopilot, 'Medium');
  assert.equal(g.players[0].autopilot, undefined);
  assert.deepEqual(control(g, 'Medium', 'e'), g);
  assert.deepEqual(gameplay(g), gameplay(original));
});

void test('control rejects other-seat targets, invalid difficulty, native bots and inactive games atomically', () => {
  const g = playing();
  for (const target of ['e', 'a', null])
    rejectsUnchanged(g, 'a', {
      type: 'setAutopilot',
      target,
      difficulty: 'Hard',
    });
  for (const difficulty of ['Cheat', 'hard', '', 1, undefined])
    rejectsUnchanged(g, 'a', { type: 'setAutopilot', difficulty });
  rejectsUnchanged(g, 'absent', { type: 'setAutopilot', difficulty: 'Hard' });
  for (const status of ['lobby', 'finished'] as const) {
    const inactive = structuredClone(g);
    inactive.status = status;
    rejectsUnchanged(inactive, 'a', {
      type: 'setAutopilot',
      difficulty: 'Hard',
    });
  }
  g.players[0].bot = 'Easy';
  for (const difficulty of ['Hard', null])
    rejectsUnchanged(g, 'a', { type: 'setAutopilot', difficulty });
});

void test('setup autopilot selects only its own traitor, then stops for the remaining human', () => {
  let g = lobby();
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  const guestChoices = structuredClone(g.players[1].traitorChoices);
  const ownChoices = structuredClone(g.players[0].traitorChoices);
  const declared = control(g, 'Hard');
  assert.deepEqual(gameplay(declared), gameplay(g));
  g = runBots(declared, 8);
  assert.equal(g.status, 'setup');
  assert.equal(g.players[0].traitors.length, 1);
  assert.ok(ownChoices.includes(g.players[0].traitors[0]));
  assert.deepEqual(g.players[1].traitorChoices, guestChoices);
  assert.deepEqual(g.players[1].traitors, []);
  assert.equal(g.players[0].bot, undefined);
  assert.equal(g.botsPending, false);
});

void test('retaking control preserves a sealed storm dial and every pending gameplay field', () => {
  let g = playing();
  g.phase = 0;
  g.stormDialers = ['a', 'e'];
  g.lastBattle = ['a', 'e'];
  g.stormDials = { a: 17 };
  g = control(g, 'Brutal');
  const before = structuredClone(g);
  g = control(JSON.parse(JSON.stringify(g)), null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(gameplay(g))),
    JSON.parse(JSON.stringify(gameplay(before))),
  );
  assert.deepEqual(g.stormDials, { a: 17 });
  assert.equal(viewGame(g, 'e').stormRevealed, null);
  assert.deepEqual(botActions(viewGame(g, 'a')), []);
  const stopped = runBots(g, 4);
  assert.deepEqual(stopped.stormDials, { a: 17 });
  assert.equal(stopped.botsPending, false);
});

void test('owner can retake control through Truthtrance, phase opening, response and private decision locks', () => {
  const windows: ((g: Game) => void)[] = [
    (g) => {
      g.truthtrance = {
        stage: 'priority',
        queue: [],
        passed: [],
        question: null,
      };
    },
    (g) => {
      g.phaseOpening = { passed: ['a'], initialize: false };
    },
    (g) => {
      g.response = {
        kind: 'revivalIncome',
        owner: 'e',
        recipient: 'a',
        amount: 2,
        passed: [],
      };
    },
    (g) => {
      g.decision = { kind: 'handExchange', player: 'a', target: 'e', count: 1 };
    },
  ];
  for (const install of windows) {
    let g = control(playing(), 'Medium');
    install(g);
    const before = structuredClone(g);
    g = control(g, null);
    assert.deepEqual(gameplay(g), gameplay(before));
    assert.equal(g.players[0].autopilot, undefined);
  }
});

void test('autopilot difficulty and own private view produce the same actions as the native policy', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = playing();
    g.phase = 3;
    g.auction = {
      cards: [baseDeck()[0]],
      index: 0,
      bid: 4,
      bidder: 'e',
      active: 'a',
      passed: [],
      peekKnown: false,
      opener: 0,
    };
    g.players[0].spice = 20;
    g = control(g, difficulty);
    const automatic = botActions(viewGame(g, 'a'));
    assert.ok(automatic.length > 0, difficulty);
    const native = structuredClone(g);
    native.players[0].bot = difficulty;
    delete native.players[0].autopilot;
    assert.deepEqual(automatic, botActions(viewGame(native, 'a')), difficulty);
    g.players[1].hand = baseDeck().slice(3, 7);
    g.players[1].traitors = ['hidden-other-choice'];
    g.deck.reverse();
    assert.deepEqual(botActions(viewGame(g, 'a')), automatic, difficulty);
  }
});

void test('public control mode survives JSON without disclosing another owner’s hand or traitors', () => {
  let g = playing();
  g.players[0].hand = [baseDeck()[0]];
  g = control(g, 'Hard');
  g = JSON.parse(JSON.stringify(g));
  const own = viewGame(g, 'a');
  const other = viewGame(g, 'e');
  assert.equal(own.players[0].autopilot, 'Hard');
  assert.equal(other.players[0].autopilot, 'Hard');
  assert.equal(other.players[0].bot, undefined);
  assert.equal(other.players[0].hand, undefined);
  assert.equal(other.players[0].traitors, undefined);
  assert.deepEqual(own.players[0].hand, g.players[0].hand);
  assert.deepEqual(own.players[0].traitors, g.players[0].traitors);
  assert.equal(own.me, 'a');
  assert.equal(other.me, 'e');
});
