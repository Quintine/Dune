import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { MOBILE_STRONGHOLD } from '../game/board';
import { guildTransportQuote } from '../game/transport-quote';

function fixture(faction: FactionId = 'guild') {
  const g = createGame(
    'GUILDQUOTE',
    newPlayer('p', 'Transporter', faction),
    true,
  );
  g.players.push(
    newPlayer('q', 'Ally', faction === 'guild' ? 'atreides' : 'guild'),
    newPlayer('r', 'Observer', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: 'p',
    order: ['p', 'q', 'r'],
    movementRemaining: ['p', 'q', 'r'],
    storm: 18,
  });
  for (const p of g.players) {
    p.spice = 20;
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
  }
  g.players[0].ally = 'q';
  g.players[1].ally = 'p';
  army(g, 0, { 'imperial_basin:10': 4, 'imperial_basin:11': 3 });
  return g;
}
function army(g: Game, index: number, forces: Record<string, number>) {
  g.players[index].forces = forces;
  g.players[index].reserves =
    20 - Object.values(forces).reduce((a, b) => a + b, 0);
}
const cross = (extra: Partial<Action> = {}): Action => ({
  type: 'guildShip',
  from: 'imperial_basin:10',
  amount: 3,
  territory: 'carthag',
  sector: 11,
  ...extra,
});
const preview = (g: Game, a: Action) =>
  guildTransportQuote(viewGame(g, 'p'), a);
function enabled(g: Game, a: Action, cost: number, share = 0) {
  const snapshot = structuredClone(g),
    view = viewGame(g, 'p'),
    viewBefore = structuredClone(view);
  const quote = guildTransportQuote(view, a);
  assert.deepEqual(quote.unavailableReasons, [], JSON.stringify(a));
  assert.deepEqual(quote.quote, {
    cost,
    normalCost: cost,
    ownPayment: cost - share,
    pledgedPayment: share,
  });
  assert.deepEqual(view, viewBefore);
  const after = applyAction(g, 'p', a);
  // The Guild collects the other faction's escrow share after paying its own tariff.
  const income = g.players[0].faction === 'guild' ? share : 0;
  assert.equal(
    after.players[0].spice,
    g.players[0].spice - cost + share + income,
  );
  if (g.players[1].faction === 'guild')
    assert.equal(after.players[1].spice, g.players[1].spice + cost - share);
  assert.equal(after.aid.q?.amount ?? 0, (g.aid.q?.amount ?? 0) - share);
  assert.equal(after.players[0].shipped, true);
  for (let i = 0; i < after.players.length; i++)
    assert.equal(
      after.players[i].reserves +
        after.players[i].tanks +
        Object.values(after.players[i].forces).reduce((a, b) => a + b, 0),
      20,
    );
  assert.deepEqual(g, snapshot);
  return after;
}
function unavailable(g: Game, a: Action) {
  const snapshot = structuredClone(g);
  assert.ok(preview(g, a).unavailableReasons.length, JSON.stringify(a));
  assert.throws(() => applyAction(g, 'p', a));
  assert.deepEqual(g, snapshot);
}

void test('ordinary Guild cross transport and returns quote the actual rounded tariff and debit', () => {
  for (const amount of [1, 2, 3, 4]) {
    const g = fixture();
    const stronghold = enabled(g, cross({ amount }), Math.ceil(amount / 2));
    assert.equal(stronghold.players[0].forces['carthag:11'], amount);
    enabled(g, cross({ amount, territory: 'red_chasm', sector: 7 }), amount);
    const returned = enabled(
      g,
      cross({ amount, territory: 'reserves' }),
      Math.ceil(amount / 2),
    );
    assert.equal(returned.players[0].reserves, g.players[0].reserves + amount);
  }
});

void test('combined source sectors override scalar amount and from and round once for the whole selection', () => {
  const g = fixture();
  for (const amount of [undefined, 0, 999, 'stale UI value']) {
    const after = enabled(
      g,
      cross({
        from: 'red_chasm:7',
        amount,
        forces: { 'imperial_basin:10': 1, 'imperial_basin:11': 2 },
      }),
      2,
    );
    assert.equal(after.players[0].forces['imperial_basin:10'], 3);
    assert.equal(after.players[0].forces['imperial_basin:11'], 1);
    assert.equal(after.players[0].forces['carthag:11'], 3);
  }
  enabled(
    g,
    cross({ forces: { 'imperial_basin:10': 2, 'red_chasm:7': 0 } }),
    1,
  );
  army(g, 0, { 'imperial_basin:10': 2, 'red_chasm:7': 2 });
  unavailable(
    g,
    cross({ forces: { 'imperial_basin:10': 1, 'red_chasm:7': 1 } }),
  );
});

