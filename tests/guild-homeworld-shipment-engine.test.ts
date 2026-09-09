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
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import { treacheryDeck } from '../game/cards';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import {
  homeworldForceGroups,
  type HomeworldForces,
} from '../game/homeworld-custody';
import { createTechTokens } from '../game/tech-tokens';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

function inventory(g: Game) {
  homeworldGameIntegrity(g);
  const groups = homeworldForceGroups(
    homeworldContext(g),
    g.homeworlds!.custody!,
  );
  for (const p of g.players) {
    const visitors = groups
      .filter((w) => w.native !== p.id)
      .map((w) => w.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(
      p.reserves +
        p.tanks +
        sum(p.forces) +
        visitors.reduce((n, f) => n + f.normal + f.elite, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          sum(p.elites.forces) +
          visitors.reduce((n, f) => n + f.elite, 0),
        p.faction === 'emperor' ? 5 : p.faction === 'fremen' ? 3 : 7,
      );
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((seat) => seat.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
    }
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(cards.length, treacheryDeck(g.expansions).length);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}

function movement(g: Game, actor: string) {
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: actor,
    order: g.players.map((p) => p.id),
    movementRemaining: [
      actor,
      ...g.players.filter((p) => p.id !== actor).map((p) => p.id),
    ],
    ready: [],
    storm: 18,
  });
  for (const p of g.players) {
    p.shipped = false;
    p.moved = 0;
  }
  return g;
}

// Actual audit setup and physical deals. Shipment opportunities are staged,
// with printed Guild forces in Tuek’s Sietch. Every off-board transfer is real.
function fixture(
  roster: FactionId[] = ['guild', 'emperor', 'atreides'],
  advanced = false,
) {
  let g = createGame(
    'GUILDWORLDENGINE',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
    roster.some((f) => f === 'ixians' || f === 'tleilaxu') ? ['ix'] : [],
  );
  for (const faction of roster.slice(1))
    joinGame(g, newPlayer(faction, faction, faction));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((owner) => owner.id === p.id)!.bot = 'Easy';
      const command = botActions(view)[0];
      if (command) {
        next = applyAction(g, p.id, command);
        break;
      }
    }
    assert.ok(next, 'Genuine setup offers a legal decision.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  g = movement(g, roster[0]);
  inventory(g);
  return g;
}

function shipment(
  g: Game,
  actor: string,
  destination: string,
  sources: Record<string, HomeworldForces>,
  extra: Record<string, unknown> = {},
): Action {
  return {
    type: 'guildHomeworldShip',
    event: viewGame(g, actor).guildHomeworldShipment!.event,
    destination,
    sources,
    ...extra,
  };
}
function rejects(g: Game, actor: string, command: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, command));
  assert.deepEqual(g, before);
}
function karama(g: Game) {
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, 'guild').hand.push(card);
  return card;
}

function printedShipment(g: Game, destination = 'homeworld:atreides', n = 3) {
  return shipment(g, 'guild', destination, {
    'tueks_sietch:5': { normal: n, elite: 0 },
  });
}

void test('printed Guild army reaches foreign Homeworld battle through Basic and Advanced actions', () => {
  for (const advanced of [false, true]) {
    let g = fixture(undefined, advanced);
    assert.equal(player(g, 'guild').forces['tueks_sietch:5'], 5);
    const original = structuredClone(g);
    const command = printedShipment(g);
    g = applyAction(g, 'guild', command);
    assert.equal(player(g, 'guild').forces['tueks_sietch:5'], 2);
    assert.equal(player(g, 'guild').reserves, 15);
    assert.equal(player(g, 'guild').spice, 3);
    assert.equal(player(g, 'guild').shipped, true);
    assert.equal(player(g, 'guild').moved, 0);
    assert.equal(
      g.decision,
      null,
      'No physical Karama means automatic permission.',
    );
    assert.equal(g.pendingHomeworldShipment, null);
    assert.deepEqual(
      g.homeworlds!.custody!.visitors['homeworld:atreides'].guild,
      { normal: 3, elite: 0 },
    );
    assert.deepEqual(original.homeworlds!.custody!.visitors, {});
    assert.ok(
      Object.keys(player(g, 'guild').forces).every(
        (k) => !k.startsWith('homeworld:'),
      ),
    );
    rejects(reload(g), 'guild', command);
    for (const actor of ['guild', 'emperor', 'atreides'])
      g = applyAction(g, actor, { type: 'endMovement' });
    if (g.phaseOpening) g = normalizeAutomaticGame(g);
    assert.equal(g.phase, 6);
    assert.ok(
      viewGame(g, 'guild').battleChoices.some(
        (b) => b.territory === 'homeworld:atreides',
      ),
    );
    inventory(g);
  }
});

