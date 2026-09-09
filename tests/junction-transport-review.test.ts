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
import { createTechTokens } from '../game/tech-tokens';
import { currentJunctionOffer } from '../game/junction-offer';
import { homeworldGameIntegrity } from '../game/homeworld-game';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(includeFremen = false) {
  let g = createGame(
    'JUNCTIONREVIEW',
    newPlayer('guild', 'Guild', 'guild'),
    true,
  );
  joinGame(g, newPlayer('atreides', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('beneGesserit', 'Bene Gesserit', 'beneGesserit'));
  if (includeFremen) joinGame(g, newPlayer('fremen', 'Fremen', 'fremen'));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((s) => s.id === p.id)!.bot = 'Easy';
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
    p.shipped = false;
    p.moved = 0;
  }
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'atreides',
    order: includeFremen
      ? ['atreides', 'beneGesserit', 'guild', 'fremen']
      : ['atreides', 'beneGesserit', 'guild'],
    movementRemaining: ['atreides', 'beneGesserit', 'guild'],
    ready: [],
    storm: 18,
  });
  homeworldGameIntegrity(g);
  return g;
}
function offered(g = fixture()) {
  return applyAction(g, 'guild', {
    type: 'offerJunctionTransport',
    rate: 'half',
    event: viewGame(g, 'guild').junctionTransport!.offerEvent,
  });
}
function command(g: Game): Action {
  const option = viewGame(g, g.active!).junctionTransport!;
  return {
    type: 'junctionShip',
    event: option.event,
    offer: option.offer!.event,
    destination: 'homeworld:guild',
    sources: { 'arrakeen:10': { normal: 1, elite: 0 } },
  };
}
function rejects(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

void test('Junction restored offer corruption rejects views, normalization and actions without repair', () => {
  const base = offered();
  const patches: unknown[] = [
    [],
    true,
    { ...base.junctionOffer!, rate: 'free' },
    { ...base.junctionOffer!, owner: 'atreides' },
    { ...base.junctionOffer!, recipient: 'guild' },
    { ...base.junctionOffer!, turn: base.turn + 1 },
    { ...base.junctionOffer!, turn: 1.5 },
    { ...base.junctionOffer!, event: 123 },
    { ...base.junctionOffer!, extra: 'hidden' },
  ];
  for (const patch of patches) {
    const g = structuredClone(base);
    g.junctionOffer = patch as Game['junctionOffer'];
    const before = structuredClone(g);
    for (const p of g.players) assert.throws(() => viewGame(g, p.id));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() => applyAction(g, 'guild', { type: 'pass' }));
    assert.deepEqual(g, before);
  }
});

void test('Junction proposal remains visible only in its original unused shipment opportunity', () => {
  const base = offered();
  const action = command(base);
  for (const alter of [
    (g: Game) => {
      player(g, 'atreides').shipped = true;
    },
    (g: Game) => {
      g.active = 'beneGesserit';
    },
    (g: Game) => {
      g.turn++;
    },
    (g: Game) => {
      g.phase = 6;
    },
  ]) {
    const g = structuredClone(base);
    alter(g);
    assert.equal(currentJunctionOffer(g), null);
    rejects(g, 'atreides', action);
  }
  const g = structuredClone(base);
  const guild = player(g, 'guild');
  guild.forces['tueks_sietch:5'] += guild.reserves - 4;
  guild.reserves = 4;
  homeworldGameIntegrity(g);
  assert.equal(currentJunctionOffer(g), null);
  rejects(g, 'atreides', action);
});

void test('Junction offer replacement invalidates recipient acceptance without spending counters or spice', () => {
  let g = offered();
  const stale = command(g);
  g = applyAction(g, 'guild', {
    type: 'offerJunctionTransport',
    rate: 'full',
    event: viewGame(g, 'guild').junctionTransport!.offerEvent,
  });
  rejects(g, 'atreides', stale);
  rejects(g, 'beneGesserit', command(g));
  g = applyAction(g, 'atreides', command(g));
  assert.equal(player(g, 'atreides').spice, 9);
  assert.equal(g.junctionOffer, null);
  assert.equal(player(g, 'atreides').forces['arrakeen:10'], 9);
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:guild'].atreides,
    { normal: 1, elite: 0 },
  );
  homeworldGameIntegrity(g);
});

void test('Junction public opportunity and selection tokens do not encode private hand or balance changes', () => {
  const g = offered();
  const before = viewGame(g, 'atreides').junctionTransport;
  const guild = player(g, 'guild');
  guild.hand.push(g.deck.pop()!);
  guild.spice += 7;
  const after = viewGame(g, 'atreides').junctionTransport;
  assert.equal(before!.event, after!.event);
  assert.equal(before!.offerEvent, after!.offerEvent);
  assert.equal(
    viewGame(g, 'atreides').players.find((p) => p.id === 'guild')!.hand,
    undefined,
  );
});

