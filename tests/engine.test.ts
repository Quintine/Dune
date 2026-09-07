import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import type { FactionId } from '../game/catalog';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import { TERRITORIES, GRAPH, distance } from '../game/board';
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
function lobby(factions: FactionId[] = ['atreides', 'harkonnen']) {
  const g = createGame('TEST2345', newPlayer('p0', 'Player 0', factions[0]));
  for (let i = 1; i < factions.length; i++)
    joinGame(g, newPlayer(`p${i}`, `Player ${i}`, factions[i]));
  return g;
}
function started(factions: FactionId[] = ['atreides', 'harkonnen']) {
  let g = lobby(factions);
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'p0', { type: 'start' });
  const bg = g.players.find((p) => p.faction === 'beneGesserit');
  if (bg)
    g = applyAction(g, bg.id, {
      type: 'predict',
      faction: g.players.find((other) => other.id !== bg.id)!.faction,
      turn: 3,
    });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  for (const p of g.players)
    if (p.faction === 'fremen')
      g = applyAction(g, p.id, {
        type: 'fremenSetup',
        placements: {
          sietch_tabr: 10,
          false_wall_south: 0,
          false_wall_west: 0,
        },
      });
  return g;
}
function readyAll(state: Game, closeSpiceWindow = true) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.spiceWindow && closeSpiceWindow) return readyAll(g, false);
  return g;
}
function passResponses(state: Game) {
  let g = state;
  while (g.response) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function power(
  g: Game,
  id: string,
  action: { type: string; [key: string]: unknown },
) {
  return passResponses(applyAction(g, id, action));
}
function conservation(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
      p.faction,
    );
    if (p.elites) {
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'emperor' ? 5 : 3,
      );
      assert.ok(p.elites.reserves >= 0 && p.elites.reserves <= p.reserves);
      assert.ok(p.elites.tanks >= 0 && p.elites.tanks <= p.tanks);
      for (const [key, n] of Object.entries(p.elites.forces))
        assert.ok(n >= 0 && n <= (p.forces[key] ?? 0));
    }
    assert.ok(p.spice >= 0);
    assert.ok(p.hand.length <= (p.faction === 'harkonnen' ? 8 : 4));
  }
}
function combat() {
  const g = started();
  g.phase = 6;
  g.storm = 18;
  g.order = ['p0', 'p1'];
  g.active = 'p0';
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players.forEach((p) => {
    g.deck.push(...p.hand);
    p.hand = [];
  });
  return applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
}
const plan = (state: Game, id: string, dial = 0, extra = {}) => {
  let g = passResponses(state);
  while (
    g.battle?.preparation &&
    g.battle.preparation.kind !== 'prescienceAnswer'
  )
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return applyAction(g, id, {
    type: 'battlePlan',
    dial,
    leader: `${g.players.find((p) => p.id === id)!.faction}-0`,
    ...extra,
  });
};
const resolve = (state: Game, a = false, b = false) =>
  applyAction(
    applyAction(state, 'p0', { type: 'traitorCall', call: a }),
    'p1',
    { type: 'traitorCall', call: b },
  );
void test('base decks have printed counts and unique IDs', () => {
  assert.equal(baseDeck().length, 33);
  assert.equal(new Set(baseDeck().map((c) => c.id)).size, 33);
  assert.equal(spiceDeck().length, 21);
});
void test('board contains five strongholds and no phantom Arrakis territory', () => {
  assert.equal(TERRITORIES.filter((t) => t.type === 'stronghold').length, 5);
  assert.ok(!TERRITORIES.some((t) => t.id === 'arrakis'));
  for (const [a, neighbors] of Object.entries(GRAPH))
    for (const b of neighbors) {
      assert.ok(GRAPH[b], `${b} exists`);
      assert.ok(GRAPH[b].includes(a), `${a} ↔ ${b}`);
    }
});
void test('territory routes count territories not sector crossings', () => {
  assert.equal(distance('arrakeen:10', 'arrakeen:10'), 0);
  assert.equal(distance('arrakeen:10', 'imperial_basin:10'), 1);
  assert.equal(distance('arrakeen:10', 'carthag:11'), 2);
  assert.equal(
    distance('arrakeen:10', 'carthag:11', (k) => k.endsWith(':10')),
    Infinity,
  );
});
void test('faction seats are unique; maximum six players', () => {
  const g = lobby();
  assert.throws(() => joinGame(g, newPlayer('x', 'X', 'atreides')), /taken/);
  const full = lobby([
    'atreides',
    'harkonnen',
    'emperor',
    'fremen',
    'guild',
    'beneGesserit',
  ]);
  assert.throws(() => joinGame(full, newPlayer('x', 'X', 'ixians')), /six/);
});
void test('host needs all players ready and at least two seats', () => {
  const g = lobby();
  assert.throws(() => applyAction(g, 'p1', { type: 'start' }), /host/);
  assert.throws(() => applyAction(g, 'p0', { type: 'start' }), /ready/);
});
void test('setup and traitor selections conserve forces and stay private', () => {
  const g = started(['atreides', 'harkonnen', 'fremen', 'beneGesserit']);
  conservation(g);
  assert.equal(g.status, 'playing');
  assert.equal(g.players[1].traitors.length, 4);
  assert.equal(g.players[1].hand.length, 2);
  const v = viewGame(g, 'p0');
  assert.equal(v.players[1].spice, undefined);
  assert.equal(v.players[1].hand, undefined);
  assert.equal(v.players[1].traitors, undefined);
  assert.equal(v.players[3].prediction, undefined);
  assert.equal('deck' in v, false);
  assert.equal('spiceDeck' in v, false);
});
void test('invalid actions do not mutate the authoritative state', () => {
  const g = started();
  const before = JSON.stringify(g);
  assert.throws(() =>
    applyAction(g, 'p0', {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 5,
    }),
  );
  assert.equal(JSON.stringify(g), before);
});
void test('storm dials are sealed, immutable and reveal together', () => {
  let g = started();
  g = applyAction(g, 'p0', { type: 'stormDial', amount: 3 });
  assert.equal(g.phase, 0);
  assert.equal('stormDials' in viewGame(g, 'p1'), false);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'stormDial', amount: 5 }),
    /locked/,
  );
  g = applyAction(g, 'p1', { type: 'stormDial', amount: 0 });
  assert.equal(g.phase, 0);
  assert.equal(g.stormPending, 3);
  g = readyAll(g);
  assert.equal(g.phase, 1);
  assert.equal(g.storm, 4);
  conservation(g);
});
void test('first-turn worms are skipped and reshuffled', () => {
  let g = started();
  g.phase = 1;
  g.spiceDeck = [
    { worm: true },
    { territory: 'red_chasm', amount: 8, sector: 7 },
  ];
  g = readyAll(g);
  assert.equal(g.nexus, false);
  assert.equal(g.phase, 2);
  assert.equal(g.spice['red_chasm:7'], 8);
  assert.ok(g.spiceDeck.some((c) => 'worm' in c));
});
void test('charity cannot be collected twice', () => {
  let g = started();
  g.phase = 2;
  g.players[0].spice = 0;
  g = applyAction(g, 'p0', { type: 'charity' });
  assert.equal(g.players[0].spice, 2);
  assert.throws(() => applyAction(g, 'p0', { type: 'charity' }), /Charity/);
});
void test('auction winner pays and Harkonnen draws a bonus card', () => {
  let g = started();
  // This case verifies automatic spice payment; a random starting Karama
  // would introduce a genuine payment choice instead.
  g.players[1].hand = g.players[1].hand.map((card) => {
    if (card.effect !== 'karama') return card;
    const at = g.deck.findIndex(
      (replacement) => replacement.effect !== 'karama',
    );
    const replacement = g.deck.splice(at, 1)[0];
    g.deck.push(card);
    return replacement;
  });
  g.phase = 2;
  g = passResponses(readyAll(g));
  g.auction!.active = 'p1';
  g = applyAction(g, 'p1', { type: 'bid', amount: 3 });
  g = applyAction(g, 'p0', { type: 'passBid' });
  assert.notEqual(g.decision?.kind, 'auctionPayment');
  g = passResponses(g);
  assert.equal(g.players[1].spice, 7);
  assert.equal(g.players[1].hand.length, 4);
  conservation(g);
});
void test('passing all auctions returns cards to deck and advances', () => {
  let g = passResponses(readyAll({ ...started(), phase: 2 }));
  const deckCount = g.deck.length + g.auction!.cards.length;
  while (g.phase === 3)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  assert.equal(g.phase, 4);
  assert.equal(g.deck.length, deckCount);
});
void test('revival honors free allowance and total cap across requests', () => {
  let g = started();
  g.phase = 4;
  g.players[0].forces = {};
  g.players[0].tanks = 10;
  g = applyAction(g, 'p0', { type: 'revive', amount: 2 });
  assert.equal(g.players[0].spice, 10);
  g = applyAction(g, 'p0', { type: 'revive', amount: 1 });
  assert.equal(g.players[0].spice, 8);
  assert.throws(() => applyAction(g, 'p0', { type: 'revive', amount: 1 }));
  conservation(g);
});
void test('normal shipment costs and Guild income; no double shipment', () => {
  let g = started(['atreides', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
  });
  assert.equal(g.players[0].spice, 7);
  g = passResponses(g);
  assert.equal(g.players[1].spice, 8);
  assert.throws(() =>
    applyAction(g, 'p0', {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 1,
    }),
  );
  conservation(g);
});
void test('storm, overspending, negative, fractional, and third-faction entry are rejected', () => {
  const g = started(['atreides', 'harkonnen', 'emperor']);
  g.phase = 5;
  g.active = 'p0';
  g.storm = 10;
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /storm/,
  );
  g.storm = 18;
  for (const n of [-1, 0.5, 100, NaN])
    assert.throws(() =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: n,
      }),
    );
  g.players[0].spice = 0;
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /spice/,
  );
  g.players[0].spice = 10;
  g.players[2].forces = { 'carthag:11': 1 };
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 1,
      }),
    /three/,
  );
});
void test('sealed opponent battle plans are not exposed', () => {
  let g = combat();
  g = plan(g, 'p0', 3);
  const view = viewGame(g, 'p1');
  assert.equal(view.battle!.plans.p0, undefined);
  assert.equal(view.battle!.submitted[0], 'p0');
  g = plan(g, 'p1', 3);
  assert.equal(viewGame(g, 'p1').battle!.plans.p0.dial, 3);
});
void test('aggressor wins ties; loser keeps surviving leader and loses all forces', () => {
  let g = combat();
  g = plan(g, 'p0', 4);
  g = plan(g, 'p1', 3);
  g = resolve(g);
  assert.equal(g.players[0].forces['arrakeen:10'], 6);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.players[1].leaders[0].dead, false);
  conservation(g);
});
void test('weapon kills leader and winner collects its value', () => {
  let g = combat();
  const weapon = baseDeck().find((c) => c.kind === 'poison')!;
  setBattleHand(g, 'p0', [weapon.id]);
  g = plan(g, 'p0', 0, { weapon: weapon.id });
  g = plan(g, 'p1', 0);
  g = resolve(g);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 16);
  conservation(g);
});
void test('traitor victory overrides lasgun/shield explosion', () => {
  let g = combat();
  const lasgun = baseDeck().find((c) => c.kind === 'lasgun')!,
    shield = baseDeck().find((c) => c.kind === 'shield')!;
  setBattleHand(g, 'p0', [lasgun.id]);
  setBattleHand(g, 'p1', [shield.id]);
  g.players[0].traitors = ['harkonnen-0'];
  g = plan(g, 'p0', 8, { weapon: lasgun.id });
  g = plan(g, 'p1', 5, { defense: shield.id });
  g = resolve(g, true);
  assert.equal(g.players[0].forces['arrakeen:10'], 10);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.players[0].spice, 16);
  conservation(g);
});
void test('lasgun/shield destroys both armies and spice without bounty', () => {
  let g = combat();
  const lasgun = baseDeck().find((c) => c.kind === 'lasgun')!,
    shield = baseDeck().find((c) => c.kind === 'shield')!;
  setBattleHand(g, 'p0', [lasgun.id]);
  setBattleHand(g, 'p1', [shield.id]);
  g.spice = { 'arrakeen:10': 10 };
  g = plan(g, 'p0', 0, { weapon: lasgun.id });
  g = plan(g, 'p1', 0, { defense: shield.id });
  g = resolve(g);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.spice['arrakeen:10'], undefined);
  assert.equal(g.players[0].spice, 10);
  conservation(g);
});
void test('cannot reveal a traitor not held', () => {
  const g = plan(plan(combat(), 'p0'), 'p1');
  g.players[0].traitors = [];
  assert.throws(
    () => applyAction(g, 'p0', { type: 'traitorCall', call: true }),
    /do not hold/,
  );
});
void test('two-player victory requires four strongholds', () => {
  let g = started();
  g.phase = 7;
  g.players[0].forces = {
    'arrakeen:10': 1,
    'sietch_tabr:14': 1,
    'tueks_sietch:5': 1,
  };
  g = readyAll(g);
  assert.equal(g.status, 'playing');
  g.phase = 7;
  g.players[0].forces['habbanya_ridge_sietch:17'] = 1;
  g = readyAll(g);
  assert.equal(g.status, 'finished');
  assert.deepEqual(g.winner, ['p0']);
});
void test('bribes are deferred until Mentat pause and not visible as spendable spice', () => {
  let g = started();
  g.phase = 2;
  g = applyAction(g, 'p0', { type: 'bribe', target: 'p1', amount: 4 });
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.players[1].spice, 10);
  assert.equal(g.players[1].bribes, 4);
  g.phase = 7;
  g = readyAll(g);
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[1].bribes, 0);
});

