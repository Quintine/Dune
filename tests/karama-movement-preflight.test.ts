import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteCompletedMovementArrival,
  MovementArrivalError,
  type CompletedMovementArrivalInput,
} from '../game/karama-movement-preflight';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

function fixture(): CompletedMovementArrivalInput {
  return {
    advanced: true,
    players: [
      { id: 'p', faction: 'emperor', ally: null, forces: {} },
      { id: 'b', faction: 'beneGesserit', ally: null, forces: {} },
      { id: 'e', faction: 'ecaz', ally: null, forces: {} },
      { id: 'm', faction: 'moritani', ally: null, forces: {} },
    ],
    order: {
      player: 'p',
      origin: 'red_chasm',
      to: 'broken_land',
      advisors: false,
      wantsFighters: false,
    },
    ambassadors: [],
    terror: [],
    controls: {
      response: false,
      decision: false,
      pendingTerror: false,
      pendingAmbassador: false,
      paidBox: false,
    },
    flight: null,
  };
}
const ambassador = {
  zone: 'placed' as const,
  location: 'broken_land',
  effect: 'atreides' as const,
};
const terror = { status: 'placed' as const, location: 'broken_land' };

void test('a plain movement has no arrival reaction, and an eligible token opens only its own opportunity', () => {
  const input = fixture();
  assert.deepEqual(quoteCompletedMovementArrival(input), {
    intrusion: false,
    reaction: null,
    retiresOrnithopter: false,
  });
  assert.equal(
    quoteCompletedMovementArrival({ ...input, ambassadors: [ambassador] })
      .reaction,
    'ambassador',
  );
  assert.equal(
    quoteCompletedMovementArrival({ ...input, terror: [terror] }).reaction,
    'terror',
  );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...input,
        ambassadors: [ambassador],
        terror: [terror],
      }),
    MovementArrivalError,
  );
});

for (const exclusion of [
  'owner',
  'ally',
  'matchingFaction',
  'advisor',
] as const)
  void test(`Ambassador ${exclusion} exclusion still permits the independent Terror opportunity`, () => {
    const input = fixture();
    const players = input.players.map((p) => ({ ...p }));
    let order = { ...input.order };
    if (exclusion === 'owner') order.player = 'e';
    if (exclusion === 'ally') players.find((p) => p.id === 'e')!.ally = 'p';
    if (exclusion === 'matchingFaction')
      players.find((p) => p.id === 'p')!.faction = 'atreides';
    if (exclusion === 'advisor') {
      order = { ...order, player: 'b', advisors: true };
    }
    assert.equal(
      quoteCompletedMovementArrival({
        ...input,
        players,
        order,
        ambassadors: [ambassador],
        terror: [terror],
      }).reaction,
      'terror',
    );
  });

for (const entrant of ['m', 'p'])
  void test(`Terror exempts its ${entrant === 'm' ? 'owner' : 'ally'} while independent Ambassador entry stays eligible`, () => {
    const input = fixture();
    const players = input.players.map((p) =>
      p.id === 'm' ? { ...p, ally: 'p' } : p,
    );
    assert.equal(
      quoteCompletedMovementArrival({
        ...input,
        players,
        order: { ...input.order, player: entrant },
        ambassadors: [ambassador],
        terror: [terror],
      }).reaction,
      'ambassador',
    );
  });

void test('BG intrusion uses current opposing fighters, requires Advanced rules and excludes the mover itself', () => {
  const input = fixture();
  const players = input.players.map((p) =>
    p.id === 'b' ? { ...p, forces: { 'broken_land:9': 2 } } : p,
  );
  assert.equal(
    quoteCompletedMovementArrival({ ...input, players }).intrusion,
    true,
  );
  assert.equal(
    quoteCompletedMovementArrival({ ...input, players, advanced: false })
      .intrusion,
    false,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      players,
      order: { ...input.order, player: 'b' },
    }).intrusion,
    false,
  );
  const advisors = players.map((p) =>
    p.id === 'b' ? { ...p, advisors: { broken_land: {} } } : p,
  );
  assert.equal(
    quoteCompletedMovementArrival({ ...input, players: advisors }).intrusion,
    false,
  );
  for (const tokens of [{ ambassadors: [ambassador] }, { terror: [terror] }])
    assert.throws(
      () => quoteCompletedMovementArrival({ ...input, players, ...tokens }),
      /another arrival reaction/,
    );
});

