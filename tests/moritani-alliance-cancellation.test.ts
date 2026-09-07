import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  createTerrorState,
  placeTerror,
  type TerrorKind,
} from '../game/moritani-terror';
import {
  quoteMoritaniAllianceCancellation,
  MoritaniAllianceCancellationError,
} from '../game/moritani-alliance-cancellation';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
type Cause = NonNullable<Game['pendingTerrorEntry']>['cause'];
function fixture(
  cause: Cause = 'shipment',
  kind: TerrorKind = 'robbery',
  advanced = true,
) {
  const g = createGame(
    'ALLYCANCEL',
    newPlayer('m', 'Moritani', 'moritani'),
    advanced,
  );
  g.players.push(
    newPlayer(
      'e',
      'Entrant',
      cause === 'wormRide'
        ? 'fremen'
        : cause === 'guildTransport'
          ? 'guild'
          : cause === 'advisor'
            ? 'beneGesserit'
            : 'emperor',
    ),
    newPlayer('k', 'Canceler', 'atreides'),
  );
  if (cause !== 'advisor')
    g.players.push(newPlayer('b', 'Sisterhood', 'beneGesserit'));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'e',
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
    phaseOpening: null,
  });
  g.movementRemaining = ['e', ...g.order.filter((id) => id !== 'e')];
  g.order = [...g.movementRemaining];
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
    });
  if (cause !== 'advisor')
    Object.assign(player(g, 'b'), { reserves: 0, tanks: 20 });
  for (const [id, kind] of [
    ['k', 'karama'],
    [cause === 'advisor' ? 'e' : 'b', 'worthless'],
  ]) {
    const index = g.deck.findIndex((c) => c.effect === kind || c.kind === kind);
    assert.ok(index >= 0);
    player(g, id).hand.push(g.deck.splice(index, 1)[0]);
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === kind)!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
/** Exposed phase fixture, followed by real entry and alliance-declaration actions. */
function opportunity(
  cause: Cause = 'shipment',
  kind: TerrorKind = 'robbery',
  advanced = true,
) {
  let g = fixture(cause, kind, advanced);
  if (cause === 'shipment')
    g = applyAction(g, 'e', {
      type: 'ship',
      amount: 2,
      territory: 'arrakeen',
      sector: 10,
    });
  else if (cause === 'movement' || cause === 'guildTransport') {
    const from = cause === 'movement' ? 'imperial_basin:10' : 'carthag:11';
    player(g, 'e').forces = { [from]: 3 };
    player(g, 'e').reserves = 17;
    // The active Guild has already been granted its combined turn.
    if (cause === 'guildTransport') g.guildTimingGranted = true;
    g = applyAction(g, 'e', {
      type: cause === 'movement' ? 'move' : 'guildShip',
      from,
      amount: 2,
      territory: 'arrakeen',
      sector: 10,
    });
  } else if (cause === 'wormRide') {
    g.phase = 1;
    g.active = null;
    player(g, 'e').forces = { 'imperial_basin:10': 3, 'hagga_basin:11': 1 };
    player(g, 'e').reserves = 16;
    g.decision = { kind: 'wormRide', player: 'e', territory: 'imperial_basin' };
    g.wormRides = ['hagga_basin'];
    g = applyAction(g, 'e', {
      type: 'decision',
      accept: true,
      territory: 'arrakeen',
      sector: 10,
      forces: { 'imperial_basin:10': 2 },
    });
  } else {
    player(g, 'k').forces = { 'arrakeen:10': 1 };
    player(g, 'k').reserves = 19;
    g.decision = {
      kind: 'advisor',
      player: 'e',
      shipment: 'k',
      destination: 'arrakeen:10',
    };
    g = applyAction(g, 'e', {
      type: 'decision',
      accept: true,
      accompany: true,
    });
  }
  while (g.response?.kind === 'advisor') {
    const passer = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, passer.id, { type: 'passResponse' });
  }
  assert.equal(g.pendingTerrorEntry?.cause, cause);
  g = applyAction(g, 'm', { type: 'decision', alliance: true });
  assert.equal(g.response?.kind, 'moritaniAlliance');
  return g;
}
const quote = (g: Game) => quoteMoritaniAllianceCancellation(g, g.response!);
function cancel(g: Game, bg: boolean) {
  const id = bg ? (g.players.some((p) => p.id === 'b') ? 'b' : 'e') : 'k';
  const card = player(g, id).hand.find((c) =>
    bg ? c.kind === 'worthless' : c.effect === 'karama',
  )!;
  let done = applyAction(g, id, {
    type: 'card',
    card: card.id,
    mode: 'cancel',
  });
  if (bg) {
    assert.equal(done.response?.kind, 'worthlessKarama');
    for (let i = 0; done.response && i < 10; i++) {
      const passer = done.players.find(
        (p) => !done.response!.passed.includes(p.id),
      )!;
      done = applyAction(reload(done), passer.id, { type: 'passResponse' });
    }
  }
  assert.equal(done.response, null);
  assert.equal(done.discard.filter((c) => c.id === card.id).length, 1);
  return done;
}

