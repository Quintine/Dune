import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Action } from '../game/engine';
import { SaphoTruthOrder, SaphoTruthOrderChoiceButton, SaphoTruthOrderPass,
  type SaphoTruthOrderProps } from '../components/sapho-truth-order';

function props(choices: SaphoTruthOrderProps['choices'] = []): SaphoTruthOrderProps & { sent: Action[] } {
  const sent: Action[] = [];
  return { frame: { event: 'public-order-event', revision: 2, holders: ['one', 'two'], passed: [] },
    me: 'one', choices, busy: false, sent, act(action) { sent.push(action); } };
}
const render = (input: SaphoTruthOrderProps) => renderToStaticMarkup(createElement(SaphoTruthOrder, input));

void test('queued holders receive a public continue opportunity without owning Sapho', () => {
  const input = props(), html = render(input);
  assert.match(html, /Truthtrance question order/);
  assert.match(html, /0 of 2 players have finished this choice/);
  assert.match(html, /Continue without changing question order/);
  assert.doesNotMatch(html, /Use Juice of Sapho to ask/);
  const button = SaphoTruthOrderPass(input); button.props.onClick();
  assert.deepEqual(input.sent, [{ type: 'truthOrderPass', event: 'public-order-event', revision: 2 }]);
});

void test('only private quoted choices render and dispatch exact event-bound actions', () => {
  const choices = [{ card: 'private-card-id', mode: 'first' as const }, { card: 'private-card-id', mode: 'last' as const }];
  const input = props(choices), html = render(input);
  assert.match(html, /Use Juice of Sapho to ask first/);
  assert.match(html, /Use Juice of Sapho to ask last/);
  assert.doesNotMatch(html, /private-card-id/);
  for (const choice of choices) SaphoTruthOrderChoiceButton({ ...input, choice }).props.onClick();
  assert.deepEqual(input.sent, choices.map(choice => ({ type: 'saphoTruthOrder', event: 'public-order-event', revision: 2, ...choice })));
});

void test('busy, passed and non-holder viewers cannot issue either action', () => {
  for (const variant of ['busy', 'passed', 'other'] as const) {
    const input = props([{ card: 'sapho-card', mode: 'first' }]);
    if (variant === 'busy') input.busy = true;
    if (variant === 'passed') input.frame.passed.push(input.me);
    if (variant === 'other') input.me = 'other';
    SaphoTruthOrderPass(input).props.onClick();
    SaphoTruthOrderChoiceButton({ ...input, choice: input.choices[0] }).props.onClick();
    assert.deepEqual(input.sent, []);
    if (variant !== 'busy') assert.doesNotMatch(render(input), /data-testid="sapho-truth-order-pass"/);
    else assert.match(render(input), /disabled=""/);
  }
});

void test('callbacks captured before an event, revision, pass or quoted choice changes do not send', () => {
  for (const change of ['event', 'revision', 'pass', 'choice'] as const) {
    const input = props([{ card: 'sapho-card', mode: 'first' }]);
    const pass = SaphoTruthOrderPass(input), choice = SaphoTruthOrderChoiceButton({ ...input, choice: input.choices[0] });
    if (change === 'event') input.frame.event = 'new-event';
    if (change === 'revision') input.frame.revision++;
    if (change === 'pass') input.frame.passed.push(input.me);
    if (change === 'choice') input.choices.splice(0);
    if (change !== 'choice') pass.props.onClick();
    choice.props.onClick();
    assert.deepEqual(input.sent, []);
  }
});
