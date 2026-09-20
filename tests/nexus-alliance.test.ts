import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../game/engine';
import {
  quoteNexusAlliance,
  type NexusAllianceSeat,
} from '../game/nexus-alliance';
import {
  nexusPlayer,
  nexusReady,
  nexusTurnTwo,
  orderNexusSpice,
} from './fixture-nexus-cards';

const players = (): NexusAllianceSeat[] => [
  { id: 'a', ally: null },
  { id: 'b', ally: null },
  { id: 'c', ally: null },
  { id: 'd', ally: null },
];

void test('a unilateral offer preserves every alliance and unrelated offer without mutating input', () => {
  const seats = players();
  const offers = { c: 'd' };
  const before = structuredClone({ seats, offers });
  Object.freeze(seats);
  Object.freeze(offers);
  for (const seat of seats) Object.freeze(seat);

  const quote = quoteNexusAlliance({
    players: seats,
    offers,
    actor: 'a',
    target: 'b',
  });
  assert.deepEqual(quote, {
    allies: { a: null, b: null, c: null, d: null },
    offers: { c: 'd', a: 'b' },
    formed: null,
  });
  assert.deepEqual({ seats, offers }, before);
});

void test('mutual offers form a reciprocal pair and remove only that pair own offers', () => {
  const quote = quoteNexusAlliance({
    players: players(),
    offers: { b: 'a', c: 'a', d: 'c' },
    actor: 'a',
    target: 'b',
  });
  assert.deepEqual(quote, {
    allies: { a: 'b', b: 'a', c: null, d: null },
    offers: { c: 'a', d: 'c' },
    formed: ['a', 'b'],
  });
});

void test('withdrawing breaks the reciprocal pair and removes only the actor offer', () => {
  const quote = quoteNexusAlliance({
    players: [
      { id: 'a', ally: 'b' },
      { id: 'b', ally: 'a' },
      { id: 'c', ally: null },
    ],
    offers: { a: 'c', b: 'c', c: 'a' },
    actor: 'a',
    target: null,
  });
  assert.deepEqual(quote, {
    allies: { a: null, b: null, c: null },
    offers: { b: 'c', c: 'a' },
    formed: null,
  });
});

void test('invalid actors, targets and occupied alliances reject without mutation', () => {
  const seats = players();
  const offers = { c: 'd' };
  const before = structuredClone({ seats, offers });
  for (const [actor, target, pattern] of [
    ['missing', 'a', /seated player/],
    ['a', 'a', /another player/],
    ['a', 'missing', /another seated player/],
  ] as const)
    assert.throws(
      () => quoteNexusAlliance({ players: seats, offers, actor, target }),
      pattern,
    );
  seats[0].ally = 'c';
  seats[2].ally = 'a';
  assert.throws(
    () =>
      quoteNexusAlliance({
        players: seats,
        offers,
        actor: 'a',
        target: 'b',
      }),
    /Break existing alliances/,
  );
  assert.deepEqual(
    { seats, offers },
    {
      seats: [
        { id: 'a', ally: 'c' },
        before.seats[1],
        { id: 'c', ally: 'a' },
        before.seats[3],
      ],
      offers: before.offers,
    },
  );
});

function negotiations() {
  let game = nexusTurnTwo();
  orderNexusSpice(game, ['worm', 'land', 'land']);
  game = nexusReady(game);
  assert.ok(game.spiceWindow);
  game = nexusReady(game);
  assert.equal(game.nexus, true);
  assert.equal(game.spiceWindow, null);
  return game;
}

void test('the actual engine preserves ordinary offer, formation and withdrawal side effects', () => {
  let game = negotiations();
  game.ready = ['h'];
  game = applyAction(game, 'f', { type: 'alliance', target: 'a' });
  assert.deepEqual(game.allianceOffers, { f: 'a' });
  assert.equal(nexusPlayer(game, 'f').ally, null);
  assert.deepEqual(game.ready, []);

  game.ready = ['h'];
  game = applyAction(game, 'a', { type: 'alliance', target: 'f' });
  assert.equal(nexusPlayer(game, 'f').ally, 'a');
  assert.equal(nexusPlayer(game, 'a').ally, 'f');
  assert.equal(nexusPlayer(game, 'f').allySinceTurn, game.turn);
  assert.equal(nexusPlayer(game, 'a').allySinceTurn, game.turn);
  assert.deepEqual(game.allianceOffers, {});
  assert.deepEqual(game.ready, []);
  assert.match(game.log.at(-1)!.text, /formed an alliance/);

  game.ready = ['h'];
  game = applyAction(game, 'f', { type: 'alliance', target: null });
  assert.equal(nexusPlayer(game, 'f').ally, null);
  assert.equal(nexusPlayer(game, 'a').ally, null);
  assert.deepEqual(game.ready, []);
  assert.match(game.log.at(-1)!.text, /unallied/);
});
