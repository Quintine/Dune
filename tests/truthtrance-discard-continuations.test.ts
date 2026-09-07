import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import { createAuditorLeader, CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import type { FactionId } from '../game/catalog';
import { type TruthQuestion, type TruthFact } from '../game/truthtrance';
import { richeseCards } from '../game/richese-cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
  finishResponse?: (g: Game, canceled: boolean) => void;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, finishResponse };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const result = reload(observed.applyActionInner!(g, id, a));
  assert.deepEqual(g, before);
  return result;
}
function fixture(faction: FactionId = 'atreides') {
  const g = createGame('TRUTHFRAME', newPlayer('p', 'Asker', faction));
  g.players.push(
    newPlayer('t', 'Target', 'emperor'),
    newPlayer('q', 'Other', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    storm: 18,
    order: ['q', 'p', 't'],
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [p.leaders[0].id];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  hold(g, 'p', 'Truthtrance');
  hold(g, 't', 'Shield');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const [card] = g.deck.splice(i, 1);
  player(g, id).hand.push(card);
  return card.id;
}
function declare(g: Game, id = 'p', cards?: string[]) {
  const ids =
    cards ??
    player(g, id)
      .hand.filter((c) => c.effect === 'truthtrance')
      .map((c) => c.id);
  return applyAction(g, id, {
    type: 'card',
    card: ids[0],
    cards: ids.slice(1),
  });
}
function priority(state: Game) {
  let g = state;
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return g;
}
const fact: TruthQuestion = {
  kind: 'fact',
  target: 't',
  fact: { kind: 'hand', name: 'Shield' },
};
const ask = (g: Game, question: TruthQuestion = fact) =>
  applyAction(g, g.truthtrance!.queue[0].player, {
    type: 'truthAsk',
    question,
  });
const asked = (g = fixture(), question: TruthQuestion = fact) =>
  ask(priority(declare(g)), question);
const answer = (value = 'yes'): Action => ({
  type: 'truthAnswer',
  answer: value,
});
function receipt(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  if (c.kind !== 'truthtranceDiscard')
    throw Error('Missing consumed Truthtrance frame');
  return c;
}
function recover(g: Game) {
  const before = structuredClone(g),
    done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, before);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  return done;
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}

void test('definite facts commit one public answer and the asker-owned card before restoring the table', () => {
  const facts: TruthFact[] = [
    { kind: 'hand', name: 'Shield' },
    { kind: 'handCount', name: 'Shield', compare: 'eq', value: 1 },
    { kind: 'spice', compare: 'eq', value: 10 },
    { kind: 'traitor', leader: player(fixture(), 't').leaders[0].id },
    {
      kind: 'and',
      terms: [
        { kind: 'handCount', name: 'Shield', compare: 'gte', value: 1 },
        { kind: 'spice', compare: 'lte', value: 10 },
      ],
    },
  ];
  for (const leaf of facts) {
    const before = asked(fixture(), { kind: 'fact', target: 't', fact: leaf }),
      card = before.truthtrance!.queue[0].card;
    assert.equal(viewGame(before, 't').truthAnswer, 'yes');
    assert.equal(viewGame(before, 'p').truthAnswer, null);
    const pending = inner(before, 't', answer()),
      c = receipt(pending),
      batch = pending.pendingTreacheryDiscard!.batch;
    assert.equal(pending.truthtrance, null);
    assert.equal(pending.truthHistory!.length, 1);
    assert.equal(c.historyIndex, 0);
    assert.equal(c.record.answer, 'yes');
    assert.equal(c.record.asker, 'p');
    assert.deepEqual(c.consumed, { player: 'p', card });
    assert.deepEqual(
      batch.entries.map((e) => [e.card.id, e.discardedBy, e.publicFace]),
      [[card, 'p', true]],
    );
    assert.equal(c.remaining, null);
    assert.equal(player(pending, 'p').hand.length, 0);
    const done = recover(pending);
    assert.deepEqual(done.players, pending.players);
    assert.deepEqual(done.log, pending.log);
    assert.deepEqual(done.truthHistory, pending.truthHistory);
    assert.deepEqual(reload(done), reload(applyAction(before, 't', answer())));
    assert.deepEqual(inventory(done), inventory(before));
  }
});

void test('separate holders preserve storm priority and retire one queue head per distinct discard event', () => {
  const initial = fixture();
  hold(initial, 'q', 'Truthtrance');
  let state = priority(declare(declare(initial), 'q'));
  assert.deepEqual(
    state.truthtrance!.queue.map((q) => q.player),
    ['q', 'p'],
  );
  const queue = structuredClone(state.truthtrance!.queue),
    passed = [...state.truthtrance!.passed];
  state = ask(state);
  const pending = inner(state, 't', answer());
  assert.equal(receipt(pending).consumed.player, 'q');
  assert.equal(pending.truthtrance, null);
  assert.deepEqual(receipt(pending).remaining?.queue, queue.slice(1));
  const next = recover(pending);
  assert.equal(next.truthtrance?.stage, 'ask');
  assert.equal(next.truthtrance!.question, null);
  assert.deepEqual(next.truthtrance!.passed, passed);
  assert.deepEqual(next.truthtrance!.queue, queue.slice(1));
  const second = inner(ask(next), 't', answer('yes')),
    done = recover(second);
  assert.equal(second.pendingTreacheryDiscard!.sequence, 2);
  assert.equal(done.truthtrance, null);
  assert.deepEqual(
    done.truthHistory!.map((h) => h.asker),
    ['q', 'p'],
  );
  assert.equal(done.discard.length, 2);
  assert.deepEqual(inventory(done), inventory(initial));
});

void test('same-holder declaration order survives a consumed head and an unknown/save for its remaining card', () => {
  const initial = fixture();
  hold(initial, 'p', 'Truthtrance');
  const ids = player(initial, 'p')
    .hand.filter((c) => c.effect === 'truthtrance')
    .map((c) => c.id)
    .reverse();
  const pending = inner(
    ask(priority(declare(initial, 'p', ids))),
    't',
    answer(),
  );
  assert.equal(receipt(pending).consumed.card, ids[0]);
  let done = recover(pending);
  assert.equal(done.truthtrance!.queue[0].card, ids[1]);
  done = ask(done, {
    kind: 'freeform',
    target: 't',
    scope: 'fact',
    text: 'Can you determine an unknown fact?',
  });
  done = applyAction(done, 't', answer('unknown'));
  assert.equal(done.truthtrance!.stage, 'unknown');
  assert.equal(done.pendingTreacheryDiscard, null);
  done = applyAction(done, 'p', { type: 'truthSave' });
  assert.equal(done.truthtrance, null);
  assert.equal(done.resolvedTreacheryDiscardSequence, 1);
  assert.ok(player(done, 'p').hand.some((c) => c.id === ids[1]));
  assert.equal(done.truthHistory!.length, 2);
});

void test('unknown then re-ask consumes one physical card and binds the later exact history index', () => {
  let state = asked(fixture(), {
    kind: 'freeform',
    target: 't',
    scope: 'fact',
    text: 'What cannot be known?',
  });
  state = applyAction(state, 't', answer('unknown'));
  assert.equal(state.pendingTreacheryDiscard ?? null, null);
  assert.equal(state.treacheryDiscardSequence ?? 0, 0);
  assert.equal(player(state, 'p').hand.length, 1);
  const pending = inner(ask(state), 't', answer());
  assert.equal(receipt(pending).historyIndex, 1);
  const done = recover(pending);
  assert.deepEqual(
    done.truthHistory!.map((r) => r.answer),
    ['unknown', 'yes'],
  );
  assert.equal(done.discard.length, 1);
  assert.equal(done.resolvedTreacheryDiscardSequence, 1);
});

void test('a definite legacy setup fact can retire its card without advancing incomplete traitor selection', () => {
  const initial = fixture();
  initial.status = 'setup';
  initial.phase = 0;
  player(initial, 't').traitors = [];
  player(initial, 't').traitorChoices = [player(initial, 't').leaders[1].id];
  const before = asked(initial),
    pending = inner(before, 't', answer());
  assert.equal(pending.status, 'setup');
  assert.equal(receipt(pending).record.phase, 0);
  const done = recover(pending);
  assert.equal(done.status, 'setup');
  assert.equal(done.phase, 0);
  assert.deepEqual(
    player(done, 't').traitorChoices,
    player(initial, 't').traitorChoices,
  );
  assert.equal(done.truthtrance, null);
  assert.deepEqual(inventory(done), inventory(initial));
});

for (const value of ['yes', 'no'] as const)
  void test(`a ${value} shipment answer binds once before the consumed card frame and remains enforceable afterward`, () => {
    const initial = fixture();
    initial.phase = 5;
    initial.active = 't';
    initial.order = ['t', 'p', 'q'];
    initial.movementRemaining = [...initial.order];
    const before = asked(initial, {
      kind: 'shipment',
      target: 't',
      territory: 'carthag',
      minimum: 2,
    });
    const pending = inner(before, 't', answer(value));
    assert.equal(pending.shipmentPromises!.length, 1);
    assert.equal(pending.shipmentPromises![0].answer, value === 'yes');
    const done = recover(pending);
    assert.deepEqual(done.shipmentPromises, pending.shipmentPromises);
    assert.deepEqual(
      reload(done),
      reload(applyAction(before, 't', answer(value))),
    );
    const wrong: Action =
      value === 'yes'
        ? { type: 'endMovement' }
        : { type: 'ship', territory: 'carthag', sector: 11, amount: 2 };
    assert.throws(() => applyAction(done, 't', wrong));
    const legal: Action =
      value === 'yes'
        ? { type: 'ship', territory: 'carthag', sector: 11, amount: 2 }
        : { type: 'endMovement' };
    const fulfilled = applyAction(done, 't', legal);
    assert.equal(fulfilled.shipmentPromises!.length, 1);
    assert.equal(fulfilled.shipmentPromises![0].fulfilled, true);
    inventory(fulfilled);
  });

for (const stage of ['unsubmitted', 'submitted', 'revealed'] as const)
  void test(`battle ${stage} question preserves its exact promise behavior across consumption`, () => {
    let initial = fixture();
    initial.phase = 6;
    initial.active = 'p';
    for (const id of ['p', 't']) {
      player(initial, id).forces = { 'arrakeen:10': 4 };
      player(initial, id).reserves = 16;
    }
    initial = applyAction(initial, 'p', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 't',
    });
    while (initial.battle?.preparation)
      initial = applyAction(initial, initial.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    const plan = (id: string): Action => ({
      type: 'battlePlan',
      dial: id === 't' ? 2 : 0,
      support: 0,
      leader: player(initial, id).leaders[0].id,
    });
    if (stage !== 'unsubmitted') initial = applyAction(initial, 't', plan('t'));
    if (stage === 'revealed') initial = applyAction(initial, 'p', plan('p'));
    const before = asked(initial, {
      kind: 'battlePlan',
      target: 't',
      territory: 'arrakeen',
      claim: { kind: 'dial', compare: 'gte', value: 2 },
    });
    const pending = inner(before, 't', answer()),
      promises = pending.battle!.truthPromises ?? [];
    assert.equal(promises.length, stage === 'unsubmitted' ? 1 : 0);
    assert.equal(
      receipt(pending).promise?.kind ?? null,
      stage === 'unsubmitted' ? 'battle' : null,
    );
    const done = recover(pending);
    assert.deepEqual(done.battle, pending.battle);
    assert.deepEqual(reload(done), reload(applyAction(before, 't', answer())));
    if (stage === 'unsubmitted') {
      assert.throws(() => applyAction(done, 't', { ...plan('t'), dial: 0 }));
      const planned = applyAction(done, 't', plan('t'));
      assert.equal(planned.battle!.plans.t.dial, 2);
    }
    assert.deepEqual(inventory(done), inventory(initial));
  });

void test('public answer history remains public while hidden fact alternatives and next-answer assistance stay private', () => {
  const initial = fixture();
  const question: TruthQuestion = {
    kind: 'fact',
    target: 't',
    fact: {
      kind: 'or',
      terms: [
        { kind: 'hand', name: 'Shield' },
        { kind: 'traitor', leader: player(initial, 't').leaders[0].id },
      ],
    },
  };
  const pending = inner(asked(initial, question), 't', answer()),
    alternate = reload(pending);
  const substitute = alternate.deck.findIndex((c) => c.name === 'Snooper');
  const shieldIndex = player(alternate, 't').hand.findIndex(
    (c) => c.name === 'Shield',
  );
  [player(alternate, 't').hand[shieldIndex], alternate.deck[substitute]] = [
    alternate.deck[substitute],
    player(alternate, 't').hand[shieldIndex],
  ];
  for (const p of pending.players) {
    const view = viewGame(pending, p.id);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(view.truthtrance, null);
    assert.equal(view.truthAnswer, null);
    assert.equal(view.truthShipmentAnswers, null);
    assert.equal(view.truthBattleAnswers, null);
    assert.equal(view.truthHistory[0].answer, 'yes');
    assert.deepEqual(view.truthHistory[0].question, question);
    assert.ok(!('pendingTreacheryDiscard' in view));
    if (p.id !== 't') assert.deepEqual(viewGame(alternate, p.id), view);
    for (const level of DIFFICULTIES) {
      view.players.find((x) => x.id === p.id)!.bot = level;
      assert.deepEqual(botActions(view), []);
    }
  }
  const run = runBots(reload(pending), 0);
  assert.deepEqual(
    reload({ ...run, botsPending: undefined }),
    reload({ ...recover(pending), botsPending: undefined }),
  );
});

void test('an underlying phase opening stays paused until every queued Truthtrance has finished', () => {
  const initial = fixture();
  hold(initial, 'q', 'Truthtrance');
  initial.phaseOpening = { passed: ['t'], initialize: false };
  const queued = priority(declare(declare(initial), 'q'));
  const pending = inner(ask(queued), 't', answer());
  assert.equal(pending.phaseOpening, null);
  const next = recover(pending);
  assert.equal(next.truthtrance!.queue[0].player, 'p');
  assert.deepEqual(next.phaseOpening, initial.phaseOpening);
  const done = recover(inner(ask(next), 't', answer()));
  assert.equal(done.truthtrance, null);
  assert.deepEqual(done.phaseOpening, initial.phaseOpening);
});

void test('Truthtrance consumes a held card while Ornithopter remains escrowed, before separate final-flight retirement', () => {
  let initial = fixture();
  initial.phase = 5;
  initial.active = 'p';
  initial.movementRemaining = ['p', 'q', 't'];
  initial.richeseCache = richeseCards();
  const i = initial.richeseCache.findIndex((c) => c.effect === 'ornithopter');
  const orni = initial.richeseCache.splice(i, 1)[0];
  player(initial, 'p').hand.push(orni);
  player(initial, 'p').forces = { 'imperial_basin:10': 3 };
  player(initial, 'p').reserves = 17;
  initial = applyAction(initial, 'p', {
    type: 'move',
    movementCard: orni.id,
    ornithopter: 'twoGroups',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  const pending = inner(asked(initial), 't', answer());
  assert.equal(pending.ornithopter!.completed, 1);
  assert.equal(receipt(pending).consumed.player, 'p');
  const next = recover(pending);
  assert.deepEqual(next.ornithopter, initial.ornithopter);
  const done = applyAction(next, 'p', {
    type: 'move',
    ornithopterEvent: next.ornithopter!.event,
    forces: { 'imperial_basin:10': 1 },
    territory: 'carthag',
    sector: 11,
  });
  assert.equal(done.ornithopter, null);
  assert.equal(player(done, 'p').moved, 2);
  assert.equal(done.resolvedTreacheryDiscardSequence, 2);
  assert.deepEqual(inventory(done), inventory(initial));
});

void test('a queued follow-up prevents early Robbery overflow completion until the final consumed head retires', () => {
  let initial = fixture('moritani');
  initial.phase = 5;
  initial.active = 't';
  initial.movementRemaining = ['t', 'p', 'q'];
  hold(initial, 'p', 'Truthtrance');
  player(initial, 'p').hand.push(...initial.deck.splice(0, 2));
  initial.moritaniTerror = createTerrorState(() => 0);
  const token = initial.moritaniTerror.tokens.find(
    (t) => t.kind === 'robbery',
  )!;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror,
    token.id,
    'arrakeen',
    1,
  );
  initial = applyAction(initial, 't', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  initial = applyAction(initial, 'p', { type: 'decision', reveal: true });
  initial = applyAction(initial, 'p', { type: 'decision', choice: 'card' });
  assert.equal(player(initial, 'p').hand.length, 5);
  assert.equal(initial.pendingTerrorEntry?.stage, 'discard');
  const pending = inner(asked(initial), 't', answer());
  assert.equal(player(pending, 'p').hand.length, 4);
  const next = recover(pending);
  assert.ok(next.truthtrance);
  assert.equal(next.pendingTerrorEntry?.stage, 'discard');
  const done = recover(inner(ask(next), 't', answer()));
  assert.equal(done.truthtrance, null);
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  assert.equal(player(done, 'p').hand.length, 3);
  assert.deepEqual(done.deck, initial.deck);
  assert.equal(done.resolvedTreacheryDiscardSequence, 2);
  assert.deepEqual(inventory(done), inventory(initial));
});

for (const stage of ['response', 'payment'] as const)
  void test(`consumed Truthtrance restores the ${stage} of an Auditor from an actual completed battle`, () => {
    let initial = fixture('richese');
    initial.phase = 6;
    initial.active = 'p';
    initial.advanced = true;
    initial.order = ['p', 'q', 't'];
    initial.players[2] = newPlayer('q', 'CHOAM', 'choam');
    player(initial, 'q').spice = 10;
    player(initial, 'q').leaders.push(createAuditorLeader());
    hold(initial, 'p', 'Snooper');
    for (const id of ['p', 'q']) {
      player(initial, id).forces = { 'arrakeen:10': 4 };
      player(initial, id).reserves = 16;
    }
    if (stage === 'response') hold(initial, 't', 'Karama');
    initial = applyAction(initial, 'p', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'q',
    });
    for (let i = 0; i < 30; i++) {
      if (initial.response) {
        initial = applyAction(
          initial,
          initial.players.find((p) => !initial.response!.passed.includes(p.id))!
            .id,
          { type: 'passResponse' },
        );
        continue;
      }
      const b = initial.battle!;
      if (b.preLeader && !b.preLeader.closed)
        initial = applyAction(
          initial,
          [b.attacker, b.defender].find(
            (id) => !b.preLeader!.ready.includes(id),
          )!,
          { type: 'battlePreparationReady', event: b.event },
        );
      else if (b.preparation)
        initial = applyAction(initial, b.preparation.owner, {
          type: 'declineBattlePower',
        });
      else break;
    }
    initial = applyAction(initial, 'p', {
      type: 'battlePlan',
      leader: player(initial, 'p').leaders[0].id,
      dial: 0,
      support: 0,
    });
    initial = applyAction(initial, 'q', {
      type: 'battlePlan',
      leader: CHOAM_AUDITOR_ID,
      dial: 4,
      support: 4,
    });
    initial = applyAction(initial, 'p', { type: 'traitorCall', call: false });
    initial = applyAction(initial, 'q', { type: 'traitorCall', call: false });
    assert.equal(initial.decision?.kind, 'choamAudit');
    initial = applyAction(initial, 'q', {
      type: 'decision',
      event: initial.pendingAuditor!.event,
      audit: true,
    });
    assert.equal(initial.pendingAuditor?.stage, stage);
    const pending = inner(asked(initial), 't', answer()),
      done = recover(pending);
    assert.deepEqual(done.pendingAuditor, initial.pendingAuditor);
    assert.deepEqual(done.response, initial.response);
    assert.deepEqual(done.decision, initial.decision);
    assert.deepEqual(done.players, pending.players);
    for (const p of initial.players) viewGame(pending, p.id);
    let result = done;
    while (result.response)
      result = applyAction(
        result,
        result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    result = applyAction(result, 'p', {
      type: 'decision',
      event: result.pendingAuditor!.event,
      pay: false,
    });
    assert.equal(result.pendingAuditor, null);
    assert.deepEqual(
      result.auditorInsight!.cards.map((c) => c.name),
      ['Snooper'],
    );
    assert.deepEqual(inventory(result), inventory(initial));
    assert.equal(result.truthHistory!.length, 1);
  });

void test('a real BG Worthless conversion retains its nested response while only Truthtrance becomes fresh', () => {
  let initial = fixture('beneGesserit');
  initial.advanced = true;
  initial.phase = 5;
  initial.active = 't';
  const i = initial.deck.findIndex((c) => c.kind === 'worthless'),
    worthless = initial.deck.splice(i, 1)[0];
  player(initial, 'p').hand.push(worthless);
  hold(initial, 'q', 'Karama');
  initial = applyAction(initial, 'p', {
    type: 'card',
    card: worthless.id,
    mode: 'shipment',
    target: 't',
  });
  assert.equal(initial.response?.kind, 'worthlessKarama');
  const pending = inner(asked(initial), 't', answer()),
    done = recover(pending);
  assert.deepEqual(done.pendingKarama, initial.pendingKarama);
  assert.deepEqual(done.response, initial.response);
  assert.equal(pending.pendingTreacheryDiscard!.batch.entries.length, 1);
  assert.equal(
    pending.pendingTreacheryDiscard!.batch.entries[0].card.effect,
    'truthtrance',
  );
  assert.ok(pending.discard.some((c) => c.id === worthless.id));
  let result = done;
  while (result.response)
    result = applyAction(
      result,
      result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.deepEqual(result.karamaShipping, {
    owner: 'p',
    player: 't',
    card: worthless.id,
  });
  assert.equal(result.pendingKarama, null);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('a real Harkonnen hand-exchange return decision survives Truthtrance without a second sample', () => {
  let initial = fixture('harkonnen');
  initial.advanced = true;
  initial.phase = 3;
  const karama = hold(initial, 'p', 'Karama');
  player(initial, 'q').hand.push(...initial.deck.splice(0, 2));
  initial = applyAction(initial, 'p', {
    type: 'card',
    mode: 'special',
    card: karama,
    target: 'q',
    amount: 1,
  });
  assert.equal(initial.decision?.kind, 'handExchange');
  const pending = inner(asked(initial), 't', answer()),
    done = recover(pending);
  assert.deepEqual(done.pendingExchange, reload(initial).pendingExchange);
  assert.deepEqual(done.decision, initial.decision);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(done.deck, pending.deck);
  const returned = player(done, 'p').hand[0].id;
  const result = applyAction(done, 'p', {
    type: 'decision',
    returnCards: [returned],
  });
  assert.equal(result.pendingExchange, null);
  assert.ok(player(result, 'q').hand.some((c) => c.id === returned));
  assert.equal(result.resolvedTreacheryDiscardSequence, 1);
  assert.deepEqual(inventory(result), inventory(initial));
});

function rejectsCorrupt(pending: Game, mutations: ((g: Game) => void)[]) {
  for (const [index, mutate] of mutations.entries()) {
    const corrupt = reload(pending);
    mutate(corrupt);
    const before = structuredClone(corrupt);
    assert.throws(
      () => normalizeAutomaticGame(corrupt),
      `normalization mutation ${index}`,
    );
    assert.throws(
      () => applyAction(corrupt, 'p', { type: 'advanceBots' }),
      `action mutation ${index}`,
    );
    assert.throws(() => viewGame(corrupt, 'p'), `projection mutation ${index}`);
    assert.deepEqual(corrupt, before);
  }
}
void test('corrupt physical receipts, answered history, queue custody and suspended contexts reject atomically', () => {
  const initial = fixture();
  hold(initial, 'q', 'Truthtrance');
  const pending = inner(
    ask(priority(declare(declare(initial), 'q'))),
    't',
    answer(),
  );
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.turn++;
    },
    (g) => {
      g.phase++;
    },
    (g) => {
      g.status = 'finished';
    },
    (g) => {
      g.treacheryDiscardSequence!++;
    },
    (g) => {
      g.resolvedTreacheryDiscardSequence = g.treacheryDiscardSequence;
    },
    (g) => {
      g.pendingTreacheryDiscard!.sequence++;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.event += 'stale';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.cause = 'terror:sabotage';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].publicFace = false;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 't';
    },
    (g) => {
      receipt(g).consumed.player = 't';
    },
    (g) => {
      receipt(g).consumed.card = 'missing';
    },
    (g) => {
      g.discard = [];
    },
    (g) => {
      g.deck.push(structuredClone(g.discard.at(-1)!));
    },
    (g) => {
      player(g, 't').hand.push(structuredClone(g.discard.at(-1)!));
    },
    (g) => {
      g.discard.at(-1)!.effect = 'karama';
    },
    (g) => {
      receipt(g).historyIndex++;
    },
    (g) => {
      receipt(g).historyIndex = -1;
    },
    (g) => {
      receipt(g).record.answer = 'unknown';
    },
    (g) => {
      g.truthHistory![0].answer = 'no';
    },
    (g) => {
      g.truthHistory!.push(structuredClone(g.truthHistory![0]));
    },
    (g) => {
      receipt(g).record.question.target = 'q';
    },
    (g) => {
      receipt(g).remaining = null;
    },
    (g) => {
      receipt(g).remaining!.stage = 'priority';
    },
    (g) => {
      receipt(g).remaining!.question = fact;
    },
    (g) => {
      receipt(g).remaining!.queue.push(
        structuredClone(receipt(g).remaining!.queue[0]),
      );
    },
    (g) => {
      receipt(g).remaining!.queue[0].card = receipt(g).consumed.card;
    },
    (g) => {
      receipt(g).remaining!.queue[0].player = 't';
    },
    (g) => {
      player(g, 'p').hand = [];
    },
    (g) => {
      g.deck.push(structuredClone(player(g, 'p').hand[0]));
    },
    (g) => {
      receipt(g).remaining!.passed.push('missing');
    },
    (g) => {
      receipt(g).remaining!.passed.push(receipt(g).remaining!.passed[0]);
    },
    (g) => {
      receipt(g).parentSignature += 'stale';
    },
    (g) => {
      receipt(g).resume.phaseOpening = { passed: [], initialize: true };
    },
    (g) => {
      Object.assign(receipt(g).resume, {
        decision: { kind: 'handExchange', player: 't' },
      });
    },
    (g) => {
      g.active = 't';
    },
    (g) => {
      g.order.reverse();
    },
  ];
  for (const key of [
    'truthtrance',
    'response',
    'decision',
    'phaseOpening',
    'pendingKarama',
    'pendingNullentropy',
  ])
    mutations.push((g) => {
      Object.assign(g, { [key]: {} });
    });
  rejectsCorrupt(pending, mutations);
  const done = recover(pending),
    replay = reload(done);
  replay.pendingTreacheryDiscard = structuredClone(
    pending.pendingTreacheryDiscard,
  );
  rejectsCorrupt(replay, [() => {}]);
});

void test('the already-bound shipment promise cannot be deleted, replaced, released or fulfilled before recovery', () => {
  const initial = fixture();
  initial.phase = 5;
  initial.active = 't';
  initial.order = ['t', 'p', 'q'];
  initial.movementRemaining = [...initial.order];
  const pending = inner(
    asked(initial, {
      kind: 'shipment',
      target: 't',
      territory: 'carthag',
      minimum: 2,
    }),
    't',
    answer(),
  );
  rejectsCorrupt(pending, [
    (g) => {
      receipt(g).promise = null;
    },
    (g) => {
      receipt(g).promise!.index++;
    },
    (g) => {
      g.shipmentPromises = [];
    },
    (g) => {
      g.shipmentPromises![0].answer = false;
    },
    (g) => {
      g.shipmentPromises![0].released = true;
    },
    (g) => {
      g.shipmentPromises![0].fulfilled = true;
    },
    (g) => {
      g.shipmentPromises![0].minimum++;
    },
    (g) => {
      g.shipmentPromises![0].player = 'p';
    },
    (g) => {
      g.shipmentPromises!.push(structuredClone(g.shipmentPromises![0]));
    },
  ]);
});

void test('wrong actors, false answers and invalid timing cannot consume the held queue head', () => {
  const initial = fixture(),
    declared = declare(initial),
    before = asked(initial);
  for (const [state, id, action] of [
    [declared, 't', answer()],
    [before, 'p', answer()],
    [before, 'q', answer()],
    [before, 't', answer('no')],
    [before, 't', answer('unknown')],
    [before, 't', answer('maybe')],
  ] as [Game, string, Action][]) {
    const snapshot = structuredClone(state);
    assert.throws(() => applyAction(state, id, action));
    assert.deepEqual(state, snapshot);
    assert.equal(state.pendingTreacheryDiscard ?? null, null);
    assert.ok(player(state, 'p').hand.some((c) => c.effect === 'truthtrance'));
    assert.equal(state.truthHistory?.length ?? 0, 0);
  }
});
