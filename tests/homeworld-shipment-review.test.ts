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
} from '../game/engine';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';

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

function karama(g: Game) {
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, 'guild').hand.push(card);
  return card;
}

function waiting() {
  const g = fixture(['emperor', 'guild', 'atreides'], true);
  karama(g);
  return applyAction(g, 'emperor', {
    type: 'homeworldShip',
    event: viewGame(g, 'emperor').homeworldShipment!.event,
    destination: 'homeworld:atreides',
    sources: { 'homeworld:emperor': { normal: 3, elite: 0 } },
  });
}

void test('a real optional Guild interception remains actionable instead of globally disabling human controls as automatic', () => {
  const g = waiting();
  assert.equal(g.decision?.kind, 'homeworldShipmentGuild');
  for (const seat of g.players) {
    const view = viewGame(g, seat.id);
    assert.equal(
      view.automaticContinuationPending,
      false,
      'GameTable includes this public flag in every action button’s busy state.',
    );
  }
  const allowed = applyAction(g, 'guild', {
    type: 'decision',
    event: g.pendingHomeworldShipment!.event,
    allow: true,
  });
  assert.equal(allowed.pendingHomeworldShipment, null);
  assert.equal(player(allowed, 'emperor').shipped, true);
});

void test('read-only normalization preserves a waiting optional interception and returns a detached game', () => {
  const g = waiting();
  const before = structuredClone(g);
  const normalized = normalizeAutomaticGame(g);
  assert.deepEqual(normalized, before);
  assert.deepEqual(g, before);
  assert.notEqual(normalized, g);
  normalized.pendingHomeworldShipment!.pools[0].before.normal = 0;
  normalized.players[0].spice = 0;
  assert.deepEqual(g, before);
});

void test('an old zero-card interception exposes automatic recovery and normalizes payment without mutating its input', () => {
  const g = waiting();
  g.deck.push(...player(g, 'guild').hand.splice(0));
  const before = structuredClone(g);
  assert.equal(viewGame(g, 'guild').automaticContinuationPending, true);
  const normalized = normalizeAutomaticGame(g);
  assert.equal(normalized.pendingHomeworldShipment, null);
  assert.equal(normalized.decision, null);
  assert.equal(
    player(normalized, 'emperor').spice,
    player(g, 'emperor').spice - 3,
  );
  assert.equal(
    player(normalized, 'emperor').reserves,
    player(g, 'emperor').reserves - 3,
  );
  assert.deepEqual(g, before);
  assert.deepEqual(normalizeAutomaticGame(normalized), normalized);
});