void test('mover advisor stance is the declared resulting stance, not its stale destination map', () => {
  const input = fixture();
  const players = input.players.map((p) =>
    p.id === 'b' ? { ...p, advisors: { broken_land: {} } } : p,
  );
  const base = {
    ...input,
    players,
    ambassadors: [ambassador],
    order: { ...input.order, player: 'b' },
  };
  assert.equal(quoteCompletedMovementArrival(base).reaction, 'ambassador');
  assert.equal(
    quoteCompletedMovementArrival({
      ...base,
      order: { ...base.order, advisors: true },
    }).reaction,
    null,
  );
  // A pending fighter flip leaves the advisor stance in place until allowed.
  assert.equal(
    quoteCompletedMovementArrival({
      ...base,
      order: { ...base.order, advisors: true, wantsFighters: true },
    }).reaction,
    null,
  );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...base,
        terror: [terror],
        order: { ...base.order, advisors: true, wantsFighters: true },
      }),
    /Terror combined/,
  );
});

void test('same-territory movement still reports intrusion but does not reopen Ambassador or Terror entry', () => {
  const input = fixture();
  const players = input.players.map((p) =>
    p.id === 'b' ? { ...p, forces: { 'broken_land:9': 1 } } : p,
  );
  assert.deepEqual(
    quoteCompletedMovementArrival({
      ...input,
      players,
      order: { ...input.order, origin: 'broken_land', wantsFighters: true },
      ambassadors: [ambassador],
      terror: [terror],
      controls: {
        ...input.controls,
        response: true,
        decision: true,
        pendingTerror: true,
        pendingAmbassador: true,
      },
    }),
    { intrusion: true, reaction: null, retiresOrnithopter: false },
  );
});

void test('current controls and the move-created fighter response are checked without inventing a global pending-parent ban', () => {
  const input = fixture();
  for (const flag of [
    'response',
    'decision',
    'pendingTerror',
    'pendingAmbassador',
  ] as const)
    assert.throws(
      () =>
        quoteCompletedMovementArrival({
          ...input,
          ambassadors: [ambassador],
          controls: { ...input.controls, [flag]: true },
        }),
      /Ambassadors combined/,
    );
  for (const flag of ['response', 'decision'] as const)
    assert.throws(
      () =>
        quoteCompletedMovementArrival({
          ...input,
          terror: [terror],
          controls: { ...input.controls, [flag]: true },
        }),
      /Terror combined/,
    );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...input,
        terror: [terror],
        controls: { ...input.controls, response: true, pendingTerror: true },
      }),
    /Resolve the pending Terror entry first/,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      terror: [terror],
      controls: { ...input.controls, pendingAmbassador: true },
    }).reaction,
    'terror',
  );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...input,
        ambassadors: [ambassador],
        order: { ...input.order, wantsFighters: true },
      }),
    /Ambassadors combined/,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      controls: {
        ...input.controls,
        response: true,
        decision: true,
        pendingTerror: true,
        pendingAmbassador: true,
      },
    }).reaction,
    null,
  );
});

void test('unplaced, removed, wrong-territory or unowned markers create no arrival opportunity', () => {
  const input = fixture();
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      ambassadors: [
        { ...ambassador, zone: 'supply', location: null },
        { ...ambassador, location: 'red_chasm' },
      ],
      terror: [
        { ...terror, status: 'removed' },
        { ...terror, location: 'red_chasm' },
      ],
    }).reaction,
    null,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      players: input.players.filter((p) => p.id !== 'e' && p.id !== 'm'),
      ambassadors: [ambassador],
      terror: [terror],
    }).reaction,
    null,
  );
});

void test('paid Box prevents only actual Ornithopter retirement: first two-groups move remains distinct from its final move', () => {
  const input = fixture();
  const controls = { ...input.controls, paidBox: true };
  assert.equal(
    quoteCompletedMovementArrival({ ...input, controls }).retiresOrnithopter,
    false,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      controls,
      flight: { player: 'p', mode: 'twoGroups', completed: 0 },
    }).retiresOrnithopter,
    false,
  );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...input,
        controls,
        flight: { player: 'p', mode: 'twoGroups', completed: 1 },
      }),
    /Finish the paid search/,
  );
  assert.throws(
    () =>
      quoteCompletedMovementArrival({
        ...input,
        controls,
        flight: { player: 'p', mode: 'range3', completed: 0 },
      }),
    /Finish the paid search/,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      controls,
      flight: { player: 'b', mode: 'range3', completed: 0 },
    }).retiresOrnithopter,
    false,
  );
  assert.equal(
    quoteCompletedMovementArrival({
      ...input,
      flight: { player: 'p', mode: 'twoGroups', completed: 1 },
    }).retiresOrnithopter,
    true,
  );
});

