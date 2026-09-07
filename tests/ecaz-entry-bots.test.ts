import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAmbassadors,
  validateAmbassadors,
  type AmbassadorEffect,
} from '../game/ecaz-ambassadors';

function fixture(effect: AmbassadorEffect = 'emperor') {
  const g = createGame('ECAZBOTS', newPlayer('ecaz', 'Ecaz', 'ecaz'));
  g.players.push(
    newPlayer(
      'entrant',
      'Entrant',
      effect === 'atreides' ? 'emperor' : 'atreides',
    ),
    newPlayer('ally', 'Ally', 'harkonnen'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['entrant', 'ecaz', 'ally'];
  g.active = 'entrant';
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [p.leaders[0].id];
  }
  for (const p of g.players) {
    for (const kind of p.id === 'entrant'
      ? ['projectile']
      : ['worthless', 'shield']) {
      const index = g.deck.findIndex((c) => c.kind === kind);
      p.hand.push(g.deck.splice(index, 1)[0]);
    }
  }
  const state = createAmbassadors(() => 0);
  const cohortEffects =
    effect === 'beneGesserit'
      ? ['beneGesserit', 'fremen', 'richese', 'guild', 'tleilaxu']
      : [
          effect,
          ...state.tokens
            .map((t) => t.effect)
            .filter((e) => e !== effect && e !== 'ecaz'),
        ].slice(0, 5);
  state.cohort = state.tokens
    .filter((t) => cohortEffects.includes(t.effect))
    .map((t) => t.id);
  for (const token of state.tokens) {
    token.zone =
      token.effect === 'ecaz' || state.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  const token = state.tokens.find((t) => t.effect === effect)!;
  token.zone = 'placed';
  token.location = 'arrakeen';
  validateAmbassadors(state);
  g.ecazAmbassadors = state;
  return g;
}
function enter(g: Game) {
  return applyAction(g, 'entrant', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
}
function botView(
  g: Game,
  id: string,
  difficulty: (typeof DIFFICULTIES)[number],
) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  return view;
}
function choose(g: Game, difficulty: (typeof DIFFICULTIES)[number]) {
  assert.equal(g.decision?.kind, 'ecazAmbassador');
  const id = g.decision!.player;
  const before = structuredClone(g);
  const actions = botActions(botView(g, id, difficulty));
  assert.equal(actions.length, 1, difficulty);
  assert.equal(actions[0].event, g.pendingAmbassador!.event);
  assert.deepEqual(g, before, 'policy must not mutate authoritative state');
  return { action: actions[0], next: applyAction(g, id, actions[0]) };
}
function finish(g: Game, difficulty: (typeof DIFFICULTIES)[number]) {
  for (let steps = 0; g.pendingAmbassador && steps < 4; steps++)
    g = choose(JSON.parse(JSON.stringify(g)) as Game, difficulty).next;
  assert.equal(
    g.pendingAmbassador,
    null,
    `${difficulty}: bounded entry completion`,
  );
  return g;
}

void test('all four profiles legally resolve each supported ordinary effect from only the decision owner’s view', () => {
  for (const difficulty of DIFFICULTIES)
    for (const effect of [
      'emperor',
      'atreides',
      'harkonnen',
      'choam',
      'ixians',
    ] as const) {
      const initial = enter(fixture(effect));
      for (const id of ['entrant', 'ally'])
        assert.deepEqual(botActions(botView(initial, id, difficulty)), []);
      const done = finish(initial, difficulty);
      assert.equal(done.players[1].reserves, 19);
      assert.equal(done.players[1].spice, 9);
      assert.equal(done.players[1].forces['arrakeen:10'], 1);
      assert.equal(
        done.ecazAmbassadors!.tokens.find((t) => t.effect === effect)!.zone,
        'used',
      );
      if (effect === 'emperor') assert.equal(done.players[0].spice, 15);
      if (effect === 'choam') {
        assert.equal(done.players[0].spice, 13);
        assert.equal(done.players[0].hand.length, 1);
      }
      if (effect === 'ixians') assert.equal(done.players[0].hand.length, 2);
      if (effect === 'atreides' || effect === 'harkonnen') {
        assert.equal(viewGame(done, 'ecaz').ambassadorInsights.length, 1);
        assert.deepEqual(viewGame(done, 'entrant').ambassadorInsights, []);
        assert.deepEqual(viewGame(done, 'ally').ambassadorInsights, []);
        if (effect === 'atreides')
          assert.deepEqual(
            viewGame(done, 'ecaz').ambassadorInsights[0].cards,
            initial.players[1].hand,
          );
        else
          assert.equal(
            viewGame(done, 'ecaz').ambassadorInsights[0].traitor,
            initial.players[1].traitors[0],
          );
      }
      for (const player of done.players)
        assert.equal(
          player.reserves +
            player.tanks +
            Object.values(player.forces).reduce((a, b) => a + b, 0),
          20,
        );
    }
});

void test('unsupported effects are explicitly declined without consuming the placed token at every difficulty', () => {
  for (const difficulty of DIFFICULTIES)
    for (const effect of ['tleilaxu'] as const) {
      const entered = enter(fixture(effect));
      const { action, next } = choose(entered, difficulty);
      assert.equal(action.decline, true);
      assert.equal(next.pendingAmbassador, null);
      assert.equal(
        next.ecazAmbassadors!.tokens.find((t) => t.effect === effect)!.zone,
        'placed',
      );
      assert.equal(next.players[0].spice, 10);
    }
});

void test('Bene Gesserit copies choose only supported projected effects and complete without another acknowledgement', () => {
  for (const difficulty of DIFFICULTIES) {
    const entered = enter(fixture('beneGesserit'));
    const copying = choose(entered, difficulty).next;
    assert.equal(copying.pendingAmbassador?.stage, 'copy');
    const view = botView(copying, 'ecaz', difficulty);
    const action = botActions(view)[0];
    assert.ok(
      view.ambassadorEntry!.copies.some(
        (option) => !option.blocked && option.effect === action.effect,
      ),
    );
    const done = finish(copying, difficulty);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.effect === 'beneGesserit')!
        .zone,
      'removed',
    );
  }
});

