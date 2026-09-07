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
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { type FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_STRONGHOLD } from '../game/board';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(opponent: FactionId = 'emperor') {
  const g = createGame('DUKE0001', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(newPlayer('e', 'Opponent', opponent));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['m', 'e'];
  g.active = 'e';
  g.movementRemaining = ['e'];
  g.dukeVidal = createDukeVidal();
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = { 'arrakeen:10': 3, 'carthag:11': 3 };
    p.reserves = 14;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
    p.traitorChoices = [];
  }
  return g;
}
const finishMovement = (g: Game) =>
  applyAction(g, 'e', { type: 'endMovement' });
function passResponses(state: Game) {
  let g = state;
  for (let step = 0; g.response && step < 20; step++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p, 'a pending response must have an eligible responder');
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null, 'response loop must finish within its bound');
  return g;
}
function acquire(g = fixture()) {
  const pending = finishMovement(g);
  assert.equal(
    pending.response,
    null,
    'unopposed acquisition settles automatically',
  );
  assert.equal(pending.dukeVidal!.controller, 'm');
  return reload(pending);
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before, 'rejected input must not change shared state');
}
function prepareBattle(g: Game, territory = 'arrakeen') {
  let state = applyAction(g, 'm', {
    type: 'chooseBattle',
    territory,
    target: 'e',
  });
  state = passResponses(state);
  for (let i = 0; state.battle?.preparation && i < 10; i++) {
    state = applyAction(state, state.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
    state = passResponses(state);
  }
  assert.equal(state.battle?.preparation ?? null, null);
  return state;
}
function fight(g: Game, poison = false) {
  let state = prepareBattle(g);
  state = applyAction(state, 'm', {
    type: 'battlePlan',
    dial: 0,
    leader: DUKE_VIDAL_ID,
  });
  state = applyAction(state, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: player(state, 'e').leaders.at(-1)!.id,
    ...(poison ? { weapon: player(state, 'e').hand[0].id } : {}),
  });
  state = applyAction(state, 'm', { type: 'traitorCall', call: false });
  state = applyAction(state, 'e', { type: 'traitorCall', call: false });
  return state;
}

