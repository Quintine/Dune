import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SmugglerShipmentChoice } from '../components/smuggler-shipment';

void test('Smuggler controls preserve a real opt-out and distinguish total physical forces from the priced count', () => {
  const quote = { leader: 'emperor-0', amount: 3 };
  const render = (use: boolean, busy = false) =>
    renderToStaticMarkup(
      createElement(SmugglerShipmentChoice, {
        quote,
        use,
        busy,
        onChange() {},
      }),
    );
  const enabled = render(true);
  assert.match(enabled, /checked=""/);
  assert.match(enabled, /price is for 2/);
  assert.match(enabled, /All 3 selected forces leave reserves/);
  assert.doesNotMatch(render(false), /checked=""/);
  assert.match(render(false), /ordinary price applies to every selected force/);
  assert.match(render(true, true), /disabled=""/);
  assert.equal(
    renderToStaticMarkup(
      createElement(SmugglerShipmentChoice, {
        quote: null,
        use: true,
        busy: false,
        onChange() {},
      }),
    ),
    '',
  );
});
