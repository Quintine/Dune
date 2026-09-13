import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';
import { ShipmentClaimFields, invalidShipmentClause } from '../components/shipment-claim-fields';
import { truthQuestionText, type TruthQuestion } from '../game/truthtrance';
import { applyAction, viewGame } from '../game/engine';
import { ShipmentPromises } from '../components/shipment-promises';
import { compoundShipmentGame, askCompoundShipment } from './fixture-compound-shipment';

const aliases = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
} });
const { Truthtrance } = await import('../components/truthtrance');
aliases.deregister();

const clauses = [{ territory: 'carthag', minimum: 6 }, { territory: 'arrakeen', minimum: 4 }];
function markup(join: 'single' | 'and' | 'or', minimum = 4) {
  return renderToStaticMarkup(createElement(ShipmentClaimFields, {
    id: 'shipment-test', join, clauses: [clauses[0], { ...clauses[1], minimum }],
    onJoin() {}, onClauses() {},
  }));
}
void test('compound shipment fields distinguish one shipment from two and retain accessible per-clause labels', () => {
  assert.equal((markup('single').match(/<fieldset/g) ?? []).length, 1);
  for (const join of ['and', 'or'] as const) {
    const html = markup(join);
    assert.equal((html.match(/<fieldset/g) ?? []).length, 2);
    assert.match(html, /All conditions describe the same shipment/);
    assert.match(html, /A No answer requires the whole statement to be false/);
    for (const index of [0, 1]) {
      assert.match(html, new RegExp(`for="shipment-test-territory-${index}"`));
      assert.match(html, new RegExp(`for="shipment-test-minimum-${index}"`));
    }
    const question: TruthQuestion = { kind: 'shipment', target: 'p', claim: { op: join, terms: clauses } };
    const text = truthQuestionText(question, id => id);
    assert.match(text, /Carthag/);
    assert.match(text, /Arrakeen/);
    assert.match(text, new RegExp(join.toUpperCase()));
  }
});

void test('empty, fractional and out-of-range compound counts stay invalid rather than coercing to a different promise', () => {
  for (const minimum of [NaN, 0, 2.5, 21]) {
    assert.equal(invalidShipmentClause({ territory: 'arrakeen', minimum }), true);
    assert.match(markup('or', minimum), /id="shipment-test-minimum-1"[^>]*aria-invalid="true"/);
  }
  for (const minimum of [1, 20]) assert.equal(invalidShipmentClause({ territory: 'arrakeen', minimum }), false);
});

void test('the real answer panel explains whole-expression No and offers answers only to the respondent', () => {
  const g = askCompoundShipment(compoundShipmentGame(true), { op: 'or', terms: clauses });
  const render = (me: string, busy = false) => renderToStaticMarkup(createElement(Truthtrance, {
    game: viewGame(g, me), act() {}, busy,
  }));
  const own = render('p');
  assert.match(own, /Answer Yes/);
  assert.match(own, /Answer No/);
  assert.match(own, /for AND, at least one condition must be false/);
  assert.match(own, /every condition must be false/);
  assert.match(render('p', true), /<button[^>]*disabled=""[^>]*>Answer Yes/);
  for (const other of ['a', 'o']) {
    assert.doesNotMatch(render(other), />Answer (Yes|No)</);
    assert.match(render(other), /Waiting for Shipper to answer/);
  }
});

void test('accepted compound promises render grouped private guidance and preserve the server completion', () => {
  for (const op of ['and', 'or'] as const) for (const answer of ['yes', 'no'] as const) {
    const terms = op === 'and' ? [clauses[0], { territory: 'carthag', minimum: 4 }] : clauses;
    const asked = askCompoundShipment(compoundShipmentGame(true), { op, terms });
    const promised = applyAction(asked, 'p', { type: 'truthAnswer', answer });
    const view = viewGame(promised, 'p');
    const html = renderToStaticMarkup(createElement(ShipmentPromises, { game: view, act() {}, busy: false }));
    assert.match(html, new RegExp(`You answered ${answer === 'yes' ? 'Yes' : 'No'}`));
    assert.match(html, new RegExp(op.toUpperCase()));
    assert.match(html, /Carthag/);
    assert.doesNotMatch(html, /undefined/);
    if (answer === 'yes') assert.match(html, /Suggested next step/);
    for (const rival of ['a', 'o']) assert.equal(renderToStaticMarkup(createElement(ShipmentPromises, {
      game: viewGame(promised, rival), act() {}, busy: false,
    })), '');
  }
});
