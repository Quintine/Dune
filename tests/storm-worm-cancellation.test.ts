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
import { baseDeck, spiceDeck } from '../game/cards';
import { territory } from '../game/board';
const shipmentSector = territory('the_great_flat').sectors[0];
const shipmentKey = `the_great_flat:${shipmentSector}`;
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture() {
  const g = createGame(
    'STORMWORM',
    newPlayer('b', 'BG', 'beneGesserit'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('f', 'Fremen', 'fremen'),
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('r', 'Richese', 'richese'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 0,
    turn: 1,
    active: 'f',
    storm: 6,
    order: ['f', 'e', 'r', 'b'],
    deck: baseDeck(),
    phaseOpening: null,
    stormDialers: ['f', 'e'],
    stormDials: {},
    ready: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    p.traitors = [];
    p.traitorChoices = [];
  }
  const hold = (id: string, kind: string) => {
    const i = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
    assert.ok(i >= 0);
    const c = g.deck.splice(i, 1)[0];
    player(g, id).hand.push(c);
    return c.id;
  };
  const worthless = hold('b', 'worthless'),
    printed = hold('e', 'karama'),
    special = hold('f', 'karama');
  player(g, 'f').forces = { 'red_chasm:7': 4 };
  player(g, 'f').reserves = 16;
  player(g, 'f').elites = {
    forces: { 'red_chasm:7': 2 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  return { g, worthless, printed, special };
}
type Fixture = ReturnType<typeof fixture>;
function act(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const next = applyAction(g, id, a);
  assert.deepEqual(g, before);
  return reload(next);
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
  return act(g, bg ? 'b' : 'e', {
    type: 'card',
    card: bg ? f.worthless : f.printed,
    mode: 'cancel',
  });
}
function settledCancel(g: Game, f: Fixture, bg: boolean) {
  g = cancel(g, f, bg);
  return bg ? pass(g, 'worthlessKarama') : g;
}
function storm(f: Fixture, distance = 1) {
  let g = act(f.g, 'f', { type: 'stormDial', amount: Math.min(20, distance) });
  g = act(g, 'e', { type: 'stormDial', amount: Math.max(0, distance - 20) });
  for (const p of g.players) g = act(g, p.id, { type: 'ready' });
  assert.equal(g.response?.kind, 'stormProtection');
  return g;
}
function shipment(f: Fixture) {
  let g = f.g;
  g.phase = 5;
  g.turn = 2;
  g.storm = shipmentSector;
  player(g, 'f').forces = { [shipmentKey]: 4 };
  player(g, 'f').elites!.forces = { [shipmentKey]: 2 };
  g.movementRemaining = [...g.order];
  g.stormDialers = [];
  g.stormPending = null;
  g = act(g, 'f', {
    type: 'ship',
    territory: 'the_great_flat',
    sector: shipmentSector,
    amount: 3,
    elite: 1,
  });
  assert.equal(g.response?.kind, 'stormProtection');
  assert.equal(g.response?.resume, 'shipment');
  return g;
}
function naturalWorm(
  f: Fixture,
  ally = false,
  additional = false,
  site = 'red_chasm',
) {
  let g = f.g;
  g.phase = 1;
  g.turn = 2;
  g.storm = 18;
  g.nexus = false;
  g.stormPending = null;
  const lands = spiceDeck().filter((c) => 'territory' in c);
  const land = lands.find((c) => c.territory === site)!;
  const worm = spiceDeck().find((c) => 'worm' in c)!;
  g.spiceDiscard = [[additional ? worm : land], []];
  g.spiceDeck = [worm, ...lands.filter((c) => c !== land)];
  if (ally) {
    player(g, 'f').ally = 'e';
    player(g, 'e').ally = 'f';
    player(g, 'e').forces = { 'red_chasm:7': 2 };
    player(g, 'e').reserves = 18;
  }
  for (const p of g.players) g = act(g, p.id, { type: 'ready' });
  if (additional) {
    assert.equal(g.decision?.kind, 'wormPlacement');
    g = act(g, 'f', { type: 'decision', accept: true, territory: 'red_chasm' });
  } else if (ally) {
    assert.equal(g.decision?.kind, 'wormProtection');
    g = act(g, 'f', { type: 'decision', accept: true });
  }
  assert.equal(
    g.response?.kind,
    additional ? 'wormPlacement' : ally ? 'wormAllyProtection' : 'wormSurvival',
  );
  return g;
}
function noField(g: Game) {
  const p = player(g, 'r');
  p.noField = deployRicheseNoField(createRicheseNoField(['n0', 'n3', 'n5']), {
    tokenId: 'n3',
    controller: p.id,
    location: { territory: 'red_chasm', sector: 7 },
  });
  p.noFieldEvent = 'deployed-n3';
}
function reject(g: Game, f: Fixture, bg: boolean) {
  const before = structuredClone(g);
  assert.throws(() => cancel(g, f, bg));
  assert.deepEqual(g, before);
  assert.ok(
    player(g, bg ? 'b' : 'e').hand.some(
      (c) => c.id === (bg ? f.worthless : f.printed),
    ),
  );
}

void test('both Karama forms cancel real first-storm exposure beyond a full circuit and preserve typed force conservation', () => {
  for (const bg of [false, true]) {
    const f = fixture();
    let g = storm(f, 40);
    assert.equal(g.stormResolution?.distance, 40);
    g = settledCancel(g, f, bg);
    assert.equal(player(g, 'f').forces['red_chasm:7'], undefined);
    assert.equal(player(g, 'f').tanks, 4);
    assert.equal(player(g, 'f').elites?.tanks, 2);
    assert.equal(g.storm, 10);
    assert.equal(g.stormResolution, null);
    assert.equal(
      g.discard.filter((c) => c.id === (bg ? f.worthless : f.printed)).length,
      1,
    );
  }
});
void test('printed counter-cancellation of BG storm protection restores genuine typed casualty choice and its pending continuation', () => {
  const f = fixture();
  player(f.g, 'f').forces['the_minor_erg:7'] = 4;
  player(f.g, 'f').reserves = 12;
  player(f.g, 'f').elites!.forces['the_minor_erg:7'] = 1;
  player(f.g, 'f').elites!.reserves = 0;
  let g = cancel(storm(f), f, true);
  g = act(g, 'e', { type: 'card', card: f.printed, mode: 'cancel' });
  g = pass(g, 'stormProtection');
  assert.equal(g.decision?.kind, 'stormLosses');
  assert.equal(g.stormResolution?.traversed, 1);
  assert.equal(viewGame(g, 'f').decision?.kind, 'stormLosses');
  assert.deepEqual(g.stormResolution!.pending, ['the_minor_erg:7']);
  g = act(reload(g), 'f', { type: 'decision', elite: 1 });
  assert.equal(g.decision?.kind, 'stormLosses');
  assert.deepEqual(g.stormResolution!.pending, []);
  g = act(reload(g), 'f', { type: 'decision', elite: 0 });
  assert.equal(player(g, 'f').forces['the_minor_erg:7'], 2);
  assert.equal(player(g, 'f').elites!.forces['the_minor_erg:7'], 1);
  assert.equal(player(g, 'f').forces['red_chasm:7'], 2);
  assert.equal(player(g, 'f').elites?.forces['red_chasm:7'], 1);
  assert.equal(player(g, 'f').tanks, 4);
  assert.equal(player(g, 'f').elites?.tanks, 1);
  assert.equal(g.stormResolution, null);
});
void test('both forms cancel only a newly shipped typed Fremen cohort in the storm, leaving earlier occupants intact', () => {
  for (const bg of [false, true]) {
    const f = fixture();
    let g = shipment(f);
    assert.equal(player(g, 'f').forces[shipmentKey], 7);
    g = settledCancel(g, f, bg);
    assert.equal(player(g, 'f').forces[shipmentKey], 4);
    assert.equal(player(g, 'f').elites?.forces[shipmentKey], 2);
    assert.equal(player(g, 'f').tanks, 3);
    assert.equal(player(g, 'f').elites?.tanks, 1);
    assert.equal(player(g, 'f').shipped, true);
    assert.equal(player(g, 'f').moved, 0);
  }
});
void test('natural worm survival, allied protection and additional placement retain their distinct genuine cancellation consequences', () => {
  for (const bg of [false, true])
    for (const source of ['survival', 'ally', 'placement'] as const) {
      const f = fixture();
      let g = naturalWorm(f, source === 'ally', source === 'placement');
      g = settledCancel(g, f, bg);
      if (source === 'placement') {
        assert.equal(g.wormPlacementCanceledTurn, 2);
        assert.equal(player(g, 'f').tanks, 0);
        assert.equal(player(g, 'f').forces['red_chasm:7'], 4);
      } else if (source === 'survival') {
        assert.equal(player(g, 'f').tanks, 4);
        assert.equal(player(g, 'f').elites?.tanks, 2);
      } else {
        g = pass(g, 'wormSurvival');
        assert.equal(player(g, 'f').tanks, 0);
        assert.equal(player(g, 'e').tanks, 2);
      }
    }
});

void test('malformed current storm and worm casualty custody is rejected before either physical Karama cost', () => {
  for (const source of ['storm', 'shipment', 'worm'] as const)
    for (const bg of [false, true]) {
      const f = fixture();
      const g =
        source === 'storm'
          ? storm(f)
          : source === 'shipment'
            ? shipment(f)
            : naturalWorm(f);
      const key = source === 'shipment' ? shipmentKey : 'red_chasm:7';
      const corrupt: ((g: Game) => void)[] = [
        (s) => {
          player(s, 'f').forces[key] = -1;
        },
        (s) => {
          player(s, 'f').forces[key] = 1.5;
        },
        (s) => {
          player(s, 'f').elites!.forces[key] = 99;
        },
        (s) => {
          player(s, 'f').elites!.tanks = -1;
        },
        (s) => {
          player(s, 'f').tanks = Number.MAX_SAFE_INTEGER;
        },
      ];
      if (source === 'storm')
        corrupt.push(
          (s) => {
            s.stormResolution = null;
          },
          (s) => {
            s.stormResolution!.from = -1;
          },
          (s) => {
            s.stormResolution!.distance = 1.5;
          },
          (s) => {
            s.stormResolution!.traversed = 2;
          },
        );
      if (source === 'shipment')
        corrupt.push(
          (s) => {
            s.response!.elite = 99;
          },
          (s) => {
            s.response!.amount = 99;
          },
          (s) => {
            s.response!.location = 'red_chasm:8';
          },
          (s) => {
            s.response!.resume = undefined;
          },
        );
      if (source === 'worm')
        corrupt.push(
          (s) => {
            s.spiceResolution = null;
            s.spiceSequence = null;
          },
          (s) => {
            s.spiceSequence!.pile = 2 as 0;
          },
          (s) => {
            s.response!.location = 'arrakeen';
          },
          (s) => {
            s.phase = 5;
          },
        );
      if (source !== 'shipment') {
        noField(g);
        corrupt.push(
          (s) => {
            player(s, 'r').noField!.deployed!.controller = 'e';
          },
          (s) => {
            player(s, 'r').noField!.tokens.pop();
          },
          (s) => {
            player(s, 'r').reserves = -1;
          },
        );
      }
      for (const change of corrupt) {
        const bad = reload(g);
        change(bad);
        reject(bad, f, bg);
      }
    }
});
void test('an already paid BG cancellation rechecks current typed casualty custody before allowing its suffix', () => {
  for (const source of ['storm', 'shipment', 'worm'] as const) {
    const f = fixture();
    const key = source === 'shipment' ? shipmentKey : 'red_chasm:7';
    const original =
      source === 'storm'
        ? storm(f)
        : source === 'shipment'
          ? shipment(f)
          : naturalWorm(f);
    const g = cancel(original, f, true);
    player(g, 'f').elites!.forces[key] = 99;
    g.response!.passed = g.players.filter((p) => p.id !== 'e').map((p) => p.id);
    const before = structuredClone(g);
    assert.throws(() => act(g, 'e', { type: 'passResponse' }));
    assert.deepEqual(g, before);
    assert.equal(g.discard.filter((c) => c.id === f.worthless).length, 1);
  }
});

void test('valid concealed No-Fields reveal only available reserves before a canceled storm or worm destroys them', () => {
  for (const source of ['storm', 'worm'] as const)
    for (const bg of [false, true]) {
      const f = fixture();
      noField(f.g);
      const richese = player(f.g, 'r');
      richese.reserves = 2;
      richese.tanks = 18;
      let g = source === 'storm' ? storm(f) : naturalWorm(f);
      g = settledCancel(g, f, bg);
      assert.equal(player(g, 'r').noField?.deployed, null);
      assert.equal(player(g, 'r').reserves, 0);
      assert.equal(player(g, 'r').tanks, 20);
      assert.equal(player(g, 'r').forces['red_chasm:7'], undefined);
      assert.equal(
        g.log.filter((entry) => entry.text.includes('revealed the 3 No-Field'))
          .length,
        1,
      );
    }
});
void test('a summoned worm before any natural spice draw supports both cancellation forms and restores its original pre-blow parent', () => {
  for (const bg of [false, true]) {
    const f = fixture();
    f.g.phase = 1;
    f.g.turn = 2;
    f.g.storm = 18;
    f.g.nexus = false;
    f.g.stormPending = null;
    const deck = structuredClone(f.g.spiceDeck);
    let g = act(f.g, 'f', {
      type: 'card',
      mode: 'special',
      card: f.special,
      territory: 'red_chasm',
    });
    assert.equal(g.response?.kind, 'wormSurvival');
    assert.ok(g.summonedWorm);
    assert.equal(g.spiceSequence, null);
    g = settledCancel(g, f, bg);
    assert.equal(g.summonedWorm, null);
    assert.equal(g.nexus, false);
    assert.equal(g.summonedBeforeBlow, true);
    assert.equal(player(g, 'f').tanks, 4);
    assert.deepEqual(g.spiceDeck, deck);
    assert.equal(g.discard.filter((card) => card.id === f.special).length, 1);
  }
});

void test('malformed natural resolution and summoned-parent ride restoration reject before cancellation cost', () => {
  for (const bg of [false, true]) {
    const natural = fixture();
    const broken = naturalWorm(natural);
    broken.spiceSequence = null;
    broken.spiceResolution!.skipped = null as unknown as NonNullable<
      Game['spiceResolution']
    >['skipped'];
    reject(broken, natural, bg);
    const summoned = fixture();
    summoned.g.phase = 1;
    summoned.g.turn = 2;
    summoned.g.storm = 18;
    summoned.g.nexus = false;
    summoned.g.stormPending = null;
    const source = act(summoned.g, 'f', {
      type: 'card',
      mode: 'special',
      card: summoned.special,
      territory: 'red_chasm',
    });
    source.summonedWorm!.resume.wormRides = null as unknown as string[];
    reject(source, summoned, bg);
  }
});

void test('natural worms from printed rock-territory spice cards support both cancellation forms', () => {
  for (const bg of [false, true]) {
    const f = fixture();
    const key = 'sihaya_ridge:9';
    player(f.g, 'f').forces = { [key]: 4 };
    player(f.g, 'f').elites!.forces = { [key]: 2 };
    player(f.g, 'e').forces = { [key]: 2 };
    player(f.g, 'e').reserves = 18;
    let g = naturalWorm(f, false, false, 'sihaya_ridge');
    assert.equal(g.response?.location, 'sihaya_ridge');
    g = settledCancel(g, f, bg);
    assert.equal(player(g, 'f').tanks, 4);
    assert.equal(player(g, 'f').elites?.tanks, 2);
    assert.equal(player(g, 'e').tanks, 2);
    assert.equal(player(g, 'f').forces[key], undefined);
  }
});