void test('six-player table can complete ten turns without stalling', () => {
  let g = started([
    'atreides',
    'harkonnen',
    'emperor',
    'fremen',
    'guild',
    'beneGesserit',
  ]);
  for (let step = 0; step < 1000 && g.status !== 'finished'; step++) {
    if (g.response) {
      g = passResponses(g);
    } else if (g.phase === 0 && g.stormPending === null) {
      const id = g.stormDialers.find((id) => g.stormDials[id] === undefined)!;
      g = applyAction(g, id, {
        type: 'stormDial',
        amount: g.turn === 1 ? 0 : 1,
      });
    } else if (g.phase === 3) {
      g = applyAction(g, g.auction!.active, { type: 'passBid' });
    } else if (g.phase === 5) {
      g = applyAction(g, g.active!, { type: 'endMovement' });
    } else {
      assert.notEqual(g.phase, 6, 'No rival forces overlap in this scenario');
      g = applyAction(g, g.players.find((p) => !g.ready.includes(p.id))!.id, {
        type: 'ready',
      });
    }
    conservation(g);
  }
  assert.equal(g.status, 'finished');
  assert.equal(g.turn, 10);
  assert.deepEqual(g.winner, ['p3']);
});

void test('ordinary spice blows preserve the remaining deck for Atreides foresight', () => {
  const g = started();
  g.turn = 2;
  g.phase = 1;
  const cards = spiceDeck().filter((c) => 'territory' in c);
  g.spiceDeck = cards;
  const next = readyAll(g);
  assert.deepEqual(next.spiceDeck, cards.slice(1));
  assert.equal(next.spiceResolution, null);
});

void test('Bene Gesserit shipment reaction blocks movement, is optional, and conserves forces', () => {
  let g = started(['atreides', 'beneGesserit']);
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  const before = g.players[1].reserves;
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  assert.deepEqual(g.decision, {
    kind: 'advisor',
    player: 'p1',
    shipment: 'p0',
    destination: 'arrakeen:10',
  });
  const original = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'endMovement' }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'decision', accept: true }),
    /pending decision/,
  );
  assert.deepEqual(g, original);
  const declined = applyAction(g, 'p1', { type: 'decision', accept: false });
  assert.equal(declined.players[1].reserves, before);
  g = passResponses(applyAction(g, 'p1', { type: 'decision', accept: true }));
  assert.equal(g.players[1].reserves, before - 1);
  assert.equal(g.players[1].forces['polar_sink:0'], 2);
  assert.equal(g.players[1].shipped, false);
  assert.equal(g.active, 'p0');
  assert.equal(g.decision, null);
  conservation(g);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'decision', accept: true }),
    /not available/,
  );
});

void test('Fremen reinforcements, BG own shipment and Guild on-planet transport do not grant BG a free force', () => {
  let g = started(['fremen', 'beneGesserit', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  const flat = TERRITORIES.find((t) => t.id === 'the_great_flat')!;
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: flat.id,
    sector: flat.sectors[0],
    amount: 1,
  });
  assert.equal(g.decision, null);
  g.active = 'p1';
  g = applyAction(g, 'p1', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.decision, null);
  g = passResponses(g);
  g.active = 'p2';
  const from = Object.keys(g.players[2].forces)[0];
  g = applyAction(g, 'p2', {
    type: 'guildShip',
    from,
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.decision, null);
  conservation(g);
});

function wormScenario() {
  const g = started(['fremen', 'atreides', 'harkonnen']);
  g.turn = 2;
  g.phase = 1;
  g.storm = 18;
  const blow = spiceDeck().find(
    (c) => 'territory' in c && c.territory === 'the_great_flat',
  )!;
  assert.ok('territory' in blow);
  const source = `${blow.territory}:${blow.sector}`;
  const next = spiceDeck().find(
    (c) => 'territory' in c && c.territory !== blow.territory,
  )!;
  const worms = spiceDeck()
    .filter((c) => 'worm' in c)
    .slice(0, 2);
  g.spiceDiscard = [[blow], []];
  g.spiceDeck = [...worms, next];
  g.players[0].forces = { [source]: 10 };
  g.players[1].forces = { [source]: 10 };
  g.players[2].forces = { [source]: 10 };
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.spice = { [source]: 8 };
  return { g, source, territory: blow.territory };
}

void test('Fremen choose ally worm protection before destruction and Nexus; subsequent worms do not devour twice', () => {
  const scenario = wormScenario();
  let g = readyAll(scenario.g);
  assert.equal(g.decision?.kind, 'wormProtection');
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.players[2].tanks, 0);
  assert.ok(g.spiceResolution);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'ready' }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'decision', accept: 'yes' }),
    /Choose whether/,
  );
  const unprotected = power(g, 'p0', { type: 'decision', accept: false });
  assert.equal(unprotected.players[1].tanks, 10);
  g = power(g, 'p0', { type: 'decision', accept: true });
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.players[2].tanks, 10);
  assert.equal(g.spice[scenario.source], undefined);
  assert.deepEqual(g.wormRides, [scenario.territory]);
  assert.equal(g.phase, 1);
  assert.equal(g.nexus, true);
  assert.equal(g.decision, null);
  assert.equal(g.spiceResolution, null);
  assert.deepEqual(g.ready, []);
  assert.ok(g.spiceWindow);
  conservation(g);
});

void test('Fremen ride only after Nexus, can move part of their force, and leave destination armies intact', () => {
  const scenario = wormScenario();
  let g = power(readyAll(scenario.g), 'p0', {
    type: 'decision',
    accept: true,
  });
  g.players[2].forces = { 'arrakeen:10': 1 };
  g.players[2].tanks = 9;
  g = readyAll(readyAll(g));
  assert.equal(g.decision?.kind, 'wormRide');
  assert.equal(viewGame(g, 'p1').decision?.player, 'p0');
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'decision',
        accept: true,
        territory: 'arrakeen',
        sector: 10,
        forces: { 'sietch_tabr:14': 1 },
      }),
    /where the worm appeared/,
  );
  const declined = applyAction(g, 'p0', { type: 'decision', accept: false });
  assert.equal(declined.phase, 2);
  assert.equal(declined.players[0].forces[scenario.source], 10);
  g = applyAction(g, 'p0', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { [scenario.source]: 4 },
  });
  assert.equal(g.phase, 2);
  assert.equal(g.nexus, false);
  assert.equal(g.players[0].forces[scenario.source], 6);
  assert.equal(g.players[0].forces['arrakeen:10'], 4);
  assert.equal(g.players[2].forces['arrakeen:10'], 1);
  assert.equal(g.players[0].moved, 0);
  conservation(g);
});

