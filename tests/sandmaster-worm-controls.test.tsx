import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandmasterWormChoice } from '../components/sandmaster-worm';
import { sandmasterWormCollection } from '../game/sandmaster-worm';
import { viewGame } from '../game/engine';
import { sandmasterWormGame } from './fixture-sandmaster-worm';

void test('the ride control shows optional destination collection only for its eligible owner and preserves opt-out', () => {
  const g = sandmasterWormGame();
  const quote = sandmasterWormCollection(viewGame(g, 'p'), 'p', 'red_chasm', 7);
  const html = (collect: boolean) => renderToStaticMarkup(createElement(SandmasterWormChoice, { quote, collect, onChange() {} }));
  assert.match(html(true), /checked=""/);
  assert.doesNotMatch(html(false), /checked=""/);
  assert.match(html(true), /Collect 1 spice/);
  assert.match(html(true), /source and intervening territories earn nothing/);
  assert.equal(renderToStaticMarkup(createElement(SandmasterWormChoice, {
    quote: sandmasterWormCollection(viewGame(g, 'h'), 'h', 'red_chasm', 7), collect: true, onChange() {},
  })), '');
  g.spice['red_chasm:7'] = 0;
  const blocked = renderToStaticMarkup(createElement(SandmasterWormChoice, {
    quote: sandmasterWormCollection(viewGame(g, 'p'), 'p', 'red_chasm', 7), collect: true, onChange() {},
  }));
  assert.doesNotMatch(blocked, /type="checkbox"/);
  assert.match(blocked, /may still ride without collecting/);
});
