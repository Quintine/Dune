import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { richeseCards } from '../game/richese-cards';
import { TERRITORIES } from '../game/board';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
  finishResponse?: (g: Game, canceled: boolean) => void;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, finishResponse };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const result = reload(observed.applyActionInner!(g, id, a));
  assert.deepEqual(g, before);
  return result;
}
const ORNI = 'richese-ornithopter',
  ORIGIN = 'imperial_basin:10';
function fixture(faction: FactionId = 'richese', advanced = false) {
  const g = createGame(
    'ORNIFRAME',
    newPlayer('p', 'Pilot', faction),
    advanced,
    ['choam', 'ecaz'],
  );
  g.players.push(
    newPlayer('q', 'Observer', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: 'p',
    order: ['p', 'q', 'e'],
    movementRemaining: ['p', 'q', 'e'],
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  hold(g, 'p', 'Ornithopter');
  player(g, 'p').forces = { [ORIGIN]: 3 };
  player(g, 'p').reserves = 17;
  return g;
}
function hold(g: Game, id: string, name: string) {
  const pile = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const index = pile.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const [card] = pile.splice(index, 1);
  player(g, id).hand.push(card);
  return card.id;
}
const first = (extra: Partial<Action> = {}): Action => ({
  type: 'move',
  movementCard: ORNI,
  ornithopter: 'twoGroups',
  forces: { [ORIGIN]: 1 },
  territory: 'arrakeen',
  sector: 10,
  ...extra,
});
const final = (g: Game, extra: Partial<Action> = {}): Action => ({
  type: 'move',
  ornithopterEvent: g.ornithopter!.event,
  forces: { [ORIGIN]: 1 },
  territory: 'carthag',
  sector: 11,
  ...extra,
});
function receipt(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  if (c.kind !== 'ornithopterDiscard') throw Error('Missing retired flight');
  return c;
}
function recover(g: Game) {
  const before = structuredClone(g),
    done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, before);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  return done;
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  return ids;
}

void test('final fixed-range movement commits forces and the one played card before its arrival suffix', () => {
  const initial = fixture(),
    action = first({
      ornithopter: 'range3',
      territory: 'hagga_basin',
      sector: 12,
    });
  const pending = inner(initial, 'p', action),
    c = receipt(pending);
  assert.equal(c.source, 'move');
  assert.equal(c.flight.mode, 'range3');
  assert.equal(c.flight.completed, 1);
  assert.equal(pending.ornithopter, null);
  assert.equal(player(pending, 'p').moved, 1);
  assert.equal(player(pending, 'p').forces['hagga_basin:12'], 1);
  assert.equal(player(pending, 'p').forces[ORIGIN], 2);
  assert.equal(pending.pendingTreacheryDiscard!.batch.entries.length, 1);
  assert.deepEqual(
    pending.pendingTreacheryDiscard!.batch.entries.map((e) => [
      e.card.id,
      e.discardedBy,
      e.publicFace,
    ]),
    [[ORNI, 'p', true]],
  );
  const done = recover(pending);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(done.discard, pending.discard);
  // The independent initial action allocates a different flight event. Compare
  // the resulting gameplay state rather than that private historical receipt.
  const uninterrupted = applyAction(initial, 'p', action);
  assert.deepEqual(done.players, uninterrupted.players);
  assert.deepEqual(done.log, uninterrupted.log);
  assert.deepEqual(inventory(done), inventory(initial));
});

void test('the first group stays in escrow, while the second group retirement restores exactly once', () => {
  const initial = fixture(),
    one = applyAction(initial, 'p', first());
  assert.equal(one.ornithopter?.completed, 1);
  assert.equal(one.discard.length, 0);
  assert.equal(one.pendingTreacheryDiscard ?? null, null);
  const action = final(one),
    pending = inner(one, 'p', action);
  assert.equal(receipt(pending).flight.completed, 2);
  assert.equal(receipt(pending).source, 'move');
  assert.equal(player(pending, 'p').moved, 2);
  assert.equal(player(pending, 'p').forces[ORIGIN], 1);
  const done = recover(pending);
  assert.deepEqual(reload(done), reload(applyAction(one, 'p', action)));
  assert.equal(done.discard.filter((c) => c.id === ORNI).length, 1);
  assert.deepEqual(inventory(done), inventory(initial));
  const replay = reload(done);
  replay.pendingTreacheryDiscard = pending.pendingTreacheryDiscard;
  assert.throws(() => normalizeAutomaticGame(replay));
});

void test('early end after one group retires escrow before advancing the movement queue', () => {
  const one = applyAction(fixture(), 'p', first()),
    pending = inner(one, 'p', { type: 'endMovement' });
  assert.equal(receipt(pending).source, 'end');
  assert.equal(receipt(pending).flight.completed, 1);
  assert.equal(pending.active, 'p');
  assert.deepEqual(pending.movementRemaining, ['p', 'q', 'e']);
  const done = recover(pending);
  assert.equal(done.active, 'q');
  assert.deepEqual(done.movementRemaining, ['q', 'e']);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(
    reload(done),
    reload(applyAction(one, 'p', { type: 'endMovement' })),
  );
  assert.deepEqual(inventory(done), inventory(one));
});

void test('a genuine Ixian speed cancellation leaves zero completed groups, then ending retires the played card once', () => {
  let initial = fixture('ixians', true);
  player(initial, 'p').elites = {
    forces: { [ORIGIN]: 1 },
    reserves: 6,
    tanks: 0,
    revived: 0,
  };
  const karama = hold(initial, 'e', 'Karama');
  initial = applyAction(
    initial,
    'p',
    first({
      eliteForces: { [ORIGIN]: 1 },
      territory: 'hagga_basin',
      sector: 12,
    }),
  );
  assert.equal(initial.response?.kind, 'ixMovement');
  const event = initial.ornithopter!.event;
  initial = applyAction(initial, 'e', {
    type: 'card',
    mode: 'cancel',
    card: karama,
  });
  assert.equal(initial.ornithopter!.event, event);
  assert.equal(initial.ornithopter!.completed, 0);
  assert.equal(initial.pendingTreacheryDiscard ?? null, null);
  assert.equal(player(initial, 'p').moved, 0);
  const pending = inner(initial, 'p', { type: 'endMovement' });
  assert.equal(receipt(pending).flight.completed, 0);
  assert.equal(receipt(pending).source, 'end');
  const done = recover(pending);
  assert.deepEqual(done.players, pending.players);
  assert.equal(done.active, 'q');
  assert.deepEqual(
    done.discard.map((c) => c.id),
    [karama, ORNI],
  );
  inventory(done);
});

void test('an actual CHOAM movement decision can produce the final flight frame for a different action actor', () => {
  let initial = fixture();
  initial.players[1] = newPlayer('q', 'CHOAM', 'choam');
  player(initial, 'q').forces = { 'hagga_basin:12': 1 };
  player(initial, 'q').reserves = 19;
  initial = applyAction(
    initial,
    'p',
    first({ ornithopter: 'range3', territory: 'hagga_basin', sector: 12 }),
  );
  assert.equal(initial.decision?.kind, 'choamMovement');
  assert.equal(initial.ornithopter!.completed, 0);
  const action: Action = { type: 'decision', decline: true },
    pending = inner(initial, 'q', action);
  assert.equal(receipt(pending).flight.player, 'p');
  assert.equal(pending.pendingChoamMove, null);
  assert.equal(
    pending.pendingTreacheryDiscard!.batch.entries[0].discardedBy,
    'p',
  );
  const done = recover(pending);
  assert.deepEqual(reload(done), reload(applyAction(initial, 'q', action)));
  inventory(done);
});

void test('Baliset can prevent a declared fixed flight while its zero-group early ending still disposes escrow', () => {
  let initial = fixture();
  initial.players[1] = newPlayer('q', 'CHOAM', 'choam');
  player(initial, 'q').forces = { 'hagga_basin:12': 1 };
  player(initial, 'q').reserves = 19;
  const baliset = hold(initial, 'q', 'Baliset');
  initial = applyAction(
    initial,
    'p',
    first({ ornithopter: 'range3', territory: 'hagga_basin', sector: 12 }),
  );
  initial = applyAction(initial, 'q', {
    type: 'card',
    mode: 'choam',
    card: baliset,
    target: 'p',
    territory: 'hagga_basin',
  });
  assert.equal(initial.ornithopter!.completed, 0);
  assert.equal(player(initial, 'p').moved, 0);
  const pending = inner(initial, 'p', { type: 'endMovement' }),
    done = recover(pending);
  assert.equal(receipt(pending).source, 'end');
  assert.equal(player(done, 'p').forces[ORIGIN], 3);
  assert.deepEqual(
    done.discard.map((c) => c.id),
    [baliset, ORNI],
  );
  assert.equal(done.active, 'q');
  inventory(done);
});

void test('final flight recovery opens a real Terror arrival after retiring the card, without replaying movement', () => {
  const initial = fixture();
  initial.players[1] = newPlayer('q', 'Moritani', 'moritani');
  hold(initial, 'p', 'Shield');
  initial.moritaniTerror = createTerrorState(() => 0);
  const token = initial.moritaniTerror.tokens.find(
    (t) => t.kind === 'sabotage',
  )!;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror,
    token.id,
    'arrakeen',
    1,
  );
  const action = first({ ornithopter: 'range3' }),
    pending = inner(initial, 'p', action);
  assert.equal(pending.pendingTerrorEntry ?? null, null);
  assert.equal(pending.decision, null);
  const done = recover(pending);
  assert.equal(done.pendingTerrorEntry?.stage, 'offer');
  assert.equal(done.pendingTerrorEntry?.cause, 'movement');
  assert.equal(done.pendingTerrorEntry?.amount, 1);
  assert.deepEqual(done.players, pending.players);
  const finished = applyAction(done, 'q', { type: 'decision', reveal: true });
  assert.equal(finished.pendingTerrorEntry, null);
  assert.equal(player(finished, 'p').moved, 1);
  assert.equal(finished.resolvedTreacheryDiscardSequence, 2);
  assert.equal(finished.discard.filter((c) => c.id === ORNI).length, 1);
  inventory(finished);
});

