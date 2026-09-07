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
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(emperorTanks: number, tleilaxu = false) {
  const g = createGame(
    'REVIVALBOTORDER',
    newPlayer('c', 'CHOAM', 'choam'),
    true,
  );
  g.players.push(newPlayer('e', 'Emperor', 'emperor'));
  if (tleilaxu) g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 3,
    order: g.players.map((p) => p.id),
    storm: 18,
    deck: baseDeck(),
  });
  for (const p of g.players) p.spice = 20;
  player(g, 'c').tanks = 1;
  player(g, 'c').reserves = 19;
  player(g, 'e').tanks = emperorTanks;
  player(g, 'e').reserves = 20 - emperorTanks;
  player(g, 'e').elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  const card = g.deck.splice(
    g.deck.findIndex((c) => c.effect === 'karama'),
    1,
  )[0];
  player(g, tleilaxu ? 't' : 'e').hand.push(card);
  return { g, card };
}
function proposals(g: Game, id: string, difficulty: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  const before = structuredClone(view);
  const actions = botActions(view);
  assert.deepEqual(view, before);
  return actions;
}
function allow(g: Game) {
  for (let i = 0; i < 30 && g.response; i++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.response, null);
  return g;
}

void test('pending CHOAM revival suppresses Emperor special Karama until settlement at all four AI levels', () => {
  const cases: [Difficulty, number][] = [
    ['Easy', 1],
    ...DIFFICULTIES.map((d): [Difficulty, number] => [d, 3]),
  ];
  for (const [difficulty, count] of cases) {
    const { g: start, card } = fixture(count);
    const g = applyAction(start, 'c', { type: 'revive', amount: 1 });
    assert.equal(g.response?.kind, 'choamRevival');
    assert.equal(viewGame(g, 'e').revival.pending, true);
    assert.equal('pendingRevival' in viewGame(g, 'e'), false);
    const actions = proposals(g, 'e', difficulty);
    assert.ok(actions.length);
    assert.ok(
      actions.every((a) => !(a.type === 'card' && a.mode === 'special')),
    );
    for (const action of actions)
      applyAction(JSON.parse(JSON.stringify(g)), 'e', action);
    assert.throws(
      () =>
        applyAction(g, 'e', {
          type: 'card',
          mode: 'special',
          card: card.id,
          amount: count,
          elite: 0,
        }),
      /pending revival/,
    );
    const settled = allow(g);
    assert.equal(viewGame(settled, 'e').revival.pending, false);
    const resumed = proposals(settled, 'e', difficulty);
    const special = resumed.find(
      (a) => a.type === 'card' && a.mode === 'special',
    );
    assert.ok(special, difficulty + '/' + count);
    const next = applyAction(settled, 'e', special);
    assert.equal(player(next, 'e').tanks, 0);
    assert.equal(player(next, 'e').specialKaramaUsed, true);
    assert.equal(next.discard.filter((c) => c.id === card.id).length, 1);
  }
});

void test('the pending marker preserves ordinary Karama cancellation and its distinct current price outcome', () => {
  const { g: start, card } = fixture(3);
  const g = applyAction(start, 'c', { type: 'revive', amount: 1 });
  assert.ok(viewGame(g, 'e').responseControls?.cancelCards.includes(card.id));
  const canceled = allow(
    applyAction(g, 'e', { type: 'card', card: card.id, mode: 'cancel' }),
  );
  assert.equal(player(canceled, 'c').tanks, 0);
  assert.equal(player(canceled, 'c').spice, 18);
  assert.equal(player(canceled, 'e').tanks, 3);
  assert.equal(player(canceled, 'e').specialKaramaUsed, undefined);
  assert.equal(viewGame(canceled, 'e').revival.pending, false);
  assert.equal(canceled.discard.filter((c) => c.id === card.id).length, 1);
});

void test('Tleilaxu retains its authorized special Karama during the actual revival-stop decision at all levels', () => {
  for (const difficulty of DIFFICULTIES) {
    const { g: start, card } = fixture(3, true);
    player(start, 'c').tanks = 12;
    player(start, 'c').reserves = 8;
    const g = applyAction(start, 'c', { type: 'revive', amount: 1 });
    assert.equal(g.decision?.kind, 'revivalStop');
    assert.equal(viewGame(g, 't').revival.pending, true);
    const actions = proposals(g, 't', difficulty);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'card');
    assert.equal(actions[0].mode, 'special');
    const next = applyAction(JSON.parse(JSON.stringify(g)), 't', actions[0]);
    assert.equal(player(next, 't').specialKaramaUsed, true);
    assert.equal(player(next, 'c').tanks, 12);
    assert.equal(player(next, 'c').spice, 20);
    assert.equal(viewGame(next, 'c').revival.prevented, true);
    assert.equal(viewGame(next, 't').revival.pending, false);
    assert.equal(next.discard.filter((c) => c.id === card.id).length, 1);
  }
});
