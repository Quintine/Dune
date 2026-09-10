import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nexusSuboidBotActions } from '../game/nexus-suboid-options';
import { casualtyOptions } from '../game/combat';

/** Authoritative projections isolate bot consumers; engine tests prove actual
 * card spending and changes to physical battle strength. */
function fixture(): GameView {
  const g = createGame('SUBOIDBOTS', newPlayer('i', 'Ixians', 'ixians'), true);
  g.players.push(
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'i',
    storm: 18,
    order: ['i', 'h', 'a'],
  });
  for (const player of g.players.slice(0, 2)) {
    player.forces = { 'arrakeen:10': 5 };
    player.reserves = 15;
    player.spice = 10;
  }
  g.players[0].elites!.forces = { 'arrakeen:10': 2 };
  g.players[0].elites!.reserves = 5;
  g.battle = {
    event: 'suboid-battle',
    territory: 'arrakeen',
    attacker: 'i',
    defender: 'h',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  const v = viewGame(g, 'i');
  v.nexusCards = {
    card: 'ixians',
    deckCount: 11,
    discardCount: 0,
    held: { i: true, h: false, a: false },
    turn: null,
    choices: [],
    waiting: [],
  };
  v.nexusSuboids = {
    offer: { event: 'suboid-event', blocked: null },
    active: false,
  };
  return v;
}

void test('all profiles use only the offered native Cunning before their battle plan', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = fixture();
    v.players[0].bot = difficulty;
    const before = structuredClone(v);
    assert.deepEqual(botActions(v), [
      { type: 'nexusSuboids', event: 'suboid-event' },
    ]);
    assert.deepEqual(v, before);
    v.nexusSuboids!.offer!.blocked =
      'An earlier commitment would become impossible.';
    assert.deepEqual(nexusSuboidBotActions(v), []);
    v.nexusSuboids!.offer!.blocked = null;
    v.battle!.submitted = ['i'];
    assert.deepEqual(nexusSuboidBotActions(v), []);
    v.battle!.submitted = [];
    v.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
      question: null,
    };
    assert.deepEqual(botActions(v), [{ type: 'truthPass' }]);
  }
});

void test('all profiles produce feasible boosted Suboid plans using projected support, including zero spice', () => {
  for (const difficulty of DIFFICULTIES)
    for (const spice of [0, 2]) {
      const v = fixture();
      v.players[0].bot = difficulty;
      v.players[0].spice = spice;
      v.nexusCards!.card = null;
      v.nexusSuboids = { offer: null, active: true };
      const forces = v.battle!.ownForces!;
      forces.normalFixedHalf = false;
      forces.normalFreeSupport = true;
      const before = structuredClone(v);
      const actions = botActions(v);
      assert.ok(actions.length);
      for (const action of actions) {
        assert.equal(action.type, 'battlePlan');
        assert.ok(Number(action.support) <= spice);
        assert.ok(Number(action.support) <= forces.elite);
        assert.ok(
          casualtyOptions(forces, Number(action.dial), Number(action.support))
            .length,
        );
      }
      assert.deepEqual(v, before);
    }
});

void test('native Cunning policy reads no unseen hands or opposing sealed plans', () => {
  const v = fixture();
  v.players[0].bot = 'Brutal';
  for (const player of v.players)
    for (const field of ['hand', 'traitors', 'faceDancers', 'spice'])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`Private ${field} read`);
        },
      });
  Object.defineProperty(v.battle!, 'plans', {
    get() {
      throw new Error('Read sealed plans');
    },
  });
  assert.deepEqual(botActions(v), [
    { type: 'nexusSuboids', event: 'suboid-event' },
  ]);
  v.me = 'h';
  assert.deepEqual(nexusSuboidBotActions(v), []);
});
