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
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  createStrongholdCards,
  type StrongholdId,
} from '../game/stronghold-cards';
import { MOBILE_STRONGHOLD, MOBILE_LOCATION, territory } from '../game/board';
const key = (t: string) => `${t}:${territory(t).sectors[0]}`;
const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(t: StrongholdId = 'arrakeen', owner = 'p', choam = false) {
  const g = createGame('STRONGHOLDS', newPlayer('p', 'Guild', 'guild'), true);
  g.players.push(newPlayer('q', 'Emperor', 'emperor'));
  if (choam) g.players.push(newPlayer('c', 'CHOAM', 'choam'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'p',
    order: g.players.map((p) => p.id),
    storm: 18,
    deck: [...baseDeck(), ...ixBattleCards()],
    strongholdCards: createStrongholdCards(),
  });
  g.strongholdCards!.claimedTurn = 1;
  g.strongholdCards!.owners[t] = owner;
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.traitorChoices = [];
    p.spice = 20;
    p.forces = p.id === 'c' ? {} : { [key(t)]: 6 };
    p.reserves = p.id === 'c' ? 20 : 14;
  }
  if (t === MOBILE_STRONGHOLD) g.mobileStronghold = { location: 'red_chasm:7' };
  return g;
}
function hold(g: Game, id: string, kind: Card['kind'] | 'stoneBurner') {
  if (kind === 'stoneBurner') {
    const c = richeseCards().find((c) => c.effect === 'stoneBurner')!;
    seat(g, id).hand.push(c);
    return c.id;
  }
  const index = g.deck.findIndex((c) => c.kind === kind);
  assert.ok(index >= 0, kind);
  const c = g.deck.splice(index, 1)[0];
  seat(g, id).hand.push(c);
  return c.id;
}
function prepare(state: Game, funding = 0) {
  let g = state;
  for (let limit = 0; limit < 40; limit++) {
    if (g.decision?.kind === 'strongholdCopy') return g;
    if (g.response) {
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
      continue;
    }
    if (g.decision?.kind === 'choamBattleFunding') {
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        amount: funding,
      });
      continue;
    }
    if (g.battle?.preLeader && !g.battle.preLeader.closed) {
      const id = [g.battle.attacker, g.battle.defender].find(
        (id) => !g.battle!.preLeader!.ready.includes(id),
      );
      if (id) {
        g = applyAction(g, id, {
          type: 'battlePreparationReady',
          event: g.battle.event,
        });
        continue;
      }
    }
    if (g.battle?.preparation) {
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
      continue;
    }
    if (g.decision?.kind === 'fullPlanOffer') {
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
      continue;
    }
    return g;
  }
  throw Error('Preparation stalled');
}
const begin = (g: Game, t: string, funding = 0) =>
  prepare(
    applyAction(g, 'p', { type: 'chooseBattle', territory: t, target: 'q' }),
    funding,
  );
const plan = (g: Game, id: string, extra: Partial<Action> = {}) =>
  applyAction(g, id, {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: seat(g, id).leaders.find((l) => l.strength === 5)!.id,
    ...extra,
  });
