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

function spiceState(advanced = false) {
  const g = fixture();
  g.advanced = advanced;
  g.turn = 2;
  g.phase = 1;
  g.storm = 18;
  g.players.forEach((p) => {
    p.forces = {};
    p.reserves = 20;
    p.hand = [];
  });
  g.spiceDiscard = [[], []];
  g.spice = {};
  g.response = null;
  g.decision = null;
  g.ready = [];
  return g;
}
const trout = { sandtrout: true as const };
void test('the Ix spice deck adds exactly one Sandtrout without changing the base inventory', () => {
  assert.equal(spiceDeck().length, 21);
  assert.equal(spiceDeck(true).length, 22);
  assert.equal(spiceDeck(true).filter((c) => 'sandtrout' in c).length, 1);
});
void test('Sandtrout cancels alliances and offers, refunds outstanding ally credit and remains set aside', () => {
  const before = spiceState();
  before.players[0].ally = 'a';
  before.players[1].ally = 'f';
  before.allianceOffers = { f: 'a', a: 'f' };
  before.aid = { f: { recipient: 'a', amount: 3 } };
  before.spiceDeck = [trout, land[0], ...land.slice(1)];
  const g = ready(before);
  assert.ok(g.players.every((p) => p.ally === null));
  assert.deepEqual(g.allianceOffers, {});
  assert.deepEqual(g.aid, {});
  assert.equal(g.players[0].spice, before.players[0].spice + 3);
  assert.equal(g.sandtrout, true);
  assert.equal(g.nexus, false);
  assert.deepEqual(g.spiceDiscard[0], [land[0]]);
  assert.equal(g.spiceWindow?.amount, land[0].amount);
  assert.equal(viewGame(g, 'a').sandtrout, true);
  assert.equal(before.players[0].ally, 'a');
});
void test('a suppressed worm neither destroys forces/spice nor opens Nexus and doubles only its immediate land replacement', () => {
  const before = spiceState();
  before.spiceDiscard[0] = [land[0]];
  before.players[1].forces = { [`${land[0].territory}:${land[0].sector}`]: 4 };
  before.players[1].reserves = 16;
  before.spice[`${land[0].territory}:${land[0].sector}`] = 7;
  before.spiceDeck = [trout, worms[0], land[1], ...land.slice(2)];
  const g = ready(before);
  assert.equal(g.sandtrout, false);
  assert.equal(g.nexus, false);
  assert.equal(g.decision, null);
  assert.equal(g.spiceWindow?.amount, land[1].amount * 2);
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.spice[`${land[0].territory}:${land[0].sector}`], 7);
  assert.deepEqual(g.spiceDiscard[0].slice(-3), [
    trout,
    { worm: true, suppressed: true },
    land[1],
  ]);
});
void test('Sandtrout persists across phase and turn boundaries, with JSON reconnect preserving the pending effect', () => {
  const before = spiceState();
  before.spiceDeck = [trout, land[0], worms[0], land[1], ...land.slice(2)];
  let g = ready(ready(before));
  assert.equal(g.phase, 2);
  assert.equal(g.sandtrout, true);
  g = JSON.parse(JSON.stringify(g));
  g.phase = 1;
  g.turn++;
  g.ready = [];
  g = ready(g);
  assert.equal(g.sandtrout, false);
  assert.equal(g.spiceWindow?.amount, land[1].amount * 2);
});
void test('a second worm is normal, devours the prior land, opens Nexus and cancels the double-spice bonus', () => {
  const before = spiceState(true);
  before.spiceDiscard[0] = [land[0]];
  before.players[1].forces = { [`${land[0].territory}:${land[0].sector}`]: 4 };
  before.players[1].reserves = 16;
  before.spiceDeck = [trout, worms[0], worms[1], land[1], ...land.slice(2)];
  const g = ready(before);
  assert.equal(g.nexus, true);
  assert.equal(g.players[1].tanks, 4);
  assert.equal(g.spiceWindow?.amount, land[1].amount);
  assert.equal(g.decision, null);
});
void test('Fremen extra placement starts only after a real worm, not after the suppressed worm', () => {
  const before = spiceState(true);
  before.spiceDiscard[0] = [land[0]];
  before.spiceDeck = [
    trout,
    worms[0],
    worms[1],
    worms[2],
    land[1],
    ...land.slice(2),
  ];
  const g = ready(before);
  assert.equal(g.decision?.kind, 'wormPlacement');
  assert.deepEqual(g.spiceDeck[0], land[1]);
});
void test('double spice blow can carry pending Sandtrout from pile A to pile B without mixing discard targets', () => {
  const before = spiceState(true);
  before.spiceDiscard[1] = [land[2]];
  before.spiceDeck = [trout, land[0], worms[0], land[1], ...land.slice(3)];
  let g = ready(before);
  assert.equal(g.sandtrout, true);
  assert.equal(g.spiceWindow?.territory, land[0].territory);
  g = ready(g);
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.sandtrout, false);
  assert.equal(g.spiceWindow?.amount, land[1].amount * 2);
  assert.deepEqual(g.spiceDiscard[0], [land[0]]);
  assert.deepEqual(g.spiceDiscard[1], [
    land[2],
    trout,
    { worm: true, suppressed: true },
    land[1],
  ]);
});
void test('Harvester doubles the Sandtrout-enhanced blow and storm still prevents all of its spice', () => {
  const before = spiceState();
  before.spiceDeck = [trout, worms[0], land[0], ...land.slice(1)];
  const harvester = baseDeck().find((c) => c.effect === 'harvester')!;
  placeFixtureHand(before, 1, [harvester]);
  let g = ready(before);
  g = applyAction(g, 'a', { type: 'card', card: harvester.id });
  assert.equal(
    g.spice[`${land[0].territory}:${land[0].sector}`],
    land[0].amount * 4,
  );
  const storm = structuredClone(before);
  storm.storm = land[0].sector;
  assert.equal(
    ready(storm).spice[`${land[0].territory}:${land[0].sector}`],
    undefined,
  );
});
void test('first-turn ignored worms return to the deck without consuming a waiting Sandtrout', () => {
  const before = spiceState(true);
  before.turn = 1;
  before.spiceDeck = [
    trout,
    worms[0],
    land[0],
    worms[1],
    land[1],
    ...land.slice(2),
  ];
  let g = ready(before);
  assert.equal(g.sandtrout, true);
  assert.equal(g.spiceWindow?.amount, land[0].amount);
  g = ready(g);
  assert.equal(g.spiceWindow?.amount, land[1].amount);
  g = ready(g);
  assert.equal(g.phase, 2);
  assert.equal(g.sandtrout, true);
  assert.equal(g.spiceDeck.filter((c) => 'worm' in c).length, 2);
});
void test('Atreides alone sees a next-card Sandtrout through the existing private foresight projection', () => {
  const before = spiceState();
  before.phase = 5;
  before.spicePeekKnown = true;
  before.spiceDeck = [trout, ...land];
  assert.deepEqual(viewGame(before, 'a').spicePeek, trout);
  assert.equal(viewGame(before, 'f').spicePeek, null);
  assert.equal(viewGame(before, 'a').sandtrout, false);
});
void test('Sandtrout drawn after a normal worm does not erase that worm’s already-triggered Nexus', () => {
  const before = spiceState();
  before.spiceDiscard[0] = [land[0]];
  before.spiceDeck = [worms[0], trout, land[1], ...land.slice(2)];
  const g = ready(before);
  assert.equal(g.nexus, true);
  assert.equal(g.sandtrout, true);
});

