import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GuildHomeworldShipment } from '../components/guild-homeworld-shipment';
import {
  guildHomeworldShipmentChoice,
  guildHomeworldShipmentActions,
} from '../game/guild-homeworld-shipment-options';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';

function fixture() {
  let game = createGame(
    'GUILDWORLDCONTROLS',
    newPlayer('g', 'Guild', 'guild'),
    false,
  );
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  game = applyAction(game, 'g', { type: 'homeworlds', enabled: true });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 40; step++) {
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(game, player.id, action);
        break;
      }
    }
    assert.ok(next);
    game = next;
  }
  assert.equal(game.status, 'playing');
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  Object.assign(game, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'g',
    order: ['g', 'a', 'h'],
    movementRemaining: ['g', 'a', 'h'],
    ready: [],
    storm: 18,
    spice: {},
  });
  const guild = game.players[0];
  guild.reserves = 3;
  guild.forces = { 'wind_pass:14': 3, 'wind_pass:15': 7, 'tueks_sietch:5': 7 };
  guild.spice = 12;
  for (const player of game.players) {
    player.shipped = false;
    player.moved = 0;
  }
  homeworldGameIntegrity(game);
  return { game, view: viewGame(game, 'g') };
}

void test('Guild Arrakis controls quote combined actual sectors, own return and exact selected allied funding', () => {
  const { view } = fixture();
  const before = structuredClone(view);
  const sources = {
    'wind_pass:14': { normal: 2, elite: 0 },
    'wind_pass:15': { normal: 3, elite: 0 },
  };
  const quoted = guildHomeworldShipmentChoice(view, 'homeworld:guild', sources);
  assert.ok(quoted.action);
  assert.equal(quoted.cost, 3);
  assert.equal(quoted.amount, 5);
  assert.deepEqual(quoted.action.sources, sources);
  assert.deepEqual(view, before);
  view.players[0].ally = 'h';
  view.players[2].ally = 'g';
  view.players[0].spice = 1;
  view.aid.available = 3;
  assert.equal(
    guildHomeworldShipmentChoice(view, 'homeworld:guild', sources).action,
    null,
  );
  const funded = guildHomeworldShipmentChoice(
    view,
    'homeworld:guild',
    sources,
    2,
  );
  assert.ok(funded.action);
  assert.equal(funded.ownPayment, 1);
  for (const amount of [-1, 0.5, 4, NaN])
    assert.equal(
      guildHomeworldShipmentChoice(view, 'homeworld:guild', sources, amount)
        .action,
      null,
    );
  assert.equal(
    guildHomeworldShipmentChoice(view, 'homeworld:harkonnen', sources, 2)
      .action,
    null,
  );
});

void test('Guild Arrakis controls reject mixed territories, storm, excess, special counters and inactive timing', () => {
  const { view } = fixture();
  const good = { 'wind_pass:14': { normal: 2, elite: 0 } };
  for (const sources of [
    {},
    { 'wind_pass:14': { normal: 4, elite: 0 } },
    { 'wind_pass:14': { normal: 1, elite: 1 } },
    { ...good, 'tueks_sietch:5': { normal: 1, elite: 0 } },
    { 'homeworld:guild': { normal: 1, elite: 0 } },
  ] as HomeworldShipmentSources[])
    assert.equal(
      guildHomeworldShipmentChoice(view, 'homeworld:guild', sources).action,
      null,
    );
  view.storm = 14;
  assert.equal(
    guildHomeworldShipmentChoice(view, 'homeworld:guild', good).action,
    null,
  );
  view.storm = 18;
  view.guildHomeworldShipment!.blocked = 'Finish the current response.';
  assert.equal(
    guildHomeworldShipmentChoice(view, 'homeworld:guild', good).blocked,
    'Finish the current response.',
  );
  for (let level = 0; level < 4; level++)
    assert.deepEqual(guildHomeworldShipmentActions(view, level), []);
  view.guildHomeworldShipment!.blocked = null;
  for (const patch of [
    { phase: 6 },
    { active: 'a' },
    { status: 'setup' as const },
    { guildHomeworldShipment: null },
  ])
    assert.equal(
      guildHomeworldShipmentChoice(
        { ...view, ...patch },
        'homeworld:guild',
        good,
      ).action,
      null,
    );
});