void test('arrival quotes are repeatable and immutable without RNG, events, or reading private cards and marker value', (t) => {
  const input = fixture();
  const before = structuredClone(input);
  for (const p of input.players)
    Object.defineProperty(p, 'hand', {
      get() {
        throw Error('Private hand read.');
      },
    });
  Object.defineProperty(input.players[0], 'noField', {
    get() {
      throw Error(
        'The mover marker value is irrelevant to arrival eligibility.',
      );
    },
  });
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Randomness in pure quote.');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('Event creation in pure quote.');
  });
  const first = quoteCompletedMovementArrival(input);
  assert.deepEqual(quoteCompletedMovementArrival(input), first);
  assert.deepEqual(JSON.parse(JSON.stringify(input)), before);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const source = 'imperial_basin:10';

function holdCard(g: Game, id: string, name: string) {
  const pile = g.richeseCache?.some((c) => c.name === name)
    ? g.richeseCache
    : g.deck;
  const index = pile!.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = pile!.splice(index, 1)[0];
  seat(g, id).hand.push(card);
  return card.id;
}
function physical(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0),
      20,
    );
  return ids;
}

/** Only initial board/card supply is staged. Movement card selection, the
 * CHOAM opportunity, and Baliset declaration are all actual public actions. */
function balisetFlight(mode: 'range3' | 'twoGroups', conflict = false) {
  let g = createGame('KARAMAARRIVAL', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
    'ecaz',
  ]);
  joinGame(g, newPlayer('p', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('e', 'Ecaz', 'ecaz'));
  joinGame(g, newPlayer('m', 'Moritani', 'moritani'));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['p', 'c', 'b', 'e', 'm'],
    active: 'p',
    movementRemaining: ['p', 'c', 'b', 'e', 'm'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  seat(g, 'p').forces[source] = 3;
  seat(g, 'p').reserves = 17;
  const territory = mode === 'range3' ? 'arrakeen' : 'carthag';
  const sector = mode === 'range3' ? 10 : 11;
  const destination = `${territory}:${sector}`;
  seat(g, 'c').forces[destination] = 1;
  seat(g, 'c').reserves = 19;
  const orni = holdCard(g, 'p', 'Ornithopter');
  const baliset = holdCard(g, 'c', 'Baliset');
  const printed = holdCard(g, 'p', 'Karama');
  const worthless = holdCard(g, 'b', 'Jubba Cloak');
  if (conflict) {
    g.ecazAmbassadors = createAmbassadors(() => 0);
    g.ecazAmbassadors = placeAmbassador(
      g.ecazAmbassadors,
      g.ecazAmbassadors.tokens.find((t) => t.effect === 'ecaz')!.id,
      {
        turn: 1,
        availableSpice: 10,
        destination: {
          id: territory,
          stronghold: true,
          allowed: true,
          inStorm: false,
        },
      },
    ).state;
    g.moritaniTerror = createTerrorState(() => 0);
    g.moritaniTerror = placeTerror(
      g.moritaniTerror,
      g.moritaniTerror.tokens.find((t) => t.kind === 'sabotage')!.id,
      territory,
      1,
    );
  }
  const inventory = physical(g);
  if (mode === 'twoGroups') {
    g = applyAction(g, 'p', {
      type: 'move',
      movementCard: orni,
      ornithopter: mode,
      forces: { [source]: 1 },
      territory: 'arrakeen',
      sector: 10,
    });
    assert.equal(g.ornithopter?.completed, 1);
    assert.equal(g.decision, null);
    g = applyAction(g, 'p', {
      type: 'move',
      ornithopterEvent: g.ornithopter!.event,
      forces: { [source]: 1 },
      territory,
      sector,
    });
  } else {
    g = applyAction(g, 'p', {
      type: 'move',
      movementCard: orni,
      ornithopter: mode,
      forces: { [source]: 1 },
      territory,
      sector,
    });
  }
  assert.equal(g.decision?.kind, 'choamMovement');
  assert.equal(seat(g, 'p').moved, mode === 'twoGroups' ? 1 : 0);
  g = applyAction(g, 'c', {
    type: 'card',
    card: baliset,
    mode: 'choam',
    target: 'p',
    territory,
  });
  assert.equal(g.response?.kind, 'choamWorthless');
  assert.equal(g.pendingChoamWorthless?.movement, true);
  assert.deepEqual(physical(g), inventory);
  return { g, orni, baliset, printed, worthless, destination };
}

function allowConversion(initial: Game) {
  let g = initial;
  while (g.response?.kind === 'worthlessKarama') {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}

for (const form of ['printed', 'worthless'] as const)
  for (const mode of ['range3', 'twoGroups'] as const)
    void test(`${form} cancellation of real Baliset rejects competing Ambassador and Terror arrival before cost (${mode})`, (t) => {
      const { g, printed, worthless, orni, baliset } = balisetFlight(
        mode,
        true,
      );
      const before = structuredClone(g);
      const inventory = physical(g);
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Rejected arrival preflight drew randomness.');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Rejected arrival preflight created an event.');
      });
      assert.throws(
        () =>
          applyAction(g, form === 'printed' ? 'p' : 'b', {
            type: 'card',
            mode: 'cancel',
            card: form === 'printed' ? printed : worthless,
          }),
        /Ambassadors combined with another arrival reaction/,
      );
      assert.deepEqual(g, before);
      assert.deepEqual(physical(g), inventory);
      assert.equal(g.pendingKarama ?? null, null);
      assert.equal(g.ornithopter?.card.id, orni);
      assert.equal(
        g.discard.some((c) =>
          [printed, worthless, baliset, orni].includes(c.id),
        ),
        false,
      );
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });

