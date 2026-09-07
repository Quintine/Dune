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
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

function fixture(held = true) {
  const g = createGame('RESIDUALBOT', newPlayer('p', 'Pilot', 'emperor'));
  g.players.push(
    newPlayer('q', 'Opponent', 'fremen'),
    newPlayer('r', 'Richese', 'richese'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = 'p';
  g.order = ['p', 'q', 'r'];
  g.storm = 18;
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.spice = 10;
  }
  g.players[0].forces = { 'arrakeen:10': 4 };
  g.players[0].reserves = 16;
  g.players[1].forces = { 'arrakeen:10': 4 };
  g.players[1].reserves = 16;
  g.richeseCache = richeseCards();
  if (held) {
    const card = g.richeseCache.find((c) => c.effect === 'residualPoison')!;
    g.richeseCache = g.richeseCache.filter((c) => c.id !== card.id);
    g.players[0].hand = [card];
  }
  return applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
}
function projection(g: Game, difficulty: Difficulty, id = 'p') {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  return view;
}
const poison = (view: GameView) =>
  botActions(view).find(
    (a) => a.type === 'card' && a.card === 'richese-residual-poison',
  );
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('all profiles play eligible Residual against the actual opponent before readiness, then choose leaders without a death acknowledgement', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      v = projection(g, difficulty),
      snapshot = structuredClone(v);
    assert.ok(v.battle!.preLeader);
    assert.equal(v.battle!.preLeader!.closed, false);
    const action = botActions(v)[0];
    assert.equal(action.card, 'richese-residual-poison');
    assert.equal(action.target, 'q');
    assert.equal(action.event, v.battle!.event);
    assert.deepEqual(v, snapshot);
    const deadBefore = g.players[1].leaders.filter((l) => l.dead).length;
    let next = applyAction(g, 'p', action);
    assert.equal(
      next.players[1].leaders.filter((l) => l.dead).length,
      deadBefore + 1,
    );
    assert.deepEqual(
      next.players.map((p) => p.spice),
      g.players.map((p) => p.spice),
    );
    assert.equal(next.discard.filter((c) => c.id === action.card).length, 1);
    assert.equal(poison(projection(reload(next), difficulty)), undefined);
    assert.throws(() => applyAction(next, 'p', action));
    const ready = botActions(projection(next, difficulty))[0];
    assert.equal(ready.type, 'battlePreparationReady');
    next = applyAction(next, 'p', ready);
    assert.deepEqual(botActions(projection(next, difficulty)), []);
    const otherReady = botActions(projection(next, difficulty, 'q'))[0];
    assert.equal(otherReady.type, 'battlePreparationReady');
    next = applyAction(reload(next), 'q', otherReady);
    assert.equal(viewGame(next, 'p').battle!.preLeader!.closed, true);
    const plan = botActions(projection(next, difficulty))[0];
    assert.equal(plan.type, 'battlePlan');
    assert.doesNotThrow(() => applyAction(next, 'p', plan));
  }
});

void test('the public readiness stage and nonholder bot behavior are independent of Residual possession', () => {
  for (const difficulty of DIFFICULTIES) {
    const held = fixture(),
      absent = fixture(false);
    const a = viewGame(held, 'q').battle!.preLeader!,
      b = viewGame(absent, 'q').battle!.preLeader!;
    assert.deepEqual(
      { ...a, event: 'battle-event' },
      { ...b, event: 'battle-event' },
    );
    assert.equal(viewGame(held, 'q').residualPoison, null);
    assert.equal(
      botActions(projection(held, difficulty, 'q'))[0].type,
      'battlePreparationReady',
    );
    assert.equal(
      botActions(projection(absent, difficulty))[0].type,
      'battlePreparationReady',
    );
    assert.deepEqual(botActions(projection(held, difficulty, 'r')), []);
  }
});

void test('eligibility and exact battle targeting are authoritative, with no victim-pool or hidden-hand inference', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      v = projection(g, difficulty),
      action = poison(v);
    assert.ok(action);
    v.players[1].hand = richeseCards();
    v.players[1].leaders = [];
    v.players[1].spice = 999;
    assert.deepEqual(poison(v), action);
    for (const change of [
      (view: GameView) => {
        view.residualPoison!.blocked = 'This pool is unavailable.';
      },
      (view: GameView) => {
        view.residualPoison!.target = 'r';
      },
      (view: GameView) => {
        view.residualPoison!.event = 'old-battle';
      },
      (view: GameView) => {
        view.residualPoison = null;
      },
    ]) {
      const blocked = projection(g, difficulty);
      change(blocked);
      assert.equal(poison(blocked), undefined);
      assert.equal(botActions(blocked)[0].type, 'battlePreparationReady');
    }
  }
});

void test('real interaction priority is preserved and an open readiness stage precedes compliant plan preparation', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(false),
      v = projection(g, difficulty);
    v.battle!.compliantPreparation = {
      actions: [{ type: 'battlePlan', dial: 0 }],
      blocked: null,
    } as unknown as NonNullable<GameView['battle']>['compliantPreparation'];
    assert.equal(botActions(v)[0].type, 'battlePreparationReady');
    const truth = projection(g, difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const response = projection(g, difficulty);
    response.response = { kind: 'emperorIncome', owner: 'q', passed: [] };
    assert.ok(
      botActions(response).every(
        (a) =>
          a.type !== 'battlePreparationReady' &&
          a.card !== 'richese-residual-poison',
      ),
    );
    const decision = projection(g, difficulty);
    decision.decision = { kind: 'richeseDeclaration', player: 'q' };
    assert.deepEqual(botActions(decision), []);
  }
});
