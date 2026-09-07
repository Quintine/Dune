import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function fixture(): Game {
  const g = createGame(
    'RETAINBOT',
    newPlayer('m', 'Moritani', 'moritani'),
    true,
  );
  g.players.push(
    newPlayer('b', 'Defeated ally', 'beneGesserit'),
    newPlayer('e', 'Enemy', 'emperor'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.order = ['m', 'b', 'e'];
  // This fixture starts after b lost its battle against e.
  g.lastBattle = ['b', 'e'];
  g.players[0].ally = 'b';
  g.players[1].ally = 'm';
  const deck = baseDeck();
  const shield = deck.find((c) => c.kind === 'shield')!;
  const worthless = deck.find((c) => c.kind === 'worthless')!;
  const unplayed = deck.find((c) => c.effect === 'karama')!;
  g.players[1].hand = [shield, worthless, unplayed];
  g.moritaniRetention = {
    owner: 'm',
    player: 'b',
    territory: 'arrakeen',
    turn: g.turn,
    played: [shield.id, worthless.id],
    eligible: [shield.id, worthless.id],
    stage: 'choose',
  };
  g.decision = {
    kind: 'moritaniRetention',
    owner: 'm',
    player: 'b',
    territory: 'arrakeen',
    cards: [...g.moritaniRetention.eligible],
  };
  return g;
}
function bots(g: Game, id: string, difficulty: (typeof DIFFICULTIES)[number]) {
  const copy = structuredClone(g);
  copy.players.find((p) => p.id === id)!.bot = difficulty;
  return botActions(viewGame(copy, id));
}

void test('every profile lets only the defeated ally choose an eligible card from its own hand', () => {
  const g = fixture();
  const before = structuredClone(g);
  for (const difficulty of DIFFICULTIES) {
    assert.deepEqual(bots(g, 'm', difficulty), [], difficulty);
    assert.deepEqual(bots(g, 'e', difficulty), [], difficulty);
    const actions = bots(g, 'b', difficulty);
    assert.equal(actions.length, 1, difficulty);
    const chosen = actions[0];
    assert.equal(chosen.type, 'decision');
    assert.ok(g.moritaniRetention!.eligible.includes(String(chosen.keep)));
    if (difficulty !== 'Easy')
      assert.equal(chosen.keep, g.players[1].hand[0].id, difficulty);
    const next = applyAction(g, 'b', chosen);
    assert.equal(next.response?.kind, 'moritaniRetention');
    assert.equal(next.response?.owner, 'm');
    assert.equal(next.moritaniRetention?.keep, chosen.keep);
    assert.deepEqual(
      next.players[1].hand,
      g.players[1].hand,
      'selection reserves cards until response settlement',
    );
  }
  assert.deepEqual(g, before);
});

void test('retention response actions remain legal for all seats and profiles after JSON reload', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g = applyAction(g, 'b', bots(g, 'b', difficulty)[0]);
    const chosen = g.moritaniRetention!.keep!;
    for (const id of ['m', 'e', 'b']) {
      g = JSON.parse(JSON.stringify(g));
      const actions = bots(g, id, difficulty);
      assert.deepEqual(
        actions,
        id === 'b' ? [{ type: 'passResponse' }] : [],
        `${difficulty}: ${id}`,
      );
      if (actions.length) g = applyAction(g, id, actions[0]);
    }
    assert.equal(g.moritaniRetention ?? null, null);
    assert.ok(g.players[1].hand.some((c) => c.id === chosen));
    const discarded = fixture().moritaniRetention!.played.filter(
      (id) => id !== chosen,
    );
    assert.ok(discarded.every((id) => g.discard.some((c) => c.id === id)));
  }
});

void test('missing entitled cards produce a null choice while the server rejects invalid custody atomically', () => {
  const g = fixture();
  g.players[1].hand = [];
  const before = structuredClone(g);
  for (const difficulty of DIFFICULTIES) {
    assert.deepEqual(
      bots(g, 'b', difficulty),
      [{ type: 'decision', keep: null }],
      difficulty,
    );
    assert.throws(() => applyAction(g, 'b', { type: 'decision', keep: null }));
    assert.deepEqual(g, before);
  }
});

void test('an empty eligible decision falls back to decline without choosing an unplayed card', () => {
  const g = fixture();
  g.moritaniRetention!.eligible = [];
  assert.equal(g.decision?.kind, 'moritaniRetention');
  if (g.decision?.kind === 'moritaniRetention') g.decision.cards = [];
  for (const difficulty of DIFFICULTIES) {
    assert.deepEqual(
      bots(g, 'b', difficulty),
      [{ type: 'decision', keep: null }],
      difficulty,
    );
    const next = applyAction(g, 'b', { type: 'decision', keep: null });
    assert.equal(next.moritaniRetention ?? null, null);
    assert.ok(
      g.moritaniRetention!.played.every((id) =>
        next.discard.some((card) => card.id === id),
      ),
    );
  }
});

void test('reserved played BG worthless faces cannot fund a Karama response; a separate card still can', () => {
  // Isolate selection while a retention reservation coexists with an enemy response.
  // The engine's continuation orders retention first in ordinary battle resolution.
  const g = fixture();
  const worthless = g.players[1].hand.find((c) => c.kind === 'worthless')!;
  const unplayed = g.players[1].hand.find((c) => c.effect === 'karama')!;
  g.players[1].hand = [worthless];
  g.decision = null;
  g.moritaniRetention!.stage = 'response';
  g.moritaniRetention!.keep = worthless.id;
  g.response = { kind: 'harkonnenBonus', owner: 'e', passed: [] };
  for (const difficulty of DIFFICULTIES) {
    assert.deepEqual(bots(g, 'b', difficulty), [], difficulty);
  }
  g.players[1].hand.push(unplayed);
  assert.deepEqual(bots(g, 'b', 'Brutal'), [
    { type: 'card', card: unplayed.id, mode: 'cancel' },
  ]);
  g.moritaniRetention = null;
  assert.deepEqual(
    bots(g, 'b', 'Brutal'),
    [{ type: 'card', card: worthless.id, mode: 'cancel' }],
    'reservation release restores ordinary Karama eligibility',
  );
});