void test('Duke acquisition waits for all movement, survives reload, and leaves native inventories intact', () => {
  const initial = fixture();
  const blocker = initial.deck.splice(
    initial.deck.findIndex((c) => c.effect === 'karama'),
    1,
  )[0];
  player(initial, 'e').hand = [blocker];
  initial.active = 'm';
  initial.movementRemaining = ['m', 'e'];
  const natives = initial.players.map((p) => structuredClone(p.leaders));
  const first = applyAction(initial, 'm', { type: 'endMovement' });
  assert.equal(first.phase, 5);
  assert.equal(first.response, null);
  assert.equal(first.dukeVidal!.controller, null);
  const pending = finishMovement(first);
  assert.equal(pending.response?.kind, 'moritaniDuke');
  assert.equal(pending.dukeVidal!.controller, null);
  reject(pending, 'm', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  const beforeViews = structuredClone(pending);
  for (const p of pending.players) viewGame(pending, p.id);
  assert.deepEqual(
    pending,
    beforeViews,
    'viewing an acquisition cannot settle it',
  );
  const gained = passResponses(reload(pending));
  assert.equal(gained.phase, 6);
  assert.equal(gained.dukeVidal!.controller, 'm');
  assert.equal(gained.dukeVidal!.source, 'moritani');
  assert.equal(gained.dukeVidal!.acquiredTurn, 2);
  assert.equal(gained.dukeAcquisitionTurn, 2);
  assert.deepEqual(
    gained.players.map((p) => p.leaders),
    natives,
  );
  assert.ok(gained.players.every((p) => !p.traitors.includes(DUKE_VIDAL_ID)));
  assert.ok(
    gained.players.every((p) => !p.traitorChoices.includes(DUKE_VIDAL_ID)),
  );
  for (const viewer of gained.players) {
    const view = viewGame(gained, viewer.id);
    assert.equal(
      view.players
        .flatMap((p) => p.leaders)
        .filter((l) => l.id === DUKE_VIDAL_ID).length,
      1,
    );
    const projected = view.players
      .find((p) => p.id === 'm')!
      .leaders.find((l) => l.id === DUKE_VIDAL_ID)!;
    assert.equal(projected.strength, 6);
    assert.equal(projected.faction, 'ecaz');
    assert.equal(projected.controller, 'm');
    assert.ok(view.allLeaders.some((l) => l.id === DUKE_VIDAL_ID));
  }
  reject(gained, 'e', { type: 'passResponse' });
});

void test('one stronghold, Ecaz opponents, allies and advisor-only presence do not qualify', () => {
  const one = fixture();
  player(one, 'e').forces = { 'arrakeen:10': 6 };
  const second = newPlayer('x', 'Third faction', 'atreides');
  second.forces = { 'arrakeen:10': 1 };
  one.players.push(second);
  one.order.push('x');
  const ecaz = fixture('ecaz');
  const allied = fixture();
  player(allied, 'm').ally = 'e';
  player(allied, 'e').ally = 'm';
  player(allied, 'm').allySinceTurn = allied.turn;
  player(allied, 'e').allySinceTurn = allied.turn;
  const advisors = fixture('beneGesserit');
  advisors.advanced = true;
  player(advisors, 'e').advisors = { arrakeen: {}, carthag: {} };
  for (const g of [one, ecaz, allied, advisors]) {
    const next = finishMovement(g);
    assert.notEqual(next.response?.kind, 'moritaniDuke');
    assert.equal(next.dukeVidal!.controller, null);
  }
});

void test('the mobile stronghold can supply a second distinct qualifying battle', () => {
  const g = fixture();
  g.mobileStronghold = { location: 'imperial_basin:10' };
  for (const p of g.players)
    p.forces = { 'arrakeen:10': 3, [`${MOBILE_STRONGHOLD}:0`]: 3 };
  const next = acquire(g);
  assert.equal(next.dukeVidal!.controller, 'm');
});

void test('Karama cancellation preserves the disc and cannot reopen acquisition this turn', () => {
  const g = fixture();
  const karama = g.deck.find((c) => c.effect === 'karama')!;
  g.deck = g.deck.filter((c) => c.id !== karama.id);
  player(g, 'e').hand = [karama];
  const pending = finishMovement(g);
  const canceled = applyAction(reload(pending), 'e', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(canceled.dukeVidal!.controller, null);
  assert.deepEqual(canceled.dukeVidal, pending.dukeVidal);
  assert.equal(canceled.dukeAcquisitionTurn, g.turn);
  assert.equal(canceled.phase, 6);
  assert.equal(canceled.response, null);
  assert.ok(canceled.discard.some((c) => c.id === karama.id));
  reject(canceled, 'e', { type: 'endMovement' });
});

void test('a full battle uses strength six then releases living Duke before another battle', () => {
  const gained = acquire();
  const native = structuredClone(player(gained, 'm').leaders);
  const done = fight(reload(gained));
  assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(done.dukeVidal!.leader.deaths, 0);
  assert.equal(done.dukeVidal!.controller, null);
  assert.equal(done.dukeVidal!.source, null);
  assert.equal(player(done, 'e').forces['arrakeen:10'] ?? 0, 0);
  assert.equal(player(done, 'm').forces['arrakeen:10'], 3);
  assert.deepEqual(player(done, 'm').leaders, native);
  const nextBattle = prepareBattle(reload(done), 'carthag');
  reject(nextBattle, 'm', {
    type: 'battlePlan',
    dial: 0,
    leader: DUKE_VIDAL_ID,
  });
  assert.equal(nextBattle.dukeAcquisitionTurn, 2);
});

void test('battle death keeps the shared disc in the Tanks and pays its six-strength bounty exactly once', () => {
  const initial = fixture();
  const poison = initial.deck.find((c) => c.kind === 'poison')!;
  initial.deck = initial.deck.filter((c) => c.id !== poison.id);
  player(initial, 'e').hand = [poison];
  const gained = acquire(initial);
  const done = fight(reload(gained), true);
  assert.equal(done.dukeVidal!.leader.dead, true);
  assert.equal(done.dukeVidal!.leader.deaths, 1);
  assert.equal(done.dukeVidal!.controller, null);
  assert.equal(player(done, 'e').spice, player(gained, 'e').spice + 6);
  assert.equal(player(done, 'm').leaders.filter((l) => l.dead).length, 0);
  assert.equal(reload(done).dukeVidal!.leader.dead, true);
  reject(done, 'e', { type: 'traitorCall', call: false });
});

void test('automatic advanced casualties consume Duke once and preserve custody through reload into the next battle', () => {
  const initial = fixture();
  initial.advanced = true;
  const gained = acquire(initial);
  const pending = fight(gained);
  assert.notEqual(pending.decision?.kind, 'battleLosses');
  assert.equal(pending.dukeVidal!.controller, null);
  assert.equal(pending.dukeVidal!.leader.dead, false);
  const before = structuredClone(pending.dukeVidal);
  const done = reload(pending);
  assert.deepEqual(done.dukeVidal, before);
  assert.equal(player(done, 'm').forces['arrakeen:10'], 3);
  assert.equal(player(done, 'e').tanks, 3);
  assert.equal(player(done, 'm').tanks, 0);
  reject(done, 'm', { type: 'decision', choice: 0 });
  const next = prepareBattle(done, 'carthag');
  reject(next, 'm', {
    type: 'battlePlan',
    dial: 0,
    leader: DUKE_VIDAL_ID,
  });
});

void test('unused Duke expires at turn end and a later eligible turn can acquire the same disc', () => {
  const gained = acquire();
  const mentat = reload(gained);
  mentat.phase = 8;
  mentat.active = null;
  mentat.ready = [];
  let next = mentat;
  for (const p of mentat.players)
    next = applyAction(next, p.id, { type: 'ready' });
  assert.equal(next.turn, 3);
  assert.equal(next.dukeVidal!.controller, null);
  assert.equal(next.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  const later = fixture();
  later.turn = 3;
  later.dukeVidal = next.dukeVidal;
  later.dukeAcquisitionTurn = gained.dukeAcquisitionTurn;
  const reacquired = acquire(reload(later));
  assert.equal(reacquired.dukeVidal!.controller, 'm');
  assert.equal(reacquired.dukeVidal!.acquiredTurn, 3);
  assert.equal(reacquired.dukeVidal!.leader.id, DUKE_VIDAL_ID);
});

void test('advanced Harkonnen configurations uniformly gate unresolved Duke capture before acquiring', () => {
  for (const hasCaptive of [false, true]) {
    const g = fixture('harkonnen');
    g.advanced = true;
    if (hasCaptive) {
      g.dukeVidal!.leader.capturedBy = 'e';
      g.dukeVidal!.leader.concealed = {
        captor: 'e',
        controller: 'm',
        dead: false,
        deaths: 0,
      };
    }
    const done = finishMovement(g);
    assert.notEqual(done.response?.kind, 'moritaniDuke');
    assert.equal(done.dukeVidal!.controller, null);
  }
});

void test('every AI profile can legally plan with its shared Duke when no native leader remains alive', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = acquire();
    player(g, 'm').bot = difficulty;
    for (const l of player(g, 'm').leaders) {
      l.dead = true;
      l.deaths = 1;
    }
    g = prepareBattle(g);
    const before = structuredClone(g);
    const choices = botActions(viewGame(g, 'm'));
    assert.deepEqual(g, before);
    const action = choices.find(
      (a) => a.type === 'battlePlan' && a.leader === DUKE_VIDAL_ID,
    );
    assert.ok(action, `${difficulty} must offer a battle plan`);
    assert.equal(action.leader, DUKE_VIDAL_ID, difficulty);
    const planned = applyAction(g, 'm', action);
    assert.equal(planned.battle!.plans.m.leader, DUKE_VIDAL_ID);
    assert.equal(
      planned.dukeVidal!.controller,
      'm',
      'sealing a plan must not consume Duke',
    );
  }
});
