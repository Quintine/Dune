import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RemovedTreachery } from '../components/removed-treachery';
import { baseDeck, type Card } from '../game/cards';

const atomics = baseDeck().find((card) => card.effect === 'atomics')!;
const weather = baseDeck().find((card) => card.effect === 'weather')!;
const markup = (cards: readonly Card[]) =>
  renderToStaticMarkup(createElement(RemovedTreachery, { cards }));

void test('an empty public removed pile renders no section or invented cards', () => {
  assert.equal(markup([]), '');
});

void test('removed cards have a persistent counted summary and readable public names', () => {
  const single = markup([atomics]);
  assert.match(single, /<details[^>]*aria-label="Removed Treachery cards"/);
  assert.match(single, /<summary[^>]*>Removed from game \(1 card\)<\/summary>/);
  assert.match(single, /<strong>Family Atomics<\/strong>/);

  const multiple = markup([atomics, weather]);
  assert.match(multiple, /Removed from game \(2 cards\)/);
  assert.match(multiple, /<strong>Weather Control<\/strong>/);
  assert.equal(multiple.match(/<li\b/g)?.length, 2);
});

void test('each removed face uses the existing read-only card inspector', () => {
  const html = markup([atomics, weather]);
  assert.match(html, /aria-label="Inspect card: Family Atomics"/);
  assert.match(html, /aria-label="Inspect card: Weather Control"/);
  assert.equal(html.match(/aria-label="Inspect card:/g)?.length, 2);
  assert.doesNotMatch(html, /Play card|Confirm play|Recover card|name="card"/);
});

void test('the removed pile explains its final destination without mutating supplied faces', () => {
  const cards = Object.freeze([Object.freeze({ ...atomics })]);
  const before = JSON.stringify(cards);
  const html = markup(cards);
  assert.match(html, /cannot be drawn, reshuffled or recovered from discard/);
  assert.equal(JSON.stringify(cards), before);
});
