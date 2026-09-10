import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { MOBILE_STRONGHOLD, gameTerritories } from '../game/board';
import { ShipmentQuote } from '../components/shipment-quote';
import {
  nexusRicheseAction,
  nexusRicheseCanAct,
  nexusRicheseQuote,
} from '../game/nexus-richese-options';
import {
  nexusRicheseFixture,
  nexusRicheseInventory,
  nexusRicheseAllow,
} from './fixture-nexus-richese';
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
  renderToStaticMarkup(
    createElement(GameTable, {
      game,
      busy,
      send: async () => {},
      onExit() {},
    }),
  );
const shipment = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 5,
  elite: 0,
};

void test('actual Basic and Advanced shipment panel defaults to ordinary shipping; authorized five-force quote and action preserve physical custody', () => {
  for (const advanced of [false, true]) {
    const f = nexusRicheseFixture({ advanced, spice: 1 });
    const v = viewGame(f.g, f.owner),
      before = structuredClone(v);
    const markup = html(v);
    assert.match(markup, /Use Richese Nexus Secret Ally/);
    const checkbox = markup.match(
      /<input[^>]*type="checkbox"[^>]*>[\s\S]{0,150}Use Richese Nexus Secret Ally/,
    )?.[0];
    assert.ok(checkbox);
    assert.doesNotMatch(checkbox, /checked=""/);
    assert.match(markup, /This uses your ordinary shipment/);
    assert.match(
      html(v, true).match(
        /<input[^>]*type="checkbox"[^>]*>[\s\S]{0,150}Use Richese Nexus Secret Ally/,
      )![0],
      /disabled=""/,
    );
    const quote = nexusRicheseQuote(v, 'arrakeen', 5)!;
    assert.equal(quote.cost, 1);
    assert.equal(quote.physicalAmount, 5);
    assert.equal(quote.pricedAmount, 1);
    const price = renderToStaticMarkup(
      createElement(ShipmentQuote, {
        physicalForces: quote.physicalAmount,
        quote: {
          cost: quote.cost,
          normalCost: 5,
          ownPayment: 1,
          pledgedPayment: 0,
        },
        funding: { ownSpice: 1, pledgedSpice: 0 },
      }),
    );
    assert.match(price, /Shipment cost: 1 spice/);
    assert.match(price, /Normal cost: 5 spice/);
    assert.match(price, /Physical forces selected<\/dt><dd[^>]*>5<\/dd>/);
    const action = nexusRicheseAction(v, v.nexusRichese!.event, shipment)!;
    assert.deepEqual(action, { ...shipment, nexus: v.nexusRichese!.event });
    const settled = nexusRicheseAllow(applyAction(f.g, f.owner, action));
    const me = settled.players.find((p) => p.id === f.owner)!;
    assert.equal(me.reserves, 15);
    assert.equal(me.forces['arrakeen:10'], 5);
    assert.equal(me.spice, 0);
    assert.equal(me.shipped, true);
    assert.equal(me.moved, 0);
    assert.equal(me.noField, undefined);
    nexusRicheseInventory(settled);
    assert.deepEqual(v, before);
  }
});

