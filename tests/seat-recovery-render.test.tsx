import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeatRecoveryClaim } from '../components/seat-recovery';

void test('saved-seat recovery renders without a browser window or ambient closed variable', () => {
  assert.equal('closed' in globalThis, false);
  const html = renderToStaticMarkup(<SeatRecoveryClaim onRestored={() => {}} />);
  assert.match(html, /Recover a saved seat/);
  assert.match(html, /Paste your private recovery kit/);
});
