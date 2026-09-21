import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForceCountFields, forceCountInputError } from '../components/truthtrance-force-count';
import type { ForceCountFact, ForceCountPlayer } from '../game/truthtrance-force-count';
import type { MobileBoard } from '../game/board';

const fact: ForceCountFact = { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'gte', value: 6 };
const player: Pick<ForceCountPlayer, 'faction' | 'elites'> = { faction: 'atreides' };
function markup(value = fact, game: MobileBoard = {}, target = player) {
  return renderToStaticMarkup(createElement(ForceCountFields, { value, game, player: target, onChange() {} }));
}

void test('force fact controls name physical pools and comparisons without revealing a hidden marker value', () => {
  const html = markup();
  for (const value of ['reserves', 'tanks', 'location', 'total', 'normal', 'elite', 'eq', 'gte', 'lte'])
    assert.match(html, new RegExp(`value="${value}"`));
  assert.match(html, /Number of force counters/);
  assert.match(html, /Each physical counter counts once, including advisors/);
  assert.match(html, /Concealed No-Field markers and their hidden values do not count/);
  assert.match(html, /Reserves includes counters on native Homeworlds/);
  assert.match(html, /min="0"/); assert.match(html, /max="9007199254740991"/);
});

void test('location choices use the room board and the selected territory sectors', () => {
  const html = markup({ ...fact, zone: { kind: 'location', territory: 'carthag', sector: 11 } });
  assert.match(html, /Force territory/); assert.match(html, /Carthag/);
  assert.match(html, /Force sector/); assert.match(html, /value="11" selected/);
  assert.doesNotMatch(html, /value="hidden_mobile_stronghold"/);
  assert.doesNotMatch(html, /value="jacurutu"/);
  assert.ok(forceCountInputError({ ...fact, zone: { kind: 'location', territory: 'carthag', sector: 99 } }, {}, player));
});

void test('an absent special-counter split disables typed comparisons without inventing counts', () => {
  const basic = { faction: 'emperor' } as const;
  assert.equal(forceCountInputError(fact, {}, basic), null);
  assert.ok(forceCountInputError({ ...fact, counter: 'elite' }, {}, basic));
  const html = markup({ ...fact, counter: 'elite' }, {}, basic);
  assert.match(html, /value="normal" disabled/); assert.match(html, /value="elite" disabled/);
  assert.match(html, /role="alert"/); assert.match(html, /does not track this faction/);
  const split = { faction: 'emperor' as const, elites: { reserves: 3, tanks: 1, forces: {} } };
  assert.equal(forceCountInputError({ ...fact, counter: 'elite' }, {}, split), null);
  assert.doesNotMatch(markup({ ...fact, counter: 'elite' }, {}, split), /role="alert"/);
});

void test('invalid numeric input stays visible and blocks the shared form validation', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = { ...fact, value };
    assert.ok(forceCountInputError(input, {}, player));
    assert.match(markup(input), /aria-invalid="true"/);
    assert.match(markup(input), /role="alert"/);
  }
  assert.equal(forceCountInputError({ ...fact, value: 0 }, {}, player), null);
});
