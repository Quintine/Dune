import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, createAuditorLeader, type Card } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function hold(g: Game, id: string, choose: (c: Card) => boolean) {
  const index = g.deck.findIndex(choose);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function pass(g: Game) {
  for (let i = 0; i < 30 && g.response; i++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function offer(karama = false) {
  let g = createGame('AUDITORAI', newPlayer('c', 'CHOAM', 'choam'), true);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'c',
    order: ['c', 'e', 'g'],
    storm: 18,
    deck: baseDeck(),
  });
  player(g, 'c').leaders.push(createAuditorLeader());
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [];
    p.forces = p.id === 'g' ? {} : { 'arrakeen:10': 3 };
    p.reserves = p.id === 'g' ? 20 : 17;
  }
  hold(g, 'e', (c) => c.kind === 'shield');
  hold(g, 'e', (c) => c.kind === 'projectile');
  hold(g, 'g', (c) => c.kind === 'worthless');
  if (karama) hold(g, 'e', (c) => c.effect === 'karama');
  g = applyAction(g, 'c', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  for (let i = 0; i < 30; i++) {
    g = pass(g);
    if (g.battle?.preLeader && !g.battle.preLeader.closed) {
      const id = ['c', 'e'].find(
        (id) => !g.battle!.preLeader!.ready.includes(id),
      )!;
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle.event,
      });
    } else if (g.battle?.preparation) {
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    } else break;
  }
  g = applyAction(g, 'c', {
    type: 'battlePlan',
    leader: 'choam-auditor',
    dial: 0,
    support: 0,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    leader: 'emperor-0',
    dial: 0,
    support: 0,
  });
  g = applyAction(g, 'c', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  g = pass(g);
  assert.equal(g.decision?.kind, 'choamAudit');
  return g;
}
function proposals(g: Game, id: string, difficulty: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  const before = structuredClone(view);
  const actions = botActions(view);
  assert.deepEqual(view, before);
  return actions;
}
function variant(g: Game, excluded: string) {
  const copy = structuredClone(g);
  for (const p of copy.players.filter((p) => p.id !== excluded)) {
    for (let i = 0; i < p.hand.length; i++) {
      const replacement = copy.deck.findIndex((c) => c.kind === 'poison');
      const old = p.hand[i];
      p.hand[i] = copy.deck.splice(replacement, 1)[0];
      copy.deck.push(old);
    }
    p.traitors = ['choam-0'];
  }
  return copy;
}

void test('all four AI levels declare the real event-bound audit and foreign private hands do not affect that choice', () => {
  const g = offer();
  for (const difficulty of DIFFICULTIES) {
    const actions = proposals(g, 'c', difficulty);
    assert.equal(actions.length, 1);
    assert.deepEqual(actions, [
      { type: 'decision', event: g.pendingAuditor!.event, audit: true },
    ]);
    assert.deepEqual(proposals(g, 'e', difficulty), []);
    const altered = variant(g, 'c');
    assert.deepEqual(viewGame(altered, 'c'), viewGame(g, 'c'));
    assert.deepEqual(proposals(altered, 'c', difficulty), actions);
    for (const input of [g, altered]) {
      const next = pass(
        applyAction(JSON.parse(JSON.stringify(input)), 'c', actions[0]),
      );
      assert.equal(next.decision?.kind, 'choamAuditPayment');
      assert.equal(next.auditorInsight, null);
      assert.throws(() => applyAction(next, 'c', actions[0]));
    }
  }
});

void test('all AI levels answer the actual full-price decision legally with private snapshots only for CHOAM', () => {
  for (const difficulty of DIFFICULTIES) {
    const start = offer();
    const g = pass(
      applyAction(start, 'c', {
        type: 'decision',
        event: start.pendingAuditor!.event,
        audit: true,
      }),
    );
    const altered = variant(g, 'e');
    assert.deepEqual(viewGame(altered, 'e'), viewGame(g, 'e'));
    const actions = proposals(g, 'e', difficulty);
    assert.equal(actions.length, 1);
    assert.deepEqual(proposals(altered, 'e', difficulty), actions);
    assert.equal(actions[0].event, g.pendingAuditor!.event);
    const beforeHand = structuredClone(player(g, 'e').hand);
    const next = applyAction(JSON.parse(JSON.stringify(g)), 'e', actions[0]);
    assert.equal(next.pendingAuditor, null);
    assert.deepEqual(player(next, 'e').hand, beforeHand);
    if (actions[0].pay) {
      assert.equal(actions[0].count, 2);
      assert.equal(player(next, 'e').spice, player(g, 'e').spice - 2);
      assert.equal(player(next, 'c').spice, player(g, 'c').spice + 2);
      assert.equal(viewGame(next, 'c').auditorInsight, null);
    } else {
      assert.equal(viewGame(next, 'c').auditorInsight?.cards.length, 2);
      assert.equal(player(next, 'e').spice, player(g, 'e').spice);
    }
    assert.equal(viewGame(next, 'e').auditorInsight, null);
    assert.equal(viewGame(next, 'g').auditorInsight, null);
    assert.throws(() => applyAction(next, 'e', actions[0]));
  }
});

void test('all AI levels respect Karama response eligibility and Hard/Brutal cancel their own threatened inspection', () => {
  for (const difficulty of DIFFICULTIES) {
    const start = offer(true);
    const g = applyAction(start, 'c', {
      type: 'decision',
      event: start.pendingAuditor!.event,
      audit: true,
    });
    assert.equal(g.response?.kind, 'choamAudit');
    const actions = proposals(g, 'e', difficulty);
    assert.equal(actions.length, 1);
    const altered = variant(g, 'e');
    assert.deepEqual(viewGame(altered, 'e'), viewGame(g, 'e'));
    assert.deepEqual(proposals(altered, 'e', difficulty), actions);
    assert.deepEqual(proposals(g, 'g', difficulty), []);
    const next = applyAction(g, 'e', actions[0]);
    if (difficulty === 'Hard' || difficulty === 'Brutal') {
      assert.equal(actions[0].type, 'card');
      assert.equal(next.pendingAuditor, null);
      assert.equal(next.discard.filter((c) => c.effect === 'karama').length, 1);
      assert.equal(player(next, 'e').spice, player(g, 'e').spice);
      assert.equal(viewGame(next, 'c').auditorInsight, null);
    } else assert.equal(actions[0].type, 'passResponse');
    assert.equal(viewGame(next, 'e').auditorInsight, null);
  }
});

void test('all AI levels allow inspection when the payment is unaffordable', () => {
  for (const difficulty of DIFFICULTIES) {
    const start = offer();
    player(start, 'e').spice = 1;
    const g = pass(
      applyAction(start, 'c', {
        type: 'decision',
        event: start.pendingAuditor!.event,
        audit: true,
      }),
    );
    // Automatic normalization settles an unaffordable payment without an AI turn.
    assert.equal(g.pendingAuditor, null);
    assert.equal(viewGame(g, 'c').auditorInsight?.cards.length, 2);
    assert.equal(viewGame(g, 'e').auditorInsight, null);
    assert.ok(
      !proposals(g, 'e', difficulty).some(
        (a) => a.type === 'decision' && a.pay,
      ),
    );
  }
});
