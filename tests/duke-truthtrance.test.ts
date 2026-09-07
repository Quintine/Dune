import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  acquireDuke,
  createDukeVidal,
  DUKE_VIDAL_ID,
} from '../game/duke-vidal';

function fixture() {
  const g = createGame('DUKETRUTH', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(newPlayer('e', 'Emperor', 'emperor'));
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = 'm';
  g.order = ['e', 'm'];
  g.storm = 18;
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = { 'arrakeen:10': 2 };
    p.reserves = 18;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
  }
  const index = g.deck.findIndex((card) => card.effect === 'truthtrance');
  g.players[1].hand.push(g.deck.splice(index, 1)[0]);
  g.dukeVidal = acquireDuke(createDukeVidal(), 'm', 2, 'moritani');
  g.battle = {
    territory: 'arrakeen',
    attacker: 'm',
    defender: 'e',
    plans: {},
    revealed: false,
    traitorCalls: {},
    prepared: true,
  };
  return g;
}
function priority(state = fixture()) {
  let g = applyAction(state, 'e', {
    type: 'card',
    card: state.players[1].hand[0].id,
  });
  while (g.truthtrance?.stage === 'priority') {
    const p = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'truthPass' });
  }
  return g;
}
const question: Action = {
  type: 'truthAsk',
  question: {
    kind: 'battlePlan',
    target: 'm',
    claim: { kind: 'leader', leader: DUKE_VIDAL_ID },
  },
};
function reject(state: Game, id: string, action: Action) {
  const before = structuredClone(state);
  assert.throws(() => applyAction(state, id, action));
  assert.deepEqual(state, before);
}

void test('Truthtrance asks and logs a Duke battle-plan claim, then binds the answer to the actual legal shared-disc plan', () => {
  const initial = fixture();
  const native = initial.players.map((p) => structuredClone(p.leaders));
  const asked = applyAction(priority(initial), 'e', question);
  assert.equal(asked.truthtrance?.stage, 'answer');
  assert.ok(asked.log.at(-1)!.text.includes('Duke Prad Vidal'));
  assert.equal(asked.log.at(-1)!.text.includes(DUKE_VIDAL_ID), false);
  assert.ok(viewGame(asked, 'm').truthBattleAnswers?.includes('yes'));
  assert.equal(viewGame(asked, 'e').truthBattleAnswers, null);
  const answered = applyAction(JSON.parse(JSON.stringify(asked)), 'm', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.equal(answered.truthtrance, null);
  assert.equal(answered.truthHistory!.at(-1)!.answer, 'yes');
  reject(answered, 'm', {
    type: 'battlePlan',
    dial: 0,
    leader: answered.players[0].leaders[0].id,
  });
  const planned = applyAction(answered, 'm', {
    type: 'battlePlan',
    dial: 0,
    leader: DUKE_VIDAL_ID,
  });
  assert.equal(planned.battle!.plans.m.leader, DUKE_VIDAL_ID);
  assert.equal(planned.dukeVidal!.controller, 'm');
  assert.deepEqual(
    planned.players.map((p) => p.leaders),
    native,
  );
  assert.ok(planned.players.every((p) => !p.traitors.includes(DUKE_VIDAL_ID)));
});

void test('an unavailable Duke remains a valid battle identity question but cannot be promised as a legal plan', () => {
  const initial = fixture();
  initial.dukeVidal!.controller = null;
  initial.dukeVidal!.source = null;
  initial.dukeVidal!.acquiredTurn = null;
  const asked = applyAction(priority(initial), 'e', question);
  assert.ok(asked.log.at(-1)!.text.includes('Duke Prad Vidal'));
  assert.equal(viewGame(asked, 'm').truthBattleAnswers?.includes('yes'), false);
  assert.ok(viewGame(asked, 'm').truthBattleAnswers?.includes('no'));
  reject(asked, 'm', { type: 'truthAnswer', answer: 'yes' });
  const answered = applyAction(asked, 'm', {
    type: 'truthAnswer',
    answer: 'no',
  });
  assert.equal(answered.truthtrance, null);
});

void test('adding Duke to battle claims does not permit a nonexistent Duke traitor fact or absent shared disc', () => {
  const g = priority();
  reject(g, 'e', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'm',
      fact: { kind: 'traitor', leader: DUKE_VIDAL_ID },
    },
  });
  const absent = fixture();
  delete absent.dukeVidal;
  reject(priority(absent), 'e', question);
});

void test('native leader battle and traitor questions retain their original validation and readable log labels', () => {
  const g = priority();
  const leader = g.players[0].leaders[0];
  const battle = applyAction(g, 'e', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'm',
      claim: { kind: 'leader', leader: leader.id },
    },
  });
  assert.ok(battle.log.at(-1)!.text.includes(leader.name));
  const traitor = applyAction(g, 'e', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'm',
      fact: { kind: 'traitor', leader: leader.id },
    },
  });
  assert.ok(traitor.log.at(-1)!.text.includes(leader.name));
  assert.equal(viewGame(traitor, 'm').truthAnswer, 'no');
});
