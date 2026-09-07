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
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import {
  quoteNoFieldCancellation,
  NoFieldCancellationError,
} from '../game/karama-no-field-cancellation';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function act(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const next = applyAction(g, id, a);
  assert.deepEqual(g, before);
  return reload(next);
}
function fixture(allied = false, value: 0 | 3 | 5 = 5, oldMarker = false) {
  const g = createGame(
    'CANCELFIELD',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Ally', 'atreides'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: allied ? 'a' : 'r',
    order: allied ? ['a', 'r', 'b', 'e'] : ['r', 'a', 'b', 'e'],
    movementRemaining: allied ? ['a', 'r', 'b', 'e'] : ['r', 'a', 'b', 'e'],
    deck: baseDeck(),
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
    });
  player(g, 'r').noField = createRicheseNoField([
    'opaque-zero',
    'opaque-three',
    'opaque-five',
  ]);
  player(g, 'r').noFieldEvent = 'selection-2';
  if (allied) {
    player(g, 'r').ally = 'a';
    player(g, 'a').ally = 'r';
  }
  if (oldMarker)
    player(g, 'r').noField = deployRicheseNoField(player(g, 'r').noField!, {
      tokenId: 'opaque-three',
      controller: 'r',
      location: { territory: 'imperial_basin', sector: 10 },
    });
  function hold(id: string, kind: string) {
    const i = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(i >= 0);
    const c = g.deck.splice(i, 1)[0];
    player(g, id).hand.push(c);
    return c.id;
  }
  const worthless = hold('b', 'worthless'),
    printed = hold('e', 'karama');
  return {
    g,
    allied,
    value,
    oldMarker,
    worthless,
    printed,
    token: ['opaque-zero', 'opaque-three', 'opaque-five'][
      [0, 3, 5].indexOf(value)
    ],
  };
}
type Fixture = ReturnType<typeof fixture>;
function declare(f: Fixture) {
  let g = f.g;
  if (f.allied) {
    g = act(g, 'r', {
      type: 'offerRicheseNoField',
      event: player(g, 'r').noFieldEvent,
      token: f.token,
      territory: 'arrakeen',
      sector: 10,
      payer: 'r',
    });
    g = act(g, 'a', {
      type: 'decision',
      event: g.richeseAllyOffer!.event,
      accept: true,
      elite: 0,
    });
  } else
    g = act(g, 'r', {
      type: 'ship',
      noField: f.token,
      event: player(g, 'r').noFieldEvent,
      territory: 'arrakeen',
      sector: 10,
    });
  assert.equal(g.response?.kind, 'richeseNoField');
  return g;
}
function pass(g: Game, kind: NonNullable<Game['response']>['kind']) {
  for (let i = 0; g.response?.kind === kind; i++) {
    assert.ok(i < 16);
    g = act(g, g.players.find((p) => !g.response!.passed.includes(p.id))!.id, {
      type: 'passResponse',
    });
  }
  return g;
}
function cancel(g: Game, f: Fixture, bg: boolean) {
  g = act(g, bg ? 'b' : 'e', {
    type: 'card',
    card: bg ? f.worthless : f.printed,
    mode: 'cancel',
  });
  return bg ? pass(g, 'worthlessKarama') : g;
}
function materials(g: Game) {
  return g.players.map((p) => ({
    id: p.id,
    spice: p.spice,
    reserves: p.reserves,
    tanks: p.tanks,
    forces: p.forces,
    noField: p.noField,
    noFieldEvent: p.noFieldEvent,
    shipped: p.shipped,
  }));
}
function privateViews(g: Game) {
  for (const id of ['a', 'b', 'e']) {
    const view = viewGame(g, id);
    assert.equal(view.richeseNoField?.private, null);
    for (const token of ['opaque-zero', 'opaque-three', 'opaque-five'])
      assert.equal(JSON.stringify(view).includes(token), false);
  }
}

