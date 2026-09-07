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
/** Transfer fixture cards from the actual deck; never duplicate another seat's hand. */
function setBattleHand(g: Game, id: string, ids: string[]) {
  const owner = g.players.find((p) => p.id === id)!;
  g.deck.push(...owner.hand);
  owner.hand = [];
  owner.hand = ids.map((cardId) => {
    assert.ok(
      !g.players.some((p) => p.hand.some((card) => card.id === cardId)),
      `Fixture card ${cardId} is already held by another seat`,
    );
    const index = g.deck.findIndex((card) => card.id === cardId);
    assert.ok(
      index >= 0,
      `Physical fixture card ${cardId} must be in the deck`,
    );
    return g.deck.splice(index, 1)[0];
  });
}
function fixture(spectator = false) {
  let g = createGame('KWISATZ2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  if (spectator) joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  g.advanced = true;
  g.phase = 6;
  g.order = ['e', 'a', ...(spectator ? ['g'] : [])];
  g.active = 'e';
  g.storm = 18;
  g.players[0].battleLosses = 7;
  g.players[1].reserves = 10;
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players.forEach((p) => {
    g.deck.push(...p.hand);
    p.hand = [];
    p.traitors = [];
  });
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
function prepared(state: Game, territory = 'arrakeen') {
  let g = applyAction(state, state.active!, {
    type: 'chooseBattle',
    territory,
    target: state.active === 'a' ? 'e' : 'a',
  });
  g = allow(g);
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function plans(state: Game, atreides: object = {}, emperor: object = {}) {
  let g = applyAction(state, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    kwisatz: true,
    ...atreides,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    ...emperor,
  });
  return g;
}
function resolve(state: Game) {
  let g = state;
  for (const id of ['a', 'e'])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  while (g.decision) {
    const d = g.decision;
    g = applyAction(
      g,
      d.player,
      d.kind === 'battleLosses'
        ? { type: 'decision', choice: 0 }
        : { type: 'decision', discard: [] },
    );
  }
  return g;
}
void test('KH adds two to a surviving leader while its loss counter and sealed selection stay private', () => {
  let g = prepared(fixture());
  assert.equal(viewGame(g, 'a').players[0].kwisatz?.losses, 7);
  assert.equal(viewGame(g, 'e').players[0].kwisatz, undefined);
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    kwisatz: true,
  });
  assert.equal(viewGame(g, 'e').battle!.plans.a, undefined);
  assert.equal(viewGame(g, 'a').battle!.plans.a.kwisatz, true);
  g = applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  assert.equal(viewGame(g, 'e').battle!.plans.a.kwisatz, true);
  g = resolve(g);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[0].kwisatz?.usedAt, 'arrakeen');
  assert.ok(g.log.some((l) => l.text.includes('(6–7')));
});
void test('KH requires seven battle losses, a leader or hero, and the same territory during a turn', () => {
  let g = fixture();
  g.players[0].battleLosses = 6;
  g = prepared(g);
  const action = {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    kwisatz: true,
  };
  assert.throws(() => applyAction(g, 'a', action), /not available/);
  g.players[0].battleLosses = 7;
  g.players[0].kwisatz = { dead: false, usedAt: 'carthag' };
  assert.throws(() => applyAction(g, 'a', action), /not available/);
  g.players[0].kwisatz!.usedAt = 'arrakeen';
  assert.equal(applyAction(g, 'a', action).battle!.plans.a.kwisatz, true);
  assert.throws(
    () => applyAction(g, 'a', { ...action, leader: null }),
    /must accompany/,
  );
  const hero = baseDeck().find((c) => c.kind === 'hero')!;
  setBattleHand(g, 'a', [hero.id]);
  g = resolve(plans(g, { leader: hero.id }, { dial: 0, leader: 'emperor-4' }));
  assert.ok(g.log.some((l) => l.text.includes('(2–2')));
  assert.equal(g.players[0].kwisatz!.dead, false);
});
void test('a killed accompanying leader gives no KH bonus and does not kill KH or increase the bounty', () => {
  let g = fixture();
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  setBattleHand(g, 'e', [poison.id]);
  const before = g.players[1].spice;
  g = resolve(plans(prepared(g), {}, { weapon: poison.id }));
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].kwisatz?.dead, false);
  assert.equal(g.players[1].spice, before + 5 + 2); // leader bounty + city income
  assert.ok(g.log.some((l) => l.text.includes('(6–0')));
});
void test('KH prevents traitor calls and Karama can remove both benefits before either plan is sealed', () => {
  let g = fixture();
  g.players[1].traitors = ['atreides-0'];
  const protectedPlan = plans(prepared(g));
  assert.throws(
    () => applyAction(protectedPlan, 'e', { type: 'traitorCall', call: true }),
    /prevents/,
  );
  g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  g = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  assert.equal(g.response?.kind, 'kwisatz');
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = applyAction(g, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', { type: 'decision', decline: true });
  assert.throws(() => plans(g), /not available/);
  g = plans(g, { kwisatz: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: true });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[0].kwisatz, undefined);
});
void test('only an actual lasgun/shield explosion kills a played KH; a traitor win overrides the explosion', () => {
  let g = fixture();
  const shield = baseDeck().find((c) => c.kind === 'shield')!,
    lasgun = baseDeck().find((c) => c.kind === 'lasgun')!;
  setBattleHand(g, 'a', [shield.id]);
  setBattleHand(g, 'e', [lasgun.id]);
  g.players[0].traitors = ['emperor-0'];
  g = plans(prepared(g), { defense: shield.id }, { weapon: lasgun.id });
  const explosion = resolve(g);
  assert.equal(explosion.players[0].kwisatz?.dead, true);
  assert.equal(explosion.players[0].tanks, 10);
  g = applyAction(g, 'a', { type: 'traitorCall', call: true });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  assert.equal(g.players[0].kwisatz?.dead, false);
  assert.equal(g.players[0].tanks, 0);
});
void test('KH revival shares the leader quota, waits for the Atreides cycle, and never blocks ordinary leaders', () => {
  let g = fixture();
  g.phase = 4;
  g.players[0].kwisatz = { dead: true, revivalCycle: 1 };
  assert.throws(() => applyAction(g, 'a', { type: 'reviveKwisatz' }), /cycle/);
  g.players[0].leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  const before = g.players[0].spice;
  const leaderFirst = applyAction(g, 'a', {
    type: 'reviveLeader',
    leader: 'atreides-0',
  });
  assert.equal(leaderFirst.players[0].leaders[0].dead, false);
  assert.throws(
    () => applyAction(leaderFirst, 'a', { type: 'reviveKwisatz' }),
    /one leader/,
  );
  g = applyAction(g, 'a', { type: 'reviveKwisatz' });
  assert.equal(g.players[0].spice, before - 2);
  assert.equal(g.players[0].kwisatz!.dead, false);
  assert.throws(
    () => applyAction(g, 'a', { type: 'reviveLeader', leader: 'atreides-0' }),
    /one leader/,
  );
  g.players[0].leaderRevived = false;
  g.players[0].kwisatz!.dead = true;
  assert.throws(() => applyAction(g, 'a', { type: 'reviveKwisatz' }), /cycle/);
  g.players[0].leaders.forEach((l) => (l.deaths = 2));
  g = applyAction(g, 'a', { type: 'reviveKwisatz' });
  assert.equal(g.players[0].kwisatz!.dead, false);
});
void test('Ghola can revive KH without waiting for the normal leader cycle or spending its quota', () => {
  let g = fixture();
  g.phase = 4;
  g.players[0].kwisatz = { dead: true };
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  placeFixtureHand(g, 0, [ghola]);
  const before = g.players[0].spice;
  g = applyAction(g, 'a', { type: 'card', card: ghola.id, leader: 'kwisatz' });
  assert.equal(g.players[0].kwisatz!.dead, false);
  assert.equal(g.players[0].leaderRevived, false);
  assert.equal(g.players[0].spice, before);
  assert.equal(g.players[0].hand.length, 0);
});
void test('advanced stronghold income stacks by occupied stronghold and is paid once independently of gathered spice', () => {
  for (const advanced of [false, true]) {
    let g = fixture();
    g.advanced = advanced;
    g.phase = 5;
    g.active = 'e';
    g.players[1].forces = {};
    g.players[1].reserves = 20;
    g.players[0].forces = {
      'arrakeen:10': 1,
      'carthag:11': 1,
      'tueks_sietch:5': 1,
      'red_chasm:7': 1,
    };
    g.players[0].reserves = 16;
    g.spice = { 'red_chasm:7': 8 };
    const before = g.players[0].spice;
    g = applyAction(g, 'e', { type: 'endMovement' });
    g = applyAction(g, 'a', { type: 'endMovement' });
    assert.equal(g.phase, 7);
    assert.equal(g.players[0].spice, before + 3 + (advanced ? 5 : 0));
    assert.equal(g.spice['red_chasm:7'], 5);
  }
});

