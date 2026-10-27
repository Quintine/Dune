import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import { act, createFremenOverlapFixture, triggerFremen } from './fixture-overlap-fremen-native';
import { createGuildOverlapChildFixture } from './fixture-guild-overlap-child';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1],match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const { EcazEntry } = await import('../components/ecaz-entry');
aliases.deregister();

const htmlFor = (game: GameView, busy = false) => renderToStaticMarkup(createElement(EcazEntry,
  { game, busy, act() { assert.fail('Rendering cannot submit an action'); } }));
function triggerButton(html: string) {
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  const match = buttons.find(([, , text]) => text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').includes('Trigger for yourself'));
  assert.ok(match, 'The current Ecaz player sees its projected trigger');
  return match[1];
}

void test('Fremen overlap exposes the enabled real Ambassador trigger and relocation controls', () => {
  const f = createFremenOverlapFixture('ambassador');
  const offered = act(f.game, f.entrant, f.shipment);
  const view = viewGame(offered, 'ecaz');
  assert.equal(view.ambassadorEntry?.beneficiaries[0].blocked, null);
  const html = htmlFor(view);
  assert.match(html, /Fremen Ambassador/);
  assert.doesNotMatch(triggerButton(html), /\bdisabled(?:=|\s|>)/);
  assert.match(triggerButton(htmlFor(view, true)), /\bdisabled/);
  const selected = triggerFremen(offered);
  const movement = viewGame(selected, 'ecaz');
  assert.ok(movement.ambassadorEntry?.movement?.sources.length);
  assert.match(htmlFor(movement), /aria-label="Ambassador force relocation"/);
  assert.match(htmlFor(movement), /Relocate selected forces/);
});

void test('Guild overlap exposes the enabled real Ambassador trigger and shipment controls', () => {
  const f = createGuildOverlapChildFixture('ambassador', true);
  const offered = act(f.game, f.entrant, f.shipment);
  const view = viewGame(offered, 'ecaz');
  assert.equal(view.ambassadorEntry?.beneficiaries[0].blocked, null);
  const html = htmlFor(view);
  assert.match(html, /Guild Ambassador/);
  assert.doesNotMatch(triggerButton(html), /\bdisabled(?:=|\s|>)/);
  assert.match(triggerButton(htmlFor(view, true)), /\bdisabled/);
  const entry = offered.pendingAmbassador; assert.ok(entry);
  const selected = act(offered, 'ecaz', { type:'decision', event:entry.event, trigger:true, beneficiary:'ecaz' });
  const shipment = viewGame(selected, 'ecaz');
  assert.ok(shipment.ambassadorEntry?.shipment?.destinations.length);
  const selectedHtml = htmlFor(shipment);
  assert.match(selectedHtml, /aria-label="Ambassador reserve shipment"/);
  assert.match(selectedHtml, /Ship selected forces for free/);
});
