import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JunctionTransport } from '../components/junction-transport';
import {
  junctionTransportActions,
  junctionTransportChoice,
  junctionTransportOrigins,
} from '../game/junction-transport-options';
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
import { homeworldGameIntegrity } from '../game/homeworld-game';
import type { FactionId } from '../game/catalog';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const actor = (game: Game) => game.players[0];

// Genuine setup and physical hands. Only a new shipment opportunity is staged.
function fixture(faction: FactionId = 'emperor', advanced = true) {
  let game = createGame(
    'JUNCTIONCONTROLS',
    newPlayer('p', 'Recipient', faction),
    advanced,
  );
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game = applyAction(game, 'p', { type: 'homeworlds', enabled: true });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 50; step++) {
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
    assert.ok(next, 'Actual setup has a legal choice.');
    game = next;
  }
  assert.equal(game.status, 'playing');
  for (const player of game.players) {
    game.deck.push(...player.hand.splice(0));
    player.shipped = false;
    player.moved = 0;
  }
  Object.assign(game, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'p',
    order: ['p', 'g', 'a'],
    movementRemaining: ['p', 'g', 'a'],
    ready: [],
    storm: 18,
    spice: {},
  });
  homeworldGameIntegrity(game);
  return game;
}

function offer(game: Game, rate: 'half' | 'full' = 'half') {
  const view = viewGame(game, 'g');
  assert.ok(view.junctionTransport?.canOffer);
  return applyAction(game, 'g', {
    type: 'offerJunctionTransport',
    event: view.junctionTransport.offerEvent,
    rate,
  });
}

void test('Junction controls quote and execute mixed Emperor native sources at both offered rates', () => {
  for (const rate of ['half', 'full'] as const) {
    const game = offer(fixture(), rate);
    const view = viewGame(game, 'p');
    const before = structuredClone(view);
    const sources = {
      'homeworld:emperor': { normal: 3, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 2 },
    };
    assert.ok(
      junctionTransportOrigins(view).some(
        (origin) => origin.id === 'imperial-worlds',
      ),
    );
    const quote = junctionTransportChoice(view, 'carthag:11', sources);
    assert.ok(quote.action, quote.blocked ?? 'quoted action');
    assert.equal(quote.cost, rate === 'half' ? 3 : 5);
    assert.equal(quote.elite, 2);
    assert.deepEqual(view, before);
    const next = applyAction(reload(game), 'p', quote.action);
    homeworldGameIntegrity(next);
    assert.equal(actor(next).forces['carthag:11'], 5);
    assert.equal(actor(next).elites!.forces['carthag:11'], 2);
    assert.equal(actor(next).reserves, actor(game).reserves - 5);
    assert.equal(actor(next).spice, actor(game).spice - quote.cost);
    assert.equal(actor(next).shipped, true);
  }
});

void test('Junction public quotes use actual foreign garrisons and permit their native return', () => {
  let game = fixture();
  game = applyAction(game, 'p', {
    type: 'homeworldShip',
    event: viewGame(game, 'p').homeworldShipment!.event,
    destination: 'homeworld:atreides',
    sources: { 'homeworld:emperor': { normal: 3, elite: 0 } },
  });
  actor(game).shipped = false;
  game = offer(game);
  const sources = { 'homeworld:atreides': { normal: 3, elite: 0 } };
  for (const destination of ['homeworld:emperor', 'carthag:11']) {
    const quote = junctionTransportChoice(
      viewGame(game, 'p'),
      destination,
      sources,
    );
    assert.ok(quote.action, quote.blocked ?? 'foreign source quoted');
    const next = applyAction(reload(game), 'p', quote.action);
    homeworldGameIntegrity(next);
    assert.equal(
      next.homeworlds!.custody!.visitors['homeworld:atreides']?.p,
      undefined,
    );
    assert.equal(
      actor(next).reserves,
      actor(game).reserves + (destination === 'homeworld:emperor' ? 3 : 0),
    );
  }
});

