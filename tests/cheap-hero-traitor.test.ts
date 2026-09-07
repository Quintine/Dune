import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import {
  CHEAP_HERO_TRAITOR,
  matchingTraitor,
  traitorDeck,
} from '../game/traitors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const heroes = baseDeck().filter((c) => c.kind === 'hero');
/** Assign fixture cards by transferring their exact physical IDs from the deck. */
function setHand(g: Game, index: number, selected: Card[]) {
  const owner = g.players[index];
  const ids = new Set(selected.map((c) => c.id));
  assert.equal(ids.size, selected.length);
  const held = new Map(owner.hand.map((c) => [c.id, c]));
  for (const previous of owner.hand)
    if (!ids.has(previous.id)) g.deck.push(previous);
  owner.hand = selected.map((wanted) => {
    if (held.has(wanted.id)) return held.get(wanted.id)!;
    assert.ok(
      !g.players.some(
        (p, i) => i !== index && p.hand.some((c) => c.id === wanted.id),
      ),
      `Another player owns ${wanted.id}`,
    );
    const at = g.deck.findIndex((c) => c.id === wanted.id);
    assert.ok(at >= 0, `Fixture deck must contain ${wanted.id}`);
    return g.deck.splice(at, 1)[0];
  });
}
function fixture(harkonnen = false) {
  let g = createGame('HEROTRAITOR2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  if (harkonnen) joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.phase = 6;
  g.active = 'a';
  g.order = g.players.map((p) => p.id);
  g.storm = 18;
  // Return dealt cards before replacing setup hands for this battle fixture.
  g.deck.push(...g.players.flatMap((p) => p.hand));
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = p.id === 'h' ? {} : { 'arrakeen:10': 5 };
    p.reserves = p.id === 'h' ? 20 : 15;
  }
  if (harkonnen) {
    g.players[0].ally = 'h';
    g.players[2].ally = 'a';
  }
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
function prepared(state: Game) {
  let g = allow(
    applyAction(state, 'a', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'e',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function plans(state: Game, a: object = {}, e: object = {}) {
  const g = applyAction(prepared(state), 'a', {
    type: 'battlePlan',
    leader: 'atreides-0',
    dial: 0,
    ...a,
  });
  return applyAction(g, 'e', {
    type: 'battlePlan',
    leader: heroes[0].id,
    dial: 5,
    ...e,
  });
}
function call(g: Game, id: string, reveal: boolean) {
  return applyAction(g, id, { type: 'traitorCall', call: reveal });
}
void test('one expansion traitor identity matches either hero and adds no leader disc', () => {
  const g = fixture();
  assert.equal(traitorDeck(g.players).length, 10);
  assert.equal(traitorDeck(g.players, true).length, 11);
  assert.equal(
    traitorDeck(g.players, true).filter((id) => id === CHEAP_HERO_TRAITOR)
      .length,
    1,
  );
  for (const c of heroes)
    assert.equal(
      matchingTraitor([CHEAP_HERO_TRAITOR], c.id, c),
      CHEAP_HERO_TRAITOR,
    );
  assert.equal(matchingTraitor([CHEAP_HERO_TRAITOR], 'emperor-0'), undefined);
  assert.equal(
    g.players
      .flatMap((p) => p.leaders)
      .some((l) => l.id === CHEAP_HERO_TRAITOR),
    false,
  );
});
void test('dealt Cheap Hero traitor is selectable and private during setup', () => {
  let g = fixture();
  g.status = 'setup';
  g.players[0].traitorChoices = [
    CHEAP_HERO_TRAITOR,
    'emperor-0',
    'emperor-1',
    'emperor-2',
  ];
  g = applyAction(g, 'a', { type: 'traitor', leader: CHEAP_HERO_TRAITOR });
  assert.deepEqual(viewGame(g, 'a').players[0].traitors, [CHEAP_HERO_TRAITOR]);
  assert.equal(viewGame(g, 'e').players[0].traitors, undefined);
  assert.deepEqual(viewGame(g, 'e').players[0].revealedTraitors, []);
});
for (const hero of heroes)
  void test(`${hero.name} loses to its shared traitor with zero bounty and no dead leader disc`, () => {
    const before = fixture();
    setHand(before, 1, [hero]);
    before.players[0].traitors = [CHEAP_HERO_TRAITOR, 'emperor-1'];
    let g = plans(before, {}, { leader: hero.id });
    g = call(g, 'a', true);
    assert.deepEqual(viewGame(g, 'e').players[0].revealedTraitors, []);
    g = call(JSON.parse(JSON.stringify(g)), 'e', false);
    assert.equal(g.players[0].forces['arrakeen:10'], 5);
    assert.equal(g.players[1].tanks, 5);
    assert.equal(g.players[0].spice, 20);
    assert.ok(g.players.every((p) => p.leaders.every((l) => !l.dead)));
    assert.ok(g.discard.some((c) => c.id === hero.id));
    assert.deepEqual(g.players[0].traitors, [CHEAP_HERO_TRAITOR, 'emperor-1']);
    for (const p of g.players)
      assert.deepEqual(viewGame(g, p.id).players[0].revealedTraitors, [
        CHEAP_HERO_TRAITOR,
      ]);
    assert.equal(viewGame(g, 'e').players[0].traitors, undefined);
  });
void test('repeated hero traitor use retains one public identity', () => {
  const before = fixture();
  before.players[0].revealedTraitors = [CHEAP_HERO_TRAITOR];
  before.players[0].traitors = [CHEAP_HERO_TRAITOR];
  setHand(before, 1, [heroes[1]]);
  const g = call(
    call(plans(before, {}, { leader: heroes[1].id }), 'a', true),
    'e',
    false,
  );
  assert.deepEqual(g.players[0].revealedTraitors, [CHEAP_HERO_TRAITOR]);
  assert.deepEqual(g.players[0].traitors, [CHEAP_HERO_TRAITOR]);
});
void test('wrong traitor and ordinary leader targets are rejected without mutation', () => {
  const before = fixture();
  setHand(before, 1, [heroes[0]]);
  let g = plans(before);
  const snapshot = structuredClone(g);
  assert.throws(() => call(g, 'a', true), /do not hold/);
  assert.deepEqual(g, snapshot);
  before.players[0].traitors = [CHEAP_HERO_TRAITOR];
  g = plans(before, {}, { leader: 'emperor-0' });
  assert.throws(() => call(g, 'a', true), /do not hold/);
});
void test('Kwisatz Haderach protects an accompanying Cheap Hero against the shared traitor', () => {
  const before = fixture();
  before.advanced = true;
  before.players[0].battleLosses = 7;
  setHand(before, 0, [heroes[0]]);
  before.players[1].traitors = [CHEAP_HERO_TRAITOR];
  const g = plans(
    before,
    { leader: heroes[0].id, kwisatz: true },
    { leader: 'emperor-0', dial: 0 },
  );
  assert.throws(() => call(g, 'e', true), /Kwisatz Haderach/);
});
void test('Harkonnen can call the hero traitor for an ally after the Karama response', () => {
  const before = fixture(true);
  setHand(before, 1, [
    heroes[0],
    baseDeck().find((c) => c.effect === 'karama')!,
  ]);
  before.players[2].traitors = [CHEAP_HERO_TRAITOR];
  let g = call(call(plans(before), 'a', false), 'e', false);
  g = call(g, 'h', true);
  assert.equal(g.response?.kind, 'harkonnenTraitor');
  assert.equal(g.players[1].tanks, 0);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(g.players[2].revealedTraitors, [CHEAP_HERO_TRAITOR]);
});
void test('Karama cancels the Harkonnen ally call before the battle resolves', () => {
  const before = fixture(true);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  setHand(before, 1, [heroes[0], karama]);
  before.players[2].traitors = [CHEAP_HERO_TRAITOR];
  let g = call(
    call(call(plans(before, {}, { dial: 0 }), 'a', false), 'e', false),
    'h',
    true,
  );
  g = applyAction(g, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.deepEqual(g.players[2].revealedTraitors ?? [], []);
  assert.deepEqual(g.players[2].traitors, [CHEAP_HERO_TRAITOR]);
  assert.equal(g.response, null);
});
void test('simultaneous hero and leader traitors destroy both armies', () => {
  const before = fixture();
  setHand(before, 1, [heroes[0]]);
  before.players[0].traitors = [CHEAP_HERO_TRAITOR];
  before.players[1].traitors = ['atreides-0'];
  const g = call(call(plans(before), 'a', true), 'e', true);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.ok(g.players[1].leaders.every((l) => !l.dead));
  assert.deepEqual(g.players[1].revealedTraitors, ['atreides-0']);
});
void test('all bot levels can select the new traitor and call it from their private view', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    before.players[0].bot = difficulty;
    const setup = structuredClone(before);
    setup.status = 'setup';
    setup.players[0].traitorChoices = [CHEAP_HERO_TRAITOR];
    assert.ok(
      botActions(viewGame(setup, 'a')).some(
        (a) => a.type === 'traitor' && a.leader === CHEAP_HERO_TRAITOR,
      ),
    );
    before.players[0].traitors = [CHEAP_HERO_TRAITOR];
    setHand(before, 1, [heroes[0]]);
    const g = plans(before);
    assert.ok(
      botActions(viewGame(g, 'a')).some(
        (a) => a.type === 'traitorCall' && a.call === true,
      ),
      difficulty,
    );
  }
});
void test('Hard and Brutal avoid a publicly exposed leader held by the opponent or its Harkonnen ally', () => {
  for (const difficulty of ['Hard', 'Brutal'] as const)
    for (const alliedHolder of [false, true]) {
      const before = fixture(alliedHolder);
      before.players[0].bot = difficulty;
      if (alliedHolder) {
        before.players[0].ally = null;
        before.players[1].ally = 'h';
        before.players[2].ally = 'e';
      }
      const strongest = [...before.players[0].leaders].sort(
        (a, b) => b.strength - a.strength,
      )[0];
      before.players[alliedHolder ? 2 : 1].revealedTraitors = [strongest.id];
      const g = prepared(before);
      const choices = botActions(viewGame(g, 'a')).filter(
        (a) => a.type === 'battlePlan',
      );
      assert.ok(choices.length > 0);
      assert.notEqual(
        choices[0].leader,
        strongest.id,
        `${difficulty}: ${alliedHolder}`,
      );
      assert.doesNotThrow(() => applyAction(g, 'a', choices[0]));
      // Unrevealed holdings cannot influence the personalized policy.
      const privateChanged = structuredClone(g);
      privateChanged.players[1].traitors = ['atreides-1'];
      assert.deepEqual(
        botActions(viewGame(privateChanged, 'a')),
        botActions(viewGame(g, 'a')),
      );
    }
});
