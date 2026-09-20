import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { kwisatzAvailability, type KwisatzDisplayState } from '../game/kwisatz-display';
const aliases = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
} });
const { KwisatzPrivateStatus, KwisatzCardFace, KwisatzReferenceCard } = await import('../components/kwisatz-inspector');
aliases.deregister();

void test('KH private progress distinguishes awakening, death, cancellation and territory reuse', () => {
  const base: KwisatzDisplayState = { active: true, dead: false, losses: 9 };
  const render = (state: KwisatzDisplayState) => renderToStaticMarkup(createElement(KwisatzPrivateStatus, { state, usedTerritoryName: 'Arrakeen' }));
  assert.match(render({ ...base, active: false, losses: 6 }), /6 of 7 battle losses/);
  assert.match(render({ ...base, active: false, losses: 6 }), /Not yet available/);
  assert.match(render(base), /9 of 7 battle losses · awakened/);
  assert.match(render(base), /max="7" value="7"/);
  assert.match(render({ ...base, dead: true }), /In the Tleilaxu Tanks/);
  const used = { ...base, usedAt: 'arrakeen' };
  assert.match(render(used), /Used this turn in Arrakeen/);
  assert.match(kwisatzAvailability(used, { territory: 'arrakeen', blocked: false }), /same territory/);
  assert.match(kwisatzAvailability(used, { territory: 'carthag', blocked: false }), /another territory/);
  assert.match(kwisatzAvailability(used, { territory: 'arrakeen', blocked: true }), /Karama prevents/);
});

void test('KH reference has no private status and its original companion artwork is bundled separately', () => {
  const html = renderToStaticMarkup(createElement(KwisatzReferenceCard));
  assert.match(html, /Inspect Kwisatz Haderach · rules reference/);
  assert.doesNotMatch(html, /Your private status|<progress|of 7 battle losses/);
  const face = renderToStaticMarkup(createElement(KwisatzCardFace));
  assert.match(face, /kwisatz-haderach-v1.png/);
  const png = readFileSync(new URL('../public/art/leaders/kwisatz-haderach-v1.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1254);
  assert.equal(png.readUInt32BE(20), 1254);
});
