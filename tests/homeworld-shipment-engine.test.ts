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
import { baseDeck } from '../game/cards';
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
  assert.equal(cards.length, baseDeck().length);
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

// Actual audit setup and physical deals. Only the phase opportunity is staged;
// every invasion below uses the real action rather than preplaced invaders.
function fixture(
  roster: FactionId[] = ['emperor', 'atreides'],
  advanced = false,
) {
  let g = createGame(
    'HOMEWORLDSHIPMENTENGINE',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
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
    type: 'homeworldShip',
    event: viewGame(g, actor).homeworldShipment!.event,
    destination,
    sources,
    ...extra,
  };
}
function ordinary(g: Game, amount = 3): Action {
  return shipment(g, 'emperor', 'homeworld:atreides', {
    'homeworld:emperor': { normal: amount, elite: 0 },
  });
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

void test('real world shipment conserves forces, debits once and reaches the actual Homeworld battle frontier', () => {
  let g = fixture();
  const original = structuredClone(g);
  const command = ordinary(g);
  g = applyAction(g, 'emperor', command);
  assert.deepEqual(original.homeworlds!.custody!.visitors, {});
  assert.equal(player(g, 'emperor').reserves, 17);
  assert.equal(player(g, 'emperor').spice, 7);
  assert.equal(player(g, 'emperor').shipped, true);
  assert.equal(player(g, 'emperor').moved, 0);
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:atreides'].emperor,
    { normal: 3, elite: 0 },
  );
  rejects(reload(g), 'emperor', command);
  g = applyAction(g, 'emperor', { type: 'endMovement' });
  g = applyAction(g, 'atreides', { type: 'endMovement' });
  if (g.phaseOpening) g = normalizeAutomaticGame(g);
  assert.equal(g.phase, 6);
  assert.ok(
    viewGame(g, 'emperor').battleChoices.some(
      (b) => b.territory === 'homeworld:atreides',
    ),
  );
  inventory(g);
});

void test('Basic single-world and Advanced combined Emperor shipments preserve actual special identity', () => {
  for (const advanced of [false, true]) {
    const g = fixture(undefined, advanced);
    const sources: Record<string, HomeworldForces> = advanced
      ? {
          'homeworld:emperor': { normal: 2, elite: 0 },
          'homeworld:emperor:salusa': { normal: 0, elite: 2 },
        }
      : { 'homeworld:emperor': { normal: 2, elite: 2 } };
    const next = applyAction(
      g,
      'emperor',
      shipment(g, 'emperor', 'homeworld:atreides', sources),
    );
    assert.equal(player(next, 'emperor').reserves, 16);
    assert.equal(player(next, 'emperor').elites!.reserves, 3);
    assert.equal(player(next, 'emperor').spice, 6);
    assert.deepEqual(
      next.homeworlds!.custody!.visitors['homeworld:atreides'].emperor,
      { normal: 2, elite: 2 },
    );
    if (advanced)
      assert.deepEqual(next.homeworlds!.custody!.salusa, {
        normal: 0,
        elite: 3,
      });
    else assert.equal(next.homeworlds!.custody!.salusa, null);
    inventory(next);
  }
});

void test('paid Fremen invasion earns Heighliners once and creates no BG accompaniment', () => {
  let g = fixture(['fremen', 'atreides', 'beneGesserit', 'emperor']);
  // The setup audit currently prohibits tech-token setup. Stage only the three
  // canonical tokens and their valid ownership; actual force/card setup stays intact.
  g.techTokens = createTechTokens(g.players);
  g.techTokens.heighliners.owner = 'atreides';
  g.techTokens.axlotl.owner = 'emperor';
  const beforeBG = structuredClone(player(g, 'beneGesserit'));
  assert.equal(g.techTokens!.heighliners.owner, 'atreides');
  g = applyAction(
    g,
    'fremen',
    shipment(g, 'fremen', 'homeworld:atreides', {
      'homeworld:fremen': { normal: 2, elite: 0 },
    }),
  );
  assert.equal(player(g, 'fremen').spice, 1);
  assert.equal(g.techTokens!.heighliners.spice, 1);
  assert.equal(g.techTokens!.heighliners.triggeredTurn, g.turn);
  assert.deepEqual(player(g, 'beneGesserit'), beforeBG);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  const normalized = normalizeAutomaticGame(reload(g));
  assert.deepEqual(normalized, g);
  assert.equal(normalized.techTokens!.heighliners.spice, 1);
  inventory(g);
});

