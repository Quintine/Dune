import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { newRevivalRules } from '../game/revival';
import {
  quoteChoamWorthlessCancellation,
  ChoamWorthlessCancellationError,
} from '../game/choam-worthless-cancellation';

type Case =
  | 'kulon'
  | 'laLaLa'
  | 'revival'
  | 'baliset'
  | 'movement'
  | 'gamont'
  | 'mentat'
  | 'storm';
const cases: Case[] = [
  'kulon',
  'laLaLa',
  'revival',
  'baliset',
  'movement',
  'gamont',
  'mentat',
  'storm',
];
const names: Record<Case, string> = {
  kulon: 'Kulon',
  laLaLa: 'La La La',
  revival: 'La La La',
  baliset: 'Baliset',
  movement: 'Baliset',
  gamont: 'Trip to Gamont',
  mentat: 'Trip to Gamont',
  storm: 'Jubba Cloak',
};
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function hold(g: Game, who: string, name: string) {
  const at = g.deck.findIndex((c) => c.name === name);
  assert.ok(at >= 0, name);
  const card = g.deck.splice(at, 1)[0];
  player(g, who).hand.push(card);
  return card;
}
function ready(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function source(kind: Case, advanced = true) {
  let g = createGame(
    'CWORTHCANCEL',
    newPlayer('c', 'CHOAM', 'choam'),
    advanced,
    ['choam'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    storm: 18,
    active: 'c',
    order: ['c', 'e', 'b'],
    deck: baseDeck(),
    revivalRules: newRevivalRules(),
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      tanks: 0,
      reserves: 20,
      spice: 20,
      traitorChoices: [],
    });
  const card = hold(g, 'c', names[kind]),
    printed = hold(g, 'e', 'Karama');
  const bg = hold(g, 'b', g.deck.find((c) => c.kind === 'worthless')!.name);
  const action: Action = { type: 'card', mode: 'choam', card: card.id };
  if (kind === 'kulon') g.phase = 5;
  else if (kind === 'laLaLa' || kind === 'revival') {
    g.phase = 4;
    player(g, 'e').tanks = 6;
    player(g, 'e').reserves = 14;
    if (kind === 'revival') {
      g = applyAction(g, 'e', { type: 'revive', amount: 3 });
      assert.equal(g.decision?.kind, 'choamFreeRevival');
    } else action.target = 'e';
  } else if (kind === 'baliset' || kind === 'movement') {
    g.phase = 5;
    g.active = 'e';
    g.movementRemaining = ['e', 'c', 'b'];
    g.order = [...g.movementRemaining];
    player(g, 'e').forces = { 'imperial_basin:10': 3 };
    player(g, 'e').reserves = 17;
    player(g, 'c').forces = { 'arrakeen:10': 1 };
    player(g, 'c').reserves = 19;
    player(g, 'b').reserves = 0;
    player(g, 'b').tanks = 20;
    if (kind === 'movement') {
      g = applyAction(g, 'e', {
        type: 'move',
        from: 'imperial_basin:10',
        territory: 'arrakeen',
        sector: 10,
        amount: 2,
      });
      assert.equal(g.decision?.kind, 'choamMovement');
    } else Object.assign(action, { target: 'e', territory: 'arrakeen' });
  } else if (kind === 'gamont' || kind === 'mentat') {
    g.phase = 8;
    player(g, 'e').forces = { 'arrakeen:10': 1 };
    player(g, 'e').reserves = 19;
    Object.assign(action, { target: 'e', from: 'arrakeen:10', elite: 0 });
    if (kind === 'mentat') {
      g = ready(g);
      assert.equal(g.decision?.kind, 'choamMarket');
      g = applyAction(g, 'c', { type: 'decision', done: true });
      assert.equal(g.decision?.kind, 'choamMentat');
    }
  } else {
    g.phase = 0;
    g.storm = 5;
    g.stormPending = 3;
    player(g, 'c').forces = { 'red_chasm:7': 4 };
    player(g, 'c').reserves = 16;
    g = ready(g);
    assert.equal(g.decision?.kind, 'choamStorm');
    action.territory = 'red_chasm';
  }
  return { g, action, card, printed, bg };
}
function actual(kind: Case, advanced = true) {
  const f = source(kind, advanced);
  f.g = applyAction(f.g, 'c', f.action);
  assert.equal(f.g.response?.kind, 'choamWorthless');
  return f;
}
const quote = (g: Game) => quoteChoamWorthlessCancellation(g, g.response!);
function allowBG(g: Game) {
  for (let n = 0; g.response?.kind === 'worthlessKarama' && n < 12; n++) {
    const who = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(reload(g), who.id, { type: 'passResponse' });
  }
  assert.notEqual(g.response?.kind, 'worthlessKarama');
  return g;
}
function cancel(f: ReturnType<typeof actual>, bg: boolean) {
  let g = applyAction(f.g, bg ? 'b' : 'e', {
    type: 'card',
    card: bg ? f.bg.id : f.printed.id,
    mode: 'cancel',
  });
  if (bg) g = allowBG(g);
  assert.equal(
    g.discard.filter((c) => c.id === (bg ? f.bg.id : f.printed.id)).length,
    1,
  );
  return g;
}

for (const kind of cases) {
  void test(`pure ${kind} envelope identifies only its original continuation without RNG, private hand or current force reads`, (t) => {
    const f = actual(kind),
      before = structuredClone(f.g);
    const rng = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('RNG');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('UUID');
    });
    const q = quote(f.g)!;
    const resume = ['storm', 'revival', 'movement', 'mentat'].includes(kind)
      ? kind
      : 'none';
    assert.equal(q.resume.kind, resume);
    assert.deepEqual(q.blocked, {
      turn: f.g.turn,
      phase: f.g.phase,
      cards: [f.card.id],
    });
    assert.equal(q.pendingChoamWorthless, null);
    assert.deepEqual(f.g, before);
    for (const p of f.g.players)
      for (const field of ['hand', 'forces', 'reserves', 'leaders', 'spice'])
        Object.defineProperty(p, field, {
          get() {
            throw Error(`Read ${field}`);
          },
        });
    assert.deepEqual(quote(f.g), q);
    assert.equal(rng.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
    q.blocked.cards.push('detached');
    assert.equal(f.g.choamWorthlessBlocked, undefined);
  });
  for (const bg of [false, true])
    void test(`${bg ? 'BG' : 'printed'} denial of real ${kind} declaration preserves its card and takes one correct continuation`, () => {
      const f = actual(kind),
        q = quote(f.g)!;
      const done = cancel(f, bg);
      assert.deepEqual(done.choamWorthlessBlocked, q.blocked);
      assert.equal(done.pendingChoamWorthless, null);
      assert.equal(
        player(done, 'c').hand.filter((c) => c.id === f.card.id).length,
        1,
      );
      if (q.resume.kind === 'revival') {
        assert.equal(player(done, 'e').reserves, 17);
        assert.equal(player(done, 'e').tanks, 3);
        assert.equal(player(done, 'e').revived, 3);
        assert.equal(player(done, 'e').spice, 16);
      } else if (q.resume.kind === 'movement') {
        assert.equal(player(done, 'e').forces['arrakeen:10'], 2);
        assert.equal(player(done, 'e').forces['imperial_basin:10'], 1);
        assert.equal(player(done, 'e').moved, 1);
      } else {
        assert.deepEqual(
          done.players.map((p) => p.forces),
          f.g.players.map((p) => p.forces),
        );
        if (q.resume.kind === 'storm')
          assert.equal(done.decision?.kind, 'choamStorm');
        else if (q.resume.kind === 'mentat')
          assert.deepEqual(done.decision, q.resume.decision);
        else assert.equal(done.decision, null);
      }
      assert.equal(done.choamMovement, undefined);
      assert.equal(done.choamBaliset?.length ?? 0, 0);
      assert.equal(done.revivalRules?.freeBlocked?.length ?? 0, 0);
      assert.equal('pendingChoamWorthless' in viewGame(done, 'e'), false);
    });
}

