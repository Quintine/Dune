import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  joinGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const cards = baseDeck();
const karama = cards.find((c) => c.effect === 'karama')!;
const poison = cards.find((c) => c.kind === 'poison')!;
const shield = cards.find((c) => c.kind === 'shield')!;
const snooper = cards.find((c) => c.kind === 'snooper')!;
const worthless = cards.find((c) => c.kind === 'worthless')!;
function fixture(outsider = false) {
  let g = createGame('FULLPLAN', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 3 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.advanced = true;
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
  }
  g.players[0].hand = [karama, snooper];
  g.players[1].hand = [poison, shield, worthless];
  g.discard = [];
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
