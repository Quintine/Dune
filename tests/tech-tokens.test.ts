import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { TECH_TOKENS, createTechTokens, ownedTech } from '../game/tech-tokens';
import { baseDeck } from '../game/cards';
import { type FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
/** Transfer fixture cards from the actual deck; never duplicate another seat's hand. */
function setBattleHand(g: Game, id: string, ids: string[]) {
  const owner = g.players.find((p) => p.id === id)!;
  g.deck.push(...owner.hand);
  owner.hand = [];
  owner.hand = ids.map((cardId) => {
    assert.ok(
      !g.players.some((p) => p.hand.some((card) => card.id === cardId)),
      `Fixture card ${cardId} is already held by another seat`,
    );
    const index = g.deck.findIndex((card) => card.id === cardId);
    assert.ok(
      index >= 0,
      `Physical fixture card ${cardId} must be in the deck`,
    );
    return g.deck.splice(index, 1)[0];
  });
}
function table(factions: FactionId[] = ['emperor', 'harkonnen', 'guild']) {
  const ids = ['e', 'h', 'g', 'x'];
  let g = createGame('TECHTOK2', newPlayer('e', 'Host', factions[0]));
  factions.slice(1).forEach((f, i) => joinGame(g, newPlayer(ids[i + 1], f, f)));
  g = applyAction(g, 'e', { type: 'techTokens', enabled: true });
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'e', { type: 'start' });
  const bg = g.players.find((p) => p.faction === 'beneGesserit');
  if (bg)
    g = applyAction(g, bg.id, {
      type: 'predict',
      faction: 'emperor',
      turn: 3,
    });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  const fremen = g.players.find((p) => p.faction === 'fremen');
  if (fremen)
    g = applyAction(g, fremen.id, {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
  assert.equal(g.status, 'playing');
  return g;
}
function fixture(factions?: FactionId[]) {
  const g = table(factions);
  g.phase = 2;
  g.order = g.players.map((p) => p.id);
  g.storm = 18;
  g.players.forEach((p) => {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [];
  });
  g.techTokens = createTechTokens();
  g.techTokens.axlotl.owner = 'e';
  g.techTokens.heighliners.owner = 'h';
  g.techTokens.production.owner = 'g';
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of state.players)
    if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
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
function duel(
  state: Game,
  attacker = 'e',
  defender = 'h',
  dial = 0,
  scenario?: { explosion?: boolean; calls?: [boolean, boolean] },
) {
  let g = structuredClone(state);
  g.phase = 6;
  g.active = attacker;
  g.players.forEach((p) => {
    p.forces = [attacker, defender].includes(p.id) ? { 'arrakeen:10': 3 } : {};
    p.reserves = [attacker, defender].includes(p.id) ? 17 : 20;
  });
  g.order = [
    attacker,
    defender,
    ...g.players
      .map((p) => p.id)
      .filter((id) => ![attacker, defender].includes(id)),
  ];
  const lasgun = baseDeck().find((c) => c.kind === 'lasgun')!;
  const shield = baseDeck().find((c) => c.kind === 'shield')!;
  for (const [i, id] of [attacker, defender].entries()) {
    const p = g.players.find((p) => p.id === id)!;
    const enemy = g.players.find((p) => p.id === (i ? attacker : defender))!;
    if (scenario?.calls?.[i]) p.traitors = [`${enemy.faction}-0`];
    if (scenario?.explosion) setBattleHand(g, id, [(i ? shield : lasgun).id]);
  }
  g = allow(
    applyAction(g, attacker, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: defender,
    }),
  );
  for (const id of [attacker, defender])
    g = applyAction(g, id, {
      type: 'battlePlan',
      dial: id === attacker ? dial : 0,
      support: dial,
      leader: `${g.players.find((p) => p.id === id)!.faction}-0`,
      ...(scenario?.explosion
        ? id === attacker
          ? { weapon: lasgun.id }
          : { defense: shield.id }
        : {}),
    });
  for (const [i, id] of [attacker, defender].entries())
    g = applyAction(g, id, {
      type: 'traitorCall',
      call: scenario?.calls?.[i] ?? false,
    });
  return g;
}
void test('host controls the optional variant, changing it clears readiness, and two-player tech setup is explicitly rejected', () => {
  let g = createGame('TECHOPT2', newPlayer('e', 'Host', 'emperor'));
  joinGame(g, newPlayer('h', 'Guest', 'harkonnen'));
  g.players.forEach((p) => (p.ready = true));
  assert.throws(
    () => applyAction(g, 'h', { type: 'techTokens', enabled: true }),
    /host/,
  );
  assert.throws(
    () => applyAction(g, 'e', { type: 'techTokens', enabled: 'true' }),
    /whether/,
  );
  g = applyAction(g, 'e', { type: 'techTokens', enabled: true });
  assert.ok(g.techTokens);
  assert.ok(g.players.every((p) => !p.ready));
  g.players.forEach((p) => (p.ready = true));
  assert.throws(() => applyAction(g, 'e', { type: 'start' }), /three players/);
  g = applyAction(g, 'e', { type: 'techTokens', enabled: false });
  g.players.forEach((p) => (p.ready = true));
  assert.equal(applyAction(g, 'e', { type: 'start' }).status, 'setup');
});
void test('default faction assignments precede the first storm; missing tokens go randomly to unassigned factions in storm order', () => {
  const defaults = createTechTokens([
    { id: 't', faction: 'tleilaxu' },
    { id: 'i', faction: 'ixians' },
    { id: 'f', faction: 'fremen' },
  ]);
  assert.deepEqual(
    TECH_TOKENS.map((t) => defaults[t.id].owner),
    ['t', 'i', 'f'],
  );
  let g = table(['emperor', 'fremen', 'guild', 'harkonnen']);
  assert.equal(g.techTokens?.production.owner, 'h');
  assert.equal(g.techTokens?.axlotl.owner, null);
  for (const id of g.stormDialers)
    g = applyAction(g, id, { type: 'stormDial', amount: 0 });
  g = ready(g);
  const recipients = g.order.filter((id) => id !== 'h').slice(0, 2);
  assert.deepEqual(
    new Set([g.techTokens!.axlotl.owner, g.techTokens!.heighliners.owner]),
    new Set(recipients),
  );
  assert.equal(g.techTokens?.production.owner, 'h');
  assert.equal(
    new Set(TECH_TOKENS.map((t) => g.techTokens![t.id].owner)).size,
    3,
  );
});
void test('charity income accrues once by total token ownership and is unspendable until phase end', () => {
  const before = fixture();
  before.techTokens!.axlotl.owner = 'g';
  before.players[0].spice = 0;
  before.players[1].spice = 1;
  let g = applyAction(before, 'e', { type: 'charity' });
  assert.equal(g.techTokens?.production.spice, 2);
  assert.equal(g.players[2].spice, 10);
  g = applyAction(g, 'h', { type: 'charity' });
  assert.equal(g.techTokens?.production.spice, 2);
  g = ready(g);
  assert.equal(g.players[2].spice, 12);
  assert.equal(g.techTokens?.production.spice, 0);
  assert.equal(g.phase, 3);
});
void test('Bene Gesserit charity alone does not trigger production, but another faction later does', () => {
  let g = fixture(['emperor', 'beneGesserit', 'guild']);
  g.players[1].spice = 0;
  g = applyAction(g, 'h', { type: 'charity' });
  assert.equal(g.techTokens?.production.spice, 0);
  g.players[0].spice = 0;
  g = applyAction(g, 'e', { type: 'charity' });
  assert.equal(g.techTokens?.production.spice, 1);
});
void test('free revival triggers Axlotl once, paid-only revival does not, and payment waits for phase end', () => {
  let g = fixture();
  g.phase = 4;
  g.players[0].tanks = 3;
  g.players[0].reserves = 17;
  g.techTokens!.heighliners.owner = 'e';
  g = applyAction(g, 'e', { type: 'revive', amount: 1 });
  assert.equal(g.techTokens?.axlotl.spice, 2);
  assert.equal(g.players[0].spice, 10);
  g = applyAction(g, 'e', { type: 'revive', amount: 1 });
  assert.equal(g.techTokens?.axlotl.spice, 2);
  assert.equal(g.players[0].spice, 8);
  g = allow(ready(g));
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.techTokens?.axlotl.spice, 0);
  const paid = fixture();
  paid.phase = 4;
  paid.players[0].tanks = 1;
  paid.players[0].reserves = 19;
  paid.players[0].revived = 1;
  assert.equal(
    applyAction(paid, 'e', { type: 'revive', amount: 1 }).techTokens?.axlotl
      .spice,
    0,
  );
});
void test('Tleilaxu-only free revival is excluded and free Ghola revival accrues only in the Revival phase', () => {
  const before = fixture();
  before.phase = 4;
  before.players[0].faction = 'tleilaxu';
  before.players[0].tanks = 1;
  before.players[0].reserves = 19;
  assert.equal(
    applyAction(before, 'e', { type: 'revive', amount: 1 }).techTokens?.axlotl
      .spice,
    0,
  );
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  before.players[0].faction = 'emperor';
  placeFixtureHand(before, 0, [ghola]);
  const action = { type: 'card', card: ghola.id, amount: 1 };
  assert.equal(applyAction(before, 'e', action).techTokens?.axlotl.spice, 1);
  before.phase = 6;
  assert.equal(applyAction(before, 'e', action).techTokens?.axlotl.spice, 0);
});
void test('off-planet shipments accrue Heighliner income once, excluding Guild-only and cross-planet transport', () => {
  let g = fixture();
  g.phase = 5;
  g.active = 'g';
  g.order = ['g', 'e', 'h'];
  g.movementRemaining = [...g.order];
  g = applyAction(g, 'g', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.techTokens?.heighliners.spice, 0);
  g = applyAction(g, 'g', { type: 'endMovement' });
  g = allow(
    applyAction(g, 'e', {
      type: 'ship',
      territory: 'polar_sink',
      sector: 0,
      amount: 1,
    }),
  );
  assert.equal(g.techTokens?.heighliners.spice, 1);
  const held = g.players[1].spice;
  g = applyAction(g, 'e', { type: 'endMovement' });
  g = applyAction(g, 'h', { type: 'endMovement' });
  assert.equal(g.players[1].spice, held + 1);
  assert.equal(g.techTokens?.heighliners.spice, 0);
  const cross = fixture();
  cross.phase = 5;
  cross.active = 'g';
  cross.players[2].forces = { 'arrakeen:10': 2 };
  cross.players[2].reserves = 18;
  assert.equal(
    applyAction(cross, 'g', {
      type: 'guildShip',
      from: 'arrakeen:10',
      territory: 'polar_sink',
      sector: 0,
      amount: 1,
    }).techTokens?.heighliners.spice,
    0,
  );
});
void test('a canceled shipment produces no tech income, while an allowed spiritual advisor can trigger it after a Guild shipment', () => {
  const before = fixture(['emperor', 'beneGesserit', 'guild']);
  before.phase = 5;
  before.active = 'e';
  before.advanced = true;
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  before.players[2].hand = [karama];
  let g = applyAction(before, 'e', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  g = applyAction(g, 'g', { type: 'card', mode: 'special', card: karama.id });
  assert.equal(g.techTokens?.heighliners.spice, 0);
  before.advanced = false;
  before.active = 'g';
  g = applyAction(before, 'g', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.techTokens?.heighliners.spice, 0);
  g = applyAction(g, 'h', { type: 'decision', accept: true });
  g = allow(g);
  assert.equal(g.techTokens?.heighliners.spice, 1);
});
void test('battle winner takes one chosen token, with ownership and decision authority preserved through JSON', () => {
  const before = fixture();
  before.techTokens!.axlotl.owner = 'h';
  let g = duel(before);
  assert.equal(g.decision?.kind, 'techToken');
  assert.equal(g.techTokens?.axlotl.owner, 'h');
  assert.throws(
    () => applyAction(g, 'g', { type: 'decision', token: 'axlotl' }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', token: 'production' }),
    /defeated/,
  );
  g = applyAction(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'decision',
    token: 'axlotl',
  });
  assert.equal(g.techTokens?.axlotl.owner, 'e');
  assert.equal(g.techTokens?.heighliners.owner, 'h');
  assert.equal(g.pendingTech, null);
  assert.equal(g.phase, 7);
});
void test('a winner that loses its last forces still takes a single token automatically', () => {
  const g = duel(fixture(), 'e', 'h', 3);
  assert.equal(g.players[0].forces['arrakeen:10'], undefined);
  assert.equal(g.techTokens?.heighliners.owner, 'e');
  assert.equal(g.decision, null);
});
void test('mutual traitors and explosions retain ownership; a single traitor win overrides an explosion and transfers after card decisions', () => {
  const before = fixture();
  for (const scenario of [
    { explosion: true },
    { calls: [true, true] as [boolean, boolean] },
  ]) {
    const g = duel(before, 'e', 'h', 0, scenario);
    assert.deepEqual(g.techTokens, before.techTokens);
    assert.equal(g.pendingTech, undefined);
    assert.equal(g.decision, null);
    assert.equal(g.phase, 7);
  }
  let g = duel(before, 'e', 'h', 0, { explosion: true, calls: [true, false] });
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.techTokens?.heighliners.owner, 'h');
  g = applyAction(g, 'e', { type: 'decision', discard: [] });
  assert.equal(g.techTokens?.heighliners.owner, 'e');
  assert.equal(g.players[0].forces['arrakeen:10'], 3);
  assert.equal(g.pendingTech, null);
});
void test('tech choice completes before a pending Harkonnen capture without losing that continuation', () => {
  const before = fixture();
  before.advanced = true;
  before.techTokens!.production.owner = 'e';
  let g = duel(before, 'h', 'e');
  assert.equal(g.decision?.kind, 'techToken');
  assert.equal(g.players.find((p) => p.id === 'h')!.tanks, 0);
  assert.equal(g.players.find((p) => p.id === 'e')!.tanks, 3);
  assert.equal(g.pendingCapture?.player, 'h');
  g = applyAction(g, 'h', { type: 'decision', token: 'production' });
  assert.equal(g.decision?.kind, 'captureOffer');
  assert.equal(g.techTokens?.production.owner, 'h');
});
void test('all three tokens add one stronghold to one owner, allow simultaneous wins, and cannot be assembled across allies', () => {
  const before = fixture();
  before.phase = 7;
  TECH_TOKENS.forEach((t) => (before.techTokens![t.id].owner = 'e'));
  before.players[0].forces = { 'arrakeen:10': 1, 'carthag:11': 1 };
  before.players[1].forces = {
    'sietch_tabr:14': 1,
    'habbanya_ridge_sietch:17': 1,
    'tueks_sietch:5': 1,
  };
  const g = ready(before);
  assert.deepEqual(g.winner, ['e', 'h']);
  const allied = structuredClone(before);
  allied.players[0].ally = 'g';
  allied.players[2].ally = 'e';
  allied.players[1].forces = {};
  allied.players[2].forces = { 'tueks_sietch:5': 1 };
  allied.techTokens!.production.owner = 'g';
  assert.deepEqual(ready(allied).winner, []);
  allied.techTokens!.production.owner = 'e';
  assert.deepEqual(ready(allied).winner, ['e', 'g']);
});
void test('token income can trigger again next turn and public token data excludes no player', () => {
  const before = fixture();
  before.players[0].spice = 0;
  let g = applyAction(before, 'e', { type: 'charity' });
  g = ready(g);
  g.turn++;
  g.phase = 2;
  g.ready = [];
  g.players[0].spice = 0;
  g = applyAction(g, 'e', { type: 'charity' });
  assert.equal(g.techTokens?.production.spice, 1);
  assert.equal(g.techTokens?.production.triggeredTurn, 2);
  for (const p of g.players)
    assert.deepEqual(viewGame(g, p.id).techTokens, g.techTokens);
});
void test('all AI levels choose a legal captured token from public holdings', () => {
  const before = fixture();
  before.techTokens!.axlotl.owner = 'h';
  for (const difficulty of DIFFICULTIES) {
    const g = duel(before);
    g.players[0].bot = difficulty;
    const action = botActions(viewGame(g, 'e'))[0];
    assert.equal(action.type, 'decision');
    const result = applyAction(g, 'e', action);
    assert.equal(ownedTech(result.techTokens, 'e').length, 1);
    assert.equal(ownedTech(result.techTokens, 'h').length, 1);
  }
});
