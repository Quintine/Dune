import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  TERRITORIES,
  distance,
  location,
  splitLocation,
  mobileRoutes,
  MOBILE_LOCATION,
} from '../game/board';
import {
  quoteMovementCancellation,
  MovementCancellationError,
} from '../game/karama-movement-cancellation';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(faction: 'guild' | 'ixians' | 'fremen' = 'ixians') {
  const g = createGame(
    'MOVECANCEL',
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
    true,
    faction === 'ixians' ? ['ix'] : [],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('p', 'Mover', faction),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['e', 'p', 'b'],
    movementRemaining: ['e', 'p', 'b'],
    deck: baseDeck(),
    lastBattle: ['e', 'p'],
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  for (const [id, kind] of [
    ['b', 'worthless'],
    ['e', 'karama'],
  ] as const) {
    const at = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(at >= 0);
    player(g, id).hand.push(g.deck.splice(at, 1)[0]);
  }
  return g;
}
function ready(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function enterMovement(g: Game) {
  g.phase = 4;
  g.active = null;
  g.ready = [];
  g = ready(g);
  if (g.phaseOpening) g = ready(g);
  assert.equal(g.phase, 5);
  return g;
}
function destination() {
  const to = TERRITORIES.filter((t) => t.type === 'sand')
    .flatMap((t) => t.sectors.map((s) => location(t.id, s)))
    .find(
      (key) =>
        distance('red_chasm:7', key, (k) => splitLocation(k).sector === 18) ===
        2,
    );
  assert.ok(to);
  return splitLocation(to);
}
type Case =
  | 'guildFirst'
  | 'guildLast'
  | 'ix'
  | 'fremen'
  | 'mobile'
  | 'advisorFollowup'
  | 'advisorDeclaration'
  | 'advisorRemaining';
function opportunity(kind: Case) {
  if (kind === 'guildFirst' || kind === 'guildLast') {
    let g = fixture('guild');
    if (kind === 'guildLast') g.order = ['p', 'e', 'b'];
    g = enterMovement(g);
    assert.equal(g.decision?.kind, 'guildTiming');
    return applyAction(g, 'p', {
      type: 'decision',
      take: kind === 'guildFirst',
    });
  }
  if (kind === 'ix' || kind === 'fremen') {
    let g = fixture(kind === 'ix' ? 'ixians' : 'fremen');
    player(g, 'p').forces = { 'red_chasm:7': 4 };
    player(g, 'p').reserves = 16;
    player(g, 'p').elites = {
      forces: { 'red_chasm:7': 1 },
      tanks: 0,
      reserves: kind === 'ix' ? 6 : 2,
      revived: 0,
    };
    const to = destination();
    g = applyAction(g, 'p', {
      type: 'move',
      from: 'red_chasm:7',
      amount: 4,
      elite: 1,
      territory: to.territory,
      sector: to.sector,
    });
    assert.equal(
      g.response?.kind,
      kind === 'ix' ? 'ixMovement' : 'fremenMovement',
    );
    return g;
  }
  if (kind === 'mobile') {
    let g = fixture();
    g.phase = 8;
    g.turn = 1;
    g.active = null;
    g.mobileStronghold = { location: 'polar_sink:0' };
    player(g, 'p').forces = { [MOBILE_LOCATION]: 6 };
    player(g, 'p').reserves = 14;
    player(g, 'p').elites = {
      forces: { [MOBILE_LOCATION]: 3 },
      reserves: 4,
      tanks: 0,
      revived: 1,
    };
    g = ready(g);
    if (g.phaseOpening) g = ready(g);
    assert.equal(g.decision?.kind, 'mobileStronghold');
    const route = mobileRoutes(g, 3)[0];
    assert.ok(route);
    return applyAction(g, 'p', { type: 'decision', route, collect: true });
  }
  let g = fixture('fremen');
  player(g, 'b').forces = { 'arrakeen:10': 2 };
  player(g, 'b').reserves = 18;
  if (kind === 'advisorFollowup') {
    g.active = 'e';
    g = applyAction(g, 'e', {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 2,
    });
    assert.equal(g.decision?.kind, 'intrusion');
    return applyAction(g, 'b', { type: 'decision', accept: true });
  }
  player(g, 'b').advisors = { arrakeen: {} };
  player(g, 'e').forces = { 'arrakeen:10': 2 };
  player(g, 'e').reserves = 18;
  if (kind === 'advisorRemaining') {
    player(g, 'b').forces['carthag:11'] = 1;
    player(g, 'b').reserves--;
    player(g, 'b').advisors!.carthag = {};
    player(g, 'e').forces['carthag:11'] = 1;
    player(g, 'e').reserves--;
  }
  g = enterMovement(g);
  assert.equal(g.decision?.kind, 'advisorBattle');
  return applyAction(g, 'b', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
  });
}
function quote(g: Game) {
  assert.ok(g.response);
  return quoteMovementCancellation(g, g.response);
}
function cancel(g: Game, bg = false) {
  const id = bg ? 'b' : 'e',
    card = player(g, id).hand[0].id;
  let done = applyAction(g, id, { type: 'card', card, mode: 'cancel' });
  if (bg) {
    assert.equal(done.response?.kind, 'worthlessKarama');
    while (done.response?.kind === 'worthlessKarama') {
      const next = done.players.find(
        (p) => !done.response!.passed.includes(p.id),
      )!;
      done = applyAction(done, next.id, { type: 'passResponse' });
    }
  }
  assert.equal(done.discard.filter((c) => c.id === card).length, 1);
  return done;
}
for (const kind of [
  'guildFirst',
  'guildLast',
  'ix',
  'fremen',
  'mobile',
  'advisorFollowup',
  'advisorDeclaration',
  'advisorRemaining',
] as const)
  void test(`pure ${kind} cancellation quote follows genuine declaration without mutation, hands or random effects`, (t) => {
    const g = opportunity(kind),
      before = structuredClone(g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('Pure quote sampled randomness');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('Pure quote created UUID');
    });
    const result = quote(g);
    assert.ok(result);
    assert.deepEqual(quote(g), result);
    assert.deepEqual(g, before);
    for (const p of g.players)
      Object.defineProperty(p, 'hand', {
        get() {
          throw Error('Read private hand');
        },
      });
    assert.deepEqual(quote(g), result);
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
for (const bg of [false, true])
  for (const kind of [
    'guildFirst',
    'guildLast',
    'ix',
    'fremen',
    'mobile',
  ] as const)
    void test(`${bg ? 'BG' : 'printed'} cancellation commits only the quoted ${kind} flag or successor`, () => {
      const g = opportunity(kind),
        result = quote(g)!,
        before = structuredClone(g);
      const done = cancel(reload(g), bg);
      assert.deepEqual(g, before);
      assert.deepEqual(
        done.players.map((p) => ({
          forces: p.forces,
          reserves: p.reserves,
          tanks: p.tanks,
          spice: p.spice,
          moved: p.moved,
        })),
        g.players.map((p) => ({
          forces: p.forces,
          reserves: p.reserves,
          tanks: p.tanks,
          spice: p.spice,
          moved: p.moved,
        })),
      );
      if (result.kind === 'guildTiming') {
        assert.equal(done.active, result.active);
        assert.equal(done.guildTimingLocked, true);
        assert.deepEqual(done.movementRemaining, g.movementRemaining);
      } else if (
        result.kind === 'ixMovement' ||
        result.kind === 'fremenMovement'
      ) {
        assert.deepEqual(
          result.kind === 'ixMovement'
            ? player(done, 'p').ixMovementBlocked
            : player(done, 'p').fremenMovementBlocked,
          { turn: g.turn, move: player(g, 'p').moved },
        );
        assert.equal(
          result.kind === 'ixMovement'
            ? done.pendingIxMove
            : done.pendingFremenMove,
          null,
        );
      } else {
        assert.equal(done.pendingMobileMove, null);
        assert.deepEqual(done.mobileStronghold, g.mobileStronghold);
        assert.deepEqual(done.stormDialers, g.lastBattle);
        assert.equal(player(done, 'p').elites!.revived, 0);
        assert.equal(
          done.log.filter((l) => l.text === `Turn ${g.turn} begins.`).length,
          1,
        );
      }
      assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    });
for (const kind of [
  'advisorFollowup',
  'advisorDeclaration',
  'advisorRemaining',
] as const)
  void test(`printed ${kind} cancellation preserves stance and opens only its quoted next choice`, () => {
    const g = opportunity(kind),
      result = quote(g)!;
    const done = cancel(g);
    assert.deepEqual(player(done, 'b').advisors, player(g, 'b').advisors);
    assert.equal(result.kind, 'advisorFlip');
    if (result.kind !== 'advisorFlip') throw Error('Wrong quote');
    if (result.successor === 'advisor' || result.successor === 'advisorBattle')
      assert.equal(done.decision?.kind, result.successor);
    else {
      assert.equal(done.decision, null);
      assert.equal(done.active, g.movementRemaining![0]);
    }
  });
void test('canceled Ix move remains accepted when its uncommitted source or route is no longer usable', () => {
  const g = opportunity('ix');
  player(g, 'p').reserves += 4;
  player(g, 'p').forces = {};
  player(g, 'p').elites!.reserves++;
  player(g, 'p').elites!.forces = {};
  g.storm = splitLocation(g.response!.location!).sector;
  assert.equal(quote(g)?.kind, 'ixMovement');
  const done = cancel(g, true);
  assert.equal(player(done, 'p').moved, 0);
  assert.deepEqual(player(done, 'p').forces, {});
});
void test('future advisor shipment and remaining declaration choices are not pre-accepted by cancellation', () => {
  const g = opportunity('advisorFollowup');
  g.storm = 10;
  assert.deepEqual(quote(g), { kind: 'advisorFlip', successor: 'advisor' });
  const done = cancel(g);
  assert.equal(done.decision?.kind, 'advisor');
  const remaining = opportunity('advisorRemaining');
  player(remaining, 'b').advisors!.carthag.lockedTurn = remaining.turn;
  assert.deepEqual(quote(remaining), {
    kind: 'advisorFlip',
    successor: 'advisorBattle',
  });
  assert.equal(cancel(remaining).decision?.kind, 'advisorBattle');
});
void test('mobile cancellation never quotes a sampled replacement for a missing Fremen storm card', (t) => {
  const g = opportunity('mobile');
  g.players.push(newPlayer('f', 'Fremen', 'fremen'));
  g.stormCard = null;
  const before = structuredClone(g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Sampled future storm card');
  });
  assert.deepEqual(quote(g), {
    kind: 'mobileStronghold',
    successor: 'beginStormTurn',
  });
  assert.deepEqual(g, before);
  assert.equal(random.mock.callCount(), 0);
});
void test('worm-ride and empty-queue phase-completion advisor chains are explicitly outside this bounded quote', () => {
  const worm = opportunity('advisorFollowup');
  worm.phase = 1;
  worm.response!.advisorResume = 'wormRide';
  delete worm.response!.advisorFollowup;
  assert.equal(quote(worm), null);
  const last = opportunity('advisorDeclaration');
  last.movementRemaining = [];
  assert.equal(quote(last), null);
});
for (const kind of [
  'guildFirst',
  'ix',
  'fremen',
  'mobile',
  'advisorFollowup',
  'advisorDeclaration',
] as const)
  void test(`malformed ${kind} owner, phase and family-specific bindings reject the pure quote atomically`, () => {
    const original = opportunity(kind);
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.response!.owner = 'missing';
      },
      (g) => {
        g.phase = 7;
      },
    ];
    if (kind === 'guildFirst')
      mutations.push(
        (g) => {
          g.movementRemaining = ['unseated'];
        },
        (g) => {
          g.response!.take = false;
        },
      );
    else if (kind === 'ix')
      mutations.push(
        (g) => {
          g.pendingIxMove!.total++;
        },
        (g) => {
          g.response!.elite = 99;
        },
      );
    else if (kind === 'fremen')
      mutations.push(
        (g) => {
          g.pendingFremenMove!.turn++;
        },
        (g) => {
          g.pendingFremenMove!.move++;
        },
      );
    else if (kind === 'mobile')
      mutations.push(
        (g) => {
          g.pendingMobileMove!.route = ['polar_sink:0', 'red_chasm:7'];
        },
        (g) => {
          g.stormCard = 99;
        },
      );
    else if (kind === 'advisorFollowup')
      mutations.push(
        (g) => {
          g.response!.advisorFollowup!.shipment = 'missing';
        },
        (g) => {
          g.response!.advisorFollowup!.destination = 'arrakeen:00';
        },
      );
    else
      mutations.push((g) => {
        g.response!.advisorRemaining = ['missing'];
      });
    for (const mutate of mutations) {
      const g = reload(original);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(() => quote(g), MovementCancellationError);
      assert.deepEqual(g, before);
    }
  });

