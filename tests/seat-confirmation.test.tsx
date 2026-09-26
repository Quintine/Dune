import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeatConfirmation } from '../components/seat-confirmation';
import { Button } from '../components/ui/button';

for (const kind of ['recovery', 'handover'] as const) {
  void test(`${kind} confirmation explains revoked access and only acknowledges on Continue`, () => {
    let acknowledged = 0;
    const notice = SeatConfirmation({ kind, onContinue: () => { acknowledged++; } });
    const markup = renderToStaticMarkup(notice);
    assert.match(markup, /<output/);
    assert.match(markup, /revoked/);
    assert.match(markup, /font-size:1rem/);
    assert.match(markup, /<button[^>]*type="button"[^>]*>Continue<\/button>/);
    assert.doesNotMatch(markup, /autofocus|aria-modal/);
    if (kind === 'handover') assert.match(markup, /Protect your saved seat/);
    assert.equal(acknowledged, 0);
    const button = Children.toArray(notice.props.children).filter(isValidElement).find(child => child.type === Button);
    assert.ok(button);
    (button.props as { onClick: () => void }).onClick();
    assert.equal(acknowledged, 1);
  });
}
