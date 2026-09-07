import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createDukeVidal, acquireDuke } from '../game/duke-vidal';

function fixture() {
  const g = createGame(
    'RESIDUALREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    false,
    ['choam'],
  );
  g.players.push(
    newPlayer('g', 'Guild', 'guild'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'r',
    order: ['r', 'g', 'e'],
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 2 };
    p.reserves = 18;
  }
  hold(g, 'r', 'Residual Poison');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const index = source.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = source.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
const send = (g: Game, id: string, action: Action) =>
  applyAction(g, id, action);
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const start = (g: Game) =>
  send(g, 'r', { type: 'chooseBattle', target: 'g', territory: 'arrakeen' });
const ready = (g: Game, id: string) =>
  send(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
const poison = (g: Game) =>
  send(g, 'r', {
    type: 'card',
    card: 'richese-residual-poison',
    target: 'g',
    event: g.battle!.event,
  });
const plan = (g: Game, id: string) =>
  send(g, id, {
    type: 'battlePlan',
    leader: g.players.find((p) => p.id === id)!.leaders.find((l) => !l.dead)!
      .id,
    dial: 1,
  });
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();

void test('a fast opponent cannot commit before both genuine preparation declarations, independent of card possession', () => {
  const withCard = start(fixture());
  const noCard = fixture();
  const card = noCard.players[0].hand.pop()!;
  noCard.richeseCache!.push(card);
  const without = start(noCard);
  assert.deepEqual(
    { ...withCard.battle!.preLeader, event: 'same' },
    { ...without.battle!.preLeader, event: 'same' },
  );
  assert.deepEqual(withCard.battle!.preLeader!.ready, []);
  const fast = ready(withCard, 'g');
  assert.throws(() => plan(fast, 'g'), /Both combatants/);
  const hit = poison(reload(fast));
  assert.deepEqual(hit.battle!.preLeader!.ready, ['g']);
  assert.equal(hit.players[1].leaders.filter((l) => l.dead).length, 1);
  const allowed = ready(hit, 'r');
  assert.equal(allowed.battle!.preLeader!.closed, true);
  assert.ok(plan(allowed, 'g').battle!.plans.g);
  assert.deepEqual(normalizeAutomaticGame(reload(withCard)), reload(withCard));
});

void test('private views and all malformed/stale timing rejections consume no random draw', (t) => {
  let g = start(fixture());
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('unexpected RNG');
  });
  const before = structuredClone(g);
  assert.equal(viewGame(g, 'r').residualPoison!.blocked, null);
  assert.equal(viewGame(g, 'g').residualPoison, null);
  assert.equal(viewGame(g, 'e').residualPoison, null);
  assert.throws(
    () =>
      send(g, 'r', {
        type: 'card',
        card: 'richese-residual-poison',
        target: 'g',
        event: 'old',
      }),
    /stale/,
  );
  assert.throws(
    () =>
      send(g, 'r', {
        type: 'card',
        card: 'richese-residual-poison',
        target: 'g',
        event: g.battle!.event,
        leader: 'guild-0',
      }),
    /server/,
  );
  assert.deepEqual(g, before);
  g = ready(ready(g, 'r'), 'g');
  g = plan(g, 'g');
  assert.throws(() => poison(g), /commits a leader/);
  const legacy = reload(before);
  delete legacy.battle!.event;
  delete legacy.battle!.preLeader;
  assert.match(viewGame(legacy, 'r').residualPoison!.blocked!, /predates/);
  assert.equal(normalizeAutomaticGame(legacy).battle!.event, undefined);
});

void test('an invalid death transition in any candidate is rejected before random selection and leaves the whole battle unchanged', (t) => {
  const g = start(fixture());
  g.players[1].leaders[2].deaths = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(g);
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('unexpected RNG before candidate validation');
  });
  assert.throws(() => poison(g), /overflow/);
  assert.deepEqual(g, before);
  assert.match(viewGame(g, 'r').residualPoison!.blocked!, /overflow/);
});

