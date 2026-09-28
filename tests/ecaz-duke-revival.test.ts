import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Game } from '../game/engine';
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
import { baseDeck } from '../game/cards';
import { quoteRevivalCancellation } from '../game/revival-cancellation';
import { botActions } from '../game/bots';
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
void test('a dead Duke with prior Ecaz Nexus custody resolves to the same physical return', () => {
  const g = fixture();
  g.dukeVidal = acquireDuke(createDukeVidal(), 'ec', 2, 'ecazNexus');
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths = 1;
  const quoted = resolveEcazDukeRevival(g, 'ec');
  assert.equal(quoted.duke.source, 'ecazNexus');
  assert.equal(quoted.normalCost, 5);
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
void test('four native deaths plus Duke open Ecaz first cohort, which stays open after a paid return', () => {
  let g = fixture();
  p(g, 'ec').leaders.slice(0, 4).forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  p(g, 'ec').spice = 20;
  const initial = viewGame(g, 'ec').revival.leaders;
  assert.equal(initial.filter((l) => l.id !== DUKE_VIDAL_ID).length, 4);
  assert.equal(initial.find((l) => l.id === DUKE_VIDAL_ID)?.early, false);
  g = applyAction(g, 'ec', { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.equal(p(g, 'ec').revivalCycle, 1);
  assert.equal(p(g, 'ec').spice, 15);
  p(g, 'ec').leaderRevived = false;
  g.turn++;
  assert.equal(viewGame(g, 'ec').revival.leaders.length, 4);
  const native = p(g, 'ec').leaders[0].id;
  g = applyAction(g, 'ec', { type: 'reviveLeader', leader: native });
  assert.equal(p(g, 'ec').spice, 15 - p(g, 'ec').leaders[0].strength);
  assert.equal(p(g, 'ec').leaders[4].dead, false);
  assert.equal(g.dukeVidal!.controller, null);
});
void test('Ecaz native repeated six-disc cycles stay gated while Duke remains independently revivable', () => {
  const g = fixture();
  p(g, 'ec').leaders.forEach((l) => { l.dead = true; l.deaths = 1; });
  p(g, 'ec').leaders[0].deaths = 2;
  p(g, 'ec').spice = 10;
  p(g, 'ec').revivalCycle = 1;
  const options = viewGame(g, 'ec').revival;
  assert.match(options.cycleBlock!, /six-disc repeated/);
  assert.deepEqual(options.leaders.map((l) => l.id), [DUKE_VIDAL_ID]);
  assert.equal(options.leaders[0].cost, 5);
  const returned = applyAction(g, 'ec', { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.equal(p(returned, 'ec').revivalCycle, 1);
  assert.equal(returned.dukeVidal!.leader.deaths, 1);
});
void test('saved discounted Duke request can be canceled back to five and paid once with income', () => {
  let g = fixture(true);
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.players.push(newPlayer('k', 'Karama', 'emperor'));
  g.order = g.players.map((seat) => seat.id);
  g.deck = baseDeck();
  const karamaIndex = g.deck.findIndex((card) => card.effect === 'karama');
  p(g, 'k').hand.push(g.deck.splice(karamaIndex, 1)[0]);
  p(g, 'ec').spice = 8;
  p(g, 't').ally = 'ec';
  p(g, 'ec').ally = 't';
  p(g, 't').specialKaramaUsed = true;
  g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  assert.equal(viewGame(g, 'ec').revival.leaders.find((l) => l.id === DUKE_VIDAL_ID)?.cost, 3);
  g = applyAction(g, 'ec', { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.deepEqual(g.pendingRevival?.checks, []);
  assert.equal(g.response?.kind, 'revivalDiscount');
  assert.equal(g.pendingRevival?.normalCost, 5);
  assert.equal(g.pendingRevival?.cost, 3);
  const saved = JSON.parse(JSON.stringify(g)) as Game;
  const before = structuredClone(saved);
  const quote = quoteRevivalCancellation(saved, saved.response!);
  assert.equal(quote.pending?.cost, 5);
  assert.deepEqual(saved, before);
  g = applyAction(saved, 'k', {
    type: 'card', card: p(saved, 'k').hand[0].id, mode: 'cancel',
  });
  assert.equal(p(g, 'ec').spice, 3);
  assert.equal(g.dukeVidal!.leader.dead, false);
  assert.equal(g.dukeVidal!.controller, null);
  assert.equal(p(g, 'ec').leaderRevived, true);
  assert.equal(g.pendingRevival, null);
  assert.equal(g.response, null);
  assert.equal(p(g, 't').spice, 5, 'the automatic paid revival income settles once');
});
void test('Advanced Tleilaxu stop decision survives JSON and cannot charge Duke before approval', () => {
  let g = fixture(true);
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.order = g.players.map((seat) => seat.id);
  p(g, 'ec').spice = 7;
  g = applyAction(g, 'ec', { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.equal(g.decision?.kind, 'revivalStop');
  assert.equal(g.pendingRevival?.normalCost, 5);
  assert.equal(p(g, 'ec').spice, 7);
  assert.equal(g.dukeVidal!.leader.dead, true);
  g = JSON.parse(JSON.stringify(g)) as Game;
  g = applyAction(g, 't', { type: 'decision', decline: true });
  assert.equal(p(g, 'ec').spice, 2);
  assert.equal(p(g, 't').spice, 5);
  assert.equal(g.dukeVidal!.leader.dead, false);
  assert.equal(g.dukeVidal!.controller, null);
  assert.equal(g.pendingRevival, null);
});
void test('all four Ecaz AI profiles can choose the authoritative five-spice Duke return', () => {
  const g = fixture();
  p(g, 'ec').spice = 10;
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    p(g, 'ec').bot = profile;
    const view = viewGame(g, 'ec');
    const selected = botActions(view).find(
      (action) => action.type === 'reviveLeader' && action.leader === DUKE_VIDAL_ID,
    );
    assert.ok(selected, profile);
    const done = applyAction(g, 'ec', selected);
    assert.equal(done.dukeVidal!.leader.dead, false);
    assert.equal(done.dukeVidal!.controller, null);
    assert.equal(done.players.find((seat) => seat.id === 'ec')!.spice, 5);
  }
});
void test('corrupt saved pending Duke custody rejects continuation without changing spice or the request', () => {
  let g = fixture(true);
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.order = g.players.map((seat) => seat.id);
  p(g, 'ec').spice = 9;
  g = applyAction(g, 'ec', { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  assert.equal(g.decision?.kind, 'revivalStop');
  g = JSON.parse(JSON.stringify(g)) as Game;
  p(g, 'ec').leaders.push(structuredClone(g.dukeVidal!.leader));
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 't', { type: 'decision', decline: true }));
  assert.deepEqual(g, before);
  assert.equal(p(g, 'ec').spice, 9);
});
void test('five native Ecaz leaders in Tanks open the ordinary first cohort even while Duke lives', () => {
  const g = fixture();
  g.dukeVidal!.leader.dead = false;
  g.dukeVidal!.leader.deaths = 0;
  p(g, 'ec').leaders.forEach((l) => { l.dead = true; l.deaths = 1; });
  p(g, 'ec').spice = 20;
  const options = viewGame(g, 'ec').revival.leaders;
  assert.equal(options.length, 5);
  assert.equal(options.some((l) => l.id === DUKE_VIDAL_ID), false);
});
void test('unavailable captured native leaders retain the ordinary no-survivor exception', () => {
  const g = fixture();
  g.dukeVidal!.leader.dead = false;
  g.dukeVidal!.leader.deaths = 0;
  p(g, 'ec').leaders.forEach((l, i) => {
    l.dead = i === 0;
    l.deaths = i === 0 ? 1 : 0;
    if (i !== 0) l.capturedBy = 'm';
  });
  p(g, 'ec').spice = 20;
  assert.deepEqual(viewGame(g, 'ec').revival.leaders.map((l) => l.id),
    [p(g, 'ec').leaders[0].id]);
});
void test('concealed foreign-ghola execution does not reveal Ecaz revival cohort history', () => {
  const g = fixture(true);
  g.expansions = ['ecaz', 'ix'];
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  const leader = p(g, 'ec').leaders[0];
  leader.dead = false;
  leader.deaths = 1;
  leader.gholaBy = 't';
  leader.capturedBy = 'h';
  leader.concealed = { captor: 'h', controller: 't', dead: false, deaths: 1 };
  const before = viewGame(g, 'ec');
  leader.dead = true;
  leader.deaths = 2;
  delete leader.capturedBy;
  const after = viewGame(g, 'ec');
  assert.deepEqual(after.players.find((seat) => seat.id === 'ec')?.leaders,
    before.players.find((seat) => seat.id === 'ec')?.leaders);
  assert.deepEqual(after.revival, before.revival);
});
