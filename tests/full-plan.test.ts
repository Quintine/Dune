import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  newPlayer,
  joinGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { PlanClaim } from '../game/battle-promises';
const cards = baseDeck();
const karama = cards.find((c) => c.effect === 'karama')!;
const poison = cards.find((c) => c.kind === 'poison')!;
const shield = cards.find((c) => c.kind === 'shield')!;
const snooper = cards.find((c) => c.kind === 'snooper')!;
const worthless = cards.find((c) => c.kind === 'worthless')!;
function fixture(outsider = false) {
  let g = createGame('FULLPLAN', newPlayer('a', 'Atreides', 'atreides'), true);
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  g.players.forEach((p) => (p.ready = true));
  g = initializeBaseGameForAudit(g);
  g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 3 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g = applyAction(g, 'b', {
    type: 'advisorSetup',
    territory: 'polar_sink',
    sector: 0,
  });
  assert.equal(g.status, 'playing');
  assert.equal(g.advanced, true);
  g.phase = 6;
  g.active = outsider ? 'e' : 'a';
  g.order = outsider ? ['e', 'g', 'a', 'b'] : ['a', 'e', 'g', 'b'];
  g.storm = 18;
  for (const p of g.players) {
    const combatant = p.id === 'e' || p.id === (outsider ? 'g' : 'a');
    p.forces = combatant ? { 'arrakeen:10': 5 } : {};
    p.reserves = combatant ? 15 : 20;
    p.spice = 10;
    p.hand = [];
    p.traitors = [];
    p.advisors = {};
    if (p.elites) {
      p.elites.reserves = 5;
      p.elites.tanks = 0;
      p.elites.forces = {};
    }
  }
  g.players[0].hand = [karama, snooper];
  g.players[1].hand = [poison, shield, worthless];
  g.discard = [];
  const held = new Set(g.players.flatMap((p) => p.hand.map((c) => c.id)));
  g.deck = baseDeck().filter((c) => !held.has(c.id));
  g.traitorReserve = g.players.flatMap((p) => p.leaders.map((l) => l.id));
  return g;
}
function responses(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function choose(g: Game) {
  return applyAction(g, g.active!, {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: g.active === 'a' ? 'e' : 'g',
  });
}
function offer(state = fixture()) {
  let g = responses(choose(state));
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  return g;
}
const inspect = (g: Game, target = 'e') =>
  applyAction(g, 'a', {
    type: 'card',
    mode: 'special',
    card: karama.id,
    target,
  });
const targetPlan: Action = {
  type: 'battlePlan',
  dial: 2.5,
  support: 2,
  leader: 'emperor-0',
  weapon: poison.id,
  defense: shield.id,
};
const ownPlan: Action = {
  type: 'battlePlan',
  dial: 1,
  support: 1,
  leader: 'atreides-0',
  defense: snooper.id,
};
void test('full-plan offer follows Voice and the answer to ordinary prescience', () => {
  const before = fixture();
  before.players[0].ally = 'b';
  before.players[3].ally = 'a';
  let g = responses(choose(before));
  assert.equal(g.battle?.preparation?.kind, 'voice');
  assert.equal(g.decision, null);
  assert.throws(() => inspect(g), /preparation/);
  g = applyAction(g, 'b', { type: 'voice', kind: 'snooper', must: false });
  g = responses(g);
  g = applyAction(g, 'a', { type: 'prescience', field: 'weapon' });
  assert.throws(() => inspect(g), /preparation/);
  g = responses(g);
  assert.equal(g.decision, null);
  g = applyAction(g, 'e', { type: 'prescienceAnswer', value: poison.id });
  assert.deepEqual(g.decision, { kind: 'fullPlanOffer', player: 'a' });
  assert.equal(g.battle?.preparation, undefined);
  g = inspect(g);
  assert.throws(
    () => applyAction(g, 'e', { ...targetPlan, weapon: null }),
    /remain unchanged/,
  );
  assert.throws(() =>
    applyAction(g, 'e', { ...targetPlan, defense: snooper.id }),
  );
  g = applyAction(g, 'e', targetPlan);
  assert.equal(g.decision, null);
});
void test('target commits first and only Atreides receives the inspected plan and its selected cards', () => {
  const offered = offer();
  const g = inspect(offered);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(
    g.players[0].hand.some((c) => c.id === karama.id),
    false,
  );
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.discard.filter((c) => c.id === karama.id).length, 1);
  assert.throws(() => applyAction(g, 'a', ownPlan), /requested by special/);
  const sealed = applyAction(g, 'e', targetPlan);
  assert.equal(sealed.battle?.revealed, false);
  assert.equal(sealed.players[1].spice, 10);
  const atreides = viewGame(JSON.parse(JSON.stringify(sealed)), 'a');
  assert.deepEqual(
    atreides.battle?.fullPlanInsight?.plan,
    sealed.battle!.plans.e,
  );
  assert.deepEqual(
    new Set(atreides.battle?.fullPlanInsight?.cards.map((c) => c.id)),
    new Set([poison.id, shield.id]),
  );
  assert.equal(atreides.players[1].hand, undefined);
  assert.equal(atreides.battle?.plans.e, undefined);
  for (const id of ['e', 'g', 'b'])
    assert.equal(viewGame(sealed, id).battle?.fullPlanInsight, null);
  assert.deepEqual(
    viewGame(sealed, 'e').battle?.plans.e,
    sealed.battle?.plans.e,
  );
  assert.equal(viewGame(sealed, 'g').battle?.plans.e, undefined);
  assert.ok(
    sealed.log.every(
      (l) => !l.text.includes(poison.name) && !l.text.includes('2.5'),
    ),
  );
});
void test('inspection needs no acknowledgement and public reveal waits for the second committed plan', () => {
  const reading = applyAction(inspect(offer()), 'e', targetPlan);
  assert.equal(reading.decision, null);
  for (const id of ['g', 'a'])
    assert.throws(
      () => applyAction(reading, id, { type: 'decision', continue: true }),
      /not available/,
    );
  const reconnected = JSON.parse(JSON.stringify(reading)) as Game;
  assert.equal(reconnected.battle?.revealed, false);
  assert.throws(
    () => applyAction(reconnected, 'e', { ...targetPlan, dial: 1 }),
    /not available/,
  );
  const revealed = applyAction(reconnected, 'a', ownPlan);
  assert.equal(revealed.battle?.revealed, true);
  assert.deepEqual(
    viewGame(revealed, 'g').battle?.plans.e,
    reading.battle?.plans.e,
  );
  assert.equal(viewGame(revealed, 'a').battle?.fullPlanInsight, null);
});

