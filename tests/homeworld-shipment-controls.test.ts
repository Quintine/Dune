import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { HomeworldShipment } from '../components/homeworld-shipment';
import {
  homeworldShipmentChoice,
  homeworldShipmentActions,
} from '../game/homeworld-shipment-options';
import {
  homeworldForceGroups,
  type HomeworldCustody,
} from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { quoteHomeworldShipment } from '../game/homeworld-shipment';

// Narrow public-view fixtures verify presentation and the shared option quote.
// Runtime dispatcher, timing and conservation are covered by engine tests.
function fixture() {
  const context = {
    advanced: true,
    players: [
      {
        id: 'e',
        faction: 'emperor' as const,
        reserves: 12,
        eliteReserves: 3,
        ally: null as string | null,
      },
      {
        id: 'a',
        faction: 'atreides' as const,
        reserves: 1,
        eliteReserves: 0,
        ally: null as string | null,
      },
      {
        id: 'g',
        faction: 'guild' as const,
        reserves: 10,
        eliteReserves: 0,
        ally: null as string | null,
      },
    ],
  };
  const custody: HomeworldCustody = {
    salusa: { normal: 0, elite: 2 },
    visitors: { 'homeworld:guild': { e: { normal: 4, elite: 1 } } },
  };
  const populations = homeworldPopulations(context, custody);
  const view = {
    me: 'e',
    active: 'e',
    advanced: true,
    status: 'playing',
    phase: 5,
    homeworldShipment: { event: 'shipment:1:e', blocked: null },
    aid: { available: 0, pledged: 0 },
    players: context.players.map((player) => ({
      ...player,
      name: player.faction,
      spice: player.id === 'e' ? 12 : undefined,
      shipped: false,
      elites: { reserves: player.eliteReserves },
    })),
    homeworlds: {
      worlds: homeworldForceGroups(context, custody).map((world) => ({
        ...world,
        ...populations.find((population) => population.location === world.id)!,
      })),
    },
  } as unknown as GameView;
  return { context, custody, view };
}

void test('Homeworld public shipment quote preserves exact native and foreign source pools and Emperor combination', () => {
  const { view, context, custody } = fixture();
  const before = structuredClone(view);
  for (const sources of [
    { 'homeworld:emperor': { normal: 2, elite: 1 } },
    { 'homeworld:guild': { normal: 2, elite: 1 } },
    {
      'homeworld:emperor': { normal: 2, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 2 },
    },
  ] as Record<string, { normal: number; elite: number }>[]) {
    const selected = homeworldShipmentChoice(
      view,
      'homeworld:atreides',
      sources,
    );
    const authoritative = quoteHomeworldShipment(context, custody, {
      player: 'e',
      destination: 'homeworld:atreides',
      sources,
    });
    assert.ok(selected.action);
    assert.equal(selected.cost, authoritative.cost);
    assert.equal(selected.elite, authoritative.elite);
    assert.equal(selected.action.event, 'shipment:1:e');
    assert.deepEqual(selected.action.sources, sources);
    assert.equal(selected.ownPayment, selected.cost);
  }
  assert.deepEqual(view, before);
});

void test('public shipment options reject own, allied, depleted, mixed foreign, stale and unfunded orders', () => {
  const { view } = fixture();
  const good = { 'homeworld:emperor': { normal: 2, elite: 0 } };
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:emperor:salusa', good).action,
    null,
  );
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', {
      'homeworld:guild': { normal: 5, elite: 0 },
    }).action,
    null,
  );
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', {
      ...good,
      'homeworld:guild': { normal: 1, elite: 0 },
    }).action,
    null,
  );
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', {}, 0).action,
    null,
  );
  view.players[0].ally = 'a';
  view.players[1].ally = 'e';
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', good).action,
    null,
  );
  view.players[0].ally = 'g';
  view.players[1].ally = null;
  view.players[2].ally = 'e';
  view.players[0].spice = 1;
  view.aid.available = 2;
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', good).action,
    null,
  );
  assert.ok(
    homeworldShipmentChoice(view, 'homeworld:atreides', good, 1).action,
  );
  for (const pledge of [-1, 0.5, 3, NaN])
    assert.equal(
      homeworldShipmentChoice(view, 'homeworld:atreides', good, pledge).action,
      null,
    );
  view.homeworldShipment!.blocked = 'Resolve the current response.';
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', good, 1).blocked,
    'Resolve the current response.',
  );
  view.homeworldShipment!.blocked = null;
  for (const patch of [
    { active: 'a' },
    { phase: 6 },
    { homeworldShipment: null },
    { status: 'setup' },
  ])
    assert.equal(
      homeworldShipmentChoice(
        { ...view, ...patch } as GameView,
        'homeworld:atreides',
        good,
        1,
      ).action,
      null,
    );
  view.players[0].shipped = true;
  assert.equal(
    homeworldShipmentChoice(view, 'homeworld:atreides', good, 1).action,
    null,
  );
});

