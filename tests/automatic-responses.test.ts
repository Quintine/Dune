import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const cards = baseDeck();
const karamas = cards.filter((c) => c.effect === 'karama');
const worthless = cards.filter((c) => c.kind === 'worthless');
const shield = cards.find((c) => c.kind === 'shield')!;
function fixture(
  factions: FactionId[] = ['guild', 'emperor', 'beneGesserit'],
  advanced = true,
) {
  const g = createGame(
    'AUTORESP',
    newPlayer('a', 'First', factions[0]),
    advanced,
  );
  factions
    .slice(1)
    .forEach((f, i) =>
      g.players.push(newPlayer(String.fromCharCode(98 + i), f, f)),
    );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.order = g.players.map((p) => p.id);
  g.active = 'a';
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  g.response = { kind: 'guildIncome', owner: 'a', amount: 3, passed: [] };
  return g;
}
function auction() {
  const g = fixture(['harkonnen', 'emperor', 'guild']);
  g.phase = 3;
  g.auction = {
    cards: [shield],
    index: 0,
    bid: 4,
    bidder: 'a',
    active: 'a',
    passed: ['b', 'c'],
    opener: 0,
    peekKnown: false,
  };
  g.players[0].hand = [shield];
  g.deck = [worthless[0], worthless[1]];
  g.response = { kind: 'emperorIncome', owner: 'b', passed: [] };
  return g;
}
function battle(g: Game) {
  g.phase = 6;
  g.players[1].ally = 'a';
  g.players[0].ally = 'b';
  if (g.players[1].faction === 'emperor')
    g.response = {
      kind: 'emperorGift',
      owner: 'b',
      recipient: 'a',
      amount: 3,
      passed: [],
    };
  g.battle = {
    territory: 'arrakeen',
    attacker: 'a',
    defender: 'c',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  for (const p of [g.players[0], g.players[2]]) {
    p.forces = { 'arrakeen:10': 6 };
    p.reserves = 14;
  }
}
function ids(g: Game, who: string) {
  return viewGame(g, who).responseControls!.cancelCards;
}
function cancel(g: Game, who: string, card: Card) {
  return applyAction(g, who, { type: 'card', mode: 'cancel', card: card.id });
}

void test('uncancelable income and Harkonnen bonus drain once; JSON normalization and projection never replay draw/events', () => {
  const initial = auction();
  const snapshot = JSON.stringify(initial);
  const g = normalizeAutomaticGame(reload(initial));
  assert.equal(g.response, null);
  assert.equal(g.players[1].spice, 14);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [shield.id, worthless[0].id],
  );
  assert.equal(g.deck.length, 1);
  assert.deepEqual(
    g.log.filter((e) => e.automatic).map((e) => e.automatic!.name),
    ['Auction income', 'Bonus treachery card'],
  );
  assert.equal(JSON.stringify(initial), snapshot);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  for (const p of g.players) viewGame(g, p.id);
  assert.deepEqual(normalizeAutomaticGame(g), g);
});

void test('chain stops at a real later choice, including an eligible allied opponent', () => {
  const g = auction();
  g.players[1].hand = [karamas[0]];
  g.players[1].ally = 'a';
  g.players[0].ally = 'b';
  const waiting = normalizeAutomaticGame(g);
  assert.equal(waiting.players[1].spice, 14);
  assert.equal(waiting.response?.kind, 'harkonnenBonus');
  assert.deepEqual(ids(waiting, 'b'), [karamas[0].id]);
  assert.equal(waiting.players[0].hand.length, 1);
  const done = applyAction(waiting, 'b', { type: 'passResponse' });
  assert.equal(done.response, null);
  assert.equal(done.players[0].hand.length, 2);
});