for (const cause of [
  'shipment',
  'movement',
  'guildTransport',
  'advisor',
  'wormRide',
] as const) {
  void test(`pure ${cause} alliance cancellation returns only the original entry and next choice`, (t) => {
    const g = opportunity(cause),
      before = structuredClone(g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('random draw');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('uuid draw');
    });
    const q = quote(g)!;
    assert.deepEqual(q.entry, {
      ...g.pendingTerrorEntry,
      stage: 'offer',
      allianceBlocked: true,
    });
    assert.deepEqual(q.decision, {
      kind: 'moritaniTerror',
      player: 'm',
      entrant: 'e',
      territory: 'arrakeen',
    });
    assert.deepEqual(g, before);
    for (const p of g.players)
      for (const field of [
        'hand',
        'leaders',
        'forces',
        'spice',
        'reserves',
        'ally',
      ])
        Object.defineProperty(p, field, {
          get() {
            throw Error(`private/current ${field} read`);
          },
        });
    assert.deepEqual(quote(g), q);
    assert.equal(JSON.stringify(q).includes('robbery'), false);
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
    q.entry.amount++;
    assert.equal(
      g.pendingTerrorEntry!.amount,
      before.pendingTerrorEntry!.amount,
    );
  });
  for (const bg of [false, true])
    void test(`${bg ? 'BG' : 'printed'} cancels genuine ${cause} offer without repeating entry or revealing token`, () => {
      const g = opportunity(cause),
        q = quote(g)!;
      const done = cancel(reload(g), bg);
      assert.deepEqual(done.pendingTerrorEntry, q.entry);
      assert.deepEqual(done.decision, q.decision);
      assert.deepEqual(done.moritaniTerror, g.moritaniTerror);
      const resources = (state: Game) =>
        state.players.map(
          ({ spice, forces, reserves, tanks, ally, moved, shipped }) => ({
            spice,
            forces,
            reserves,
            tanks,
            ally,
            moved,
            shipped,
          }),
        );
      assert.deepEqual(resources(done), resources(g));
      assert.deepEqual(done.wormRides, g.wormRides);
      assert.equal('kind' in viewGame(done, 'k').terrorEntry!, false);
      assert.equal(viewGame(done, 'm').terrorEntry!.kind, 'robbery');
      assert.throws(() =>
        applyAction(done, 'm', { type: 'decision', alliance: true }),
      );
      const declined = applyAction(reload(done), 'm', {
        type: 'decision',
        decline: true,
      });
      assert.equal(declined.pendingTerrorEntry, null);
      assert.deepEqual(declined.moritaniTerror, done.moritaniTerror);
      if (cause === 'wormRide') {
        assert.equal(declined.decision?.kind, 'wormRide');
        assert.ok(declined.decision?.kind === 'wormRide');
        assert.equal(declined.decision.territory, 'hagga_basin');
      }
    });
}

void test('pure cancellation retains Basic availability and does not require future reveal or placement to be legal', () => {
  const basic = opportunity('shipment', 'robbery', false);
  assert.ok(quote(basic));
  assert.ok(cancel(basic, false));
  for (const kind of ['assassination', 'sneakAttack', 'sabotage'] as const) {
    const g = opportunity('shipment', kind);
    // A valid offer already exists. Later resource/custody changes must not
    // pre-accept the reveal, nor invalidate returning to the optional choice.
    player(g, 'e').leaders.forEach((leader) => {
      leader.dead = true;
    });
    player(g, 'e').forces = {};
    player(g, 'e').tanks = 20;
    player(g, 'e').reserves = 0;
    player(g, 'm').reserves = 0;
    player(g, 'm').tanks = 20;
    g.storm = 10;
    player(g, 'm').ally = 'e';
    player(g, 'e').ally = 'm';
    assert.ok(quote(g));
    const done = cancel(g, false);
    assert.equal(done.pendingTerrorEntry!.stage, 'offer');
    assert.equal(player(done, 'm').ally, 'e');
  }
});