void test('Guild rate belongs to its own Homeworld shipment and allies contribute only the selected pledge', () => {
  const { view } = fixture();
  view.players[0].ally = 'g';
  view.players[2].ally = 'e';
  view.aid.available = 3;
  const sources = { 'homeworld:emperor': { normal: 3, elite: 0 } };
  const normal = homeworldShipmentChoice(
    view,
    'homeworld:atreides',
    sources,
    2,
  );
  assert.equal(normal.cost, 3);
  assert.equal(normal.ownPayment, 1);
  view.me = 'g';
  view.active = 'g';
  view.players[2].spice = 10;
  const guild = homeworldShipmentChoice(view, 'homeworld:atreides', {
    'homeworld:guild': { normal: 3, elite: 0 },
  });
  assert.equal(guild.cost, 2);
  assert.ok(guild.action);
});

void test('all four public invasion policies select legal affordable candidates and retain a native defense', () => {
  const { view } = fixture();
  const before = structuredClone(view);
  const signatures: string[] = [];
  for (let level = 0; level < 4; level++) {
    const actions = homeworldShipmentActions(view, level);
    assert.ok(actions.length, `level ${level} has an invasion`);
    signatures.push(JSON.stringify(actions));
    for (const action of actions) {
      const sources = action.sources as Record<
        string,
        { normal: number; elite: number }
      >;
      const selected = homeworldShipmentChoice(
        view,
        String(action.destination),
        sources,
        Number(action.allyPayment),
      );
      assert.deepEqual(selected.action, action);
      for (const [id, forces] of Object.entries(sources)) {
        const world = view.homeworlds!.worlds!.find(
          (candidate) => candidate.id === id,
        )!;
        if (world.native === view.me)
          assert.ok(
            world.forces[view.me].normal +
              world.forces[view.me].elite -
              forces.normal -
              forces.elite >=
              3,
          );
      }
    }
  }
  assert.ok(new Set(signatures).size >= 3);
  assert.deepEqual(view, before);
  view.homeworldShipment!.blocked = 'Paused';
  for (let level = 0; level < 4; level++)
    assert.deepEqual(homeworldShipmentActions(view, level), []);
});

void test('shipment quoting and invasion policies never read private rival resources or randomness', () => {
  const { view } = fixture();
  const sources = { 'homeworld:emperor': { normal: 3, elite: 0 } };
  const expected = homeworldShipmentChoice(view, 'homeworld:atreides', sources);
  const actions = homeworldShipmentActions(view, 3);
  for (const object of [view, ...view.players])
    for (const key of ['hand', 'deck', 'rng', 'traitors', 'plans'])
      Object.defineProperty(object, key, {
        get() {
          throw new Error('Private field read');
        },
      });
  for (const player of view.players.filter(
    (candidate) => candidate.id !== view.me,
  ))
    Object.defineProperty(player, 'spice', {
      get() {
        throw new Error('Rival spice read');
      },
    });
  const random = Math.random;
  Math.random = () => {
    throw new Error('Random state read');
  };
  try {
    assert.deepEqual(
      homeworldShipmentChoice(view, 'homeworld:atreides', sources),
      expected,
    );
    assert.deepEqual(homeworldShipmentActions(view, 3), actions);
  } finally {
    Math.random = random;
  }
});

void test('Homeworld shipment controls show typed real-world origins, prices and pledges without board sectors', () => {
  const { view } = fixture();
  view.players[0].ally = 'g';
  view.players[2].ally = 'e';
  view.aid.available = 3;
  const before = structuredClone(view);
  const html = renderToStaticMarkup(
    createElement(HomeworldShipment, {
      game: view,
      act: () => {},
      busy: false,
    }),
  );
  assert.match(html, /Kaitain · native reserves/);
  assert.match(html, /Junction · foreign garrison/);
  assert.match(html, /Kaitain \+ Salusa Secundus · combined native shipment/);
  assert.match(html, /Sardaukar from Kaitain/);
  assert.match(html, /Pay one spice per force/);
  assert.match(html, /Allied spice contribution · 3 pledged/);
  assert.match(html, /you[r]? available spice: 12/i);
  assert.match(html, /<button[^>]*disabled[^>]*>Ship to Caladan<\/button>/);
  assert.doesNotMatch(html, /[Ss]ector|undefined|NaN/);
  assert.deepEqual(view, before);
});

