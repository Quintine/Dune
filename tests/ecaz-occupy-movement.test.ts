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
import { quoteAdvisorBattleOffer } from '../game/movement-phase-quote';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function army(g: Game, id: string, forces: Record<string, number>) {
  const p = player(g, id);
  p.forces = forces;
  p.reserves = 20 - p.tanks - Object.values(forces).reduce((n, x) => n + x, 0);
}
function fixture(actor = 'ec') {
  const g = createGame('OCCUPYMOVE', newPlayer('ec', 'Ecaz', 'ecaz'), false, [
    'ecaz',
  ]);
  g.players.push(
    newPlayer('al', 'Ally', 'emperor'),
    newPlayer('en', 'Enemy', 'harkonnen'),
    newPlayer('x', 'Later', 'ixians'),
  );
  const partner = actor === 'ec' ? 'al' : 'ec';
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: actor,
    order: [partner, actor, 'en', 'x'],
    movementRemaining: [actor, 'en', 'x'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      elites: undefined,
      reserves: 20,
      tanks: 0,
      spice: 10,
      traitors: [],
      traitorChoices: [],
      shipped: false,
      moved: 0,
    });
  player(g, 'ec').ally = 'al';
  player(g, 'al').ally = 'ec';
  player(g, 'ec').allySinceTurn = player(g, 'al').allySinceTurn = 1;
  return g;
}
function conserved(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((n, x) => n + x, 0),
      20,
    );
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(new Set(cards).size, cards.length);
}
function hold(g: Game, id: string, name: string) {
  const at = g.deck.findIndex((c) => c.name === name);
  assert.ok(at >= 0, name);
  const c = g.deck.splice(at, 1)[0];
  player(g, id).hand.push(c);
  return c.id;
}
const destination = { territory: 'arrakeen', sector: 10 };
void test('BG can prepare established advisors beside Ecaz before movement, while ordinary allied and current-turn locked groups remain excluded', () => {
  const g = fixture('al');
  g.advanced = true;
  player(g, 'al').faction = 'beneGesserit';
  for (const id of ['ec', 'al', 'en']) army(g, id, { 'arrakeen:10': 1 });
  player(g, 'al').advisors = { arrakeen: {} };
  const before = structuredClone(g);
  const offer = quoteAdvisorBattleOffer(g);
  assert.deepEqual(g, before);
  assert.deepEqual(offer.territories, ['arrakeen']);
  g.active = null;
  g.decision = {
    kind: 'advisorBattle',
    player: 'al',
    territories: offer.territories,
  };
  const done = applyAction(g, 'al', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
  });
  assert.equal(player(done, 'al').advisors?.arrakeen, undefined);
  assert.equal(player(done, 'al').forces['arrakeen:10'], 1);
  assert.equal(done.phase, 5);
  conserved(done);
  const locked = structuredClone(before);
  player(locked, 'al').advisors!.arrakeen.lockedTurn = locked.turn;
  assert.deepEqual(quoteAdvisorBattleOffer(locked).territories, []);
  const ordinary = structuredClone(before);
  player(ordinary, 'ec').faction = 'atreides';
  assert.deepEqual(quoteAdvisorBattleOffer(ordinary).territories, []);
});
for (const actor of ['ec', 'al']) {
  const partner = actor === 'ec' ? 'al' : 'ec';
  void test(`${actor} ships and moves into its partner plus an enemy as two occupying factions`, () => {
    const initial = fixture(actor);
    army(initial, partner, { 'arrakeen:10': 2 });
    army(initial, 'en', { 'arrakeen:10': 1 });
    army(initial, actor, { 'imperial_basin:10': 2 });
    const before = structuredClone(initial);
    let g = applyAction(initial, actor, {
      type: 'ship',
      amount: 2,
      ...destination,
    });
    assert.deepEqual(initial, before);
    assert.equal(player(g, actor).spice, 8);
    assert.equal(player(g, actor).reserves, 16);
    g = applyAction(JSON.parse(JSON.stringify(g)) as Game, actor, {
      type: 'move',
      forces: { 'imperial_basin:10': 2 },
      ...destination,
    });
    assert.equal(player(g, actor).forces['arrakeen:10'], 4);
    assert.equal(player(g, partner).forces['arrakeen:10'], 2);
    assert.equal(player(g, 'en').forces['arrakeen:10'], 1);
    assert.equal(player(g, actor).moved, 1);
    assert.equal(g.phase, 5);
    assert.equal(g.battle, null);
    conserved(g);
  });
  void test(`${actor} finishes its turn without destroying an older Ecaz coalition or starting combat`, () => {
    const g = fixture(actor);
    army(g, actor, { 'arrakeen:10': 2 });
    army(g, partner, { 'arrakeen:10': 3 });
    const done = applyAction(g, actor, { type: 'endMovement' });
    assert.deepEqual(player(done, actor).forces, player(g, actor).forces);
    assert.deepEqual(player(done, partner).forces, player(g, partner).forces);
    assert.equal(player(done, actor).tanks, 0);
    assert.equal(done.active, 'en');
    assert.equal(done.phase, 5);
    assert.deepEqual(done.movementRemaining, ['en', 'x']);
    conserved(done);
  });
}
void test('ordinary non-Ecaz allies still cannot enter together and still incur the existing departure penalty', () => {
  const g = fixture();
  player(g, 'ec').faction = 'atreides';
  army(g, 'al', { 'arrakeen:10': 1 });
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'ec', { type: 'ship', amount: 1, ...destination }),
    /occupied by your ally/,
  );
  assert.deepEqual(g, before);
  army(g, 'ec', { 'arrakeen:10': 2 });
  const done = applyAction(g, 'ec', { type: 'endMovement' });
  assert.deepEqual(player(done, 'ec').forces, {});
  assert.equal(player(done, 'ec').tanks, 2);
  assert.equal(player(done, 'al').forces['arrakeen:10'], 1);
  assert.equal(done.phase, 5);
  conserved(done);
});
void test('a third unrelated side is rejected for shipment and movement before any payment or force change', () => {
  const g = fixture();
  for (const id of ['ec', 'al', 'en']) army(g, id, { 'arrakeen:10': 1 });
  army(g, 'x', { 'imperial_basin:10': 1 });
  g.active = 'x';
  g.order = ['ec', 'al', 'x', 'en'];
  g.movementRemaining = ['x', 'en'];
  const before = structuredClone(g);
  for (const action of [
    { type: 'ship', amount: 1, ...destination },
    { type: 'move', forces: { 'imperial_basin:10': 1 }, ...destination },
  ])
    assert.throws(
      () => applyAction(g, 'x', action),
      /stronghold|occupying factions/,
    );
  assert.deepEqual(g, before);
});
void test('an unrelated player can challenge the Ecaz pair as the second side through a formerly blocked stronghold path', () => {
  const g = fixture();
  army(g, 'ec', { 'arrakeen:10': 1 });
  army(g, 'al', { 'arrakeen:10': 1 });
  army(g, 'en', { 'imperial_basin:10': 2 });
  g.active = 'en';
  g.movementRemaining = ['en', 'x'];
  const done = applyAction(g, 'en', {
    type: 'move',
    forces: { 'imperial_basin:10': 2 },
    ...destination,
  });
  assert.equal(player(done, 'en').forces['arrakeen:10'], 2);
  assert.equal(done.phase, 5);
  conserved(done);
});
void test('advisors enter without creating another occupying side while both fighter sides remain', () => {
  const g = fixture();
  g.advanced = true;
  player(g, 'x').faction = 'beneGesserit';
  for (const id of ['ec', 'al']) army(g, id, { 'arrakeen:10': 1 });
  army(g, 'en', { 'arrakeen:10': 1, 'imperial_basin:10': 1 });
  army(g, 'x', { 'imperial_basin:10': 1, 'arrakeen:10': 1 });
  player(g, 'x').advisors = { imperial_basin: {}, arrakeen: {} };
  g.active = 'x';
  g.order = ['ec', 'al', 'x', 'en'];
  g.movementRemaining = ['x', 'en'];
  const done = applyAction(g, 'x', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    ...destination,
  });
  assert.equal(player(done, 'x').forces['arrakeen:10'], 2);
  assert.ok(player(done, 'x').advisors?.arrakeen);
  assert.equal(player(done, 'x').advisors?.arrakeen.lockedTurn, undefined);
  assert.equal(done.phase, 5);
  conserved(done);
});
for (const value of [0, 3, 5] as const)
  void test(`a concealed ${value} No-Field counts as Ecaz's allied presence without revealing or spending its reserve forces`, () => {
    const g = fixture();
    player(g, 'al').faction = 'richese';
    const state = createRicheseNoField([
      'marker-zero',
      'marker-three',
      'marker-five',
    ]);
    const token = state.tokens.find((t) => t.value === value)!;
    player(g, 'al').noField = deployRicheseNoField(state, {
      tokenId: token.id,
      controller: 'al',
      location: destination,
    });
    player(g, 'al').noFieldEvent = 'private-marker-source';
    // This is the movement after Ecaz's ordinary shipment; no new allied
    // No-Field offer is due before that already-spent shipment.
    player(g, 'ec').shipped = true;
    army(g, 'en', { 'arrakeen:10': 1 });
    army(g, 'ec', { 'imperial_basin:10': 1 });
    const before = structuredClone(player(g, 'al').noField);
    const done = applyAction(g, 'ec', {
      type: 'move',
      forces: { 'imperial_basin:10': 1 },
      ...destination,
    });
    assert.deepEqual(player(done, 'al').noField, before);
    assert.equal(player(done, 'al').reserves, 20);
    assert.deepEqual(player(done, 'al').forces, {});
    assert.equal(player(done, 'ec').forces['arrakeen:10'], 1);
    assert.equal(done.phase, 5);
    conserved(done);
  });