void test('pure Basic, omitted false flags, proactive self-target La La La and stale blocked receipts retain existing cancellation semantics', () => {
  const f = actual('laLaLa', false);
  const p = f.g.pendingChoamWorthless!;
  p.target = 'c';
  f.g.response!.recipient = 'c';
  for (const key of ['storm', 'movement', 'mentat', 'revival'] as const)
    delete (p as Partial<typeof p>)[key];
  f.g.choamWorthlessBlocked = {
    turn: f.g.turn - 1,
    phase: f.g.phase,
    cards: null as unknown as string[],
  };
  assert.equal(quote(f.g)!.resume.kind, 'none');
  assert.deepEqual(cancel(f, false).choamWorthlessBlocked!.cards, [f.card.id]);
});
void test('pure current blocked receipt appends a distinct declaration once without changing its original array', () => {
  const f = actual('kulon');
  f.g.choamWorthlessBlocked = {
    turn: f.g.turn,
    phase: f.g.phase,
    cards: ['previous-declared-card'],
  };
  assert.deepEqual(quote(f.g)!.blocked.cards, [
    'previous-declared-card',
    f.card.id,
  ]);
  assert.deepEqual(f.g.choamWorthlessBlocked.cards, ['previous-declared-card']);
});
for (const bg of [false, true])
  void test(`${bg ? 'BG' : 'printed'} denial remains legal after a genuine CHOAM cash-in consumes the declared La La La`, () => {
    const f = source('revival');
    const activation = hold(f.g, 'c', 'Karama');
    f.g = applyAction(f.g, 'c', f.action);
    f.g = applyAction(f.g, 'c', {
      type: 'card',
      mode: 'special',
      card: activation.id,
      cards: [f.card.id],
    });
    assert.equal(
      player(f.g, 'c').hand.some((c) => c.id === f.card.id),
      false,
    );
    assert.equal(f.g.response?.kind, 'choamWorthless');
    assert.ok(quote(f.g));
    const done = cancel(f, bg);
    assert.equal(player(done, 'e').revived, 3);
    assert.equal(player(done, 'c').spice, 23);
    assert.equal(done.discard.filter((c) => c.id === f.card.id).length, 1);
  });

