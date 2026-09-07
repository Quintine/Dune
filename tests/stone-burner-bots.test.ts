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
import { stoneBurnerPlanBlock } from '../game/stone-burner';
import { baseDeck, ixBattleCards } from '../game/cards';
const stone = () => richeseCards().find((c) => c.effect === 'stoneBurner')!;
function fixture(advanced = false, reverse = false) {
  let g = createGame('STONEBOT', newPlayer('p', 'Pilot', 'emperor'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('q', 'Opponent', 'guild'),
    newPlayer('r', 'Richese', 'richese'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = reverse ? 'q' : 'p';
  g.order = reverse ? ['q', 'p', 'r'] : ['p', 'q', 'r'];
  g.storm = 18;
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.traitors = [];
  }
  g.players[0].forces = { 'pasty_mesa:5': 8 };
  g.players[0].reserves = 12;
  g.players[1].forces = { 'pasty_mesa:5': 3 };
  g.players[1].reserves = 17;
  g.players[0].hand = [stone()];
  g.richeseCache = richeseCards().filter((c) => c.id !== stone().id);
  g = applyAction(g, g.active, {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: reverse ? 'p' : 'q',
  });
  for (const id of ['p', 'q'])
    g = applyAction(g, id, {
      type: 'battlePreparationReady',
      event: g.battle!.event,
    });
  return g;
}
function view(g: Game, difficulty: Difficulty, id = 'p') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = difficulty;
  return v;
}
function reveal(g: Game, own = 'emperor-4', other = 'guild-0') {
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 0,
    leader: own,
    weapon: stone().id,
  });
  return applyAction(g, 'q', { type: 'battlePlan', dial: 0, leader: other });
}

void test('all profiles offer guarded low-dial Stone plans on both sides in Basic and Advanced, with legal physical custody', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true])
      for (const reverse of [false, true]) {
        const g = fixture(advanced, reverse),
          v = view(g, difficulty),
          snapshot = structuredClone(v);
        const actions = botActions(v).filter(
          (a) => a.type === 'battlePlan' && a.weapon === stone().id,
        );
        assert.ok(actions.length);
        assert.equal(actions[0].dial, 0);
        for (const a of actions) {
          assert.ok(a.leader);
          assert.doesNotThrow(() => applyAction(g, 'p', a));
        }
        assert.deepEqual(v, snapshot);
        const next = applyAction(g, 'p', actions[0]);
        assert.equal(next.battle!.plans.p.weapon, stone().id);
      }
});

void test('every public pool is checked and blocked, missing or noncanonical Stone inputs are not emitted', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true, true),
      v = view(g, difficulty);
    v.battle!.ownForces = {
      normal: 2,
      elite: 1,
      eliteStrength: 2,
      freeSupport: false,
    };
    v.battle!.stoneBurnerContext!.opponentPools = [
      { normal: 0, elite: 0, eliteStrength: 1, freeSupport: false },
      { normal: 1, elite: 0, eliteStrength: 1, freeSupport: false },
    ];
    const actions = botActions(v).filter((a) => a.weapon === stone().id);
    for (const a of actions)
      for (const pool of v.battle!.stoneBurnerContext!.opponentPools)
        assert.equal(
          stoneBurnerPlanBlock(
            v.battle!.ownForces,
            Number(a.dial),
            Number(a.support ?? 0),
            pool,
            'defender',
          ),
          null,
        );
    assert.ok(
      actions.every((a) => !(a.dial === 1 && Number(a.support ?? 0) === 0)),
    );
    for (const change of [
      (x: GameView) => {
        x.battle!.stoneBurnerContext!.blocked = 'Ix timing awaits a ruling.';
      },
      (x: GameView) => {
        x.battle!.stoneBurnerContext = null;
      },
      (x: GameView) => {
        x.battle!.stoneBurnerContext!.opponentPools = [];
      },
      (x: GameView) => {
        x.players[0].hand = [{ ...stone(), name: 'Forged Stone' }];
      },
    ]) {
      const x = view(g, difficulty);
      change(x);
      assert.ok(botActions(x).every((a) => a.weapon !== stone().id));
    }
  }
});