void test('final flight opens an actual Ambassador offer once after recovery', () => {
  const initial = fixture();
  initial.players[1] = newPlayer('q', 'Ecaz', 'ecaz');
  const ambassadors = createAmbassadors(() => 0);
  const chosen = ambassadors.tokens.find((t) => t.effect === 'emperor')!;
  ambassadors.cohort = [
    chosen,
    ...ambassadors.tokens.filter(
      (t) => t.effect !== 'ecaz' && t.id !== chosen.id,
    ),
  ]
    .slice(0, 5)
    .map((t) => t.id);
  for (const token of ambassadors.tokens)
    token.zone =
      token.effect === 'ecaz' || ambassadors.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
  initial.ecazAmbassadors = placeAmbassador(ambassadors, chosen.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  const pending = inner(initial, 'p', first({ ornithopter: 'range3' }));
  assert.equal(pending.pendingAmbassador ?? null, null);
  const done = recover(pending);
  assert.equal(done.pendingAmbassador?.stage, 'offer');
  assert.equal(done.pendingAmbassador?.entrant, 'p');
  assert.equal(done.pendingAmbassador?.resume, 'none');
  assert.deepEqual(done.players, pending.players);
  const declined = applyAction(done, 'q', {
    type: 'decision',
    event: done.pendingAmbassador!.event,
    decline: true,
  });
  assert.equal(declined.pendingAmbassador, null);
  assert.equal(player(declined, 'p').moved, 1);
  inventory(declined);
});

void test('same-territory sector movement retires its card without opening a new entry opportunity', () => {
  const initial = fixture();
  const territory = TERRITORIES.find(
    (t) => t.type !== 'polar' && t.sectors.filter((s) => s !== 18).length >= 2,
  )!;
  const [from, to] = territory.sectors.filter((s) => s !== 18);
  player(initial, 'p').forces = { [`${territory.id}:${from}`]: 3 };
  const pending = inner(
    initial,
    'p',
    first({
      ornithopter: 'range3',
      forces: { [`${territory.id}:${from}`]: 1 },
      territory: territory.id,
      sector: to,
    }),
  );
  const done = recover(pending);
  assert.equal(player(done, 'p').forces[`${territory.id}:${to}`], 1);
  assert.equal(done.pendingTerrorEntry ?? null, null);
  assert.equal(done.pendingAmbassador ?? null, null);
  assert.equal(player(done, 'p').moved, 1);
  assert.deepEqual(done.players, pending.players);
  inventory(done);
});

void test('a final concealed marker move preserves the newly assigned event and never materializes reserves', () => {
  const views = [];
  for (const value of [0, 3, 5] as const) {
    const initial = fixture(),
      ids = ['zero-marker', 'three-marker', 'five-marker'];
    player(initial, 'p').noField = deployRicheseNoField(
      createRicheseNoField(ids),
      {
        tokenId: ids[[0, 3, 5].indexOf(value)],
        controller: 'p',
        location: { territory: 'imperial_basin', sector: 10 },
      },
    );
    player(initial, 'p').noFieldEvent = 'marker-before';
    const pending = inner(
      initial,
      'p',
      first({
        ornithopter: 'range3',
        forces: {},
        noField: ids[[0, 3, 5].indexOf(value)],
        event: 'marker-before',
      }),
    );
    const markerEvent = player(pending, 'p').noFieldEvent;
    assert.notEqual(markerEvent, 'marker-before');
    assert.equal(receipt(pending).movement!.noField, true);
    assert.equal(receipt(pending).movement!.total, 1);
    const done = recover(pending);
    assert.equal(player(done, 'p').noFieldEvent, markerEvent);
    assert.deepEqual(player(done, 'p').noField, player(pending, 'p').noField);
    assert.equal(player(done, 'p').reserves, 17);
    assert.deepEqual(player(done, 'p').forces, { [ORIGIN]: 3 });
    const view = viewGame(pending, 'q');
    for (const id of ids) assert.ok(!JSON.stringify(view).includes(id));
    // These are independent genuine moves. Their fresh public event UUIDs
    // differ independently of the concealed token's denomination.
    assert.equal(view.richeseNoField!.event, markerEvent);
    view.richeseNoField!.event = 'same-public-event';
    views.push(view);
    inventory(done);
  }
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
});

void test('all profiles wait for retirement and JSON preserves private hands without exposing the completed cohort', () => {
  let initial = fixture();
  hold(initial, 'p', 'Shield');
  initial = applyAction(initial, 'p', first());
  const pending = inner(initial, 'p', final(initial));
  for (const p of pending.players) {
    const view = viewGame(pending, p.id);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(view.ornithopter, null);
    assert.ok(!('pendingTreacheryDiscard' in view));
    if (p.id !== 'p')
      assert.equal(view.players.find((x) => x.id === 'p')!.hand, undefined);
    for (const level of DIFFICULTIES) {
      view.players.find((x) => x.id === p.id)!.bot = level;
      assert.deepEqual(botActions(view), []);
    }
  }
  const done = runBots(reload(pending), 0);
  assert.deepEqual(
    reload({ ...done, botsPending: undefined }),
    reload({ ...recover(pending), botsPending: undefined }),
  );
});

void test('a granted out-of-order Guild flight ends by removing only Guild from the original remaining queue', () => {
  let initial = fixture('guild', true);
  initial.order = ['q', 'p', 'e'];
  initial.movementRemaining = ['q', 'p', 'e'];
  initial.active = null;
  initial.decision = {
    kind: 'guildTiming',
    player: 'p',
    next: 'q',
    following: 'q',
  };
  initial = applyAction(initial, 'p', { type: 'decision', take: true });
  assert.equal(initial.active, 'p');
  assert.deepEqual(initial.movementRemaining, ['q', 'p', 'e']);
  initial = applyAction(initial, 'p', first());
  const pending = inner(initial, 'p', { type: 'endMovement' }),
    done = recover(pending);
  assert.deepEqual(pending.movementRemaining, ['q', 'p', 'e']);
  assert.equal(pending.active, 'p');
  assert.deepEqual(done.movementRemaining, ['q', 'e']);
  assert.equal(done.active, 'q');
  inventory(done);
});

void test('an actual Sapho-last combined turn clears its protected queue marker only after flight retirement', () => {
  let initial = fixture();
  const sapho = hold(initial, 'p', 'Juice of Sapho');
  const option = viewGame(initial, 'p').saphoOptions.find(
    (o) => o.scope === 'movement' && o.mode === 'last',
  );
  assert.ok(option);
  initial = applyAction(initial, 'p', { type: 'card', card: sapho, ...option });
  for (const id of ['q', 'e']) {
    assert.equal(initial.active, id);
    initial = applyAction(initial, id, { type: 'endMovement' });
  }
  assert.equal(initial.active, 'p');
  initial = applyAction(initial, 'p', first());
  const pending = inner(initial, 'p', { type: 'endMovement' });
  assert.equal(pending.saphoMovementLast?.player, 'p');
  assert.deepEqual(pending.movementRemaining, ['p']);
  const done = recover(pending);
  assert.equal(done.saphoMovementLast, null);
  assert.deepEqual(done.movementRemaining, []);
  assert.equal(done.discard.filter((c) => c.id === ORNI).length, 1);
  inventory(done);
});

void test('a paid Box during deferred CHOAM movement retires separately before the final Ornithopter frame', () => {
  let initial = fixture();
  initial.players[1] = newPlayer('q', 'CHOAM', 'choam');
  player(initial, 'q').forces = { 'hagga_basin:12': 1 };
  player(initial, 'q').reserves = 19;
  const box = hold(initial, 'p', 'Nullentropy Box');
  initial.discard.push(...initial.deck.splice(0, 3));
  initial = applyAction(
    initial,
    'p',
    first({ ornithopter: 'range3', territory: 'hagga_basin', sector: 12 }),
  );
  assert.equal(initial.decision?.kind, 'choamMovement');
  initial = applyAction(initial, 'p', { type: 'card', card: box });
  const boxFrame = inner(initial, 'p', {
    type: 'decision',
    event: initial.pendingNullentropy!.event,
    card: initial.discard[0].id,
  });
  assert.equal(
    boxFrame.pendingTreacheryDiscard!.continuation.kind,
    'nullentropyDiscard',
  );
  assert.equal(boxFrame.ornithopter!.completed, 0);
  const restored = recover(boxFrame);
  assert.equal(restored.decision?.kind, 'choamMovement');
  const retired = inner(restored, 'q', { type: 'decision', decline: true });
  assert.equal(receipt(retired).source, 'move');
  assert.equal(retired.pendingTreacheryDiscard!.sequence, 2);
  assert.deepEqual(
    retired.pendingTreacheryDiscard!.batch.entries.map((e) => e.card.id),
    [ORNI],
  );
  const done = recover(retired);
  assert.equal(player(done, 'p').moved, 1);
  assert.equal(player(done, 'p').spice, 8);
  assert.equal(done.resolvedTreacheryDiscardSequence, 2);
  assert.equal(done.discard.filter((c) => c.id === box).length, 1);
  inventory(done);
});

void test('retired flights reject altered movement, queue, custody and suspended obligations before any suffix', () => {
  const firstGroup = applyAction(fixture(), 'p', first());
  const states = [
    inner(firstGroup, 'p', final(firstGroup)),
    inner(firstGroup, 'p', { type: 'endMovement' }),
  ];
  for (const valid of states) {
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.turn++;
      },
      (g) => {
        g.phase = 6;
      },
      (g) => {
        g.active = 'q';
      },
      (g) => {
        g.treacheryDiscardSequence!++;
      },
      (g) => {
        receipt(g).source = receipt(g).source === 'move' ? 'end' : 'move';
      },
      (g) => {
        receipt(g).flight.event = 'stale';
      },
      (g) => {
        receipt(g).flight.player = 'q';
      },
      (g) => {
        receipt(g).flight.turn--;
      },
      (g) => {
        receipt(g).flight.completed++;
      },
      (g) => {
        receipt(g).flight.startingMove++;
      },
      (g) => {
        receipt(g).flight.card.name = 'forged';
      },
      (g) => {
        receipt(g).stateSignature = 'forged';
      },
      (g) => {
        player(g, 'p').moved++;
      },
      (g) => {
        player(g, 'p').forces[ORIGIN]++;
      },
      (g) => {
        player(g, 'p').reserves++;
      },
      (g) => {
        g.order.reverse();
      },
      (g) => {
        g.movementRemaining!.reverse();
      },
      (g) => {
        g.guildTimingLocked = true;
      },
      (g) => {
        g.ornithopter = receipt(g).flight;
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.cause = 'ornithopter:wrong';
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.entries[0].publicFace = false;
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'q';
      },
      (g) => {
        g.deck.push(structuredClone(receipt(g).flight.card));
      },
      (g) => {
        g.discard = g.discard.filter((c) => c.id !== ORNI);
      },
      (g) => {
        receipt(g).resume.response = {
          kind: 'guildIncome',
          owner: 'q',
          amount: 3,
          passed: [],
        };
      },
    ];
    for (const key of [
      'pendingChoamMove',
      'pendingIxMove',
      'pendingFremenMove',
      'pendingTerrorEntry',
      'pendingExchange',
      'battle',
      'pendingNullentropy',
      'response',
      'decision',
      'pendingKarama',
      'phaseOpening',
    ])
      mutations.push((g) => {
        Object.assign(g, { [key]: {} });
      });
    if (receipt(valid).source === 'move')
      mutations.push(
        (g) => {
          receipt(g).movement = null;
        },
        (g) => {
          receipt(g).movement!.player = 'q';
        },
        (g) => {
          receipt(g).movement!.total = 0;
        },
        (g) => {
          receipt(g).movement!.origin = 'missing';
        },
        (g) => {
          receipt(g).movement!.to = 'carthag';
          receipt(g).movement!.sector = 18;
        },
        (g) => {
          receipt(g).movement!.elite = 2;
        },
        (g) => {
          receipt(g).movement!.noField = true;
        },
      );
    else
      mutations.push((g) => {
        receipt(g).movement = {
          player: 'p',
          origin: 'imperial_basin',
          to: 'arrakeen',
          sector: 10,
          total: 1,
          elite: 0,
          noField: false,
        };
      });
    for (const mutate of mutations) {
      const corrupt = reload(valid);
      mutate(corrupt);
      const old = structuredClone(corrupt);
      assert.throws(() => normalizeAutomaticGame(corrupt));
      assert.throws(() => applyAction(corrupt, 'p', { type: 'advanceBots' }));
      assert.throws(() => viewGame(corrupt, 'p'));
      assert.deepEqual(corrupt, old);
    }
  }
});

