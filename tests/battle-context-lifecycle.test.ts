import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(moritani = false, twoBattles = false) {
  const g = createGame('CONTEXTLIFE', newPlayer('w', 'Winner', 'guild'));
  g.players.push(newPlayer('l', 'Opponent', 'emperor'));
  if (moritani) g.players.push(newPlayer('m', 'Moritani', 'moritani'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'w',
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.traitors = [];
    p.forces = p.id === 'm' ? {} : { 'arrakeen:10': 3 };
    if (twoBattles && p.id !== 'm') p.forces['carthag:11'] = 3;
    p.reserves = 20 - Object.values(p.forces).reduce((a, b) => a + b, 0);
    for (const leader of p.leaders) leader.strength = 0;
  }
  if (moritani) {
    g.players[1].ally = 'm';
    g.players[2].ally = 'l';
  }
  return g;
}
function hold(g: Game, owner: string, kind: Card['kind']) {
  const at = g.deck.findIndex((c) => c.kind === kind);
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
function inventory(g: Game) {
  const all = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(all).size, all.length);
  return all;
}
function fight(
  state: Game,
  territory = 'arrakeen',
  winnerDefense?: string,
  loserDefense?: string,
) {
  let g = applyAction(state, 'w', {
    type: 'chooseBattle',
    territory,
    target: 'l',
  });
  while (g.response || g.battle?.preparation) {
    if (g.response)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    else
      g = applyAction(g, g.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  }
  const event = g.battle!.event;
  for (const id of ['w', 'l']) {
    const p = g.players.find((p) => p.id === id)!;
    const leader = p.leaders.find(
      (l) => !l.dead && (!l.usedAt || l.usedAt === territory),
    )!;
    assert.ok(leader);
    g = applyAction(g, id, {
      type: 'battlePlan',
      dial: id === 'w' ? 1 : 0,
      leader: leader.id,
      defense: id === 'w' ? winnerDefense : loserDefense,
    });
  }
  g = applyAction(g, 'w', { type: 'traitorCall', call: false });
  g = applyAction(g, 'l', { type: 'traitorCall', call: false });
  assert.equal(g.battle, null);
  assert.equal(g.lastBattleContext!.event, event);
  return g;
}
function resources(g: Game) {
  return g.players.map((p) => ({
    id: p.id,
    spice: p.spice,
    tanks: p.tanks,
    forces: p.forces,
    leaders: p.leaders,
  }));
}

void test('a genuine winner-card cleanup saved without context reconstructs one legacy receipt without replaying battle effects', () => {
  const initial = fixture();
  const shield = hold(initial, 'w', 'shield');
  const cards = inventory(initial);
  let g = fight(initial, 'arrakeen', shield);
  assert.equal(g.decision?.kind, 'battleCards');
  const settled = resources(g);
  delete g.lastBattleContext;
  g = reload(g);
  assert.equal(normalizeAutomaticGame(g).lastBattleContext, undefined);
  g = applyAction(g, 'w', { type: 'decision', discard: [shield] });
  assert.equal(g.lastBattleContext!.result, 'legacy');
  assert.equal(g.lastBattleContext!.territory, 'arrakeen');
  assert.deepEqual(g.lastBattleContext!.combatants, ['w', 'l']);
  assert.equal(g.lastBattleContext!.winner, 'w');
  assert.equal(g.lastBattleContext!.turn, 2);
  assert.deepEqual(resources(g), settled);
  assert.deepEqual(inventory(g), cards);
  assert.equal(g.discard.filter((c) => c.id === shield).length, 1);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  assert.throws(() =>
    applyAction(g, 'w', { type: 'decision', discard: [shield] }),
  );
});

void test('legacy winner and Moritani cleanups share one resolved battle receipt across separate discard continuations', () => {
  for (const winnerCard of [false, true]) {
    const initial = fixture(true);
    const shield = winnerCard ? hold(initial, 'w', 'shield') : undefined;
    const snooper = hold(initial, 'l', 'snooper');
    const cards = inventory(initial);
    let g = fight(initial, 'arrakeen', shield, snooper);
    const settled = resources(g);
    delete g.lastBattleContext;
    if (winnerCard) {
      assert.equal(g.decision?.kind, 'battleCards');
      g = applyAction(reload(g), 'w', { type: 'decision', discard: [shield!] });
      assert.equal(g.lastBattleContext!.result, 'legacy');
    }
    assert.equal(g.decision?.kind, 'moritaniRetention');
    const event = g.lastBattleContext?.event;
    g = applyAction(reload(g), 'l', { type: 'decision', keep: null });
    assert.equal(g.moritaniRetention, null);
    assert.equal(g.lastBattleContext!.result, 'legacy');
    if (event) assert.equal(g.lastBattleContext!.event, event);
    assert.deepEqual(g.lastBattleContext!.combatants, ['w', 'l']);
    assert.equal(g.lastBattleContext!.winner, 'w');
    assert.deepEqual(resources(g), settled);
    assert.deepEqual(inventory(g), cards);
    assert.equal(g.discard.filter((c) => c.id === snooper).length, 1);
    assert.equal(g.resolvedTreacheryDiscardSequence, winnerCard ? 2 : 1);
  }
});

void test('a second genuine battle in the same phase replaces the first context before its own card cleanup', () => {
  const initial = fixture(false, true);
  const shield = hold(initial, 'w', 'shield');
  const firstDefense = hold(initial, 'l', 'snooper');
  const secondDefense = hold(initial, 'l', 'snooper');
  const cards = inventory(initial);
  let g = fight(initial, 'arrakeen', shield, firstDefense);
  const first = structuredClone(g.lastBattleContext!);
  g = applyAction(g, 'w', { type: 'decision', discard: [] });
  assert.equal(g.phase, 6);
  g = fight(reload(g), 'carthag', shield, secondDefense);
  assert.notEqual(g.lastBattleContext!.event, first.event);
  assert.equal(g.lastBattleContext!.territory, 'carthag');
  assert.equal(g.lastBattleContext!.turn, first.turn);
  assert.equal(g.lastBattleContext!.result, 'normal');
  const second = structuredClone(g.lastBattleContext!);
  g = applyAction(g, 'w', { type: 'decision', discard: [shield] });
  assert.deepEqual(g.lastBattleContext, second);
  assert.deepEqual(inventory(g), cards);
  assert.equal(g.resolvedTreacheryDiscardSequence, 3);
  assert.equal(
    g.discard.filter((c) =>
      [shield, firstDefense, secondDefense].includes(c.id),
    ).length,
    3,
  );
});

void test('a later-turn genuine battle replaces a retained previous-turn context even in the same territory', () => {
  const initial = fixture();
  const shield = hold(initial, 'w', 'shield');
  let g = fight(initial, 'arrakeen', shield);
  g = applyAction(g, 'w', { type: 'decision', discard: [] });
  const first = structuredClone(g.lastBattleContext!);
  assert.equal(g.phase, 7);
  // Advance the actual Collection and Mentat boundaries into the next turn.
  for (let phase = 0; phase < 2; phase++)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.turn, 3);
  assert.deepEqual(g.lastBattleContext, first);
  // Stage the later battle's forces after intervening phases; both battles and
  // their cleanup execute real public actions. No prior context is normalized.
  g.phase = 6;
  g.active = 'w';
  g.response = null;
  g.decision = null;
  g.phaseOpening = null;
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.players[1].reserves--;
  g = fight(reload(g), 'arrakeen', shield);
  assert.equal(g.lastBattleContext!.turn, 3);
  assert.equal(g.lastBattleContext!.territory, 'arrakeen');
  assert.notEqual(g.lastBattleContext!.event, first.event);
  assert.equal(g.lastBattleContext!.result, 'normal');
  g = applyAction(g, 'w', { type: 'decision', discard: [shield] });
  assert.equal(g.discard.filter((c) => c.id === shield).length, 1);
  assert.equal(g.lastBattleContext!.turn, 3);
});

void test('existing mismatched context is rejected rather than being silently replaced with a legacy receipt', () => {
  const initial = fixture();
  const shield = hold(initial, 'w', 'shield');
  const resolved = fight(initial, 'arrakeen', shield);
  for (const corrupt of [
    (g: Game) => {
      g.lastBattleContext!.turn--;
    },
    (g: Game) => {
      g.lastBattleContext!.territory = 'carthag';
    },
    (g: Game) => {
      g.lastBattleContext!.winner = 'l';
    },
    (g: Game) => {
      g.lastBattleContext!.combatants.reverse();
    },
  ]) {
    const g = reload(resolved);
    corrupt(g);
    const before = reload(g);
    assert.throws(() =>
      applyAction(g, 'w', { type: 'decision', discard: [shield] }),
    );
    assert.deepEqual(g, before);
  }
});
