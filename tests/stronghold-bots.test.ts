import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  createStrongholdCards,
  type StrongholdId,
} from '../game/stronghold-cards';
import { MOBILE_STRONGHOLD, MOBILE_LOCATION, territory } from '../game/board';
const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const location = (t: string) => `${t}:${territory(t).sectors[0]}`;
function fixture(t: StrongholdId, defender = false) {
  const g = createGame('STRONGHOLDAI', newPlayer('p', 'Pilot', 'guild'), true);
  g.players.push(newPlayer('q', 'Opponent', 'emperor'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: defender ? 'q' : 'p',
    order: defender ? ['q', 'p'] : ['p', 'q'],
    storm: 18,
    deck: baseDeck(),
    strongholdCards: createStrongholdCards(),
  });
  g.strongholdCards!.owners[t] = 'p';
  g.strongholdCards!.claimedTurn = 1;
  for (const p of g.players) {
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
    p.traitorChoices = [];
    p.forces = { [location(t)]: 6 };
    p.reserves = 14;
  }
  if (t === MOBILE_STRONGHOLD) g.mobileStronghold = { location: 'red_chasm:7' };
  return g;
}
function hold(g: Game, id: string, kind: Card['kind']) {
  const index = g.deck.findIndex((c) => c.kind === kind);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  seat(g, id).hand.push(card);
  return card;
}
function prepare(state: Game) {
  let g = state;
  for (let n = 0; n < 30; n++) {
    if (g.decision?.kind === 'strongholdCopy') return g;
    if (g.response) {
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
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
    return g;
  }
  throw Error('Unfinished preparation');
}
const begin = (g: Game, t: string) =>
  prepare(
    applyAction(g, g.active!, {
      type: 'chooseBattle',
      territory: t,
      target: g.active === 'p' ? 'q' : 'p',
    }),
  );
function proposals(g: Game, difficulty: Difficulty, id = 'p') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = difficulty;
  const snapshot = structuredClone(v),
    actions = botActions(v);
  assert.deepEqual(v, snapshot);
  return actions;
}
function mobile() {
  const g = fixture(MOBILE_STRONGHOLD);
  seat(g, 'p').forces = {
    [MOBILE_LOCATION]: 6,
    'arrakeen:10': 1,
    'carthag:11': 1,
    [location('habbanya_ridge_sietch')]: 1,
  };
  seat(g, 'p').reserves = 11;
  g.strongholdCards!.owners.arrakeen = 'q';
  hold(g, 'q', 'shield');
  return begin(g, MOBILE_STRONGHOLD);
}
function privateVariant(g: Game) {
  const variant = structuredClone(g),
    q = seat(variant, 'q');
  assert.equal(q.hand.length, 1);
  const replacement = variant.deck.findIndex((c) => c.kind === 'poison');
  assert.ok(replacement >= 0);
  const old = q.hand[0];
  q.hand[0] = variant.deck.splice(replacement, 1)[0];
  variant.deck.push(old);
  q.spice = 9999;
  q.traitors = ['guild-4'];
  return variant;
}

void test('every AI level proposes only current event-bound mobile copies and every proposal is an authoritative legal action', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = mobile(),
      snapshot = structuredClone(g);
    assert.equal(g.decision?.kind, 'strongholdCopy');
    if (g.decision?.kind !== 'strongholdCopy')
      throw Error('Missing copy decision');
    const actions = proposals(g, difficulty);
    assert.equal(actions.length, 3);
    assert.deepEqual(
      new Set(actions.map((a) => a.stronghold)),
      new Set(g.decision.choices),
    );
    assert.deepEqual(proposals(g, difficulty, 'q'), []);
    for (const action of actions) {
      assert.equal(action.type, 'decision');
      assert.equal(action.event, g.decision.event);
      const next = applyAction(JSON.parse(JSON.stringify(g)), 'p', action);
      assert.equal(next.battle!.strongholdCopy, action.stronghold);
      assert.deepEqual(next.battle!.plans, {});
      for (const p of next.players)
        assert.equal(
          viewGame(next, p.id).battle!.strongholdCopy,
          action.stronghold,
        );
      assert.throws(() => applyAction(next, 'p', action));
      assert.throws(() => applyAction(g, 'p', { ...action, event: 'stale' }));
    }
    assert.deepEqual(g, snapshot);
  }
});

