import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
function fixture() {
  let g = createGame('CAPTURE2', newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'h', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.advanced = true;
  g.phase = 6;
  g.active = 'h';
  g.order = ['h', 'e', 'g'];
  g.storm = 18;
  g.players[0].forces = { 'red_chasm:7': 10 };
  g.players[1].forces = { 'red_chasm:7': 10 };
  g.players[1].reserves = 10;
  g.players.forEach((p) => {
    p.hand = [];
    p.traitors = [];
  });
  g.players[1].leaders.slice(2).forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  placeFixtureHand(g, 0, [baseDeck().find((c) => c.kind === 'poison')!]);
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function battle(
  state: Game,
  hl = 'harkonnen-0',
  el = 'emperor-0',
  weapon?: string,
) {
  let g = applyAction(state, 'h', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = applyAction(g, 'h', {
    type: 'battlePlan',
    dial: 0,
    leader: hl,
    weapon: weapon ?? null,
  });
  return applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: el });
}
function resolve(state: Game, emperorTraitor = false) {
  let g = applyAction(state, 'h', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: emperorTraitor });
  while (
    g.decision?.kind === 'battleLosses' ||
    g.decision?.kind === 'battleCards'
  ) {
    g = applyAction(
      g,
      g.decision.player,
      g.decision.kind === 'battleLosses'
        ? { type: 'decision', choice: 0 }
        : { type: 'decision', discard: [] },
    );
  }
  return g;
}
function offer() {
  const g = fixture();
  return resolve(battle(g, undefined, undefined, g.players[0].hand[0].id));
}
function capture(state = offer()) {
  return allow(applyAction(state, 'h', { type: 'decision', accept: true }));
}
function keep() {
  return applyAction(capture(), 'h', { type: 'decision', mode: 'keep' });
}
function nextBattle(state: Game) {
  const g = structuredClone(state);
  g.phase = 6;
  g.active = 'h';
  g.ready = [];
  g.players[1].tanks = 0;
  g.players[1].forces = { 'red_chasm:7': 10 };
  g.players[1].leaders[2].dead = false;
  g.players[0].hand = [];
  return g;
}
void test('capture follows casualties and cards, offers a cancellation window, and randomly selects only eligible survivors', () => {
  let g = offer();
  placeFixtureHand(g, 2, [baseDeck().find((c) => c.effect === 'karama')!]);
  assert.equal(g.decision?.kind, 'captureOffer');
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[1].capturedBy, undefined);
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', accept: true }),
    /pending decision/,
  );
  g = applyAction(g, 'h', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'capture');
  assert.equal(g.players[1].leaders[1].capturedBy, undefined);
  g = allow(g);
  assert.equal(g.decision?.kind, 'capturedLeader');
  assert.equal(
    g.decision?.kind === 'capturedLeader' && g.decision.leader,
    'emperor-1',
  );
  assert.equal(g.players[1].leaders[1].capturedBy, 'h');
  assert.equal(g.players[0].leaders.length, 5); // canonical ownership is unchanged
  assert.equal(viewGame(g, 'h').players[0].leaders.length, 6);
});
void test('capture identity and executed leader state are hidden from outsiders, with explicit owner/captor/Tleilaxu views', () => {
  const before = offer();
  let g = capture(before);
  const outsiderDecision = viewGame(g, 'g').decision;
  const ownerDecision = viewGame(g, 'e').decision;
  assert.equal(
    outsiderDecision?.kind === 'capturedLeader' && outsiderDecision.leader,
    '',
  );
  assert.equal(
    ownerDecision?.kind === 'capturedLeader' && ownerDecision.leader,
    'emperor-1',
  );
  assert.deepEqual(
    viewGame(g, 'g').players[1].leaders,
    viewGame(before, 'g').players[1].leaders,
  );
  const spice = g.players[0].spice;
  g = applyAction(g, 'h', { type: 'decision', mode: 'execute' });
  assert.equal(g.players[0].spice, spice + 2);
  assert.equal(g.players[1].leaders[1].dead, true);
  assert.equal(g.players[1].leaders[1].deaths, 2);
  assert.equal(viewGame(g, 'g').players[1].leaders[1].dead, false);
  assert.equal(viewGame(g, 'e').players[1].leaders[1].dead, true);
  assert.equal(viewGame(g, 'h').players[1].leaders[1].dead, true);
  g.players.push(newPlayer('t', 'Tleilaxu viewer', 'tleilaxu'));
  assert.equal(viewGame(g, 't').players[1].leaders[1].dead, true);
  assert.ok(g.log.every((l) => !l.text.includes('Captain Aramsham')));
});
void test('a capture may be declined or canceled without removing a leader, exposing identity or paying execution spice', () => {
  const g = offer();
  g.players[2].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const declined = applyAction(g, 'h', { type: 'decision', accept: false });
  assert.equal(declined.pendingCapture, null);
  assert.equal(declined.players[1].leaders[1].capturedBy, undefined);
  let pending = applyAction(g, 'h', { type: 'decision', accept: true });
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  placeFixtureHand(pending, 2, [karama]);
  pending = applyAction(pending, 'g', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(pending.decision, null);
  assert.equal(pending.pendingCapture, null);
  assert.equal(pending.players[1].leaders[1].capturedBy, undefined);
  assert.equal(pending.players[0].spice, g.players[0].spice);
});
void test('dead leaders and leaders used in a different territory cannot be captured', () => {
  const g = fixture();
  g.players[1].leaders[1].usedAt = 'arrakeen';
  const next = resolve(
    battle(g, undefined, undefined, g.players[0].hand[0].id),
  );
  assert.equal(next.decision, null);
  assert.equal(next.pendingCapture, null);
});
void test('the original owner cannot use a captive; a surviving captive returns after one battle and reveals only when plans reveal', () => {
  let g = nextBattle(keep());
  g = applyAction(g, 'h', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  assert.throws(
    () =>
      applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-1' }),
    /not available/,
  );
  g = applyAction(g, 'h', { type: 'battlePlan', dial: 0, leader: 'emperor-1' });
  assert.equal(viewGame(g, 'g').players[1].leaders[1].capturedBy, undefined);
  assert.equal(viewGame(g, 'g').battle!.plans.h, undefined);
  g = applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-2' });
  assert.equal(viewGame(g, 'g').players[1].leaders[1].capturedBy, 'h');
  g = resolve(g);
  assert.equal(g.players[1].leaders[1].capturedBy, undefined);
  assert.equal(g.players[1].leaders[1].dead, false);
  assert.equal(g.players[1].leaders[1].usedAt, 'red_chasm');
  assert.equal(
    viewGame(g, 'h').players[0].leaders.some((l) => l.id === 'emperor-1'),
    false,
  );
});
void test('a captive can be a traitor and its death goes to the original owner’s tanks', () => {
  let g = nextBattle(keep());
  g.players[1].traitors = ['emperor-1'];
  g = resolve(battle(g, 'emperor-1', 'emperor-2'), true);
  const captive = g.players[1].leaders[1];
  assert.equal(captive.dead, true);
  assert.equal(captive.deaths, 1);
  assert.equal(captive.capturedBy, undefined);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(viewGame(g, 'g').players[1].leaders[1].dead, true);
});
void test('losing the last living Harkonnen leader immediately returns all unused captives', () => {
  let g = nextBattle(keep());
  g.players[0].leaders.slice(1).forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  g.players[1].hand = [poison];
  g = applyAction(g, 'h', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = applyAction(g, 'h', {
    type: 'battlePlan',
    dial: 0,
    leader: 'harkonnen-0',
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-2',
    weapon: poison.id,
  });
  g = resolve(g);
  assert.equal(
    g.players[0].leaders.every((l) => l.dead),
    true,
  );
  assert.equal(g.players[1].leaders[1].capturedBy, undefined);
  assert.equal(g.players[1].leaders[1].dead, false);
});
void test('a captured fifth leader permits ordinary revival, while an executed face-down leader waits for the later cycle', () => {
  let g = keep();
  g.phase = 4;
  g = applyAction(g, 'e', { type: 'reviveLeader', leader: 'emperor-0' });
  assert.equal(g.players[1].leaders[0].dead, false);
  let executed = applyAction(capture(), 'h', {
    type: 'decision',
    mode: 'execute',
  });
  executed.phase = 4;
  assert.throws(
    () =>
      applyAction(executed, 'e', { type: 'reviveLeader', leader: 'emperor-1' }),
    /cycle/,
  );
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  placeFixtureHand(executed, 1, [ghola]);
  executed = applyAction(executed, 'e', {
    type: 'card',
    card: ghola.id,
    leader: 'emperor-1',
  });
  assert.equal(viewGame(executed, 'g').players[1].leaders[1].dead, false);
  assert.equal(executed.players[1].leaders[1].concealed, undefined);
});

void test('capture and execution privacy survives serialization, and living captives remain hidden from Tleilaxu', () => {
  let g = capture();
  g.players.push(newPlayer('t', 'Tleilaxu viewer', 'tleilaxu'));
  g.order.push('t');
  assert.equal(viewGame(g, 't').players[1].leaders[1].capturedBy, undefined);
  const restored = JSON.parse(JSON.stringify(g)) as Game;
  assert.deepEqual(
    JSON.parse(JSON.stringify(viewGame(restored, 'h'))),
    JSON.parse(JSON.stringify(viewGame(g, 'h'))),
  );
  assert.throws(
    () => applyAction(restored, 'e', { type: 'decision', mode: 'execute' }),
    /pending decision/,
  );
  g = applyAction(restored, 'h', { type: 'decision', mode: 'execute' });
  const after = JSON.parse(JSON.stringify(g)) as Game;
  assert.equal(viewGame(after, 't').players[1].leaders[1].dead, true);
  assert.equal(viewGame(after, 'g').players[1].leaders[1].dead, false);
});
void test('keeping a captive with no living native Harkonnen leaders returns it immediately', () => {
  let g = capture();
  g.players[0].leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  const before = g.players[0].spice;
  g = applyAction(g, 'h', { type: 'decision', mode: 'keep' });
  assert.equal(g.players[1].leaders[1].capturedBy, undefined);
  assert.equal(g.players[1].leaders[1].dead, false);
  assert.equal(g.players[0].spice, before);
});
void test('the losing battle leader is eligible for capture but its territorial restriction persists', () => {
  let g = fixture();
  g.players[0].hand = [];
  g.players[1].leaders[1].dead = true;
  g.players[1].leaders[1].deaths = 1;
  g = capture(resolve(battle(g)));
  assert.equal(
    g.decision?.kind === 'capturedLeader' && g.decision.leader,
    'emperor-0',
  );
  g = applyAction(g, 'h', { type: 'decision', mode: 'keep' });
  g = nextBattle(g);
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].forces = { 'arrakeen:10': 10 };
  g = applyAction(g, 'h', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  assert.throws(
    () =>
      applyAction(g, 'h', { type: 'battlePlan', dial: 0, leader: 'emperor-0' }),
    /not available/,
  );
});

void test('all native leaders captured opens a finite KH revival cycle without advancing repeated revival indefinitely', () => {
  let g = fixture();
  const atreides = newPlayer('a', 'Atreides', 'atreides');
  atreides.kwisatz = { dead: true, revivalCycle: 1 };
  atreides.battleLosses = 7;
  atreides.spice = 10;
  atreides.leaders.forEach((l) => (l.capturedBy = 'h'));
  g.players.push(atreides);
  g.phase = 4;
  g = applyAction(g, 'a', { type: 'reviveKwisatz' });
  const p = g.players.find((p) => p.id === 'a')!;
  assert.equal(p.revivalCycle, 1);
  assert.equal(p.kwisatz?.revivalCycle, 2);
  assert.equal(Number.isFinite(p.revivalCycle), true);
  p.kwisatz!.dead = true;
  p.leaderRevived = false;
  assert.throws(() => applyAction(g, 'a', { type: 'reviveKwisatz' }), /cycle/);
});
