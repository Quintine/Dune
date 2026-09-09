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
// with printed faction positions. Every off-board transfer is real.
function fixture(
  roster: FactionId[] = ['guild', 'emperor', 'atreides'],
  advanced = false,
) {
  let g = createGame(
    'JUNCTIONENGINE',
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

function offer(g: Game, rate: 'half' | 'full' = 'half') {
  const view = viewGame(g, 'guild').junctionTransport!;
  assert.equal(view.canOffer, true);
  return applyAction(g, 'guild', {
    type: 'offerJunctionTransport',
    event: view.offerEvent,
    rate,
  });
}
function shipment(
  g: Game,
  actor: string,
  destination: string,
  sources: Record<string, HomeworldForces>,
  extra: Record<string, unknown> = {},
): Action {
  const view = viewGame(g, actor).junctionTransport!;
  return {
    type: 'junctionShip',
    event: view.event,
    offer: view.offer!.event,
    destination,
    sources,
    ...extra,
  };
}
function rejects(g: Game, actor: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
function karama(g: Game) {
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, 'guild').hand.push(card);
  return card;
}
const arrakeen = { 'arrakeen:10': { normal: 3, elite: 0 } };

void test('Junction permits actual printed Atreides army to return home in Basic and Advanced without a Karama stop', () => {
  for (const advanced of [false, true])
    for (const rate of ['half', 'full'] as const) {
      let g = movement(fixture(undefined, advanced), 'atreides');
      const card = karama(g);
      const original = structuredClone(g);
      g = offer(g, rate);
      assert.deepEqual(
        g.players,
        original.players,
        'Offering does not spend or move counters.',
      );
      assert.equal(g.decision, null);
      const action = shipment(g, 'atreides', 'homeworld:atreides', arrakeen);
      g = applyAction(reload(g), 'atreides', action);
      assert.equal(player(g, 'atreides').reserves, 13);
      assert.equal(player(g, 'atreides').forces['arrakeen:10'], 7);
      assert.equal(player(g, 'atreides').spice, 10 - (rate === 'half' ? 2 : 3));
      assert.equal(
        player(g, 'guild').spice,
        5,
        'A sponsored return pays the bank.',
      );
      assert.equal(player(g, 'atreides').shipped, true);
      assert.equal(player(g, 'atreides').moved, 0);
      assert.equal(g.pendingHomeworldShipment ?? null, null);
      assert.equal(g.decision, null);
      assert.ok(player(g, 'guild').hand.some((c) => c.id === card.id));
      assert.equal(
        g.discard.some((c) => c.id === card.id),
        false,
      );
      rejects(g, 'atreides', action);
      inventory(g);
    }
});

void test('Junction replaces an offer without consuming shipment and rejects its obsolete acceptance', () => {
  let g = movement(fixture(), 'atreides');
  g = offer(g);
  const old = shipment(g, 'atreides', 'homeworld:atreides', arrakeen);
  g = offer(reload(g), 'full');
  rejects(g, 'atreides', old);
  assert.equal(player(g, 'atreides').shipped, false);
  g = applyAction(
    g,
    'atreides',
    shipment(g, 'atreides', 'homeworld:atreides', arrakeen),
  );
  assert.equal(player(g, 'atreides').spice, 7);
  inventory(g);
});

void test('Junction grant authority, rate and recipient are enforced before mutation', () => {
  let g = movement(fixture(), 'atreides');
  const view = viewGame(g, 'guild').junctionTransport!;
  const proposal = {
    type: 'offerJunctionTransport',
    event: view.offerEvent,
    rate: 'half',
  };
  rejects(g, 'atreides', proposal);
  rejects(g, 'guild', { ...proposal, rate: 'free' });
  rejects(g, 'guild', { ...proposal, event: 'obsolete' });
  rejects(g, 'atreides', {
    type: 'junctionShip',
    event: view.event,
    offer: 'absent',
    destination: 'homeworld:atreides',
    sources: arrakeen,
  });
  g = offer(g);
  rejects(
    g,
    'emperor',
    shipment(g, 'atreides', 'homeworld:atreides', arrakeen),
  );
  inventory(g);
});

void test('Junction rejects stale opportunity, low sponsor, and changed physical source even with a former grant', () => {
  const original = offer(movement(fixture(), 'atreides'));
  const action = shipment(original, 'atreides', 'homeworld:atreides', arrakeen);
  for (const mutate of [
    (g: Game) => {
      g.turn++;
    },
    (g: Game) => {
      g.active = 'emperor';
    },
    (g: Game) => {
      player(g, 'atreides').shipped = true;
    },
    (g: Game) => {
      player(g, 'atreides').forces['arrakeen:10']--;
      player(g, 'atreides').forces['wind_pass:14'] = 1;
    },
    (g: Game) => {
      player(g, 'guild').reserves -= 11;
      player(g, 'guild').forces['tueks_sietch:5'] += 11;
    },
  ]) {
    const g = reload(original);
    mutate(g);
    rejects(g, 'atreides', action);
  }
});

void test('Junction validates exact counts, sectors, allies and affordability without spending the offer', () => {
  let g = offer(movement(fixture(), 'atreides'));
  const invalid = [
    shipment(g, 'atreides', 'homeworld:atreides', {
      'arrakeen:10': { normal: 11, elite: 0 },
    }),
    shipment(g, 'atreides', 'homeworld:atreides', {
      'arrakeen:010': { normal: 3, elite: 0 },
    }),
    shipment(g, 'atreides', 'homeworld:atreides', {
      'arrakeen:10': { normal: 1, elite: 1 },
    }),
    shipment(g, 'atreides', 'homeworld:atreides', arrakeen, { rate: 'free' }),
    shipment(g, 'atreides', 'homeworld:atreides', arrakeen, { allyPayment: 1 }),
  ];
  for (const action of invalid) rejects(g, 'atreides', action);
  const storm = reload(g);
  storm.storm = 10;
  rejects(
    storm,
    'atreides',
    shipment(storm, 'atreides', 'homeworld:atreides', arrakeen),
  );
  const poor = reload(g);
  player(poor, 'atreides').spice = 1;
  rejects(
    poor,
    'atreides',
    shipment(poor, 'atreides', 'homeworld:atreides', arrakeen),
  );
  player(g, 'atreides').ally = 'emperor';
  player(g, 'emperor').ally = 'atreides';
  g = offer(g);
  rejects(
    g,
    'atreides',
    shipment(g, 'atreides', 'homeworld:emperor', arrakeen),
  );
  inventory(g);
});

void test('Junction foreign garrison escapes through actual invasion then returns to Arrakis without reserve disguise', () => {
  let g = movement(fixture(), 'atreides');
  g = applyAction(g, 'atreides', {
    type: 'homeworldShip',
    event: viewGame(g, 'atreides').homeworldShipment!.event,
    destination: 'homeworld:emperor',
    sources: { 'homeworld:atreides': { normal: 3, elite: 0 } },
  });
  assert.equal(player(g, 'atreides').reserves, 7);
  g = offer(movement(g, 'atreides'));
  const beforeSpice = player(g, 'atreides').spice;
  g = applyAction(
    reload(g),
    'atreides',
    shipment(g, 'atreides', 'arrakeen:10', {
      'homeworld:emperor': { normal: 3, elite: 0 },
    }),
  );
  assert.equal(player(g, 'atreides').reserves, 7);
  assert.equal(player(g, 'atreides').forces['arrakeen:10'], 13);
  assert.equal(player(g, 'atreides').spice, beforeSpice - 2);
  assert.equal(player(g, 'guild').spice, 5);
  assert.equal(
    g.homeworlds!.custody!.visitors['homeworld:emperor']?.atreides,
    undefined,
  );
  inventory(g);
});

void test('Junction cross-board delivery pays destination tariff and preserves available movement', () => {
  let g = offer(movement(fixture(), 'atreides'));
  g = applyAction(
    g,
    'atreides',
    shipment(g, 'atreides', 'wind_pass:14', arrakeen),
  );
  assert.equal(player(g, 'atreides').forces['wind_pass:14'], 3);
  assert.equal(player(g, 'atreides').forces['arrakeen:10'], 7);
  assert.equal(
    player(g, 'atreides').spice,
    7,
    'Three desert arrivals at half of six spice.',
  );
  assert.equal(player(g, 'guild').spice, 5);
  assert.equal(player(g, 'atreides').moved, 0);
  inventory(g);
});

void test('Junction donor funding is separate from sponsorship and cannot circularly finance payment', () => {
  for (const donor of ['emperor', 'guild']) {
    let g = movement(fixture(), 'atreides');
    player(g, 'atreides').ally = donor;
    player(g, donor).ally = 'atreides';
    player(g, 'atreides').spice = 1;
    g = applyAction(g, donor, { type: 'pledgeAid', amount: 2 });
    g = offer(g, 'full');
    g = applyAction(
      g,
      'atreides',
      shipment(g, 'atreides', 'homeworld:atreides', arrakeen, {
        allyPayment: 2,
      }),
    );
    assert.equal(player(g, 'atreides').spice, 0);
    if (g.response) g = normalizeAutomaticGame(g);
    assert.equal(player(g, donor).spice, donor === 'emperor' ? 8 : 3);
    assert.equal(player(g, 'guild').spice, donor === 'emperor' ? 7 : 3);
    inventory(g);
  }
});

void test('Junction native-world arrival activates Heighliner once and a paid Fremen return is not free reinforcement', () => {
  let g = movement(fixture(['guild', 'fremen', 'atreides'], true), 'fremen');
  g.techTokens = createTechTokens(g.players);
  g.techTokens.heighliners.owner = 'atreides';
  const source = Object.keys(player(g, 'fremen').forces).find(
    (key) => player(g, 'fremen').forces[key] >= 2,
  )!;
  assert.ok(source);
  const elite = Math.min(1, player(g, 'fremen').elites?.forces[source] ?? 0);
  const originalSpice = player(g, 'fremen').spice;
  const originalReserves = player(g, 'fremen').reserves;
  g = offer(g);
  g = applyAction(
    g,
    'fremen',
    shipment(g, 'fremen', 'homeworld:fremen', {
      [source]: { normal: 2 - elite, elite },
    }),
  );
  assert.equal(player(g, 'fremen').spice, originalSpice - 1);
  assert.equal(player(g, 'fremen').reserves, originalReserves + 2);
  assert.equal(g.techTokens!.heighliners.triggeredTurn, g.turn);
  assert.equal(g.techTokens!.heighliners.spice, 1);
  inventory(g);
});

void test('Junction preserves mixed Emperor custody through combined native invasion and typed native return', () => {
  let g = offer(movement(fixture(undefined, true), 'emperor'));
  g = applyAction(
    g,
    'emperor',
    shipment(g, 'emperor', 'homeworld:atreides', {
      'homeworld:emperor': { normal: 2, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 1 },
    }),
  );
  assert.equal(player(g, 'emperor').reserves, 17);
  assert.equal(player(g, 'emperor').elites!.reserves, 4);
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:atreides'].emperor,
    { normal: 2, elite: 1 },
  );
  inventory(g);
  g = offer(movement(g, 'emperor'));
  g = applyAction(
    reload(g),
    'emperor',
    shipment(g, 'emperor', 'homeworld:emperor:salusa', {
      'homeworld:atreides': { normal: 1, elite: 1 },
    }),
  );
  assert.equal(player(g, 'emperor').reserves, 19);
  assert.equal(player(g, 'emperor').elites!.reserves, 5);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 1, elite: 5 });
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:atreides'].emperor,
    { normal: 1, elite: 0 },
  );
  assert.equal(player(g, 'emperor').spice, 7);
  inventory(g);
});

void test('Junction ordinary native reserve arrival retains Guild income while native Homeworld return does not', () => {
  let g = offer(movement(fixture(), 'atreides'));
  g = applyAction(
    g,
    'atreides',
    shipment(g, 'atreides', 'arrakeen:10', {
      'homeworld:atreides': { normal: 3, elite: 0 },
    }),
  );
  if (g.response) g = normalizeAutomaticGame(g);
  assert.equal(player(g, 'atreides').spice, 8);
  assert.equal(player(g, 'guild').spice, 7);
  assert.equal(player(g, 'atreides').reserves, 7);
  assert.equal(player(g, 'atreides').forces['arrakeen:10'], 13);
  inventory(g);
});