void test('Atreides may inspect an unrelated battle without giving its ally the private plan', () => {
  let g = offer(fixture(true));
  g.players[0].ally = 'b';
  g.players[3].ally = 'a';
  g = inspect(g, 'g');
  assert.throws(() => applyAction(g, 'e', targetPlan), /requested by special/);
  g = applyAction(g, 'g', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: 'guild-0',
  });
  assert.equal(viewGame(g, 'a').battle?.fullPlanInsight?.target, 'g');
  assert.equal(viewGame(g, 'b').battle?.fullPlanInsight, null);
  assert.equal(viewGame(g, 'e').battle?.fullPlanInsight, null);
  g = applyAction(g, 'e', targetPlan);
  assert.equal(g.battle?.revealed, true);
});
void test('declining preserves the power and card, offers independently of hidden cards, and cannot be reopened mid-battle', () => {
  const before = fixture();
  const offered = offer(before);
  before.players[0].hand = [];
  assert.deepEqual(offer(before).decision, offered.decision);
  const declined = applyAction(offered, 'a', {
    type: 'decision',
    decline: true,
  });
  assert.equal(declined.players[0].specialKaramaUsed, undefined);
  assert.ok(declined.players[0].hand.some((c) => c.id === karama.id));
  assert.throws(() => inspect(declined), /preparation/);
  assert.ok(applyAction(declined, 'a', ownPlan).battle?.plans.a);
});
void test('ordinary prescience cancellation does not suppress special inspection', () => {
  let g = responses(choose(fixture()));
  const otherKarama = cards.find(
    (c) => c.effect === 'karama' && c.id !== karama.id,
  )!;
  g.players[2].hand = [otherKarama];
  g = applyAction(g, 'a', { type: 'prescience', field: 'leader' });
  g = applyAction(g, 'g', {
    type: 'card',
    mode: 'cancel',
    card: otherKarama.id,
  });
  assert.equal(g.battle?.prescience, undefined);
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  g = inspect(g);
  assert.equal(g.battle?.fullPlan?.target, 'e');
  assert.equal(g.response, null);
});
void test('invalid target, phase, card, and answer choices preserve state atomically', () => {
  const g = offer();
  const copy = structuredClone(g);
  assert.throws(() => inspect(g, 'b'), /in this battle/);
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'card',
        mode: 'special',
        card: snooper.id,
        target: 'e',
      }),
    /Karama card/,
  );
  const basic = structuredClone(g);
  basic.advanced = false;
  assert.throws(() => inspect(basic), /advanced game/);
  assert.deepEqual(g, copy);
  const waiting = inspect(g);
  for (const extra of [
    { dial: 9 },
    { support: 11 },
    { leader: 'guild-0' },
    { weapon: shield.id },
    { defense: poison.id },
    { kwisatz: true },
  ])
    assert.throws(() => applyAction(waiting, 'e', { ...targetPlan, ...extra }));
  assert.deepEqual(waiting.battle?.plans, {});
  assert.equal(waiting.players[1].spice, 10);
});
void test('once-per-game usage survives later battles and does not offer special prescience in basic mode', () => {
  let g = inspect(offer());
  g.battle = null;
  g.turn++;
  g.active = 'a';
  g = responses(choose(g));
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  assert.equal(g.decision, null);
  assert.throws(() => inspect(g), /already been used/);
  const basic = fixture();
  basic.advanced = false;
  assert.equal(offer(basic).decision, null);
});
void test('selected Worthless cards cannot be converted to Karama after the inspected plan is committed', () => {
  const before = fixture();
  before.players[1].forces = {};
  before.players[1].reserves = 20;
  before.players[3].forces = { 'arrakeen:10': 5 };
  before.players[3].reserves = 15;
  before.players[3].hand = [worthless];
  let g = responses(
    applyAction(before, 'a', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'b',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  g = inspect(g, 'b');
  g = applyAction(g, 'b', {
    ...targetPlan,
    leader: 'beneGesserit-0',
    weapon: worthless.id,
    defense: null,
  });
  g.response = { kind: 'guildIncome', owner: 'g', amount: 1, passed: [] };
  assert.throws(
    () =>
      applyAction(g, 'b', { type: 'card', mode: 'cancel', card: worthless.id }),
    /sealed battle card/,
  );
});
void test('AI initiates, answers and uses full-plan inspection at every difficulty using private views', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    before.players[0].bot = difficulty;
    before.players[1].bot = difficulty;
    let g = offer(before);
    const special = botActions(viewGame(g, 'a'))[0];
    assert.equal(special.mode, 'special');
    g = applyAction(g, 'a', special);
    assert.deepEqual(botActions(viewGame(g, 'a')), []);
    const candidates = botActions(viewGame(g, 'e'));
    let answered: Game | undefined;
    for (const action of candidates) {
      try {
        answered = applyAction(g, 'e', action);
        break;
      } catch {}
    }
    assert.ok(answered, difficulty);
    g = answered;
    assert.equal(g.decision, null);
    assert.ok(
      botActions(viewGame(g, 'a')).some((a) => a.type === 'battlePlan'),
    );
    const empty = offer(before);
    empty.players[0].hand = [];
    assert.deepEqual(botActions(viewGame(empty, 'a'))[0], {
      type: 'decision',
      decline: true,
    });
  }
});
void test('Hard Atreides uses inspected weapon and dial while unseen cards and traitors cannot influence its plan', () => {
  const before = fixture();
  before.players[0].bot = 'Hard';
  let g = applyAction(inspect(offer(before)), 'e', targetPlan);
  const first = botActions(viewGame(g, 'a'));
  const legal = first.find((action) => {
    try {
      applyAction(g, 'a', action);
      return true;
    } catch {
      return false;
    }
  });
  assert.equal(legal?.defense, snooper.id);
  assert.equal(legal?.dial, 3.5); // Emperor leader 6 + dial 2.5 ties Atreides leader 5 + dial 3.5.
  g = structuredClone(g);
  g.players[1].hand = [
    poison,
    shield,
    ...cards.filter((c) => c.kind === 'hero').slice(0, 1),
  ];
  g.players[1].traitors = ['atreides-0'];
  g.deck.reverse();
  assert.deepEqual(botActions(viewGame(g, 'a')), first);
});
void test('full inspection includes KH and can target either combatant under any-player wording', () => {
  const before = fixture();
  before.players[0].battleLosses = 7;
  let g = inspect(offer(before), 'a');
  g = applyAction(g, 'a', { ...ownPlan, kwisatz: true });
  assert.equal(viewGame(g, 'a').battle?.fullPlanInsight?.plan.kwisatz, true);
  assert.equal(viewGame(g, 'e').battle?.plans.a, undefined);
  g = applyAction(g, 'e', targetPlan);
  assert.equal(g.battle?.revealed, true);
  assert.equal(viewGame(g, 'g').battle?.plans.a.kwisatz, true);
});

