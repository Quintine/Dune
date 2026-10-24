import test from 'node:test';
import assert from 'node:assert/strict';
import { CharityFundingError, quoteCharityFunding, charityPayer } from '../game/charity';
import { createGame, newPlayer } from '../game/engine';

void test('the full ordinary claim uses available CHOAM first, with a provisional bank remainder', () => {
  for (const [cash, choam, bank] of [[0, 0, 2], [1, 1, 1], [2, 2, 0], [8, 2, 0]]) {
    const amounts = { ordinary: 2, homeworld: 0 }, before = structuredClone(amounts);
    assert.deepEqual(quoteCharityFunding(amounts, cash), { choam, bank });
    assert.deepEqual(amounts, before);
  }
});
void test('Homeworld additions stay bank-funded with doubled, partial and absent CHOAM funding', () => {
  assert.deepEqual(quoteCharityFunding({ ordinary: 4, homeworld: 2 }, 3), { choam: 3, bank: 3 });
  assert.deepEqual(quoteCharityFunding({ ordinary: 2, homeworld: 1 }, 8), { choam: 2, bank: 1 });
  assert.deepEqual(quoteCharityFunding({ ordinary: 1, homeworld: 1 }, null), { choam: 0, bank: 2 });
  assert.deepEqual(quoteCharityFunding({ ordinary: 0, homeworld: 0 }, 0), { choam: 0, bank: 0 });
});
void test('invalid balances or claim amounts reject before any private funding calculation', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => quoteCharityFunding({ ordinary: invalid, homeworld: 0 }, 2), CharityFundingError);
    assert.throws(() => quoteCharityFunding({ ordinary: 2, homeworld: invalid }, 2), CharityFundingError);
    assert.throws(() => quoteCharityFunding({ ordinary: 2, homeworld: 0 }, invalid), CharityFundingError);
  }
  assert.throws(() => quoteCharityFunding({ ordinary: Number.MAX_SAFE_INTEGER, homeworld: 1 }, null), CharityFundingError);
});
void test('CHOAM pays only other factions after current allowed opening; its own poverty remains bank-funded', () => {
  const g = createGame('CHARITYFUND', newPlayer('c', 'CHOAM', 'choam'), false, ['choam']);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  assert.equal(charityPayer(g, 'a'), undefined);
  g.choamCharity = { turn: g.turn, canceled: false };
  const before = structuredClone(g);
  assert.equal(charityPayer(g, 'a')?.id, 'c');
  assert.equal(charityPayer(g, 'c'), undefined);
  assert.deepEqual(g, before);
  g.choamCharity.canceled = true;
  assert.equal(charityPayer(g, 'a'), undefined);
  g.choamCharity = { turn: g.turn - 1, canceled: false };
  assert.equal(charityPayer(g, 'a'), undefined);
});
