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
  createAmbassadors,
  placeAmbassador,
  type AmbassadorEffect,
} from '../game/ecaz-ambassadors';

function fixture(effect: 'ixians' | 'beneGesserit' = 'ixians') {
  const g = createGame('AMBCONT2', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
    'ecaz',
    'choam',
  ]);
  g.players.push(
    newPlayer('c', 'CHOAM', 'choam'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    storm: 18,
    active: 'e',
    order: ['e', 'ec', 'c'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 10,
      traitorChoices: [],
    });
  g.players[0].ally = 'c';
  g.players[1].ally = 'ec';
  const state = createAmbassadors(() => 0);
  // With BG, Ixian and Fremen copies remain outside this cohort. The entrant
  // has no held Traitors, so the outside Harkonnen effect cannot be used.
  const cohort: AmbassadorEffect[] =
    effect === 'beneGesserit'
      ? ['beneGesserit', 'atreides', 'richese', 'emperor', 'choam']
      : ['ixians', 'atreides', 'harkonnen', 'emperor', 'choam'];
  state.cohort = state.tokens
    .filter((token) => cohort.includes(token.effect))
    .map((token) => token.id);
  for (const token of state.tokens)
    token.zone =
      token.effect === 'ecaz' || state.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
  g.ecazAmbassadors = placeAmbassador(
    state,
    state.tokens.find((token) => token.effect === effect)!.id,
    {
      turn: g.turn,
      availableSpice: 10,
      destination: {
        id: 'arrakeen',
        stronghold: true,
        inStorm: false,
        allowed: true,
      },
    },
  ).state;
  return g;
}
function hold(g: Game, name: string) {
  const index = g.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players[1].hand.push(card);
  return card.id;
}
function begin(state: Game) {
  const g = applyAction(state, 'e', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  return applyAction(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'c',
  });
}
const decide = (g: Game, selection: Record<string, unknown>) =>
  applyAction(g, 'c', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    ...selection,
  });
function rejectUnchanged(g: Game, action: Action, message: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'c', action), message);
  assert.deepEqual(g, before);
  assert.deepEqual(viewGame(g, 'c'), viewGame(before, 'c'));
}

void test('Ixian Ambassador rejects CHOAM cash-in that would strand its committed discard', () => {
  const initial = fixture();
  const karama = hold(initial, 'Karama'),
    card = hold(initial, 'Snooper');
  const g = begin(initial);
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  rejectUnchanged(
    g,
    { type: 'card', mode: 'special', card: karama, cards: [card] },
    /last available card/,
  );
  assert.equal(g.players[1].specialKaramaUsed, undefined);
  const finished = decide(g, { cards: [card] });
  assert.equal(finished.pendingAmbassador, null);
  assert.equal(finished.players[1].hand.length, 2);
  assert.equal(finished.players[2].reserves, 19);
  assert.equal(finished.players[2].spice, 9);
});

void test('Ixian Ambassador rejects spending its only discard as Truthtrance before creating a truth window', () => {
  const initial = fixture();
  const card = hold(initial, 'Truthtrance');
  const g = begin(initial);
  rejectUnchanged(g, { type: 'card', card }, /last available card/);
  assert.equal(g.truthtrance, undefined);
  assert.ok(g.players[1].hand.some((held) => held.id === card));
  assert.equal(decide(g, { cards: [card] }).pendingAmbassador, null);
});

void test('Truthtrance preserving a discard can resolve and return to the same Ixian exchange after reconnect', () => {
  const initial = fixture();
  const truth = hold(initial, 'Truthtrance'),
    card = hold(initial, 'Snooper');
  let g = begin(initial);
  const event = g.pendingAmbassador!.event;
  g = applyAction(g, 'c', { type: 'card', card: truth });
  assert.ok(g.truthtrance);
  while (g.truthtrance?.stage === 'priority') {
    const next = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, next.id, { type: 'truthPass' });
  }
  g = applyAction(g, 'c', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(g, 'e', { type: 'truthAnswer', answer: 'no' });
  g = JSON.parse(JSON.stringify(g)) as Game;
  assert.equal(g.pendingAmbassador?.event, event);
  assert.deepEqual(g.decision, { kind: 'ecazAmbassador', player: 'c' });
  g = decide(g, { cards: [card] });
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.players[1].hand.length, 1);
  assert.equal(g.discard.filter((held) => held.id === truth).length, 1);
  assert.equal(g.discard.filter((held) => held.id === card).length, 1);
  assert.equal(g.players[2].forces['arrakeen:10'], 1);
});

