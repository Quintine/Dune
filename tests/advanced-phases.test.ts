import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { spiceDeck, baseDeck } from '../game/cards';
import { TERRITORIES } from '../game/board';
function fixture() {
  let g = createGame('ADVTEST2', newPlayer('f', 'Fremen', 'fremen'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'f', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  g.players.forEach((p) => (p.hand = []));
  g.advanced = true;
  g.players[0].elites = { reserves: 3, tanks: 0, forces: {}, revived: 0 };
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
const land = spiceDeck().filter((c) => 'territory' in c);
const worms = spiceDeck().filter((c) => 'worm' in c);
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
        3,
      );
  }
}
void test('double spice blow keeps separate discard piles and returns first-turn worms only after both blows', () => {
  let g = fixture();
  g.phase = 1;
  g.storm = 18;
  g.spiceDeck = [worms[0], land[0], worms[1], land[1], land[2]];
  g = ready(g);
  assert.equal(g.spiceWindow?.territory, land[0].territory);
  assert.equal(g.spiceSequence?.pile, 0);
  assert.equal(g.spiceSequence?.skipped.length, 1);
  g = ready(g);
  assert.equal(g.spiceWindow?.territory, land[1].territory);
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.spiceSequence?.skipped.length, 2);
  assert.deepEqual(g.spiceDeck, [land[2]]);
  assert.deepEqual(g.spiceDiscard, [[land[0]], [land[1]]]);
  g = ready(g);
  assert.equal(g.phase, 2);
  assert.equal(g.nexus, false);
  assert.equal(g.spiceSequence, null);
  assert.equal(g.spiceDeck.length, 3);
  assert.equal(g.spiceDeck.filter((c) => 'worm' in c).length, 2);
});
void test('each advanced spice blow completes its Nexus and worm rides before the next; extra worm placement is per pile', () => {
  let g = fixture();
  g.turn = 2;
  g.phase = 1;
  g.storm = 18;
  const source = `${land[0].territory}:${land[0].sector}`;
  const target = land[4];
  const targetKey = `${target.territory}:${target.sector}`;
  g.spiceDiscard = [[land[0]], [land[1]]];
  g.spiceDeck = [worms[0], worms[1], land[2], worms[2], land[3]];
  g.players[0].forces = { [source]: 10 };
  g.players[1].forces = { [targetKey]: 10 };
  g.spice = { [targetKey]: 7 };
  g = allow(ready(g));
  assert.equal(g.decision?.kind, 'wormPlacement');
  assert.equal(g.spiceSequence?.pile, 0);
  assert.throws(
    () =>
      applyAction(g, 'f', {
        type: 'decision',
        accept: true,
        territory: 'arrakeen',
      }),
    /sand territory/,
  );
  g = applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: target.territory,
  });
  g = allow(g);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.spice[targetKey], undefined);
  assert.equal(g.spiceWindow?.territory, land[2].territory);
  g = ready(g);
  assert.equal(g.nexus, true);
  assert.equal(g.spiceSequence?.pile, 0);
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormRide');
  assert.equal(g.spiceSequence?.pile, 0);
  g = applyAction(g, 'f', { type: 'decision', accept: false });
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.spiceWindow?.territory, land[3].territory);
  assert.equal(g.decision, null);
  g = ready(g);
  assert.equal(g.nexus, true);
  g = ready(g);
  assert.equal(g.phase, 2);
  assert.equal(g.log.filter((l) => l.text.startsWith('Nexus:')).length, 2);
  conserve(g);
});
void test('Harvester can target the second blow without changing the first blow', () => {
  let g = fixture();
  g.phase = 1;
  g.storm = 18;
  const cards = land.filter((c) => c.sector !== 18).slice(0, 2);
  g.spiceDeck = [...cards];
  const harvester = baseDeck().find((c) => c.effect === 'harvester')!;
  placeFixtureHand(g, 1, [harvester]);
  g = ready(ready(g));
  assert.equal(g.spiceSequence?.pile, 1);
  g = applyAction(g, 'a', { type: 'card', card: harvester.id });
  assert.equal(
    g.spice[`${cards[0].territory}:${cards[0].sector}`],
    cards[0].amount,
  );
  assert.equal(
    g.spice[`${cards[1].territory}:${cards[1].sector}`],
    cards[1].amount * 2,
  );
  g = ready(g);
  assert.equal(g.phase, 2);
});
void test('Fremen storm forecast stays private until allowed and can be canceled without changing the future storm', () => {
  let g = fixture();
  g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  g = applyAction(g, 'f', { type: 'stormDial', amount: 0 });
  g = applyAction(g, 'a', { type: 'stormDial', amount: 0 });
  g = ready(g);
  const forecast = g.stormCard!;
  assert.ok(forecast >= 1 && forecast <= 6);
  assert.equal(g.response?.kind, 'stormPeek');
  assert.equal(viewGame(g, 'f').stormForecast, null);
  const accepted = allow(g);
  assert.equal(viewGame(accepted, 'f').stormForecast, forecast);
  assert.equal(viewGame(accepted, 'a').stormForecast, null);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(viewGame(g, 'f').stormForecast, null);
  g.phase = 8;
  g.ready = [];
  g = ready(g);
  assert.equal(g.turn, 2);
  assert.equal(g.stormPending, forecast);
  assert.deepEqual(g.stormDialers, []);
  assert.equal(g.stormCard, null);
  assert.throws(
    () => applyAction(g, 'f', { type: 'stormDial', amount: 1 }),
    /not dialing/,
  );
});
function stormArmy(distance = 1, allowProtection = true) {
  let g = fixture();
  if (!allowProtection)
    g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const t = TERRITORIES.find((t) => t.id === 'the_great_flat')!,
    sector = t.sectors[0],
    key = `${t.id}:${sector}`;
  g.storm = sector === 1 ? 18 : sector - 1;
  g.players[0].forces = { [key]: 5, 'sietch_tabr:14': 5 };
  g.players[0].elites = {
    reserves: 1,
    tanks: 0,
    forces: { [key]: 2 },
    revived: 0,
  };
  g.players[1].forces = { [key]: 10 };
  g.spice = { [key]: 8 };
  g = applyAction(g, 'f', { type: 'stormDial', amount: distance });
  g = applyAction(g, 'a', { type: 'stormDial', amount: 0 });
  const result = ready(g);
  return { g: allowProtection ? allow(result) : result, key, sector };
}
void test('storm half losses pause for Fremen elite choices and conserve both armies when resumed', () => {
  const setup = stormArmy();
  let g = setup.g;
  const { key, sector } = setup;
  assert.equal(g.decision?.kind, 'stormLosses');
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.spice[key], undefined);
  assert.equal(viewGame(g, 'f').decision?.kind, 'stormLosses');
  assert.throws(
    () => applyAction(g, 'a', { type: 'decision', elite: 0 }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'f', { type: 'decision', elite: 3 }),
    /Elite casualties/,
  );
  g = applyAction(g, 'f', { type: 'decision', elite: 0 });
  assert.equal(g.players[0].forces[key], 2);
  assert.equal(g.players[0].elites!.forces[key], 2);
  assert.equal(g.players[0].tanks, 3);
  assert.equal(g.storm, sector);
  assert.equal(g.stormResolution, null);
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'f').stormForecast, g.stormCard);
  conserve(g);
});
void test('a storm making a second lap calculates further half losses from the surviving forces', () => {
  const setup = stormArmy(19);
  let g = setup.g;
  const { key } = setup;
  g = allow(applyAction(g, 'f', { type: 'decision', elite: 0 }));
  assert.equal(g.players[0].forces[key], 1);
  assert.equal(g.players[0].elites!.forces[key], 1);
  assert.equal(g.players[0].tanks, 4);
  conserve(g);
});
void test('shipping Fremen into storm loses half the arriving group without damaging forces already there', () => {
  let g = fixture();
  g.phase = 5;
  g.active = 'f';
  const t = TERRITORIES.find((t) => t.id === 'the_great_flat')!,
    sector = t.sectors[0],
    key = `${t.id}:${sector}`;
  g.storm = sector;
  g.players[0].forces = { [key]: 5, 'sietch_tabr:14': 5 };
  g.players[0].elites = {
    reserves: 1,
    tanks: 0,
    forces: { [key]: 2 },
    revived: 0,
  };
  g = applyAction(g, 'f', {
    type: 'ship',
    territory: t.id,
    sector,
    amount: 3,
    elite: 1,
  });
  g = allow(g);
  assert.equal(g.decision?.kind, 'stormLosses');
  g = applyAction(g, 'f', { type: 'decision', elite: 0 });
  assert.equal(g.players[0].forces[key], 6);
  assert.equal(g.players[0].elites!.forces[key], 3);
  assert.equal(g.players[0].tanks, 2);
  assert.equal(g.players[0].reserves, 7);
  assert.throws(
    () =>
      applyAction(g, 'f', {
        type: 'move',
        from: key,
        territory: 'polar_sink',
        sector: 0,
        amount: 1,
      }),
    /blocked/,
  );
  conserve(g);
});

