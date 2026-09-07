import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  battles,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import {
  GRAPH,
  TERRITORIES,
  MOBILE_STRONGHOLD as HMS,
  MOBILE_LOCATION as INSIDE,
  gameTerritories,
  gameDistance,
  splitLocation,
  mobileRoutes,
  mobileRouteDistance,
} from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture() {
  const g = createGame('HMSROOM2', newPlayer('i', 'Ixians', 'ixians'), false, [
    'ix',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.active = 'i';
  g.order = ['i', 'e', 'a'];
  g.movementRemaining = [...g.order];
  g.lastBattle = ['i', 'e'];
  g.deck = baseDeck();
  g.spiceDeck = spiceDeck();
  g.mobileStronghold = { location: 'polar_sink:0' };
  for (const p of g.players) p.spice = 20;
  g.players[0].forces = { [INSIDE]: 6 };
  g.players[0].reserves = 14;
  g.players[0].elites = {
    reserves: 4,
    tanks: 0,
    forces: { [INSIDE]: 3 },
    revived: 0,
  };
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function nextStorm(state = fixture()) {
  state.phase = 8;
  state.active = null;
  return ready(ready(state)); // Mentat, then the Ix phase-opening window.
}
const ship = (amount = 1): Action => ({
  type: 'ship',
  territory: HMS,
  sector: 0,
  amount,
});
function conserve(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        7,
      );
  }
}
void test('room-local stronghold topology never modifies the shared printed map', () => {
  const g = fixture(),
    other = fixture();
  other.mobileStronghold = null;
  assert.equal(gameTerritories(g).length, TERRITORIES.length + 1);
  assert.equal(gameTerritories(other).length, TERRITORIES.length);
  assert.equal(gameDistance(g, INSIDE, 'polar_sink:0'), 1);
  assert.equal(gameDistance(g, INSIDE, INSIDE), 0);
  assert.equal(gameDistance(other, INSIDE, INSIDE), Infinity);
  assert.equal(
    TERRITORIES.some((t) => t.id === HMS),
    false,
  );
  other.mobileStronghold = { location: 'arsunt:11' };
  assert.notEqual(
    gameDistance(other, INSIDE, 'polar_sink:0'),
    gameDistance(g, INSIDE, 'polar_sink:0'),
  );
});
void test('first-storm placement happens after destruction and before the spice opening', () => {
  let g = fixture();
  g.phase = 0;
  g.mobileStronghold!.location = null;
  g.stormPending = 1;
  g.storm = 17;
  g.players[1].forces = { 'wind_pass_north:18': 2 };
  g.players[1].reserves = 18;
  g = ready(g);
  assert.equal(g.storm, 18);
  assert.equal(g.players[1].tanks, 2);
  assert.equal(g.players[0].forces[INSIDE], 6);
  assert.equal(g.phase, 0);
  assert.equal(g.decision?.kind, 'mobileStronghold');
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', location: 'polar_sink:0' }),
    /pending decision/,
  );
  for (const key of [
    'carthag:11',
    'polar_sink:18',
    INSIDE,
    'polar_sink:00',
    '__proto__:0',
  ])
    assert.throws(() =>
      applyAction(g, 'i', { type: 'decision', location: key }),
    );
  g = applyAction(JSON.parse(JSON.stringify(g)), 'i', {
    type: 'decision',
    location: 'polar_sink:0',
  });
  assert.equal(g.phase, 1);
  assert.ok(g.phaseOpening);
  conserve(g);
});
void test('an undocked stronghold cannot receive shipments', () => {
  const g = fixture();
  g.mobileStronghold!.location = null;
  assert.throws(() => applyAction(g, 'i', ship()), /not been placed/);
});
void test('Ixians ship directly at stronghold rates; other factions and allied Guild transport cannot', () => {
  let g = fixture();
  g = applyAction(g, 'i', { ...ship(2), elite: 1 });
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[0].forces[INSIDE], 8);
  conserve(g);
  g.active = 'e';
  assert.throws(() => applyAction(g, 'e', ship()), /Only Ixians/);
  g.players[2].faction = 'guild';
  g.players[1].ally = 'a';
  g.players[2].ally = 'e';
  g.players[1].forces = { 'polar_sink:0': 2 };
  g.players[1].reserves = 18;
  assert.throws(
    () =>
      applyAction(g, 'e', {
        type: 'guildShip',
        from: 'polar_sink:0',
        territory: HMS,
        sector: 0,
        amount: 1,
      }),
    /Only Ixians/,
  );
});
void test('Bene Gesserit can accompany an Ixian direct shipment inside', () => {
  let g = fixture();
  g.players[2].faction = 'beneGesserit';
  g.advanced = true;
  g = applyAction(g, 'i', ship());
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(g, 'a', { type: 'decision', accept: true, accompany: true });
  g = allow(g);
  assert.equal(g.players[2].forces[INSIDE], 1);
  conserve(g);
});
void test('the pointing sector is the only entrance and consumes a territory of movement', () => {
  let g = fixture();
  g.active = 'e';
  g.players[1].forces = { 'polar_sink:0': 3 };
  g.players[1].reserves = 17;
  g = applyAction(g, 'e', {
    type: 'move',
    from: 'polar_sink:0',
    territory: HMS,
    sector: 0,
    amount: 2,
  });
  assert.equal(g.players[1].forces[INSIDE], 2);
  assert.equal(g.players[1].moved, 1);
  conserve(g);
  const neighbor = GRAPH['polar_sink:0'][0];
  g = fixture();
  g.active = 'e';
  g.players[1].forces = { [neighbor]: 2 };
  g.players[1].reserves = 18;
  assert.throws(
    () =>
      applyAction(g, 'e', {
        type: 'move',
        from: neighbor,
        territory: HMS,
        sector: 0,
        amount: 2,
      }),
    /more than 1/,
  );
});
void test('storm blocks entrance, exit and battles through the stronghold’s pointing sector', () => {
  const g = fixture();
  const pointer = 'arsunt:11';
  g.mobileStronghold!.location = pointer;
  g.storm = 11;
  assert.equal(
    gameDistance(g, INSIDE, pointer, (key) => splitLocation(key).sector === 11),
    Infinity,
  );
  assert.throws(
    () =>
      applyAction(g, 'i', {
        type: 'move',
        from: INSIDE,
        territory: 'arsunt',
        sector: 11,
        amount: 2,
        elite: 0,
      }),
    /storm/,
  );
  g.players[1].forces = { [INSIDE]: 2 };
  g.players[1].reserves = 18;
  assert.equal(battles(g).filter((b) => b.territory === HMS).length, 0);
  g.storm = 12;
  assert.equal(battles(g).filter((b) => b.territory === HMS).length, 1);
});
void test('inside forces are distinct from outside forces and enforce two-faction capacity', () => {
  const g = fixture();
  g.players[1].forces = { 'polar_sink:0': 2 };
  g.players[1].reserves = 18;
  assert.equal(battles(g).length, 0);
  g.players[1].forces = { [INSIDE]: 2 };
  g.players[2].forces = { 'polar_sink:0': 2 };
  g.players[2].reserves = 18;
  g.active = 'a';
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'move',
        from: 'polar_sink:0',
        territory: HMS,
        sector: 0,
        amount: 1,
      }),
    /three occupying factions/,
  );
});
void test('a sole controller can use the mobile stronghold as the third winning stronghold', () => {
  let g = fixture();
  g.players[0].forces['arrakeen:10'] = 1;
  g.players[0].forces['carthag:11'] = 1;
  g.players[0].reserves -= 2;
  g.phase = 7;
  g = ready(ready(g));
  assert.equal(g.status, 'finished');
  assert.deepEqual(g.winner, ['i']);
  conserve(g);
});
void test('relocation precedes later storm dials and canceled movement changes neither position nor spice', () => {
  let g = nextStorm();
  const route = mobileRoutes(g, 3).find((r) => mobileRouteDistance(r) === 3)!;
  assert.equal(g.decision?.kind, 'mobileStronghold');
  assert.equal(g.stormPending, null);
  assert.throws(
    () => applyAction(g, 'e', { type: 'stormDial', amount: 1 }),
    /pending decision/,
  );
  g.spice[route.at(-1)!] = 15;
  g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const before = structuredClone(g);
  g = applyAction(g, 'i', { type: 'decision', route });
  assert.equal(g.response?.kind, 'mobileStronghold');
  assert.equal(g.mobileStronghold!.location, route[0]);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'card',
    mode: 'cancel',
    card: g.players[1].hand[0].id,
  });
  assert.equal(g.mobileStronghold!.location, before.mobileStronghold!.location);
  assert.deepEqual(g.spice, before.spice);
  assert.equal(g.players[0].spice, before.players[0].spice);
  assert.equal(g.pendingMobileMove, null);
  assert.equal(g.decision, null);
  g = applyAction(g, 'e', { type: 'stormDial', amount: 1 });
  assert.equal(g.stormDials.e, 1);
  conserve(g);
});
void test('relocation collects only along the declared sectors and leaves all passengers inside', () => {
  let g = nextStorm();
  const route = mobileRoutes(g, 3).find((r) => mobileRouteDistance(r) === 3)!;
  const end = route.at(-1)!;
  g.spice[end] = 15;
  const unvisited = Object.keys(GRAPH).find((key) => !route.includes(key))!;
  g.spice[unvisited] = 9;
  const units = structuredClone(g.players[0].forces);
  g = allow(applyAction(g, 'i', { type: 'decision', route }));
  assert.equal(g.mobileStronghold!.location, end);
  assert.deepEqual(g.players[0].forces, units);
  assert.equal(g.players[0].spice, 32);
  assert.equal(g.spice[end], 3);
  assert.equal(g.spice[unvisited], 9);
  conserve(g);
});
void test('invalid, repeated, disconnected, overlong and stronghold-ending routes roll back', () => {
  const g = nextStorm();
  const before = structuredClone(g);
  const long = mobileRoutes(g, 4).find((r) => mobileRouteDistance(r) === 4)!;
  const routes: unknown[] = [
    null,
    {},
    [1],
    [],
    ['polar_sink:0'],
    ['__proto__', 'polar_sink:0'],
    ['polar_sink:0', 'carthag:11'],
    ['polar_sink:0', GRAPH['polar_sink:0'][0], 'polar_sink:0'],
    long,
  ];
  for (const route of routes) {
    assert.throws(() => applyAction(g, 'i', { type: 'decision', route }));
    assert.deepEqual(g, before);
  }
});
void test('advanced storm card stays hidden until relocation is resolved', () => {
  const initial = fixture();
  initial.advanced = true;
  initial.players[1].faction = 'fremen';
  initial.stormCard = 4;
  let g = nextStorm(initial);
  assert.equal(g.stormPending, null);
  assert.equal(g.stormCard, 4);
  g = applyAction(g, 'i', { type: 'decision', decline: true });
  assert.equal(g.stormPending, 4);
  assert.equal(g.stormCard, null);
});
void test('a captured or empty stronghold cannot be relocated by another faction', () => {
  const initial = fixture();
  initial.players[0].forces = {};
  initial.players[0].reserves = 20;
  initial.players[0].elites!.forces = {};
  initial.players[0].elites!.reserves = 7;
  initial.players[1].forces = { [INSIDE]: 2 };
  initial.players[1].reserves = 18;
  const g = nextStorm(initial);
  assert.equal(g.decision, null);
  assert.deepEqual(g.stormDialers, ['i', 'e']);
  conserve(g);
});
void test('special Karama relocates at most two territories without spending ordinary shipment or movement', () => {
  let g = fixture();
  g.advanced = true;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [card];
  const route = mobileRoutes(g, 2).find((r) => mobileRouteDistance(r) === 2)!;
  const long = mobileRoutes(g, 3).find((r) => mobileRouteDistance(r) === 3)!;
  assert.throws(
    () =>
      applyAction(g, 'i', {
        type: 'card',
        mode: 'special',
        card: card.id,
        route: long,
      }),
    /at most 2/,
  );
  g = applyAction(g, 'i', {
    type: 'card',
    mode: 'special',
    card: card.id,
    route,
    collect: false,
  });
  assert.equal(g.players[0].moved, 0);
  assert.equal(g.players[0].shipped, false);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(g.mobileStronghold!.location, route.at(-1));
  assert.equal(g.discard.at(-1)?.id, card.id);
  conserve(g);
});
void test('all AI levels select legal placement and relocation using private projections', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = nextStorm();
    g.players[0].bot = difficulty;
    const route = mobileRoutes(g, 3)[0];
    g.spice[route.at(-1)!] = 6;
    const choice = botActions(viewGame(g, 'i'))[0];
    assert.ok(choice);
    g = applyAction(g, 'i', choice);
    assert.equal(g.response, null);
    assert.equal(g.pendingMobileMove, null);
    assert.equal('pendingMobileMove' in viewGame(g, 'e'), false);
    g = fixture();
    g.players[0].bot = difficulty;
    g.mobileStronghold!.location = null;
    g.decision = { kind: 'mobileStronghold', player: 'i', placement: true };
    const placement = botActions(viewGame(g, 'i'))[0];
    assert.ok(placement);
    g = applyAction(g, 'i', placement);
    assert.ok(g.mobileStronghold!.location);
  }
});
void test('worm destruction targets the outside territory without entering the stronghold', () => {
  let g = fixture();
  const land = spiceDeck().find((c) => 'territory' in c)!;
  assert.ok('territory' in land);
  g.mobileStronghold!.location = `${land.territory}:${land.sector}`;
  g.players[1].forces = { [g.mobileStronghold!.location]: 2 };
  g.players[1].reserves = 18;
  g.phase = 1;
  g.turn = 2;
  g.spiceDiscard = [[land], []];
  g.spiceDeck = [
    { worm: true },
    spiceDeck().find(
      (c) => 'territory' in c && c.territory !== land.territory,
    )!,
  ];
  g = ready(g);
  assert.equal(g.players[0].forces[INSIDE], 6);
  assert.equal(g.players[1].tanks, 2);
  conserve(g);
});
void test('occupation by another faction counts for its victory; contested or advisor-only presence does not', () => {
  for (const mode of ['captured', 'contested', 'advisors'] as const) {
    let g = fixture();
    g.players[1].forces = { [INSIDE]: 2, 'arrakeen:10': 1, 'carthag:11': 1 };
    g.players[1].reserves = 16;
    if (mode !== 'contested') {
      g.players[0].forces = {};
      g.players[0].reserves = 20;
      g.players[0].elites!.forces = {};
      g.players[0].elites!.reserves = 7;
    }
    if (mode === 'advisors') {
      g.advanced = true;
      g.players[1].faction = 'beneGesserit';
      g.players[1].advisors = { [HMS]: { lockedTurn: g.turn } };
      // Enemy fighters keep the BG token from automatically flipping when alone.
      g.players[0].forces = { [INSIDE]: 1 };
      g.players[0].reserves = 19;
    }
    g.phase = 7;
    g = ready(ready(g));
    assert.deepEqual(g.winner, mode === 'captured' ? ['e'] : []);
    conserve(g);
  }
});
void test('all AI levels can use the special relocation and can propose normal movement out of the stronghold', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g.advanced = true;
    g.players[0].bot = difficulty;
    g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
    const route = mobileRoutes(g, 2).find((r) => mobileRouteDistance(r) === 2)!;
    g.spice[route.at(-1)!] = 12;
    const choice = botActions(viewGame(g, 'i'))[0];
    assert.equal(choice.mode, 'special');
    g = applyAction(g, 'i', choice);
    assert.equal(g.players[0].specialKaramaUsed, true);
    g.players[0].shipped = true;
    const candidate = botActions(viewGame(g, 'i')).find((a) => {
      if (a.type !== 'move') return false;
      try {
        applyAction(g, 'i', a);
        return true;
      } catch {
        return false;
      }
    });
    assert.ok(candidate, `${difficulty} can leave the mobile stronghold`);
    conserve(g);
  }
});
void test('advanced advisor setup cannot use the not-yet-placed mobile stronghold', () => {
  const g = fixture();
  g.status = 'setup';
  g.advanced = true;
  g.players[2].faction = 'beneGesserit';
  g.mobileStronghold!.location = null;
  assert.throws(
    () =>
      applyAction(g, 'a', { type: 'advisorSetup', territory: HMS, sector: 0 }),
    /not yet placed/,
  );
  assert.equal(g.players[2].reserves, 20);
});
void test('ordinary and special stronghold relocation reject storm departure, arrival and transit without spending resources', () => {
  const base = nextStorm();
  const route = mobileRoutes(base, 3).find(
    (r) =>
      r.length >= 3 &&
      splitLocation(r.at(-1)!).sector > 0 &&
      r
        .slice(1, -1)
        .some(
          (key) =>
            splitLocation(key).sector > 0 &&
            splitLocation(key).sector !== splitLocation(r.at(-1)!).sector,
        ),
  )!;
  assert.ok(route);
  const middle = route
    .slice(1, -1)
    .find(
      (key) =>
        splitLocation(key).sector > 0 &&
        splitLocation(key).sector !== splitLocation(route.at(-1)!).sector,
    )!;
  for (const special of [false, true])
    for (const mode of ['departure', 'arrival', 'transit'] as const) {
      const g = structuredClone(base);
      const chosen =
        mode === 'departure' ? route.slice(route.indexOf(middle)) : route;
      g.mobileStronghold!.location = chosen[0];
      g.storm = splitLocation(
        mode === 'arrival' ? chosen.at(-1)! : middle,
      ).sector;
      if (special) {
        g.phase = 5;
        g.advanced = true;
        g.active = 'i';
        g.decision = null;
        g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
      }
      const before = structuredClone(g);
      assert.throws(
        () =>
          applyAction(
            g,
            'i',
            special
              ? {
                  type: 'card',
                  mode: 'special',
                  card: g.players[0].hand[0].id,
                  route: chosen,
                }
              : { type: 'decision', route: chosen },
          ),
        /cannot move into, out of or through the storm/,
      );
      assert.deepEqual(g, before);
    }
});
void test('AI route generation observes storm obstruction, including a storm-covered starting pointer', () => {
  const g = fixture();
  g.storm = 1;
  const routes = mobileRoutes(g, 3);
  assert.ok(routes.length);
  assert.ok(
    routes.every((route) =>
      route.every((key) => splitLocation(key).sector !== 1),
    ),
  );
  g.mobileStronghold!.location = 'cielago_north:1';
  assert.deepEqual(mobileRoutes(g, 3), []);
});