void test('all profiles choose public leader preservation versus bounty without changing the undialed winner, and resume exactly once', () => {
  for (const difficulty of DIFFICULTIES)
    for (const reverse of [false, true])
      for (const mode of ['kill', 'ignore'] as const) {
        const g = reveal(
          fixture(true, reverse),
          mode === 'kill' ? 'emperor-4' : 'emperor-0',
          mode === 'kill' ? 'guild-0' : 'guild-4',
        );
        assert.equal(g.decision?.kind, 'stoneBurner');
        assert.deepEqual(botActions(view(g, difficulty, 'q')), []);
        const v = view(g, difficulty),
          snapshot = structuredClone(v),
          a = botActions(v)[0];
        assert.deepEqual(a, { type: 'decision', event: g.battle!.event, mode });
        assert.deepEqual(v, snapshot);
        let next = applyAction(g, 'p', a);
        assert.equal(
          next.players[0].leaders.some((l) => l.dead),
          false,
        );
        assert.throws(() => applyAction(next, 'p', a));
        next = JSON.parse(JSON.stringify(next));
        next = applyAction(next, 'p', { type: 'traitorCall', call: false });
        next = applyAction(next, 'q', { type: 'traitorCall', call: false });
        assert.equal(next.players[0].forces['pasty_mesa:5'], 8);
        assert.equal(next.players[1].tanks, 3);
        assert.equal(
          next.players[0].leaders.some((l) => l.dead),
          mode === 'kill',
        );
        assert.equal(
          next.players[0].hand.some((c) => c.id === stone().id),
          true,
        );
        assert.equal(next.players[0].spice, mode === 'kill' ? 27 : 20);
      }
});

void test('Stone policy uses entitled public plans/pools and preserves Truth, response and traitor precedence', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = reveal(fixture()),
      v = view(g, difficulty),
      a = botActions(v)[0];
    v.players[1].hand = richeseCards();
    v.players[1].spice = 999;
    assert.deepEqual(botActions(v)[0], a);
    const ownTraitor = view(g, difficulty);
    ownTraitor.players[0].traitors = ['guild-0'];
    assert.equal(botActions(ownTraitor)[0].mode, 'ignore');
    const truth = view(g, difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const response = view(g, difficulty);
    response.response = { kind: 'emperorIncome', owner: 'q', passed: [] };
    assert.ok(
      botActions(response).every(
        (a) => a.mode !== 'kill' && a.mode !== 'ignore',
      ),
    );
  }
});

void test('all profiles preserve a valuable leader when Artillery suppresses the apparent Stone bounty', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    const shields = baseDeck().filter((card) => card.kind === 'shield');
    const artillery = ixBattleCards().find(
      (card) => card.kind === 'artillery',
    )!;
    g.players[0].hand.push(shields[0]);
    g.players[1].hand = [artillery, shields[1]];
    const held = new Set(
      g.players.flatMap((p) => p.hand.map((card) => card.id)),
    );
    g.deck = g.deck.filter((card) => !held.has(card.id));
    g = applyAction(g, 'p', {
      type: 'battlePlan',
      dial: 0,
      leader: 'emperor-0',
      weapon: stone().id,
      defense: shields[0].id,
    });
    g = applyAction(g, 'q', {
      type: 'battlePlan',
      dial: 0,
      leader: 'guild-0',
      weapon: artillery.id,
      defense: shields[1].id,
    });
    assert.equal(g.decision?.kind, 'stoneBurner');
    const action = botActions(view(g, difficulty))[0];
    assert.equal(action.mode, 'ignore');
    g = applyAction(g, 'p', action);
    g = applyAction(g, 'p', { type: 'traitorCall', call: false });
    g = applyAction(g, 'q', { type: 'traitorCall', call: false });
    assert.equal(
      g.players[0].leaders.find((leader) => leader.id === 'emperor-0')!.dead,
      false,
    );
    assert.equal(g.players[0].spice, 20);
  }
});