void test('Advanced Emperor invasion policy can combine native origins while retaining Kaitain defense and Salusa high population', () => {
  const { view } = fixture();
  const emperor = view.players[0];
  emperor.reserves = 9;
  emperor.elites!.reserves = 5;
  view.homeworlds!.worlds!.find(
    (world) => world.id === 'homeworld:emperor',
  )!.forces.e = { normal: 4, elite: 0 };
  view.homeworlds!.worlds!.find(
    (world) => world.id === 'homeworld:emperor:salusa',
  )!.forces.e = { normal: 0, elite: 5 };
  view.homeworlds!.worlds!.find(
    (world) => world.id === 'homeworld:guild',
  )!.forces.e = { normal: 1, elite: 0 };
  const actions = homeworldShipmentActions(view, 3);
  const combined = actions.find(
    (action) => Object.keys(action.sources as object).length === 2,
  );
  assert.ok(combined);
  assert.deepEqual(combined.sources, {
    'homeworld:emperor:salusa': { normal: 0, elite: 3 },
    'homeworld:emperor': { normal: 1, elite: 0 },
  });
  assert.ok(
    homeworldShipmentChoice(
      view,
      String(combined.destination),
      combined.sources as Record<string, { normal: number; elite: number }>,
      Number(combined.allyPayment),
    ).action,
  );
});

void test('Nexus AI acceptance honors the projected Homeworld alliance restriction at every level', async () => {
  const {
    createGame,
    newPlayer,
    joinGame,
    applyAction,
    initializeHomeworldGameForAudit,
    viewGame,
  } = await import('../game/engine');
  const { botActions } = await import('../game/bots');
  let game = createGame(
    'HOMEWORLDALLIANCECONTROLS',
    newPlayer('e', 'Emperor', 'emperor'),
    false,
  );
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game = applyAction(game, 'e', { type: 'homeworlds', enabled: true });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldGameForAudit(game);
  while (game.setupStage === 'traitors') {
    const player = game.players.find(
      (candidate) => candidate.traitorChoices.length,
    )!;
    game = applyAction(game, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  game.deck.push(...game.players[0].hand.splice(0));
  Object.assign(game, {
    phase: 1,
    nexus: true,
    phaseOpening: null,
    spiceWindow: null,
    response: null,
    decision: null,
    ready: [],
    allianceOffers: { a: 'e' },
  });
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, 'e');
    view.players[0].bot = level;
    view.homeworldAllianceBlocks = {};
    const permitted = botActions(view);
    if (level !== 'Easy')
      assert.ok(
        permitted.some(
          (action) => action.type === 'alliance' && action.target === 'a',
        ),
      );
    view.homeworldAllianceBlocks = {
      a: 'Foreign forces on your Homeworld prevent this alliance.',
    };
    const before = structuredClone(view);
    const blocked = botActions(view);
    assert.ok(blocked.every((action) => action.type !== 'alliance'));
    assert.deepEqual(view, before);
  }
});

void test('Guild return controls and policy preserve foreign source custody and restore Junction at the printed rate', () => {
  const { view } = fixture();
  view.me = 'g';
  view.active = 'g';
  view.players[2].spice = 10;
  view.players[2].reserves = 3;
  const junction = view.homeworlds!.worlds!.find(
    (world) => world.id === 'homeworld:guild',
  )!;
  junction.forces.g = { normal: 3, elite: 0 };
  junction.side = 'low';
  junction.population = 3;
  view.homeworlds!.worlds!.find(
    (world) => world.id === 'homeworld:atreides',
  )!.forces.g = { normal: 7, elite: 0 };
  const selection = { 'homeworld:atreides': { normal: 5, elite: 0 } };
  const quoted = homeworldShipmentChoice(view, 'homeworld:guild', selection);
  assert.equal(quoted.cost, 3);
  assert.ok(quoted.action);
  for (let level = 0; level < 4; level++) {
    const returns = homeworldShipmentActions(view, level).filter(
      (action) => action.destination === 'homeworld:guild',
    );
    assert.ok(returns.length);
    assert.ok(
      returns.every((action) =>
        Object.keys(action.sources as object).every(
          (id) => id !== 'homeworld:guild',
        ),
      ),
    );
  }
  const html = renderToStaticMarkup(
    createElement(HomeworldShipment, {
      game: view,
      act: () => {},
      busy: false,
    }),
  );
  assert.match(html, /Guild may also return a foreign garrison to Junction/);
  assert.match(html, /Junction · return to your Homeworld/);
  assert.match(html, /Guild pays one spice per two forces, rounded up/);
  assert.doesNotMatch(html, /Your own Homeworld cannot/);
});