void test('Guild native Junction return restores actual reserves at odd and even prices without Heighliner income', () => {
  for (const advanced of [false, true])
    for (const amount of [1, 2, 3, 4, 5]) {
      let g = fixture(undefined, advanced);
      g.techTokens = createTechTokens(g.players);
      g.techTokens.heighliners.owner = 'atreides';
      const technology = structuredClone(g.techTokens);
      const before = player(g, 'guild').spice;
      g = applyAction(
        g,
        'guild',
        printedShipment(g, 'homeworld:guild', amount),
      );
      assert.equal(player(g, 'guild').spice, before - Math.ceil(amount / 2));
      assert.equal(player(g, 'guild').reserves, 15 + amount);
      assert.equal(sum(player(g, 'guild').forces), 5 - amount);
      assert.equal(
        g.homeworlds!.custody!.visitors['homeworld:guild'],
        undefined,
      );
      assert.deepEqual(g.techTokens, technology);
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      inventory(g);
    }
});

void test('Guild own invasion also preserves the Heighliner Guild-only exception', () => {
  let g = fixture();
  g.techTokens = createTechTokens(g.players);
  g.techTokens.heighliners.owner = 'atreides';
  const before = structuredClone(g.techTokens);
  g = applyAction(g, 'guild', printedShipment(g));
  assert.deepEqual(g.techTokens, before);
  inventory(g);
});

void test('actual self-interception holds original force and funding custody until one allow or stop', () => {
  for (const stop of [false, true]) {
    let g = fixture(undefined, true);
    player(g, 'guild').ally = 'emperor';
    player(g, 'emperor').ally = 'guild';
    g = applyAction(g, 'emperor', { type: 'pledgeAid', amount: 2 });
    const card = karama(g);
    const before = structuredClone(g);
    const command = {
      ...printedShipment(g, 'homeworld:atreides', 5),
      allyPayment: 2,
    };
    g = applyAction(g, 'guild', command);
    assert.equal(g.pendingHomeworldShipment?.route, 'arrakis');
    assert.equal(g.decision?.kind, 'homeworldShipmentGuild');
    assert.equal(g.decision?.player, 'guild');
    assert.equal(g.pendingHomeworldShipment?.cost, 3);
    assert.deepEqual(g.players, before.players);
    assert.deepEqual(g.homeworlds, before.homeworlds);
    assert.deepEqual(g.aid, before.aid);
    const event = g.pendingHomeworldShipment!.event;
    rejects(g, 'emperor', { type: 'decision', allow: true, event });
    rejects(g, 'guild', { type: 'decision', allow: true, event: 'old' });
    const decision: Action = stop
      ? { type: 'card', mode: 'special', card: card.id }
      : { type: 'decision', allow: true, event };
    inventory(g);
    g = applyAction(reload(g), 'guild', decision);
    assert.equal(
      player(g, 'guild').spice,
      stop ? 5 : 6,
      'Allowed: personal one-spice payment, then the independent two-spice donor receipt.',
    );
    assert.equal(g.aid.emperor.amount, stop ? 2 : 0);
    assert.equal(sum(player(g, 'guild').forces), stop ? 5 : 0);
    assert.equal(player(g, 'guild').reserves, 15);
    assert.equal(player(g, 'guild').shipped, true);
    assert.equal(player(g, 'guild').moved, 0);
    assert.equal(g.pendingHomeworldShipment, null);
    assert.equal(g.decision, null);
    assert.equal(
      g.discard.filter((c) => c.id === card.id).length,
      stop ? 1 : 0,
    );
    rejects(g, 'guild', decision);
    inventory(g);
  }
});

void test('selected storm source is forbidden but an unselected sector does not block combined shipment', () => {
  let g = fixture();
  // Preserve all five printed Guild counters; stage a reachable later board
  // position split across Wind Pass sectors to isolate source-sector selection.
  player(g, 'guild').forces = {
    'wind_pass:14': 2,
    'wind_pass:15': 2,
    'wind_pass:16': 1,
  };
  g.storm = 16;
  inventory(g);
  rejects(
    g,
    'guild',
    shipment(g, 'guild', 'homeworld:guild', {
      'wind_pass:14': { normal: 2, elite: 0 },
      'wind_pass:16': { normal: 1, elite: 0 },
    }),
  );
  g = applyAction(
    g,
    'guild',
    shipment(g, 'guild', 'homeworld:guild', {
      'wind_pass:14': { normal: 2, elite: 0 },
      'wind_pass:15': { normal: 2, elite: 0 },
    }),
  );
  assert.deepEqual(player(g, 'guild').forces, { 'wind_pass:16': 1 });
  assert.equal(player(g, 'guild').reserves, 19);
  assert.equal(player(g, 'guild').spice, 3);
  inventory(g);
});

void test('non-Guild ally cannot acquire the Guild route and allied world arrivals reject immutably', () => {
  const g = fixture();
  player(g, 'guild').ally = 'atreides';
  player(g, 'atreides').ally = 'guild';
  rejects(g, 'guild', printedShipment(g));
  rejects(g, 'guild', {
    type: 'guildShip',
    from: 'tueks_sietch:5',
    amount: 3,
    territory: 'homeworld:atreides',
  });
  movement(g, 'atreides');
  assert.equal(viewGame(g, 'atreides').guildHomeworldShipment, null);
  rejects(g, 'atreides', {
    type: 'guildHomeworldShip',
    event: 'invented',
    destination: 'homeworld:emperor',
    sources: { 'arrakeen:10': { normal: 1, elite: 0 } },
  });
  rejects(g, 'atreides', {
    type: 'guildShip',
    from: 'arrakeen:10',
    amount: 1,
    territory: 'homeworld:emperor',
  });
  inventory(g);
});