function finish(state: Game, callers: string[] = []) {
  let g = state;
  for (let i = 0; i < 40; i++) {
    if (g.response) {
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
      continue;
    }
    if (g.decision?.kind === 'poisonTooth') {
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        activate: true,
      });
      continue;
    }
    if (g.decision?.kind === 'stoneBurner') {
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        event: g.battle!.event,
        mode: 'ignore',
      });
      continue;
    }
    if (g.battle?.revealed) {
      const view = viewGame(g, 'p').battle!;
      const voter = view.traitorVoters.find(
        (id) => !view.traitorSubmitted.includes(id),
      );
      if (voter) {
        g = applyAction(g, voter, {
          type: 'traitorCall',
          call: callers.includes(voter),
        });
        continue;
      }
    }
    if (g.decision?.kind === 'battleLosses') {
      g = applyAction(g, g.decision.player, { type: 'decision', choice: 0 });
      continue;
    }
    if (g.decision?.kind === 'battleCards') {
      g = applyAction(g, g.decision.player, { type: 'decision', discard: [] });
      continue;
    }
    return g;
  }
  throw Error('Battle settlement stalled');
}
function readyAll(state: Game) {
  let g = state;
  for (const p of state.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
const incomeLogs = (g: Game) =>
  g.log.filter((entry) => entry.automatic?.name === 'Stronghold income');

void test('Stronghold Cards are unowned at the start and transfer only at the final end of Mentat', () => {
  let g = fixture();
  g.turn = 1;
  g.phase = 7;
  g.active = null;
  g.strongholdCards = createStrongholdCards();
  seat(g, 'p').forces = { 'arrakeen:10': 1 };
  seat(g, 'p').reserves = 19;
  seat(g, 'q').forces = { 'carthag:11': 1 };
  seat(g, 'q').reserves = 19;
  g = readyAll(g);
  assert.equal(g.phase, 8);
  assert.equal(g.strongholdCards!.claimedTurn, 0);
  assert.ok(
    Object.values(g.strongholdCards!.owners).every((owner) => owner === null),
  );
  g = readyAll(g);
  assert.equal(g.turn, 2);
  assert.equal(g.strongholdCards!.claimedTurn, 1);
  assert.equal(g.strongholdCards!.owners.arrakeen, 'p');
  const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(restored.strongholdCards, g.strongholdCards);
  g.phase = 8;
  g.active = null;
  g.ready = [];
  g.decision = null;
  g.response = null;
  seat(g, 'p').forces = {};
  seat(g, 'p').reserves = 20;
  seat(g, 'q').forces = { 'arrakeen:10': 1 };
  seat(g, 'q').reserves = 19;
  g = applyAction(g, 'p', { type: 'ready' });
  assert.equal(g.strongholdCards!.owners.arrakeen, 'p');
  g = applyAction(g, 'q', { type: 'ready' });
  assert.equal(g.strongholdCards!.owners.arrakeen, 'q');
  assert.equal(g.strongholdCards!.owners.carthag, null);
  assert.equal(g.strongholdCards!.claimedTurn, 2);
});

void test('Arrakeen bank support reduces actual spice payment and CHOAM receives income including bank support', () => {
  for (const support of [0, 1, 2, 3, 4]) {
    const initial = fixture('arrakeen', 'p', true);
    seat(initial, 'p').spice = Math.max(0, support - 2);
    let g = begin(initial, 'arrakeen');
    g = plan(g, 'p', { dial: support, support });
    g = plan(g, 'q');
    g = finish(g);
    assert.equal(seat(g, 'p').spice, 0);
    assert.equal(seat(g, 'c').spice, 20 + Math.floor(support / 2));
    assert.equal(seat(g, 'p').forces['arrakeen:10'], 6 - support);
  }
});

void test('Arrakeen plus CHOAM donor support consumes only the selected escrow and includes the bank share in CHOAM income', () => {
  const initial = fixture('arrakeen', 'p', true);
  seat(initial, 'p').ally = 'c';
  seat(initial, 'c').ally = 'p';
  seat(initial, 'p').spice = 0;
  let g = begin(initial, 'arrakeen', 2);
  assert.equal(g.aid.c.amount, 2);
  assert.equal(seat(g, 'c').spice, 18);
  g = plan(g, 'p', { dial: 4, support: 4, allyPayment: 2 });
  g = plan(g, 'q');
  g = finish(g);
  assert.equal(seat(g, 'p').spice, 0);
  assert.equal(g.aid.c?.amount ?? 0, 0);
  assert.equal(seat(g, 'c').spice, 19);
});

void test('Carthag adds Snooper to a played Shield only without a poison weapon and never blocks Poison Tooth', () => {
  for (const scenario of [
    { defense: true, own: undefined, enemy: 'poison', dead: false },
    { defense: true, own: 'poison', enemy: 'poison', dead: true },
    { defense: false, own: undefined, enemy: 'poison', dead: true },
    { defense: true, own: undefined, enemy: 'poisonTooth', dead: true },
  ] as const) {
    const initial = fixture('carthag');
    const defense = scenario.defense ? hold(initial, 'p', 'shield') : null;
    const weapon = scenario.own ? hold(initial, 'p', scenario.own) : null;
    const enemy = hold(initial, 'q', scenario.enemy);
    let g = begin(initial, 'carthag');
    const leader = seat(g, 'p').leaders.find((l) => l.strength === 5)!.id;
    g = plan(g, 'p', { weapon, defense });
    g = plan(g, 'q', { weapon: enemy, dial: 2 });
    g = finish(g);
    assert.equal(
      seat(g, 'p').leaders.find((l) => l.id === leader)!.dead,
      scenario.dead,
      JSON.stringify(scenario),
    );
  }
});

void test('Habbanya holder wins as defender on an ordinary or Stone Burner physical tie', () => {
  for (const stone of [false, true]) {
    const initial = fixture('habbanya_ridge_sietch', 'q');
    const weapon = stone ? hold(initial, 'p', 'stoneBurner') : null;
    let g = begin(initial, 'habbanya_ridge_sietch');
    g = plan(g, 'p', { weapon });
    g = plan(g, 'q');
    g = finish(g);
    assert.equal(seat(g, 'p').forces[key('habbanya_ridge_sietch')], undefined);
    assert.equal(seat(g, 'q').forces[key('habbanya_ridge_sietch')], 6);
  }
});

void test('Sietch Tabr pays the winning holder the opposing fractional dial rounded down exactly once', () => {
  const initial = fixture('sietch_tabr');
  let g = begin(initial, 'sietch_tabr');
  g = plan(g, 'p', { dial: 3, support: 3 });
  g = plan(g, 'q', { dial: 1.5, support: 0 });
  g = finish(g);
  assert.equal(seat(g, 'p').spice, 18);
  assert.equal(incomeLogs(g).length, 1);
  const again = normalizeAutomaticGame(JSON.parse(JSON.stringify(g)));
  assert.equal(seat(again, 'p').spice, seat(g, 'p').spice);
  assert.equal(incomeLogs(again).length, 1);
});

void test('Tuek pays losing played Worthless cards but double traitors produce no module payout', () => {
  for (const doubleTraitor of [false, true]) {
    const initial = fixture('tueks_sietch');
    const weapon = hold(initial, 'p', 'worthless'),
      defense = hold(initial, 'p', 'worthless');
    if (doubleTraitor) {
      seat(initial, 'p').traitors = [
        seat(initial, 'q').leaders.find((l) => l.strength === 5)!.id,
      ];
      seat(initial, 'q').traitors = [
        seat(initial, 'p').leaders.find((l) => l.strength === 5)!.id,
      ];
    }
    let g = begin(initial, 'tueks_sietch');
    g = plan(g, 'p', { weapon, defense });
    g = plan(g, 'q', { dial: 2 });
    g = finish(g, doubleTraitor ? ['p', 'q'] : []);
    assert.equal(seat(g, 'p').forces[key('tueks_sietch')], undefined);
    assert.equal(seat(g, 'p').spice, doubleTraitor ? 20 : 24);
    assert.equal(incomeLogs(g).length, doubleTraitor ? 0 : 1);
    assert.ok(g.discard.some((c) => c.id === weapon));
    assert.ok(g.discard.some((c) => c.id === defense));
  }
});

void test('one current controlled site automatically supplies the public mobile copy even if another player retains that card', () => {
  const initial = fixture(MOBILE_STRONGHOLD);
  seat(initial, 'p').forces = { [MOBILE_LOCATION]: 6, 'arrakeen:10': 1 };
  seat(initial, 'p').reserves = 13;
  initial.strongholdCards!.owners.arrakeen = 'q';
  const g = begin(initial, MOBILE_STRONGHOLD);
  assert.equal(g.battle!.strongholdCopy, 'arrakeen');
  assert.notEqual(g.decision?.kind, 'strongholdCopy');
  assert.deepEqual(g.battle!.plans, {});
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.equal(view.battle!.strongholdCopy, 'arrakeen');
    assert.equal(view.battle!.strongholdEffects.p, 'arrakeen');
  }
});

void test('multiple current controlled sites require an event-bound public mobile choice before any plan and reject stale or duplicate choices', () => {
  const initial = fixture(MOBILE_STRONGHOLD);
  seat(initial, 'p').forces = {
    [MOBILE_LOCATION]: 6,
    'arrakeen:10': 1,
    'carthag:11': 1,
  };
  seat(initial, 'p').reserves = 12;
  initial.strongholdCards!.owners.arrakeen = 'q';
  initial.strongholdCards!.owners.sietch_tabr = 'p';
  const g = begin(initial, MOBILE_STRONGHOLD);
  assert.equal(g.decision?.kind, 'strongholdCopy');
  if (g.decision?.kind !== 'strongholdCopy') throw Error('Missing copy choice');
  assert.deepEqual(g.decision.choices, ['arrakeen', 'carthag']);
  const event = g.decision.event,
    snapshot = structuredClone(g);
  assert.throws(() => plan(g, 'q'));
  assert.throws(() =>
    applyAction(g, 'p', {
      type: 'decision',
      event: 'stale',
      stronghold: 'carthag',
    }),
  );
  assert.throws(() =>
    applyAction(g, 'q', { type: 'decision', event, stronghold: 'carthag' }),
  );
  assert.throws(() =>
    applyAction(g, 'p', { type: 'decision', event, stronghold: 'sietch_tabr' }),
  );
  assert.deepEqual(g, snapshot);
  const selected = prepare(
    applyAction(JSON.parse(JSON.stringify(g)), 'p', {
      type: 'decision',
      event,
      stronghold: 'carthag',
    }),
  );
  assert.deepEqual(selected.battle!.plans, {});
  for (const p of selected.players)
    assert.equal(viewGame(selected, p.id).battle!.strongholdCopy, 'carthag');
  assert.throws(() =>
    applyAction(selected, 'p', {
      type: 'decision',
      event,
      stronghold: 'arrakeen',
    }),
  );
  const planned = plan(selected, 'p');
  assert.equal(planned.battle!.strongholdCopy, 'carthag');
});
