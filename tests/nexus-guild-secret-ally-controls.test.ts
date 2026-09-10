import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { MOBILE_STRONGHOLD, gameTerritories } from '../game/board';
import { HomeworldShipment } from '../components/homeworld-shipment';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { guildTransportQuote } from '../game/transport-quote';
import { withNativeShipmentSources } from '../game/homeworld-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import {
  nexusGuildSecretAllyAction,
  nexusGuildSecretAllyCanAct,
  nexusGuildSecretAllyQuote,
} from '../game/nexus-guild-secret-ally-options';
import {
  nexusGuildSecretAllyFixture,
  nexusGuildSecretAllyInventory,
  nexusGuildSecretAllyReload,
} from './fixture-nexus-guild-secret-ally';
import { nexusAllow } from './fixture-nexus-cards';
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

void test('Basic and Advanced private shipment panel defaults to ordinary price; explicit Guild source spends once without another action', () => {
  for (const advanced of [false, true]) {
    const f = nexusGuildSecretAllyFixture({ advanced, spice: 3 });
    const v = viewGame(f.g, f.owner),
      before = structuredClone(v);
    const checkbox = html(v).match(
      /<input[^>]*type="checkbox"[^>]*>[\s\S]{0,150}Use Guild Nexus Secret Ally/,
    )?.[0];
    assert.ok(checkbox);
    assert.doesNotMatch(checkbox, /checked=""/);
    assert.match(
      html(v, true).match(
        /<input[^>]*type="checkbox"[^>]*>[\s\S]{0,150}Use Guild Nexus Secret Ally/,
      )![0],
      /disabled=""/,
    );
    assert.match(html(v), /normal movement remains available/);
    assert.equal(nexusGuildSecretAllyQuote(v, 'arrakeen', 5)!.cost, 3);
    assert.equal(nexusGuildSecretAllyQuote(v, 'arrakeen', 4)!.cost, 2);
    const action = nexusGuildSecretAllyAction(
      v,
      v.nexusGuildSecretAlly!.event,
      { type: 'ship', territory: 'arrakeen', sector: 10, amount: 5 },
    )!;
    assert.ok(action);
    const next = nexusAllow(applyAction(f.g, f.owner, action));
    const me = next.players.find((p) => p.id === f.owner)!;
    assert.equal(me.spice, 0);
    assert.equal(me.reserves, 15);
    assert.equal(me.shipped, true);
    assert.equal(me.moved, 0);
    assert.equal(viewGame(next, f.owner).nexusCards!.card, null);
    assert.equal(
      nexusGuildSecretAllyAction(
        viewGame(next, f.owner),
        String(action.nexus),
        action,
      ),
      null,
    );
    nexusGuildSecretAllyInventory(next);
    assert.deepEqual(v, before);
  }
});

void test('Fremen free native reinforcement remains distinct from explicit paid beyond-range shipping and its storm exclusion', () => {
  const f = nexusGuildSecretAllyFixture({
    ownerFaction: 'fremen',
    advanced: true,
  });
  const v = viewGame(f.g, f.owner),
    event = v.nexusGuildSecretAlly!.event;
  assert.match(html(v), /Leave this unchecked for free Fremen reinforcement/);
  const free = nexusAllow(
    applyAction(nexusGuildSecretAllyReload(f.g), f.owner, {
      type: 'ship',
      territory: 'the_great_flat',
      sector: 15,
      amount: 5,
    }),
  );
  assert.equal(free.players[0].spice, 20);
  assert.equal(viewGame(free, f.owner).nexusCards!.card, 'guild');
  const paid = nexusGuildSecretAllyAction(v, event, {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
  })!;
  const next = nexusAllow(applyAction(f.g, f.owner, paid));
  assert.equal(next.players[0].spice, 17);
  assert.equal(next.players[0].forces['arrakeen:10'], 5);
  const storm = nexusGuildSecretAllyReload(f.g);
  storm.storm = 10;
  const before = structuredClone(storm);
  assert.throws(() => applyAction(storm, f.owner, paid), /storm/i);
  assert.deepEqual(storm, before);
  nexusGuildSecretAllyInventory(free);
  nexusGuildSecretAllyInventory(next);
});

void test('borrowed cross and return quotes preserve typed physical groups; no native Guild identity or extra shipment is created', () => {
  for (const destination of ['carthag', 'reserves']) {
    const f = nexusGuildSecretAllyFixture({
      ownerFaction: 'emperor',
      advanced: true,
    });
    // Conserved pre-declaration Arrakis staging; all typed counters retain their real faction.
    const p = f.g.players[0];
    p.reserves -= 5;
    p.forces['hagga_basin:12'] = 5;
    p.elites!.reserves -= 2;
    p.elites!.forces['hagga_basin:12'] = 2;
    const v = viewGame(f.g, f.owner),
      action = nexusGuildSecretAllyAction(v, v.nexusGuildSecretAlly!.event, {
        type: 'guildShip',
        from: 'hagga_basin:12',
        territory: destination,
        sector: destination === 'reserves' ? 0 : 11,
        amount: 5,
        elite: 2,
      })!;
    assert.ok(action);
    const quote = guildTransportQuote(v, action);
    assert.deepEqual(quote.unavailableReasons, []);
    assert.equal(quote.quote!.cost, 3);
    const next = nexusAllow(applyAction(f.g, f.owner, action)),
      me = next.players[0];
    assert.equal(me.faction, 'emperor');
    assert.equal(me.spice, 17);
    assert.equal(me.shipped, true);
    assert.equal(me.moved, 0);
    assert.equal(me.reserves, destination === 'reserves' ? 20 : 15);
    assert.equal(me.elites!.reserves, destination === 'reserves' ? 5 : 3);
    assert.match(
      guildTransportQuote(v, {
        ...action,
        nexus: 'stale',
      }).unavailableReasons.join(' '),
      /current Guild/,
    );
    assert.match(
      guildTransportQuote(v, {
        ...action,
        territory: 'hagga_basin',
        sector: 12,
      }).unavailableReasons.join(' '),
      /another territory/,
    );
    nexusGuildSecretAllyInventory(next);
  }
});

