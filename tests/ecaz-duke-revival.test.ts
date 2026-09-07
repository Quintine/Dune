import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  createDukeVidal,
  acquireDuke,
  consumeDuke,
  DUKE_VIDAL_ID,
} from '../game/duke-vidal';
import { newRevivalRules, revivalDiscount } from '../game/revival';
import {
  resolveEcazDukeRevival,
  quoteEcazDukeRevival,
  ecazDukeRevivalBlock,
  EcazDukeRevivalError,
  DUKE_REVIVAL_NORMAL_COST,
} from '../game/ecaz-duke-revival';
const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(advanced = false) {
  const g = createGame(
    'DUKEREVIVAL',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    advanced,
    ['ecaz'],
  );
  g.players.push(newPlayer('m', 'Moritani', 'moritani'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 3,
    order: ['ec', 'm'],
    dukeVidal: createDukeVidal(),
    revivalRules: newRevivalRules(),
  });
  g.dukeVidal!.leader.dead = true;
  g.dukeVidal!.leader.deaths = 1;
  return g;
}
void test('canonical dead shared Duke resolves without manufacturing or reviving it and always has printed normal price five', () => {
  for (const advanced of [false, true]) {
    const g = fixture(advanced);
    g.dukeVidal!.leader.deaths = 4;
    g.dukeVidal!.leader.usedAt = 'carthag';
    const before = structuredClone(g),
      oldRandom = Math.random;
    let q;
    try {
      Math.random = () => {
        throw new Error('shared identity quote must not sample');
      };
      q = resolveEcazDukeRevival(g, 'ec');
    } finally {
      Math.random = oldRandom;
    }
    assert.deepEqual(q, {
      source: 'sharedDuke',
      player: 'ec',
      leader: DUKE_VIDAL_ID,
      normalCost: 5,
      duke: g.dukeVidal,
    });
    assert.equal(q.duke.leader.dead, true);
    assert.equal(q.duke.controller, null);
    assert.equal(q.duke.leader.strength, 6);
    assert.equal(DUKE_REVIVAL_NORMAL_COST, 5);
    assert.deepEqual(g, before);
    q.duke.leader.deaths = 99;
    q.duke.controller = 'ec';
    assert.deepEqual(g, before);
  }
});
void test('all eleven non-Ecaz factions are rejected, including an old Moritani controller and Tleilaxu foreign-ghola actor', () => {
  for (const faction of FACTIONS.filter((f) => f.id !== 'ecaz')) {
    const g = fixture();
    g.players[1] = newPlayer('other', faction.name, faction.id as FactionId);
    if (faction.id === 'moritani') {
      g.dukeVidal = acquireDuke(createDukeVidal(), 'other', 1, 'moritani');
      g.dukeVidal.leader.dead = true;
      g.dukeVidal.leader.deaths = 1;
    }
    const before = structuredClone(g);
    assert.throws(
      () => resolveEcazDukeRevival(g, 'other'),
      EcazDukeRevivalError,
      faction.id,
    );
    assert.throws(
      () => quoteEcazDukeRevival(g, 'other', false),
      EcazDukeRevivalError,
      faction.id,
    );
    assert.deepEqual(g, before);
  }
  const absent = fixture();
  absent.players = absent.players.filter((p) => p.id !== 'ec');
  assert.throws(
    () => resolveEcazDukeRevival(absent, 'ec'),
    EcazDukeRevivalError,
  );
});
void test('existing native death count, phase, ordinary slot, prevention and private resource fields are outside identity resolution', () => {
  const g = fixture();
  for (const phase of [0, 4, 6, 8])
    for (const deadCount of [0, 4, 5]) {
      g.phase = phase;
      p(g, 'ec').leaderRevived = true;
      p(g, 'ec').revivalCycle = 7;
      g.revivalPrevention = { turn: g.turn, player: 'ec' };
      p(g, 'ec').leaders.forEach((l, i) => {
        l.dead = i < deadCount;
        l.deaths = l.dead ? 1 : 0;
      });
      const before = structuredClone(g);
      assert.equal(resolveEcazDukeRevival(g, 'ec').normalCost, 5);
      assert.deepEqual(g, before);
    }
  // Getters establish that the identity guard does not inspect denial/price
  // eligibility or hidden native histories to infer whether it may revive.
  for (const key of ['phase', 'revivalPrevention', 'revivalRules'] as const)
    Object.defineProperty(g, key, {
      get() {
        throw new Error('not an identity prerequisite');
      },
    });
  for (const seat of g.players) {
    for (const key of [
      'spice',
      'hand',
      'traitors',
      'leaderRevived',
      'revivalCycle',
      'ally',
    ] as const)
      Object.defineProperty(seat, key, {
        get() {
          throw new Error('not an identity prerequisite');
        },
      });
    for (const leader of seat.leaders)
      for (const key of ['dead', 'deaths', 'capturedBy', 'gholaBy'] as const)
        Object.defineProperty(leader, key, {
          get() {
            throw new Error('private native history');
          },
        });
  }
  assert.equal(resolveEcazDukeRevival(g, 'ec').leader, DUKE_VIDAL_ID);
});
void test('declared discount composes the existing Tleilaxu rule to three spice without changing strength or the normal five-spice quote', () => {
  const g = fixture(true);
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  p(g, 't').ally = 'ec';
  p(g, 'ec').ally = 't';
  g.revivalRules!.allyDiscount = 'ec';
  const discounted = quoteEcazDukeRevival(
    g,
    'ec',
    !!revivalDiscount(g, p(g, 'ec')),
  );
  assert.equal(discounted.cost, 3);
  assert.equal(discounted.normalCost, 5);
  assert.equal(discounted.duke.leader.strength, 6);
  g.revivalRules!.discountBlocked = true;
  const full = quoteEcazDukeRevival(g, 'ec', !!revivalDiscount(g, p(g, 'ec')));
  assert.equal(full.cost, 5);
  assert.equal(full.normalCost, 5);
  assert.equal(
    discounted.cost,
    3,
    'a prior detached quote is not repriced by reading current entitlement',
  );
  assert.equal(resolveEcazDukeRevival(g, 'ec').normalCost, 5);
  assert.throws(
    () => quoteEcazDukeRevival(g, 'ec', undefined as never),
    EcazDukeRevivalError,
  );
  assert.throws(
    () => quoteEcazDukeRevival(g, 'ec', 1 as never),
    EcazDukeRevivalError,
  );
});
void test('missing, duplicate, forged and malformed shared physical history are rejected with one generic unavailable reason', () => {
  const changes: [string, (g: Game) => void][] = [
    [
      'missing',
      (g) => {
        delete g.dukeVidal;
      },
    ],
    [
      'native duplicate',
      (g) => {
        p(g, 'ec').leaders.push(structuredClone(g.dukeVidal!.leader));
      },
    ],
    [
      'foreign duplicate',
      (g) => {
        p(g, 'm').leaders.push(structuredClone(g.dukeVidal!.leader));
      },
    ],
    [
      'wrong ID',
      (g) => {
        g.dukeVidal!.leader.id = 'ecaz-1';
      },
    ],
    [
      'wrong faction',
      (g) => {
        g.dukeVidal!.leader.faction = 'moritani';
      },
    ],
    [
      'wrong strength',
      (g) => {
        g.dukeVidal!.leader.strength = 5;
      },
    ],
    [
      'alive',
      (g) => {
        g.dukeVidal!.leader.dead = false;
      },
    ],
    [
      'zero deaths',
      (g) => {
        g.dukeVidal!.leader.deaths = 0;
      },
    ],
    [
      'negative deaths',
      (g) => {
        g.dukeVidal!.leader.deaths = -1;
      },
    ],
    [
      'unsafe deaths',
      (g) => {
        g.dukeVidal!.leader.deaths = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      'fractional deaths',
      (g) => {
        g.dukeVidal!.leader.deaths = 1.5;
      },
    ],
    [
      'malformed usedAt',
      (g) => {
        g.dukeVidal!.leader.usedAt = 5 as never;
      },
    ],
    [
      'unknown controller',
      (g) => {
        g.dukeVidal!.controller = 'absent';
      },
    ],
    [
      'missing source',
      (g) => {
        g.dukeVidal!.controller = 'm';
        g.dukeVidal!.acquiredTurn = 1;
      },
    ],
    [
      'orphan turn',
      (g) => {
        g.dukeVidal!.acquiredTurn = 1;
      },
    ],
    [
      'future custody',
      (g) => {
        g.dukeVidal!.controller = 'm';
        g.dukeVidal!.source = 'moritani';
        g.dukeVidal!.acquiredTurn = 4;
      },
    ],
  ];
  for (const [label, change] of changes) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.throws(
      () => resolveEcazDukeRevival(g, 'ec'),
      EcazDukeRevivalError,
      label,
    );
    assert.equal(
      ecazDukeRevivalBlock(g, 'ec'),
      'Duke Vidal is unavailable for this revival.',
      label,
    );
    assert.deepEqual(g, before);
  }
});
void test('captured, ghola and concealed records give identical reasons independent of hidden dead/capture variants', () => {
  const descriptors = new Set<string | null>();
  for (const marker of ['capturedBy', 'gholaBy', 'concealed'] as const)
    for (const dead of [false, true]) {
      const g = fixture();
      g.dukeVidal!.leader.dead = dead;
      if (marker === 'concealed')
        g.dukeVidal!.leader.concealed = {
          captor: 'm',
          controller: 'ec',
          dead: true,
          deaths: 1,
        };
      else g.dukeVidal!.leader[marker] = 'm';
      const before = structuredClone(g);
      descriptors.add(ecazDukeRevivalBlock(g, 'ec'));
      assert.throws(
        () => resolveEcazDukeRevival(g, 'ec'),
        EcazDukeRevivalError,
      );
      assert.deepEqual(g, before);
    }
  assert.deepEqual(
    [...descriptors],
    ['Duke Vidal is unavailable for this revival.'],
  );
});
void test('Advanced Harkonnen retains its uniform public boundary while Basic and other Advanced tables resolve normally', () => {
  const g = fixture();
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  assert.equal(ecazDukeRevivalBlock(g, 'ec'), null);
  g.advanced = true;
  const expected = ecazDukeRevivalBlock(g, 'ec');
  assert.match(expected!, /Advanced Harkonnen/);
  for (const dead of [false, true])
    for (const captured of [false, true]) {
      g.dukeVidal!.leader.dead = dead;
      if (captured) g.dukeVidal!.leader.capturedBy = 'h';
      else delete g.dukeVidal!.leader.capturedBy;
      assert.equal(ecazDukeRevivalBlock(g, 'ec'), expected);
    }
});
void test('set-aside battle-death identity and valid retained legacy custody resolve to the same reviver without selecting future control', () => {
  const g = fixture();
  g.dukeVidal = acquireDuke(createDukeVidal(), 'm', 2, 'moritani');
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths = 2;
  g.dukeVidal.leader.usedAt = 'arrakeen';
  const retained = resolveEcazDukeRevival(g, 'ec');
  assert.equal(retained.duke.controller, 'm');
  g.dukeVidal = consumeDuke(g.dukeVidal);
  const released = resolveEcazDukeRevival(g, 'ec');
  assert.equal(released.duke.controller, null);
  assert.equal(retained.player, released.player);
  assert.equal(released.player, 'ec');
  assert.deepEqual(retained.duke.leader, released.duke.leader);
  assert.deepEqual(
    resolveEcazDukeRevival(JSON.parse(JSON.stringify(g)), 'ec'),
    released,
  );
});
void test('invalid source context and duplicate Ecaz owners fail independently from paid revival timing', () => {
  for (const change of [
    (g: Game) => {
      g.status = 'setup';
    },
    (g: Game) => {
      g.turn = 0;
    },
    (g: Game) => {
      g.turn = NaN;
    },
    (g: Game) => {
      g.players.push(newPlayer('another', 'Second Ecaz', 'ecaz'));
    },
    (g: Game) => {
      g.players.push(newPlayer('ec', 'Duplicate ID', 'moritani'));
    },
    (g: Game) => {
      p(g, 'ec').leaders = null as never;
    },
  ]) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.throws(() => resolveEcazDukeRevival(g, 'ec'), EcazDukeRevivalError);
    assert.deepEqual(g, before);
  }
});
