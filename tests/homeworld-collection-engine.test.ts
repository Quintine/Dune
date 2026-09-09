import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck, leaders } from '../game/cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { createTechTokens } from '../game/tech-tokens';

const own = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
type Options = {
  advanced?: boolean;
  native?: number;
  shared?: boolean;
  multiple?: boolean;
  stronghold?: boolean;
  empty?: boolean;
  technology?: boolean;
};
function fixture(options: Options = {}) {
  let g = createGame(
    'GIEDICOLLECTION',
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    options.advanced ?? true,
    [],
  );
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'h', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const command = botActions(view)[0];
      if (command) {
        next = applyAction(g, p.id, command);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    Object.assign(p, {
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      shipped: true,
      moved: 0,
    });
  }
  const hark = own(g, 'h');
  hark.forces = {
    'wind_pass:14': 2,
    ...(options.multiple ? { 'hagga_basin:12': 2 } : {}),
    ...(options.stronghold ? { 'arrakeen:10': 1 } : {}),
  };
  hark.reserves = options.native ?? 7;
  hark.forces['imperial_basin:10'] =
    20 - hark.reserves - Object.values(hark.forces).reduce((a, b) => a + b, 0);
  if (options.shared) {
    // Explicit Ecaz faction seam after genuine base Homeworld setup; the shared
    // collection and all negotiated allocations still use production actions.
    const ecaz = own(g, 'g');
    ecaz.faction = 'ecaz';
    ecaz.leaders = leaders('ecaz');
    ecaz.forces = {
      'wind_pass:14': 2,
      ...(options.multiple ? { 'hagga_basin:12': 2 } : {}),
      ...(options.stronghold ? { 'arrakeen:10': 1 } : {}),
    };
    ecaz.reserves = 20 - Object.values(ecaz.forces).reduce((a, b) => a + b, 0);
    ecaz.ally = hark.id;
    hark.ally = ecaz.id;
    ecaz.allySinceTurn = hark.allySinceTurn = 1;
  }
  Object.assign(g, {
    phase: 5,
    turn: 2,
    active: 'a',
    movementRemaining: ['a'],
    order: ['g', 'h', 'a'],
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
    storm: 18,
    spice: options.empty
      ? {}
      : {
          'wind_pass:14': 3,
          ...(options.multiple ? { 'hagga_basin:12': 5 } : {}),
        },
  });
  if (options.technology) {
    g.techTokens = createTechTokens(g.players);
    g.techTokens.heighliners = { owner: 'h', spice: 2 };
  }
  inventory(g);
  return g;
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
}
function start(g: Game) {
  const before = reload(g);
  const next = applyAction(g, 'a', { type: 'endMovement' });
  assert.deepEqual(g, before);
  assert.equal(next.phase, 7);
  return next;
}
function choose(g: Game, allocation: Record<string, unknown>) {
  assert.equal(g.decision?.kind, 'ecazSpice');
  return applyAction(reload(g), g.decision.player, {
    type: 'decision',
    event: g.ecazCollection!.event,
    allocation,
  });
}
function equal(g: Game) {
  return choose(g, { kind: 'equal' });
}
function receipt(g: Game) {
  assert.ok(g.giediCollection);
  const { signature, ...facts } = g.giediCollection;
  assert.equal(typeof signature, 'string');
  return facts;
}
function stable(g: Game) {
  inventory(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
}

void test('actual collection entry grants high Giedi two spice once across multiple deserts in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const original = fixture({ advanced, multiple: true });
    const g = start(original);
    assert.equal(own(g, 'h').spice, 29);
    assert.deepEqual(receipt(g), {
      turn: 2,
      player: 'h',
      awarded: true,
      qualifying: 7,
    });
    assert.equal(g.spice['wind_pass:14'], 0);
    assert.equal(g.spice['hagga_basin:12'], 1);
    assert.deepEqual(own(g, 'h').forces, own(original, 'h').forces);
    stable(g);
  }
});