void test('the real replacement worm preserves Fremen survival while the canceled alliance loses its protection offer', () => {
  const before = spiceState(true);
  before.spiceDiscard[0] = [land[0]];
  for (const p of before.players) {
    p.forces = { [`${land[0].territory}:${land[0].sector}`]: 3 };
    p.reserves = 17;
  }
  before.players[0].ally = 'a';
  before.players[1].ally = 'f';
  before.spiceDeck = [trout, worms[0], worms[1], land[1], ...land.slice(2)];
  let g = ready(before);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[1].tanks, 3);
  assert.equal(g.nexus, true);
  assert.deepEqual(g.wormRides, [land[0].territory]);
});
void test('reshuffling removes the suppression annotation so a recycled Shai-Hulud is normal again', () => {
  const before = spiceState();
  before.phase = 4;
  before.spiceDeck = [];
  before.spiceDiscard = [
    [{ worm: true, suppressed: true }, trout, land[0]],
    [],
  ];
  const g = ready(before);
  assert.equal(g.phase, 5);
  assert.equal(g.spiceDeck.length, 3);
  assert.ok(g.spiceDeck.filter((c) => 'worm' in c).every((c) => !c.suppressed));
  assert.equal(g.spiceDeck.filter((c) => 'sandtrout' in c).length, 1);
  assert.deepEqual(g.spiceDiscard, [[], []]);
});
void test('a summoned Fremen worm is not a drawn Shai-Hulud and leaves Sandtrout waiting', () => {
  const before = spiceState(true);
  before.sandtrout = true;
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  before.players[0].hand = [karama];
  before.spiceDeck = [worms[0], land[0], ...land.slice(1)];
  let g = applyAction(before, 'f', {
    type: 'card',
    mode: 'special',
    card: karama.id,
    territory: land[0].territory,
  });
  g = allow(g);
  assert.equal(g.sandtrout, true);
  g = ready(g);
  assert.equal(g.sandtrout, false);
  assert.equal(g.spiceWindow?.amount, land[0].amount * 2);
  assert.equal(g.nexus, true);
});