void test('Fremen southern reserve transport is paid while ordinary nearby reinforcement remains free', () => {
  const g = fixture('fremen');
  army(g, 0, {});
  g.players[0].elites = { reserves: 3, tanks: 0, forces: {}, revived: 0 };
  const paid = enabled(
    g,
    cross({
      from: 'reserves',
      amount: 3,
      territory: 'the_great_flat',
      sector: 15,
    }),
    3,
  );
  assert.equal(paid.players[0].reserves, 17);
  const free = applyAction(g, 'p', {
    type: 'ship',
    amount: 3,
    territory: 'the_great_flat',
    sector: 15,
  });
  assert.equal(free.players[0].spice, g.players[0].spice);
  assert.equal(free.players[0].forces['the_great_flat:15'], 3);
  unavailable(g, cross({ from: 'reserves', territory: 'reserves' }));
  unavailable(fixture(), cross({ from: 'reserves' }));
  g.storm = 15;
  unavailable(
    g,
    cross({ from: 'reserves', territory: 'the_great_flat', sector: 15 }),
  );
});

void test('elite allocations use each source minimum by default and preserve exact selected elite custody', () => {
  const g = fixture('emperor');
  army(g, 0, { 'imperial_basin:10': 4, 'imperial_basin:11': 3 });
  g.players[0].elites = {
    reserves: 1,
    tanks: 0,
    revived: 0,
    forces: { 'imperial_basin:10': 3, 'imperial_basin:11': 1 },
  };
  const a = cross({
    forces: { 'imperial_basin:10': 3, 'imperial_basin:11': 2 },
  });
  const defaults = enabled(g, a, 3);
  assert.equal(defaults.players[0].elites!.forces['carthag:11'], 2);
  const explicit = enabled(
    g,
    { ...a, eliteForces: { 'imperial_basin:10': 3, 'imperial_basin:11': 1 } },
    3,
  );
  assert.equal(explicit.players[0].elites!.forces['carthag:11'], 4);
  enabled(g, cross({ elite: 2 }), 2);
  for (const elite of [-1, 0, 1, 4, 1.5, '2']) unavailable(g, cross({ elite }));
  unavailable(g, { ...a, eliteForces: { 'imperial_basin:10': 1 } });
  const f = fixture('fremen');
  army(f, 0, { 'red_chasm:7': 18 });
  f.players[0].elites = {
    reserves: 2,
    tanks: 0,
    forces: { 'red_chasm:7': 1 },
    revived: 0,
  };
  const reserves = enabled(f, cross({ from: 'reserves', amount: 2 }), 1);
  assert.equal(reserves.players[0].elites!.reserves, 0);
  assert.equal(reserves.players[0].elites!.forces['carthag:11'], 2);
  unavailable(f, cross({ from: 'reserves', amount: 2, elite: 1 }));
});

void test('source storm, destination geometry, ally occupancy and stronghold capacity disable rejected transport', () => {
  const source = fixture();
  source.storm = 10;
  unavailable(source, cross());
  enabled(
    source,
    cross({ from: 'imperial_basin:11', territory: 'red_chasm', sector: 7 }),
    3,
  );
  const destination = fixture();
  destination.storm = 11;
  unavailable(destination, cross());
  unavailable(fixture(), cross({ sector: 7 }));
  unavailable(fixture(), cross({ territory: 'unknown_place' }));
  const occupied = fixture();
  army(occupied, 1, { 'carthag:11': 1 });
  unavailable(occupied, cross());
  army(occupied, 1, { 'polar_sink:0': 1 });
  enabled(occupied, cross({ territory: 'polar_sink', sector: 0 }), 3);
  const full = fixture();
  full.players[0].ally = null;
  full.players[1].ally = null;
  army(full, 1, { 'carthag:11': 1 });
  army(full, 2, { 'carthag:11': 1 });
  unavailable(full, cross());
  unavailable(fixture(), cross({ territory: MOBILE_STRONGHOLD, sector: 0 }));
});