void test('worm ride rejects storm and allied/fully occupied strongholds atomically', () => {
  const scenario = wormScenario();
  let g = power(readyAll(scenario.g), 'p0', {
    type: 'decision',
    accept: false,
  });
  g = readyAll(readyAll(g));
  const action = {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { [scenario.source]: 2 },
  };
  g.storm = 10;
  assert.throws(() => applyAction(g, 'p0', action), /storm/);
  g.storm = 18;
  g.players[1].forces = { 'arrakeen:10': 1 };
  const original = structuredClone(g);
  assert.throws(() => applyAction(g, 'p0', action), /ally/);
  assert.deepEqual(g, original);
  g.players[0].ally = null;
  g.players[1].ally = null;
  g.players[2].forces = { 'arrakeen:10': 1 };
  assert.throws(() => applyAction(g, 'p0', action), /three occupying factions/);
});

void test('Fremen free revival is optional, phase-scoped and still capped at three', () => {
  let g = started(['fremen', 'atreides']);
  g.phase = 4;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[1].forces = {};
  g.players[1].reserves = 15;
  g.players[1].tanks = 5;
  const paid = applyAction(g, 'p1', { type: 'revive', amount: 3 });
  assert.equal(paid.players[1].spice, 8);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'grantRevival' }),
    /Only Fremen/,
  );
  g = applyAction(g, 'p0', { type: 'grantRevival' });
  g = applyAction(g, 'p1', { type: 'revive', amount: 1 });
  g = applyAction(g, 'p1', { type: 'revive', amount: 2 });
  assert.equal(g.players[1].spice, 10);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'revive', amount: 1 }),
    /integer/,
  );
  conservation(g);
  g.phase = 3;
  g.auction = {
    cards: [baseDeck()[0]],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'p0',
    passed: [],
    opener: 0,
  };
  g.order = ['p0', 'p1'];
  g = applyAction(g, 'p0', { type: 'passBid' });
  g = applyAction(g, 'p1', { type: 'passBid' });
  assert.equal(g.phase, 4);
  assert.deepEqual(g.freeRevival, []);
});

void test('winner explicitly keeps or discards played cards before battle phase ends', () => {
  let g = combat();
  const weapon = baseDeck().find((c) => c.kind === 'poison')!;
  const spare = baseDeck().find((c) => c.kind === 'shield')!;
  setBattleHand(g, 'p0', [weapon.id, spare.id]);
  g = resolve(plan(plan(g, 'p0', 0, { weapon: weapon.id }), 'p1', 0));
  assert.equal(g.phase, 6);
  assert.deepEqual(g.decision, {
    kind: 'battleCards',
    player: 'p0',
    territory: 'arrakeen',
    cards: [weapon.id],
  });
  assert.throws(
    () => applyAction(g, 'p1', { type: 'decision', discard: [] }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'decision', discard: [spare.id] }),
    /only cards played/,
  );
  const kept = applyAction(g, 'p0', { type: 'decision', discard: [] });
  assert.equal(kept.phase, 7);
  assert.equal(kept.players[0].hand.length, 2);
  g = applyAction(g, 'p0', { type: 'decision', discard: [weapon.id] });
  assert.equal(g.phase, 7);
  assert.deepEqual(g.players[0].hand, [spare]);
  assert.ok(g.discard.some((c) => c.id === weapon.id));
});

void test('movement combines sectors of one territory into a single move', () => {
  let g = started();
  g.phase = 5;
  g.active = 'p0';
  g.players[0].forces = { 'pasty_mesa:5': 4, 'pasty_mesa:6': 6 };
  g = applyAction(g, 'p0', {
    type: 'move',
    territory: 'tueks_sietch',
    sector: 5,
    forces: { 'pasty_mesa:5': 3, 'pasty_mesa:6': 2 },
  });
  assert.deepEqual(g.players[0].forces, {
    'pasty_mesa:5': 1,
    'pasty_mesa:6': 4,
    'tueks_sietch:5': 5,
  });
  assert.equal(g.players[0].moved, 1);
  assert.equal(g.players[0].shipped, true);
  conservation(g);
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'move',
        from: 'pasty_mesa:5',
        amount: 1,
        territory: 'tueks_sietch',
        sector: 5,
      }),
    /not available/,
  );
});

void test('group movement cannot mix territories, exceed stocks, or bypass a storm', () => {
  const g = started();
  g.phase = 5;
  g.active = 'p0';
  g.players[0].forces = {
    'pasty_mesa:5': 4,
    'pasty_mesa:6': 5,
    'arrakeen:10': 1,
  };
  const action = { type: 'move', territory: 'tueks_sietch', sector: 5 };
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        ...action,
        forces: { 'pasty_mesa:5': 1, 'arrakeen:10': 1 },
      }),
    /one territory/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { ...action, forces: { 'pasty_mesa:5': 5 } }),
    /integer/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { ...action, forces: { 'nonsense:1': 1 } }),
    /Invalid source/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { ...action, forces: {} }),
    /at least one/,
  );
  g.storm = 6;
  const original = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        ...action,
        forces: { 'pasty_mesa:5': 1, 'pasty_mesa:6': 1 },
      }),
    /blocked/,
  );
  assert.deepEqual(g, original);
  const legal = applyAction(g, 'p0', {
    ...action,
    forces: { 'pasty_mesa:5': 1, 'pasty_mesa:6': 0 },
  });
  assert.equal(legal.players[0].forces['tueks_sietch:5'], 1);
});

void test('Guild groups from several sectors pay one rounded shipment cost', () => {
  let g = started(['guild', 'atreides']);
  g.phase = 5;
  g.active = 'p0';
  g.players[0].forces = { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 };
  const before = g.players[0].spice;
  const action = {
    type: 'guildShip',
    forces: { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 },
  };
  const returned = applyAction(g, 'p0', { ...action, territory: 'reserves' });
  assert.equal(returned.players[0].spice, before - 2);
  assert.equal(returned.players[0].reserves, 18);
  g = applyAction(g, 'p0', { ...action, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.players[0].spice, before - 2);
  assert.equal(g.players[0].forces['sietch_tabr:14'], 3);
  conservation(g);
});

void test('allies may fund bids beyond personal spice, with private amounts and escrowed payment', () => {
  let g = started(['atreides', 'fremen', 'emperor']);
  g.phase = 3;
  g.order = ['p0', 'p1', 'p2'];
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[0].spice = 1;
  g.players[1].spice = 10;
  g.players.forEach((p) => (p.hand = []));
  g.auction = {
    cards: [baseDeck()[0]],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'p0',
    passed: [],
    opener: 0,
  };
  const emperorSpice = g.players[2].spice;
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 6 });
  assert.equal(g.players[1].spice, 4);
  assert.deepEqual(viewGame(g, 'p0').aid, { pledged: 0, available: 6 });
  assert.deepEqual(viewGame(g, 'p2').aid, { pledged: 0, available: 0 });
  assert.throws(
    () => applyAction(g, 'p0', { type: 'bid', amount: 8 }),
    /integer/,
  );
  g = applyAction(g, 'p0', { type: 'bid', amount: 5 });
  assert.equal(g.auction!.allyPayment, 4);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'pledgeAid', amount: 3 }),
    /integer/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'bribe', target: 'p2', amount: 1 }),
    /integer/,
  );
  g = applyAction(g, 'p1', { type: 'passBid' });
  g = applyAction(g, 'p2', { type: 'passBid' });
  assert.notEqual(g.decision?.kind, 'auctionPayment');
  g = passResponses(g);
  assert.equal(g.phase, 4);
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[1].spice, 6);
  assert.equal(g.players[2].spice, emperorSpice + 5);
  assert.deepEqual(g.aid, {});
});

void test('unused alliance funding is revocable but an outstanding bid remains funded', () => {
  let g = started(['atreides', 'fremen', 'emperor']);
  g.phase = 3;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[1].spice = 10;
  g.order = ['p0', 'p1', 'p2'];
  g.auction = {
    cards: [baseDeck()[0]],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'p0',
    passed: [],
    opener: 0,
  };
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 6 });
  g = applyAction(g, 'p0', { type: 'bid', amount: 4, allyPayment: 3 });
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 3 });
  assert.equal(g.players[1].spice, 7);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'pledgeAid', amount: 10 }),
    /integer/,
  );
  g = applyAction(g, 'p1', { type: 'passBid' });
  g = applyAction(g, 'p2', { type: 'bid', amount: 5 });
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 0 });
  assert.equal(g.players[1].spice, 10);
});

void test('ally shipment funding charges the selected share and refunds unused pledge at phase end', () => {
  let g = started(['atreides', 'fremen', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g.order = ['p0', 'p1', 'p2'];
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[1].spice = 10;
  const guild = g.players[2].spice;
  assert.throws(
    () => applyAction(g, 'p2', { type: 'pledgeAid', amount: 1 }),
    /fund an ally/,
  );
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 6 });
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 4,
    allyPayment: 3,
  });
  assert.equal(g.players[0].spice, 9);
  assert.equal(g.players[1].spice, 4);
  assert.equal(g.aid.p1.amount, 3);
  g = passResponses(g);
  assert.equal(g.players[2].spice, guild + 4);
  for (const id of g.order) g = applyAction(g, id, { type: 'endMovement' });
  assert.equal(g.players[1].spice, 7);
  assert.deepEqual(g.aid, {});
  conservation(g);
});

void test('Harkonnen may reveal a traitor for their ally and the battle waits for their choice', () => {
  let g = started(['atreides', 'emperor', 'harkonnen']);
  g.phase = 6;
  g.order = ['p0', 'p1', 'p2'];
  g.active = 'p0';
  g.players[0].ally = 'p2';
  g.players[2].ally = 'p0';
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players[1].reserves = 10;
  g.players[2].traitors = ['emperor-0'];
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  g = plan(plan(g, 'p0', 7), 'p1', 8);
  g = resolve(g);
  assert.ok(g.battle, 'Harkonnen has not made its own choice yet');
  assert.deepEqual(viewGame(g, 'p2').battle!.traitorVoters, ['p0', 'p1', 'p2']);
  assert.equal(g.players[1].tanks, 0);
  const declined = applyAction(g, 'p2', { type: 'traitorCall', call: false });
  assert.equal(declined.players[0].tanks, 10);
  g = power(g, 'p2', { type: 'traitorCall', call: true });
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[2].spice, 10);
  conservation(g);
});

