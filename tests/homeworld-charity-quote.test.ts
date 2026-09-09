import test from 'node:test';
import assert from 'node:assert/strict';
import { charityAmount, charityPayer, charityQuote } from '../game/charity';
import { createGame, newPlayer } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import type { FactionId } from '../game/catalog';

function fixture(
  faction: FactionId = 'atreides',
  advanced = false,
  reserves = 5,
) {
  const g = createGame(
    'HOMECHARITY',
    newPlayer('p', 'Recipient', faction),
    advanced,
  );
  g.players.push(newPlayer('c', 'CHOAM', 'choam'));
  const p = g.players[0];
  p.reserves = reserves;
  p.spice = 0;
  if (faction === 'emperor') {
    p.elites = {
      reserves: Math.min(reserves, 5),
      tanks: 0,
      forces: {},
      revived: 0,
    };
  }
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  g.choamCharity = { turn: g.turn, canceled: false };
  return { g, p };
}

void test('ordinary poor-faction eligibility determines the separate bank addition, not a new wealth threshold', () => {
  const { g, p } = fixture();
  for (const [spice, ordinary, homeworld] of [
    [0, 2, 1],
    [1, 1, 1],
    [2, 0, 0],
    [12, 0, 0],
  ]) {
    p.spice = spice;
    const before = structuredClone(g);
    assert.deepEqual(charityQuote(g, p), {
      ordinary,
      homeworld,
      total: ordinary + homeworld,
    });
    assert.equal(charityAmount(g, p), ordinary + homeworld);
    assert.equal(charityPayer(g)?.id, 'c');
    assert.deepEqual(g, before);
  }
  g.choamCharity!.canceled = true;
  p.spice = 1;
  assert.equal(charityPayer(g), undefined);
  assert.deepEqual(charityQuote(g, p), { ordinary: 1, homeworld: 1, total: 2 });
});

void test('Advanced Bene Gesserit retains wealthy charity eligibility while Basic Bene Gesserit does not', () => {
  for (const advanced of [false, true]) {
    const { g, p } = fixture('beneGesserit', advanced, 10);
    for (const spice of [0, 1, 2, 99]) {
      p.spice = spice;
      const ordinary = advanced ? 2 : Math.max(0, 2 - spice);
      assert.deepEqual(charityQuote(g, p), {
        ordinary,
        homeworld: ordinary > 0 ? 1 : 0,
        total: ordinary + (ordinary > 0 ? 1 : 0),
      });
    }
  }
});

void test('only the native primary low side grants a bonus: Salusa low alone and high primary grant none', () => {
  const { g, p } = fixture('emperor', true, 10);
  g.homeworlds!.custody!.salusa = { normal: 0, elite: 1 };
  assert.deepEqual(charityQuote(g, p), { ordinary: 2, homeworld: 0, total: 2 });
  // Both sides low still grant exactly one primary benefit, never two.
  p.reserves = 5;
  p.elites!.reserves = 1;
  assert.deepEqual(charityQuote(g, p), { ordinary: 2, homeworld: 1, total: 3 });
  // At the primary printed high threshold, the bank addition disappears.
  p.reserves = 6;
  assert.deepEqual(charityQuote(g, p), { ordinary: 2, homeworld: 0, total: 2 });
  const basic = fixture('emperor', false, 4);
  assert.deepEqual(charityQuote(basic.g, basic.p), {
    ordinary: 2,
    homeworld: 1,
    total: 3,
  });
});

void test('Inflation starts next turn, doubles both funded portions, and cancels all eligible charity', () => {
  const { g, p } = fixture();
  p.spice = 1;
  g.inflation = {
    side: 'double',
    placedTurn: 1,
    updatedTurn: 1,
    flipped: false,
  };
  assert.deepEqual(charityQuote(g, p), { ordinary: 1, homeworld: 1, total: 2 });
  g.turn = 2;
  assert.deepEqual(charityQuote(g, p), { ordinary: 2, homeworld: 2, total: 4 });
  p.spice = 2;
  assert.deepEqual(charityQuote(g, p), { ordinary: 0, homeworld: 0, total: 0 });
  p.spice = 0;
  g.inflation.side = 'cancel';
  assert.deepEqual(charityQuote(g, p), { ordinary: 0, homeworld: 0, total: 0 });
  const bg = fixture('beneGesserit', true, 10);
  bg.p.spice = 50;
  bg.g.turn = 2;
  bg.g.inflation = { ...g.inflation, side: 'double' };
  assert.deepEqual(charityQuote(bg.g, bg.p), {
    ordinary: 4,
    homeworld: 2,
    total: 6,
  });
  bg.g.inflation.side = 'cancel';
  assert.equal(charityAmount(bg.g, bg.p), 0);
});

void test('disabled or pre-force Homeworld state retains the original ordinary quote', () => {
  const { g, p } = fixture();
  for (const homeworlds of [undefined, null, { custody: null }]) {
    g.homeworlds = homeworlds;
    assert.deepEqual(charityQuote(g, p), {
      ordinary: 2,
      homeworld: 0,
      total: 2,
    });
  }
});

void test('the quote reads only claimant wealth and public custody, never other wealth, cards, predictions or RNG', () => {
  const { g, p } = fixture();
  const claimant = { id: p.id, faction: p.faction, spice: 1 };
  for (const seat of g.players) {
    for (const key of ['hand', 'traitors', 'prediction', 'spice']) {
      Object.defineProperty(seat, key, {
        get() {
          throw new Error(`Private ${seat.id}.${key}`);
        },
      });
    }
  }
  for (const key of ['deck', 'spiceDeck', 'discard']) {
    Object.defineProperty(g, key, {
      get() {
        throw new Error(`Private ${key}`);
      },
    });
  }
  const oldRandom = Math.random;
  Math.random = () => {
    throw new Error('Charity cannot draw randomness.');
  };
  try {
    assert.deepEqual(charityQuote(g, claimant), {
      ordinary: 1,
      homeworld: 1,
      total: 2,
    });
    assert.equal(charityAmount(g, claimant), 2);
  } finally {
    Math.random = oldRandom;
  }
});