void test('Junction funding quotes preserve own spice and require an actual pledged contribution', () => {
  const game = offer(fixture(), 'full');
  actor(game).ally = 'a';
  game.players[2].ally = 'p';
  const view = viewGame(game, 'p');
  view.players[0].spice = 1;
  view.aid.available = 4;
  const sources = { 'homeworld:emperor': { normal: 3, elite: 0 } };
  assert.equal(
    junctionTransportChoice(view, 'carthag:11', sources).action,
    null,
  );
  assert.equal(
    junctionTransportChoice(view, 'carthag:11', sources, 2).ownPayment,
    1,
  );
  assert.ok(junctionTransportChoice(view, 'carthag:11', sources, 2).action);
  for (const amount of [-1, 1.5, 4, NaN])
    assert.equal(
      junctionTransportChoice(view, 'carthag:11', sources, amount).action,
      null,
    );
  assert.equal(
    junctionTransportChoice(view, 'homeworld:atreides', sources, 2).action,
    null,
  );
});

void test('Junction quotes share storm, stronghold capacity, BG stance and locked-advisor legality', () => {
  const game = offer(fixture('beneGesserit'));
  const bg = actor(game);
  // Conserve physical counters while staging an existing locked advisor army.
  bg.forces = { 'wind_pass:14': 3 };
  bg.reserves = 17;
  bg.advisors = { wind_pass: { lockedTurn: game.turn } };
  game.players[2].forces['wind_pass:14'] = 1;
  game.players[2].reserves--;
  homeworldGameIntegrity(game);
  let view = viewGame(game, 'p');
  const sources = { 'wind_pass:14': { normal: 2, elite: 0 } };
  assert.match(
    junctionTransportChoice(view, 'homeworld:beneGesserit', sources).blocked!,
    /advisors/,
  );
  const carried = junctionTransportChoice(view, 'arrakeen:10', sources);
  assert.ok(carried.action, carried.blocked ?? 'advisors retain stance');
  assert.equal(carried.advisors, true);
  const next = applyAction(reload(game), 'p', carried.action);
  assert.equal(actor(next).advisors?.arrakeen?.lockedTurn, game.turn);
  view = viewGame(game, 'p');
  view.storm = 14;
  assert.match(
    junctionTransportChoice(view, 'arrakeen:10', sources).blocked!,
    /storm/,
  );
  view.storm = 10;
  assert.match(
    junctionTransportChoice(view, 'arrakeen:10', sources).blocked!,
    /storm/,
  );
  view.storm = 18;
  view.players[0].advisors = {};
  view.players[1].forces['arrakeen:10'] = 1;
  assert.match(
    junctionTransportChoice(view, 'arrakeen:10', sources).blocked!,
    /three/,
  );
});

void test('Junction sponsor AI offers once and all four recipient policies execute through the engine', () => {
  for (let level = 0; level < 4; level++) {
    const initial = fixture();
    const sponsorView = viewGame(initial, 'g');
    sponsorView.players.find((p) => p.id === 'g')!.bot = (
      ['Easy', 'Medium', 'Hard', 'Brutal'] as const
    )[level];
    const offers = botActions(sponsorView).filter(
      (action) => action.type === 'offerJunctionTransport',
    );
    assert.equal(offers.length, 1);
    const game = applyAction(initial, 'g', offers[0]);
    assert.deepEqual(junctionTransportActions(viewGame(game, 'g'), level), []);
    const recipientView = viewGame(game, 'p');
    recipientView.players[0].bot = (
      ['Easy', 'Medium', 'Hard', 'Brutal'] as const
    )[level];
    const candidates = botActions(recipientView).filter(
      (action) => action.type === 'junctionShip',
    );
    assert.ok(
      candidates.length,
      `level ${level} considers legal useful transport`,
    );
    for (const action of candidates.slice(0, 8)) {
      const next = applyAction(reload(game), 'p', action);
      homeworldGameIntegrity(next);
      assert.equal(actor(next).shipped, true);
      assert.ok(actor(next).reserves >= 3);
      assert.ok(actor(next).spice >= [1, 2, 3, 3][level]);
    }
  }
});

