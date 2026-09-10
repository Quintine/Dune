import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { NexusSuboids } from '../components/nexus-suboids';
import { nexusSuboidsAction } from '../game/nexus-suboid-options';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image'
        ? 'vinext/shims/image'
        : specifier === 'next/link'
          ? 'vinext/shims/link'
          : specifier,
      context,
    );
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries(
      [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => [m[1], m[1]]),
    );
    return {
      format: 'module',
      source: `export default ${JSON.stringify(classes)}`,
      shortCircuit: true,
    };
  },
});
const { GameTable } = await import('../components/game-table');
aliases.deregister();

/** Synthetic private offer over an ordinary projected battle; source/custody
 * execution belongs to the engine regression suite. CSS aliases preserve real
 * component structure, without claiming browser or visual acceptance. */
function fixture(): GameView {
  const g = createGame(
    'SUBOIDCONTROLS',
    newPlayer('i', 'Ixians', 'ixians'),
    true,
  );
  g.players.push(
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'i',
    storm: 18,
    order: ['i', 'h', 'a'],
  });
  for (const player of g.players.slice(0, 2)) {
    player.forces = { 'arrakeen:10': 5 };
    player.reserves = 15;
    player.spice = 10;
  }
  g.players[0].elites!.forces = { 'arrakeen:10': 2 };
  g.players[0].elites!.reserves = 5;
  g.battle = {
    event: 'suboid-battle',
    territory: 'arrakeen',
    attacker: 'i',
    defender: 'h',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  const v = viewGame(g, 'i');
  v.nexusCards = {
    card: 'ixians',
    deckCount: 11,
    discardCount: 0,
    held: { i: true, h: false, a: false },
    turn: null,
    choices: [],
    waiting: [],
  };
  v.nexusSuboids = {
    offer: { event: 'suboid-event', blocked: null },
    active: false,
  };
  return v;
}
const html = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(NexusSuboids, { game, busy, act() {} }));

void test('Ixian Cunning binds an owned unsealed battle and authoritative commitment block', () => {
  const v = fixture();
  assert.deepEqual(nexusSuboidsAction(v, 'suboid-event'), {
    type: 'nexusSuboids',
    event: 'suboid-event',
  });
  assert.match(html(v), /rest of this turn/);
  assert.match(html(v), /Cyborgs keep their usual strength and support rules/);
  assert.doesNotMatch(html(v), /disabled=""/);
  assert.match(html(v, true), /disabled=""/);
  assert.equal(nexusSuboidsAction(v, 'stale'), null);
  v.nexusSuboids!.offer!.blocked =
    'The existing plan commitment must remain feasible.';
  assert.equal(nexusSuboidsAction(v, 'suboid-event'), null);
  assert.match(html(v), /existing plan commitment/);
  v.nexusSuboids!.offer!.blocked = null;
  v.battle!.submitted = ['i'];
  assert.equal(nexusSuboidsAction(v, 'suboid-event'), null);
  v.battle!.submitted = [];
  v.phase = 5;
  assert.equal(nexusSuboidsAction(v, 'suboid-event'), null);
});

void test('public active notice identifies Ixian Suboids and never reads an observer’s hidden cards', () => {
  const v = fixture();
  v.nexusSuboids = { offer: null, active: true };
  v.me = 'h';
  v.nexusCards = null;
  for (const player of v.players)
    for (const key of ['hand', 'traitors', 'faceDancers'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error('Private card read');
        },
      });
  const text = html(v);
  assert.match(text, /Ixian Suboids fight at full strength/);
  assert.doesNotMatch(text, /<button|your Suboids/);
  assert.equal(nexusSuboidsAction(v, 'suboid-event'), null);
  v.nexusSuboids = null;
  assert.equal(html(v), '');
});

void test('actual battle editor bounds paid support to Cyborgs when projected Suboids have free support', () => {
  const v = fixture();
  v.nexusSuboids = { offer: null, active: true };
  const forces = v.battle!.ownForces!;
  forces.normalFixedHalf = false;
  forces.normalFreeSupport = true;
  const render = () =>
    renderToStaticMarkup(
      createElement(GameTable, {
        game: v,
        send: async () => {},
        onExit() {},
        busy: false,
      }),
    );
  const text = render();
  const input = text.match(/<input[^>]*id="battle-spice"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /max="2"/);
  assert.match(text, /Spice support here applies only to Cyborgs/);
  forces.elite = 0;
  assert.match(
    render().match(/<input[^>]*id="battle-spice"[^>]*>/)![0],
    /max="0"/,
  );
});
