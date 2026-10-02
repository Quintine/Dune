import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileMixedShipmentExpression,
  parseMixedShipmentExpression,
  type MixedShipmentExpression,
} from '../game/mixed-shipment-question';
import {
  matchesShipment,
  parseShipmentClaim,
  parseShipmentExpression,
  shipmentClaimDestinations,
  validShipmentClaim,
  ShipmentClaimError,
  type ShipmentExpression,
} from '../game/shipment-promises';
import { truthFactAnswer, type TruthAnswer, type TruthFact } from '../game/truthtrance';

const fact = (value = 5): MixedShipmentExpression => ({
  kind: 'fact', fact: { kind: 'spice', compare: 'gte', value },
});
const shipment = (territory = 'carthag', minimum = 4): MixedShipmentExpression => ({
  kind: 'shipment', territory, minimum,
});
const group = (
  kind: 'and' | 'or', ...terms: MixedShipmentExpression[]
): MixedShipmentExpression => ({ kind, terms });
// The caller supplies fact legality; these already-typed fixtures isolate the shared budget.
const decode = (value: unknown) =>
  parseMixedShipmentExpression(value, (input) => input as TruthFact);
const events = [
  null,
  { territory: 'carthag', amount: 3 },
  { territory: 'carthag', amount: 4 },
  { territory: 'arrakeen', amount: 4 },
];
const outcomes = (expression: ShipmentExpression) =>
  events.map((event) => matchesShipment({ claim: expression }, event));

void test('AND and OR bind the whole question, including No rather than individual leaves', () => {
  for (const [kind, answer, expected] of [
    ['and', 'yes', [false, false, true, false]],
    ['and', 'no', [false, false, false, false]],
    ['or', 'yes', [true, true, true, true]],
    ['or', 'no', [false, false, true, false]],
  ] as const) {
    const expression = compileMixedShipmentExpression(
      decode(group(kind, fact(), shipment())), () => answer,
    );
    assert.deepEqual(outcomes(expression), expected);
  }
});

void test('nested mixed branches evaluate the same eventual event across different destinations', () => {
  const expression = decode(group('or',
    group('and', fact(5), shipment('carthag', 4)),
    group('and', fact(10), shipment('arrakeen', 3)),
  ));
  const player = { hand: [], traitors: [], traitorChoices: [], spice: 7 };
  const claim = compileMixedShipmentExpression(expression, (f) => truthFactAnswer(player, f));
  assert.deepEqual(outcomes(claim), [false, false, true, false]);
  player.spice = 12;
  const laterClaim = compileMixedShipmentExpression(expression, (f) => truthFactAnswer(player, f));
  assert.deepEqual(outcomes(laterClaim), [false, false, true, true]);
  assert.deepEqual(shipmentClaimDestinations({ claim }), ['carthag', 'arrakeen']);
});

void test('unknown is not false: decisive AND/OR branches dominate regardless of order', () => {
  const unknown: ShipmentExpression = { constant: 'unknown' };
  for (const order of [false, true]) {
    for (const [op, constant, expected] of [
      ['and', 'no', false],
      ['and', 'yes', null],
      ['or', 'yes', true],
      ['or', 'no', null],
    ] as const) {
      const known: ShipmentExpression = { constant };
      const claim: ShipmentExpression = {
        op, terms: order ? [known, unknown] : [unknown, known],
      };
      assert.equal(matchesShipment({ claim }, null), expected);
    }
  }
  const and = compileMixedShipmentExpression(group('and', fact(), shipment()), () => 'unknown');
  const or = compileMixedShipmentExpression(group('or', fact(), shipment()), () => 'unknown');
  assert.deepEqual(outcomes(and), [false, false, null, false]);
  assert.deepEqual(outcomes(or), [null, null, true, null]);
  assert.deepEqual(outcomes({ op: 'or', terms: [and, { constant: 'no' }] }),
    [false, false, null, false]);
});

