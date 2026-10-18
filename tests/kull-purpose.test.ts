import assert from 'node:assert/strict';
import test from 'node:test';
import { FACTIONS, type FactionId } from '../game/catalog';
import type { ResponseWindow } from '../game/engine';
import {
  isKullPurpose, kullCancellationPurpose, kullSpecialPurpose, kullPurposeLabel,
  kullPurposeBlock, type KullPurpose,
} from '../game/kull-purpose';
import {
  activeKullRestrictions, kullBlocksKarama, validateKullPhaseRestrictions,
  type KullContext, type KullPhaseRestriction,
} from '../game/choam-kull';

const context: KullContext = { turn: 3, phase: 5, players: [
  { id: 'choam', faction: 'choam' }, { id: 'actor', faction: 'emperor' }, { id: 'other', faction: 'guild' },
] };
const stamp = { player: 'actor', turn: 3, phase: 5 };

void test('Advanced Kull restricts the exact public purpose while legacy/Basic restrictions remain all-purpose', () => {
  const history: KullPhaseRestriction[] = [{ ...stamp, purpose: 'shipment-price' }];
  validateKullPhaseRestrictions(context, history);
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', 'shipment-price'), true);
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', 'auction-free-purchase'), false);
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', kullSpecialPurpose('emperor')), false);
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor'), false);
  assert.equal(kullBlocksKarama(history, 3, 5, 'other', 'shipment-price'), false);
  const legacy = [stamp];
  assert.equal(kullBlocksKarama(legacy, 3, 5, 'actor'), true);
  for (const purpose of ['shipment-price', 'auction-free-purchase', 'special:emperor', 'cancel:voice'] as const)
    assert.equal(kullBlocksKarama(legacy, 3, 5, 'actor', purpose), true);
});

void test('active purpose history is copied faithfully and expires by both phase and turn', () => {
  const current = Object.freeze({ ...stamp, purpose: 'cancel:choamWorthless:baliset' as const });
  const history = Object.freeze([current, Object.freeze({ ...stamp, turn: 2, purpose: 'special:emperor' as const })]);
  validateKullPhaseRestrictions(context, history);
  const active = activeKullRestrictions(history, 3, 5);
  assert.deepEqual(active, [current]); assert.notEqual(active[0], current);
  for (const [turn, phase] of [[3, 6], [4, 5], [4, 0]]) {
    assert.deepEqual(activeKullRestrictions(history, turn, phase), []);
    assert.equal(kullBlocksKarama(history, turn, phase, 'actor', current.purpose), false);
  }
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', 'cancel:choamWorthless:kulon'), false);
});

void test('distinct same-phase purposes coexist, while exact purpose and legacy duplicates reject', () => {
  const history: KullPhaseRestriction[] = [stamp, { ...stamp, purpose: 'shipment-price' },
    { ...stamp, purpose: 'auction-free-purchase' }, { ...stamp, purpose: 'cancel:voice' }];
  validateKullPhaseRestrictions(context, history);
  assert.equal(activeKullRestrictions(history, 3, 5).length, 4);
  for (const repeated of history)
    assert.throws(() => validateKullPhaseRestrictions(context, [...history, { ...repeated }]), /duplicate/);
});

void test('restriction history rejects noncanonical purpose strings, undefined extra fields, unrelated fields and future stamps', () => {
  const invalid: unknown[] = [
    undefined, null, '', 'all', 'special:Emperor', 'special:emperor:extra', 'cancel:choamWorthless',
    'cancel:choamWorthless:lalala', 'cancel:choamWorthless:laLaLa:extra', 'cancel:eliteStrength',
    'cancel:eliteStrength:unknown', 'cancel:voice:amount', 'cancel:constructor', 5, {},
    'cancel:nexusPrescience', 'cancel:nexusAdvisorFlip',
  ];
  for (const purpose of invalid) {
    const restriction = { ...stamp, purpose }, before = structuredClone(restriction);
    assert.throws(() => validateKullPhaseRestrictions(context, [restriction]));
    assert.deepEqual(restriction, before);
    assert.equal(isKullPurpose(purpose), false);
  }
  for (const restriction of [
    { ...stamp, purpose: 'shipment-price', extra: true },
    { ...stamp, purpose: 'shipment-price', turn: 4 },
    { ...stamp, purpose: 'shipment-price', phase: 6 },
  ]) assert.throws(() => validateKullPhaseRestrictions(context, [restriction]));
});

void test('each CHOAM ordinary power has its own canonical cancellation purpose without accepting card-name aliases', () => {
  const effects = ['baliset', 'kulon', 'laLaLa', 'gamont', 'jubba', 'kull'];
  const purposes = effects.map(effect => kullCancellationPurpose('choamWorthless', effect));
  assert.equal(new Set(purposes).size, effects.length);
  assert.ok(purposes.every(isKullPurpose));
  for (const detail of [undefined, 'lalala', 'La, La, La!', 'Trip to Gamont', 'baliset:actor', 'constructor'])
    assert.throws(() => kullCancellationPurpose('choamWorthless', detail), /canonical CHOAM effect/);
  const history = [{ ...stamp, purpose: purposes[0] }];
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', purposes[0]), true);
  for (const purpose of purposes.slice(1)) assert.equal(kullBlocksKarama(history, 3, 5, 'actor', purpose), false);
});