function take(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function question(g: Game, claim: PlanClaim) {
  g = applyAction(g, 'a', {
    type: 'card',
    card: g.players[0].hand.find((c) => c.effect === 'truthtrance')!.id,
  });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'battlePlan', target: 'e', claim },
  });
}
function answer(g: Game, value: 'yes' | 'no' = 'yes') {
  return applyAction(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'truthAnswer',
    answer: value,
  });
}
function unchanged(g: Game, id: string, action: Action) {
  const copy = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, copy);
}
function custody(g: Game) {
  const all = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(all.length, new Set(all).size);
  return all;
}

void test('Truthtrance and Ghola survive Voice, ordinary prescience and full-plan inspection from genuine Advanced setup', () => {
  for (const level of DIFFICULTIES) {
    const initial = fixture();
    initial.players[0].ally = 'b';
    initial.players[3].ally = 'a';
    initial.players[1].bot = level;
    initial.players[1].leaders[0].dead = true;
    initial.players[1].leaders[0].deaths = 1;
    take(initial, 'a', 'Truthtrance');
    const ghola = take(initial, 'e', 'Tleilaxu Ghola');
    const ids = custody(initial);
    let g = responses(choose(initial));
    assert.equal(g.battle?.preparation?.kind, 'voice');
    const originalPreparation = structuredClone(g.battle!.preparation);
    g = question(g, {
      kind: 'and',
      terms: [
        { kind: 'leader', leader: 'emperor-0' },
        { kind: 'weapon', name: poison.name },
      ],
    });
    assert.deepEqual(viewGame(g, 'e').truthBattleAnswers, ['yes', 'no']);
    assert.deepEqual(g.battle!.preparation, originalPreparation);
    unchanged(g, 'e', { type: 'card', card: ghola, leader: 'emperor-0' });
    g = answer(g);
    g = responses(
      applyAction(g, 'b', { type: 'voice', kind: 'snooper', must: false }),
    );
    g = responses(applyAction(g, 'a', { type: 'prescience', field: 'leader' }));
    g = applyAction(g, 'e', { type: 'prescienceAnswer', value: 'emperor-0' });
    assert.equal(g.decision?.kind, 'fullPlanOffer');
    assert.equal(g.battle!.truthPromises![0].released, undefined);
    assert.equal(g.players[1].leaders[0].dead, true);
    g = inspect(g);
    const actions = botActions(viewGame(g, 'e'));
    assert.equal(actions[0].type, 'card', level);
    assert.equal(actions[0].card, ghola, level);
    assert.equal(actions[0].leader, 'emperor-0', level);
    for (const id of ['a', 'g', 'b'])
      assert.equal(viewGame(g, id).battle!.compliantPreparation, null);
    g = applyAction(g, 'e', actions[0]);
    unchanged(g, 'e', { ...targetPlan, leader: 'emperor-1' });
    unchanged(g, 'e', { ...targetPlan, weapon: null });
    g = applyAction(g, 'e', targetPlan);
    assert.equal(
      viewGame(g, 'a').battle!.fullPlanInsight?.plan.leader,
      'emperor-0',
    );
    assert.equal(g.battle!.revealed, false);
    assert.equal(g.decision, null);
    g = applyAction(JSON.parse(JSON.stringify(g)), 'a', ownPlan);
    assert.equal(g.battle!.revealed, true);
    assert.deepEqual(custody(g), ids);
    assert.equal(g.discard.filter((c) => c.id === ghola).length, 1);
  }
});