void test('Junction policies retain collectors using actual sector spice and omit storm-covered source counters', () => {
  const game = offer(fixture());
  const p = actor(game);
  p.reserves -= 5;
  p.forces['wind_pass:14'] = 2;
  p.forces['wind_pass:15'] = 3;
  homeworldGameIntegrity(game);
  game.spice = { 'wind_pass:14': 4, 'wind_pass:15': 6 };
  for (let level = 0; level < 4; level++) {
    const protectedActions = junctionTransportActions(
      viewGame(game, 'p'),
      level,
    );
    assert.ok(protectedActions.length);
    assert.ok(
      protectedActions.every((action) =>
        Object.keys(action.sources as object).every(
          (key) => !key.startsWith('wind_pass:'),
        ),
      ),
    );
  }
  game.spice = {};
  game.storm = 14;
  for (let level = 0; level < 4; level++) {
    const actions = junctionTransportActions(viewGame(game, 'p'), level);
    const fromWindPass = actions.filter((action) =>
      Object.hasOwn(action.sources as object, 'wind_pass:15'),
    );
    assert.ok(
      fromWindPass.length,
      `level ${level} can reuse exposed desert counters`,
    );
    assert.ok(
      actions.every(
        (action) => !Object.hasOwn(action.sources as object, 'wind_pass:14'),
      ),
    );
  }
});

void test('Junction controls and all profiles read no rival private resources or concealed identities', () => {
  const view = viewGame(offer(fixture()), 'p');
  const sources = { 'homeworld:emperor': { normal: 2, elite: 0 } };
  const expected = junctionTransportChoice(view, 'carthag:11', sources);
  const expectedActions = [0, 1, 2, 3].map((level) =>
    junctionTransportActions(view, level),
  );
  for (const rival of view.players.filter((p) => p.id !== view.me)) {
    for (const key of ['spice', 'hand', 'traitors', 'faceDancers'])
      Object.defineProperty(rival, key, {
        get() {
          throw new Error('Private opponent data read');
        },
      });
    if (rival.noField?.deployed)
      for (const key of ['value', 'tokenId', 'forces'])
        Object.defineProperty(rival.noField.deployed, key, {
          get() {
            throw new Error('Concealed identity read');
          },
        });
  }
  for (const key of ['deck', 'rng', 'plans'])
    Object.defineProperty(view, key, {
      get() {
        throw new Error('Private game data read');
      },
    });
  assert.deepEqual(
    junctionTransportChoice(view, 'carthag:11', sources),
    expected,
  );
  for (let level = 0; level < 4; level++)
    assert.deepEqual(
      junctionTransportActions(view, level),
      expectedActions[level],
    );
});

void test('Junction controls distinguish optional sponsor offers and label typed recipient choices', () => {
  const initial = fixture();
  const render = (game: Game, id: string) =>
    renderToStaticMarkup(
      createElement(JunctionTransport, {
        game: viewGame(game, id),
        act: () => {},
        busy: false,
      }),
    );
  const sponsor = render(initial, 'g');
  assert.match(sponsor, /Offer half price/);
  assert.match(sponsor, /Offer full price/);
  assert.match(render(initial, 'p'), /ordinary actions remain available/);
  const recipient = render(offer(initial), 'p');
  assert.match(recipient, /aria-label="Junction transport source"/);
  assert.match(
    recipient,
    /aria-label="Normal forces from Kaitain for Junction transport"/,
  );
  assert.match(recipient, /Kaitain and Salusa Secundus/);
  assert.match(recipient, /aria-label="Junction transport destination"/);
  assert.match(
    recipient,
    /<button[^>]*disabled[^>]*>Use Junction transport<\/button>/,
  );
  assert.doesNotMatch(recipient, /undefined|NaN|Kaitain sector/);
});

void test('Junction recipient quotes respect current offers, usage and binding native shipment answers', () => {
  const game = offer(fixture());
  const view = viewGame(game, 'p');
  const sources = { 'homeworld:emperor': { normal: 3, elite: 0 } };
  view.shipmentPromises = [
    {
      turn: game.turn,
      player: 'p',
      asker: 'a',
      territory: 'carthag',
      minimum: 3,
      answer: true,
    },
  ];
  assert.ok(junctionTransportChoice(view, 'carthag:11', sources).action);
  assert.match(
    junctionTransportChoice(view, 'arrakeen:10', sources).blocked!,
    /binding/,
  );
  assert.match(
    junctionTransportChoice(view, 'homeworld:atreides', sources).blocked!,
    /binding/,
  );
  view.shipmentPromises = [];
  view.junctionTransport!.offer!.turn--;
  assert.equal(
    junctionTransportChoice(view, 'carthag:11', sources).action,
    null,
  );
  view.junctionTransport!.offer!.turn++;
  view.players[0].shipped = true;
  assert.equal(
    junctionTransportChoice(view, 'carthag:11', sources).action,
    null,
  );
  for (let level = 0; level < 4; level++)
    assert.deepEqual(junctionTransportActions(view, level), []);
});
