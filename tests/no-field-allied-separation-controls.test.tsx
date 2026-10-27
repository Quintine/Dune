import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvancedAllySeparation } from '../components/advanced-ally-separation';

type Props = Parameters<typeof AdvancedAllySeparation>[0];
const markup = (quote: Props['quote'], basic = false) =>
  renderToStaticMarkup(createElement(AdvancedAllySeparation, { quote, basic }));

// Public-quote render supplements only. They establish wording and display
// behavior, not native alliance eligibility, marker custody or casualties.
void test('no due public territories produce no separation warning in either mode', () => {
  for (const basic of [false, true]) {
    assert.equal(markup(null, basic), '');
    assert.equal(markup({ territories: [] }, basic), '');
    assert.equal(markup({ territories: [], noField: true }, basic), '');
  }
});

void test('ordinary warnings retain the Advanced default and explain the Basic ending deadline without a marker claim', () => {
  const quote = { territories: ['Arrakeen', 'Hagga Basin'] };
  const advanced = markup(quote);
  assert.match(advanced, /id="advanced-ally-separation"/);
  assert.match(advanced, /Finishing now sends your forces in Arrakeen, Hagga Basin to Tanks under the Advanced alliance rule/);
  const basic = markup(quote, true);
  assert.match(basic, /id="basic-ally-separation"/);
  assert.match(basic, /Your ally’s Shipment and Movement turn is finished/);
  assert.match(basic, /Ending your turn now sends your forces in Arrakeen, Hagga Basin to Tanks under the Basic alliance rule/);
  for (const html of [advanced, basic]) assert.doesNotMatch(html, /Provisional|reveal your marker|button|input/);
  assert.deepEqual(quote, { territories: ['Arrakeen', 'Hagga Basin'] });
});

void test('a public No-Field flag persistently explains provisional reveal and actual losses without inventing a quantity or action', () => {
  const quote = { territories: ['Arrakeen'], noField: true as const };
  for (const basic of [false, true]) for (let render = 0; render < 2; render++) {
    const html = markup(quote, basic);
    assert.match(html, /Provisional No-Field consequence/);
    assert.match(html, /at this ending deadline, reveal your marker/);
    assert.match(html, /using only available reserves, then send the actual revealed forces to Tanks/);
    assert.match(html, /A zero marker creates no counter/);
    assert.match(html, /Your ally’s forces stay unchanged/);
    assert.doesNotMatch(html, /\b[035]\b|data-token|data-value|button|input|Confirm/);
  }
  assert.deepEqual(quote, { territories: ['Arrakeen'], noField: true });
});