void test('ordinary allies cannot call traitors for one another', () => {
  let g = started(['atreides', 'emperor', 'fremen']);
  g.phase = 6;
  g.order = ['p0', 'p1', 'p2'];
  g.active = 'p0';
  g.players[0].ally = 'p2';
  g.players[2].ally = 'p0';
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players[2].traitors = ['emperor-0'];
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  g = plan(plan(g, 'p0'), 'p1');
  assert.deepEqual(viewGame(g, 'p2').battle!.traitorVoters, ['p0', 'p1']);
  assert.throws(
    () => applyAction(g, 'p2', { type: 'traitorCall', call: true }),
    /not available/,
  );
});

function preparationBattle(
  factions: FactionId[] = ['atreides', 'beneGesserit', 'emperor'],
) {
  const g = started(factions);
  g.phase = 6;
  g.active = 'p0';
  g.order = g.players.map((p) => p.id);
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players[1].reserves = 10;
  g.players.forEach((p) => (p.hand = []));
  return applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
}

void test('Voice has a guaranteed window before Atreides prescience and battle plans', () => {
  let g = preparationBattle();
  assert.equal(g.battle!.preparation!.kind, 'voice');
  assert.equal(g.battle!.preparation!.owner, 'p1');
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'battlePlan',
        dial: 0,
        leader: 'atreides-0',
      }),
    /not available/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'prescience', field: 'weapon' }),
    /Voice decision/,
  );
  assert.throws(
    () => applyAction(g, 'p0', { type: 'declineBattlePower' }),
    /do not own/,
  );
  g = power(g, 'p1', { type: 'voice', kind: 'poison', must: false });
  assert.equal(g.battle!.preparation!.kind, 'prescience');
  assert.equal(g.battle!.voice!.target, 'p0');
  assert.throws(
    () => applyAction(g, 'p1', { type: 'voice', kind: 'shield', must: false }),
    /before prescience/,
  );
  g = applyAction(g, 'p0', { type: 'declineBattlePower' });
  assert.equal(g.battle!.preparation, undefined);
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  g.players[0].hand = [poison];
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'battlePlan',
        dial: 0,
        leader: 'atreides-0',
        weapon: poison.id,
      }),
    /Voice/,
  );
});

void test('prescience reveals exactly one element, hides it from spectators, and leaves other elements flexible', () => {
  let g = preparationBattle();
  g = applyAction(g, 'p1', { type: 'declineBattlePower' });
  const weapon = baseDeck().find((c) => c.kind === 'poison')!;
  const defense = baseDeck().find((c) => c.kind === 'shield')!;
  g.players[1].hand = [weapon, defense];
  g = power(g, 'p0', { type: 'prescience', field: 'weapon' });
  assert.throws(
    () => applyAction(g, 'p0', { type: 'prescienceAnswer', value: weapon.id }),
    /not revealing/,
  );
  g = applyAction(g, 'p1', { type: 'prescienceAnswer', value: weapon.id });
  assert.deepEqual(g.battle!.plans, {});
  assert.equal(viewGame(g, 'p0').battle!.insight!.value, weapon.id);
  assert.equal(viewGame(g, 'p0').battle!.insight!.label, weapon.name);
  assert.equal(viewGame(g, 'p1').battle!.insight!.value, weapon.id);
  assert.equal(viewGame(g, 'p2').battle!.insight, null);
  assert.equal('value' in viewGame(g, 'p2').battle!.prescience!, false);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'prescienceAnswer', value: null }),
    /not revealing/,
  );
  assert.throws(() => plan(g, 'p1', 0), /remain unchanged/);
  g = plan(g, 'p1', 7, {
    weapon: weapon.id,
    defense: defense.id,
    leader: 'beneGesserit-3',
  });
  const view = viewGame(g, 'p0');
  assert.equal(view.battle!.plans.p1, undefined);
  assert.equal(view.battle!.insight!.value, weapon.id);
  g = plan(g, 'p0', 3);
  assert.equal(g.battle!.revealed, true);
  assert.equal(g.battle!.plans.p1.leader, 'beneGesserit-3');
  assert.equal(g.battle!.plans.p1.dial, 7);
});

void test('a prescience answer must permit a legal plan under the preceding Voice', () => {
  let g = preparationBattle();
  // BG fights Atreides: require Atreides to use poison, then Atreides asks BG about its weapon.
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  const defense = baseDeck().find((c) => c.kind === 'shield')!;
  g.players[1].hand = [defense];
  g = power(g, 'p1', { type: 'voice', kind: 'poison', must: true });
  g = power(g, 'p0', { type: 'prescience', field: 'weapon' });
  assert.throws(
    () => applyAction(g, 'p1', { type: 'prescienceAnswer', value: defense.id }),
    /legal battle plan/,
  );
  assert.throws(
    () => applyAction(g, 'p1', { type: 'prescienceAnswer', value: poison.id }),
    /legal battle plan/,
  );
  g = applyAction(g, 'p1', { type: 'prescienceAnswer', value: null });
  assert.equal(viewGame(g, 'p0').battle!.insight!.value, null);
  g.players[1].hand.push(poison);
  assert.throws(
    () => plan(g, 'p1', 0, { weapon: poison.id }),
    /remain unchanged/,
  );
  // Atreides has no poison: the impossible mandatory Voice does not block a legal plan.
  g = plan(g, 'p0', 0);
  assert.ok(g.battle!.plans.p0);
});

void test('remote BG and Atreides owners explicitly choose whether to help an ally', () => {
  let g = started(['emperor', 'guild', 'beneGesserit', 'atreides']);
  g.phase = 6;
  g.order = g.players.map((p) => p.id);
  g.active = 'p0';
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].forces = { 'arrakeen:10': 5 };
  g.players[0].ally = 'p2';
  g.players[2].ally = 'p0';
  g.players[1].ally = 'p3';
  g.players[3].ally = 'p1';
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  assert.equal(g.battle!.preparation!.owner, 'p2');
  assert.throws(
    () => applyAction(g, 'p0', { type: 'voice', kind: 'hero', must: false }),
    /Bene Gesserit/,
  );
  g = power(g, 'p2', { type: 'voice', kind: 'hero', must: false });
  assert.equal(g.battle!.voice!.target, 'p1');
  assert.equal(g.battle!.preparation!.owner, 'p3');
  assert.throws(
    () => applyAction(g, 'p1', { type: 'prescience', field: 'dial' }),
    /not available/,
  );
  g = power(g, 'p3', { type: 'prescience', field: 'dial' });
  assert.equal(g.battle!.prescience!.player, 'p1');
  assert.equal(g.battle!.preparation!.owner, 'p0');
  g = applyAction(g, 'p0', { type: 'prescienceAnswer', value: 4 });
  assert.equal(viewGame(g, 'p1').battle!.insight!.value, 4);
  assert.equal(viewGame(g, 'p2').battle!.insight, null);
  assert.equal(
    viewGame(g, 'p3').battle!.insight,
    null,
    'The element is shown to the ally, not automatically shared with its owner',
  );
  assert.throws(() => plan(g, 'p0', 3), /remain unchanged/);
  g = plan(g, 'p0', 4);
  assert.equal(g.battle!.plans.p0.dial, 4);
});

void test('Voice and prescience together cannot commit an impossible element', () => {
  let g = started(['emperor', 'atreides', 'beneGesserit']);
  g.phase = 6;
  g.order = ['p0', 'p1', 'p2'];
  g.active = 'p0';
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].ally = 'p2';
  g.players[2].ally = 'p1';
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  g.players[0].hand = [poison];
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  g = power(g, 'p2', { type: 'voice', kind: 'poison', must: true });
  g = power(g, 'p1', { type: 'prescience', field: 'weapon' });
  assert.throws(
    () => applyAction(g, 'p0', { type: 'prescienceAnswer', value: null }),
    /legal battle plan/,
  );
  g = applyAction(g, 'p0', { type: 'prescienceAnswer', value: poison.id });
  g = plan(g, 'p0', 0, { weapon: poison.id });
  assert.equal(g.battle!.plans.p0.weapon, poison.id);
});

void test('forbidding Cheap Hero lets a leaderless opponent fight without treachery', () => {
  let g = preparationBattle();
  const hero = baseDeck().find((c) => c.kind === 'hero')!;
  g.players[0].hand = [hero];
  g.players[0].leaders.forEach((l) => (l.dead = true));
  g = power(g, 'p1', { type: 'voice', kind: 'hero', must: false });
  g = applyAction(g, 'p0', { type: 'declineBattlePower' });
  g = applyAction(g, 'p0', { type: 'battlePlan', dial: 0, leader: null });
  assert.equal(g.battle!.plans.p0.leader, null);
});

void test('legacy pending prescience resumes without losing secrets or mutating a read', () => {
  const g = combat();
  delete g.battle!.prepared;
  delete g.battle!.preparation;
  g.battle!.prescience = { player: 'p0', field: 'dial' };
  const original = structuredClone(g);
  const view = viewGame(g, 'p1');
  assert.equal(view.battle!.preparation!.kind, 'prescienceAnswer');
  assert.deepEqual(g, original);
  const next = applyAction(g, 'p1', { type: 'prescienceAnswer', value: 2 });
  assert.equal(viewGame(next, 'p0').battle!.insight!.value, 2);
  assert.equal(next.battle!.prepared, true);
});

void test('storm distance is public before movement, allowing Weather Control after dials', () => {
  let g = started();
  const weather = baseDeck().find((c) => c.effect === 'weather')!;
  placeFixtureHand(g, 0, [weather]);
  g = applyAction(g, 'p0', { type: 'stormDial', amount: 3 });
  assert.equal(viewGame(g, 'p1').stormRevealed, null);
  g = applyAction(g, 'p1', { type: 'stormDial', amount: 4 });
  assert.deepEqual(viewGame(g, 'p0').stormRevealed, { p0: 3, p1: 4 });
  assert.equal(g.storm, 1);
  assert.equal(g.stormPending, 7);
  g = applyAction(g, 'p1', { type: 'ready' });
  g = applyAction(g, 'p0', { type: 'card', card: weather.id, amount: 2 });
  assert.deepEqual(g.ready, []);
  assert.equal(g.stormPending, 2);
  assert.equal(g.storm, 1);
  g = readyAll(g);
  assert.equal(g.storm, 3);
  assert.equal(g.phase, 1);
  assert.equal(g.stormPending, null);
  assert.ok(g.discard.some((c) => c.id === weather.id));
});