void test('new Bene Gesserit advisor source locks forbid fighter arrival but existing destination advisors preserve the lock', () => {
  const g = fixture('beneGesserit');
  g.players[0].advisors = { imperial_basin: { lockedTurn: g.turn } };
  army(g, 2, { 'carthag:11': 1, 'imperial_basin:10': 1 });
  unavailable(g, cross());
  army(g, 0, { ...g.players[0].forces, 'carthag:11': 1 });
  g.players[0].advisors.carthag = {};
  const after = enabled(g, cross(), 2);
  assert.equal(after.players[0].advisors!.carthag.lockedTurn, g.turn);
  delete g.players[0].advisors.carthag;
  unavailable(g, cross());
});

void test('explicit and default allied shares debit escrow once and never spend unpledged donor spice', () => {
  for (const faction of ['guild', 'atreides'] as const)
    for (const own of [0, 1, 2, 7]) {
      let g = fixture(faction);
      g.players[0].spice = own;
      g = applyAction(g, 'q', { type: 'pledgeAid', amount: 3 });
      assert.equal(g.players[1].spice, 17);
      const a = cross({ territory: 'red_chasm', sector: 7 });
      for (const share of [undefined, 0, 1, 2, 3]) {
        const selected = share ?? Math.max(0, 3 - own);
        if (3 - selected > own) unavailable(g, { ...a, allyPayment: share });
        else {
          const after = enabled(g, { ...a, allyPayment: share }, 3, selected);
          assert.equal(
            after.players[1].spice,
            17 + (faction === 'atreides' ? 3 - selected : 0),
          );
        }
      }
      for (const share of [-1, 4, 1.5, '1', NaN, Infinity])
        unavailable(g, { ...a, allyPayment: share });
    }
  const noPledge = fixture();
  noPledge.players[0].spice = 0;
  noPledge.players[1].spice = 99999;
  unavailable(noPledge, cross());
});

void test('foreign hidden resources and hands do not change the entitled transport quote', () => {
  const g = fixture('fremen');
  const action = cross({ from: 'reserves', amount: 3 });
  const before = preview(g, action);
  const privateVariant = structuredClone(g);
  privateVariant.players[1].spice = 9999;
  privateVariant.players[2].spice = 0;
  privateVariant.players[2].hand = [
    { id: 'hidden', name: 'Hidden', kind: 'lasgun' },
  ];
  privateVariant.players[2].traitors = ['guild-0'];
  assert.deepEqual(preview(privateVariant, action), before);
  assert.deepEqual(
    viewGame(privateVariant, 'p').players[2].hand,
    viewGame(g, 'p').players[2].hand,
  );
});

void test('malformed and empty physical selections are unavailable and authoritative rejection is atomic', () => {
  for (const amount of [
    undefined,
    0,
    -1,
    1.5,
    5,
    '2',
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    {},
    [],
  ])
    unavailable(fixture(), cross({ amount }));
  for (const forces of [
    null,
    [],
    'bad',
    {},
    { 'imperial_basin:10': 0 },
    { 'imperial_basin:10': -1 },
    { 'imperial_basin:10': '1' },
    { 'missing:1': 1 },
  ])
    unavailable(fixture(), cross({ forces }));
  unavailable(fixture(), cross({ noField: 'concealed' }));
  const ally = fixture('atreides');
  unavailable(ally, cross({ territory: 'reserves' }));
  const notTurn = fixture();
  notTurn.active = 'q';
  unavailable(notTurn, cross());
  const spent = fixture();
  spent.players[0].shipped = true;
  unavailable(spent, cross());
  const phase = fixture();
  phase.phase = 4;
  unavailable(phase, cross());
  const noGuild = fixture('atreides');
  noGuild.players[0].ally = null;
  unavailable(noGuild, cross());
});

void test('return defaults are independent of board destination occupancy and valid irrelevant sector choice', () => {
  const g = fixture();
  army(g, 1, { 'carthag:11': 1 });
  army(g, 2, { 'carthag:11': 1 });
  for (const sector of [undefined, 0, 7, 11, 18]) {
    enabled(g, cross({ territory: 'reserves', sector }), 2);
    enabled(g, cross({ territory: undefined, sector }), 2);
    enabled(g, cross({ territory: null, sector }), 2);
  }
  for (const sector of [-1, 19, 1.5, '0'])
    unavailable(g, cross({ territory: 'reserves', sector }));
  for (const territory of ['', 123, {}, []])
    unavailable(g, cross({ territory }));
});