void test('viewer controls and passed IDs disclose only that viewer; prior explicit passer retains late cancellation', () => {
  let g = fixture();
  g.players[1].hand = [karamas[0]];
  g.players[2].hand = [karamas[1]];
  g = applyAction(g, 'b', { type: 'passResponse' });
  assert.deepEqual(g.response!.passed, ['b']);
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.deepEqual(view.response!.passed, p.id === 'b' ? ['b'] : []);
    assert.equal(view.responseControls!.hasPassed, p.id === 'b');
    assert.deepEqual(
      view.responseControls!.cancelCards,
      p.hand.map((c) => c.id),
    );
    for (const other of view.players.filter((other) => other.id !== p.id))
      assert.equal('hand' in other, false);
  }
  assert.deepEqual(ids(g, 'b'), [karamas[0].id]);
  const canceled = cancel(g, 'b', karamas[0]);
  assert.equal(canceled.response, null);
  assert.equal(canceled.players[0].spice, 10);
  assert.equal(
    canceled.discard.filter((c) => c.id === karamas[0].id).length,
    1,
  );
});

void test('Basic BG Worthless auto-allows; Advanced BG retains the actual conversion choice', () => {
  for (const advanced of [false, true]) {
    const g = fixture(undefined, advanced);
    g.players[2].hand = [worthless[0]];
    const next = normalizeAutomaticGame(g);
    assert.equal(!!next.response, advanced);
    assert.equal(next.players[0].spice, advanced ? 10 : 13);
    if (advanced) assert.deepEqual(ids(next, 'c'), [worthless[0].id]);
  }
});

void test('retention, sealed plans and prescience reserve exact cards while a later physical card stays selectable', () => {
  for (const kind of ['retention', 'sealed', 'prescience'] as const) {
    const g = fixture();
    battle(g);
    g.players[2].hand = [worthless[0], worthless[1]];
    if (kind === 'retention')
      g.moritaniRetention = {
        owner: 'b',
        player: 'c',
        territory: 'arrakeen',
        turn: 2,
        played: [worthless[0].id],
        eligible: [worthless[0].id],
        stage: 'choose',
      };
    if (kind === 'sealed')
      g.battle!.plans.c = {
        dial: 0,
        support: 0,
        leader: null,
        weapon: worthless[0].id,
        defense: null,
      };
    if (kind === 'prescience')
      g.battle!.prescience = {
        player: 'a',
        field: 'weapon',
        value: worthless[0].id,
      };
    assert.deepEqual(ids(g, 'c'), [worthless[1].id]);
    const before = JSON.stringify(g);
    assert.throws(
      () => cancel(g, 'c', worthless[0]),
      /cleanup|sealed|prescience/,
    );
    assert.equal(JSON.stringify(g), before);
    const next = applyAction(g, 'c', { type: 'card', mode: 'cancel' });
    assert.equal(next.response, null);
    assert.deepEqual(
      next.players[2].hand.map((c) => c.id),
      [worthless[0].id],
    );
    assert.equal(next.players[0].spice, 10);
  }
});

void test('canceled BG conversion restores passes, recomputes depleted custody and completes outer power once', () => {
  let g = fixture();
  g.players[2].hand = [worthless[0]];
  g.players[1].hand = [karamas[0]];
  g = applyAction(g, 'b', { type: 'passResponse' });
  g = cancel(g, 'c', worthless[0]);
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.deepEqual(
    g.pendingKarama?.use.kind === 'cancel'
      ? g.pendingKarama.use.response.passed
      : [],
    ['b'],
  );
  g = cancel(reload(g), 'b', karamas[0]);
  assert.equal(g.response, null);
  assert.equal(g.pendingKarama, null);
  assert.equal(g.players[0].spice, 13);
  assert.equal(
    g.discard.filter((c) => [worthless[0].id, karamas[0].id].includes(c.id))
      .length,
    2,
  );
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
});