const mutations: [string, (g: Game) => void][] = [
  [
    'foreign owner',
    (g) => {
      g.response!.owner = 'k';
    },
  ],
  [
    'unseated entrant',
    (g) => {
      g.pendingTerrorEntry!.entrant = 'missing';
    },
  ],
  [
    'self entrant',
    (g) => {
      g.pendingTerrorEntry!.entrant = 'm';
    },
  ],
  [
    'Ecaz entrant',
    (g) => {
      player(g, 'e').faction = 'ecaz';
    },
  ],
  [
    'stale turn',
    (g) => {
      g.pendingTerrorEntry!.turn--;
    },
  ],
  [
    'crossed phase',
    (g) => {
      g.pendingTerrorEntry!.phase = 1;
    },
  ],
  [
    'wrong stage',
    (g) => {
      g.pendingTerrorEntry!.stage = 'allianceReply';
    },
  ],
  [
    'already blocked',
    (g) => {
      g.pendingTerrorEntry!.allianceBlocked = true;
    },
  ],
  [
    'invalid sector',
    (g) => {
      g.pendingTerrorEntry!.sector = 9;
    },
  ],
  [
    'invalid declared amount',
    (g) => {
      g.pendingTerrorEntry!.amount = -1;
    },
  ],
  [
    'invalid declared elite',
    (g) => {
      g.pendingTerrorEntry!.elite = 3;
    },
  ],
  [
    'crossed continuation',
    (g) => {
      g.pendingTerrorEntry!.resume = 'wormRide';
    },
  ],
  [
    'missing token',
    (g) => {
      g.pendingTerrorEntry!.token = 'missing';
    },
  ],
  [
    'spent token',
    (g) => {
      g.moritaniTerror!.tokens.find(
        (t) => t.id === g.pendingTerrorEntry!.token,
      )!.status = 'removed';
    },
  ],
  [
    'relocated token',
    (g) => {
      g.moritaniTerror!.tokens.find(
        (t) => t.id === g.pendingTerrorEntry!.token,
      )!.location = 'carthag';
    },
  ],
  [
    'duplicate token',
    (g) => {
      g.moritaniTerror!.tokens.push({
        ...g.moritaniTerror!.tokens.find(
          (t) => t.id === g.pendingTerrorEntry!.token,
        )!,
      });
    },
  ],
];
for (const [name, mutate] of mutations) {
  void test(`pure malformed ${name} rejects without altering the source`, () => {
    const g = opportunity();
    mutate(g);
    const before = structuredClone(g);
    assert.throws(() => quote(g), MoritaniAllianceCancellationError);
    assert.deepEqual(g, before);
  });
  for (const bg of [false, true])
    void test(`${bg ? 'BG' : 'printed'} malformed ${name} rejects before accepting card cost`, () => {
      const g = opportunity();
      mutate(g);
      const before = structuredClone(g),
        id = bg ? 'b' : 'k',
        card = player(g, id).hand[0];
      assert.throws(() =>
        applyAction(g, id, { type: 'card', card: card.id, mode: 'cancel' }),
      );
      assert.deepEqual(g, before);
      assert.equal(
        g.discard.some((c) => c.id === card.id),
        false,
      );
    });
}
void test('pure other response families remain with their own validators', () => {
  const g = fixture();
  assert.equal(
    quoteMoritaniAllianceCancellation(g, {
      kind: 'advisor',
      owner: 'b',
      passed: [],
    }),
    null,
  );
});

void test('saved paid BG cancellation preserves changed board and leader custody without requiring the future reveal', () => {
  let g = opportunity('shipment', 'assassination');
  const card = player(g, 'b').hand[0];
  g = applyAction(g, 'b', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  // A saved interruption may have changed resources. These are deliberately
  // constructed post-declaration changes, not an assertion that any specific
  // currently supported interruption destroys every leader or arriving force.
  g = reload(g);
  player(g, 'e').leaders.forEach((leader) => {
    leader.dead = true;
  });
  player(g, 'e').forces = {};
  player(g, 'e').tanks = 2;
  g.storm = 10;
  const entry = structuredClone(g.pendingTerrorEntry);
  const terror = structuredClone(g.moritaniTerror);
  const players = structuredClone(g.players);
  while (g.response?.kind === 'worthlessKarama') {
    const passer = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(reload(g), passer.id, { type: 'passResponse' });
  }
  assert.deepEqual(g.pendingTerrorEntry, {
    ...entry,
    stage: 'offer',
    allianceBlocked: true,
  });
  assert.deepEqual(g.players, players);
  assert.deepEqual(g.moritaniTerror, terror);
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  assert.equal(viewGame(g, 'm').terrorEntry!.canReveal, false);
  assert.equal('canReveal' in viewGame(g, 'e').terrorEntry!, false);
  assert.doesNotThrow(() =>
    applyAction(g, 'm', { type: 'decision', decline: true }),
  );
});