void test('Junction cross-transport preserves BG advisor locks and forbids merging into fighters that turn', () => {
  let g = fixture();
  g.active = 'beneGesserit';
  g.movementRemaining = ['beneGesserit', 'atreides', 'guild'];
  const bg = player(g, 'beneGesserit');
  bg.forces = { 'arrakeen:10': 2, 'tueks_sietch:5': 1 };
  bg.reserves = 17;
  bg.advisors = { arrakeen: { lockedTurn: g.turn } };
  homeworldGameIntegrity(g);
  g = offered(g);
  const option = viewGame(g, bg.id).junctionTransport!;
  const action: Action = {
    type: 'junctionShip',
    event: option.event,
    offer: option.offer!.event,
    destination: 'tueks_sietch:5',
    sources: { 'arrakeen:10': { normal: 1, elite: 0 } },
  };
  rejects(g, bg.id, action);
  player(g, bg.id).advisors!.tueks_sietch = {};
  const revised = viewGame(g, bg.id).junctionTransport!;
  g = applyAction(g, bg.id, { ...action, event: revised.event });
  assert.equal(player(g, bg.id).advisors!.tueks_sietch.lockedTurn, g.turn);
  assert.equal(player(g, bg.id).forces['tueks_sietch:5'], 2);
  homeworldGameIntegrity(g);
});

void test('Junction distinguishes native Fremen Arrakis arrival from a foreign Homeworld departure for BG and technology', () => {
  let native = fixture(true);
  native.active = 'fremen';
  native.movementRemaining = ['fremen', 'atreides', 'beneGesserit', 'guild'];
  native.techTokens = createTechTokens();
  native.techTokens.heighliners.owner = 'atreides';
  native = offered(native);
  let option = viewGame(native, 'fremen').junctionTransport!;
  const nativeBefore = player(native, 'fremen').reserves;
  native = applyAction(native, 'fremen', {
    type: 'junctionShip',
    event: option.event,
    offer: option.offer!.event,
    destination: 'wind_pass:14',
    sources: { 'homeworld:fremen': { normal: 1, elite: 0 } },
  });
  assert.equal(player(native, 'fremen').reserves, nativeBefore - 1);
  assert.equal(player(native, 'fremen').forces['wind_pass:14'], 1);
  assert.equal(
    native.decision,
    null,
    'Native Fremen reinforcement originates on Arrakis.',
  );
  assert.notEqual(native.techTokens!.heighliners.triggeredTurn, native.turn);
  homeworldGameIntegrity(native);

  let foreign = fixture(true);
  foreign.active = 'fremen';
  foreign.movementRemaining = ['fremen', 'atreides', 'beneGesserit', 'guild'];
  foreign = offered(foreign);
  option = viewGame(foreign, 'fremen').junctionTransport!;
  foreign = applyAction(foreign, 'fremen', {
    type: 'junctionShip',
    event: option.event,
    offer: option.offer!.event,
    destination: 'homeworld:guild',
    sources: { 'homeworld:fremen': { normal: 1, elite: 0 } },
  });
  // Stage the next shipment opportunity; foreign custody came from an actual transport.
  player(foreign, 'fremen').shipped = false;
  foreign.techTokens = createTechTokens();
  foreign.techTokens.heighliners.owner = 'atreides';
  foreign = offered(foreign);
  option = viewGame(foreign, 'fremen').junctionTransport!;
  const foreignNativeBefore = player(foreign, 'fremen').reserves;
  foreign = applyAction(foreign, 'fremen', {
    type: 'junctionShip',
    event: option.event,
    offer: option.offer!.event,
    destination: 'wind_pass:14',
    sources: { 'homeworld:guild': { normal: 1, elite: 0 } },
  });
  assert.equal(player(foreign, 'fremen').reserves, foreignNativeBefore);
  assert.equal(player(foreign, 'fremen').forces['wind_pass:14'], 1);
  assert.equal(
    foreign.homeworlds!.custody!.visitors['homeworld:guild'],
    undefined,
  );
  assert.equal(foreign.techTokens!.heighliners.triggeredTurn, foreign.turn);
  assert.equal(foreign.techTokens!.heighliners.spice, 1);
  assert.deepEqual(foreign.decision, {
    kind: 'advisor',
    player: 'beneGesserit',
    shipment: 'fremen',
    destination: 'wind_pass:14',
  });
  homeworldGameIntegrity(foreign);
  const restored: Game = JSON.parse(JSON.stringify(foreign));
  assert.deepEqual(
    viewGame(restored, 'beneGesserit').decision,
    viewGame(foreign, 'beneGesserit').decision,
  );
});
