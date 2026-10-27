import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipmentClauseFields, invalidShipmentClause, type ShipmentClauseInput } from '../components/shipment-claim-fields';
import { shipmentExpressionInputError } from '../game/shipment-expression-input';
import type { ShipmentExpression } from '../game/shipment-promises';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
void test('standalone shipment editor defaults to any sector and accepts only printed sectors', () => {
  let value: ShipmentClauseInput = { territory: 'wind_pass', minimum: 2 };
  const tree = () => ShipmentClauseFields({ id: 'shipment', value, onChange(next) { value = next; } });
  const select = (suffix: string, chosen: string) => {
    const element = elements(tree()).find(item => item.props.id === `shipment-${suffix}`); assert.ok(element);
    (element.props.onChange as (event: { currentTarget: { value: string }; target: { value: string } }) => void)(
      { currentTarget: { value: chosen }, target: { value: chosen } });
  };
  const html = renderToStaticMarkup(createElement(ShipmentClauseFields, { id: 'shipment', value, onChange() {} }));
  assert.match(html, /Any sector in this territory/);
  assert.match(html, /Sector 14/);
  assert.doesNotMatch(html, /Sector 9/);
  select('sector', '15'); assert.deepEqual(value, { territory: 'wind_pass', minimum: 2, sector: 15 });
  assert.equal(invalidShipmentClause(value), false);
  select('sector', '19'); assert.deepEqual(value, { territory: 'wind_pass', minimum: 2, sector: 15 });
  select('sector', ''); assert.deepEqual(value, { territory: 'wind_pass', minimum: 2 });
  select('sector', '14'); select('territory', 'arrakeen');
  assert.deepEqual(value, { territory: 'arrakeen', minimum: 2 });
});

void test('sector input validation checks the actual territory while preserving incomplete legacy drafts', () => {
  const exact: ShipmentExpression = { territory: 'wind_pass', minimum: 2, sector: 15 };
  assert.equal(shipmentExpressionInputError(exact), null);
  assert.notEqual(shipmentExpressionInputError({ ...exact, sector: 9 }), null);
  assert.equal(invalidShipmentClause({ territory: 'wind_pass', minimum: 2, sector: 9 }), true);
  assert.equal(invalidShipmentClause({ territory: 'wind_pass', minimum: 0 }), true);
  // Structural input checks intentionally allow ordinary fields to be repaired.
  assert.equal(shipmentExpressionInputError({ territory: '', minimum: 0 }), null);
  assert.equal(shipmentExpressionInputError({ op: 'or', terms: [exact, { territory: 'carthag', minimum: 1 }] }), null);
  assert.notEqual(shipmentExpressionInputError({ op: 'and', terms: [exact,
    { territory: 'wind_pass', minimum: 2, sector: 3 }] }), null);
});

void test('mixed-shipment fields remain on their existing territory-only question interface', () => {
  const mixed = { kind: 'shipment' as const, territory: 'wind_pass', minimum: 2 };
  let result: ShipmentClauseInput = mixed;
  const tree = () => ShipmentClauseFields({ id: 'mixed', value: mixed, onChange(next) { result = next; } });
  assert.equal(elements(tree()).some(item => item.props.id === 'mixed-sector'), false);
  const territory = elements(tree()).find(item => item.props.id === 'mixed-territory'); assert.ok(territory);
  (territory.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'arrakeen' } });
  assert.deepEqual(result, { kind: 'shipment', territory: 'arrakeen', minimum: 2 });
});
