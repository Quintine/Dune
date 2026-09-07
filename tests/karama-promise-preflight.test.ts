import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import type { PlanClaim } from '../game/battle-promises';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
// Observe the production dispatcher before its wrapper's final reconciliation.
// A durable cost must not rely exclusively on that later atomic boundary.
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport {applyActionInner};\n',
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
    crypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function act(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const next = applyAction(g, id, a);
  assert.deepEqual(g, before);
  return reload(next);
}
function hold(g: Game, id: string, kind: string) {
  const i = g.deck.findIndex(
    (c) => c.name === kind || c.kind === kind || c.effect === kind,
  );
  assert.ok(i >= 0, kind);
  const card = g.deck.splice(i, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function fixture(battle = false) {
  const g = createGame(
    'KARAMATRUTH',
    newPlayer('p', 'Promisor', battle ? 'beneGesserit' : 'harkonnen'),
    battle,
    [],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('f', 'Other', battle ? 'harkonnen' : 'fremen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: battle ? 6 : 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'e', 'f'],
    movementRemaining: ['p', 'e', 'f'],
    phaseOpening: null,
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    p.traitors = [];
    p.traitorChoices = [];
  }
  player(g, 'e').ally = 'f';
  player(g, 'f').ally = 'e';
  hold(g, 'e', 'Truthtrance');
  return g;
}
function bind(initial: Game, claim?: PlanClaim) {
  let g = act(initial, 'e', {
    type: 'card',
    card: player(initial, 'e').hand.find((c) => c.effect === 'truthtrance')!.id,
  });
  while (g.truthtrance?.stage === 'priority')
    g = act(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = act(g, 'e', {
    type: 'truthAsk',
    question: claim
      ? { kind: 'battlePlan', target: 'p', claim }
      : { kind: 'shipment', target: 'p', territory: 'carthag', minimum: 6 },
  });
  return act(g, 'p', { type: 'truthAnswer', answer: 'yes' });
}
function battleFixture(alternative = false) {
  let g = fixture(true);
  for (const id of ['p', 'f']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
  }
  const cost = hold(g, 'p', 'worthless'),
    counter = hold(g, 'f', 'karama');
  const shield = alternative ? hold(g, 'p', 'Shield') : null;
  g = act(g, 'p', { type: 'chooseBattle', territory: 'arrakeen', target: 'f' });
  assert.equal(g.battle?.preparation?.kind, 'voice');
  g = act(g, 'p', { type: 'declineBattlePower' });
  const claim: PlanClaim = alternative
    ? {
        kind: 'or',
        terms: [
          { kind: 'weapon', name: cost.name },
          { kind: 'defense', name: 'Shield' },
        ],
      }
    : { kind: 'weapon', name: cost.name };
  g = bind(g, claim);
  g = act(g, 'e', { type: 'emperorGift', amount: 1 });
  assert.equal(g.response?.kind, 'emperorGift');
  return { g, cost, counter, shield };
}
function rejectsBeforeCost(g: Game, card: string) {
  const a: Action = { type: 'card', card, mode: 'cancel' };
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p', a), /Truthtrance/);
  assert.throws(() => observed.applyActionInner!(g, 'p', a), /Truthtrance/);
  assert.deepEqual(g, before);
  assert.ok(player(g, 'p').hand.some((c) => c.id === card));
  assert.equal(
    g.discard.some((c) => c.id === card),
    false,
  );
}
function passKind(g: Game, kind: NonNullable<Game['response']>['kind']) {
  for (let i = 0; g.response?.kind === kind; i++) {
    assert.ok(i < 12);
    g = act(g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, {
      type: 'passResponse',
    });
  }
  return g;
}

void test('the actual dispatcher rejects spending the last shipment Karama on an unrelated real cancellation before the cost boundary', (t) => {
  const initial = fixture();
  player(initial, 'p').spice = 3;
  const cost = hold(initial, 'p', 'Karama');
  let g = bind(initial);
  g = act(g, 'e', { type: 'emperorGift', amount: 1 });
  assert.equal(g.response?.kind, 'emperorGift');
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Unexpected random draw');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw new Error('Unexpected event allocation');
  });
  rejectsBeforeCost(g, cost.id);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('the actual intended own-shipment rate preserves the promise after consuming its required Karama', () => {
  const initial = fixture();
  player(initial, 'p').spice = 3;
  const cost = hold(initial, 'p', 'Karama');
  const g = bind(initial);
  const a: Action = {
    type: 'card',
    card: cost.id,
    mode: 'shipment',
    target: 'p',
  };
  const inner = observed.applyActionInner!(g, 'p', a);
  assert.equal(inner.karamaShipping?.player, 'p');
  assert.equal(inner.discard.filter((c) => c.id === cost.id).length, 1);
  let done = act(g, 'p', a);
  const completion = viewGame(done, 'p').shipmentCompletion!;
  assert.ok(completion);
  assert.equal(completion.actions[0].type, 'ship');
  for (const action of completion.actions) done = act(done, 'p', action);
  assert.equal(done.shipmentPromises![0].fulfilled, true);
  assert.equal(player(done, 'p').forces['carthag:11'], 6);
  assert.equal(player(done, 'p').spice, 0);
  assert.equal(done.discard.filter((c) => c.id === cost.id).length, 1);
});
void test('BG cannot commit a promised sole Worthless battle card even when its proposed cancellation is otherwise legal', (t) => {
  const { g, cost } = battleFixture();
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Unexpected random draw');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw new Error('Unexpected event allocation');
  });
  rejectsBeforeCost(g, cost.id);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('BG may consume one promised alternative while another legal plan survives either allowance or counter-cancellation', () => {
  const { g, cost, counter, shield } = battleFixture(true);
  for (const blocked of [false, true]) {
    let next = act(g, 'p', { type: 'card', card: cost.id, mode: 'cancel' });
    assert.equal(next.response?.kind, 'worthlessKarama');
    assert.equal(next.battle!.truthPromises![0].released, undefined);
    if (blocked) {
      next = act(next, 'f', { type: 'card', card: counter.id, mode: 'cancel' });
      next = passKind(next, 'emperorGift');
    } else next = passKind(next, 'worthlessKarama');
    assert.equal(next.battle!.truthPromises![0].released, undefined);
    const ownerView = viewGame(next, 'p');
    assert.equal(ownerView.battle!.compliantPlan?.defense, shield!.id);
    assert.equal(viewGame(next, 'e').battle!.compliantPlan, null);
    assert.equal(player(next, 'e').spice, blocked ? 19 : 20);
    assert.equal(player(next, 'f').spice, blocked ? 21 : 20);
    const plan = ownerView.battle!.compliantPlan!;
    next = act(next, 'p', { type: 'battlePlan', ...plan });
    assert.equal(next.battle!.plans.p.defense, shield!.id);
    assert.equal(viewGame(next, 'e').battle!.plans.p, undefined);
    assert.equal(next.discard.filter((c) => c.id === cost.id).length, 1);
  }
});
void test('repeated owner-only completion searches use no RNG and preserve a Ghola plus Karama preparation witness', (t) => {
  const initial = fixture();
  player(initial, 'p').spice = 3;
  player(initial, 'p').reserves = 1;
  player(initial, 'p').tanks = 19;
  const karama = hold(initial, 'p', 'Karama'),
    ghola = hold(initial, 'p', 'Tleilaxu Ghola');
  const g = bind(initial);
  const before = structuredClone(g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Unexpected random draw');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw new Error('Unexpected event allocation');
  });
  const math = t.mock.method(Math, 'random', () => {
    throw new Error('Unexpected random draw');
  });
  let expected: unknown;
  for (let i = 0; i < 8; i++) {
    const view = viewGame(reload(g), 'p');
    assert.ok(view.shipmentCompletion);
    assert.ok(
      view.shipmentCompletion.actions.some((a) => a.card === karama.id),
    );
    assert.ok(view.shipmentCompletion.actions.some((a) => a.card === ghola.id));
    if (i) assert.deepEqual(view.shipmentCompletion, expected);
    expected = view.shipmentCompletion;
    for (const id of ['e', 'f']) {
      const other = viewGame(reload(g), id);
      assert.equal(other.shipmentCompletion, null);
      assert.equal(other.truthShipmentAnswers, null);
      assert.equal(other.players.find((p) => p.id === 'p')!.hand, undefined);
    }
  }
  assert.deepEqual(g, before);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
  assert.equal(math.mock.callCount(), 0);
});

void test('the intended printed Voice cancellation restores a promised Shield before owner feasibility is checked', () => {
  let g = fixture(true);
  g.players[0] = newPlayer('p', 'Promisor', 'harkonnen');
  g.players[2] = newPlayer('f', 'Voice owner', 'beneGesserit');
  player(g, 'f').ally = 'e';
  for (const id of ['p', 'f']) {
    player(g, id).forces = { 'arrakeen:10': 4 };
    player(g, id).reserves = 16;
    player(g, id).spice = 20;
  }
  const cost = hold(g, 'p', 'Karama'),
    shield = hold(g, 'p', 'Shield');
  g = act(g, 'p', { type: 'chooseBattle', territory: 'arrakeen', target: 'f' });
  assert.equal(g.battle?.preparation?.kind, 'voice');
  g = bind(g, { kind: 'defense', name: 'Shield' });
  g = act(g, 'f', { type: 'voice', kind: 'shield', must: false });
  assert.equal(g.response?.kind, 'voice');
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  const action: Action = { type: 'card', card: cost.id, mode: 'cancel' };
  const inner = observed.applyActionInner!(g, 'p', action);
  assert.equal(inner.battle!.voice, undefined);
  assert.equal(inner.battle!.truthPromises![0].released, undefined);
  g = act(g, 'p', action);
  const completion = viewGame(g, 'p').battle!.compliantPlan!;
  assert.equal(completion.defense, shield.id);
  g = act(g, 'p', { type: 'battlePlan', ...completion });
  assert.equal(g.battle!.plans.p.defense, shield.id);
});
