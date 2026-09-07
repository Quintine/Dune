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
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

const stone = 'richese-stone-burner';
function fixture() {
  const g = createGame(
    'STONEREVIEW',
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
    p.traitors = [];
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  hold(g, 'r', 'Stone Burner');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const i = source.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = source.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(c);
  return c.id;
}
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a),
  reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const start = (g: Game) =>
  send(g, 'r', { type: 'chooseBattle', territory: 'arrakeen', target: 'g' });
function prepare(g: Game) {
  while (g.battle?.preparation)
    g = send(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
  if (g.decision?.kind === 'fullPlanOffer')
    g = send(g, g.decision.player, { type: 'decision', decline: true });
  for (const id of ['r', 'g'])
    g = send(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
  return g;
}
const plan = (g: Game, id: string, extra: Partial<Action> = {}) =>
  send(g, id, {
    type: 'battlePlan',
    leader: g.players.find((p) => p.id === id)!.leaders[0].id,
    dial: id === 'r' ? 1 : 3,
    support: 0,
    ...(id === 'r' ? { weapon: stone } : {}),
    ...extra,
  });
const reveal = (
  g: Game,
  own: Partial<Action> = {},
  other: Partial<Action> = {},
) => plan(plan(prepare(start(g)), 'r', own), 'g', other);
const mode = (g: Game, choice = 'kill') =>
  send(g, 'r', { type: 'decision', event: g.battle!.event, mode: choice });
function finish(g: Game, traitor?: string) {
  for (const id of ['r', 'g'])
    if (g.battle)
      g = send(g, id, { type: 'traitorCall', call: id === traitor });
  return g;
}
function cleanup(g: Game) {
  for (
    let i = 0;
    g.decision &&
    ['battleCards', 'battleLosses', 'ixSubstitution'].includes(
      g.decision.kind,
    ) &&
    i < 5;
    i++
  )
    g = send(
      g,
      g.decision.player,
      g.decision.kind === 'battleCards'
        ? { type: 'decision', discard: [] }
        : g.decision.kind === 'battleLosses'
          ? { type: 'decision', choice: 0 }
          : { type: 'decision', amount: 0 },
    );
  return g;
}
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();

void test('forged Stone role and public Ix timing reject before any hidden plan commitment', () => {
  for (const patch of [
    { id: 'forged-stone' },
    { name: 'Other Stone' },
    { effect: 'other' },
    { kind: 'poison' as const },
  ]) {
    let g = fixture();
    Object.assign(g.players[0].hand[0], patch);
    g = prepare(start(g));
    const before = structuredClone(g);
    assert.throws(
      () => plan(g, 'r', { weapon: g.players[0].hand[0].id }),
      /weapon|canonical/,
    );
    assert.deepEqual(g, before);
  }
  let ix = fixture();
  ix.expansions.push('ix');
  ix = prepare(start(ix));
  assert.throws(() => plan(ix, 'r'), /Ix expansion/);
  assert.deepEqual(ix.battle!.plans, {});
});

void test('Advanced Emperor outcome-changing allocation is rejected identically before or after an unrelated hidden opposing plan', () => {
  let g = fixture();
  g.advanced = true;
  g.players[0].faction = 'emperor';
  g.players[0].leaders = leaders('emperor');
  g.players[2] = newPlayer('e', 'Richese', 'richese');
  g.players[0].forces = { 'arrakeen:10': 6 };
  g.players[0].reserves = 14;
  g.players[0].elites = {
    forces: { 'arrakeen:10': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  g = prepare(start(g));
  const attempt = (state: Game) => {
    try {
      plan(state, 'r', { dial: 3, support: 1 });
      assert.fail('ambiguous commitment accepted');
    } catch (error) {
      return String(error);
    }
  };
  const before = attempt(g);
  for (const dial of [0, 1, 2]) {
    const hidden = plan(g, 'g', { dial });
    assert.equal(attempt(hidden), before);
    assert.equal(hidden.battle!.plans.r, undefined);
  }
  assert.match(before, /allocation timing/);
  const valid = plan(g, 'r', { dial: 0, support: 0 });
  assert.ok(valid.battle!.plans.r);
});

void test('public zero-spice compulsion guard is independent of Stone possession and leaves ordinary Voice decline available', () => {
  let g = fixture();
  g.advanced = true;
  g.players[0].forces = { 'arrakeen:10': 1 };
  g.players[0].reserves = 19;
  g.players[0].spice = 0;
  g.players[1].faction = 'emperor';
  g.players[1].leaders = leaders('emperor');
  g.players[1].forces = { 'arrakeen:10': 6 };
  g.players[1].reserves = 14;
  g.players[1].elites = {
    forces: { 'arrakeen:10': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  g.players[2] = newPlayer('e', 'Bene Gesserit', 'beneGesserit');
  g.players[2].ally = 'g';
  g.players[1].ally = 'e';
  g = start(g);
  const error = (state: Game) => {
    try {
      send(state, 'e', { type: 'voice', kind: 'stoneBurner', must: true });
      assert.fail('unfinishable compulsion accepted');
    } catch (e) {
      return String(e);
    }
  };
  const present = error(g),
    absent = reload(g);
  absent.richeseCache!.push(absent.players[0].hand.pop()!);
  assert.equal(error(absent), present);
  assert.match(present, /zero-spice plan/);
  g = send(g, 'e', { type: 'declineBattlePower' });
  for (const id of ['r', 'g'])
    g = send(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
  assert.ok(plan(g, 'r', { weapon: null, dial: 0 }).battle!.plans.r);
});

void test('foreign No-Field values produce identical public Stone preflight context and accept the same own commitment', () => {
  const contexts: unknown[] = [];
  for (const value of [0, 3, 5]) {
    let g = fixture();
    g.players[0].faction = 'guild';
    g.players[0].leaders = leaders('guild');
    g.players[1].faction = 'richese';
    g.players[1].leaders = leaders('richese');
    g.players[1].forces = {};
    g.players[1].reserves = 20;
    const state = createRicheseNoField(['opaque-a', 'opaque-b', 'opaque-c']);
    g.players[1].noField = deployRicheseNoField(state, {
      tokenId: state.tokens.find((t) => t.value === value)!.id,
      controller: 'g',
      location: { territory: 'arrakeen', sector: 10 },
    });
    g.players[1].noFieldEvent = 'marker';
    g = prepare(start(g));
    contexts.push(viewGame(g, 'r').battle!.stoneBurnerContext);
    g = plan(g, 'r', { dial: 0 });
    assert.equal(g.battle!.plans.r.weapon, stone);
    assert.equal(g.players[1].noField!.deployed !== null, true);
  }
  assert.deepEqual(contexts[1], contexts[0]);
  assert.deepEqual(contexts[2], contexts[0]);
});

void test('traitor and Lasgun explosion precedence preserve exact deaths, KH and Stone disposal', () => {
  let traitor = fixture();
  traitor.players[1].traitors = [traitor.players[0].leaders[0].id];
  traitor = finish(mode(reveal(traitor)), 'g');
  assert.equal(traitor.players[0].leaders[0].dead, true);
  assert.equal(traitor.players[1].leaders[0].dead, false);
  assert.equal(traitor.discard.filter((c) => c.id === stone).length, 1);
  assert.equal(traitor.players[1].tanks, 0);
  let g = fixture();
  g.advanced = true;
  g.players[0].faction = 'atreides';
  g.players[0].leaders = leaders('atreides');
  g.players[0].battleLosses = 7;
  g.players[0].kwisatz = { dead: false };
  g.players[2] = newPlayer('e', 'Richese', 'richese');
  const shield = hold(g, 'r', 'Shield'),
    lasgun = hold(g, 'g', 'Lasgun');
  g = reveal(
    g,
    { dial: 0, kwisatz: true, defense: shield },
    { dial: 1, weapon: lasgun },
  );
  g = finish(mode(g));
  assert.equal(g.players[0].kwisatz!.dead, true);
  assert.equal(g.players[0].leaders[0].deaths, 1);
  assert.equal(g.players[1].leaders[0].deaths, 1);
  assert.deepEqual(
    g.players.slice(0, 2).map((p) => p.tanks),
    [5, 5],
  );
  assert.deepEqual(
    g.players.slice(0, 2).map((p) => p.spice),
    [10, 10],
  );
  assert.equal(g.discard.filter((c) => c.id === stone).length, 1);
});

void test('Stone kill keeps KH alive, awards normal bounty and resumes standard winner card retention', () => {
  let g = fixture();
  g.advanced = true;
  g.players[0].faction = 'atreides';
  g.players[0].leaders = leaders('atreides');
  g.players[0].battleLosses = 7;
  g.players[0].kwisatz = { dead: false };
  g.players[2] = newPlayer('e', 'Richese', 'richese');
  const bounty =
      g.players[0].leaders[0].strength + g.players[1].leaders[0].strength,
    before = inventory(g);
  g = reveal(g, { dial: 0, kwisatz: true }, { dial: 1 });
  g = finish(mode(reload(g)));
  assert.equal(g.players[0].kwisatz!.dead, false);
  assert.equal(g.players[0].spice, 10 + bounty);
  assert.equal(g.players[0].leaders[0].deaths, 1);
  assert.equal(g.players[1].leaders[0].deaths, 1);
  g = cleanup(g);
  assert.ok(g.players[0].hand.some((c) => c.id === stone));
  assert.deepEqual(inventory(g), before);
});

void test('a defeated Moritani ally can retain played Stone after the undialed comparison and committed source cannot be transferred', () => {
  let g = fixture();
  g.players[2] = newPlayer('e', 'Moritani', 'moritani');
  g.players[2].ally = 'r';
  g.players[0].ally = 'e';
  hold(g, 'r', 'Distrans');
  const before = inventory(g);
  g = reveal(g, { dial: 3 }, { dial: 1 });
  const pending = structuredClone(g);
  assert.throws(() =>
    send(g, 'r', {
      type: 'card',
      card: 'richese-distrans',
      give: stone,
      target: 'e',
    }),
  );
  assert.deepEqual(g, pending);
  g = mode(g, 'ignore');
  assert.throws(
    () => send(g, 'r', { type: 'richeseGift', card: stone }),
    /committed|sealed|played/,
  );
  g = cleanup(finish(g));
  assert.equal(g.decision?.kind, 'moritaniRetention');
  assert.ok(g.moritaniRetention!.eligible.includes(stone));
  g = send(reload(g), 'r', { type: 'decision', keep: stone });
  assert.ok(g.players[0].hand.some((c) => c.id === stone));
  assert.deepEqual(inventory(g), before);
});

void test('revealed mode is event-bound and owner-only with no random projection or replay', (t) => {
  let g = reveal(fixture());
  const before = structuredClone(g);
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('unexpected RNG');
  });
  assert.equal(viewGame(g, 'e').decision?.kind, 'stoneBurner');
  assert.deepEqual(viewGame(g, 'e').battle!.stoneBurner, {});
  assert.throws(() =>
    send(g, 'g', { type: 'decision', event: g.battle!.event, mode: 'kill' }),
  );
  assert.throws(
    () => send(g, 'r', { type: 'decision', event: 'old', mode: 'kill' }),
    /exact/,
  );
  assert.deepEqual(g, before);
  g = mode(reload(g), 'ignore');
  assert.equal(g.battle!.stoneBurner!.r, 'ignore');
  assert.throws(() => mode(g, 'kill'));
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});

void test('accepted invariant Emperor victory preserves all three later physical casualty choices with one payment and bounty', () => {
  let g = fixture();
  g.advanced = true;
  g.players[0].faction = 'emperor';
  g.players[0].leaders = leaders('emperor');
  // Leave a separate battle pending so retaining the weapon cannot yet trigger
  // the next phase's automatic advanced city income.
  g.players[0].forces = { 'arrakeen:10': 6, 'carthag:11': 1 };
  g.players[0].reserves = 13;
  g.players[0].elites = {
    forces: { 'arrakeen:10': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.players[1].reserves = 19;
  g.players[2] = newPlayer('e', 'Richese', 'richese');
  g.players[2].forces = { 'carthag:11': 1 };
  g.players[2].reserves = 19;
  const physicalInventory = inventory(g);
  const bounty =
    g.players[0].leaders[0].strength + g.players[1].leaders[0].strength;
  g = reveal(g, { dial: 3, support: 1 }, { dial: 0, support: 0 });
  const revealedPlans = structuredClone(g.battle!.plans);
  assert.equal(g.decision?.kind, 'stoneBurner');
  g = mode(reload(g));
  assert.deepEqual(g.battle!.plans, revealedPlans);
  g = finish(g);
  assert.equal(g.decision?.kind, 'battleLosses');
  assert.ok(g.decision?.kind === 'battleLosses');
  assert.equal(g.decision.player, 'r');
  const options = g.decision.options;
  assert.deepEqual(
    options.map((o) => o.normal + o.elite).sort((a, b) => a - b),
    [3, 4, 5],
  );
  assert.equal(g.players[0].forces['arrakeen:10'], 6);
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[1].tanks, 1);
  assert.equal(g.players[0].spice, 9 + bounty);
  const settledSpice = g.players.map((p) => p.spice);
  const settledDeaths = g.players.slice(0, 2).map((p) => p.leaders[0].deaths);
  assert.deepEqual(settledDeaths, [1, 1]);
  const remaining: number[] = [];
  for (let choice = 0; choice < options.length; choice++) {
    const loss = options[choice];
    let branch = send(reload(g), 'r', { type: 'decision', choice });
    assert.equal(branch.players[0].tanks, loss.normal + loss.elite);
    assert.equal(branch.players[0].elites!.tanks, loss.elite);
    assert.equal(
      branch.players[0].forces['arrakeen:10'],
      6 - loss.normal - loss.elite,
    );
    assert.equal(
      branch.players[0].elites!.forces['arrakeen:10'] ?? 0,
      1 - loss.elite,
    );
    assert.equal(branch.decision?.kind, 'battleCards');
    branch = send(reload(branch), 'r', { type: 'decision', discard: [] });
    assert.deepEqual(
      branch.players.map((p) => p.spice),
      settledSpice,
    );
    assert.deepEqual(
      branch.players.slice(0, 2).map((p) => p.leaders[0].deaths),
      settledDeaths,
    );
    assert.ok(branch.players[0].hand.some((c) => c.id === stone));
    assert.equal(
      branch.discard.some((c) => c.id === stone),
      false,
    );
    assert.deepEqual(inventory(branch), physicalInventory);
    remaining.push(branch.players[0].forces['arrakeen:10']);
  }
  assert.deepEqual(
    remaining.sort((a, b) => a - b),
    [1, 2, 3],
  );
});