void test('below-threshold Giedi receives ordinary desert spice without the two-spice bonus', () => {
  const g = start(fixture({ native: 6, multiple: true }));
  assert.equal(own(g, 'h').spice, 27);
  assert.deepEqual(receipt(g), {
    turn: 2,
    player: 'h',
    awarded: false,
    qualifying: 7,
  });
  stable(g);
});

void test('stronghold and technology credits with no actual desert collection do not qualify high Giedi', () => {
  const g = start(fixture({ empty: true, stronghold: true, technology: true }));
  assert.equal(own(g, 'h').spice, 24);
  assert.equal(g.techTokens!.heighliners.spice, 0);
  assert.deepEqual(receipt(g), {
    turn: 2,
    player: 'h',
    awarded: false,
    qualifying: 0,
  });
  stable(g);
});

void test('shared desert escrow does not pay Giedi until a positive actual allotment, including a zero first agreement', () => {
  let g = start(fixture({ shared: true, multiple: true }));
  assert.equal(own(g, 'h').spice, 20);
  assert.deepEqual(receipt(g), {
    turn: 2,
    player: 'h',
    awarded: false,
    qualifying: 0,
  });
  const first =
    g.ecazCollection!.allocation!.lots[g.ecazCollection!.allocation!.index];
  g = choose(g, { kind: 'propose', ecazShare: first.amount });
  stable(g);
  g = choose(g, { kind: 'accept' });
  assert.equal(own(g, 'h').spice, 20);
  assert.equal(g.giediCollection!.awarded, false);
  assert.equal(g.giediCollection!.qualifying, 0);
  stable(g);
  const next =
    g.ecazCollection!.allocation!.lots[g.ecazCollection!.allocation!.index];
  g = equal(g);
  const income = Math.ceil(next.amount / 2);
  assert.equal(own(g, 'h').spice, 20 + income + 2);
  assert.equal(g.giediCollection!.qualifying, income);
  assert.equal(g.giediCollection!.awarded, true);
  assert.equal(g.ecazCollection!.stage, 'complete');
  stable(g);
});

void test('multiple positive shared allotments award high Giedi only once', () => {
  let g = start(fixture({ shared: true, multiple: true }));
  let total = 0;
  while (g.decision?.kind === 'ecazSpice') {
    const lot =
      g.ecazCollection!.allocation!.lots[g.ecazCollection!.allocation!.index];
    total += Math.ceil(lot.amount / 2);
    g = equal(g);
    assert.equal(own(g, 'h').spice, 20 + total + 2);
    assert.equal(g.giediCollection!.qualifying, total);
    stable(g);
  }
});

void test('canceling Ecaz stronghold income preserves later shared desert and independent Giedi income', () => {
  for (const canceled of [false, true]) {
    let g = fixture({ shared: true, stronghold: true });
    const at = g.deck.findIndex((c) => c.effect === 'karama');
    const [card] = g.deck.splice(at, 1);
    own(g, 'a').hand.push(card);
    g = start(g);
    assert.equal(g.response?.kind, 'ecazCollection');
    g = applyAction(
      reload(g),
      'a',
      canceled
        ? { type: 'card', card: card.id, mode: 'cancel' }
        : { type: 'passResponse' },
    );
    assert.equal(own(g, 'h').spice, 22);
    assert.equal(own(g, 'g').spice, canceled ? 20 : 22);
    assert.equal(g.giediCollection!.awarded, false);
    g = equal(g);
    assert.equal(own(g, 'h').spice, 26);
    assert.equal(g.giediCollection!.awarded, true);
    assert.equal(g.ecazCollection!.canceled, canceled);
    stable(g);
  }
});

void test('stale shared allocation commands cannot replay Giedi income or alter the settled receipt', () => {
  let g = start(fixture({ shared: true }));
  const actor = g.decision!.player;
  const command: Action = {
    type: 'decision',
    event: g.ecazCollection!.event,
    allocation: { kind: 'equal' },
  };
  g = applyAction(g, actor, command);
  const before = reload(g);
  assert.throws(() => applyAction(g, actor, command));
  assert.deepEqual(g, before);
  assert.equal(own(g, 'h').spice, 24);
  stable(g);
});