void test('own and accepted allied declarations produce exact public canceled blocks for each physical denomination without RNG or hidden output', (t) => {
  for (const allied of [false, true])
    for (const value of [0, 3, 5] as const) {
      const f = fixture(allied, value),
        g = declare(f),
        before = structuredClone(g);
      const random = t.mock.method(crypto, 'getRandomValues', () => {
          throw new Error('No random work in declaration cancellation');
        }),
        uuid = t.mock.method(crypto, 'randomUUID', () => {
          throw new Error('No marker event in declaration cancellation');
        });
      const quote = quoteNoFieldCancellation(g, g.response!);
      assert.deepEqual(
        quote,
        allied
          ? {
              kind: 'allied',
              owner: 'r',
              player: 'a',
              blocked: { turn: 2, recipient: 'a' },
              pendingShipment: null,
            }
          : { kind: 'own', player: 'r', blockedTurn: 2, pendingShipment: null },
      );
      assert.deepEqual(quoteNoFieldCancellation(reload(g), g.response!), quote);
      assert.deepEqual(g, before);
      assert.equal(JSON.stringify(quote).includes('opaque'), false);
      assert.equal(JSON.stringify(quote).includes('arrakeen'), false);
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
      random.mock.restore();
      uuid.mock.restore();
    }
});
void test('printed and BG cancellations preserve every No-Field material and block exactly the active own or allied shipment opportunity', () => {
  for (const allied of [false, true])
    for (const bg of [false, true]) {
      const f = fixture(allied),
        source = declare(f),
        before = materials(source);
      const g = cancel(source, f, bg);
      assert.deepEqual(materials(g), before);
      assert.equal(g.pendingShipment, null);
      if (allied) {
        assert.deepEqual(g.richeseAllyBlocked, { turn: 2, recipient: 'a' });
        assert.notEqual(player(g, 'r').noFieldBlockedTurn, 2);
      } else {
        assert.equal(player(g, 'r').noFieldBlockedTurn, 2);
        assert.equal(g.richeseAllyBlocked, undefined);
      }
      privateViews(g);
      assert.equal(
        g.discard.filter((c) => c.id === (bg ? f.worthless : f.printed)).length,
        1,
      );
      assert.throws(
        () =>
          act(
            g,
            'r',
            allied
              ? {
                  type: 'offerRicheseNoField',
                  event: player(g, 'r').noFieldEvent,
                  token: f.token,
                  territory: 'arrakeen',
                  sector: 10,
                  payer: 'r',
                }
              : {
                  type: 'ship',
                  noField: f.token,
                  event: player(g, 'r').noFieldEvent,
                  territory: 'arrakeen',
                  sector: 10,
                },
          ),
        /prevented/,
      );
      const normal = act(g, allied ? 'a' : 'r', {
        type: 'ship',
        amount: 1,
        territory: 'arrakeen',
        sector: 10,
      });
      assert.equal(player(normal, allied ? 'a' : 'r').shipped, true);
    }
});
void test('counter-canceling a BG conversion restores the real own or allied permission and permits one original shipment', () => {
  for (const allied of [false, true]) {
    const f = fixture(allied),
      source = declare(f);
    let g = act(source, 'b', {
      type: 'card',
      card: f.worthless,
      mode: 'cancel',
    });
    assert.equal(g.response?.kind, 'worthlessKarama');
    g = act(g, 'e', { type: 'card', card: f.printed, mode: 'cancel' });
    g = pass(g, 'richeseNoField');
    const controller = player(g, allied ? 'a' : 'r');
    assert.equal(controller.shipped, true);
    assert.equal(player(g, 'r').noField!.lastShipped, f.token);
    assert.notEqual(player(g, 'r').noFieldBlockedTurn, 2);
    assert.equal(g.richeseAllyBlocked, undefined);
    if (allied) {
      assert.equal(controller.forces['arrakeen:10'], 5);
      assert.equal(controller.reserves, 15);
      assert.equal(player(g, 'r').noField!.deployed, null);
    } else {
      assert.equal(controller.reserves, 20);
      assert.equal(controller.noField!.deployed?.tokenId, f.token);
    }
    for (const card of [f.worthless, f.printed])
      assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  }
});
void test('denial does not read current funds, reserves, route capacity, rate or repeat-token availability and preserves an old allied marker', () => {
  for (const allied of [false, true]) {
    const f = fixture(allied, 5, allied),
      source = declare(f),
      g = reload(source);
    for (const p of g.players) {
      p.spice = 0;
      p.reserves = 0;
    }
    g.storm = 10;
    player(g, 'b').forces = { 'arrakeen:10': 1 };
    player(g, 'e').forces = { 'arrakeen:10': 1 };
    g.karamaShipping = { player: allied ? 'a' : 'r', owner: 'e' };
    if (!allied) {
      player(g, 'r').noField = deployRicheseNoField(player(g, 'r').noField!, {
        tokenId: f.token,
        controller: 'r',
        location: { territory: 'imperial_basin', sector: 10 },
      });
    }
    const before = structuredClone(g);
    assert.ok(quoteNoFieldCancellation(g, g.response!));
    const done = cancel(g, f, false);
    assert.deepEqual(materials(done), materials(g));
    assert.equal(done.karamaShipping?.player, allied ? 'a' : 'r');
    assert.deepEqual(g, before);
    const guarded = reload(source);
    for (const p of guarded.players)
      for (const key of ['spice', 'reserves', 'forces', 'elites'])
        Object.defineProperty(p, key, {
          get() {
            throw new Error('Denied declaration must not read ' + key);
          },
        });
    assert.ok(quoteNoFieldCancellation(guarded, guarded.response!));
  }
});
void test('stale owner, controller, physical inventory, selection and opportunity bindings reject purely and before either new card cost', () => {
  for (const allied of [false, true]) {
    const f = fixture(allied),
      g = declare(f);
    const mutations: ((s: Game) => void)[] = [
      (s) => {
        s.phase = 6;
      },
      (s) => {
        s.active = 'e';
      },
      (s) => {
        player(s, allied ? 'a' : 'r').shipped = true;
      },
      (s) => {
        s.pendingShipment!.turn = 1;
      },
      (s) => {
        s.response!.owner = 'e';
      },
      (s) => {
        player(s, 'r').noFieldEvent = 'changed';
      },
      (s) => {
        player(s, 'r').noField!.tokens.pop();
      },
      (s) => {
        s.pendingShipment!.noField = undefined;
        s.pendingShipment!.alliedNoField = undefined;
      },
    ];
    if (allied)
      mutations.push(
        (s) => {
          player(s, 'a').ally = null;
        },
        (s) => {
          s.pendingShipment!.alliedNoField!.owner = 'a';
        },
        (s) => {
          s.pendingShipment!.alliedNoField!.recipient = 'e';
        },
        (s) => {
          s.pendingShipment!.alliedNoField!.tokenId = 'absent';
        },
        (s) => {
          s.pendingShipment!.alliedNoField!.sector = 11;
        },
        (s) => {
          s.richeseAllyOpportunity = { turn: 1, recipient: 'a' };
        },
        (s) => {
          s.richeseAllyBlocked = { turn: 2, recipient: 'a' };
        },
      );
    else
      mutations.push(
        (s) => {
          s.pendingShipment!.noField!.tokenId = 'absent';
        },
        (s) => {
          s.pendingShipment!.player = 'a';
        },
        (s) => {
          s.pendingShipment!.amount = 3;
        },
        (s) => {
          player(s, 'r').noFieldBlockedTurn = 2;
        },
      );
    for (const change of mutations) {
      const bad = reload(g);
      change(bad);
      const before = structuredClone(bad);
      assert.throws(
        () => quoteNoFieldCancellation(bad, bad.response!),
        NoFieldCancellationError,
      );
      for (const bg of [false, true])
        assert.throws(() =>
          act(bad, bg ? 'b' : 'e', {
            type: 'card',
            card: bg ? f.worthless : f.printed,
            mode: 'cancel',
          }),
        );
      assert.deepEqual(bad, before);
      assert.equal(bad.discard.length, 0);
    }
  }
});