void test('an involuntary last-leader death releases a real Truthtrance leader promise without rejecting or rerolling', () => {
  let g = fixture();
  for (const l of g.players[1].leaders.slice(1)) {
    l.dead = true;
    l.deaths = 1;
  }
  const sole = g.players[1].leaders[0].id,
    truth = hold(g, 'r', 'Truthtrance');
  g = start(g);
  g = send(g, 'r', { type: 'card', card: truth });
  assert.throws(() => poison(g), /Truth|answer|interaction/i);
  while (g.truthtrance!.stage === 'priority')
    g = send(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = send(g, 'r', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'g',
      claim: { kind: 'leader', leader: sole },
    },
  });
  g = send(g, 'g', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  const before = inventory(g),
    spice = g.players.map((p) => p.spice),
    forces = g.players.map((p) => p.forces);
  g = poison(reload(g));
  assert.equal(g.battle!.truthPromises![0].released, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.deepEqual(
    g.players.map((p) => p.spice),
    spice,
  );
  assert.deepEqual(
    g.players.map((p) => p.forces),
    forces,
  );
  assert.deepEqual(inventory(g), before);
  assert.equal(
    g.discard.filter((c) => c.id === 'richese-residual-poison').length,
    1,
  );
  g = ready(ready(g, 'r'), 'g');
  g = send(g, 'g', { type: 'battlePlan', leader: null, dial: 1 });
  assert.equal(g.battle!.plans.g.leader, null);
});

void test('real nonleader Prescience that becomes impossible reopens the same private element, while leader answers wait for readiness', () => {
  let g = fixture();
  g.players[2] = newPlayer('e', 'Atreides', 'atreides');
  g.players[2].ally = 'r';
  g.players[0].ally = 'e';
  for (const l of g.players[1].leaders.slice(1)) {
    l.dead = true;
    l.deaths = 1;
  }
  const weapon = hold(g, 'g', 'Maula Pistol');
  g = start(g);
  g = send(g, 'e', { type: 'prescience', field: 'weapon' });
  g = send(g, 'g', { type: 'prescienceAnswer', value: weapon });
  assert.equal(g.battle!.prescience!.value, weapon);
  g = poison(reload(g));
  assert.equal(g.battle!.preparation!.kind, 'prescienceAnswer');
  assert.equal(g.battle!.prescience!.field, 'weapon');
  assert.equal('value' in g.battle!.prescience!, false);
  assert.ok(!JSON.stringify(viewGame(g, 'e').log).includes(weapon));
  g = send(g, 'g', { type: 'prescienceAnswer', value: null });
  assert.equal(g.battle!.prescience!.value, null);
  let leader = start(fixture());
  leader.battle!.prescience = { player: 'r', field: 'leader' };
  leader.battle!.preparation = {
    kind: 'prescienceAnswer',
    owner: 'g',
    beneficiary: 'r',
  };
  assert.throws(
    () => send(leader, 'g', { type: 'prescienceAnswer', value: 'guild-0' }),
    /Both combatants/,
  );
  leader = ready(ready(leader, 'r'), 'g');
  leader = send(leader, 'g', { type: 'prescienceAnswer', value: 'guild-0' });
  assert.throws(() => poison(leader), /commits a leader/);
});

void test('foreign ghola, ordinary captive and separate Duke deaths retain exact physical Tanks history with no bounty', () => {
  for (const kind of ['ghola', 'captive', 'duke'] as const) {
    let g = fixture();
    for (const l of g.players[1].leaders) {
      l.dead = true;
      l.deaths = 1;
    }
    let victim: string;
    if (kind === 'duke') {
      g.dukeVidal = acquireDuke(createDukeVidal(), 'g', 2, 'moritani');
      victim = g.dukeVidal.leader.id;
    } else {
      const l = g.players[2].leaders[0];
      victim = l.id;
      if (kind === 'ghola') l.gholaBy = 'g';
      else l.capturedBy = 'g';
    }
    g = start(g);
    const before = inventory(g);
    g = poison(reload(g));
    const dead =
      kind === 'duke' ? g.dukeVidal!.leader : g.players[2].leaders[0];
    assert.equal(dead.id, victim);
    assert.equal(dead.dead, true);
    assert.equal(dead.deaths, 1);
    if (kind === 'ghola') assert.equal(dead.gholaBy, 'g');
    if (kind === 'captive') assert.equal(dead.capturedBy, undefined);
    if (kind === 'duke') {
      assert.equal(g.dukeVidal!.controller, null);
      assert.equal(
        g.players.flatMap((p) => p.leaders).some((l) => l.id === victim),
        false,
      );
    }
    assert.deepEqual(
      g.players.map((p) => p.spice),
      [10, 10, 10],
    );
    assert.deepEqual(inventory(g), before);
  }
});

void test('public advanced Harkonnen guard is invariant to captive possession and a legitimately reacquired physical card may be played again', () => {
  let g = fixture();
  g.advanced = true;
  g.players[2] = newPlayer('e', 'Harkonnen', 'harkonnen');
  g = start(g);
  const first = viewGame(g, 'r').residualPoison!.blocked;
  g.players[1].leaders[0].capturedBy = 'e';
  assert.equal(viewGame(g, 'r').residualPoison!.blocked, first);
  assert.match(first!, /advanced Harkonnen/);
  g = start(fixture());
  hold(g, 'r', 'Nullentropy Box');
  const all = inventory(g);
  g = poison(g);
  g = send(g, 'r', { type: 'card', card: 'richese-nullentropy-box' });
  assert.ok(g.players[0].hand.some((c) => c.id === 'richese-residual-poison'));
  g = poison(reload(g));
  assert.equal(g.players[1].leaders.filter((l) => l.dead).length, 2);
  assert.equal(
    g.discard.filter((c) => c.id === 'richese-residual-poison').length,
    1,
  );
  assert.deepEqual(inventory(g), all);
  assert.equal(g.players[0].spice, 8);
  assert.ok(leaders('guild').length === 5);
});