void test('Truthtrance at the special offer preserves the offer and both revival-dependent answers until a real plan is sealed', () => {
  for (const useSpecial of [false, true]) {
    const before = fixture();
    take(before, 'a', 'Truthtrance');
    const ghola = take(before, 'e', 'Tleilaxu Ghola');
    before.players[1].leaders[0].dead = true;
    before.players[1].leaders[0].deaths = 1;
    let g = offer(before);
    const offered = structuredClone(g.decision);
    g = question(g, { kind: 'leader', leader: 'emperor-0' });
    assert.deepEqual(viewGame(g, 'e').truthBattleAnswers, ['yes', 'no']);
    g = answer(g);
    assert.deepEqual(g.decision, offered);
    unchanged(g, 'e', targetPlan);
    g = useSpecial
      ? inspect(g)
      : applyAction(g, 'a', { type: 'decision', decline: true });
    assert.equal(g.battle!.truthPromises![0].released, undefined);
    g = applyAction(g, 'e', { type: 'card', card: ghola, leader: 'emperor-0' });
    g = applyAction(g, 'e', targetPlan);
    assert.equal(!!viewGame(g, 'a').battle!.fullPlanInsight, useSpecial);
    assert.equal(!!g.players[0].specialKaramaUsed, useSpecial);
  }
});