void test('all four Guild policies submit real legal returns, retain stronghold defense and preserve saved physical custody', () => {
  const { game, view } = fixture();
  for (const [level, name] of ['Easy', 'Medium', 'Hard', 'Brutal'].entries()) {
    view.players[0].bot = name as 'Easy';
    const actions = guildHomeworldShipmentActions(view, level);
    assert.ok(actions.length, name);
    const whole = botActions(view);
    assert.ok(
      whole.some((action) => action.type === 'guildHomeworldShip'),
      name,
    );
    for (const action of actions) {
      const after = applyAction(JSON.parse(JSON.stringify(game)), 'g', action);
      assert.equal(after.players[0].shipped, true);
      homeworldGameIntegrity(after);
      assert.equal(
        after.players[0].reserves +
          Object.values(after.players[0].forces).reduce((sum, n) => sum + n, 0),
        20,
      );
      assert.ok((after.players[0].forces['tueks_sietch:5'] ?? 0) >= 2);
      assert.equal(
        viewGame(JSON.parse(JSON.stringify(after)), 'g').players[0].reserves,
        after.players[0].reserves,
      );
    }
  }
});

void test('Guild public transport options and policies never inspect rival private fields or concealed force maps', () => {
  const { view } = fixture();
  const sources = { 'wind_pass:14': { normal: 2, elite: 0 } };
  const expected = guildHomeworldShipmentChoice(
    view,
    'homeworld:guild',
    sources,
  );
  const actions = guildHomeworldShipmentActions(view, 3);
  for (const rival of view.players.slice(1))
    for (const key of ['spice', 'hand', 'traitors', 'forces'])
      Object.defineProperty(rival, key, {
        get() {
          throw new Error('Private rival field read');
        },
      });
  for (const key of ['deck', 'rng', 'plans'])
    Object.defineProperty(view, key, {
      get() {
        throw new Error('Private game field read');
      },
    });
  assert.deepEqual(
    guildHomeworldShipmentChoice(view, 'homeworld:guild', sources),
    expected,
  );
  assert.deepEqual(guildHomeworldShipmentActions(view, 3), actions);
});

void test('Guild controls expose keyboard labelled source sectors and a sectorless Homeworld destination', () => {
  const { view } = fixture();
  const html = renderToStaticMarkup(
    createElement(GuildHomeworldShipment, {
      game: view,
      act: () => {},
      busy: false,
    }),
  );
  assert.match(html, /aria-label="Arrakis source territory"/);
  assert.match(html, /aria-label="Guild forces from Wind Pass sector 14"/);
  assert.match(html, /aria-label="Guild forces from Wind Pass sector 15"/);
  assert.match(html, /Junction · return to your Homeworld/);
  assert.match(html, /one spice per two forces, rounded up/);
  assert.match(
    html,
    /<button[^>]*disabled[^>]*>Transport to Junction<\/button>/,
  );
  assert.doesNotMatch(html, /Junction sector|undefined|NaN/);
});

void test('all four Guild policies reinforce a foreign invasion through authoritative Arrakis transport', () => {
  const { game } = fixture();
  const atreides = game.players[1];
  const withdrawn = atreides.reserves - 3;
  atreides.reserves = 3;
  atreides.forces['arrakeen:10'] =
    (atreides.forces['arrakeen:10'] ?? 0) + withdrawn;
  game.players[0].reserves -= 2;
  game.homeworlds!.custody!.visitors['homeworld:atreides'] = {
    g: { normal: 2, elite: 0 },
  };
  homeworldGameIntegrity(game);
  for (let level = 0; level < 4; level++) {
    const view = viewGame(game, 'g');
    const invasion = guildHomeworldShipmentActions(view, level).find(
      (action) => action.destination === 'homeworld:atreides',
    );
    assert.ok(invasion, `level ${level} reinforces an attainable invasion`);
    const after = applyAction(JSON.parse(JSON.stringify(game)), 'g', invasion);
    homeworldGameIntegrity(after);
    assert.ok(
      after.homeworlds!.custody!.visitors['homeworld:atreides'].g.normal > 2,
    );
    assert.equal(after.players[0].reserves, 1);
    assert.equal(after.players[0].shipped, true);
  }
});

void test('Guild transport policies retain spice collectors and omit storm-trapped origin pools', () => {
  const { view } = fixture();
  view.spice.wind_pass = 20;
  for (let level = 0; level < 4; level++) {
    const actions = guildHomeworldShipmentActions(view, level);
    assert.ok(actions.length);
    assert.ok(
      actions.every((action) =>
        Object.keys(action.sources as object).every(
          (key) => !key.startsWith('wind_pass:'),
        ),
      ),
    );
  }
  view.spice.wind_pass = 0;
  view.storm = 14;
  for (let level = 0; level < 4; level++) {
    const actions = guildHomeworldShipmentActions(view, level);
    assert.ok(actions.length);
    assert.ok(
      actions.every(
        (action) => !Object.hasOwn(action.sources as object, 'wind_pass:14'),
      ),
    );
  }
});
