import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors } from '../game/ecaz-ambassadors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TERRITORIES, MOBILE_STRONGHOLD } from '../game/board';

function fixture(choam = false): Game {
  const g = createGame('ECAZPLACE', newPlayer('e', 'Ecaz', 'ecaz'));
  g.players.push(newPlayer('other', 'Other', choam ? 'choam' : 'emperor'));
  g.status = 'playing';
  g.phase = 4;
  g.turn = 3;
  g.storm = 18;
  g.order = ['e', 'other'];
  g.deck = baseDeck();
  g.ecazAmbassadors = createAmbassadors(() => 0);
  for (const player of g.players) {
    player.spice = 10;
    player.hand = [];
    player.forces = {};
  }
  return g;
}
function ready(state = fixture()) {
  let g = state;
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let step = 0; g.response && step < 20; step++) {
    const player = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(player);
    g = applyAction(g, player.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const supplied = (g: Game) =>
  g.ecazAmbassadors!.tokens.filter((token) => token.zone === 'supply');
function declare(g: Game, token = supplied(g)[0].id, territory = 'arrakeen') {
  return applyAction(g, 'e', { type: 'decision', token, territory });
}
function rejected(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}

void test('all factions ready opens Ecaz at end of Revival; placements charge one then two only after all responses', () => {
  const initial = fixture();
  initial.players[1].hand.push(
    initial.deck.splice(
      initial.deck.findIndex((c) => c.effect === 'karama'),
      1,
    )[0],
  );
  const firstReady = applyAction(initial, 'e', { type: 'ready' });
  assert.equal(firstReady.decision, null);
  let g = applyAction(firstReady, 'other', { type: 'ready' });
  assert.equal(g.phase, 4);
  assert.deepEqual(g.decision, { kind: 'ecazPlacement', player: 'e' });
  assert.equal(viewGame(g, 'e').ambassadors!.nextCost, 1);
  for (const [index, territory] of ['arrakeen', 'carthag'].entries()) {
    const token = supplied(g)[0].id;
    const beforeSpice = g.players[0].spice;
    const beforeTokens = structuredClone(g.ecazAmbassadors);
    g = declare(g, token, territory);
    assert.equal(g.response?.kind, 'ecazPlacement');
    assert.equal(g.pendingEcazPlacement?.cost, index + 1);
    assert.equal(g.players[0].spice, beforeSpice);
    assert.deepEqual(g.ecazAmbassadors, beforeTokens);
    g = applyAction(g, 'e', { type: 'passResponse' });
    assert.equal(g.players[0].spice, beforeSpice);
    g = applyAction(g, 'other', { type: 'passResponse' });
    assert.equal(g.players[0].spice, beforeSpice - (index + 1));
    assert.equal(
      g.ecazAmbassadors!.tokens.find((t) => t.id === token)?.location,
      territory,
    );
    assert.equal(g.decision?.kind, 'ecazPlacement');
    assert.equal(viewGame(g, 'e').ambassadors!.nextCost, index + 2);
  }
  g = applyAction(g, 'e', { type: 'decision', decline: true });
  assert.equal(g.phase, 5);
  assert.equal(g.ecazPlacementTurn, 3);
  assert.equal(g.players[0].spice, 7);
  assert.equal(
    g.ecazAmbassadors!.tokens.filter((t) => t.zone === 'placed').length,
    2,
  );
});

void test('placement rejects wrong owner, phase, completed opportunity, invalid target and unavailable token atomically', () => {
  const g = ready();
  const token = supplied(g)[0].id;
  const action: Action = { type: 'decision', token, territory: 'arrakeen' };
  rejected(g, 'other', action);
  for (const territory of ['imperial_basin', MOBILE_STRONGHOLD, 'missing'])
    rejected(g, 'e', { ...action, territory });
  for (const token of [
    'missing',
    g.ecazAmbassadors!.tokens.find((t) => t.zone === 'pool')!.id,
  ])
    rejected(g, 'e', { ...action, token });
  for (const field of ['phase', 'completed', 'spice', 'storm'] as const) {
    const changed = structuredClone(g);
    if (field === 'phase') changed.phase = 5;
    if (field === 'completed') changed.ecazPlacementTurn = changed.turn;
    if (field === 'spice') changed.players[0].spice = 0;
    if (field === 'storm')
      changed.storm = TERRITORIES.find((t) => t.id === 'arrakeen')!.sectors[0];
    rejected(changed, 'e', action);
  }
  const placed = allow(declare(g));
  rejected(placed, 'e', { ...action, territory: 'carthag' });
  rejected(placed, 'e', { ...action, token: supplied(placed)[0].id });
});

void test('JSON response restoration charges exactly once and rejects stale response context', () => {
  const initial = fixture();
  initial.players[1].hand.push(
    initial.deck.splice(
      initial.deck.findIndex((c) => c.effect === 'karama'),
      1,
    )[0],
  );
  let pending = declare(ready(initial));
  pending = applyAction(pending, 'e', { type: 'passResponse' });
  const after = applyAction(reload(pending), 'other', { type: 'passResponse' });
  assert.equal(after.players[0].spice, 9);
  assert.equal(after.ecazAmbassadors!.placement?.count, 1);
  assert.equal(after.pendingEcazPlacement, null);
  rejected(after, 'other', { type: 'passResponse' });
  for (const field of ['turn', 'phase', 'price', 'completed'] as const) {
    const stale = reload(pending);
    if (field === 'turn') stale.turn++;
    if (field === 'phase') stale.phase = 5;
    if (field === 'price') stale.pendingEcazPlacement!.cost = 99;
    if (field === 'completed') stale.ecazPlacementTurn = stale.turn;
    rejected(stale, 'other', { type: 'passResponse' });
  }
});

void test('Karama stops remaining placements without paying the canceled placement or refunding earlier ones', () => {
  let g = allow(declare(ready()));
  const first = g.ecazAmbassadors!.tokens.find(
    (token) => token.zone === 'placed',
  )!;
  const next = supplied(g)[0].id;
  const karama = g.deck.splice(
    g.deck.findIndex((card) => card.effect === 'karama'),
    1,
  )[0];
  g.players[1].hand.push(karama);
  g = declare(g, next, 'carthag');
  g = applyAction(reload(g), 'other', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(g.phase, 5);
  assert.equal(g.players[0].spice, 9);
  assert.equal(
    g.ecazAmbassadors!.tokens.find((token) => token.id === first.id)?.location,
    'arrakeen',
  );
  assert.equal(
    g.ecazAmbassadors!.tokens.find((token) => token.id === next)?.zone,
    'supply',
  );
  assert.deepEqual(g.ecazAmbassadors!.placement, {
    turn: 3,
    count: 1,
    blocked: true,
  });
  assert.equal(g.ecazPlacementTurn, 3);
  assert.ok(g.discard.some((card) => card.id === karama.id));
  rejected(g, 'e', { type: 'decision', token: next, territory: 'carthag' });
  // Resume a later end-of-Revival fixture with the persisted custody and block stamp.
  g.phase = 4;
  g.turn++;
  g.ready = [];
  g.active = null;
  g = ready(reload(g));
  assert.equal(viewGame(g, 'e').ambassadors!.blocked, false);
  assert.equal(viewGame(g, 'e').ambassadors!.nextCost, 1);
  g = allow(declare(g, next, 'carthag'));
  assert.equal(g.players[0].spice, 8);
  assert.deepEqual(g.ecazAmbassadors!.placement, {
    turn: 4,
    count: 1,
    blocked: false,
  });
});

void test('public Ambassador faces and locations do not reveal either private Treachery hand', () => {
  const g = ready();
  g.players[0].hand.push(g.deck.pop()!);
  g.players[1].hand.push(g.deck.pop()!);
  const placed = allow(declare(g));
  const own = viewGame(placed, 'e');
  const other = viewGame(placed, 'other');
  assert.deepEqual(own.ambassadors, other.ambassadors);
  assert.equal(other.ambassadors!.tokens.length, 11);
  assert.ok(
    other.ambassadors!.tokens.every(
      (token) => typeof token.effect === 'string',
    ),
  );
  assert.equal(
    other.ambassadors!.tokens.find((token) => token.zone === 'placed')
      ?.location,
    'arrakeen',
  );
  assert.deepEqual(
    own.players.find((p) => p.id === 'e')!.hand,
    placed.players[0].hand,
  );
  assert.equal(other.players.find((p) => p.id === 'e')!.hand, undefined);
  assert.equal(own.players.find((p) => p.id === 'other')!.hand, undefined);
  other.ambassadors!.tokens[0].location = 'tampered';
  assert.notEqual(placed.ecazAmbassadors!.tokens[0].location, 'tampered');
});

void test('all four bot profiles complete a finite placement opportunity with legal choices and exact budget', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture();
    initial.players[0].spice = 7;
    for (const p of initial.players) p.bot = difficulty;
    let g = ready(initial);
    let steps = 0;
    while (g.phase === 4 && steps++ < 40) {
      const id = g.response
        ? g.players.find((p) => !g.response!.passed.includes(p.id))!.id
        : g.decision!.player;
      const actions = botActions(viewGame(g, id));
      assert.ok(
        actions.length > 0,
        `${difficulty}: waiting player has an action`,
      );
      if (!g.response)
        assert.deepEqual(
          botActions(viewGame(g, 'other')),
          [],
          'other seat cannot place for Ecaz',
        );
      g = applyAction(reload(g), id, actions[0]);
    }
    assert.ok(steps < 40, difficulty);
    assert.equal(g.phase, 5);
    assert.equal(g.players[0].spice, 1);
    assert.equal(g.ecazAmbassadors!.placement?.count, 3);
    assert.equal(
      g.ecazAmbassadors!.tokens.filter((token) => token.zone === 'placed')
        .length,
      3,
    );
  }
});

void test('CHOAM end-phase market finishes before Ecaz placement and is not reopened after placement completes', () => {
  let g = ready(fixture(true));
  assert.equal(g.phase, 4);
  assert.equal(g.decision?.kind, 'choamMarket');
  assert.equal(g.ecazPlacementTurn, undefined);
  rejected(g, 'e', {
    type: 'decision',
    token: supplied(g)[0].id,
    territory: 'arrakeen',
  });
  g = applyAction(g, 'other', { type: 'decision', done: true });
  assert.equal(g.choamMarket, null);
  assert.equal(g.decision?.kind, 'ecazPlacement');
  g = allow(declare(g));
  g = applyAction(g, 'e', { type: 'decision', decline: true });
  assert.equal(g.phase, 5);
  assert.equal(g.choamMarket, null);
  assert.notEqual(g.decision?.kind, 'choamMarket');
});
