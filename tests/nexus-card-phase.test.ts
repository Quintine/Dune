import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNexusCardPhase,
  markNexusCardOccurred,
  closeNexusCardPhase,
  finishNexusCardChoice,
  nexusCardChoices,
  validateNexusCardPhase,
  type NexusCardPhase,
  type NexusCardChoice,
} from '../game/nexus-card-phase';
import {
  createNexusCards,
  drawNexusCard,
  replaceNexusCard,
  projectNexusCards,
  validateNexusPlayers,
  type NexusPlayer,
  type NexusState,
} from '../game/nexus-cards';

const players: NexusPlayer[] = [
  { id: 'a', faction: 'atreides', ally: null },
  { id: 'g', faction: 'guild', ally: 'h' },
  { id: 'h', faction: 'harkonnen', ally: 'g' },
  { id: 'e', faction: 'emperor', ally: null },
];
const cards = () => createNexusCards(players, () => 0.999);
const open = () =>
  closeNexusCardPhase(markNexusCardOccurred(createNexusCardPhase(3)), players);
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

void test('only an actual Nexus and a settled alliance open the closing opportunity', () => {
  const initial = createNexusCardPhase(3);
  assert.deepEqual(nexusCardChoices(initial, cards(), 'a'), []);
  assert.equal(closeNexusCardPhase(initial, players).stage, 'complete');
  const unallied = players.map((p) => ({ ...p, ally: null }));
  assert.equal(
    closeNexusCardPhase(markNexusCardOccurred(initial), unallied).stage,
    'complete',
  );
  const marked = markNexusCardOccurred(initial);
  assert.equal(initial.occurred, false);
  assert.deepEqual(markNexusCardOccurred(marked), marked);
  const phase = closeNexusCardPhase(marked, players);
  assert.deepEqual(phase.eligible, ['a', 'e']);
  assert.equal(phase.stage, 'drawing');
  assert.deepEqual(nexusCardChoices(phase, cards(), 'g'), []);
  assert.throws(() => closeNexusCardPhase(phase, players));
  assert.throws(() => markNexusCardOccurred(phase));
});

void test('each eligible owner may finish once in either order and the whole phase closes once', () => {
  const initial = open();
  const state = cards();
  const first = finishNexusCardChoice(initial, players, state, 'e', 'keep');
  assert.deepEqual(first.done, ['e']);
  assert.equal(first.stage, 'drawing');
  assert.deepEqual(nexusCardChoices(first, state, 'e'), []);
  const drawn = drawNexusCard(state, 'a', players, () => 0);
  const complete = finishNexusCardChoice(
    reload(first),
    players,
    reload(drawn),
    'a',
    'draw',
  );
  assert.equal(complete.stage, 'complete');
  assert.deepEqual(initial.done, []);
  validateNexusCardPhase(reload(complete), players, drawn);
  assert.throws(() =>
    finishNexusCardChoice(complete, players, drawn, 'a', 'keep'),
  );
  assert.throws(() => closeNexusCardPhase(complete, players));
  assert.throws(() => markNexusCardOccurred(complete));
});

void test('keeping empty or held hands is legal; replacement requires the physical transaction first', () => {
  const initial = open();
  const state = cards();
  assert.deepEqual(nexusCardChoices(initial, state, 'a'), ['keep', 'draw']);
  assert.throws(() =>
    finishNexusCardChoice(initial, players, state, 'a', 'draw'),
  );
  const held = drawNexusCard(state, 'a', players, () => 0);
  assert.deepEqual(nexusCardChoices(initial, held, 'a'), ['keep', 'replace']);
  const replaced = replaceNexusCard(held, 'a', players, () => 0);
  const done = finishNexusCardChoice(
    initial,
    players,
    replaced,
    'a',
    'replace',
  );
  assert.deepEqual(done.done, ['a']);
  assert.equal(held.hands.a, 'atreides');
  assert.equal(replaced.hands.a, 'harkonnen');
  assert.deepEqual(replaced.discard, ['atreides']);
  assert.deepEqual(
    finishNexusCardChoice(initial, players, held, 'a', 'keep').done,
    ['a'],
  );
});

