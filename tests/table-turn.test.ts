import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck } from '../game/cards';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { tableActionOwner } from '../game/table-turn';

function battle(advanced = false) {
  let g = createGame(
    'TURNUITEST',
    newPlayer('f', 'Fremen support QA', 'fremen'),
    advanced,
  );
  g.players.push(
    newPlayer('b', 'Sisterhood QA', 'beneGesserit'),
    newPlayer('a', 'Atreides QA', 'atreides'),
    newPlayer('g', 'Guild QA', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 6,
    storm: 18,
    active: 'f',
    order: ['f', 'b', 'a', 'g'],
    deck: baseDeck(),
    discard: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.traitors = [];
    p.forces = ['f', 'b'].includes(p.id) ? { 'red_chasm:7': 3 } : {};
    p.reserves = ['f', 'b'].includes(p.id) ? 17 : 20;
  }
  g.players[0].ally = 'a';
  g.players[2].ally = 'f';
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  const karama = g.deck.splice(index, 1)[0];
  g.players[3].hand.push(karama);
  g = applyAction(g, 'f', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'b',
  });
  g = allow(g);
  return { g, karama };
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 20; i++) {
    const owner = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(owner);
    g = applyAction(g, owner.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function owners(g: Game) {
  return g.players.map((p) => tableActionOwner(viewGame(g, p.id)));
}
void test('the banner and highlighted seat select the real defending Voice owner, not the battle attacker', () => {
  const { g } = battle();
  assert.equal(g.active, 'f');
  assert.deepEqual(g.battle!.preparation, {
    kind: 'voice',
    owner: 'b',
    beneficiary: 'b',
  });
  assert.deepEqual(owners(g), ['b', 'b', 'b', 'b']);
  const own = viewGame(g, 'b');
  assert.equal(
    own.players.find((p) => p.id === tableActionOwner(own))!.name,
    'Sisterhood QA',
  );
});
void test('actual Voice and Prescience response windows are neutral, then ownership follows the provider and responding opponent', () => {
  let { g } = battle();
  g = applyAction(g, 'b', { type: 'voice', kind: 'poison', must: false });
  assert.equal(g.battle!.preparation?.owner, 'a');
  assert.deepEqual(owners(g), [null, null, null, null]);
  g = allow(g);
  assert.deepEqual(owners(g), ['a', 'a', 'a', 'a']);
  g = applyAction(g, 'a', { type: 'prescience', field: 'leader' });
  assert.equal(g.battle!.preparation?.owner, 'b');
  assert.deepEqual(owners(g), [null, null, null, null]);
  g = allow(g);
  assert.deepEqual(owners(g), ['b', 'b', 'b', 'b']);
  g = applyAction(g, 'b', {
    type: 'prescienceAnswer',
    value: g.players[1].leaders[0].id,
  });
  assert.equal(g.battle!.preparation, undefined);
  assert.deepEqual(owners(g), [null, null, null, null]);
});
void test('canceling the actual Voice keeps the next Prescience owner visible across JSON reload', () => {
  const f = battle();
  let g = applyAction(f.g, 'b', { type: 'voice', kind: 'poison', must: false });
  g = applyAction(g, 'g', { type: 'card', card: f.karama.id, mode: 'cancel' });
  g = JSON.parse(JSON.stringify(g)) as Game;
  assert.equal(g.battle!.voice, undefined);
  assert.equal(g.battle!.preparation?.kind, 'prescience');
  assert.deepEqual(owners(g), ['a', 'a', 'a', 'a']);
});
void test('the actual special full-plan decision takes ownership before the stale phase-active seat', () => {
  let { g } = battle(true);
  g = applyAction(g, 'b', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  assert.equal(g.active, 'f');
  assert.deepEqual(g.decision, { kind: 'fullPlanOffer', player: 'a' });
  assert.deepEqual(owners(g), ['a', 'a', 'a', 'a']);
});
void test('higher-priority interruptions suppress an underlying single-seat owner and explicit decisions precede preparation', () => {
  const { g } = battle(),
    view = viewGame(g, 'f');
  for (const patch of [
    { automaticContinuationPending: true },
    { phaseOpening: { initialize: false, passed: [] } },
    {
      truthtrance: { stage: 'priority', queue: [], passed: [], question: null },
    },
    { response: { kind: 'voice', owner: 'b', passed: [] } },
  ])
    assert.equal(tableActionOwner({ ...view, ...patch } as typeof view), null);
  assert.equal(
    tableActionOwner({
      ...view,
      decision: { kind: 'fullPlanOffer', player: 'a' },
    }),
    'a',
  );
  for (const status of ['lobby', 'setup', 'finished'] as const)
    assert.equal(tableActionOwner({ ...view, status }), null);
  assert.equal(
    tableActionOwner({
      ...view,
      active: 'absent',
      battle: null,
      decision: null,
    }),
    null,
  );
});
void test('owner selection is identical across private views and does not depend on hidden hands or traitors', () => {
  const { g } = battle();
  const expected = owners(g);
  const changed = structuredClone(g),
    card = changed.deck.pop()!;
  changed.players[0].hand.push(card);
  changed.players[0].traitors = [changed.players[3].leaders[0].id];
  assert.deepEqual(owners(changed), expected);
  for (const p of changed.players) {
    const v = viewGame(changed, p.id);
    if (p.id !== 'f') assert.equal(v.players[0].hand, undefined);
    assert.equal(tableActionOwner(v), 'b');
  }
});
void test('real simultaneous plans and traitor votes have no sole owner until exactly one participant remains', () => {
  let { g } = battle();
  g = applyAction(g, 'b', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  assert.deepEqual(owners(g), [null, null, null, null]);
  g = applyAction(g, 'f', {
    type: 'battlePlan',
    leader: g.players[0].leaders[0].id,
    dial: 0,
    support: 0,
  });
  assert.deepEqual(owners(g), ['b', 'b', 'b', 'b']);
  g = applyAction(g, 'b', {
    type: 'battlePlan',
    leader: g.players[1].leaders[0].id,
    dial: 0,
    support: 0,
  });
  assert.equal(g.battle!.revealed, true);
  assert.deepEqual(owners(g), [null, null, null, null]);
  g = applyAction(g, 'f', { type: 'traitorCall', call: false });
  assert.deepEqual(owners(g), ['b', 'b', 'b', 'b']);
});
void test('full-plan prescience names its publicly selected target before either ordinary plan can be sealed', () => {
  const f = battle(true);
  let g = f.g;
  // Keep this scenario's card physically unique while placing it in the
  // eligible provider's hand before its actual special-power declaration.
  g.players[3].hand = [];
  g.players[2].hand.push(f.karama);
  g = applyAction(g, 'b', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', {
    type: 'card',
    card: f.karama.id,
    mode: 'special',
    target: 'b',
  });
  assert.deepEqual(g.battle!.fullPlan, { owner: 'a', target: 'b' });
  assert.deepEqual(owners(g), ['b', 'b', 'b', 'b']);
});
