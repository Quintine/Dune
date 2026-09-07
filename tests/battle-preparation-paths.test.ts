import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
  type Plan,
} from '../game/engine';
import { treacheryDeck, leaders } from '../game/cards';
import type { PlanClaim } from '../game/battle-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function fixture(advanced = false) {
  const g = createGame(
    'PREPTRUTH',
    newPlayer('a', 'Atreides', 'atreides'),
    advanced,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.active = 'a';
  g.order = ['a', 'e', 'b'];
  g.deck = treacheryDeck(['ix']);
  for (const p of g.players) {
    p.hand = [];
    p.spice = 5;
    p.traitors = [];
    p.traitorChoices = [];
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 4 };
    p.reserves = 16;
  }
  g.battle = {
    territory: 'arrakeen',
    attacker: 'a',
    defender: 'e',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  hold(g, 'a', 'Truthtrance');
  hold(g, 'a', 'Truthtrance');
  hold(g, 'e', 'Tleilaxu Ghola');
  g.players[1].leaders[0].dead = true;
  g.players[1].leaders[0].deaths = 1;
  return g;
}
function hold(g: Game, player: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === player)!.hand.push(card);
  return card.id;
}
function ask(initial: Game, claim: PlanClaim, target = 'e', asker = 'a') {
  let g = applyAction(initial, asker, {
    type: 'card',
    card: initial.players
      .find((p) => p.id === asker)!
      .hand.find((c) => c.effect === 'truthtrance')!.id,
  });
  while (g.truthtrance!.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return applyAction(g, asker, {
    type: 'truthAsk',
    question: { kind: 'battlePlan', target, claim },
  });
}
function promise(g: Game, claim: PlanClaim, target = 'e', asker = 'a') {
  g = ask(g, claim, target, asker);
  return applyAction(g, target, { type: 'truthAnswer', answer: 'yes' });
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
function seal(g: Game, plan: Plan, id = 'e') {
  return applyAction(g, id, { type: 'battlePlan', ...plan });
}
const leaderClaim: PlanClaim = { kind: 'leader', leader: 'emperor-0' };
const supportClaim: PlanClaim = { kind: 'support', compare: 'gte', value: 1 };
const liveCards = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
function tleilaxu() {
  const g = fixture(true),
    p = g.players[1];
  p.faction = 'tleilaxu';
  p.leaders = leaders('tleilaxu');
  p.spice = 0;
  p.tanks = 1;
  p.reserves = 15;
  return g;
}
void test('Ghola makes a dead-leader promise reachable without consuming or revealing the preparation card', () => {
  const initial = fixture();
  const before = JSON.stringify(initial);
  const pending = ask(initial, leaderClaim);
  assert.deepEqual(viewGame(pending, 'e').truthBattleAnswers, ['yes', 'no']);
  const g = applyAction(pending, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  const own = viewGame(g, 'e').battle!;
  assert.equal(own.compliantPlan, null);
  assert.equal(own.compliantPreparation!.actions.length, 1);
  assert.equal(own.compliantPreparation!.actions[0].leader, 'emperor-0');
  for (const id of ['a', 'b']) {
    assert.equal(viewGame(g, id).battle!.compliantPreparation, null);
    assert.equal(viewGame(g, id).players[1].hand, undefined);
  }
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.ok(g.players[1].hand.some((c) => c.effect === 'ghola'));
  assert.equal(JSON.stringify(initial), before);
  assert.throws(
    () => seal(g, own.compliantPreparation!.plan),
    /leader is not available/,
  );
  const revived = applyAction(
    JSON.parse(JSON.stringify(g)),
    'e',
    own.compliantPreparation!.actions[0],
  );
  assert.equal(revived.players[1].leaders[0].dead, false);
  assert.equal(revived.players[1].leaderRevived, false);
  assert.equal(revived.players[1].spice, 5);
  assert.equal(viewGame(revived, 'e').battle!.compliantPreparation, null);
  const done = seal(revived, viewGame(revived, 'e').battle!.compliantPlan!);
  assert.equal(done.battle!.plans.e.leader, 'emperor-0');
  assert.deepEqual(liveCards(done), liveCards(initial));
});
void test('prescience can commit a Ghola-reachable leader both with and without an earlier Truthtrance', () => {
  for (const truth of [false, true]) {
    let g: Game = truth ? promise(fixture(), leaderClaim) : fixture();
    g.battle!.preparation = {
      kind: 'prescience',
      owner: 'a',
      beneficiary: 'a',
    };
    g = allow(applyAction(g, 'a', { type: 'prescience', field: 'leader' }));
    g = applyAction(g, 'e', { type: 'prescienceAnswer', value: 'emperor-0' });
    assert.equal(g.battle!.prescience!.value, 'emperor-0');
    const preparation = viewGame(g, 'e').battle!.compliantPreparation!;
    assert.equal(preparation.actions[0].leader, 'emperor-0');
    assert.equal(viewGame(g, 'a').battle!.compliantPreparation, null);
    g = applyAction(g, 'e', preparation.actions[0]);
    g = seal(g, viewGame(g, 'e').battle!.compliantPlan!);
    assert.equal(g.battle!.plans.e.leader, 'emperor-0');
  }
});
void test('one physical Ghola cannot revive both a dead Kwisatz and a needed leader', () => {
  const initial = fixture(true);
  const a = initial.players[0],
    e = initial.players[1];
  e.hand = e.hand.filter((c) => {
    if (c.effect === 'ghola') {
      a.hand.push(c);
      return false;
    }
    return true;
  });
  e.hand.push(
    a.hand.splice(
      a.hand.findIndex((c) => c.effect === 'truthtrance'),
      1,
    )[0],
  );
  a.leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  a.battleLosses = 7;
  a.kwisatz = { dead: true };
  const both: PlanClaim = {
    kind: 'and',
    terms: [
      { kind: 'leader', leader: 'atreides-0' },
      { kind: 'kwisatz', use: true },
    ],
  };
  assert.deepEqual(
    viewGame(ask(initial, both, 'a', 'e'), 'a').truthBattleAnswers,
    ['no'],
  );
  assert.deepEqual(
    viewGame(ask(initial, { kind: 'kwisatz', use: true }, 'a', 'e'), 'a')
      .truthBattleAnswers,
    ['no'],
  );
  const hero = initial.deck.find((c) => c.kind === 'hero')!;
  hold(initial, 'a', hero.name);
  let g = promise(initial, { kind: 'kwisatz', use: true }, 'a', 'e');
  const preparation = viewGame(g, 'a').battle!.compliantPreparation!;
  assert.equal(preparation.actions[0].leader, 'kwisatz');
  g = applyAction(g, 'a', preparation.actions[0]);
  const plan = viewGame(g, 'a').battle!.compliantPlan!;
  assert.equal(plan.leader, hero.id);
  assert.equal(plan.kwisatz, true);
  assert.ok(seal(g, plan, 'a').battle!.plans.a.kwisatz);
});
void test('Ghola reachability respects leader control, captured leaders and actual card possession', () => {
  for (const mode of ['no-card', 'captured', 'foreign'] as const) {
    const g = fixture();
    if (mode === 'no-card') g.discard.push(g.players[1].hand.pop()!);
    if (mode === 'captured') g.players[1].leaders[0].capturedBy = 'a';
    if (mode === 'foreign') g.players[1].leaders[0].gholaBy = 'a';
    assert.deepEqual(
      viewGame(ask(g, leaderClaim), 'e').truthBattleAnswers,
      ['no'],
      mode,
    );
  }
  const initial = fixture(true);
  const p = initial.players[1];
  p.faction = 'tleilaxu';
  p.leaders = leaders('tleilaxu');
  initial.players[0].leaders[0].dead = true;
  initial.players[0].leaders[0].gholaBy = 'e';
  const g = promise(initial, { kind: 'leader', leader: 'atreides-0' });
  const action = viewGame(g, 'e').battle!.compliantPreparation!.actions[0];
  assert.equal(action.leader, 'atreides-0');
  const revived = allow(applyAction(g, 'e', action));
  assert.equal(revived.players[0].leaders[0].dead, false);
  assert.equal(revived.players[0].leaders[0].gholaBy, 'e');
});
void test('a promised Ghola cannot be diverted to a revival that makes the answer impossible', () => {
  const initial = fixture();
  initial.players[1].leaders[1].dead = true;
  initial.players[1].tanks = 1;
  initial.players[1].reserves--;
  const g = promise(initial, leaderClaim);
  const card = g.players[1].hand.find((c) => c.effect === 'ghola')!.id;
  const before = JSON.stringify(g);
  for (const extra of [{ leader: 'emperor-1' }, { amount: 1 }])
    assert.throws(
      () => applyAction(g, 'e', { type: 'card', card, ...extra }),
      /voluntarily/,
    );
  assert.equal(JSON.stringify(g), before);
  // An OR promise keeps its real alternatives; the engine does not force its first witness.
  const alternate = promise(initial, {
    kind: 'or',
    terms: [leaderClaim, { kind: 'leader', leader: 'emperor-1' }],
  });
  const revived = applyAction(alternate, 'e', {
    type: 'card',
    card,
    leader: 'emperor-1',
  });
  assert.equal(revived.players[1].leaders[1].dead, false);
  assert.equal(revived.battle!.truthPromises![0].released, undefined);
});
void test('Tleilaxu Ghola income is a reachable funding path but remains pending until its response ends', () => {
  const initial = tleilaxu();
  hold(initial, 'a', 'Karama');
  let g = promise(initial, supportClaim);
  const own = viewGame(g, 'e').battle!;
  assert.equal(own.compliantPlan, null);
  assert.equal(own.compliantPreparation!.actions[0].amount, 1);
  g = applyAction(g, 'e', own.compliantPreparation!.actions[0]);
  assert.equal(g.response!.kind, 'revivalIncome');
  assert.equal(g.players[1].spice, 0);
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  const waiting = viewGame(g, 'e').battle!;
  assert.equal(waiting.compliantPlan, null);
  assert.equal(waiting.compliantPreparation!.waitingForIncome, true);
  assert.deepEqual(waiting.compliantPreparation!.actions, []);
  assert.throws(
    () => seal(g, waiting.compliantPreparation!.plan),
    /response window/,
  );
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[1].spice, 1);
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.players[1].reserves, 16);
  assert.equal(viewGame(g, 'e').battle!.compliantPreparation, null);
  g = seal(g, viewGame(g, 'e').battle!.compliantPlan!);
  assert.equal(g.battle!.plans.e.support, 1);
  assert.deepEqual(liveCards(g), liveCards(initial));
});
void test('canceling conditional revival income releases the promise without undoing the actual revival', () => {
  const initial = tleilaxu();
  const karama = hold(initial, 'a', 'Karama');
  let g = promise(initial, supportClaim);
  g = applyAction(
    g,
    'e',
    viewGame(g, 'e').battle!.compliantPreparation!.actions[0],
  );
  g = applyAction(g, 'a', { type: 'card', mode: 'cancel', card: karama });
  assert.equal(g.players[1].spice, 0);
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.players[1].reserves, 16);
  assert.equal(g.battle!.truthPromises![0].released, true);
  assert.equal(g.response, null);
});
void test('a Worthless counter-window preserves possible income until the original cancellation settles', () => {
  const initial = tleilaxu();
  const karama = hold(initial, 'a', 'Karama');
  const worthless = initial.deck.find((c) => c.kind === 'worthless')!;
  hold(initial, 'b', worthless.name);
  let g = promise(initial, supportClaim);
  g = applyAction(
    g,
    'e',
    viewGame(g, 'e').battle!.compliantPreparation!.actions[0],
  );
  const conversion = applyAction(g, 'b', {
    type: 'card',
    mode: 'cancel',
    card: worthless.id,
  });
  assert.equal(conversion.response!.kind, 'worthlessKarama');
  assert.equal(conversion.battle!.truthPromises![0].released, undefined);
  assert.equal(
    viewGame(conversion, 'e').battle!.compliantPreparation!.waitingForIncome,
    true,
  );
  assert.equal(viewGame(conversion, 'a').battle!.compliantPreparation, null);
  const blocked = allow(conversion);
  assert.equal(blocked.battle!.truthPromises![0].released, true);
  const restored = allow(
    applyAction(conversion, 'a', {
      type: 'card',
      mode: 'cancel',
      card: karama,
    }),
  );
  assert.equal(restored.players[1].spice, 1);
  assert.equal(restored.battle!.truthPromises![0].released, undefined);
  assert.ok(viewGame(restored, 'e').battle!.compliantPlan);
});
void test('Ghola income cannot fund another faction or pretend to add forces directly to a battle', () => {
  const initial = fixture(true);
  initial.players[1].spice = 0;
  initial.players[1].tanks = 1;
  initial.players[1].reserves--;
  initial.players[2].faction = 'tleilaxu';
  initial.players[2].leaders = leaders('tleilaxu');
  assert.deepEqual(
    viewGame(ask(initial, supportClaim), 'e').truthBattleAnswers,
    ['no'],
  );
  const force = fixture();
  force.players[1].tanks = 5;
  force.players[1].reserves -= 5;
  assert.deepEqual(
    viewGame(ask(force, { kind: 'dial', compare: 'gte', value: 5 }), 'e')
      .truthBattleAnswers,
    ['no'],
  );
});
void test('one revival can satisfy a leader-and-support promise when its actual Tleilaxu income suffices', () => {
  const initial = tleilaxu();
  initial.players[1].leaders[0].dead = true;
  const g = promise(initial, {
    kind: 'and',
    terms: [{ kind: 'leader', leader: 'tleilaxu-0' }, supportClaim],
  });
  const next = viewGame(g, 'e').battle!.compliantPreparation!.actions[0];
  assert.equal(next.leader, 'tleilaxu-0');
  const revived = allow(applyAction(g, 'e', next));
  const legal = viewGame(revived, 'e').battle!.compliantPlan!;
  assert.equal(legal.leader, 'tleilaxu-0');
  assert.equal(legal.support, 1);
  assert.ok(seal(revived, legal).battle!.plans.e);
});
void test('all AI levels execute required Ghola preparation before sealing or answering prescience', () => {
  for (const level of DIFFICULTIES)
    for (const prescience of [false, true]) {
      const initial = fixture();
      initial.players[1].bot = level;
      let g: Game = promise(initial, leaderClaim);
      if (prescience) {
        g.battle!.prescience = { player: 'a', field: 'leader' };
        g.battle!.preparation = {
          kind: 'prescienceAnswer',
          owner: 'e',
          beneficiary: 'a',
        };
      }
      const actions = botActions(viewGame(g, 'e'));
      assert.equal(actions[0].type, 'card');
      assert.equal(actions[0].leader, 'emperor-0');
      g = applyAction(g, 'e', actions[0]);
      if (prescience) {
        const response = botActions(viewGame(g, 'e'))[0];
        assert.equal(response.type, 'prescienceAnswer');
        g = applyAction(g, 'e', response);
        assert.equal(g.battle!.prescience!.value, 'emperor-0');
      }
      let done: Game | undefined;
      for (const action of botActions(viewGame(g, 'e'))) {
        try {
          done = applyAction(g, 'e', action);
          break;
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
        }
      }
      assert.equal(done!.battle!.plans.e.leader, 'emperor-0', level);
    }
});
void test('a sealed plan cannot be changed through a future Ghola search', () => {
  let g = fixture();
  g = applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-1' });
  const pending = ask(g, leaderClaim);
  assert.deepEqual(viewGame(pending, 'e').truthBattleAnswers, ['no']);
  assert.equal(pending.players[1].leaders[0].dead, true);
  assert.equal(
    pending.players[1].hand.filter((c) => c.effect === 'ghola').length,
    1,
  );
});