void test('Truthtrance after inspection reports only the sealed plan and cannot reopen its fields or physical card custody', () => {
  const before = fixture();
  take(before, 'a', 'Truthtrance');
  take(before, 'a', 'Truthtrance');
  let g = applyAction(inspect(offer(before)), 'e', targetPlan);
  const sealed = structuredClone(g.battle!.plans.e),
    ids = custody(g);
  for (const [claim, expected] of [
    [{ kind: 'weapon', name: poison.name }, 'yes'],
    [{ kind: 'dial', compare: 'eq', value: 1 }, 'no'],
  ] as const) {
    g = question(g, claim);
    assert.deepEqual(viewGame(g, 'e').truthBattleAnswers, [expected]);
    unchanged(g, 'e', {
      type: 'truthAnswer',
      answer: expected === 'yes' ? 'no' : 'yes',
    });
    g = answer(g, expected);
    assert.deepEqual(g.battle!.plans.e, sealed);
    assert.equal(g.battle!.truthPromises?.length ?? 0, 0);
    assert.deepEqual(viewGame(g, 'a').battle!.fullPlanInsight?.plan, sealed);
    for (const id of ['g', 'b']) {
      assert.equal(viewGame(g, id).battle!.fullPlanInsight, null);
      assert.equal(viewGame(g, id).battle!.plans.e, undefined);
    }
  }
  unchanged(g, 'e', { ...targetPlan, defense: null });
  unchanged(g, 'e', { type: 'bribe', target: 'g', amount: 9 });
  assert.deepEqual(custody(g), ids);
  g = applyAction(g, 'a', ownPlan);
  assert.equal(g.battle!.revealed, true);
  assert.deepEqual(g.battle!.plans.e, sealed);
});