void test('Basic Fremen and a second Hajr Ix movement bind the current unspent move index', () => {
  const basic = fixture('fremen');
  basic.advanced = false;
  player(basic, 'p').forces = { 'red_chasm:7': 4 };
  player(basic, 'p').reserves = 16;
  const to = destination();
  const response = applyAction(basic, 'p', {
    type: 'move',
    from: 'red_chasm:7',
    amount: 4,
    territory: to.territory,
    sector: to.sector,
  });
  assert.deepEqual(quote(response), {
    kind: 'fremenMovement',
    player: 'p',
    turn: 2,
    move: 0,
  });
  assert.equal(player(cancel(response), 'p').moved, 0);
  const second = opportunity('ix');
  second.hajr = ['p'];
  player(second, 'p').moved = 1;
  assert.deepEqual(quote(second), {
    kind: 'ixMovement',
    player: 'p',
    turn: 2,
    move: 1,
  });
  assert.deepEqual(player(cancel(second), 'p').ixMovementBlocked, {
    turn: 2,
    move: 1,
  });
});
void test('Fremen canonical order validation still rejects lost custody before either cancellation cost', () => {
  for (const bg of [false, true]) {
    const g = opportunity('fremen');
    player(g, 'p').forces = {};
    player(g, 'p').elites!.forces = {};
    const before = structuredClone(g);
    // This helper validates declaration shape; the existing engine additionally
    // validates actual Fremen order custody/routes, unlike canceled Ix movement.
    assert.equal(quote(g)?.kind, 'fremenMovement');
    assert.throws(() => cancel(g, bg));
    assert.deepEqual(g, before);
  }
});
void test('canceled Guild timing retains the protected Sapho-last queue verbatim', () => {
  const g = opportunity('guildFirst');
  // Current public queue protection established before the Guild response;
  // exercise the adapter without guessing a new first-versus-Guild ruling.
  g.saphoMovementLast = {
    turn: g.turn,
    event: `movement:${g.turn}`,
    player: 'b',
  };
  assert.deepEqual(quote(g), { kind: 'guildTiming', active: 'e' });
  const done = cancel(g);
  assert.deepEqual(done.saphoMovementLast, g.saphoMovementLast);
  assert.deepEqual(done.movementRemaining, g.movementRemaining);
  assert.equal(done.active, 'e');
});

