import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
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
import { spiceDeck, ixSpecialCards, baseDeck } from '../game/cards';
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

const thumper = ixSpecialCards().find((c) => c.effect === 'thumper')!;
function withThumper(advanced = false) {
  const g = spiceState(advanced);
  g.players[0].hand = [thumper];
  g.spiceDiscard[0] = [land[0]];
  g.spiceDeck = [...land.slice(1), ...worms];
  return g;
}
const play = (g: Game) =>
  applyAction(g, 'f', { type: 'card', card: thumper.id });
void test('Thumper replaces a reveal, consumes its treachery card once and devours the existing pile-A territory', () => {
  const before = withThumper();
  before.players[1].forces = { [`${land[0].territory}:${land[0].sector}`]: 3 };
  before.players[1].reserves = 17;
  before.spice[`${land[0].territory}:${land[0].sector}`] = 8;
  const g = play(before);
  assert.equal(g.players[1].tanks, 3);
  assert.equal(g.spice[`${land[0].territory}:${land[0].sector}`], undefined);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.discard.filter((c) => c.effect === 'thumper').length, 1);
  assert.deepEqual(g.spiceDeck, before.spiceDeck.slice(1));
  assert.deepEqual(g.spiceDiscard[0], [
    land[0],
    { worm: true, thumper: true },
    land[1],
  ]);
  assert.equal(g.nexus, true);
  assert.equal(g.spiceWindow?.territory, land[1].territory);
  assert.equal(viewGame(g, 'f').beforeSpiceDraw, false);
});
void test('Fremen protection pauses before any actual spice-card draw and resumes across JSON reconnect', () => {
  const before = withThumper();
  before.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  before.players[0].forces = { [`${land[0].territory}:${land[0].sector}`]: 4 };
  before.players[0].reserves = 16;
  let g = play(before);
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.deepEqual(g.spiceDeck, before.spiceDeck);
  assert.equal(g.discard.filter((c) => c.effect === 'thumper').length, 1);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].tanks, 0);
  assert.deepEqual(g.wormRides, [land[0].territory]);
  assert.equal(g.spiceWindow?.territory, land[1].territory);
  g = ready(g);
  assert.equal(g.nexus, true);
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormRide');
});
void test('allied worm protection uses the existing Fremen decision before a Thumper devours anyone', () => {
  const before = withThumper();
  before.players[0].ally = 'a';
  before.players[1].ally = 'f';
  before.players[1].forces = { [`${land[0].territory}:${land[0].sector}`]: 3 };
  before.players[1].reserves = 17;
  let g = play(before);
  assert.equal(g.decision?.kind, 'wormProtection');
  g = applyAction(g, 'f', { type: 'decision', accept: true });
  g = allow(g);
  assert.equal(g.players[1].tanks, 0);
  assert.equal(g.nexus, true);
});
void test('an actual worm after Thumper is an additional advanced worm and does not consume the land card before the placement choice', () => {
  const before = withThumper(true);
  before.spiceDeck = [worms[0], land[1], ...land.slice(2)];
  const g = play(before);
  assert.equal(g.decision?.kind, 'wormPlacement');
  assert.equal(g.decision?.player, 'f');
  assert.deepEqual(g.spiceDeck[0], land[1]);
});
void test('advanced pile B continues normally after Thumper and its pile-A Nexus', () => {
  let g = play(withThumper(true));
  g = ready(g);
  assert.equal(g.nexus, true);
  g = ready(g);
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.spiceWindow?.territory, land[2].territory);
  assert.deepEqual(g.spiceDiscard[1], [land[2]]);
});
void test('waiting Sandtrout suppresses Thumper and doubles the next land without creating a real worm card', () => {
  const before = withThumper();
  before.sandtrout = true;
  const g = play(before);
  assert.equal(g.sandtrout, false);
  assert.equal(g.nexus, false);
  assert.equal(g.spiceWindow?.amount, land[1].amount * 2);
  assert.ok(
    g.spiceDiscard[0].some((c) => 'worm' in c && c.thumper && c.suppressed),
  );
  assert.equal(
    [...g.spiceDeck, ...g.spiceDiscard.flat()].filter(
      (c) => 'worm' in c && !c.thumper,
    ).length,
    6,
  );
});
void test('a first-turn Thumper is ignored without adding a worm to the first-turn reshuffle', () => {
  const before = withThumper(true);
  before.turn = 1;
  let g = play(before);
  assert.equal(g.nexus, false);
  assert.deepEqual(g.spiceDiscard[0], [land[0], land[1]]);
  g = ready(g);
  g = ready(g);
  assert.equal(g.phase, 2);
  assert.equal(
    [...g.spiceDeck, ...g.spiceDiscard.flat()].filter((c) => 'worm' in c)
      .length,
    6,
  );
});
void test('spice-deck refill removes virtual Thumper markers but preserves real worm cards', () => {
  const before = withThumper();
  before.phase = 4;
  before.spiceDeck = [];
  before.spiceDiscard = [
    [
      { worm: true, thumper: true },
      { worm: true, thumper: true, suppressed: true },
      worms[0],
      land[0],
    ],
    [],
  ];
  const g = ready(before);
  assert.equal(g.spiceDeck.length, 2);
  assert.equal(g.spiceDeck.filter((c) => 'worm' in c).length, 1);
  assert.ok(g.spiceDeck.every((c) => !('worm' in c && c.thumper)));
});
void test('Thumper is rejected outside the phase opening or after a reveal, without discarding it', () => {
  for (const phase of [0, 2, 3, 4, 5, 6, 7, 8]) {
    const g = withThumper();
    g.phase = phase;
    const snapshot = structuredClone(g);
    assert.throws(() => play(g), /beginning of Spice Blow/);
    assert.deepEqual(g, snapshot);
  }
  let g = ready(withThumper());
  assert.equal(viewGame(g, 'f').beforeSpiceDraw, false);
  assert.throws(() => play(g), /beginning of Spice Blow/);
  g = ready(g);
  // No worm was drawn, so this is now Charity, not another opening to thump.
  assert.throws(() => play(g), /beginning of Spice Blow/);
});
void test('AI considers public enemy exposure and retains Thumper when Sandtrout would suppress it', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = withThumper();
    g.players[0].bot = difficulty;
    g.players[1].forces = { [`${land[0].territory}:${land[0].sector}`]: 3 };
    g.players[1].reserves = 17;
    const action = botActions(viewGame(g, 'f'))[0];
    assert.ok(applyAction(g, 'f', action));
    if (difficulty !== 'Easy') assert.equal(action.card, thumper.id);
    g.sandtrout = true;
    assert.notEqual(botActions(viewGame(g, 'f'))[0]?.card, thumper.id);
  }
});