void test('Guild can depart a protected mobile interior while its ordinary-board pointer is in storm', () => {
  let g = fixture(['guild', 'ixians', 'atreides']);
  assert.ok(
    g.mobileStronghold,
    'Ixian audit setup places the real mobile component.',
  );
  // Stage a later contested interior using the same five physical Guild
  // counters, leaving every Ixian setup counter and the component intact.
  player(g, 'guild').forces = { 'hidden_mobile_stronghold:0': 5 };
  g.mobileStronghold.location = 'wind_pass:14';
  g.storm = 14;
  inventory(g);
  g = applyAction(
    g,
    'guild',
    shipment(g, 'guild', 'homeworld:guild', {
      'hidden_mobile_stronghold:0': { normal: 3, elite: 0 },
    }),
  );
  assert.equal(player(g, 'guild').forces['hidden_mobile_stronghold:0'], 2);
  assert.equal(player(g, 'guild').reserves, 18);
  assert.equal(player(g, 'guild').spice, 3);
  assert.equal(g.mobileStronghold!.location, 'wind_pass:14');
  inventory(g);
});

void test('two physically valid territories cannot be combined by either Guild Homeworld API', () => {
  const g = fixture();
  // Stage the same five printed counters in two legal later source territories.
  player(g, 'guild').forces = { 'tueks_sietch:5': 2, 'wind_pass:14': 3 };
  inventory(g);
  rejects(
    g,
    'guild',
    shipment(g, 'guild', 'homeworld:guild', {
      'tueks_sietch:5': { normal: 2, elite: 0 },
      'wind_pass:14': { normal: 3, elite: 0 },
    }),
  );
  rejects(g, 'guild', {
    type: 'guildShip',
    territory: 'reserves',
    forces: { 'tueks_sietch:5': 2, 'wind_pass:14': 3 },
    amount: 5,
  });
});

void test('stale events, invented sectors, physical types and unavailable worlds reject before mutations', () => {
  const g = fixture();
  const command = printedShipment(g);
  for (const change of [
    { event: 'old' },
    { destination: 'homeworld:missing' },
    { destination: 'arrakeen' },
    { sources: { 'homeworld:guild': { normal: 1, elite: 0 } } },
    { sources: { 'tueks_sietch:05': { normal: 1, elite: 0 } } },
    { sources: { 'tueks_sietch:5': { normal: 1, elite: 1 } } },
    { sources: { 'tueks_sietch:5': { normal: 6, elite: 0 } } },
    { sources: { 'tueks_sietch:5': { normal: 0, elite: 0 } } },
    { sources: { 'tueks_sietch:5': { normal: 1, elite: 0, hidden: 1 } } },
    { sector: 0 },
    { noField: 0 },
    { advisors: true },
    { allyPayment: 1 },
  ])
    rejects(g, 'guild', { ...command, ...change });
  const stale = reload(g);
  stale.storm = 17;
  rejects(stale, 'guild', command);
  const covered = reload(g);
  covered.storm = 5;
  rejects(covered, 'guild', printedShipment(covered));
  const moved = reload(g);
  moved.phase = 6;
  rejects(moved, 'guild', command);
  inventory(g);
});

void test('legacy native-return and foreign-world adapters share real pending custody and price boundaries', () => {
  for (const destination of ['reserves', 'homeworld:atreides']) {
    let g = fixture(undefined, true);
    karama(g);
    const command: Action = {
      type: 'guildShip',
      from: 'tueks_sietch:5',
      amount: 3,
      territory: destination,
      sector: 0,
    };
    g = applyAction(g, 'guild', command);
    assert.equal(g.pendingHomeworldShipment?.route, 'arrakis');
    assert.equal(g.pendingHomeworldShipment?.cost, 2);
    assert.equal(player(g, 'guild').spice, 5);
    assert.equal(player(g, 'guild').reserves, 15);
    g = applyAction(reload(g), 'guild', {
      type: 'decision',
      allow: true,
      event: g.pendingHomeworldShipment!.event,
    });
    assert.equal(
      player(g, 'guild').reserves,
      destination === 'reserves' ? 18 : 15,
    );
    assert.equal(player(g, 'guild').spice, 3);
    assert.equal(player(g, 'guild').forces['tueks_sietch:5'], 2);
    rejects(g, 'guild', command);
    inventory(g);
  }
  const g = fixture();
  for (const extra of [
    { sector: 5 },
    { noField: 0 },
    { territory: 'homeworld:missing' },
  ])
    rejects(g, 'guild', {
      type: 'guildShip',
      from: 'tueks_sietch:5',
      amount: 2,
      territory: 'reserves',
      ...extra,
    });
});