void test('shared Richese source fences reject stale, unavailable, oversized and marker routes and keep faction pricing', () => {
  const f = nexusRicheseFixture(),
    v = viewGame(f.g, f.owner),
    event = v.nexusRichese!.event;
  assert.equal(nexusRicheseAction(v, 'stale', shipment), null);
  for (const change of [
    { amount: 0 },
    { amount: 6 },
    { amount: 1.5 },
    { noField: 'token' },
    { territory: 'homeworld:harkonnen' },
    { type: 'guildShip' },
    { nexus: event },
  ])
    assert.equal(
      nexusRicheseAction(v, event, { ...shipment, ...change }),
      null,
    );
  for (const mutate of [
    (g: GameView) => {
      g.turn++;
    },
    (g: GameView) => {
      g.phase = 6;
    },
    (g: GameView) => {
      g.active = f.target;
    },
    (g: GameView) => {
      g.players[0].shipped = true;
    },
    (g: GameView) => {
      g.players[0].ally = f.target;
    },
    (g: GameView) => {
      g.nexusCards!.card = null;
    },
    (g: GameView) => {
      g.automaticContinuationPending = true;
    },
    (g: GameView) => {
      g.nexusRichese!.blocked = 'Finish the current interaction.';
    },
  ]) {
    const changed = structuredClone(v);
    mutate(changed);
    assert.equal(nexusRicheseAction(changed, event, shipment), null);
  }
  v.nexusRichese!.blocked = 'Finish the current interaction.';
  assert.match(html(v), /Finish the current interaction/);
  for (const faction of ['guild', 'fremen'] as const) {
    const own = nexusRicheseFixture({ ownerFaction: faction, spice: 1 });
    const view = viewGame(own.g, own.owner);
    assert.equal(
      nexusRicheseQuote(view, 'polar_sink', 5)!.cost,
      faction === 'guild' ? 1 : 0,
    );
  }
});

void test('Richese offer and helper never expose or inspect another player card or balance', () => {
  const f = nexusRicheseFixture();
  for (const id of [f.target, f.observer]) {
    const v = viewGame(f.g, id);
    assert.equal(v.nexusRichese, null);
    assert.doesNotMatch(html(v), /Use Richese Nexus Secret Ally/);
    Object.defineProperty(v, 'nexusRichese', {
      get() {
        throw new Error('Private offer read');
      },
    });
    assert.equal(nexusRicheseCanAct(v), false);
    assert.equal(nexusRicheseAction(v, 'unknown', shipment), null);
  }
  const v = viewGame(f.g, f.owner);
  for (const p of v.players.filter((p) => p.id !== f.owner))
    for (const field of ['hand', 'spice', 'traitors'])
      Object.defineProperty(p, field, {
        get() {
          throw new Error('Private opponent read');
        },
      });
  assert.equal(nexusRicheseQuote(v, 'arrakeen', 5)!.cost, 1);
});

void test('Richese price preserves a native Ixian shipment into the present mobile stronghold without granting another faction entry', () => {
  for (const advanced of [false, true]) {
    const f = nexusRicheseFixture({
      ownerFaction: 'ixians',
      advanced,
      spice: 1,
    });
    const v = viewGame(f.g, f.owner);
    const hms = gameTerritories(v).find((t) => t.id === MOBILE_STRONGHOLD)!;
    assert.ok(hms);
    const quote = nexusRicheseQuote(v, MOBILE_STRONGHOLD, 5)!;
    assert.equal(quote.cost, 1);
    const action = nexusRicheseAction(v, v.nexusRichese!.event, {
      type: 'ship',
      territory: MOBILE_STRONGHOLD,
      sector: hms.sectors[0],
      amount: 5,
      elite: 2,
    })!;
    assert.ok(action);
    const next = nexusRicheseAllow(applyAction(f.g, f.owner, action));
    const me = next.players.find((p) => p.id === f.owner)!;
    assert.equal(me.reserves, 15);
    assert.equal(me.spice, 0);
    assert.equal(me.forces[`${MOBILE_STRONGHOLD}:${hms.sectors[0]}`], 5);
    assert.equal(
      me.elites!.forces[`${MOBILE_STRONGHOLD}:${hms.sectors[0]}`],
      2,
    );
    nexusRicheseInventory(next);
    const outsider = nexusRicheseFixture({
      opponentFaction: 'ixians',
      advanced,
    });
    const other = viewGame(outsider.g, outsider.owner);
    assert.ok(gameTerritories(other).some((t) => t.id === MOBILE_STRONGHOLD));
    assert.equal(nexusRicheseQuote(other, MOBILE_STRONGHOLD, 5), null);
  }
});
