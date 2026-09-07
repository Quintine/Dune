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
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { matchesPlanClaim, type PlanClaim } from '../game/battle-promises';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';

function fixture(advanced = false) {
  const g = createGame(
    'BTRUTH22',
    newPlayer('a', 'Atreides', 'atreides'),
    advanced,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
  );
  g.status = 'playing';
  g.turn = 2;
  g.phase = 6;
  g.order = ['a', 'e', 'b'];
  g.active = 'a';
  g.storm = 18;
  g.deck = treacheryDeck(['ix']);
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.traitorChoices = [];
    p.spice = 6;
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 6 };
    p.reserves = 14;
  }
  hold(g, 'a', 'Truthtrance');
  hold(g, 'a', 'Truthtrance');
  hold(g, 'e', 'Shield');
  hold(g, 'e', 'Gom Jabbar');
  hold(g, 'e', 'Maula Pistol');
  g.battle = {
    territory: 'arrakeen',
    attacker: 'a',
    defender: 'e',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  return g;
}
function hold(g: Game, player: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === player)!.hand.push(c);
  return c.id;
}
function ask(initial: Game, claim: PlanClaim, target = 'e') {
  let g = applyAction(initial, 'a', {
    type: 'card',
    card: initial.players[0].hand.find((c) => c.effect === 'truthtrance')!.id,
  });
  while (g.truthtrance!.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'battlePlan', target, claim, territory: 'forged' },
  });
}
function answer(g: Game, value: 'yes' | 'no' | 'unknown' = 'yes') {
  return applyAction(g, g.truthtrance!.question!.target, {
    type: 'truthAnswer',
    answer: value,
  });
}
function promise(
  g: Game,
  claim: PlanClaim,
  value: 'yes' | 'no' = 'yes',
  target = 'e',
) {
  return answer(ask(g, claim, target), value);
}
function plan(g: Game, override: Partial<Plan> = {}, player = 'e') {
  return {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players.find((p) => p.id === player)!.leaders[0].id,
    weapon: null,
    defense: null,
    ...override,
  };
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
const minimum: PlanClaim = { kind: 'dial', compare: 'gte', value: 3 };
void test('a battle answer binds only the stated plan elements and exposes no private completion', () => {
  const initial = fixture();
  const pending = ask(initial, minimum);
  assert.deepEqual(viewGame(pending, 'e').truthBattleAnswers, ['yes', 'no']);
  assert.equal(viewGame(pending, 'a').truthBattleAnswers, null);
  assert.equal(viewGame(pending, 'b').truthBattleAnswers, null);
  assert.equal(
    pending.truthtrance!.question!.kind === 'battlePlan' &&
      pending.truthtrance!.question!.territory,
    'arrakeen',
  );
  const g = answer(pending);
  assert.equal(g.battle!.truthPromises!.length, 1);
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  assert.ok(viewGame(g, 'e').battle!.compliantPlan!.dial >= 3);
  assert.equal(viewGame(g, 'a').battle!.compliantPlan, null);
  assert.equal(viewGame(g, 'b').battle!.compliantPlan, null);
  assert.throws(() => applyAction(g, 'e', plan(g, { dial: 2 })), /Truthtrance/);
  const weapon = g.players[1].hand.find((c) => c.kind === 'poison')!.id;
  const sealed = applyAction(
    JSON.parse(JSON.stringify(g)),
    'e',
    plan(g, { dial: 4, leader: g.players[1].leaders[1].id, weapon }),
  );
  assert.equal(sealed.battle!.plans.e.dial, 4);
  assert.equal(sealed.battle!.plans.e.weapon, weapon);
  assert.equal(viewGame(sealed, 'a').battle!.plans.e, undefined);
  assert.deepEqual(initial.battle!.truthPromises, undefined);
});
void test('overlapping Yes/No answers compose and cannot be contradicted by a later answer', () => {
  const initial = promise(fixture(), minimum);
  const pending = ask(initial, { kind: 'dial', compare: 'gte', value: 2 });
  assert.deepEqual(viewGame(pending, 'e').truthBattleAnswers, ['yes']);
  assert.throws(() => answer(pending, 'no'), /previous commitments/);
  assert.throws(() => answer(pending, 'unknown'), /previous commitments/);
  const g = promise(initial, { kind: 'dial', compare: 'gte', value: 5 }, 'no');
  assert.throws(() => applyAction(g, 'e', plan(g, { dial: 5 })), /Truthtrance/);
  const sealed = applyAction(g, 'e', plan(g, { dial: 3 }));
  assert.equal(sealed.battle!.plans.e.dial, 3);
});
void test('AND/OR promises preserve alternatives instead of locking an arbitrary witness', () => {
  const claim: PlanClaim = {
    kind: 'or',
    terms: [
      { kind: 'weapon', name: 'Gom Jabbar' },
      { kind: 'defense', name: 'Shield' },
    ],
  };
  const g = promise(fixture(), claim);
  const weapon = g.players[1].hand.find((c) => c.name === 'Gom Jabbar')!.id;
  const defense = g.players[1].hand.find((c) => c.name === 'Shield')!.id;
  for (const choices of [{ weapon }, { defense }, { weapon, defense }])
    assert.ok(applyAction(g, 'e', plan(g, choices)).battle!.plans.e);
  assert.throws(() => applyAction(g, 'e', plan(g)), /Truthtrance/);
  const and = promise(fixture(), {
    kind: 'and',
    terms: [
      { kind: 'dial', compare: 'eq', value: 2 },
      { kind: 'defense', name: 'Shield' },
    ],
  });
  assert.throws(
    () => applyAction(and, 'e', plan(and, { dial: 2 })),
    /Truthtrance/,
  );
});
void test('plan existence respects dual-role Ix cards and cannot promise an illegal pair', () => {
  const initial = fixture();
  hold(initial, 'e', 'Chemistry');
  const invalid: PlanClaim = {
    kind: 'and',
    terms: [
      { kind: 'weapon', name: 'Chemistry' },
      { kind: 'defense', name: null },
    ],
  };
  const q = ask(initial, invalid);
  assert.deepEqual(viewGame(q, 'e').truthBattleAnswers, ['no']);
  assert.throws(() => answer(q), /legal plans/);
  const g = promise(initial, { kind: 'weapon', name: 'Chemistry' });
  const legal = viewGame(g, 'e').battle!.compliantPlan!;
  assert.ok(legal.defense);
  assert.ok(
    applyAction(g, 'e', { type: 'battlePlan', ...legal }).battle!.plans.e,
  );
});
void test('a sealed plan gives one truthful answer without exposing unrelated components or adding a new promise', () => {
  let g = fixture();
  g = applyAction(g, 'e', plan(g, { dial: 4 }));
  g = ask(g, minimum);
  assert.deepEqual(viewGame(g, 'e').truthBattleAnswers, ['yes']);
  assert.throws(() => answer(g, 'no'), /legal plans/);
  g = answer(g);
  assert.equal(g.battle!.truthPromises, undefined);
  assert.equal(viewGame(g, 'a').battle!.plans.e, undefined);
  assert.equal(g.battle!.plans.e.dial, 4);
});
void test('prescience searches across permitted dials instead of assuming all unshown elements can be zero', () => {
  let g = promise(fixture(), minimum);
  g.battle!.preparation = { kind: 'prescience', owner: 'a', beneficiary: 'a' };
  g = allow(applyAction(g, 'a', { type: 'prescience', field: 'leader' }));
  g = applyAction(g, 'e', {
    type: 'prescienceAnswer',
    value: g.players[1].leaders[1].id,
  });
  assert.equal(g.battle!.prescience!.value, 'emperor-1');
  const legal = viewGame(g, 'e').battle!.compliantPlan!;
  assert.ok(legal.dial >= 3);
  assert.equal(legal.leader, 'emperor-1');
  assert.ok(
    applyAction(g, 'e', { type: 'battlePlan', ...legal }).battle!.plans.e,
  );
  g = promise(fixture(), minimum);
  g.battle!.preparation = { kind: 'prescience', owner: 'a', beneficiary: 'a' };
  g = allow(applyAction(g, 'a', { type: 'prescience', field: 'dial' }));
  assert.throws(
    () => applyAction(g, 'e', { type: 'prescienceAnswer', value: 2 }),
    /legal battle plan/,
  );
  assert.ok(
    applyAction(g, 'e', { type: 'prescienceAnswer', value: 3 }).battle!
      .prescience,
  );
});
void test('a canceled Voice preserves earlier Truthtrance, while a completed incompatible Voice releases it', () => {
  let initial = fixture();
  initial.players[2].ally = 'a';
  initial.players[0].ally = 'b';
  hold(initial, 'a', 'Karama');
  initial = promise(initial, { kind: 'defense', name: 'Shield' });
  initial.battle!.preparation = { kind: 'voice', owner: 'b', beneficiary: 'a' };
  const voiced = applyAction(initial, 'b', {
    type: 'voice',
    kind: 'shield',
    must: false,
  });
  assert.equal(voiced.battle!.truthPromises![0].released, undefined);
  const canceled = applyAction(voiced, 'a', {
    type: 'card',
    card: voiced.players[0].hand.find((c) => c.effect === 'karama')!.id,
    mode: 'cancel',
  });
  assert.equal(canceled.battle!.truthPromises![0].released, undefined);
  assert.throws(() => {
    const g = structuredClone(canceled);
    g.battle!.preparation = undefined;
    return applyAction(g, 'e', plan(g));
  }, /Truthtrance/);
  const allowed = allow(voiced);
  assert.equal(allowed.battle!.truthPromises![0].released, true);
  assert.match(allowed.log.at(-1)!.text, /no longer binding/);
  allowed.battle!.preparation = undefined;
  assert.ok(applyAction(allowed, 'e', plan(allowed)).battle!.plans.e);
});
void test('a player cannot give away support spice to escape their own battle promise', () => {
  const initial = fixture(true);
  initial.players[1].spice = 3;
  const g = promise(initial, { kind: 'support', compare: 'gte', value: 3 });
  const before = JSON.stringify(g);
  assert.throws(
    () => applyAction(g, 'e', { type: 'bribe', target: 'b', amount: 1 }),
    /voluntarily/,
  );
  assert.equal(JSON.stringify(g), before);
  const legal = viewGame(g, 'e').battle!.compliantPlan!;
  assert.equal(legal.support, 3);
  assert.ok(
    applyAction(g, 'e', { type: 'battlePlan', ...legal }).battle!.plans.e,
  );
});
void test('a promised Worthless battle card cannot be voluntarily consumed as Karama', () => {
  const initial = fixture(true);
  initial.battle!.defender = 'b';
  initial.players[2].forces = { 'arrakeen:10': 6 };
  initial.players[2].reserves = 14;
  initial.players[1].forces = {};
  initial.players[1].reserves = 20;
  const worthless = initial.deck.find((c) => c.kind === 'worthless')!;
  hold(initial, 'b', worthless.name);
  let g = promise(
    initial,
    { kind: 'weapon', name: worthless.name },
    'yes',
    'b',
  );
  g.battle!.preparation = { kind: 'prescience', owner: 'a', beneficiary: 'a' };
  g = applyAction(g, 'a', { type: 'prescience', field: 'leader' });
  assert.throws(
    () =>
      applyAction(g, 'b', { type: 'card', mode: 'cancel', card: worthless.id }),
    /voluntarily/,
  );
  assert.ok(g.players[2].hand.some((c) => c.id === worthless.id));
});
void test('Kwisatz inclusion and exclusion are enforced even when the plan omits the optional flag', () => {
  for (const use of [true, false]) {
    const initial = fixture(true);
    initial.players[0].battleLosses = 7;
    initial.players[0].kwisatz = { dead: false };
    // Move a physical Truthtrance to the Emperor, so Atreides can be asked by another player.
    initial.players[1].hand.push(initial.players[0].hand.pop()!);
    let g = applyAction(initial, 'e', {
      type: 'card',
      card: initial.players[1].hand.at(-1)!.id,
    });
    for (const id of ['a', 'b']) g = applyAction(g, id, { type: 'truthPass' });
    g = applyAction(g, 'e', {
      type: 'truthAsk',
      question: {
        kind: 'battlePlan',
        target: 'a',
        claim: { kind: 'kwisatz', use },
      },
    });
    g = answer(g);
    const wrong = plan(g, use ? {} : { kwisatz: true }, 'a');
    assert.throws(() => applyAction(g, 'a', wrong), /Truthtrance/);
    assert.ok(
      applyAction(g, 'a', plan(g, { kwisatz: use }, 'a')).battle!.plans.a,
    );
  }
});
void test('Cheap Hero promises match either physical hero and exact named cards match duplicate copies', () => {
  const initial = fixture();
  const hero = initial.deck.find((c) => c.kind === 'hero')!;
  hold(initial, 'e', hero.name);
  const g = promise(initial, { kind: 'leader', leader: CHEAP_HERO_TRAITOR });
  assert.ok(applyAction(g, 'e', plan(g, { leader: hero.id })).battle!.plans.e);
  assert.throws(() => applyAction(g, 'e', plan(g)), /Truthtrance/);
  const copies = fixture();
  const second = hold(copies, 'e', 'Shield');
  const constrained = promise(copies, { kind: 'defense', name: 'Shield' });
  for (const c of constrained.players[1].hand.filter(
    (c) => c.name === 'Shield',
  ))
    assert.ok(
      applyAction(constrained, 'e', plan(constrained, { defense: c.id }))
        .battle!.plans.e,
    );
  assert.ok(constrained.players[1].hand.some((c) => c.id === second));
});
void test('basic Ix fractional dials and fixed-half suboids participate in legal-plan searches', () => {
  const initial = fixture();
  const ix = initial.players[1];
  ix.faction = 'ixians';
  ix.leaders = leaders('ixians');
  ix.elites = {
    reserves: 6,
    tanks: 0,
    forces: { 'arrakeen:10': 1 },
    revived: 0,
  };
  const g = promise(initial, { kind: 'dial', compare: 'eq', value: 2.5 });
  const legal = viewGame(g, 'e').battle!.compliantPlan!;
  assert.equal(legal.dial, 2.5);
  assert.equal(legal.support, 0);
  let insight = structuredClone(g);
  insight.battle!.preparation = {
    kind: 'prescience',
    owner: 'a',
    beneficiary: 'a',
  };
  insight = allow(
    applyAction(insight, 'a', { type: 'prescience', field: 'dial' }),
  );
  insight = applyAction(insight, 'e', { type: 'prescienceAnswer', value: 2.5 });
  assert.equal(insight.battle!.prescience!.value, 2.5);

  assert.ok(
    applyAction(g, 'e', { type: 'battlePlan', ...legal }).battle!.plans.e,
  );
});
void test('malformed claims and noncombatant targets are rejected without consuming the card', () => {
  const initial = fixture();
  for (const claim of [
    { kind: 'dial', compare: 'eq', value: NaN },
    { kind: 'dial', compare: 'eq', value: 0.3 },
    { kind: 'support', compare: 'eq', value: 0.5 },
    { kind: 'leader', leader: 'fake' },
    { kind: 'weapon', name: 'fake' },
    { kind: 'kwisatz', use: 'yes' },
    { kind: 'and', terms: [] },
  ])
    assert.throws(() => ask(initial, claim as PlanClaim), RuleError);
  assert.throws(() => ask(initial, minimum, 'b'), /combatant/);
  assert.equal(initial.discard.length, 0);
});
void test('all AI levels can choose battle answers and seal compliant plans even for uncommon exact dials', () => {
  for (const level of DIFFICULTIES) {
    const initial = fixture();
    initial.players[1].bot = level;
    const pending = ask(initial, minimum);
    const a = botActions(viewGame(pending, 'e'))[0];
    assert.equal(a.type, 'truthAnswer');
    assert.ok(applyAction(pending, 'e', a).battle!.truthPromises!.length);
    const g = promise(initial, { kind: 'dial', compare: 'eq', value: 2 });
    let committed: Game | undefined;
    for (const action of botActions(viewGame(g, 'e'))) {
      try {
        committed = applyAction(g, 'e', action);
        break;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
      }
    }
    assert.ok(committed, level);
    assert.equal(committed.battle!.plans.e.dial, 2);
    assert.equal(
      matchesPlanClaim(
        g.battle!.truthPromises![0].claim,
        { ...committed.battle!.plans.e, kwisatz: false },
        g.players[1].hand,
      ),
      true,
    );
  }
});
void test('verified answer choices match an exhaustive authoritative basic-plan oracle', () => {
  const initial = fixture();
  initial.players[1].forces = { 'arrakeen:10': 2 };
  initial.players[1].reserves = 18;
  const legal: Plan[] = [];
  const hand = initial.players[1].hand;
  for (const dial of [0, 1, 2])
    for (const leader of initial.players[1].leaders.map((l) => l.id))
      for (const weapon of [null, ...hand.map((c) => c.id)])
        for (const defense of [null, ...hand.map((c) => c.id)]) {
          try {
            const g = applyAction(
              initial,
              'e',
              plan(initial, { dial, leader, weapon, defense }),
            );
            legal.push({ ...g.battle!.plans.e, kwisatz: false });
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
          }
        }
  assert.ok(legal.length > 0);
  const claims: PlanClaim[] = [
    { kind: 'dial', compare: 'gte', value: 3 },
    { kind: 'dial', compare: 'eq', value: 1 },
    { kind: 'support', compare: 'gte', value: 1 },
    { kind: 'leader', leader: null },
    { kind: 'kwisatz', use: true },
    { kind: 'weapon', name: 'Gom Jabbar' },
    { kind: 'defense', name: 'Gom Jabbar' },
    {
      kind: 'or',
      terms: [
        { kind: 'dial', compare: 'eq', value: 2 },
        { kind: 'defense', name: 'Shield' },
      ],
    },
    {
      kind: 'and',
      terms: [
        { kind: 'weapon', name: 'Gom Jabbar' },
        { kind: 'defense', name: 'Shield' },
      ],
    },
  ];
  for (const claim of claims) {
    const expected = [
      ...new Set(
        legal.map((plan) =>
          matchesPlanClaim(claim, plan, hand) ? 'yes' : 'no',
        ),
      ),
    ].sort();
    const pending = ask(initial, claim);
    assert.deepEqual(
      viewGame(pending, 'e').truthBattleAnswers!.sort(),
      expected,
      JSON.stringify(claim),
    );
  }
});
void test('canceling Fremen free support releases a dial promise only when no supported completion remains', () => {
  for (const spice of [0, 6]) {
    const initial = fixture(true);
    const fremen = initial.players[1];
    fremen.faction = 'fremen';
    fremen.leaders = leaders('fremen');
    fremen.spice = spice;
    const karama = hold(initial, 'a', 'Karama');
    const g = promise(initial, { kind: 'dial', compare: 'eq', value: 6 });
    g.response = { kind: 'fremenSupport', owner: 'e', passed: [] };
    const canceled = applyAction(g, 'a', {
      type: 'card',
      mode: 'cancel',
      card: karama,
    });
    assert.equal(canceled.battle!.fremenSupportBlocked, true);
    assert.equal(!!canceled.battle!.truthPromises![0].released, spice === 0);
    if (spice) {
      const legal = viewGame(canceled, 'e').battle!.compliantPlan!;
      assert.equal(legal.dial, 6);
      assert.equal(legal.support, 6);
      assert.ok(
        applyAction(canceled, 'e', { type: 'battlePlan', ...legal }).battle!
          .plans.e,
      );
    }
  }
});
void test('canceling elite strength updates battle-promise feasibility without losing physical forces', () => {
  const initial = fixture(true);
  const emperor = initial.players[1];
  emperor.forces = { 'arrakeen:10': 2 };
  emperor.reserves = 18;
  emperor.elites = {
    reserves: 4,
    tanks: 0,
    forces: { 'arrakeen:10': 1 },
    revived: 0,
  };
  const karama = hold(initial, 'a', 'Karama');
  const g = promise(initial, { kind: 'dial', compare: 'eq', value: 3 });
  g.response = { kind: 'eliteStrength', owner: 'e', passed: [] };
  const canceled = applyAction(g, 'a', {
    type: 'card',
    mode: 'cancel',
    card: karama,
  });
  assert.equal(canceled.battle!.truthPromises![0].released, true);
  assert.deepEqual(canceled.players[1].forces, emperor.forces);
  assert.deepEqual(canceled.players[1].elites, emperor.elites);
});
