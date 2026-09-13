import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SukGraduatePanel, sukRescueLabel } from '../components/suk-graduate';

void test('Suk controls explain physical destinations, offer decline only where legal, and require a choice', () => {
  const options = [{ normal: 0, elite: 0, kept: null },
    { normal: 2, elite: 1, kept: { key: 'wind_pass:14', kind: 'elite' as const } }];
  const markup = renderToStaticMarkup(createElement(SukGraduatePanel, {
    decision: { kind: 'sukRescue', player: 'a', event: 'battle-1', territory: 'wind_pass', mode: 'skilled', options },
    act: () => { throw new Error('render must not submit'); }, busy: true,
  }));
  assert.match(markup, /Forces to save with Suk Graduate/);
  assert.match(markup, /Do not rescue any forces/);
  assert.match(markup, /keep 1 elite in sector 14; return 2 to reserves/);
  assert.match(markup, /paid battle support is unchanged/);
  assert.match(markup, /<button[^>]*disabled/);
  assert.equal(sukRescueLabel({ normal: 1, elite: 0, kept: null }), 'Save 1 ordinary + 0 elite: return 1 to reserves');
});
