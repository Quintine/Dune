import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import { act, createPublicChoamKullFixture as fixture, publicKullAttempt as attempt } from './fixture-public-choam-kull';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url),'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1],match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const { GameTable } = await import('../components/game-table');
const { ChoamKull } = await import('../components/choam-kull');
aliases.deregister();
const table = (game: GameView,busy = false) => renderToStaticMarkup(createElement(GameTable,
  {game,busy,send:async () => {},onExit() {}}));
const reaction = (game: GameView,busy = false) => renderToStaticMarkup(createElement(ChoamKull,
  {game,busy,act() {}}));

void test('public host lobby shows the explicitly selected Kull preview and its limits', () => {
  const f = fixture(), host = viewGame(f.lobby,f.lobby.host), html = table(host);
  assert.equal(host.lobbyModules?.kullPreview,true);
  assert.match(html,/Kull Wahad · Basic development preview/);
  assert.match(html,/does not support structured Truthtrance questions about bids/);
  assert.match(html,/defers unfunded non-CHOAM Karama-dependent bids/);
  const off = act(f.lobby,f.lobby.host,{type:'moduleOption',module:'kullPreview',enabled:false});
  const unselected = viewGame(off,off.host);
  assert.equal(unselected.lobbyModules?.kullPreview,false);
  assert.match(table(unselected),/Kull Wahad · Basic development preview/);
  assert.doesNotMatch(table(unselected),/does not support structured Truthtrance questions about bids/);
  const nonhost = table(viewGame(f.lobby,f.actor));
  assert.match(nonhost,/disabled=""[^>]*type="checkbox"|type="checkbox"[^>]*disabled=""/);
});

void test('the real public table exposes Kull use and decline only to the reactor', () => {
  const f = fixture(), offered = act(f.game,f.actor,attempt(f));
  const holder = viewGame(offered,f.reactor), other = viewGame(offered,f.actor);
  assert.match(reaction(holder),/Use Kull Wahad/);
  assert.match(reaction(holder),/Decline Kull/);
  assert.match(table(holder),/aria-label="Kull Wahad response"/);
  assert.match(table(holder),/Use Kull Wahad/);
  assert.match(reaction(holder,true),/disabled=""[^>]*>Use Kull Wahad/);
  assert.doesNotMatch(reaction(other),/Use Kull Wahad|Decline Kull|ix-kull-wahad/);
  assert.match(reaction(other),/Waiting for/);
});
