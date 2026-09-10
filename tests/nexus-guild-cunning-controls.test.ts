import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import {
  nexusGuildCunningAction,
  nexusGuildShipmentAvailable,
  nexusGuildMovementAvailable,
  nexusGuildSkipShipmentAction,
} from '../game/nexus-guild-cunning-options';
import { ordinaryCardAvailability } from '../game/card-availability';
import { guildTransportQuote } from '../game/transport-quote';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import {
  nexusGuildCunningFixture,
  originalGuildCunningTurn,
  nexusGuildCunningRequest,
  nexusGuildCunningAllow,
  settleGuildCunningShipment,
  nexusGuildCunningInventory,
  holdGuildCunningCard,
} from './fixture-nexus-guild-cunning';
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
function second(homeworlds = false) {
  const f = nexusGuildCunningFixture({ homeworlds });
  const original = originalGuildCunningTurn(f);
  const g = nexusGuildCunningAllow(
    applyAction(original, f.owner, nexusGuildCunningRequest(f, original)),
  );
  return { f, original, g };
}

void test('Guild declaration controls bind the owned current ending opportunity, leave first-turn history intact and protect observers', () => {
  for (const advanced of [false, true]) {
    const f = nexusGuildCunningFixture({ advanced, karama: true });
    const original = originalGuildCunningTurn(f);
    const v = viewGame(original, f.owner),
      event = v.nexusGuildCunning!.offer!.event;
    const before = structuredClone(v);
    const action = nexusGuildCunningAction(v, event)!;
    assert.deepEqual(action, { type: 'endMovement', nexus: event });
    assert.equal(nexusGuildCunningAction(v, 'stale'), null);
    assert.match(html(v), /Finish ordinary turn and declare Guild Cunning/);
    assert.match(html(v, true), /disabled=""/);
    const pending = applyAction(original, f.owner, action);
    assert.equal(pending.response?.kind, 'nexusGuildCunning');
    const pv = viewGame(pending, f.owner);
    assert.match(
      html(pv),
      /Allow one second Guild shipment at its normal price/,
    );
    assert.doesNotMatch(
      html(pv),
      /&quot;nexusGuildCunning&quot;|\["nexusGuildCunning"/,
    );
    assert.equal(nexusGuildShipmentAvailable(pv), false);
    assert.equal(nexusGuildMovementAvailable(pv), false);
    assert.equal(pv.players.find((p) => p.id === f.owner)!.shipped, true);
    assert.equal(pv.players.find((p) => p.id === f.owner)!.moved, 1);
    for (const id of [f.target, f.observer]) {
      const other = viewGame(original, id);
      assert.equal(other.nexusGuildCunning, null);
      Object.defineProperty(other, 'nexusGuildCunning', {
        get() {
          throw Error('Private Guild grant read');
        },
      });
      assert.equal(nexusGuildCunningAction(other, event), null);
    }
    assert.deepEqual(v, before);
  }
});

void test('second shipment controls and ordinary transport quote reopen only the new shipment despite shipped true', () => {
  const { f, g } = second();
  holdGuildCunningCard(g, f.owner, 'karama');
  const v = viewGame(g, f.owner);
  const before = structuredClone(v);
  assert.equal(v.players.find((p) => p.id === f.owner)!.shipped, true);
  assert.equal(nexusGuildShipmentAvailable(v), true);
  assert.equal(nexusGuildMovementAvailable(v), false);
  const markup = html(v);
  assert.match(markup, /Ship from reserves/);
  assert.match(markup, /Guild rates for/);
  assert.match(markup, /Decline second shipment and finish/);
  assert.match(markup, /This does not reopen ordinary movement/);
  const action = {
    type: 'guildShip',
    from: 'hagga_basin:12',
    territory: 'carthag',
    sector: 11,
    amount: 3,
  };
  const same = { ...action, territory: 'hagga_basin', sector: 12 };
  assert.ok(
    guildTransportQuote(v, same).unavailableReasons.some((reason) =>
      /another territory/.test(reason),
    ),
  );
  const originalState = structuredClone(g);
  assert.throws(
    () => applyAction(g, f.owner, same),
    /another territory|same territory|different destination territory/,
  );
  assert.deepEqual(g, originalState);
  const ordinary = nexusGuildCunningFixture();
  // Conserved ordinary board source before any declaration, not a fabricated grant.
  ordinary.g.players[0].reserves -= 3;
  ordinary.g.players[0].forces['hagga_basin:12'] = 3;
  const ordinaryView = viewGame(ordinary.g, ordinary.owner);
  assert.equal(nexusGuildShipmentAvailable(ordinaryView), true);
  assert.ok(
    guildTransportQuote(ordinaryView, same).unavailableReasons.some((reason) =>
      /another territory/.test(reason),
    ),
  );
  const ordinaryBefore = structuredClone(ordinary.g);
  assert.throws(
    () => applyAction(ordinary.g, ordinary.owner, same),
    /another territory|same territory|different destination territory/,
  );
  assert.deepEqual(ordinary.g, ordinaryBefore);
  const quote = guildTransportQuote(v, action);
  assert.deepEqual(quote.unavailableReasons, []);
  const next = settleGuildCunningShipment(applyAction(g, f.owner, action));
  assert.equal(
    next.players.find((p) => p.id === f.owner)!.forces['carthag:11'],
    3,
  );
  nexusGuildCunningInventory(next);
  const stale = structuredClone(v);
  stale.nexusGuildCunning!.active!.event = 'stale';
  assert.equal(nexusGuildShipmentAvailable(stale), false);
  assert.deepEqual(v, before);
});

void test('both native Homeworld shipment controls consume the second grant with typed source quotes', () => {
  const { f, g } = second(true),
    v = viewGame(g, f.owner);
  assert.equal(nexusGuildShipmentAvailable(v), true);
  const outward = homeworldShipmentChoice(v, 'homeworld:harkonnen', {
    'homeworld:guild': { normal: 2, elite: 0 },
  });
  assert.equal(outward.blocked, null);
  assert.ok(outward.action);
  nexusGuildCunningInventory(
    settleGuildCunningShipment(applyAction(g, f.owner, outward.action)),
  );
  const back = guildHomeworldShipmentChoice(v, 'homeworld:guild', {
    'hagga_basin:12': { normal: 3, elite: 0 },
  });
  assert.equal(back.blocked, null);
  assert.ok(back.action);
  const restored = settleGuildCunningShipment(
    applyAction(g, f.owner, back.action),
  );
  assert.equal(restored.players.find((p) => p.id === f.owner)!.reserves, 18);
  nexusGuildCunningInventory(restored);
  assert.match(html(v), /Ship to another Homeworld/);
});

void test('Hajr availability uses the explicit unused-card permission rather than the derived movement ceiling', () => {
  const f = nexusGuildCunningFixture();
  const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
  const original = originalGuildCunningTurn(f);
  let g = nexusGuildCunningAllow(
    applyAction(original, f.owner, nexusGuildCunningRequest(f, original)),
  );
  g = settleGuildCunningShipment(
    applyAction(g, f.owner, {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 2,
    }),
  );
  const v = viewGame(g, f.owner);
  assert.equal(v.nexusGuildCunning!.active!.stage, 'extraMove');
  assert.equal(ordinaryCardAvailability(v, hajr.id)?.available, true);
  const played = applyAction(g, f.owner, { type: 'card', card: hajr.id });
  const pv = viewGame(played, f.owner);
  assert.equal(nexusGuildMovementAvailable(pv), true);
  assert.equal(pv.nexusGuildCunning!.active!.hajrAvailable, false);
  // Consumer-only alias of a retained physical card tests the explicit flag, without engine evidence claims.
  pv.players.find((p) => p.id === f.owner)!.hand!.push(hajr);
  pv.players.find((p) => p.id === f.owner)!.movesAllowed = 1;
  assert.equal(ordinaryCardAvailability(pv, hajr.id)?.available, false);
  nexusGuildCunningInventory(played);
});

void test('skipping only the second shipment retains a real Hajr choice with no shipment payment or force movement', () => {
  const f = nexusGuildCunningFixture({ spice: 3 });
  const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
  const first = originalGuildCunningTurn(f);
  const g = nexusGuildCunningAllow(
    applyAction(first, f.owner, nexusGuildCunningRequest(f, first)),
  );
  const v = viewGame(g, f.owner),
    event = v.nexusGuildCunning!.active!.event;
  assert.match(html(v), /Skip second shipment/);
  assert.match(html(v), /Decline second shipment and finish/);
  assert.equal(nexusGuildSkipShipmentAction(v, 'stale'), null);
  const before = g.players.find((p) => p.id === f.owner)!;
  const skipped = applyAction(
    g,
    f.owner,
    nexusGuildSkipShipmentAction(v, event)!,
  );
  const sv = viewGame(skipped, f.owner),
    after = skipped.players.find((p) => p.id === f.owner)!;
  assert.equal(sv.nexusGuildCunning!.active!.stage, 'extraMove');
  assert.equal(nexusGuildShipmentAvailable(sv), false);
  assert.equal(nexusGuildMovementAvailable(sv), false);
  assert.equal(ordinaryCardAvailability(sv, hajr.id)?.available, true);
  assert.equal(after.spice, before.spice);
  assert.equal(after.reserves, before.reserves);
  assert.deepEqual(after.forces, before.forces);
  assert.equal(after.shipped, before.shipped);
  assert.equal(nexusGuildSkipShipmentAction(sv, event), null);
  const prepared = applyAction(skipped, f.owner, {
    type: 'card',
    card: hajr.id,
  });
  assert.equal(nexusGuildMovementAvailable(viewGame(prepared, f.owner)), true);
  nexusGuildCunningInventory(prepared);
});