for (const form of ['printed', 'worthless'] as const)
  for (const mode of ['range3', 'twoGroups'] as const)
    void test(`${form} cancellation of real Baliset completes the exact final ${mode} flight and retires escrow once`, () => {
      const { g, printed, worthless, orni, baliset, destination } =
        balisetFlight(mode);
      const before = structuredClone(g);
      const inventory = physical(g);
      const spent = form === 'printed' ? printed : worthless;
      let done = applyAction(g, form === 'printed' ? 'p' : 'b', {
        type: 'card',
        mode: 'cancel',
        card: spent,
      });
      assert.deepEqual(g, before);
      if (form === 'worthless') {
        assert.equal(done.response?.kind, 'worthlessKarama');
        assert.equal(done.ornithopter?.completed, mode === 'twoGroups' ? 1 : 0);
        assert.equal(seat(done, 'p').forces[destination] ?? 0, 0);
        done = allowConversion(reload(done));
      }
      assert.equal(seat(done, 'p').forces[destination], 1);
      assert.equal(
        seat(done, 'p').forces[source],
        mode === 'twoGroups' ? 1 : 2,
      );
      assert.equal(seat(done, 'p').moved, mode === 'twoGroups' ? 2 : 1);
      assert.equal(done.ornithopter, null);
      assert.equal(done.pendingChoamMove, null);
      assert.equal(done.pendingTreacheryDiscard, null);
      assert.equal(done.discard.filter((c) => c.id === orni).length, 1);
      assert.equal(done.discard.filter((c) => c.id === spent).length, 1);
      assert.ok(seat(done, 'c').hand.some((c) => c.id === baliset));
      assert.deepEqual(physical(done), inventory);
      assert.deepEqual(
        reload(normalizeAutomaticGame(reload(done))),
        reload(done),
      );
    });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} cancellation still accepts a real Baliset order that became illegal, without moving or retiring the unused flight`, () => {
    const {
      g: original,
      printed,
      worthless,
      orni,
      baliset,
      destination,
    } = balisetFlight('range3');
    const g = reload(original);
    // Saved-state perturbation, not a claimed legal action during the response:
    // source units have returned to reserves. The current flight remains valid,
    // but its declared group is unavailable and must take the existing fizzle.
    seat(g, 'p').reserves += seat(g, 'p').forces[source];
    delete seat(g, 'p').forces[source];
    const before = structuredClone(g);
    const inventory = physical(g);
    const spent = form === 'printed' ? printed : worthless;
    let done = applyAction(g, form === 'printed' ? 'p' : 'b', {
      type: 'card',
      mode: 'cancel',
      card: spent,
    });
    assert.deepEqual(g, before);
    if (form === 'worthless') done = allowConversion(reload(done));
    assert.equal(seat(done, 'p').moved, 0);
    assert.equal(seat(done, 'p').forces[destination] ?? 0, 0);
    assert.equal(seat(done, 'p').reserves, 20);
    assert.equal(done.ornithopter?.completed, 0);
    assert.equal(done.ornithopter?.card.id, orni);
    assert.equal(done.pendingChoamMove, null);
    assert.equal(done.pendingChoamWorthless, null);
    assert.equal(done.discard.filter((c) => c.id === spent).length, 1);
    assert.equal(
      done.discard.some((c) => c.id === orni),
      false,
    );
    assert.ok(seat(done, 'c').hand.some((c) => c.id === baliset));
    assert.deepEqual(physical(done), inventory);
    assert.deepEqual(
      reload(normalizeAutomaticGame(reload(done))),
      reload(done),
    );
  });
