import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomeworldCustody, type HomeworldCustodyContext } from '../game/homeworld-custody';
import { tupileIntelligenceTargets, quoteTupileIntelligenceRequest } from '../game/tupile-intelligence';

function fixture(advanced = true) {
  const context: HomeworldCustodyContext = { advanced, players: [
    { id: 'c', faction: 'choam', reserves: 10, eliteReserves: 0 },
    { id: 'e', faction: 'emperor', reserves: 10, eliteReserves: 5 },
    { id: 'a', faction: 'atreides', reserves: 10, eliteReserves: 0 },
    { id: 'f', faction: 'fremen', reserves: 5, eliteReserves: 2 },
  ] };
  return { context, custody: createHomeworldCustody(context) };
}

void test('either physical contact direction qualifies only its native faction, without requiring sole occupation', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:atreides'] = { c: { normal: 1, elite: 0 }, e: { normal: 1, elite: 0 } };
  custody.visitors['homeworld:choam'] = { f: { normal: 0, elite: 1 } };
  const targets = tupileIntelligenceTargets(context, custody, 'c', [], 'unoccupied');
  assert.equal(targets.find((p) => p.player === 'a')!.blocked, null);
  assert.equal(targets.find((p) => p.player === 'f')!.blocked, null);
  assert.match(targets.find((p) => p.player === 'e')!.blocked!, /must be on/);
  assert.deepEqual(targets.find((p) => p.player === 'f')!.contact, ['homeworld:choam']);
});

void test('zero foreign pools and contact only on a third faction’s world do not qualify', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:atreides'] = { c: { normal: 1, elite: 0 }, e: { normal: 1, elite: 0 } };
  custody.visitors['homeworld:choam'] = { e: { normal: 0, elite: 0 } };
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'e', 'weapons'), /must be on/);
});

void test('either Emperor world supplies contact, but the lifetime use belongs to Emperor once', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:emperor:salusa'] = { c: { normal: 1, elite: 0 } };
  assert.equal(quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'e', 'defenses').faction, 'emperor');
  custody.visitors['homeworld:emperor'] = { c: { normal: 1, elite: 0 } };
  assert.equal(tupileIntelligenceTargets(context, custody, 'c', [], 'unoccupied').find((p) => p.player === 'e')!.contact.length, 2);
  const restored = JSON.parse(JSON.stringify({ context, custody, used: ['emperor'] as const }));
  for (const category of ['weapons', 'defenses'] as const)
    assert.throws(() => quoteTupileIntelligenceRequest(restored.context, restored.custody, 'c', restored.used, 'unoccupied', 'e', category), /already been used/);
});

void test('native threshold is inclusive and separate from foreign contact and supplied occupation status', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:choam'] = { e: { normal: 1, elite: 0 } };
  assert.equal(quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'e', 'weapons').category, 'weapons');
  const native = context.players.find((p) => p.id === 'c')!;
  native.reserves = 11;
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'e', 'weapons'), /at most ten/);
  native.reserves = 0;
  delete custody.visitors['homeworld:choam'];
  custody.visitors['homeworld:emperor'] = { c: { normal: 1, elite: 0 } };
  assert.equal(quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'e', 'weapons').faction, 'emperor');
  for (const occupation of ['unknown', 'occupied'] as const)
    assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], occupation, 'e', 'weapons'), /occupation|Occupied/);
});

void test('queries do not mutate contact custody or lifetime usage, and another faction retains its request', () => {
  const { context, custody } = fixture(false);
  custody.visitors['homeworld:choam'] = { e: { normal: 1, elite: 0 }, a: { normal: 1, elite: 0 } };
  const used = ['emperor'] as const;
  const before = structuredClone({ context, custody, used });
  const quote = quoteTupileIntelligenceRequest(context, custody, 'c', used, 'unoccupied', 'a', 'defenses');
  quote.contact.length = 0;
  assert.deepEqual({ context, custody, used }, before);
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', used, 'unoccupied', 'e', 'defenses'), /already been used/);
});

void test('malformed occupation, usage, owner, target and category reject without mutation', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const before = structuredClone({ context, custody });
  assert.throws(() => tupileIntelligenceTargets(context, custody, 'a', [], 'unoccupied'), /Only.*CHOAM/);
  assert.throws(() => tupileIntelligenceTargets(context, custody, 'c', [], 'bad' as never), /occupation/);
  for (const used of [['emperor', 'emperor'], ['choam'], ['guild']])
    assert.throws(() => tupileIntelligenceTargets(context, custody, 'c', used as never, 'unoccupied'), /unique seated/);
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'c', 'weapons'), /opposing faction/);
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'missing', 'weapons'), /opposing faction/);
  assert.throws(() => quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'a', 'both' as never), /either/);
  assert.deepEqual({ context, custody }, before);
});

void test('hidden hands, balances, plans, skills and No-Field data cannot affect eligibility', () => {
  const { context, custody } = fixture();
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const expected = tupileIntelligenceTargets(context, custody, 'c', [], 'unoccupied');
  for (const player of context.players)
    for (const field of ['hand', 'spice', 'traitors', 'noField', 'leaders', 'battlePlan'])
      Object.defineProperty(player, field, { get() { throw new Error(`private ${field} accessed`); } });
  assert.deepEqual(tupileIntelligenceTargets(context, custody, 'c', [], 'unoccupied'), expected);
  const quote = quoteTupileIntelligenceRequest(context, custody, 'c', [], 'unoccupied', 'a', 'weapons');
  assert.deepEqual(Object.keys(quote).sort(), ['category', 'contact', 'faction', 'owner', 'target']);
});
