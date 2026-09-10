import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import { NexusAdvisors } from '../components/nexus-advisors';
import {
  nexusAdvisorAction,
  nexusAdvisorCanAct,
} from '../game/nexus-advisor-options';
import {
  nexusAdvisorFixture,
  beginNexusAdvisorFlip,
  holdAdvisorKarama,
} from './fixture-nexus-advisors';

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
      [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [
        match[1],
        match[1],
      ]),
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

const html = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(NexusAdvisors, { game, busy, act() {} }));

void test('advisor controls name whole territories and counts with an explicit empty initial selection', () => {
  const v = viewGame(nexusAdvisorFixture(), 'p');
  const offer = v.nexusAdvisors!.offer!;
  const before = structuredClone(v);
  const text = html(v);
  assert.match(text, /Pasty Mesa: 3 advisors/);
  assert.match(text, /Arrakeen: 2 advisors/);
  assert.equal((text.match(/class="decision-checkbox min-h-11"/g) ?? []).length, offer.territories.length);
  assert.match(text, /Select all available/);
  assert.match(text, /0 territories selected/);
  assert.match(text, /across all sectors/);
  assert.match(
    text,
    /costs no spice and uses no shipment or movement allowance/,
  );
  assert.doesNotMatch(text, /checked=""/);
  assert.match(text, /disabled=""[^>]*>Convert selected advisors/);
  const selected = offer.territories
    .filter((choice) => !choice.blocked)
    .map((choice) => choice.territory);
  assert.ok(selected.length >= 2);
  assert.deepEqual(nexusAdvisorAction(v, offer.event, selected), {
    type: 'nexusAdvisors',
    event: offer.event,
    territories: selected,
  });
  assert.deepEqual(v, before);
  assert.match(html(v, true), /disabled=""/);
});

void test('shared advisor selection binds event, unique whole groups and projected source boundary reasons', () => {
  const v = viewGame(nexusAdvisorFixture(), 'p');
  const offer = v.nexusAdvisors!.offer!;
  const place = offer.territories.find(
    (choice) => choice.territory === 'arrakeen',
  )!;
  assert.ok(nexusAdvisorAction(v, offer.event, ['arrakeen']));
  for (const choices of [
    [],
    ['arrakeen', 'arrakeen'],
    ['not-a-territory'],
    ['arrakeen:10'],
  ])
    assert.equal(nexusAdvisorAction(v, offer.event, choices), null);
  assert.equal(nexusAdvisorAction(v, 'stale', ['arrakeen']), null);
  // Consumer-only projections prove reasons are displayed rather than guessed
  // from a source rule or the current territory's board graphics.
  place.blocked =
    'Newly accompanied advisors await the same-turn conversion ruling.';
  offer.territories.find(
    (choice) => choice.territory === 'pasty_mesa',
  )!.blocked = 'Conversion in storm awaits its timing ruling.';
  assert.equal(nexusAdvisorAction(v, offer.event, ['arrakeen']), null);
  assert.match(html(v), /Newly accompanied advisors await/);
  assert.match(html(v), /Conversion in storm awaits/);
  offer.blocked = 'Finish the current movement response first.';
  assert.equal(nexusAdvisorCanAct(v), false);
  assert.match(html(v), /Finish the current movement response first/);
});

void test('advisor selection rejects other actors, Basic, wrong phase and all interrupted windows', () => {
  const original = viewGame(nexusAdvisorFixture(), 'p');
  for (const mutate of [
    (v: GameView) => {
      v.me = 'q';
    },
    (v: GameView) => {
      v.advanced = false;
    },
    (v: GameView) => {
      v.phase = 4;
    },
    (v: GameView) => {
      v.active = 'q';
    },
    (v: GameView) => {
      v.players[0].ally = 'q';
    },
    (v: GameView) => {
      v.nexusCards!.card = null;
    },
    (v: GameView) => {
      v.automaticContinuationPending = true;
    },
    (v: GameView) => {
      v.decision = { kind: 'nullentropy', player: 'p' };
    },
    (v: GameView) => {
      v.truthtrance = {
        stage: 'priority',
        queue: [],
        passed: [],
        question: null,
      };
    },
    (v: GameView) => {
      v.nexusCards!.waiting = ['q'];
    },
    (v: GameView) => {
      v.nexusTraitors = {
        offer: null,
        pending: {
          event: 'other',
          owner: 'q',
          mode: 'cunning',
          count: 1,
          choices: [],
        },
      };
    },
  ]) {
    const v = structuredClone(original);
    mutate(v);
    assert.equal(
      nexusAdvisorAction(v, v.nexusAdvisors!.offer!.event, ['arrakeen']),
      null,
    );
  }
});

void test('public pending territory set explains one Karama cancellation without exposing the private offer', () => {
  const initial = nexusAdvisorFixture();
  holdAdvisorKarama(initial);
  const g = beginNexusAdvisorFlip(initial, ['arrakeen', 'pasty_mesa']);
  assert.equal(g.response?.kind, 'nexusAdvisorFlip');
  for (const id of ['p', 'q', 'r']) {
    const v = viewGame(g, id);
    assert.ok(v.nexusAdvisors!.pending);
    Object.defineProperty(v.nexusAdvisors!, 'offer', {
      get() {
        throw new Error('Read offer during public pending response');
      },
    });
    for (const player of v.players)
      Object.defineProperty(player, 'hand', {
        get() {
          throw new Error('Read private hand');
        },
      });
    const text = html(v);
    assert.match(text, /Arrakeen, Pasty Mesa/);
    assert.match(text, /Karama can cancel the entire selection/);
    assert.doesNotMatch(text, /checkbox|Convert selected advisors/);
  }
});

void test('actual response panel names Nexus conversion and offers Karama without printing its internal event', () => {
  const initial = nexusAdvisorFixture();
  holdAdvisorKarama(initial);
  const g = beginNexusAdvisorFlip(initial, ['arrakeen', 'pasty_mesa']);
  const v = viewGame(g, 'q');
  // Real component rendering with CSS selector names preserved above; this is
  // structural response verification, not a browser or visual acceptance claim.
  const text = renderToStaticMarkup(
    createElement(GameTable, {
      game: v,
      send: async () => {},
      onExit() {},
      busy: false,
    }),
  );
  assert.match(text, /Bene Gesserit Nexus advisor conversion/);
  assert.match(text, /Cancel with Karama/);
  assert.match(text, /Allow this power/);
  assert.doesNotMatch(text, /nexusAdvisors/);
  const circleTitles = [
    ...text.matchAll(/<title>(Player circle [^<]+)<\/title>/g),
  ].map((match) => match[1]);
  assert.equal(circleTitles.length, 6);
  assert.ok(
    circleTitles.every((title) =>
      /^Player circle [1-6], sector \d+: .+/.test(title),
    ),
  );
  assert.ok(circleTitles.some((title) => title.includes('Bene Gesserit')));
});