void test('ending without flight escrow never emits an empty Ornithopter discard frame', () => {
  const initial = fixture();
  const done = applyAction(initial, 'p', { type: 'endMovement' });
  assert.equal(done.treacheryDiscardSequence ?? 0, 0);
  assert.equal(done.pendingTreacheryDiscard ?? null, null);
  assert.ok(player(done, 'p').hand.some((c) => c.id === ORNI));
  assert.equal(done.active, 'q');
});

void test('a final flight with competing BG intrusion and Terror rejects atomically before saving any retirement', () => {
  const initial = fixture('richese', true);
  initial.players[1] = newPlayer('q', 'Moritani', 'moritani');
  initial.players[2] = newPlayer('e', 'Bene Gesserit', 'beneGesserit');
  player(initial, 'e').forces = { 'arrakeen:10': 1 };
  player(initial, 'e').reserves = 19;
  initial.moritaniTerror = createTerrorState(() => 0);
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror,
    initial.moritaniTerror.tokens.find((t) => t.kind === 'sabotage')!.id,
    'arrakeen',
    1,
  );
  const before = structuredClone(initial),
    action = first({ ornithopter: 'range3' });
  assert.throws(() => applyAction(initial, 'p', action), /Terror combined/);
  assert.throws(() => inner(initial, 'p', action), /Terror combined/);
  assert.deepEqual(initial, before);
  assert.ok(player(initial, 'p').hand.some((c) => c.id === ORNI));
  assert.equal(initial.pendingTreacheryDiscard ?? null, null);
  assert.equal(initial.ornithopter ?? null, null);
  assert.equal(player(initial, 'p').moved, 0);
  assert.equal(player(initial, 'p').forces[ORIGIN], 3);
  inventory(initial);
});

void test('automatic Fremen faction-speed allowance drains the final group frame through the response loop', () => {
  const initial = fixture('fremen');
  const one = applyAction(
    initial,
    'p',
    first({ territory: 'hagga_basin', sector: 12 }),
  );
  assert.equal(one.response, null);
  assert.equal(one.ornithopter!.completed, 1);
  assert.equal(player(one, 'p').moved, 1);
  assert.equal(one.pendingTreacheryDiscard ?? null, null);
  const done = applyAction(
    reload(one),
    'p',
    final(one, { territory: 'hagga_basin', sector: 12 }),
  );
  assert.equal(done.response, null);
  assert.equal(done.pendingFremenMove, null);
  assert.equal(done.ornithopter, null);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(done.resolvedTreacheryDiscardSequence, 1);
  assert.equal(player(done, 'p').moved, 2);
  assert.equal(player(done, 'p').forces['hagga_basin:12'], 2);
  assert.equal(player(done, 'p').forces[ORIGIN], 1);
  assert.deepEqual(inventory(done), inventory(initial));
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
});
