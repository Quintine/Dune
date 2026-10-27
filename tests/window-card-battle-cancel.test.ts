import test from 'node:test';
import assert from 'node:assert/strict';
import { karamaBattleCancelOpportunity, parseKaramaBattleCancelSource,
  windowCardNativeEffect, windowCardOpportunity, type WindowCardGame } from '../game/window-card-play';

const fixture = (kind: 'voice' | 'prescience' = 'voice'): WindowCardGame => ({
  status: 'playing', advanced: false, phase: 6, turn: 3, shieldWallDestroyed: false,
  battle: { event: 'battle:3:one', territory: 'Arrakeen', revealed: false },
  response: { kind, owner: 'owner', passed: [] },
  players: [{ id: 'owner' }, { id: 'target' }, { id: 'third' }],
});

void test('current native battle response has a canonical public source for either power', () => {
  for (const kind of ['voice', 'prescience'] as const) {
    const game = fixture(kind);
    const source = JSON.stringify(['karamaBattleCancel', 3, 'battle:3:one', 'Arrakeen', kind, 'owner']);
    const opportunity = { effect: 'karamaBattleCancel', source, turn: 3 };
    assert.deepEqual(windowCardOpportunity(game, 'karamaBattleCancel'), opportunity);
    assert.deepEqual(karamaBattleCancelOpportunity(game, 'target'), opportunity);
    assert.deepEqual(parseKaramaBattleCancelSource(source), {
      turn: 3, battle: 'battle:3:one', territory: 'Arrakeen', kind, owner: 'owner',
    });
    assert.equal(windowCardNativeEffect('karamaBattleCancel'), 'karama');
    assert.equal(windowCardOpportunity(game, 'karamaBattleCancel', source)?.source, source);
    assert.equal(windowCardOpportunity(game, 'karamaBattleCancel', `${source} `), null);
    assert.equal(karamaBattleCancelOpportunity(game, 'owner'), null);
    assert.equal(karamaBattleCancelOpportunity(game, 'not-seated'), null);
  }
});

void test('a response or battle identity change never reuses the prior source', () => {
  const game = fixture();
  const source = windowCardOpportunity(game, 'karamaBattleCancel')!.source;
  const variants: WindowCardGame[] = [
    { ...game, turn: 4 },
    { ...game, battle: { event: 'battle:3:two', territory: 'Arrakeen', revealed: false } },
    { ...game, battle: { event: 'battle:3:one', territory: 'Carthag', revealed: false } },
    { ...game, response: { kind: 'prescience', owner: 'owner', passed: [] } },
    { ...game, response: { kind: 'voice', owner: 'third', passed: [] } },
  ];
  for (const variant of variants) {
    assert.ok(windowCardOpportunity(variant, 'karamaBattleCancel'));
    assert.equal(windowCardOpportunity(variant, 'karamaBattleCancel', source), null);
    assert.equal(karamaBattleCancelOpportunity(variant, 'target', source), null);
  }
});

void test('missing, malformed, ineligible and non-Basic response states have no opportunity', () => {
  const game = fixture();
  const variants: WindowCardGame[] = [
    { ...game, status: 'lobby' }, { ...game, advanced: true }, { ...game, advanced: undefined },
    { ...game, phase: 5 }, { ...game, turn: 0 }, { ...game, response: null },
    { ...game, response: { kind: 'nexusPrescience', owner: 'owner' } },
    { ...game, response: { kind: 'voice', owner: 'missing' } },
    { ...game, battle: null },
    { ...game, battle: { event: null, territory: 'Arrakeen', revealed: false } },
    { ...game, battle: { event: 'battle:3:one', territory: 'Arrakeen', revealed: true } },
    { ...game, players: [{ id: 'owner' }, { id: 'owner' }] },
    { ...game, players: undefined },
  ];
  for (const variant of variants) assert.equal(windowCardOpportunity(variant, 'karamaBattleCancel'), null);
});

void test('source parser rejects ambiguous, noncanonical and malformed tuples', () => {
  const invalid = [null, '', '{}', '[]',
    '[ "karamaBattleCancel",3,"event","territory","voice","owner"]',
    JSON.stringify(['karamaBattleCancel', 0, 'event', 'territory', 'voice', 'owner']),
    JSON.stringify(['karamaBattleCancel', 1, 'event', 'territory', 'voice', 'owner', 'extra']),
    JSON.stringify(['karamaBattleCancel', 1, 'event', 'territory', 'nexusPrescience', 'owner']),
    JSON.stringify(['karamaBattleCancel', 1, 'event ', 'territory', 'voice', 'owner']),
  ];
  for (const source of invalid) assert.equal(parseKaramaBattleCancelSource(source), null);
  const source = JSON.stringify(['karamaBattleCancel', 1, 'battle:one', 'territory:two', 'voice', 'owner']);
  const distinct = JSON.stringify(['karamaBattleCancel', 1, 'battle:one:territory', 'two', 'voice', 'owner']);
  assert.notEqual(source, distinct);
  assert.notDeepEqual(parseKaramaBattleCancelSource(source), parseKaramaBattleCancelSource(distinct));
});

void test('public identity does not depend on private hands or passed responders', () => {
  const game = fixture();
  const source = windowCardOpportunity(game, 'karamaBattleCancel')!.source;
  const altered = {
    ...game,
    response: { kind: 'voice', owner: 'owner', passed: ['target'] },
    players: [{ id: 'owner', hand: ['secret-a'] }, { id: 'target', hand: ['secret-b'] }, { id: 'third' }],
  };
  assert.equal(karamaBattleCancelOpportunity(altered, 'target')?.source, source);
  assert.doesNotMatch(source, /secret/);
});