void test('a real previous invasion can depart its foreign source without withdrawing native reserves twice', () => {
  let g = fixture(['emperor', 'atreides', 'harkonnen']);
  g = applyAction(g, 'emperor', ordinary(g, 4));
  const reserves = player(g, 'emperor').reserves;
  // Next-turn movement positioning retains the previous action's conserved garrison.
  g.turn++;
  g = movement(g, 'emperor');
  g = applyAction(
    reload(g),
    'emperor',
    shipment(g, 'emperor', 'homeworld:harkonnen', {
      'homeworld:atreides': { normal: 3, elite: 0 },
    }),
  );
  assert.equal(player(g, 'emperor').reserves, reserves);
  assert.equal(player(g, 'emperor').spice, 3);
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:atreides'].emperor,
    { normal: 1, elite: 0 },
  );
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:harkonnen'].emperor,
    { normal: 3, elite: 0 },
  );
  inventory(g);
});

void test('Guild interception is owned, persists exact declared forces and can allow once or stop without payment', () => {
  for (const stop of [false, true]) {
    const g = fixture(['emperor', 'atreides', 'guild'], true);
    const card = karama(g);
    const original = structuredClone(g);
    let next = applyAction(g, 'emperor', ordinary(g));
    assert.equal(next.decision?.kind, 'homeworldShipmentGuild');
    assert.equal(next.decision?.player, 'guild');
    assert.deepEqual(next.homeworlds, original.homeworlds);
    assert.equal(player(next, 'emperor').spice, 10);
    const event = next.pendingHomeworldShipment!.event;
    rejects(next, 'emperor', { type: 'decision', allow: true, event });
    rejects(next, 'guild', { type: 'decision', allow: true, event: 'old' });
    const action: Action = stop
      ? { type: 'card', card: card.id, mode: 'special' }
      : { type: 'decision', allow: true, event };
    next = applyAction(reload(next), 'guild', action);
    assert.equal(player(next, 'emperor').spice, stop ? 10 : 7);
    assert.equal(player(next, 'emperor').reserves, stop ? 20 : 17);
    assert.equal(player(next, 'emperor').shipped, true);
    assert.equal(player(next, 'emperor').moved, 0);
    assert.equal(next.pendingHomeworldShipment, null);
    assert.equal(next.decision, null);
    assert.equal(
      next.discard.filter((c) => c.id === card.id).length,
      stop ? 1 : 0,
    );
    if (stop) assert.equal(player(next, 'guild').specialKaramaUsed, true);
    rejects(reload(next), 'guild', action);
    inventory(next);
  }
});

void test('a Guild without a usable Karama automatically permits invasion, including Fremen interplanetary shipment', () => {
  for (const actor of ['emperor', 'fremen'] as const) {
    let g = fixture([actor, 'atreides', 'guild'], true);
    const initial = player(g, actor).reserves;
    g = applyAction(
      g,
      actor,
      shipment(g, actor, 'homeworld:atreides', {
        [`homeworld:${actor}`]: { normal: 2, elite: 0 },
      }),
    );
    assert.equal(g.decision, null);
    assert.equal(g.pendingHomeworldShipment, null);
    assert.equal(player(g, actor).reserves, initial - 2);
    assert.equal(player(g, actor).spice, actor === 'fremen' ? 1 : 8);
    inventory(g);
  }
});

void test('malformed, stale, foreign-owned, own-world, ally-world and unavailable routes reject without effects', () => {
  const g = fixture();
  const command = ordinary(g);
  rejects(g, 'atreides', command);
  for (const change of [
    { event: 'old' },
    { destination: 'homeworld:emperor' },
    { destination: 'arrakeen' },
    { sources: { 'homeworld:atreides': { normal: 1, elite: 0 } } },
    { sources: { 'homeworld:emperor': { normal: -1, elite: 0 } } },
    { sources: { 'homeworld:emperor': { normal: 1, elite: 0, hidden: 1 } } },
    { sources: { 'homeworld:emperor': { normal: 11, elite: 0 } } },
    { sector: 0 },
    { advisors: true },
    { allyPayment: 1 },
  ])
    rejects(g, 'emperor', { ...command, ...change });
  const allied = reload(g);
  player(allied, 'emperor').ally = 'atreides';
  player(allied, 'atreides').ally = 'emperor';
  rejects(allied, 'emperor', ordinary(allied));
  const wrongPhase = reload(g);
  wrongPhase.phase = 4;
  rejects(wrongPhase, 'emperor', command);
  const changedSource = applyAction(g, 'emperor', ordinary(g, 1));
  changedSource.turn++;
  movement(changedSource, 'emperor');
  rejects(changedSource, 'emperor', command);
  inventory(g);
});