void test('own-faction and other draws have identical public progress and observer projections', () => {
  const phase = open();
  const ownDeck = cards();
  const otherDeck = reload(ownDeck);
  [otherDeck.deck[0], otherDeck.deck[1]] = [
    otherDeck.deck[1],
    otherDeck.deck[0],
  ];
  const own = drawNexusCard(ownDeck, 'a', players, () => 0);
  const other = drawNexusCard(otherDeck, 'a', players, () => 0);
  assert.notEqual(own.hands.a, other.hands.a);
  const ownDone = finishNexusCardChoice(phase, players, own, 'a', 'draw');
  const otherDone = finishNexusCardChoice(phase, players, other, 'a', 'draw');
  assert.deepEqual(ownDone, otherDone);
  assert.deepEqual(
    projectNexusCards(own, 'e', players),
    projectNexusCards(other, 'e', players),
  );
  assert.deepEqual(nexusCardChoices(ownDone, own, 'a'), []);
});

void test('a recycled own card may repeat without creating a second phase opportunity', () => {
  const phase = open();
  const held = drawNexusCard(cards(), 'a', players, () => 0);
  const exhausted: NexusState = { ...held, deck: [], discard: [...held.deck] };
  let calls = 0;
  const same = replaceNexusCard(exhausted, 'a', players, () =>
    calls++ === 0 ? 0 : 0.999,
  );
  assert.equal(same.hands.a, 'atreides');
  const different = replaceNexusCard(same, 'a', players, () => {
    throw new Error('No shuffle needed');
  });
  assert.notEqual(different.hands.a, 'atreides');
  const done = finishNexusCardChoice(phase, players, different, 'a', 'replace');
  assert.deepEqual(done.done, ['a']);
  assert.throws(() =>
    finishNexusCardChoice(done, players, different, 'a', 'replace'),
  );
});

void test('saved progress detects rewinds, altered recipients and unknown fields without mutation', () => {
  const state = cards();
  let complete = finishNexusCardChoice(open(), players, state, 'a', 'keep');
  complete = finishNexusCardChoice(complete, players, state, 'e', 'keep');
  const mutations: Array<(phase: NexusCardPhase) => void> = [
    (p) => {
      p.stage = 'drawing';
      p.done = [];
    },
    (p) => {
      p.turn++;
    },
    (p) => {
      p.occurred = false;
    },
    (p) => {
      p.eligible.reverse();
    },
    (p) => {
      p.done.reverse();
    },
    (p) => {
      p.eligible.push('outsider');
    },
    (p) => {
      p.signature = '';
    },
    (p) => {
      Object.assign(p, { redraw: 'a' });
    },
  ];
  for (const mutate of mutations) {
    const corrupt = reload(complete);
    mutate(corrupt);
    const before = JSON.stringify(corrupt);
    assert.throws(() => validateNexusCardPhase(corrupt, players, state));
    assert.throws(() => nexusCardChoices(corrupt, state, 'a'));
    assert.throws(() =>
      finishNexusCardChoice(corrupt, players, state, 'a', 'keep'),
    );
    assert.equal(JSON.stringify(corrupt), before);
  }
});

void test('unknown choices, premature finishes and foreign owners reject unchanged', () => {
  const phase = open();
  const state = cards();
  const before = JSON.stringify({ phase, state });
  for (const choice of ['redraw', 'skip', '', null, 1])
    assert.throws(() =>
      finishNexusCardChoice(
        phase,
        players,
        state,
        'a',
        choice as NexusCardChoice,
      ),
    );
  for (const owner of ['g', 'outsider'])
    assert.throws(() =>
      finishNexusCardChoice(phase, players, state, owner, 'keep'),
    );
  assert.throws(() =>
    finishNexusCardChoice(createNexusCardPhase(3), players, state, 'a', 'keep'),
  );
  assert.equal(JSON.stringify({ phase, state }), before);
});

void test('one-way, missing and overlapping alliance partners cannot qualify a Nexus window', () => {
  const state = cards();
  for (const seats of [
    players.map((p) => (p.id === 'h' ? { ...p, ally: null } : p)),
    players.map((p) => (p.id === 'g' ? { ...p, ally: 'outsider' } : p)),
    players.map((p) => (p.id === 'a' ? { ...p, ally: 'g' } : p)),
  ]) {
    const before = JSON.stringify(seats);
    assert.throws(() => validateNexusPlayers(seats));
    assert.throws(() =>
      closeNexusCardPhase(
        markNexusCardOccurred(createNexusCardPhase(3)),
        seats,
      ),
    );
    assert.throws(() => validateNexusCardPhase(open(), seats, state));
    assert.equal(JSON.stringify(seats), before);
  }
  const changed = players.map((p) => ({ ...p, ally: null }));
  assert.throws(() => validateNexusCardPhase(open(), changed, state));
  let complete = finishNexusCardChoice(open(), players, state, 'a', 'keep');
  complete = finishNexusCardChoice(complete, players, state, 'e', 'keep');
  validateNexusCardPhase(complete, changed, state);
});