void test('Family Atomics can follow revealed dials or Weather Control before storm movement', () => {
  let g = started();
  const weather = baseDeck().find((c) => c.effect === 'weather')!;
  const atomics = baseDeck().find((c) => c.effect === 'atomics')!;
  placeFixtureHand(g, 0, [weather, atomics]);
  g.players[0].forces = { 'shield_wall:8': 1, 'arrakeen:10': 9 };
  g.storm = 7;
  g.turn = 2;
  g = applyAction(g, 'p0', { type: 'stormDial', amount: 2 });
  g = applyAction(g, 'p1', { type: 'stormDial', amount: 2 });
  g = applyAction(g, 'p0', { type: 'card', card: weather.id, amount: 3 });
  g = applyAction(g, 'p1', { type: 'ready' });
  g = applyAction(g, 'p0', { type: 'card', card: atomics.id });
  assert.deepEqual(g.ready, []);
  assert.equal(g.shieldWallDestroyed, true);
  assert.equal(g.players[0].tanks, 1);
  assert.equal(g.players[0].forces['arrakeen:10'], 9);
  g = readyAll(g);
  assert.equal(g.storm, 10);
  assert.equal(g.players[0].tanks, 10);
  conservation(g);
});

void test('Weather Control before dialing replaces the dials, including zero movement', () => {
  let g = started();
  const weather = baseDeck().find((c) => c.effect === 'weather')!;
  placeFixtureHand(g, 0, [weather]);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'ready' }),
    /current phase action/,
  );
  g = applyAction(g, 'p0', { type: 'card', card: weather.id, amount: 0 });
  assert.equal(g.stormPending, 0);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'stormDial', amount: 2 }),
    /not dialing/,
  );
  g = readyAll(g);
  assert.equal(g.storm, 1);
  assert.equal(g.phase, 1);
});

void test('Harvester doubles only the new blow and resets acceptance before Nexus or charity', () => {
  let g = started();
  const harvester = baseDeck().find((c) => c.effect === 'harvester')!;
  placeFixtureHand(g, 0, [harvester]);
  g.phase = 1;
  g.spice = { 'red_chasm:7': 3 };
  g.spiceDeck = [{ territory: 'red_chasm', amount: 8, sector: 7 }];
  assert.throws(
    () => applyAction(g, 'p0', { type: 'card', card: harvester.id }),
    /immediately after/,
  );
  g = readyAll(g, false);
  assert.equal(g.phase, 1);
  assert.equal(g.spice['red_chasm:7'], 11);
  g = applyAction(g, 'p1', { type: 'ready' });
  g = applyAction(g, 'p0', { type: 'card', card: harvester.id });
  assert.equal(g.spice['red_chasm:7'], 19);
  assert.equal(g.spiceWindow!.amount, 16);
  assert.deepEqual(g.ready, []);
  g = readyAll(g);
  assert.equal(g.phase, 2);
  assert.equal(g.spiceWindow, null);
  assert.ok(g.discard.some((c) => c.id === harvester.id));
});

void test('Harvester cannot rescue spice from storm or be used later during collection', () => {
  let g = started();
  const harvester = baseDeck().find((c) => c.effect === 'harvester')!;
  placeFixtureHand(g, 0, [harvester]);
  g.phase = 1;
  g.storm = 7;
  g.spiceDeck = [{ territory: 'red_chasm', amount: 8, sector: 7 }];
  g = readyAll(g, false);
  const later = readyAll(g);
  assert.throws(
    () => applyAction(later, 'p0', { type: 'card', card: harvester.id }),
    /immediately after/,
  );
  g = applyAction(g, 'p0', { type: 'card', card: harvester.id });
  assert.equal(g.spice['red_chasm:7'], undefined);
  g = readyAll(g);
  assert.equal(g.phase, 2);
});

void test('Nexus opens after the spice response window and cannot be used early', () => {
  const scenario = wormScenario();
  let g = power(readyAll(scenario.g), 'p0', {
    type: 'decision',
    accept: true,
  });
  assert.ok(g.spiceWindow);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'alliance', target: 'p2' }),
    /only during a Nexus/,
  );
  g = readyAll(g);
  assert.equal(g.phase, 1);
  assert.equal(g.spiceWindow, null);
  assert.deepEqual(g.ready, []);
});

function karamaAuction(factions: FactionId[] = ['atreides', 'emperor']) {
  const g = started(factions);
  g.phase = 3;
  g.order = g.players.map((p) => p.id);
  g.active = 'p0';
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].spice = 2;
  g.players[1].hand = [];
  // Relocate the selected physical cards out of the shuffled setup deck.
  placeFixtureHand(g, 0, [karama, baseDeck()[0]]);
  const auctionCard = g.players[0].hand.pop()!;
  g.auction = {
    cards: [auctionCard],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'p0',
    passed: [],
    opener: 0,
  };
  return { g, karama };
}

void test('holding Karama permits bids above spice and the winner can spend it without paying', () => {
  const scenario = karamaAuction();
  let g = applyAction(scenario.g, 'p0', { type: 'bid', amount: 100 });
  const emperorSpice = g.players[1].spice;
  g = applyAction(g, 'p1', { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  assert.equal(g.players[0].hand[0].id, scenario.karama.id);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'decision', karama: false }),
    /no longer funded/,
  );
  g = applyAction(g, 'p0', { type: 'decision', karama: true });
  assert.equal(g.phase, 4);
  assert.equal(g.players[0].spice, 2);
  assert.equal(g.players[1].spice, emperorSpice);
  assert.equal(g.players[0].hand[0].id, baseDeck()[0].id);
  assert.ok(g.discard.some((c) => c.id === scenario.karama.id));
});

void test('a bidder who loses keeps its Karama and the winner can choose ordinary payment', () => {
  const scenario = karamaAuction();
  const winnerKarama = baseDeck().find(
    (c) => c.effect === 'karama' && c.id !== scenario.karama.id,
  )!;
  scenario.g.deck = scenario.g.deck.filter((c) => c.id !== winnerKarama.id);
  scenario.g.players[1].hand = [winnerKarama];
  let g = applyAction(scenario.g, 'p0', { type: 'bid', amount: 5 });
  g = applyAction(g, 'p1', { type: 'bid', amount: 6 });
  g = applyAction(g, 'p0', { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  assert.throws(
    () =>
      applyAction(g, 'p1', {
        type: 'decision',
        karama: true,
        card: scenario.karama.id,
      }),
    /do not hold/,
  );
  g = passResponses(applyAction(g, 'p1', { type: 'decision', karama: false }));
  assert.ok(g.players[0].hand.some((c) => c.id === scenario.karama.id));
  assert.equal(g.players[0].spice, 2);
  assert.equal(g.players[1].spice, 4);
  assert.ok(
    g.players[1].hand.some((c) => c.id === winnerKarama.id),
    'choosing spice retains the winner’s Karama',
  );
});

void test('Karama can take an auction card out of bidding order, but cannot bypass full hands', () => {
  const scenario = karamaAuction();
  scenario.g.auction!.active = 'p1';
  const full = structuredClone(scenario.g);
  full.players[0].hand.push(
    ...baseDeck()
      .filter((c) => c.kind === 'worthless')
      .slice(0, 3),
  );
  assert.throws(
    () =>
      applyAction(full, 'p0', {
        type: 'card',
        card: scenario.karama.id,
        mode: 'purchase',
      }),
    /eligible to bid/,
  );
  const g = applyAction(scenario.g, 'p0', {
    type: 'card',
    card: scenario.karama.id,
    mode: 'purchase',
  });
  assert.equal(g.players[0].spice, 2);
  assert.equal(g.players[0].hand[0].id, baseDeck()[0].id);
  assert.equal(g.phase, 4);
});

void test('Harkonnen receives the extra card when buying with Karama', () => {
  const scenario = karamaAuction(['harkonnen', 'emperor']);
  const before = scenario.g.deck[0];
  let g = applyAction(scenario.g, 'p0', {
    type: 'card',
    card: scenario.karama.id,
    mode: 'purchase',
  });
  g = passResponses(g);
  assert.equal(g.players[0].hand.length, 2);
  assert.ok(g.players[0].hand.some((c) => c.id === before.id));
});

void test('Karama cancels one Voice before plans can lock, without canceling prescience', () => {
  let g = preparationBattle();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  g.players[0].hand = [karama, poison];
  const voiced = applyAction(g, 'p1', {
    type: 'voice',
    kind: 'poison',
    must: false,
  });
  assert.equal(voiced.response!.kind, 'voice');
  assert.throws(
    () =>
      applyAction(voiced, 'p0', {
        type: 'battlePlan',
        dial: 0,
        leader: 'atreides-0',
      }),
    /response window/,
  );
  g = applyAction(voiced, 'p0', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(g.response, null);
  assert.equal(g.battle!.voice, undefined);
  assert.equal(g.battle!.preparation!.kind, 'prescience');
  g = plan(g, 'p0', 0, { weapon: poison.id });
  assert.equal(g.battle!.plans.p0.weapon, poison.id);
  assert.ok(g.discard.some((c) => c.id === karama.id));
});

void test('prescience can be canceled before its answer and no information leaks', () => {
  let g = preparationBattle();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[2].hand = [karama];
  g = applyAction(g, 'p1', { type: 'declineBattlePower' });
  const asked = applyAction(g, 'p0', { type: 'prescience', field: 'dial' });
  assert.equal(asked.response!.kind, 'prescience');
  assert.throws(
    () => applyAction(asked, 'p1', { type: 'prescienceAnswer', value: 2 }),
    /response window/,
  );
  g = applyAction(asked, 'p2', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(g.battle!.preparation, undefined);
  assert.equal(viewGame(g, 'p0').battle!.insight, null);
  assert.equal(g.battle!.prescience, undefined);
  g = plan(g, 'p1', 5);
  assert.equal(g.battle!.plans.p1.dial, 5);
});

void test('Karama cancels a chosen spiritual advisor before the reserve is deployed', () => {
  let g = started(['atreides', 'beneGesserit']);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [karama];
  g.phase = 5;
  g.active = 'p0';
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  g = applyAction(g, 'p1', { type: 'decision', accept: true });
  assert.equal(g.players[1].reserves, 19);
  assert.equal(g.response!.kind, 'advisor');
  g = applyAction(g, 'p0', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[1].reserves, 19);
  assert.equal(g.players[1].forces['polar_sink:0'], 1);
  assert.equal(g.players[0].shipped, true);
  conservation(g);
});

void test('a response cannot be skipped, paid for with another player’s card, or canceled by its owner', () => {
  let g = preparationBattle();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g.players[2].hand = [
    baseDeck().find((c) => c.effect === 'karama' && c.id !== karama.id)!,
  ];
  g = applyAction(g, 'p1', { type: 'voice', kind: 'hero', must: false });
  assert.throws(
    () =>
      applyAction(g, 'p1', { type: 'card', card: karama.id, mode: 'cancel' }),
    /another faction/,
  );
  assert.throws(
    () =>
      applyAction(g, 'p0', { type: 'card', card: karama.id, mode: 'cancel' }),
    /in your hand/,
  );
  g = applyAction(g, 'p0', { type: 'passResponse' });
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'passResponse' }),
    /already passed/,
  );
  assert.deepEqual(g, before);
  g = passResponses(g);
  assert.equal(g.response, null);
  assert.ok(g.battle!.voice);
});

void test('canceling Emperor income sends the paid spice to the bank and still delivers the card', () => {
  const scenario = karamaAuction();
  let g = applyAction(scenario.g, 'p0', { type: 'bid', amount: 1 });
  g = applyAction(g, 'p1', { type: 'passBid' });
  g = applyAction(g, 'p0', { type: 'decision', karama: false });
  assert.equal(g.response!.kind, 'emperorIncome');
  assert.equal(g.players[1].spice, 10);
  g = applyAction(g, 'p0', {
    type: 'card',
    card: scenario.karama.id,
    mode: 'cancel',
  });
  assert.equal(g.players[0].spice, 1);
  assert.equal(g.players[1].spice, 10);
  assert.ok(g.players[0].hand.some((c) => c.id === baseDeck()[0].id));
  assert.equal(g.phase, 4);
});

void test('canceling the Harkonnen bonus keeps the bonus card hidden and in the deck', () => {
  const scenario = karamaAuction(['harkonnen', 'emperor']);
  const second = baseDeck().filter((c) => c.effect === 'karama')[1];
  scenario.g.players[1].hand = [second];
  const originalDeck = structuredClone(scenario.g.deck);
  let g = applyAction(scenario.g, 'p0', {
    type: 'card',
    card: scenario.karama.id,
    mode: 'purchase',
  });
  assert.equal(g.response!.kind, 'harkonnenBonus');
  assert.equal(g.players[0].hand.length, 1);
  g = applyAction(g, 'p1', { type: 'card', card: second.id, mode: 'cancel' });
  assert.equal(g.players[0].hand.length, 1);
  assert.deepEqual(g.deck, originalDeck);
  assert.equal(g.phase, 4);
});

void test('Fremen starting forces can split between sectors and reject invalid setup atomically', () => {
  let g = lobby(['fremen', 'atreides']);
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'p0', { type: 'start' });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });

  const west = TERRITORIES.find((t) => t.id === 'false_wall_west')!;
  assert.ok(west.sectors.length > 1);
  const placements = {
    [`false_wall_west:${west.sectors[0]}`]: 4,
    [`false_wall_west:${west.sectors[1]}`]: 6,
  };
  for (const bad of [
    { 'arrakeen:10': 10 },
    { 'false_wall_west:0': 10 },
    { ...placements, unknown: 0 },
    { [Object.keys(placements)[0]]: 9 },
  ]) {
    const original = structuredClone(g);
    assert.throws(() =>
      applyAction(g, 'p0', { type: 'fremenSetup', placements: bad }),
    );
    assert.deepEqual(g, original);
  }
  g = applyAction(g, 'p0', { type: 'fremenSetup', placements });
  assert.deepEqual(g.players[0].forces, placements);
  assert.equal(g.players[0].reserves, 10);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'fremenSetup', placements }),
    /not available|already complete/,
  );
  conservation(g);
});