void test('all AI levels offer actual supported Arrakeen plans with no personal spice and no pledged funds', () => {
  for (const difficulty of DIFFICULTIES)
    for (const count of [4, 6, 10, 20]) {
      const initial = fixture('arrakeen');
      seat(initial, 'p').forces = { 'arrakeen:10': count };
      seat(initial, 'p').reserves = 20 - count;
      seat(initial, 'p').spice = 0;
      hold(initial, 'p', 'shield');
      hold(initial, 'q', 'shield');
      const g = begin(initial, 'arrakeen'),
        actions = proposals(g, difficulty);
      assert.ok(actions.length);
      assert.ok(
        actions.some((a) => Number(a.support) > 0),
        difficulty,
      );
      for (const action of actions) {
        assert.equal(action.type, 'battlePlan');
        assert.ok(Number(action.support ?? 0) <= 2);
        const next = applyAction(g, 'p', action);
        assert.equal(next.battle!.plans.p.support, action.support ?? 0);
        assert.equal(seat(next, 'p').spice, 0);
        assert.equal(viewGame(next, 'p').aid.available, 0);
      }
      // Commit a generated supported plan and settle the opponent's ordinary answer.
      const supported = actions.find((a) => Number(a.support) > 0)!;
      let next = applyAction(g, 'p', supported);
      next = applyAction(next, 'q', {
        type: 'battlePlan',
        dial: 0,
        support: 0,
        leader: 'emperor-1',
      });
      next = applyAction(next, 'p', { type: 'traitorCall', call: false });
      next = applyAction(next, 'q', { type: 'traitorCall', call: false });
      assert.equal(seat(next, 'p').spice, 0);
      assert.ok(
        next.log.some(
          (entry) => entry.automatic?.name === 'Stronghold support',
        ),
      );
    }
});

void test('Habbanya defender profiles emit legal plans and choose an event-bound Stone mode before winning the undialed tie', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture('habbanya_ridge_sietch', true);
    const stone = richeseCards().find((c) => c.effect === 'stoneBurner')!;
    seat(initial, 'p').hand.push(stone);
    initial.richeseCache = richeseCards().filter((c) => c.id !== stone.id);
    const g = begin(initial, 'habbanya_ridge_sietch');
    assert.equal(viewGame(g, 'p').battle!.tieWinner, 'p');
    const plans = proposals(g, difficulty).filter(
      (a) => a.type === 'battlePlan',
    );
    assert.ok(plans.length);
    for (const action of plans)
      assert.doesNotThrow(() => applyAction(g, 'p', action));
    const stonePlan = plans.find((a) => a.weapon === stone.id && a.dial === 0)!;
    assert.ok(stonePlan, difficulty);
    let revealed = applyAction(g, 'p', stonePlan);
    revealed = applyAction(revealed, 'q', {
      type: 'battlePlan',
      dial: 0,
      support: 0,
      leader: 'emperor-1',
    });
    assert.equal(revealed.decision?.kind, 'stoneBurner');
    assert.deepEqual(proposals(revealed, difficulty, 'q'), []);
    const choices = proposals(revealed, difficulty);
    assert.equal(choices.length, 1);
    const choice = choices[0];
    assert.equal(choice.type, 'decision');
    assert.equal(choice.event, revealed.battle!.event);
    assert.ok(['kill', 'ignore'].includes(String(choice.mode)));
    let next = applyAction(JSON.parse(JSON.stringify(revealed)), 'p', choice);
    assert.throws(() => applyAction(next, 'p', choice));
    next = applyAction(next, 'p', { type: 'traitorCall', call: false });
    next = applyAction(next, 'q', { type: 'traitorCall', call: false });
    assert.equal(seat(next, 'p').forces[location('habbanya_ridge_sietch')], 6);
    assert.equal(
      seat(next, 'q').forces[location('habbanya_ridge_sietch')],
      undefined,
    );
  }
});

void test('foreign private hands, spice and traitors cannot change mobile-copy or supported-plan proposals at any level', () => {
  const copy = mobile();
  const initial = fixture('arrakeen');
  seat(initial, 'p').spice = 0;
  hold(initial, 'p', 'shield');
  hold(initial, 'q', 'shield');
  const planning = begin(initial, 'arrakeen');
  for (const g of [copy, planning]) {
    const variant = privateVariant(g);
    assert.deepEqual(viewGame(variant, 'p'), viewGame(g, 'p'));
    for (const difficulty of DIFFICULTIES) {
      const actions = proposals(g, difficulty);
      assert.deepEqual(proposals(variant, difficulty), actions);
      for (const action of actions) {
        assert.doesNotThrow(() => applyAction(g, 'p', action));
        assert.doesNotThrow(() => applyAction(variant, 'p', action));
      }
    }
  }
});