void test('cash-in preserving one card remains legal and the retained card completes the Ixian exchange', () => {
  const initial = fixture();
  const karama = hold(initial, 'Karama'),
    sold = hold(initial, 'Snooper'),
    kept = hold(initial, 'Shield');
  let g = begin(initial);
  g = applyAction(g, 'c', {
    type: 'card',
    mode: 'special',
    card: karama,
    cards: [sold],
  });
  assert.equal(g.players[1].spice, 13);
  assert.deepEqual(
    g.players[1].hand.map((card) => card.id),
    [kept],
  );
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  g = decide(g, { cards: [kept] });
  assert.equal(g.players[1].hand.length, 1);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.players[1].spice, 13);
});

void test('unselected BG copy permits spending its final Ixian discard while a Fremen relocation remains viable', () => {
  for (const interruption of ['cash', 'truth'] as const) {
    const initial = fixture('beneGesserit');
    initial.players[1].forces = { 'red_chasm:7': 2 };
    initial.players[1].reserves = 18;
    const card = hold(
      initial,
      interruption === 'cash' ? 'Snooper' : 'Truthtrance',
    );
    const karama = interruption === 'cash' ? hold(initial, 'Karama') : null;
    let g = begin(initial);
    const event = g.pendingAmbassador!.event;
    const copies = (state: Game) =>
      viewGame(state, 'c')
        .ambassadorEntry!.copies.filter((choice) => !choice.blocked)
        .map((choice) => choice.effect)
        .sort();
    assert.equal(g.pendingAmbassador?.stage, 'copy');
    assert.deepEqual(copies(g), ['fremen', 'guild', 'ixians']);
    assert.equal(
      g.ecazAmbassadors!.tokens.find(
        (token) => token.effect === 'beneGesserit',
      )!.zone,
      'removed',
    );
    if (interruption === 'cash') {
      g = applyAction(g, 'c', {
        type: 'card',
        mode: 'special',
        card: karama!,
        cards: [card],
      });
      assert.equal(g.players[1].spice, 13);
      assert.equal(g.players[1].specialKaramaUsed, true);
    } else {
      g = applyAction(g, 'c', { type: 'card', card });
      while (g.truthtrance?.stage === 'priority') {
        const next = g.players.find(
          (player) => !g.truthtrance!.passed.includes(player.id),
        )!;
        g = applyAction(g, next.id, { type: 'truthPass' });
      }
      g = applyAction(g, 'c', {
        type: 'truthAsk',
        question: {
          kind: 'fact',
          target: 'e',
          fact: { kind: 'hand', name: 'Shield' },
        },
      });
      g = applyAction(g, 'e', { type: 'truthAnswer', answer: 'no' });
      assert.equal(g.players[1].spice, 10);
    }
    g = JSON.parse(JSON.stringify(g)) as Game;
    assert.equal(g.pendingAmbassador?.event, event);
    assert.equal(g.pendingAmbassador?.stage, 'copy');
    assert.deepEqual(g.players[1].hand, []);
    assert.deepEqual(copies(g), ['fremen', 'guild']);
    assert.equal(g.discard.filter((held) => held.id === card).length, 1);
    if (karama)
      assert.equal(g.discard.filter((held) => held.id === karama).length, 1);
    g = decide(g, { effect: 'fremen' });
    assert.equal(g.pendingAmbassador?.stage, 'move');
    g = decide(g, {
      forces: { 'red_chasm:7': 1 },
      territory: 'sietch_tabr',
      sector: 14,
    });
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.players[1].forces['red_chasm:7'], 1);
    assert.equal(g.players[1].forces['sietch_tabr:14'], 1);
    assert.equal(g.players[1].reserves, 18);
    assert.equal(g.players[1].moved, 0);
    assert.equal(g.players[2].forces['arrakeen:10'], 1);
    assert.equal(g.players[2].spice, 9);
    assert.equal(
      g.ecazAmbassadors!.tokens.find(
        (token) => token.effect === 'beneGesserit',
      )!.zone,
      'removed',
    );
    assert.equal(
      g.ecazAmbassadors!.tokens.find((token) => token.effect === 'fremen')!
        .zone,
      'pool',
    );
    const physical = [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((player) => player.hand),
    ].map((held) => held.id);
    assert.equal(new Set(physical).size, physical.length);
  }
});