void test('pending conversion never offers a nested Worthless conversion; real Karama still blocks it', () => {
  const g = fixture();
  g.players[2].hand = [worthless[0], karamas[0]];
  g.response = { kind: 'worthlessKarama', owner: 'b', passed: [] };
  g.pendingKarama = {
    owner: 'b',
    use: {
      kind: 'cancel',
      response: { kind: 'guildIncome', owner: 'a', amount: 3, passed: [] },
    },
  };
  assert.deepEqual(ids(g, 'c'), [karamas[0].id]);
  const before = JSON.stringify(g);
  assert.throws(
    () => cancel(g, 'c', worthless[0]),
    /conversion is already pending/,
  );
  assert.equal(JSON.stringify(g), before);
  const next = cancel(g, 'c', karamas[0]);
  assert.equal(next.response?.kind, 'guildIncome');
  assert.deepEqual(ids(next, 'c'), [worthless[0].id]);
});

void test('Truthtrance and phase-opening overlays pause normalization without payment or response alteration', () => {
  for (const overlay of ['truth', 'phase'] as const) {
    const g = fixture();
    if (overlay === 'truth')
      g.truthtrance = {
        stage: 'ask',
        queue: [{ player: 'b', card: 'spent-truth' }],
        passed: [],
        question: null,
      };
    else g.phaseOpening = { initialize: false, passed: [] };
    const next = normalizeAutomaticGame(g);
    assert.deepEqual(next.response, g.response);
    assert.equal(next.players[0].spice, 10);
    assert.deepEqual(next.log, g.log);
    if (overlay === 'phase') {
      let done = next;
      for (const p of done.players)
        done = applyAction(done, p.id, { type: 'ready' });
      assert.equal(done.response, null);
      assert.equal(done.players[0].spice, 13);
    }
  }
});

void test('promise-bound Worthless candidate is conservatively retained but an illegal voluntary spend rolls back', () => {
  const g = fixture();
  battle(g);
  g.players[2].hand = [worthless[0]];
  g.battle!.truthPromises = [
    {
      player: 'c',
      asker: 'a',
      claim: { kind: 'weapon', name: worthless[0].name },
      answer: true,
    },
  ];
  const next = normalizeAutomaticGame(g);
  assert.deepEqual(ids(next, 'c'), [worthless[0].id]);
  assert.ok(next.response);
  const before = JSON.stringify(next);
  assert.throws(() => cancel(next, 'c', worthless[0]), /voluntarily/);
  assert.equal(JSON.stringify(next), before);
});

void test('hand-exchange suspension waits; restored response uses newly returned card and original passes', () => {
  let g = fixture(['harkonnen', 'emperor', 'guild']);
  g.pendingExchange = {
    response: { kind: 'guildIncome', owner: 'c', amount: 3, passed: ['a'] },
    decision: null,
  };
  g.response = null;
  g.decision = { kind: 'handExchange', player: 'a', target: 'b', count: 1 };
  g.players[0].hand = [karamas[0]];
  g = normalizeAutomaticGame(g);
  assert.equal(g.players[2].spice, 10);
  assert.equal(g.decision?.kind, 'handExchange');
  g = applyAction(g, 'a', { type: 'decision', returnCards: [karamas[0].id] });
  assert.deepEqual(g.response?.passed, ['a']);
  assert.deepEqual(ids(g, 'b'), [karamas[0].id]);
  g = applyAction(g, 'b', { type: 'passResponse' });
  assert.equal(g.players[2].spice, 13);
  assert.equal(g.response, null);
});

void test('setAutopilot preserves uncancelable response and exact gameplay state until authoritative normalization', () => {
  const initial = auction();
  const next = applyAction(initial, 'c', {
    type: 'setAutopilot',
    difficulty: 'Hard',
  });
  const comparison = structuredClone(next);
  delete comparison.players[2].autopilot;
  comparison.log = initial.log;
  assert.deepEqual(comparison, initial);
  const done = normalizeAutomaticGame(next);
  assert.equal(done.response, null);
  assert.equal(done.players[0].hand.length, 2);
});

