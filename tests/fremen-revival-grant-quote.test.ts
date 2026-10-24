import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { newRevivalRules } from '../game/revival';
import {
  FremenRevivalGrantError,
  fremenRevivalGrantBlock,
  projectFremenRevivalGrant,
  quoteFremenRevivalGrant,
  validateFremenRevivalGrant,
  type FremenRevivalGrantSource,
} from '../game/fremen-revival-grant';

function fixture(recruits = false): Game {
  const g = createGame('FREMENGRANTQUOTE', newPlayer('f', 'Fremen', 'fremen'));
  g.players.push(
    newPlayer('a', 'Ally', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, { status: 'playing', phase: 4, turn: 3 });
  g.players[0].ally = 'a';
  g.players[1].ally = 'f';
  g.players[1].revived = 0;
  g.freeRevival = [];
  g.revivalRules = newRevivalRules();
  if (recruits) g.recruits = { turn: g.turn, player: 'e', card: 'ecaz-recruits' };
  return g;
}

function rejects(g: Game, owner = 'f') {
  const before = structuredClone(g);
  assert.equal(typeof fremenRevivalGrantBlock(g, owner), 'string');
  assert.throws(() => quoteFremenRevivalGrant(g, owner), FremenRevivalGrantError);
  assert.deepEqual(g, before);
}

void test('a current native Fremen grant quotes only its original turn and mutual ally without mutation', () => {
  const g = fixture(), before = structuredClone(g);
  assert.equal(fremenRevivalGrantBlock(g, 'f'), null);
  assert.deepEqual(quoteFremenRevivalGrant(g, 'f'), { turn: 3, owner: 'f', recipient: 'a' });
  validateFremenRevivalGrant(g, quoteFremenRevivalGrant(g, 'f'));
  assert.deepEqual(projectFremenRevivalGrant(g, 'f'), { recipient: 'a', granted: false, blocked: null });
  assert.deepEqual(g, before);
});

void test('quote validation remains usable within the grant’s own response without a busy gate', () => {
  const g = fixture(), source = quoteFremenRevivalGrant(g, 'f');
  // The focused quote needs no response fields; the engine owns live priority.
  g.response = { kind: 'fremenRevivalGrant', owner: 'f', recipient: 'a', fremenGrant: source, passed: [] };
  const before = structuredClone(g);
  validateFremenRevivalGrant(g, source);
  assert.equal(fremenRevivalGrantBlock(g, 'f'), null);
  assert.deepEqual(g, before);
});

void test('already committed and canceled grants cannot be repeated for the same recipient', () => {
  for (const canceled of [false, true]) {
    const g = fixture(), source = quoteFremenRevivalGrant(g, 'f');
    if (canceled) g.revivalRules!.fremenGrantBlocked = ['a'];
    else g.freeRevival.push('a');
    rejects(g);
    assert.throws(() => validateFremenRevivalGrant(g, source), FremenRevivalGrantError);
    const projected = projectFremenRevivalGrant(g, 'f')!;
    assert.equal(projected.granted, !canceled);
    assert.match(projected.blocked!, canceled ? /Karama prevented/ : /already been granted/);
  }
  const other = fixture();
  other.revivalRules!.fremenGrantBlocked = ['e'];
  assert.equal(fremenRevivalGrantBlock(other, 'f'), null);
});

void test('grant cancellation never changes intrinsic prevention, rates, payments or recipient resources', () => {
  const g = fixture(true);
  g.revivalRules!.fremenGrantBlocked = ['a'];
  g.revivalRules!.freeBlocked = ['e'];
  g.players[1].revived = 3;
  g.players[1].freeForcesRevived = 2;
  const before = structuredClone(g);
  rejects(g);
  projectFremenRevivalGrant(g, 'f');
  assert.deepEqual(g, before);
  assert.deepEqual(g.revivalRules!.freeBlocked, ['e']);
});

void test('a grant needs playing Revival, a valid turn and the unique native Fremen owner', () => {
  for (const change of [
    (g: Game) => { g.status = 'lobby'; },
    (g: Game) => { g.phase = 5; },
    (g: Game) => { g.turn = 0; },
    (g: Game) => { g.turn = 1.5; },
    (g: Game) => { g.players[0].faction = 'guild'; },
    (g: Game) => { g.players[2].faction = 'fremen'; },
    (g: Game) => { g.players.push(structuredClone(g.players[0])); },
  ]) {
    const g = fixture(); change(g); rejects(g);
  }
  rejects(fixture(), 'a');
  rejects(fixture(), 'missing');
});

void test('a missing, self, duplicate or nonreciprocal ally cannot receive the grant', () => {
  for (const change of [
    (g: Game) => { g.players[0].ally = null; },
    (g: Game) => { g.players[0].ally = 'missing'; },
    (g: Game) => { g.players[0].ally = 'f'; },
    (g: Game) => { g.players[1].ally = null; },
    (g: Game) => { g.players[1].ally = 'e'; },
    (g: Game) => { g.players.push(structuredClone(g.players[1])); },
  ]) {
    const g = fixture(); change(g); rejects(g);
  }
});

void test('saved source validation rejects a changed turn, original ally or client-retargeted recipient', () => {
  const original = fixture(), source = quoteFremenRevivalGrant(original, 'f');
  for (const change of [
    (g: Game) => { g.turn++; },
    (g: Game) => { g.players[0].ally = 'e'; g.players[2].ally = 'f'; },
    (g: Game) => { g.players[1].ally = null; },
  ]) {
    const g = structuredClone(original); change(g);
    const before = structuredClone(g);
    assert.throws(() => validateFremenRevivalGrant(g, source), FremenRevivalGrantError);
    assert.deepEqual(g, before);
  }
  assert.throws(() => validateFremenRevivalGrant(original, { ...source, recipient: 'e' }), FremenRevivalGrantError);
});

void test('malformed saved sources reject with the same focused error before mutation', () => {
  const g = fixture(), source = quoteFremenRevivalGrant(g, 'f'), before = structuredClone(g);
  for (const malformed of [
    null, [], {}, { ...source, turn: -1 }, { ...source, owner: '' },
    { ...source, recipient: '' }, { ...source, owner: 'a' },
    { ...source, amount: 6 }, { owner: 'f', recipient: 'a' },
  ]) assert.throws(() => validateFremenRevivalGrant(g, malformed as FremenRevivalGrantSource), FremenRevivalGrantError);
  assert.deepEqual(g, before);
});

void test('active Recruits accepts a later grant with actual prior free usage and retains all prior accounting', () => {
  for (const [revived, free] of [[0, undefined], [0, 0], [3, 2], [4, 4]]) {
    const g = fixture(true);
    g.players[1].revived = revived!;
    g.players[1].freeForcesRevived = free;
    const before = structuredClone(g);
    assert.equal(fremenRevivalGrantBlock(g, 'f'), null);
    assert.deepEqual(quoteFremenRevivalGrant(g, 'f'), { turn: 3, owner: 'f', recipient: 'a' });
    assert.deepEqual(g, before);
  }
});

void test('active Recruits rejects missing prior free history and malformed beneficiary ledgers', () => {
  const usage: [number, number | undefined][] = [
    [1, undefined], [-1, 0], [0.5, 0], [NaN, 0], [Infinity, 0],
    [2, -1], [2, 0.5], [2, NaN], [2, Infinity], [2, 3],
  ];
  for (const [revived, free] of usage) {
    const g = fixture(true);
    g.players[1].revived = revived;
    g.players[1].freeForcesRevived = free;
    rejects(g);
    const projected = projectFremenRevivalGrant(g, 'f')!;
    assert.match(projected.blocked!, /usage is inconsistent or unknown/);
    assert.deepEqual(Object.keys(projected).sort(), ['blocked', 'granted', 'recipient']);
  }
});

void test('inactive and expired Recruits retain the ordinary grant’s existing legacy usage boundary', () => {
  for (const expired of [false, true]) {
    const g = fixture(expired);
    if (g.recruits) g.recruits.turn--;
    g.players[1].revived = 2;
    delete g.players[1].freeForcesRevived;
    assert.equal(fremenRevivalGrantBlock(g, 'f'), null);
  }
});

void test('projection is owner-only and reads no recipient wallet, Tanks or hand', () => {
  const g = fixture(true);
  for (const key of ['spice', 'tanks', 'hand'] as const)
    Object.defineProperty(g.players[1], key, {
      get() { throw new Error(`Grant projection read private ${key}`); },
    });
  assert.deepEqual(projectFremenRevivalGrant(g, 'f'), { recipient: 'a', granted: false, blocked: null });
  for (const viewer of ['a', 'e', 'missing', '']) assert.equal(projectFremenRevivalGrant(g, viewer), null);
  g.players[0].ally = null;
  assert.equal(projectFremenRevivalGrant(g, 'f'), null);
});
