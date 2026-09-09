import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  initializeHomeworldGameForAudit,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity } from '../game/homeworld-game';

function setup(reserves = 11, advanced = true, withKarama = true) {
  let g = createGame(
    'SPIRITUALHOMEWORLD',
    newPlayer('atreides', 'Atreides', 'atreides'),
    advanced,
    [],
  );
  joinGame(g, newPlayer('beneGesserit', 'Bene Gesserit', 'beneGesserit'));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 30; i++) {
    let moved = false;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((p) => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      g = applyAction(g, player.id, action);
      moved = true;
      break;
    }
    assert.ok(moved);
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'atreides',
    order: ['atreides', 'beneGesserit'],
    movementRemaining: ['atreides', 'beneGesserit'],
    ready: [],
    storm: 18,
  });
  const bg = g.players[1];
  Object.assign(bg, {
    reserves,
    tanks: 0,
    forces: { 'polar_sink:0': 20 - reserves },
    advisors: {},
  });
  for (const player of g.players)
    Object.assign(player, { shipped: false, moved: 0 });
  let karama: string | null = null;
  if (withKarama) {
    const at = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(at >= 0);
    const [card] = g.deck.splice(at, 1);
    g.players[0].hand.push(card);
    karama = card.id;
  }
  homeworldGameIntegrity(g);
  return { g, karama };
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function ship(g: Game) {
  return applyAction(g, 'atreides', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
}
function choose(g: Game, amount: unknown = 2, accompany = false) {
  return applyAction(g, 'beneGesserit', {
    type: 'decision',
    accept: true,
    amount,
    accompany,
  });
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}

void test('actual Basic and Advanced shipments offer optional one or two at high Wallach and settle the entire group once', () => {
  for (const advanced of [false, true])
    for (const amount of [1, 2]) {
      const { g: initial } = setup(11, advanced);
      const offered = ship(initial);
      assert.equal(offered.decision?.kind, 'advisor');
      let g = choose(reload(offered), amount);
      assert.equal(g.response?.kind, 'advisor');
      assert.equal(g.response?.amount, amount);
      assert.equal(g.players[1].reserves, 11);
      g = applyAction(reload(g), 'atreides', { type: 'passResponse' });
      assert.equal(g.players[1].reserves, 11 - amount);
      assert.equal(g.players[1].forces['polar_sink:0'], 9 + amount);
      assert.equal(g.response, null);
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      reject(g, 'beneGesserit', { type: 'decision', accept: true, amount });
      assert.match(g.log.at(-1)!.text, amount === 2 ? /two|2/ : /one|1/);
      inventory(g);
    }
});

void test('a low Wallach suppresses the actual free advisor decision and does not interrupt the shipper', () => {
  for (const advanced of [false, true]) {
    const { g } = setup(10, advanced);
    const shipped = ship(g);
    assert.equal(shipped.decision, null);
    assert.equal(shipped.response, null);
    assert.equal(shipped.players[1].reserves, 10);
    assert.equal(shipped.players[0].shipped, true);
    assert.equal(shipped.active, 'atreides');
    reject(shipped, 'beneGesserit', {
      type: 'decision',
      accept: true,
      amount: 1,
    });
    inventory(shipped);
  }
});

void test('the next actual shipment rechecks Wallach after a high population group lowers it to nine', () => {
  let g = choose(ship(setup().g));
  g = applyAction(g, 'atreides', { type: 'passResponse' });
  assert.equal(g.players[1].reserves, 9);
  // Stage a later unused shipment opportunity; conserve all earlier resources.
  g.turn++;
  g.players[0].shipped = false;
  g = ship(g);
  assert.equal(g.decision, null);
  assert.equal(g.players[1].reserves, 9);
  inventory(g);
});

void test('Advanced accompaniment to the actual destination remains one and arrives in advisor stance', () => {
  const offered = ship(setup().g);
  reject(offered, 'beneGesserit', {
    type: 'decision',
    accept: true,
    accompany: true,
    amount: 2,
    sector: 10,
  });
  let g = choose(offered, 1, true);
  assert.equal(g.response?.location, 'arrakeen:10');
  g = applyAction(g, 'atreides', { type: 'passResponse' });
  assert.equal(g.players[1].forces['arrakeen:10'], 1);
  assert.ok(g.players[1].advisors?.arrakeen);
  assert.equal(g.players[1].reserves, 10);
  inventory(g);
});

void test('ordinary Karama cancels the selected two-advisor action without withdrawing either reserve', () => {
  const { g: initial, karama } = setup();
  let g = choose(ship(initial));
  const before = structuredClone(g.players);
  g = applyAction(reload(g), 'atreides', {
    type: 'card',
    card: karama!,
    mode: 'cancel',
  });
  assert.equal(g.players[1].reserves, 11);
  assert.deepEqual(g.players[1], before[1]);
  assert.equal(g.response, null);
  assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
  assert.equal(g.players[0].shipped, true);
  inventory(g);
});

void test('advisor group size rejects malformed requests before cards, reserves or spice change', () => {
  const offered = ship(setup().g);
  for (const amount of [0, -1, 3, 20, 1.5, '2', null, {}, Number.NaN])
    reject(offered, 'beneGesserit', { type: 'decision', accept: true, amount });
  reject(offered, 'atreides', { type: 'decision', accept: true, amount: 2 });
  const defaultOne = applyAction(offered, 'beneGesserit', {
    type: 'decision',
    accept: true,
  });
  assert.equal(defaultOne.response?.amount, 1);
});

void test('absent Homeworld module preserves ordinary one-force accompaniment and rejects two', () => {
  const g = setup(11).g;
  g.homeworlds = null;
  const offered = ship(g);
  reject(offered, 'beneGesserit', {
    type: 'decision',
    accept: true,
    amount: 2,
  });
  const chosen = choose(offered, 1);
  assert.equal(chosen.response?.amount, 1);
});

void test('low Wallach still permits paid BG shipments and movement of its existing forces', () => {
  let g = setup(10).g;
  g.active = 'beneGesserit';
  g.movementRemaining = ['beneGesserit', 'atreides'];
  g.players[1].forces = { 'polar_sink:0': 9, 'arrakeen:10': 1 };
  g.players[1].advisors = { arrakeen: { lockedTurn: g.turn - 1 } };
  g = applyAction(g, 'beneGesserit', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  assert.equal(g.players[1].reserves, 9);
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  assert.ok(g.players[1].advisors?.arrakeen);
  g = applyAction(g, 'beneGesserit', {
    type: 'move',
    from: 'polar_sink:0',
    territory: 'wind_pass',
    sector: 14,
    amount: 1,
  });
  assert.equal(g.players[1].forces['wind_pass:14'], 1);
  inventory(g);
});

void test('all four AI profiles choose a legal public advisor option without revealing opposing hands', () => {
  for (const level of DIFFICULTIES) {
    const offered = ship(setup().g);
    const view = viewGame(offered, 'beneGesserit');
    view.players.find((p) => p.id === 'beneGesserit')!.bot = level;
    assert.equal(
      view.players.find((p) => p.id === 'atreides')!.hand,
      undefined,
    );
    const action = botActions(view).find((a) => a.type === 'decision');
    assert.ok(action, level);
    const decided = applyAction(offered, 'beneGesserit', action);
    assert.equal(decided.decision, null);
    inventory(decided);
  }
});

void test('without any eligible Karama holder the selected two-force allowance settles automatically', () => {
  const g = choose(ship(setup(11, true, false).g));
  assert.equal(g.response, null);
  assert.equal(g.players[1].reserves, 9);
  assert.equal(g.players[1].forces['polar_sink:0'], 11);
  inventory(g);
});