void test('Karama removes storm protection for the current movement without suppressing the next forecast', () => {
  const setup = stormArmy(1, false);
  let g = setup.g;
  const { key } = setup;
  assert.equal(g.response?.kind, 'stormProtection');
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[0].forces[key], undefined);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[0].elites!.tanks, 2);
  assert.equal(g.players[1].tanks, 10);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'f').stormForecast, g.stormCard);
  assert.equal(g.stormResolution, null);
  conserve(g);
});

void test('canceling storm shipment protection destroys only the arriving group and its selected elite', () => {
  let g = fixture();
  g.phase = 5;
  g.active = 'f';
  const t = TERRITORIES.find((t) => t.id === 'the_great_flat')!,
    sector = t.sectors[0],
    key = `${t.id}:${sector}`;
  g.storm = sector;
  g.players[0].forces = { [key]: 10 };
  g.players[0].elites = {
    reserves: 1,
    tanks: 0,
    forces: { [key]: 2 },
    revived: 0,
  };
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = applyAction(g, 'f', {
    type: 'ship',
    territory: t.id,
    sector,
    amount: 3,
    elite: 1,
  });
  assert.equal(g.response?.kind, 'stormProtection');
  g = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[0].forces[key], 10);
  assert.equal(g.players[0].elites!.forces[key], 2);
  assert.equal(g.players[0].tanks, 3);
  assert.equal(g.players[0].elites!.tanks, 1);
  assert.equal(g.players[0].reserves, 7);
  assert.equal(g.decision, null);
  assert.equal(g.active, 'f');
  assert.equal(g.players[0].shipped, true);
  conserve(g);
});