type Corruption = [Case, string, (g: Game) => void];
const corruptions: Corruption[] = [
  [
    'revival',
    'contradictory Mentat flag',
    (g) => {
      g.pendingChoamWorthless!.mentat = true;
    },
  ],
  [
    'revival',
    'nonboolean context flag',
    (g) => {
      g.pendingChoamWorthless!.storm = 1 as unknown as boolean;
    },
  ],
  [
    'revival',
    'wrong response name',
    (g) => {
      g.response!.intent = 'Kulon';
    },
  ],
  [
    'revival',
    'wrong response owner',
    (g) => {
      g.response!.owner = 'e';
    },
  ],
  [
    'revival',
    'wrong pending owner',
    (g) => {
      g.pendingChoamWorthless!.owner = 'e';
    },
  ],
  [
    'revival',
    'wrong response recipient',
    (g) => {
      g.response!.recipient = 'b';
    },
  ],
  [
    'revival',
    'empty declared card',
    (g) => {
      g.pendingChoamWorthless!.card = '';
    },
  ],
  [
    'revival',
    'missing parent',
    (g) => {
      g.pendingRevival = null;
    },
  ],
  [
    'revival',
    'different parent player',
    (g) => {
      g.pendingRevival!.player = 'b';
    },
  ],
  [
    'revival',
    'nonfree parent',
    (g) => {
      g.pendingRevival!.free = 0;
    },
  ],
  [
    'revival',
    'Emperor extra parent',
    (g) => {
      g.pendingRevival!.emperorExtra = true;
    },
  ],
  [
    'movement',
    'missing movement parent',
    (g) => {
      g.pendingChoamMove = null;
    },
  ],
  [
    'movement',
    'wrong movement destination',
    (g) => {
      g.pendingChoamMove!.to = 'carthag';
    },
  ],
  [
    'movement',
    'wrong movement sector',
    (g) => {
      g.pendingChoamMove!.sector = 11;
    },
  ],
  [
    'movement',
    'borrowed Kulon effect',
    (g) => {
      g.pendingChoamWorthless!.effect = 'kulon';
      g.response!.intent = 'Kulon';
    },
  ],
  [
    'storm',
    'missing storm parent',
    (g) => {
      g.stormResolution = null;
    },
  ],
  [
    'storm',
    'traversed storm parent',
    (g) => {
      g.stormResolution!.traversed = 1;
    },
  ],
  [
    'storm',
    'wrong target',
    (g) => {
      g.pendingChoamWorthless!.target = 'e';
      g.response!.recipient = 'e';
    },
  ],
  [
    'mentat',
    'missing Mentat opportunity',
    (g) => {
      g.choamMentatPending = false;
    },
  ],
  [
    'gamont',
    'invalid location',
    (g) => {
      g.pendingChoamWorthless!.location = 'arrakeen:9';
      g.response!.location = 'arrakeen:9';
    },
  ],
  [
    'gamont',
    'invalid type',
    (g) => {
      g.pendingChoamWorthless!.elite = 2;
      g.response!.elite = 2;
    },
  ],
  [
    'kulon',
    'wrong active owner',
    (g) => {
      g.active = 'e';
    },
  ],
  [
    'kulon',
    'replayed block',
    (g) => {
      g.choamWorthlessBlocked = {
        turn: g.turn,
        phase: g.phase,
        cards: [g.pendingChoamWorthless!.card],
      };
    },
  ],
  [
    'kulon',
    'malformed current block',
    (g) => {
      g.choamWorthlessBlocked = {
        turn: g.turn,
        phase: g.phase,
        cards: ['same', 'same'],
      };
    },
  ],
];
for (const [kind, name, corrupt] of corruptions)
  void test(`malformed ${name} rejects purely and before either new cancellation cost`, () => {
    const f = actual(kind);
    corrupt(f.g);
    const before = structuredClone(f.g);
    assert.throws(() => quote(f.g), ChoamWorthlessCancellationError);
    for (const bg of [false, true]) {
      assert.throws(() =>
        applyAction(f.g, bg ? 'b' : 'e', {
          type: 'card',
          card: bg ? f.bg.id : f.printed.id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(f.g, before);
    }
  });
void test('pure unrelated responses stay with their own cancellation validators', () => {
  const f = actual('kulon');
  assert.equal(
    quoteChoamWorthlessCancellation(f.g, {
      kind: 'advisor',
      owner: 'b',
      passed: [],
    }),
    null,
  );
});
