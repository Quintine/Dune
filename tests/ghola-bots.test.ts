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
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { createDukeVidal } from '../game/duke-vidal';

function fixture(faction: FactionId = 'atreides', advanced = false) {
  const g = createGame(
    'GHOLABOTS',
    newPlayer('p', 'Player', faction),
    advanced,
  );
  g.players.push(
    newPlayer('q', 'Guild', 'guild'),
    newPlayer('r', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'q', 'r'],
    movementRemaining: ['p', 'q', 'r'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  const at = g.deck.findIndex((c) => c.effect === 'ghola');
  const card = g.deck.splice(at, 1)[0];
  g.players[0].hand.push(card);
  return { g, card };
}
function casualties(g: Game, tanks = 5, reserves = 0) {
  Object.assign(g.players[0], {
    tanks,
    reserves,
    forces: { 'red_chasm:7': 20 - tanks - reserves },
  });
}
function view(g: Game, difficulty: Difficulty) {
  const v = viewGame(g, 'p');
  v.players[0].bot = difficulty;
  return v;
}
function selected(g: Game, difficulty: Difficulty) {
  const v = view(g, difficulty),
    before = structuredClone(v);
  const actions = botActions(v);
  assert.deepEqual(v, before);
  assert.ok(actions.length);
  return actions[0];
}
function apply(g: Game, difficulty: Difficulty) {
  const a = selected(g, difficulty),
    before = structuredClone(g);
  const done = applyAction(g, 'p', a);
  assert.deepEqual(g, before);
  return { a, done };
}
for (const level of DIFFICULTIES) {
  void test(`${level} revives a useful own leader with Ghola and clears the earlier battle location`, () => {
    const { g, card } = fixture();
    for (const leader of g.players[0].leaders)
      Object.assign(leader, { dead: true, deaths: 1, usedAt: 'carthag' });
    const wanted = [...view(g, level).ghola.leaders].sort(
      (a, b) => b.strength - a.strength || a.id.localeCompare(b.id),
    )[0];
    const { a, done } = apply(g, level);
    assert.deepEqual(a, { type: 'card', card: card.id, leader: wanted.id });
    const revived = done.players[0].leaders.find((l) => l.id === wanted.id)!;
    assert.equal(revived.dead, false);
    assert.equal(revived.usedAt, undefined);
    assert.equal(revived.deaths, 1);
    assert.equal(done.players[0].leaderRevived, g.players[0].leaderRevived);
    assert.equal(done.players[0].spice, g.players[0].spice);
    assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
  });
  void test(`${level} revives five needed ordinary forces without using normal revival allowance`, () => {
    const { g, card } = fixture();
    casualties(g);
    const { a, done } = apply(g, level);
    assert.deepEqual(a, { type: 'card', card: card.id, amount: 5, elite: 0 });
    assert.equal(done.players[0].tanks, 0);
    assert.equal(done.players[0].reserves, 5);
    assert.equal(done.players[0].revived, g.players[0].revived);
    assert.equal(
      done.players[0].freeForcesRevived,
      g.players[0].freeForcesRevived,
    );
    assert.equal(done.players[0].spice, g.players[0].spice);
  });
  void test(`${level} uses the exact feasible mixed group when elite allowance prevents five returns`, () => {
    const { g, card } = fixture('emperor', true);
    casualties(g);
    g.players[0].elites = {
      tanks: 3,
      reserves: 0,
      revived: 0,
      forces: { 'red_chasm:7': 2 },
    };
    assert.equal(view(g, level).ghola.maxForces, 3);
    const { a, done } = apply(g, level);
    assert.deepEqual(a, { type: 'card', card: card.id, amount: 3, elite: 1 });
    assert.equal(done.players[0].elites!.revived, 1);
    assert.equal(done.players[0].elites!.tanks, 2);
    assert.equal(done.players[0].reserves, 3);
  });
  void test(`${level} can choose dead Kwisatz Haderach using the same projected target`, () => {
    const { g, card } = fixture('atreides', true);
    g.players[0].kwisatz = {
      dead: true,
      available: true,
      losses: 7,
      usedAt: 'carthag',
    } as NonNullable<Game['players'][number]['kwisatz']>;
    const { a, done } = apply(g, level);
    assert.deepEqual(a, { type: 'card', card: card.id, leader: 'kwisatz' });
    assert.equal(done.players[0].kwisatz!.dead, false);
    assert.equal(done.players[0].kwisatz!.usedAt, undefined);
  });
}
void test('ordinary revival actions retain priority over a discretionary Ghola at every level', () => {
  const { g } = fixture();
  g.phase = 4;
  g.active = null;
  casualties(g);
  for (const level of DIFFICULTIES) {
    const a = selected(g, level);
    assert.equal(a.type, 'revive');
    assert.ok(applyAction(g, 'p', a));
  }
});
void test('all profiles retain Ixian multi-cyborg Ghola revival rather than applying the base one-elite limit', () => {
  for (const level of DIFFICULTIES) {
    const { g, card } = fixture('ixians', true);
    casualties(g);
    g.players[0].elites = {
      tanks: 3,
      reserves: 0,
      revived: 0,
      forces: { 'red_chasm:7': 1 },
    };
    const { a, done } = apply(g, level);
    assert.deepEqual(a, { type: 'card', card: card.id, amount: 5, elite: 3 });
    assert.equal(done.players[0].elites!.tanks, 0);
    assert.equal(done.players[0].elites!.reserves, 3);
  }
});
void test('a real pre-leader combat opportunity keeps priority over stand-alone force recovery', () => {
  const { g, card } = fixture('emperor', true);
  casualties(g);
  g.phase = 6;
  g.players[2] = newPlayer('r', 'Richese', 'richese');
  g.players[1].forces = { 'red_chasm:7': 2 };
  g.players[1].reserves = 18;
  const battle = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'q',
  });
  assert.ok(battle.battle?.preLeader && !battle.battle.preLeader.closed);
  for (const level of DIFFICULTIES) {
    const a = selected(battle, level);
    assert.equal(a.type, 'battlePreparationReady');
    assert.notEqual(a.card, card.id);
    assert.ok(applyAction(battle, 'p', a));
  }
});
void test('foreign-ghola and negotiated early-revival bot candidates explicitly exclude a projected Duke', () => {
  // Projection-only legacy boundary: these controls must not infer foreign or
  // negotiated permission merely because a dead shared disc appears in a roster.
  for (const level of DIFFICULTIES) {
    const foreign = fixture('tleilaxu', true).g;
    foreign.phase = 4;
    foreign.active = null;
    foreign.players[0].leaders[0].dead = true;
    const fv = view(foreign, level);
    const deadDuke = {
      ...createDukeVidal().leader,
      dead: true,
      deaths: 1,
      controller: 'q',
    };
    fv.players[1].leaders.push(deadDuke);
    assert.ok(
      botActions(fv).every(
        (a) => a.type !== 'reviveForeignGhola' || a.leader !== 'duke-vidal',
      ),
    );

    const own = fixture('ecaz').g;
    own.phase = 4;
    own.active = null;
    own.players[1] = newPlayer('q', 'Tleilaxu', 'tleilaxu');
    own.players[0].leaders.slice(0, 3).forEach((l) => {
      l.dead = true;
      l.deaths = 1;
    });
    const ov = view(own, level);
    ov.players[0].leaders.push({ ...deadDuke, controller: 'p' });
    assert.ok(
      botActions(ov).every(
        (a) => a.type !== 'requestLeaderRevival' || a.leader !== 'duke-vidal',
      ),
    );
  }
});
void test('ordinary revival prevention does not itself prevent independent Ghola recovery', () => {
  const { g, card } = fixture();
  g.phase = 4;
  g.active = null;
  casualties(g);
  g.revivalPrevention = { player: 'p', turn: g.turn };
  for (const level of DIFFICULTIES) {
    assert.equal(view(g, level).revival.prevented, true);
    const { a, done } = apply(g, level);
    assert.equal(a.card, card.id);
    assert.equal(done.players[0].reserves, 5);
  }
});
void test('open collection and Mentat windows can use a needed Ghola before readiness', () => {
  for (const phase of [7, 8])
    for (const level of DIFFICULTIES) {
      const { g, card } = fixture();
      g.phase = phase;
      g.active = null;
      casualties(g);
      assert.equal(apply(g, level).a.card, card.id);
    }
});
void test('missing, blocked, empty and withheld target projections do not produce guessed actions', () => {
  const { g, card } = fixture();
  casualties(g);
  for (const level of DIFFICULTIES) {
    for (const alter of [
      (v: GameView) => {
        v.ghola.available = false;
      },
      (v: GameView) => {
        v.ghola.cards = [];
      },
      (v: GameView) => {
        v.ghola.maxForces = 0;
        v.ghola.kwisatz = false;
        v.ghola.leaders = [];
      },
    ]) {
      const v = view(g, level);
      alter(v);
      assert.ok(botActions(v).every((a) => a.card !== card.id));
    }
  }
});
void test('specific pending decisions, response windows, and automatic continuations retain priority', () => {
  const { g, card } = fixture();
  casualties(g);
  for (const level of DIFFICULTIES) {
    const pending = view(g, level);
    pending.decision = { kind: 'advisor', player: 'p' } as NonNullable<
      GameView['decision']
    >;
    assert.equal(botActions(pending)[0].type, 'decision');
    const response = view(g, level);
    response.response = {
      kind: 'voice',
      owner: 'q',
      passed: [],
    } as NonNullable<GameView['response']>;
    assert.ok(botActions(response).every((a) => a.card !== card.id));
    const continuation = view(g, level);
    continuation.automaticContinuationPending = true;
    assert.deepEqual(botActions(continuation), []);
  }
});
void test('stand-alone policy does not precede a positive shipment preparation witness', () => {
  const { g, card } = fixture();
  casualties(g);
  for (const level of DIFFICULTIES) {
    const v = view(g, level);
    const witness = { type: 'pledgeAid', amount: 0 };
    // Projection-only priority test; constructing a promise is covered by the
    // genuine shipment-promise suite, not this policy fixture.
    v.shipmentCompletion = { actions: [witness] } as NonNullable<
      GameView['shipmentCompletion']
    >;
    assert.ok(botActions(v).every((a) => a.card !== card.id));
  }
});
void test('the policy uses only own projected targets and is invariant to opponent private resources and identities', () => {
  const { g } = fixture();
  casualties(g);
  const changed = structuredClone(g);
  changed.players[1].hand.push(changed.deck.shift()!);
  changed.players[1].spice = 1;
  changed.players[1].traitors = [changed.players[2].leaders[0].id];
  for (const level of DIFFICULTIES) {
    assert.deepEqual(selected(g, level), selected(changed, level));
    const v = view(g, level);
    Object.defineProperty(v, 'dukeVidal', {
      get() {
        throw Error('Raw shared custody read');
      },
    });
    assert.equal(botActions(v)[0].type, 'card');
  }
});