void test('Weather Control overrides an advanced storm card after revelation and a new private forecast follows', () => {
  let g = fixture();
  g.turn = 2;
  g.phase = 0;
  g.stormDialers = [];
  g.stormPending = 3;
  const previous = g.storm;
  const weather = baseDeck().find((c) => c.effect === 'weather')!;
  placeFixtureHand(g, 1, [weather]);
  g = applyAction(g, 'f', { type: 'ready' });
  g = applyAction(g, 'a', { type: 'card', card: weather.id, amount: 9 });
  assert.equal(g.stormPending, 9);
  assert.deepEqual(g.ready, []);
  g = ready(g);
  assert.equal(g.storm, ((previous - 1 + 9) % 18) + 1);
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'f').stormForecast, g.stormCard);
  g = allow(g);
  assert.ok(viewGame(g, 'f').stormForecast);
  assert.equal(viewGame(g, 'a').stormForecast, null);
});

void test('canceling additional worm placement suppresses later placements in both piles for this turn only', () => {
  let g = fixture();
  g.turn = 2;
  g.phase = 1;
  g.storm = 18;
  g.spiceDiscard = [[land[0]], [land[1]]];
  g.spiceDeck = [
    worms[0],
    worms[1],
    worms[2],
    land[2],
    worms[3],
    worms[4],
    land[3],
  ];
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormPlacement');
  g = applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: land[4].territory,
  });
  assert.equal(g.response?.kind, 'wormPlacement');
  g = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.wormPlacementCanceledTurn, 2);
  assert.equal(g.decision, null);
  assert.equal(g.spiceWindow?.territory, land[2].territory);
  g = ready(ready(g));
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.decision, null);
  assert.equal(g.spiceWindow?.territory, land[3].territory);
  g = ready(ready(g));
  assert.equal(g.phase, 2);
  g.turn = 3;
  g.phase = 1;
  g.spiceDiscard = [[land[0]], [land[1]]];
  g.spiceDeck = [worms[0], worms[1], land[2]];
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormPlacement');
});

void test('worm survival and optional allied protection have independent Karama windows before destruction', () => {
  let g = fixture();
  g.turn = 2;
  g.phase = 1;
  const key = `${land[0].territory}:${land[0].sector}`;
  g.players[0].forces = { [key]: 10 };
  g.players[1].forces = { [key]: 10 };
  g.players[0].ally = 'a';
  g.players[1].ally = 'f';
  g.spiceDiscard = [[land[0]], []];
  g.spiceDeck = [worms[0], land[1], land[2]];
  g.spice = { [key]: 8 };
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[1].hand = [karama];
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormProtection');
  g = applyAction(g, 'f', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'wormAllyProtection');
  const canceledAlly = allow(
    applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' }),
  );
  assert.equal(canceledAlly.players[0].forces[key], 10);
  assert.equal(canceledAlly.players[1].tanks, 10);
  assert.deepEqual(canceledAlly.wormRides, [land[0].territory]);
  g = applyAction(g, 'f', { type: 'passResponse' });
  g = applyAction(g, 'a', { type: 'passResponse' });
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[1].tanks, 0);
  const unchanged = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'f', { type: 'card', card: karama.id, mode: 'cancel' }),
    /another faction/,
  );
  assert.deepEqual(g, unchanged);
  g = applyAction(g, 'a', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[1].forces[key], 10);
  assert.equal(g.spice[key], undefined);
  assert.deepEqual(g.wormRides, []);
  assert.equal(g.nexus, true);
  assert.ok(g.spiceWindow);
  conserve(g);
  conserve(canceledAlly);
});