void test('invasion funding routes only the non-Guild donor share to Guild, including Guild as shipper', () => {
  for (const direction of ['otherFunds', 'guildFunds', 'guildShips'] as const) {
    let g = fixture(['emperor', 'atreides', 'guild', 'harkonnen']);
    const actor = direction === 'guildShips' ? 'guild' : 'emperor';
    const donor = direction === 'guildFunds' ? 'guild' : 'harkonnen';
    player(g, actor).ally = donor;
    player(g, donor).ally = actor;
    movement(g, actor);
    g = applyAction(g, donor, { type: 'pledgeAid', amount: 2 });
    const beforeGuild = player(g, 'guild').spice;
    const beforeActor = player(g, actor).spice;
    const cost = direction === 'guildShips' ? 3 : 5;
    g = applyAction(
      g,
      actor,
      shipment(
        g,
        actor,
        'homeworld:atreides',
        { [`homeworld:${actor}`]: { normal: 5, elite: 0 } },
        { allyPayment: 2 },
      ),
    );
    assert.equal(
      g.response,
      null,
      'No physical cancel card means income settles automatically.',
    );
    assert.equal(g.aid[donor].amount, 0);
    assert.equal(
      player(g, 'guild').spice,
      beforeGuild +
        (direction === 'guildFunds' ? 0 : 2) -
        (actor === 'guild' ? cost - 2 : 0),
    );
    if (actor !== 'guild')
      assert.equal(player(g, actor).spice, beforeActor - cost + 2);
    inventory(g);
  }
});

void test('actual invasion blocks later Nexus alliances in either direction while unrelated alliances remain legal', () => {
  let g = fixture(['emperor', 'atreides', 'harkonnen', 'guild']);
  g = applyAction(g, 'emperor', ordinary(g));
  Object.assign(g, {
    phase: 1,
    nexus: true,
    spiceWindow: null,
    spiceResolution: null,
    phaseOpening: null,
    ready: [],
  });
  rejects(g, 'emperor', { type: 'alliance', target: 'atreides' });
  rejects(g, 'atreides', { type: 'alliance', target: 'emperor' });
  g = applyAction(g, 'harkonnen', { type: 'alliance', target: 'guild' });
  g = applyAction(reload(g), 'guild', {
    type: 'alliance',
    target: 'harkonnen',
  });
  assert.equal(player(g, 'harkonnen').ally, 'guild');
  assert.equal(player(g, 'guild').ally, 'harkonnen');
  inventory(g);
  const corrupt = reload(g);
  player(corrupt, 'emperor').ally = 'atreides';
  player(corrupt, 'atreides').ally = 'emperor';
  const before = structuredClone(corrupt);
  for (const p of corrupt.players) assert.throws(() => viewGame(corrupt, p.id));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  rejects(corrupt, 'emperor', { type: 'alliance', target: null });
  assert.deepEqual(corrupt, before);
});

void test('Guild returns an actual foreign garrison to Junction at its rounded rate without creating reserves', () => {
  let g = fixture(['guild', 'atreides'], true);
  g = applyAction(
    g,
    'guild',
    shipment(g, 'guild', 'homeworld:atreides', {
      'homeworld:guild': { normal: 3, elite: 0 },
    }),
  );
  assert.equal(player(g, 'guild').reserves, 12);
  assert.equal(player(g, 'guild').spice, 3);
  g.turn++;
  movement(g, 'guild');
  g = applyAction(
    reload(g),
    'guild',
    shipment(g, 'guild', 'homeworld:guild', {
      'homeworld:atreides': { normal: 3, elite: 0 },
    }),
  );
  assert.equal(player(g, 'guild').reserves, 15);
  assert.equal(player(g, 'guild').spice, 1);
  assert.equal(
    g.homeworlds!.custody!.visitors['homeworld:atreides'],
    undefined,
  );
  inventory(g);
});

void test('saved invasion receipts reject mismatched pools, price, event and Guild decision without mutation', () => {
  const g = fixture(['emperor', 'atreides', 'guild'], true);
  karama(g);
  const pending = applyAction(g, 'emperor', ordinary(g));
  for (const mutate of [
    (state: Game) => {
      state.pendingHomeworldShipment!.cost++;
    },
    (state: Game) => {
      state.pendingHomeworldShipment!.elite++;
    },
    (state: Game) => {
      state.pendingHomeworldShipment!.turn++;
    },
    (state: Game) => {
      state.pendingHomeworldShipment!.event = 'stale';
    },
    (state: Game) => {
      state.pendingHomeworldShipment!.sources['homeworld:emperor'].normal--;
    },
    (state: Game) => {
      state.pendingHomeworldShipment!.pools[0].before.normal--;
    },
    (state: Game) => {
      if (state.decision?.kind === 'homeworldShipmentGuild')
        state.decision.amount++;
    },
    (state: Game) => {
      state.pendingHomeworldShipment = null;
    },
    (state: Game) => {
      state.decision = null;
    },
  ]) {
    const invalid = reload(pending);
    mutate(invalid);
    const before = structuredClone(invalid);
    for (const p of invalid.players)
      assert.throws(() => viewGame(invalid, p.id));
    assert.throws(() => normalizeAutomaticGame(invalid));
    rejects(invalid, 'guild', {
      type: 'decision',
      allow: true,
      event: pending.pendingHomeworldShipment!.event,
    });
    assert.deepEqual(invalid, before);
  }
  inventory(pending);
});