void test('compilation freezes current answers once, not a callback or later fact state', () => {
  const player = { hand: [], traitors: [], traitorChoices: [], spice: 7 };
  const asked = decode(group('or', fact(), shipment()));
  const frozen = compileMixedShipmentExpression(asked, (f) => truthFactAnswer(player, f));
  player.spice = 0;
  assert.equal(matchesShipment({ claim: frozen }, null), true);
  assert.equal(matchesShipment({ claim: JSON.parse(JSON.stringify(frozen)) as ShipmentExpression },
    { territory: 'arrakeen', amount: 1 }), true);
  assert.equal(matchesShipment({
    claim: compileMixedShipmentExpression(asked, (f) => truthFactAnswer(player, f)),
  }, null), false);

  const negative = compileMixedShipmentExpression(group('and', fact(), shipment()),
    (f) => truthFactAnswer(player, f));
  player.spice = 20;
  assert.equal(matchesShipment({ claim: negative }, { territory: 'carthag', amount: 20 }), false);
});

void test('public shipment and mixed decoders reject private literals; stored internal claims retain unknown', () => {
  for (const constant of ['yes', 'no', 'unknown'] as TruthAnswer[]) {
    const compiled: ShipmentExpression = {
      op: 'or', terms: [{ constant }, { territory: 'carthag', minimum: 4 }],
    };
    assert.throws(() => parseShipmentExpression(compiled), ShipmentClaimError);
    assert.throws(() => parseShipmentClaim({ claim: compiled }), ShipmentClaimError);
    assert.equal(validShipmentClaim({ claim: compiled }), false);
    const stored = parseShipmentClaim({ claim: compiled }, { allowConstants: true });
    assert.equal(matchesShipment(stored, null), constant === 'unknown' ? null : constant === 'yes');
    assert.deepEqual(shipmentClaimDestinations(stored), ['carthag']);
    assert.throws(() => decode({kind:'or',terms:[fact(),{constant}]}), ShipmentClaimError);
    assert.throws(() => decode({kind:'or',terms:[{...fact(),constant},shipment()]}), ShipmentClaimError);
  }
  for (const constant of ['maybe', true, null])
    assert.throws(() => parseShipmentExpression({ constant }, { allowConstants: true }), ShipmentClaimError);
  assert.throws(() => parseShipmentExpression({ constant: 'yes', territory: 'carthag' },
    { allowConstants: true }), ShipmentClaimError);
});

void test('one grouping depth and logical-leaf budget includes embedded fact groups', () => {
  // Group nodes do not consume leaves: fifteen current facts plus one shipment fit.
  decode(group('and', ...Array.from({ length: 15 }, () => fact()), shipment()));
  assert.throws(() => decode(group('and', ...Array.from({ length: 16 }, () => fact()), shipment())),
    ShipmentClaimError);
  const factGroup: TruthFact = { kind: 'or', terms: [
    { kind: 'spice', compare: 'gte', value: 5 },
    { kind: 'spice', compare: 'gte', value: 10 },
  ] };
  const embedded: MixedShipmentExpression = { kind: 'fact', fact: factGroup };
  decode(group('and', ...Array.from({ length: 7 }, () => embedded), fact(), shipment()));
  assert.throws(() => decode(group('and', ...Array.from({ length: 8 }, () => embedded), shipment())),
    ShipmentClaimError);
  let nested: MixedShipmentExpression = embedded;
  for (let n = 0; n < 3; n++) nested = group('or', shipment(), nested);
  decode(nested); // Three mixed groups plus the embedded fact group.
  assert.throws(() => decode(group('and', shipment(), nested)), ShipmentClaimError);
});

void test('mixed decoding keeps the supplied fact legality authority and rejects malformed grouping or shipment leaves', () => {
  const forbidden = new Error('Fact is unavailable to this respondent.');
  assert.throws(() => parseMixedShipmentExpression(group('and', fact(), shipment()), () => {
    throw forbidden;
  }), (error) => error === forbidden);
  for (const value of [
    fact(), shipment(), group('and', fact()), group('or'),
    { kind: 'xor', terms: [fact(), shipment()] },
    group('and', fact(), shipment('missing', 4)),
    group('and', fact(), shipment('carthag', 0)),
    group('and', fact(), shipment('carthag', 21)),
    group('and', fact(), shipment('carthag', 1.5)),
    { kind: 'and', terms: [fact(), shipment()], constant: 'yes' },
  ]) assert.throws(() => decode(value), ShipmentClaimError);
});