void test('an unavailable own Ixian effect can be assigned to an eligible ally whose own bot selects its private card', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('ixians');
    g.players[0].ally = 'ally';
    g.players[2].ally = 'ecaz';
    g.deck.push(...g.players[0].hand);
    g.players[0].hand = [];
    const entered = enter(g);
    const { action, next } = choose(entered, difficulty);
    assert.equal(action.beneficiary, 'ally');
    assert.equal(next.decision?.player, 'ally');
    assert.deepEqual(viewGame(next, 'ecaz').ambassadorEntry!.cards, []);
    assert.deepEqual(botActions(botView(next, 'ecaz', difficulty)), []);
    const done = finish(next, difficulty);
    assert.equal(done.players[2].hand.length, 2);
    assert.equal(done.players[0].hand.length, 0);
  }
});

void test('card policies respect projected blocked IDs, CHOAM permits zero cards, and Ix chooses exactly one', () => {
  for (const difficulty of DIFFICULTIES)
    for (const effect of ['choam', 'ixians'] as const) {
      const cards = choose(enter(fixture(effect)), difficulty).next;
      const view = botView(cards, 'ecaz', difficulty);
      const worthless = view.players[0].hand!.find(
        (c) => c.kind === 'worthless',
      )!;
      view.ambassadorEntry!.cards.find(
        (option) => option.card === worthless.id,
      )!.blocked = 'Reserved card';
      const action = botActions(view)[0];
      assert.ok(Array.isArray(action.cards));
      assert.ok(!action.cards.includes(worthless.id));
      assert.equal(action.cards.length, effect === 'choam' ? 0 : 1);
      assert.doesNotThrow(() => applyAction(cards, 'ecaz', action));
    }
});

void test('entry policy is independent of opponent hand identities and unprojected balances', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = enter(fixture('choam'));
    const first = botView(g, 'ecaz', difficulty);
    const changed = structuredClone(g);
    changed.players[1].spice = 999;
    changed.players[1].hand = baseDeck().slice(-4);
    const second = botView(changed, 'ecaz', difficulty);
    assert.equal(first.players[1].spice, undefined);
    assert.equal(second.players[1].hand, undefined);
    assert.deepEqual(botActions(first), botActions(second));
    const empty: GameView = structuredClone(first);
    empty.ambassadorEntry = null;
    assert.deepEqual(botActions(empty), []);
  }
});