void test('Truthtrance suspends and restores every native pre-plan window without choosing or dropping another power', () => {
  const initial = fixture();
  initial.players[0].ally = 'b';
  initial.players[3].ally = 'a';
  take(initial, 'a', 'Truthtrance');
  take(initial, 'g', 'Karama');
  let g = responses(choose(initial));
  const frames = [g]; // Voice selection.
  g = applyAction(g, 'b', { type: 'voice', kind: 'snooper', must: false });
  frames.push(g); // Voice cancellation response.
  g = responses(g);
  frames.push(g); // Prescience selection.
  g = applyAction(g, 'a', { type: 'prescience', field: 'defense' });
  frames.push(g); // Prescience cancellation response.
  g = responses(g);
  frames.push(g); // Prescience answer.
  g = applyAction(g, 'e', { type: 'prescienceAnswer', value: shield.id });
  frames.push(g); // Special full-plan offer.
  frames.push(inspect(g)); // Special chosen; target has not sealed.
  for (const frame of frames) {
    const copy = structuredClone(frame);
    const asked = question(frame, { kind: 'defense', name: 'Shield' });
    assert.ok(viewGame(asked, 'e').truthBattleAnswers!.includes('yes'));
    const resumed = answer(asked);
    for (const key of [
      'response',
      'decision',
      'active',
      'phase',
      'turn',
    ] as const)
      assert.deepEqual(resumed[key], frame[key], key);
    for (const key of [
      'preparation',
      'prescience',
      'voice',
      'fullPlan',
      'plans',
    ] as const)
      assert.deepEqual(resumed.battle![key], frame.battle![key], key);
    assert.deepEqual(frame, copy);
    assert.equal(resumed.battle!.truthPromises![0].released, undefined);
    assert.equal(
      resumed.players[0].specialKaramaUsed,
      frame.players[0].specialKaramaUsed,
    );
    assert.deepEqual(custody(resumed), custody(frame));
  }
});

void test('Atreides may revive its own leader after reading the target plan without changing or redisclosing that plan', () => {
  const initial = fixture();
  const ghola = take(initial, 'a', 'Tleilaxu Ghola');
  initial.players[0].leaders[0].dead = true;
  initial.players[0].leaders[0].deaths = 1;
  let g = applyAction(inspect(offer(initial)), 'e', targetPlan);
  const inspected = structuredClone(viewGame(g, 'a').battle!.fullPlanInsight);
  const ids = custody(g);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'a', {
    type: 'card',
    card: ghola,
    leader: 'atreides-0',
  });
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].leaderRevived, false);
  assert.deepEqual(viewGame(g, 'a').battle!.fullPlanInsight, inspected);
  for (const id of ['e', 'g', 'b'])
    assert.equal(viewGame(g, id).battle!.fullPlanInsight, null);
  assert.equal(g.discard.filter((c) => c.id === ghola).length, 1);
  assert.deepEqual(custody(g), ids);
  g = applyAction(g, 'a', ownPlan);
  assert.equal(g.battle!.plans.a.leader, 'atreides-0');
  assert.equal(g.battle!.revealed, true);
});