void test('Homeworld selection discounts independently legal typed custody; own world and Arrakis return remain unavailable', () => {
  const f = nexusGuildSecretAllyFixture({
    ownerFaction: 'emperor',
    advanced: true,
    homeworlds: true,
    spice: 3,
  });
  const v = viewGame(f.g, f.owner),
    worlds = v.homeworlds!.worlds!;
  const native = worlds.filter((w) => w.native === f.owner),
    target = worlds.find((w) => w.native === f.target)!;
  const selection = Object.fromEntries(
    native.map((w) => [
      w.id,
      w.secondary ? { normal: 0, elite: 2 } : { normal: 3, elite: 0 },
    ]),
  );
  const plain = homeworldShipmentChoice(v, target.id, selection);
  assert.equal(plain.cost, 5);
  assert.equal(plain.action, null);
  const discounted = homeworldShipmentChoice(
    v,
    target.id,
    selection,
    0,
    v.nexusGuildSecretAlly!.event,
  );
  assert.equal(discounted.cost, 3);
  assert.equal(discounted.amount, 5);
  assert.equal(discounted.elite, 2);
  assert.ok(discounted.action);
  assert.match(
    renderToStaticMarkup(
      createElement(HomeworldShipment, { game: v, act() {}, busy: false }),
    ),
    /Use Guild Nexus Secret Ally for Homeworld shipment/,
  );
  const next = nexusAllow(applyAction(f.g, f.owner, discounted.action));
  assert.equal(next.players[0].spice, 0);
  assert.equal(next.players[0].reserves, 15);
  homeworldGameIntegrity(next);
  assert.equal(
    homeworldShipmentChoice(
      v,
      native[0].id,
      selection,
      0,
      v.nexusGuildSecretAlly!.event,
    ).action,
    null,
  );
  assert.equal(nexusGuildSecretAllyQuote(v, 'reserves', 5), null);
  assert.equal(
    nexusGuildSecretAllyAction(v, v.nexusGuildSecretAlly!.event, {
      type: 'guildHomeworldShip',
      amount: 5,
    }),
    null,
  );
  const reserve = withNativeShipmentSources(
    v,
    nexusGuildSecretAllyAction(v, v.nexusGuildSecretAlly!.event, {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 5,
      elite: 2,
    })!,
  )!;
  assert.ok(reserve.homeworldSources);
  nexusGuildSecretAllyInventory(nexusAllow(applyAction(f.g, f.owner, reserve)));
});

void test('current source fences reject stale, foreign, interrupted and concealed routes without inspecting another private hand', () => {
  const f = nexusGuildSecretAllyFixture(),
    v = viewGame(f.g, f.owner),
    event = v.nexusGuildSecretAlly!.event;
  assert.equal(nexusGuildSecretAllyCanAct(v), true);
  assert.equal(
    nexusGuildSecretAllyAction(v, event, {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 1,
      noField: 'hidden',
    }),
    null,
  );
  assert.equal(
    nexusGuildSecretAllyAction(v, event, {
      type: 'guildShip',
      from: 'reserves',
      territory: 'arrakeen',
      sector: 10,
      amount: 1,
    }),
    null,
  );
  assert.equal(
    nexusGuildSecretAllyAction(v, 'stale', {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 1,
    }),
    null,
  );
  for (const id of [f.target, f.observer]) {
    const other = viewGame(f.g, id);
    assert.equal(other.nexusGuildSecretAlly, null);
    Object.defineProperty(
      other.players.find((p) => p.id === f.owner)!,
      'hand',
      {
        get() {
          throw new Error('other hand read');
        },
      },
    );
    assert.equal(nexusGuildSecretAllyCanAct(other), false);
    assert.doesNotMatch(html(other), /Use Guild Nexus Secret Ally/);
  }
  v.nexusGuildSecretAlly!.blocked = 'Finish response';
  assert.equal(nexusGuildSecretAllyCanAct(v), false);
});

void test('native Ixian HMS reserve access uses the current board while another holder gains no mobile-stronghold permission', () => {
  const f = nexusGuildSecretAllyFixture({
      ownerFaction: 'ixians',
      advanced: true,
    }),
    v = viewGame(f.g, f.owner);
  const hms = gameTerritories(v).find((t) => t.id === MOBILE_STRONGHOLD)!;
  const action = nexusGuildSecretAllyAction(v, v.nexusGuildSecretAlly!.event, {
    type: 'ship',
    territory: hms.id,
    sector: hms.sectors[0],
    amount: 5,
    elite: 2,
  })!;
  assert.ok(action);
  nexusGuildSecretAllyInventory(nexusAllow(applyAction(f.g, f.owner, action)));
  const other = nexusGuildSecretAllyFixture(),
    ov = viewGame(other.g, other.owner);
  assert.equal(nexusGuildSecretAllyQuote(ov, MOBILE_STRONGHOLD, 1), null);
});