void test('Karama shipment pays rounded Guild rates to the bank and is consumed once', () => {
  let g = started(['atreides', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g.order = ['p0', 'p1'];
  g.storm = 18;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [card];
  const before = g.players.map((p) => p.spice);
  g = applyAction(g, 'p0', { type: 'card', card: card.id, mode: 'shipment' });
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
  });
  assert.equal(g.players[0].spice, before[0] - 2);
  assert.equal(g.players[1].spice, before[1]);
  assert.equal(g.karamaShipping, null);
  assert.ok(g.discard.some((c) => c.id === card.id));
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'arrakeen',
        sector: 10,
        amount: 1,
      }),
    /once/,
  );
  conservation(g);
});

void test('Karama may sponsor another player while that player controls the shipment and normal income resumes', () => {
  let g = started(['atreides', 'guild', 'harkonnen']);
  g.phase = 5;
  g.active = 'p2';
  g.order = ['p2', 'p0', 'p1'];
  g.storm = 18;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [card];
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'card',
        card: card.id,
        mode: 'shipment',
        target: 'p0',
      }),
    /active player/,
  );
  g = applyAction(g, 'p0', {
    type: 'card',
    card: card.id,
    mode: 'shipment',
    target: 'p2',
  });
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 3,
      }),
    /once/,
  );
  const payer = g.players[2].spice,
    guild = g.players[1].spice;
  g = applyAction(g, 'p2', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 3,
  });
  assert.equal(g.players[2].spice, payer - 2);
  assert.equal(g.players[1].spice, guild);
  g = applyAction(g, 'p2', { type: 'endMovement' });
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  g = passResponses(g);
  assert.equal(g.players[1].spice, guild + 2);
  conservation(g);
});

void test('an unused Karama shipment cannot carry over after movement or the end of a turn', () => {
  let g = started(['atreides', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g.order = ['p0', 'p1'];
  g.storm = 18;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [card];
  g = applyAction(g, 'p0', { type: 'card', card: card.id, mode: 'shipment' });
  const moved = applyAction(g, 'p0', {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  assert.equal(moved.karamaShipping, null);
  const ended = applyAction(g, 'p0', { type: 'endMovement' });
  assert.equal(ended.karamaShipping, null);
});

void test('Karama cancels a single Guild payment without undoing shipment or the BG decision', () => {
  let g = started(['atreides', 'guild', 'beneGesserit']);
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand = [card];
  const income = g.players[1].spice;
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
  });
  assert.equal(g.response?.kind, 'guildIncome');
  assert.equal(g.players[1].spice, income);
  assert.equal(g.decision?.kind, 'advisor');
  assert.throws(
    () => applyAction(g, 'p0', { type: 'endMovement' }),
    /response window/,
  );
  g = applyAction(g, 'p0', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.players[1].spice, income);
  assert.equal(g.players[0].spice, 7);
  assert.equal(g.players[0].forces['arrakeen:10'], 13);
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(g, 'p2', { type: 'decision', accept: false });
  conservation(g);
});

void test('Karama cancels Harkonnen ally traitor support but cannot cancel their own traitor victory', () => {
  let g = started(['atreides', 'emperor', 'harkonnen']);
  g.phase = 6;
  g.active = 'p0';
  g.storm = 18;
  g.order = ['p0', 'p1', 'p2'];
  g.players[0].ally = 'p2';
  g.players[2].ally = 'p0';
  g.players[0].forces = { 'arrakeen:10': 10 };
  g.players[1].forces = { 'arrakeen:10': 10 };
  g.players[1].reserves = 10;
  g.players[2].traitors = ['emperor-0'];
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [card];
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  g = plan(plan(g, 'p0', 0), 'p1', 8);
  g = resolve(g);
  g = applyAction(g, 'p2', { type: 'traitorCall', call: true });
  assert.equal(g.response?.kind, 'harkonnenTraitor');
  assert.equal(g.players[1].tanks, 0);
  g = applyAction(g, 'p1', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[1].tanks, 8);
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.ok(g.players[2].traitors.includes('emperor-0'));
  conservation(g);

  let own = combat();
  own.players[1].traitors = [own.players[0].leaders[0].id];
  own = plan(plan(own, 'p0', 1), 'p1', 1);
  own = applyAction(own, 'p0', { type: 'traitorCall', call: false });
  own = applyAction(own, 'p1', { type: 'traitorCall', call: true });
  assert.equal(own.response, null);
  assert.equal(own.players[0].tanks, 10);
});

void test('Emperor gifts become spendable immediately, stay private, and can be canceled once', () => {
  let g = started(['emperor', 'atreides', 'harkonnen']);
  g.phase = 3;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[2].hand = [card];
  g = applyAction(g, 'p0', { type: 'emperorGift', amount: 3 });
  assert.equal(g.players[1].spice, 10);
  assert.equal(viewGame(g, 'p2').response?.amount, undefined);
  assert.equal(viewGame(g, 'p1').response?.amount, 3);
  g = applyAction(g, 'p2', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[1].spice, 10);
  g = power(g, 'p0', { type: 'emperorGift', amount: 4 });
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[1].bribes, 0);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'emperorGift', amount: 1 }),
    /Emperor/,
  );
  assert.throws(() => applyAction(g, 'p0', { type: 'emperorGift', amount: 7 }));
});

void test('Emperor extra revivals cost two each and allow six total without using normal free revivals', () => {
  let g = started(['emperor', 'atreides']);
  g.phase = 4;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[1].reserves = 0;
  g.players[1].tanks = 10;
  g = power(g, 'p0', { type: 'emperorRevival', amount: 2 });
  g = power(g, 'p0', { type: 'emperorRevival', amount: 1 });
  assert.equal(g.players[0].spice, 4);
  assert.equal(g.players[1].revived, 0);
  assert.equal(g.emperorExtra.p1, 3);
  g = applyAction(g, 'p1', { type: 'revive', amount: 3 });
  assert.equal(g.players[1].spice, 8);
  assert.equal(g.players[1].reserves, 6);
  assert.equal(g.players[1].tanks, 4);
  assert.throws(() =>
    applyAction(g, 'p0', { type: 'emperorRevival', amount: 1 }),
  );
  assert.throws(() => applyAction(g, 'p1', { type: 'revive', amount: 1 }));
  conservation(g);
});

void test('canceling Emperor extra revival spends no spice or quota and preserves eligible tanks', () => {
  let g = started(['emperor', 'fremen', 'atreides']);
  g.phase = 4;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[1].reserves = 0;
  g.players[1].tanks = 10;
  const card = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[2].hand = [card];
  g = applyAction(g, 'p0', { type: 'emperorRevival', amount: 3 });
  g = applyAction(g, 'p2', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.emperorExtra.p1, undefined);
  g = power(g, 'p0', { type: 'emperorRevival', amount: 3 });
  g = applyAction(g, 'p1', { type: 'revive', amount: 3 });
  assert.equal(g.players[1].reserves, 6);
  assert.equal(g.players[1].spice, 3);
  conservation(g);
});