for (const level of DIFFICULTIES)
  void test(`${level} enumerates legal coalition destinations and retains atomic retries after a rejected third side`, () => {
    const g = fixture();
    army(g, 'al', { 'arrakeen:10': 1 });
    army(g, 'en', { 'arrakeen:10': 1 });
    army(g, 'ec', { 'imperial_basin:10': 3 });
    const v = viewGame(g, 'ec');
    v.players.find((p) => p.id === 'ec')!.bot = level;
    const before = structuredClone(v);
    const actions = botActions(v);
    assert.deepEqual(v, before);
    const move = actions.find(
      (a) => a.type === 'move' && a.territory === 'arrakeen',
    );
    assert.ok(
      move,
      'co-occupied targets survive legality filtering and candidate truncation',
    );
    for (const a of actions.filter((a) => ['move', 'ship'].includes(a.type)))
      assert.doesNotThrow(() => applyAction(g, 'ec', a));
    const blocked = structuredClone(g);
    // A later current position has two independent defenders after the
    // alliance ended. Keep the fortress itself valid; Ecaz would be third.
    player(blocked, 'ec').ally = null;
    player(blocked, 'al').ally = null;
    const snapshot = structuredClone(blocked);
    assert.throws(() => applyAction(blocked, 'ec', move));
    assert.deepEqual(blocked, snapshot);
    const retry = viewGame(blocked, 'ec');
    retry.players.find((p) => p.id === 'ec')!.bot = level;
    const alternatives = botActions(retry).filter((a) =>
      ['move', 'ship'].includes(a.type),
    );
    assert.ok(alternatives.length);
    assert.ok(alternatives.every((a) => a.territory !== 'arrakeen'));
    for (const a of alternatives)
      assert.doesNotThrow(() => applyAction(blocked, 'ec', a));
  });