void test('the seventh battle loss unlocks KH immediately for another battle in the same turn', () => {
  let g = fixture();
  g.players[0].battleLosses = 6;
  g.players[0].forces = { 'arrakeen:10': 1, 'carthag:11': 9 };
  g.players[1].forces = { 'arrakeen:10': 10, 'carthag:11': 1 };
  g.players[1].reserves = 9;
  g = resolve(
    plans(prepared(g), {
      kwisatz: false,
      leader: 'atreides-4',
      dial: 1,
      support: 1,
    }),
  );
  assert.equal(g.players[0].battleLosses, 7);
  assert.equal(g.phase, 6);
  assert.equal(viewGame(g, 'a').players[0].kwisatz?.active, true);
  g = prepared(g, 'carthag');
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    kwisatz: true,
  });
  assert.equal(g.battle!.plans.a.kwisatz, true);
});
void test('KH territory restriction resets with the next turn and a cancellation window leaks no activation status', () => {
  let g = fixture();
  const before = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  g.players[0].battleLosses = 0;
  const inactive = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  // Independent battles have different public event IDs, unrelated to KH state.
  inactive.battle!.event = before.battle!.event;
  assert.deepEqual(viewGame(before, 'e'), viewGame(inactive, 'e'));
  g.players[0].kwisatz = { dead: false, usedAt: 'arrakeen' };
  g.phase = 8;
  g.ready = [];
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.turn, 2);
  assert.equal(g.players[0].kwisatz!.usedAt, undefined);
});

void test('revealed plans provide played card labels to every seat without revealing unplayed cards', () => {
  let g = fixture(true);
  const shield = baseDeck().find((c) => c.kind === 'shield')!,
    lasgun = baseDeck().find((c) => c.kind === 'lasgun')!,
    poison = baseDeck().find((c) => c.kind === 'poison')!;
  setBattleHand(g, 'a', [shield.id, poison.id]);
  setBattleHand(g, 'e', [lasgun.id]);
  g = prepared(g);
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    defense: shield.id,
    kwisatz: true,
  });
  assert.deepEqual(viewGame(g, 'e').battle!.cards, []);
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    weapon: lasgun.id,
  });
  const cards = viewGame(g, 'g').battle!.cards;
  assert.deepEqual(viewGame(g, 'e').battle!.cards, cards);
  assert.deepEqual(viewGame(g, 'a').battle!.cards, cards);
  assert.deepEqual(
    new Set(cards.map((c) => c.id)),
    new Set([shield.id, lasgun.id]),
  );
  assert.equal(viewGame(g, 'e').players[0].hand, undefined);
});