void test('Guild allies pay rounded half rates on ordinary shipment and Guild receives that payment', () => {
  let g = started(['atreides', 'guild']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
  });
  assert.equal(g.players[0].spice, 8);
  assert.equal(g.response, null);
  assert.equal(g.players[1].spice, 7);
  g = passResponses(g);
  assert.equal(g.players[1].spice, 7);
  conservation(g);
});

void test('allied cross-shipment pays Guild, combines sectors and does not trigger a BG free force', () => {
  let g = started(['atreides', 'guild', 'beneGesserit']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[0].forces = { 'imperial_basin:10': 4, 'imperial_basin:11': 6 };
  const guild = g.players[1].spice;
  g = applyAction(g, 'p0', {
    type: 'guildShip',
    forces: { 'imperial_basin:10': 2, 'imperial_basin:11': 3 },
    territory: 'carthag',
    sector: 11,
  });
  assert.equal(g.players[0].spice, 7);
  assert.equal(g.players[1].spice, guild + 3);
  assert.equal(g.players[0].forces['carthag:11'], 5);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  g = passResponses(g);
  assert.equal(g.players[1].spice, guild + 3);
  conservation(g);
});

void test('Guild allies cannot return forces to reserves or transport through storm and lose privileges when unallied', () => {
  const g = started(['atreides', 'guild']);
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'guildShip',
        from: 'arrakeen:10',
        territory: 'reserves',
        amount: 1,
      }),
    /Only the Guild/,
  );
  g.storm = 10;
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'guildShip',
        from: 'arrakeen:10',
        territory: 'carthag',
        sector: 11,
        amount: 1,
      }),
    /storm/,
  );
  g.storm = 11;
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'guildShip',
        from: 'arrakeen:10',
        territory: 'carthag',
        sector: 11,
        amount: 1,
      }),
    /storm/,
  );
  g.storm = 18;
  g.players[0].ally = null;
  g.players[1].ally = null;
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'guildShip',
        from: 'arrakeen:10',
        territory: 'carthag',
        sector: 11,
        amount: 1,
      }),
    /not available/,
  );
});

void test('Fremen allied to Guild can pay for distant southern-reserve transport without off-planet effects', () => {
  let g = started(['fremen', 'guild', 'beneGesserit']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g.players[0].spice = 10;
  const guild = g.players[1].spice;
  g = applyAction(g, 'p0', {
    type: 'guildShip',
    from: 'reserves',
    territory: 'carthag',
    sector: 11,
    amount: 3,
  });
  assert.equal(g.players[0].spice, 8);
  assert.equal(g.players[0].reserves, 7);
  assert.equal(g.players[0].forces['carthag:11'], 3);
  assert.equal(g.players[1].spice, guild + 2);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  g = passResponses(g);
  assert.equal(g.players[1].spice, guild + 2);
  conservation(g);
});

function advancedCombat() {
  let g = started(['emperor', 'atreides']);
  g.advanced = true;
  g.phase = 6;
  g.storm = 18;
  g.active = 'p0';
  g.order = ['p0', 'p1'];
  g.players[0].forces = { 'arrakeen:10': 6 };
  g.players[0].reserves = 14;
  g.players[0].elites = {
    forces: { 'arrakeen:10': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  return passResponses(g);
}
void test('advanced battle charges spice, preserves hidden support and waits for the winner casualty choice', () => {
  let g = advancedCombat();
  g = plan(g, 'p0', 3, { support: 1 });
  assert.equal(viewGame(g, 'p1').battle!.plans.p0, undefined);
  g = plan(g, 'p1', 0, { support: 0 });
  g = resolve(g);
  assert.equal(g.decision?.kind, 'battleLosses');
  assert.equal(g.players[0].spice, 9);
  assert.equal(g.players[0].forces['arrakeen:10'], 6);
  assert.equal(g.players[1].tanks, 10);
  assert.throws(
    () => applyAction(g, 'p1', { type: 'decision', choice: 0 }),
    /pending decision/,
  );
  if (g.decision?.kind !== 'battleLosses')
    throw new Error('Missing casualties');
  const eliteChoice = g.decision.options.findIndex(
    (o) => o.normal === 2 && o.elite === 1,
  );
  const normalChoice = g.decision.options.findIndex(
    (o) => o.normal === 5 && o.elite === 0,
  );
  const a = applyAction(g, 'p0', { type: 'decision', choice: eliteChoice });
  const b = applyAction(g, 'p0', { type: 'decision', choice: normalChoice });
  assert.equal(a.players[0].forces['arrakeen:10'], 3);
  assert.equal(a.players[0].elites!.tanks, 1);
  assert.equal(b.players[0].forces['arrakeen:10'], 1);
  assert.equal(b.players[0].elites!.forces['arrakeen:10'], 1);
  conservation(a);
  conservation(b);
});
void test('advanced prescience accepts a dial that requires support without revealing the support', () => {
  let g = advancedCombat();
  g = power(g, 'p1', { type: 'prescience', field: 'dial' });
  g = applyAction(g, 'p0', { type: 'prescienceAnswer', value: 7 });
  g = applyAction(g, 'p1', { type: 'decision', decline: true });
  assert.equal(viewGame(g, 'p1').battle!.insight?.value, 7);
  assert.throws(
    () =>
      applyAction(g, 'p0', {
        type: 'battlePlan',
        dial: 7,
        support: 0,
        leader: 'emperor-0',
      }),
    /legal force commitment/,
  );
  g = applyAction(g, 'p0', {
    type: 'battlePlan',
    dial: 7,
    support: 6,
    leader: 'emperor-0',
  });
  assert.equal(viewGame(g, 'p1').battle!.plans.p0, undefined);
});
void test('advanced traitor winner spends no support and loser still pays its commitment', () => {
  let g = combat();
  g.advanced = true;
  g.players[0].traitors = [g.players[1].leaders[0].id];
  const before = g.players.map((p) => p.spice),
    bounty = g.players[1].leaders[0].strength;
  g = plan(plan(g, 'p0', 2, { support: 2 }), 'p1', 2, { support: 2 });
  g = applyAction(g, 'p0', { type: 'traitorCall', call: true });
  g = applyAction(g, 'p1', { type: 'traitorCall', call: false });
  assert.equal(g.players[0].spice, before[0] + bounty + 2);
  assert.equal(g.players[1].spice, before[1] - 2);
  assert.notEqual(g.decision?.kind, 'battleLosses');
});
void test('advanced shipment and multi-sector movement preserve chosen elite tokens', () => {
  let g = started(['emperor', 'atreides']);
  g.advanced = true;
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'imperial_basin',
    sector: 10,
    amount: 4,
    elite: 2,
  });
  assert.equal(g.players[0].elites!.reserves, 3);
  assert.equal(g.players[0].elites!.forces['imperial_basin:10'], 2);
  g = applyAction(g, 'p0', {
    type: 'move',
    from: 'imperial_basin:10',
    territory: 'arrakeen',
    sector: 10,
    amount: 3,
    elite: 1,
  });
  assert.equal(g.players[0].elites!.forces['imperial_basin:10'], 1);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], 1);
  conservation(g);
});

