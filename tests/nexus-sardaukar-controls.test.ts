import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { BattlePromises } from '../components/battle-promises';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';
import { NexusSardaukar } from '../components/nexus-sardaukar';
import { nexusSardaukarAction } from '../game/nexus-sardaukar-options';
import {
  nexusSardaukarFixture,
  beginNexusSardaukar,
  allowNexusSardaukar,
  prepareSardaukarBattle,
} from './fixture-nexus-sardaukar';
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
const html = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(NexusSardaukar, { game, busy, act() {} }));

void test('Emperor Cunning offers one event-bound five-counter play with explicit physical identity', () => {
  const v = viewGame(nexusSardaukarFixture(), 'p');
  const offer = v.nexusSardaukar!.offer!;
  assert.deepEqual(nexusSardaukarAction(v, offer.event), {
    type: 'nexusSardaukar',
    event: offer.event,
  });
  assert.match(html(v), /Use five forces as Sardaukar/);
  assert.match(html(v), /ordinary physical identity, including when lost/);
  assert.doesNotMatch(html(v), /disabled=""|checkbox/);
  assert.match(html(v, true), /disabled=""/);
  assert.equal(nexusSardaukarAction(v, 'stale'), null);
  offer.blocked = 'An earlier Battle Plan commitment would become impossible.';
  assert.equal(nexusSardaukarAction(v, offer.event), null);
  assert.match(html(v), /earlier Battle Plan commitment/);
});

void test('Emperor control retains actor, Advanced, unsealed plan and interruption fences', () => {
  const initial = viewGame(nexusSardaukarFixture(), 'p');
  for (const mutate of [
    (v: GameView) => {
      v.me = 'q';
    },
    (v: GameView) => {
      v.advanced = false;
    },
    (v: GameView) => {
      v.phase = 5;
    },
    (v: GameView) => {
      v.nexusCards!.card = null;
    },
    (v: GameView) => {
      v.battle!.submitted = ['p'];
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
      v.automaticContinuationPending = true;
    },
    (v: GameView) => {
      v.nexusCards!.waiting = ['q'];
    },
  ]) {
    const v = structuredClone(initial);
    mutate(v);
    assert.equal(nexusSardaukarAction(v, v.nexusSardaukar!.offer!.event), null);
  }
  for (const options of [{ normal: 4 }, { starred: 1 }]) {
    const v = viewGame(nexusSardaukarFixture(options), 'p');
    const offer = v.nexusSardaukar!.offer!;
    assert.ok(offer.blocked);
    assert.equal(nexusSardaukarAction(v, offer.event), null);
    assert.ok(html(v).includes(offer.blocked));
  }
});

void test('public pending and active notices avoid private hands and identify ordinary-counter losses', () => {
  const initial = nexusSardaukarFixture();
  const index = initial.deck.findIndex((c) => c.effect === 'karama');
  initial.players[1].hand.push(initial.deck.splice(index, 1)[0]);
  const g = beginNexusSardaukar(initial);
  assert.equal(g.response?.kind, 'nexusSardaukar');
  for (const id of ['p', 'q', 'r']) {
    const v = viewGame(g, id);
    assert.equal(v.nexusSardaukar!.active, false);
    assert.equal(v.battle!.ownForces?.temporaryElite, undefined);
    assert.equal(v.battle!.opponentForces?.temporaryElite, undefined);
    Object.defineProperty(v.nexusSardaukar!, 'offer', {
      get() {
        throw new Error('Private offer read');
      },
    });
    for (const p of v.players)
      Object.defineProperty(p, 'hand', {
        get() {
          throw new Error('Private hand read');
        },
      });
    assert.match(html(v), /Karama may cancel the entire enhancement/);
  }
  const allowed = allowNexusSardaukar(g);
  const observer = viewGame(allowed, 'q');
  assert.equal(observer.battle!.opponentForces?.temporaryElite, 5);
  assert.match(html(observer), /Five ordinary Emperor counters/);
  assert.match(html(observer), /ordinary Tanks/);
  assert.doesNotMatch(html(observer), /<button/);
});

void test('actual battle editor uses temporary strength twelve and physical support seven without starred losses', () => {
  const g = prepareSardaukarBattle(
    allowNexusSardaukar(beginNexusSardaukar(nexusSardaukarFixture())),
  );
  const v = viewGame(g, 'p');
  assert.equal(v.battle!.ownForces!.normal, 7);
  assert.equal(v.battle!.ownForces!.elite, 0);
  assert.equal(v.battle!.ownForces!.temporaryElite, 5);
  const text = renderToStaticMarkup(
    createElement(GameTable, {
      game: v,
      send: async () => {},
      onExit() {},
      busy: false,
    }),
  );
  assert.match(text, /max="12"/);
  assert.match(text.match(/<input[^>]*id="battle-spice"[^>]*>/)![0], /max="7"/);
  assert.match(
    text,
    /Their losses are ordinary counters, not starred Sardaukar/,
  );
});

void test('real future Prescience preparation names Emperor Cunning without spending it during the search', () => {
  let g = nexusSardaukarFixture({ opponentFaction: 'atreides' });
  const cardIndex = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(cardIndex >= 0);
  g.players[1].hand.push(g.deck.splice(cardIndex, 1)[0]);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 10 });
  g = prepareSardaukarBattle(nexusReload(g));
  const before = JSON.stringify(g);
  const v = viewGame(g, 'p');
  const action = v.battle!.compliantPreparation!.actions[0];
  assert.equal(action.type, 'nexusSardaukar');
  assert.equal(g.nexusCards!.cards!.hands.p, 'emperor');
  const text = renderToStaticMarkup(
    createElement(BattlePromises, {
      game: v,
      fill() {},
      act() {},
      busy: false,
    }),
  );
  assert.match(
    text,
    /Declare Emperor Cunning to count five ordinary forces as Sardaukar for this battle/,
  );
  assert.doesNotMatch(text, /Ghola|NaN/);
  assert.equal(JSON.stringify(g), before);
  for (const id of ['q', 'r'])
    assert.equal(viewGame(g, id).battle!.compliantPreparation, null);
  g = applyAction(g, 'p', action);
  assert.equal(g.response?.kind, 'nexusSardaukar');
  assert.equal(viewGame(g, 'p').nexusSardaukar!.active, false);
  g = allowNexusSardaukar(g);
  assert.equal(viewGame(g, 'p').nexusSardaukar!.active, true);
  assert.equal(g.battle!.prescience!.value, 10);
});