void test('setup completion waits for a real response then resumes automatically after its last choice', () => {
  const g = fixture(['guild', 'emperor'], false);
  g.status = 'setup';
  g.phase = 0;
  g.turn = 1;
  g.players.forEach((p) => {
    p.traitors = [p.leaders[0].id];
  });
  g.players[1].hand = [karamas[0]];
  const waiting = normalizeAutomaticGame(g);
  assert.equal(waiting.status, 'setup');
  assert.equal(waiting.players[0].spice, 10);
  const done = applyAction(waiting, 'b', { type: 'passResponse' });
  assert.equal(done.status, 'playing');
  assert.equal(done.response, null);
  assert.equal(done.players[0].spice, 13);
  assert.equal(done.log.filter((e) => /Setup complete/.test(e.text)).length, 1);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
});

void test('summoned worm resolves its own window before restoring and automatically completing the saved response', () => {
  // Isolate suspended-response ordering with a correctly seated Guild income owner.
  let g = fixture(['fremen', 'guild', 'emperor']);
  g.phase = 1;
  g.storm = 18;
  g.players[0].hand = [karamas[0]];
  g.players[2].hand = [karamas[1]];
  g.players[0].forces = { 'the_great_flat:15': 4 };
  g.players[0].reserves = 16;
  g.players[1].forces = { 'the_great_flat:15': 3 };
  g.players[1].reserves = 17;
  g.response = { kind: 'guildIncome', owner: 'b', amount: 3, passed: ['c'] };
  g = applyAction(g, 'a', {
    type: 'card',
    mode: 'special',
    card: karamas[0].id,
    territory: 'the_great_flat',
  });
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.summonedWorm?.resume.response?.kind, 'guildIncome');
  assert.equal(g.players[1].spice, 10);
  assert.equal(g.players[1].tanks, 0);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  g = applyAction(g, 'c', { type: 'passResponse' });
  assert.equal(g.summonedWorm, null);
  assert.equal(g.response, null);
  assert.equal(g.players[1].spice, 13);
  assert.equal(g.players[1].tanks, 3);
  assert.equal(g.players[0].forces['the_great_flat:15'], 4);
  assert.equal(g.discard.filter((c) => c.id === karamas[0].id).length, 1);
});

void test('Voice cancellation can preserve a promise; automatic allowance releases an incompatible promise', () => {
  const g = fixture(['atreides', 'beneGesserit', 'emperor']);
  battle(g);
  g.players[2].hand = [shield];
  g.players[0].hand = [karamas[0]];
  g.battle!.voice = { target: 'c', kind: 'shield', must: false };
  g.battle!.truthPromises = [
    {
      player: 'c',
      asker: 'a',
      claim: { kind: 'defense', name: shield.name },
      answer: true,
    },
  ];
  g.response = { kind: 'voice', owner: 'b', passed: [] };
  const waiting = normalizeAutomaticGame(g);
  assert.equal(waiting.battle!.truthPromises![0].released, undefined);
  const canceled = cancel(waiting, 'a', karamas[0]);
  assert.equal(canceled.battle!.voice, undefined);
  assert.equal(canceled.battle!.truthPromises![0].released, undefined);
  const allowed = applyAction(waiting, 'a', { type: 'passResponse' });
  assert.equal(allowed.response, null);
  assert.equal(allowed.battle!.truthPromises![0].released, true);
});

void test('answering an active Truthtrance restores then drains the original response without another confirmation', () => {
  const g = fixture();
  const truth = cards.find((c) => c.effect === 'truthtrance')!;
  g.players[1].hand = [truth];
  g.truthtrance = {
    stage: 'answer',
    queue: [{ player: 'b', card: truth.id }],
    passed: ['a', 'b', 'c'],
    question: {
      kind: 'fact',
      target: 'a',
      fact: { kind: 'hand', name: 'Shield' },
    },
  };
  const done = applyAction(g, 'a', { type: 'truthAnswer', answer: 'no' });
  assert.equal(done.truthtrance, null);
  assert.equal(done.response, null);
  assert.equal(done.players[0].spice, 13);
  assert.equal(done.truthHistory?.length, 1);
});