void test('Ghola and normal revival share the elite limit for the entire turn, not only the revival phase', () => {
  let g = started(['emperor', 'atreides']);
  g.advanced = true;
  g.players[0].reserves = 15;
  g.players[0].tanks = 5;
  g.players[0].elites = { reserves: 2, tanks: 3, forces: {}, revived: 0 };
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  placeFixtureHand(g, 0, [ghola]);
  g = applyAction(g, 'p0', {
    type: 'card',
    card: ghola.id,
    amount: 1,
    elite: 1,
  });
  assert.equal(g.players[0].elites!.revived, 1);
  assert.equal(g.players[0].elites!.reserves, 3);
  g.phase = 2;
  g.ready = [];
  g = passResponses(readyAll(g));
  while (g.phase === 3)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  assert.equal(g.phase, 4);
  assert.throws(
    () => applyAction(g, 'p0', { type: 'revive', amount: 1, elite: 1 }),
    /one elite/,
  );
  g = applyAction(g, 'p0', { type: 'revive', amount: 2, elite: 0 });
  conservation(g);
  g.phase = 8;
  g.ready = [];
  g = readyAll(g);
  assert.equal(g.turn, 2);
  assert.equal(g.players[0].elites!.revived, 0);
});
void test('Fedaykin survive a worm ride as the exact elite group selected by Fremen', () => {
  let g = started(['fremen', 'atreides']);
  g.advanced = true;
  g.phase = 1;
  g.storm = 18;
  const sector = TERRITORIES.find((t) => t.id === 'the_great_flat')!.sectors[0],
    key = `the_great_flat:${sector}`;
  g.players[0].forces = { [key]: 10 };
  g.players[0].elites = {
    reserves: 1,
    tanks: 0,
    forces: { [key]: 2 },
    revived: 0,
  };
  g.decision = { kind: 'wormRide', player: 'p0', territory: 'the_great_flat' };
  g = applyAction(g, 'p0', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { [key]: 4 },
    eliteForces: { [key]: 2 },
  });
  assert.equal(g.players[0].forces[key], 6);
  assert.equal(g.players[0].elites!.forces[key], undefined);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], 2);
  conservation(g);
});
void test('a traitor loss moves every defeated elite token to the tanks', () => {
  let g = advancedCombat();
  g.players[1].traitors = ['emperor-0'];
  g = plan(plan(g, 'p0', 3, { support: 1 }), 'p1', 1, { support: 1 });
  g = applyAction(g, 'p0', { type: 'traitorCall', call: false });
  g = applyAction(g, 'p1', { type: 'traitorCall', call: true });
  assert.equal(g.players[0].elites!.tanks, 1);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], undefined);
  conservation(g);
});
void test('sealed battle spice cannot be spent through an Emperor gift while the opponent prepares', () => {
  let g = started(['emperor', 'atreides', 'harkonnen']);
  g.advanced = true;
  g.players.forEach((p) => (p.hand = []));
  g.phase = 6;
  g.storm = 18;
  g.active = 'p0';
  g.order = ['p0', 'p1', 'p2'];
  g.players[0].forces = { 'arrakeen:10': 6 };
  g.players[0].reserves = 14;
  g.players[0].elites = {
    forces: { 'arrakeen:10': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  g.players[0].ally = 'p2';
  g.players[2].ally = 'p0';
  g = applyAction(g, 'p0', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'p1',
  });
  g = plan(g, 'p0', 5, { support: 4 });
  assert.throws(() => applyAction(g, 'p0', { type: 'emperorGift', amount: 7 }));
  const pending = applyAction(g, 'p0', { type: 'emperorGift', amount: 6 });
  assert.equal(pending.response, null);
  assert.equal(pending.players[0].spice, 4);
  assert.equal(pending.players[2].spice, g.players[2].spice + 6);
  assert.equal(pending.battle!.plans.p0.support, 4);
});

void test('Guild-funded allied shipping sends the Guild contribution to the bank instead of recycling it as income', () => {
  let g = started(['atreides', 'guild']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 5;
  g.active = 'p0';
  g.storm = 18;
  g.players[0].ally = 'p1';
  g.players[1].ally = 'p0';
  g = applyAction(g, 'p1', { type: 'pledgeAid', amount: 2 });
  g = applyAction(g, 'p0', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
    allyPayment: 2,
  });
  assert.equal(g.players[0].spice, 9);
  assert.equal(g.players[1].spice, 4);
  assert.equal(g.response, null);
  g = passResponses(g);
  assert.equal(g.players[1].spice, 4);
  conservation(g);
});

void test('Atreides auction foresight is hidden until its response closes and a canceled peek does not affect the next card', () => {
  let g = started(['atreides', 'emperor']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 2;
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g.deck = baseDeck().filter((c) => c.effect !== 'karama');
  g = readyAll(g);
  const first = g.auction!.cards[0];
  const second = g.auction!.cards[1];
  assert.equal(g.response?.kind, 'atreidesAuction');
  assert.equal(viewGame(g, 'p0').auction!.card, null);
  assert.equal(viewGame(g, 'p1').auction!.card, null);
  assert.throws(
    () => applyAction(g, g.auction!.active, { type: 'bid', amount: 1 }),
    /response window/,
  );
  const seen = passResponses(g);
  assert.deepEqual(viewGame(seen, 'p0').auction!.card, first);
  assert.equal(viewGame(seen, 'p1').auction!.card, null);
  g = applyAction(g, 'p1', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(viewGame(g, 'p0').auction!.card, null);
  g = applyAction(g, 'p0', { type: 'bid', amount: 1 });
  g = applyAction(g, 'p1', { type: 'passBid' });
  assert.notEqual(g.decision?.kind, 'auctionPayment');
  assert.equal(g.response, null);
  assert.equal(g.players[1].spice, 11);
  assert.deepEqual(viewGame(g, 'p0').auction!.card, second);
  assert.equal(viewGame(g, 'p1').auction!.card, null);
  conservation(g);
});

void test('Atreides may inspect an auction card even when its own hand is full', () => {
  let g = started(['atreides', 'emperor']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 2;
  g.players[0].hand = baseDeck().slice(0, 4);
  g.deck = baseDeck().slice(4);
  g = readyAll(g);
  assert.equal(g.auction!.active, 'p1');
  assert.equal(g.auction!.cards.length, 1);
  assert.equal(g.response, null);
  g = passResponses(g);
  assert.deepEqual(viewGame(g, 'p0').auction!.card, g.auction!.cards[0]);
});

void test('movement spice foresight reveals one private card only after the cancellation window and resets each turn', () => {
  let g = started(['atreides', 'harkonnen']);
  g.advanced = true;
  g.phase = 4;
  const cards = spiceDeck().filter((c) => 'territory' in c);
  g.spiceDeck = cards;
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = readyAll(g);
  assert.equal(g.phase, 5);
  assert.equal(g.response?.kind, 'atreidesSpice');
  assert.equal(viewGame(g, 'p0').spicePeek, null);
  assert.throws(
    () => applyAction(g, g.active!, { type: 'endMovement' }),
    /response window/,
  );
  const canceled = applyAction(g, 'p1', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(viewGame(canceled, 'p0').spicePeek, null);
  assert.deepEqual(canceled.spiceDeck, cards);
  g = passResponses(g);
  assert.deepEqual(viewGame(g, 'p0').spicePeek, cards[0]);
  assert.equal(viewGame(g, 'p1').spicePeek, null);
  assert.deepEqual(g.spiceDeck, cards);
  g.turn++;
  g.phase = 4;
  g.spiceDeck = cards.slice(2);
  g = readyAll(g);
  assert.equal(viewGame(g, 'p0').spicePeek, null);
  g = passResponses(g);
  assert.deepEqual(viewGame(g, 'p0').spicePeek, cards[2]);
});

void test('an exhausted spice deck is replenished before the movement peek and the revealed card remains on top', () => {
  let g = started(['atreides', 'harkonnen']);
  g.players.forEach((p) => (p.hand = []));
  g.phase = 4;
  const cards = spiceDeck();
  g.spiceDeck = [];
  g.spiceDiscard = [cards.slice(0, 10), cards.slice(10)];
  g = readyAll(g);
  assert.equal(g.spiceDeck.length, cards.length);
  assert.deepEqual(g.spiceDiscard, [[], []]);
  assert.equal(g.response, null);
  assert.deepEqual(viewGame(g, 'p0').spicePeek, g.spiceDeck[0]);
  assert.equal(viewGame(g, 'p1').spicePeek, null);
  g = passResponses(g);
  assert.deepEqual(viewGame(g, 'p0').spicePeek, g.spiceDeck[0]);
});

void test('skipping an empty battle phase collects spice only once and respects the per-force cap', () => {
  let g = started(['atreides', 'harkonnen']);
  g.phase = 5;
  g.active = 'p0';
  g.order = ['p0', 'p1'];
  g.storm = 18;
  g.players[0].forces = { 'arrakeen:10': 9, 'red_chasm:7': 1 };
  g.spice = { 'red_chasm:7': 8 };
  const before = g.players[0].spice;
  g = applyAction(g, 'p0', { type: 'endMovement' });
  g = applyAction(g, 'p1', { type: 'endMovement' });
  assert.equal(g.phase, 7);
  assert.equal(g.players[0].spice, before + 3);
  assert.equal(g.spice['red_chasm:7'], 5);
  conservation(g);
});

void test('a storm-contested stronghold does not count toward a normal victory, but sole occupation still counts', () => {
  let g = started(['atreides', 'harkonnen', 'emperor']);
  g.phase = 7;
  g.storm = 10;
  g.players[0].forces = {
    'arrakeen:10': 1,
    'sietch_tabr:14': 1,
    'tueks_sietch:5': 1,
  };
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.players[2].forces = {};
  g = readyAll(g);
  assert.equal(g.status, 'playing');
  g.phase = 7;
  g.ready = [];
  g.players[1].forces = {};
  g = readyAll(g);
  assert.deepEqual(g.winner, ['p0']);
});
void test('without Guild, Fremen wins at the final turn even when its normal special conditions fail', () => {
  let g = started(['fremen', 'atreides', 'emperor']);
  g.turn = 10;
  g.phase = 7;
  g.players[0].forces = {};
  g.players[1].forces = { 'sietch_tabr:14': 1, 'tueks_sietch:5': 1 };
  g.players[2].forces = { 'habbanya_ridge_sietch:17': 1 };
  g = readyAll(g);
  assert.equal(g.status, 'finished');
  assert.deepEqual(g.winner, ['p0']);
});
void test('final fallback respects normal victories first and Guild before unconditional Fremen fallback', () => {
  const state = started(['fremen', 'atreides', 'guild']);
  state.turn = 10;
  state.phase = 7;
  state.players[0].forces = {};
  state.players[1].forces = { 'sietch_tabr:14': 1 };
  state.players[2].forces = {};
  const guild = readyAll(state);
  assert.deepEqual(guild.winner, ['p2']);
  state.players[1].forces = {
    'sietch_tabr:14': 1,
    'arrakeen:10': 1,
    'carthag:11': 1,
  };
  assert.deepEqual(readyAll(state).winner, ['p1']);
});
void test('without Fremen or Guild, final fallback selects the greatest individual stronghold count and includes all ties', () => {
  const state = started(['atreides', 'harkonnen', 'emperor']);
  state.turn = 10;
  state.phase = 7;
  state.players[0].forces = { 'arrakeen:10': 1, 'sietch_tabr:14': 1 };
  state.players[1].forces = { 'carthag:11': 1 };
  state.players[2].forces = {};
  assert.deepEqual(readyAll(state).winner, ['p0']);
  state.players[1].forces['tueks_sietch:5'] = 1;
  assert.deepEqual(readyAll(state).winner, ['p0', 'p1']);
  state.players.forEach((p) => (p.forces = {}));
  assert.deepEqual(readyAll(state).winner, ['p0', 'p1', 'p2']);
});
void test('storm-contested holds are excluded from final scores and fallback does not end an earlier turn', () => {
  const state = started(['atreides', 'harkonnen', 'emperor']);
  state.turn = 9;
  state.phase = 7;
  state.storm = 10;
  state.players[0].forces = { 'arrakeen:10': 1, 'sietch_tabr:14': 1 };
  state.players[1].forces = { 'arrakeen:10': 1 };
  state.players[2].forces = { 'carthag:11': 1 };
  assert.equal(readyAll(state).status, 'playing');
  state.turn = 10;
  assert.deepEqual(readyAll(state).winner, ['p0', 'p2']);
});
void test('Bene Gesserit can predict the final stronghold fallback but cannot steal Guild or Fremen special victories', () => {
  for (const predicted of ['atreides', 'guild', 'fremen'] as const) {
    const state = started(['beneGesserit', predicted, 'emperor']);
    state.turn = 10;
    state.phase = 7;
    state.players[0].prediction = { faction: predicted, turn: 10 };
    state.players[0].forces = {};
    state.players[1].forces = { 'arrakeen:10': 1, 'carthag:11': 1 };
    state.players[2].forces = { 'sietch_tabr:14': 1 };
    assert.deepEqual(readyAll(state).winner, [
      predicted === 'atreides' ? 'p0' : 'p1',
    ]);
  }
});