// Invalid saved opportunities are constructed from genuine declarations. No
// signature is edited: these exercise the semantic check before the first cost.
for (const kind of [
  'guildFirst',
  'ix',
  'fremen',
  'mobile',
  'advisorFollowup',
] as const)
  for (const bg of [false, true]) {
    if (kind === 'advisorFollowup' && bg) continue; // The owner cannot cancel itself.
    void test(`${bg ? 'BG' : 'printed'} ${kind} rejects invalid live cancellation context before consuming its card`, (t) => {
      const original = opportunity(kind);
      const mutations: ((g: Game) => void)[] = [
        (g) => {
          g.phase = 7;
        },
        (g) => {
          g.response!.owner = 'missing';
        },
      ];
      if (kind === 'guildFirst')
        mutations.push(
          (g) => {
            g.movementRemaining = [];
          },
          (g) => {
            g.movementRemaining = ['e', 'e', 'p'];
          },
          (g) => {
            g.response!.take = false;
          },
        );
      else if (kind === 'ix')
        mutations.push(
          (g) => {
            g.pendingIxMove = null;
          },
          (g) => {
            g.pendingIxMove!.total++;
          },
          (g) => {
            g.response!.elite = 99;
          },
        );
      else if (kind === 'fremen')
        mutations.push(
          (g) => {
            g.pendingFremenMove = null;
          },
          (g) => {
            g.pendingFremenMove!.turn++;
          },
          (g) => {
            g.pendingFremenMove!.order.eliteGroup = {};
          },
        );
      else if (kind === 'mobile')
        mutations.push(
          (g) => {
            g.pendingMobileMove = null;
          },
          (g) => {
            g.pendingMobileMove!.collect = 'yes' as unknown as boolean;
          },
          (g) => {
            g.stormCard = 99;
          },
        );
      else
        mutations.push(
          (g) => {
            g.response!.advisorFollowup!.shipment = 'missing';
          },
          (g) => {
            g.response!.advisorFollowup!.destination = 'arrakeen:00';
          },
        );
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Invalid cancellation sampled randomness');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Invalid cancellation generated UUID');
      });
      for (const mutate of mutations) {
        const g = reload(original);
        mutate(g);
        const before = structuredClone(g),
          id = bg ? 'b' : 'e',
          card = player(g, id).hand[0].id;
        assert.throws(() =>
          applyAction(g, id, { type: 'card', card, mode: 'cancel' }),
        );
        assert.deepEqual(g, before);
        assert.ok(player(g, id).hand.some((c) => c.id === card));
        assert.equal(
          g.discard.some((c) => c.id === card),
          false,
        );
        assert.equal(g.pendingKarama, before.pendingKarama);
      }
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });
  }