void test('BG may request fighters beside its Ecaz ally, but an accompaniment lock still prevents that request', () => {
  const g = fixture('al');
  g.advanced = true;
  player(g, 'al').faction = 'beneGesserit';
  army(g, 'al', { 'imperial_basin:10': 1 });
  army(g, 'ec', { 'imperial_basin:10': 1, 'arrakeen:10': 1 });
  army(g, 'en', { 'arrakeen:10': 1 });
  player(g, 'al').advisors = { imperial_basin: {} };
  const action = {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    ...destination,
    fighters: true,
  };
  const done = applyAction(g, 'al', action);
  assert.equal(player(done, 'al').forces['arrakeen:10'], 1);
  assert.equal(player(done, 'al').advisors?.arrakeen, undefined);
  assert.equal(done.phase, 5);
  conserved(done);
  const locked = structuredClone(g);
  player(locked, 'al').advisors!.imperial_basin.lockedTurn = g.turn;
  const before = structuredClone(locked);
  assert.throws(
    () => applyAction(locked, 'al', action),
    /advisor|flip|turn|fighter/i,
  );
  assert.deepEqual(locked, before);
});

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} cancellation of a real Baliset declaration resumes movement into the Ecaz ally plus CHOAM`, () => {
    let g = fixture();
    g.advanced = true;
    player(g, 'en').faction = 'choam';
    player(g, 'x').faction = 'beneGesserit';
    army(g, 'x', { 'polar_sink:0': 20 });
    army(g, 'ec', { 'imperial_basin:10': 2 });
    army(g, 'al', { 'arrakeen:10': 1 });
    army(g, 'en', { 'arrakeen:10': 1 });
    const baliset = hold(g, 'en', 'Baliset');
    const canceler = form === 'printed' ? 'ec' : 'x';
    const card = hold(
      g,
      canceler,
      form === 'printed' ? 'Karama' : 'Jubba Cloak',
    );
    g = applyAction(g, 'ec', {
      type: 'move',
      forces: { 'imperial_basin:10': 2 },
      ...destination,
    });
    assert.equal(g.decision?.kind, 'choamMovement');
    g = applyAction(g, 'en', {
      type: 'card',
      card: baliset,
      mode: 'choam',
      target: 'ec',
      territory: 'arrakeen',
    });
    assert.equal(g.response?.kind, 'choamWorthless');
    g = applyAction(JSON.parse(JSON.stringify(g)) as Game, canceler, {
      type: 'card',
      card,
      mode: 'cancel',
    });
    assert.equal(g.pendingChoamMove, null);
    assert.equal(player(g, 'ec').forces['arrakeen:10'], 2);
    assert.equal(player(g, 'ec').moved, 1);
    assert.equal(player(g, 'al').forces['arrakeen:10'], 1);
    assert.equal(player(g, 'en').forces['arrakeen:10'], 1);
    assert.ok(player(g, 'en').hand.some((c) => c.id === baliset));
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
    assert.equal(g.phase, 5);
    assert.equal(g.active, 'ec');
    conserved(g);
  });
