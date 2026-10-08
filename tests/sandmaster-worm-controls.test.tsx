import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandmasterWormChoice } from '../components/sandmaster-worm';
import { sandmasterWormCollection } from '../game/sandmaster-worm';
import { viewGame } from '../game/engine';
import { sandmasterWormGame } from './fixture-sandmaster-worm';

void test('worm collection controls are restricted to the eligible owner and disappear when blocked', () => {
  const g = sandmasterWormGame();
  const render = (player: string) => renderToStaticMarkup(createElement(SandmasterWormChoice, {
    quote: sandmasterWormCollection(viewGame(g, player), player, 'red_chasm', 7),
    collect: true, onChange() {}, onPileChange() {},
  }));
  assert.match(render('p'), /type="checkbox"/);
  assert.equal(render('h'), '');
  g.spice['red_chasm:7'] = 0;
  assert.doesNotMatch(render('p'), /<(?:input|select)\b/);
});