void test('special native variants share the actual faction key and special-force cancellation retains its owning faction', () => {
  for (const faction of FACTIONS) {
    const special = kullSpecialPurpose(faction.id);
    assert.equal(special, `special:${faction.id}`);
    assert.ok(isKullPurpose(special));
    const strength = kullCancellationPurpose('eliteStrength', faction.id);
    assert.equal(strength, `cancel:eliteStrength:${faction.id}`);
    assert.ok(isKullPurpose(strength));
  }
  const special = kullSpecialPurpose('emperor');
  const history = [{ ...stamp, purpose: special }];
  // The engine normalizes its native variants to their actual seated faction.
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', kullSpecialPurpose('emperor')), true);
  assert.equal(kullBlocksKarama(history, 3, 5, 'actor', kullSpecialPurpose('guild')), false);
  assert.notEqual(kullCancellationPurpose('eliteStrength', 'emperor'), kullCancellationPurpose('eliteStrength', 'fremen'));
  for (const invalid of ['emperorRevival', 'emperorGift', 'Guild', 'unknown', 'constructor'])
    assert.throws(() => kullSpecialPurpose(invalid as FactionId), /actual native faction/);
  assert.throws(() => kullCancellationPurpose('eliteStrength'), /owner faction/);
});

void test('ordinary cancellations use response semantics alone and reject route/card/private-value suffixes', () => {
  for (const kind of ['voice', 'guildIncome', 'guildRate', 'guildTransportPermission', 'nexusFremenCunning',
    'richeseNoField', 'richeseAuction', 'worthlessKarama'] as const) {
    assert.equal(kullCancellationPurpose(kind), `cancel:${kind}`);
    assert.ok(isKullPurpose(kullCancellationPurpose(kind)));
    assert.throws(() => kullCancellationPurpose(kind, 'private-card-or-route'), /without extra details/);
  }
  assert.throws(() => kullCancellationPurpose('unknown' as ResponseWindow['kind']), /canonical response/);
  assert.throws(() => kullPurposeLabel('special:unknown' as KullPurpose), /canonical purpose/);
});

void test('Nexus aliases share their native purpose while distinct transport and worm powers remain separate', () => {
  for (const [alias, native] of [['nexusPrescience', 'prescience'], ['nexusAdvisorFlip', 'advisorFlip']] as const) {
    const purpose = kullCancellationPurpose(native);
    assert.equal(kullCancellationPurpose(alias), purpose);
    assert.equal(isKullPurpose(`cancel:${alias}`), false);
    assert.throws(() => validateKullPhaseRestrictions(context, [{ ...stamp, purpose: `cancel:${alias}` }]));
    assert.equal(kullBlocksKarama([{ ...stamp, purpose }], 3, 5, 'actor', kullCancellationPurpose(alias)), true);
    assert.throws(() => kullCancellationPurpose(alias, 'extra'), /without extra details/);
  }
  for (const [first, second] of [['guildRate', 'guildTransportPermission'], ['wormSurvival', 'wormAllyProtection']] as const) {
    const firstPurpose = kullCancellationPurpose(first), secondPurpose = kullCancellationPurpose(second);
    assert.notEqual(firstPurpose, secondPurpose);
    assert.ok(isKullPurpose(firstPurpose) && isKullPurpose(secondPurpose));
    assert.equal(kullBlocksKarama([{ ...stamp, purpose: firstPurpose }], 3, 5, 'actor', secondPurpose), false);
  }
});

void test('purpose labels and projected blocks are readable and preserve legacy priority without suppressing another purpose', () => {
  assert.equal(kullPurposeLabel('shipment-price'), 'Karama shipment pricing');
  assert.equal(kullPurposeLabel('auction-free-purchase'), 'a free Treachery purchase');
  assert.equal(kullPurposeLabel(kullSpecialPurpose('emperor')), 'the Emperor special Karama power');
  assert.equal(kullPurposeLabel(kullCancellationPurpose('choamWorthless', 'baliset')), 'cancellation of Baliset');
  const view = { karamaPurposeBlocks: [
    { purpose: 'shipment-price' as const, message: 'Shipment pricing is restricted this phase.' },
    { purpose: 'cancel:voice' as const, message: 'Canceling Voice is restricted this phase.' },
  ] };
  assert.equal(kullPurposeBlock(view, 'shipment-price'), view.karamaPurposeBlocks[0].message);
  assert.equal(kullPurposeBlock(view, 'cancel:voice'), view.karamaPurposeBlocks[1].message);
  assert.equal(kullPurposeBlock(view, 'special:emperor'), null);
  assert.equal(kullPurposeBlock({}, 'shipment-price'), null);
  assert.equal(kullPurposeBlock({ ...view, karamaBlocked: 'All Karama is restricted.' }, 'shipment-price'), 'All Karama is restricted.');
  assert.equal(kullPurposeBlock({ ...view, karamaBlocked: 'All Karama is restricted.' }, 'special:emperor'), 'All Karama is restricted.');
});
