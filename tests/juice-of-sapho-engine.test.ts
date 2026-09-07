import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

const card = 'richese-juice-of-sapho';
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function initial() {
  let g = createGame('SAPHOENGINE', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => {
    p.ready = true;
  });
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  assert.equal(g.status, 'playing');
  Object.assign(g, {
    turn: 2,
    storm: 18,
    response: null,
    decision: null,
    phaseOpening: null,
    order: ['a', 'e', 'g'],
    ready: [],
    deck: baseDeck(),
    discard: [],
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
  }
  return g;
}
function hold(g: Game, id: string) {
  const at = g.richeseCache!.findIndex((c) => c.id === card);
  assert.ok(at >= 0);
  g.players
    .find((p) => p.id === id)!
    .hand.push(g.richeseCache!.splice(at, 1)[0]);
}
function movement(owner = 'e', advanced = false) {
  let g = initial();
  g.advanced = advanced;
  g.phase = 4;
  hold(g, owner);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 5);
  return g;
}
function auction(owner = 'e', method = 'onceAround', fullHand = false) {
  let g = initial();
  g.players[2].faction = 'richese';
  g.players[2].leaders = leaders('richese');
  hold(g, owner);
  if (fullHand)
    g.players.find((p) => p.id === owner)!.hand.push(...g.deck.splice(0, 3));
  g.phase = 2;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = applyAction(g, 'g', {
    type: 'decision',
    event: g.richeseBidding!.event,
    position: 'first',
  });
  g = applyAction(g, 'g', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: g.richeseCache![0].id,
    method,
    direction: 'counterclockwise',
  });
  assert.equal(g.richeseAuction!.method, method);
  return g;
}
function action(
  g: Game,
  mode: 'first' | 'last',
  scope = g.phase === 5 ? 'movement' : 'onceAround',
): Action {
  return {
    type: 'card',
    card,
    mode,
    scope,
    event:
      scope === 'movement' ? `movement:${g.turn}` : g.richeseAuction!.event,
  };
}
function reject(g: Game, owner: string, a: Action) {
  const before = reload(g);
  assert.throws(() => applyAction(g, owner, a));
  assert.deepEqual(reload(g), before);
}
function end(g: Game) {
  return applyAction(g, g.active!, { type: 'endMovement' });
}
function bid(g: Game, owner: string, amount: number | null) {
  return applyAction(g, owner, {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount,
  });
}

void test('Once Around first changes only the still-unstarted lot and discards exactly once after JSON recovery', () => {
  const before = auction();
  assert.notEqual(before.richeseAuction!.active, 'e');
  const request = action(before, 'first');
  const g = applyAction(reload(before), 'e', request);
  assert.equal(g.richeseAuction!.active, 'e');
  assert.equal(g.active, 'e');
  assert.deepEqual(g.order, before.order);
  assert.deepEqual(g.richeseAuction!.tieOrder, before.richeseAuction!.tieOrder);
  assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  assert.equal(
    g.players[1].hand.some((c) => c.id === card),
    false,
  );
  reject(g, 'e', request);
  const next = bid(reload(g), 'e', 2);
  assert.equal(next.richeseAuction!.bid, 2);
  assert.deepEqual(next.richeseAuction!.acted, ['e']);
});

void test('Once Around last preserves prior bids and permits a final outbid after Richese', () => {
  let g = auction();
  const first = g.richeseAuction!.active!;
  assert.notEqual(first, 'e');
  g = bid(g, first, 2);
  const lotCard = g.richeseAuction!.cardId;
  g = applyAction(g, 'e', action(g, 'last'));
  assert.equal(g.richeseAuction!.bid, 2);
  assert.equal(g.richeseAuction!.bidder, first);
  assert.deepEqual(g.richeseAuction!.acted, [first]);
  assert.equal(g.richeseAuction!.active, 'g');
  g = bid(g, 'g', 3);
  assert.equal(g.richeseAuction!.active, 'e');
  reject(g, 'e', {
    type: 'richeseBid',
    event: g.richeseAuction!.event,
    amount: 3,
  });
  g = bid(reload(g), 'e', 4);
  assert.ok(g.players[1].hand.some((c) => c.id === lotCard));
  assert.equal(g.players[1].spice, 16);
  assert.equal(g.players[2].spice, 24);
  assert.deepEqual(g.order, ['a', 'e', 'g']);
});

void test('Once Around rejects late first, completed opportunity, no-op and stale event without card loss', () => {
  let g = auction();
  g = bid(g, g.richeseAuction!.active!, 1);
  reject(g, 'e', action(g, 'first'));
  reject(g, 'e', { ...action(g, 'last'), event: 'expired' });
  g = bid(g, 'e', 2);
  reject(g, 'e', action(g, 'last'));
  const alreadyLast = auction('g');
  reject(alreadyLast, 'g', action(alreadyLast, 'last'));
  const alreadyFirst = auction('a');
  reject(alreadyFirst, 'a', action(alreadyFirst, 'first'));
});

void test('Silent bidding has no Sapho ordering options or reordered storm tie outcome', () => {
  let g = auction('e', 'silent');
  assert.deepEqual(viewGame(g, 'e').saphoOptions, []);
  reject(g, 'e', action(g, 'last'));
  const lot = g.richeseAuction!.cardId;
  for (const id of ['g', 'e', 'a']) g = bid(g, id, 2);
  assert.ok(g.players[0].hand.some((c) => c.id === lot));
});

void test('Basic movement first/last preserve physical order and give each faction precisely one combined turn', () => {
  for (const mode of ['first', 'last'] as const) {
    const before = movement();
    let g = applyAction(before, 'e', action(before, mode));
    const acted: string[] = [];
    while (g.phase === 5) {
      acted.push(g.active!);
      g = end(reload(g));
    }
    assert.deepEqual(
      acted,
      mode === 'first' ? ['e', 'a', 'g'] : ['a', 'g', 'e'],
    );
    assert.deepEqual(g.order, before.order);
    assert.deepEqual(g.movementRemaining, []);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  }
});

void test('Movement first is unavailable after another combined turn finishes, while last still works at the next clean boundary', () => {
  let g = end(movement());
  reject(g, 'e', action(g, 'first'));
  g = applyAction(g, 'e', action(g, 'last'));
  assert.deepEqual(g.movementRemaining, ['g', 'e']);
  assert.equal(g.active, 'g');
});

void test('Shipment and movement commitments both prevent splitting the active combined turn', () => {
  let g = movement();
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.players[0].shipped, true);
  assert.deepEqual(viewGame(g, 'e').saphoOptions, []);
  reject(g, 'e', action(g, 'last'));
  let moved = movement();
  moved.players[0].forces = { 'arrakeen:10': 1 };
  moved.players[0].reserves = 19;
  moved = applyAction(moved, 'a', {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  assert.equal(moved.players[0].moved, 1);
  reject(moved, 'e', action(moved, 'last'));
  reject(moved, 'e', action(moved, 'first'));
});

void test('Completed holder and already-first/already-last movement no-ops cannot consume Sapho', () => {
  const first = movement('a');
  reject(first, 'a', action(first, 'first'));
  const last = movement('g');
  reject(last, 'g', action(last, 'last'));
  const completed = end(first);
  assert.deepEqual(viewGame(completed, 'a').saphoOptions, []);
  reject(completed, 'a', action(completed, 'last'));
});

void test('Advanced Guild remains before Sapho last across repeated deferrals and saved-state normalization', () => {
  let g = movement('e', true);
  assert.equal(g.decision?.kind, 'guildTiming');
  reject(g, 'e', action(g, 'last'));
  g = applyAction(g, 'g', { type: 'decision', take: false });
  assert.equal(g.active, 'a');
  reject(g, 'e', action(g, 'first'));
  g = applyAction(g, 'e', action(g, 'last'));
  assert.deepEqual(g.movementRemaining, ['a', 'g', 'e']);
  assert.equal(
    g.decision,
    null,
    'an unchanged current actor must not reopen the resolved Guild choice',
  );
  assert.equal(g.active, 'a');
  g = end(reload(g));
  if (g.decision?.kind === 'guildTiming')
    g = applyAction(g, 'g', { type: 'decision', take: false });
  assert.equal(g.active, 'g');
  g = normalizeAutomaticGame(reload(g));
  assert.equal(g.active, 'g');
  g = end(g);
  assert.equal(g.active, 'e');
  g = end(g);
  assert.notEqual(g.phase, 5);
  assert.deepEqual(g.order, ['a', 'e', 'g']);
});

void test('Sapho last respects an already granted early Guild turn, including Guild itself moving to last', () => {
  for (const holder of ['a', 'g']) {
    let g = movement(holder, true);
    g = applyAction(g, 'g', { type: 'decision', take: true });
    assert.equal(g.active, 'g');
    assert.equal(g.guildTimingGranted, true);
    assert.equal(g.decision, null);
    assert.equal(g.response, null);
    assert.deepEqual(g.movementRemaining, ['a', 'e', 'g']);
    const heldView = viewGame(g, holder);
    assert.ok(
      heldView.saphoOptions.some(
        (option) => option.scope === 'movement' && option.mode === 'last',
      ),
    );
    assert.equal(
      heldView.saphoOptions.some((option) => option.mode === 'first'),
      false,
    );
    reject(g, holder, action(g, 'first'));
    g = applyAction(reload(g), holder, action(g, 'last'));
    assert.equal(
      g.guildTimingGranted,
      true,
      'Sapho does not revoke the resolved Guild power',
    );
    assert.equal(
      g.decision,
      null,
      'last priority does not reopen Guild timing',
    );
    assert.equal(g.response, null);
    assert.equal(g.active, holder === 'a' ? 'g' : 'a');
    const expected = holder === 'a' ? ['g', 'e', 'a'] : ['a', 'e', 'g'];
    assert.deepEqual(g.movementRemaining, expected);
    assert.equal(g.saphoMovementLast?.player, holder);
    const acted: string[] = [];
    while (g.phase === 5) {
      assert.equal(g.decision, null);
      acted.push(g.active!);
      g = end(normalizeAutomaticGame(reload(g)));
    }
    assert.deepEqual(acted, expected);
    assert.deepEqual(g.order, ['a', 'e', 'g']);
    assert.deepEqual(g.movementRemaining, []);
    assert.equal(g.saphoMovementLast, null);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  }
});

void test('early Guild timing makes the previous penultimate faction actually last without spending Sapho', () => {
  let g = movement('e', true);
  g = applyAction(g, 'g', { type: 'decision', take: true });
  assert.equal(g.active, 'g');
  assert.deepEqual(g.movementRemaining, ['a', 'e', 'g']);
  assert.deepEqual(viewGame(g, 'e').saphoOptions, []);
  reject(g, 'e', action(g, 'last'));
  assert.ok(g.players[1].hand.some((c) => c.id === card));
  const acted: string[] = [];
  while (g.phase === 5) {
    acted.push(g.active!);
    g = end(g);
  }
  assert.deepEqual(acted, ['g', 'a', 'e']);
});

void test('a granted early Guild turn becomes ineligible for Sapho interruption after shipment starts', () => {
  for (const holder of ['a', 'g']) {
    let g = movement(holder, true);
    g = applyAction(g, 'g', { type: 'decision', take: true });
    g = applyAction(g, 'g', {
      type: 'ship',
      territory: 'polar_sink',
      sector: 0,
      amount: 1,
    });
    if (g.decision?.kind === 'guildShipment')
      g = applyAction(g, 'g', { type: 'decision', allow: true });
    assert.equal(g.players[2].shipped, true);
    assert.equal(g.active, 'g');
    assert.deepEqual(viewGame(g, holder).saphoOptions, []);
    reject(g, holder, action(g, 'last'));
    assert.ok(
      g.players.find((p) => p.id === holder)!.hand.some((c) => c.id === card),
    );
  }
});

void test('a started movement preparation locks the turn before forces are shipped or moved', () => {
  for (const effect of ['hajr', 'karama']) {
    let g = movement();
    const index = g.deck.findIndex((c) => c.effect === effect);
    const preparation = g.deck.splice(index, 1)[0];
    g.players[0].hand.push(preparation);
    g = applyAction(g, 'a', {
      type: 'card',
      card: preparation.id,
      ...(effect === 'karama' ? { mode: 'shipment' } : {}),
    });
    assert.equal(g.players[0].moved, 0);
    assert.equal(g.players[0].shipped, false);
    assert.deepEqual(viewGame(g, 'e').saphoOptions, []);
    reject(g, 'e', action(g, 'last'));
  }
});

void test('saved last protection rejects corrupt phase, event, owner and duplicate or reordered queues without repair', () => {
  const before = movement();
  const valid = applyAction(before, 'e', action(before, 'last'));
  assert.deepEqual(normalizeAutomaticGame(reload(valid)), reload(valid));
  const corruptions: ((g: Game) => void)[] = [
    (g) => {
      g.saphoMovementLast!.turn--;
    },
    (g) => {
      g.saphoMovementLast!.event = 'movement:expired';
    },
    (g) => {
      g.saphoMovementLast!.player = 'foreign';
    },
    (g) => {
      g.phase = 6;
    },
    (g) => {
      g.movementRemaining = ['a', 'e', 'g'];
    },
    (g) => {
      g.movementRemaining = ['a', 'a', 'e'];
    },
    (g) => {
      g.movementRemaining = null;
    },
  ];
  for (const corrupt of corruptions) {
    const g = reload(valid);
    corrupt(g);
    const saved = reload(g);
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() => applyAction(g, 'a', { type: 'endMovement' }));
    assert.deepEqual(g, saved);
  }
});

void test('discarding Sapho creates eligibility for a full-hand holder excluded from an open Once Around lot', () => {
  for (const mode of ['first', 'last'] as const) {
    let g = auction('e', 'onceAround', true);
    assert.equal(g.players[1].hand.length, 4);
    assert.equal(g.richeseAuction!.eligible.includes('e'), false);
    const sold = g.richeseAuction!.cardId;
    assert.ok(viewGame(g, 'e').saphoOptions.some((o) => o.mode === mode));
    g = applyAction(g, 'e', action(g, mode));
    assert.equal(g.players[1].hand.length, 3);
    assert.ok(g.richeseAuction!.eligible.includes('e'));
    assert.deepEqual(g.richeseAuction!.tieOrder, g.order);
    if (mode === 'first') {
      assert.equal(g.richeseAuction!.active, 'e');
      g = bid(g, 'e', 1);
      while (g.richeseAuction && !g.richeseAuction.outcome)
        g = bid(g, g.richeseAuction.active!, null);
    } else {
      assert.equal(g.richeseAuction!.order.at(-1), 'e');
      while (g.richeseAuction!.active !== 'e')
        g = bid(g, g.richeseAuction!.active!, 1 + g.richeseAuction!.bid);
      g = bid(g, 'e', 1 + g.richeseAuction!.bid);
    }
    assert.ok(g.players[1].hand.some((c) => c.id === sold));
    assert.equal(g.players[1].hand.length, 4);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  }
});

void test('Sapho options are owner-only and do not reveal hidden cards through another player view', () => {
  const withCard = movement();
  assert.ok(viewGame(withCard, 'e').saphoOptions.length);
  assert.deepEqual(viewGame(withCard, 'a').saphoOptions, []);
  const without = reload(withCard);
  without.players[1].hand = [without.deck.pop()!];
  assert.deepEqual(viewGame(without, 'a'), viewGame(withCard, 'a'));
  assert.deepEqual(viewGame(without, 'e').saphoOptions, []);
  reject(withCard, 'a', action(withCard, 'last'));
});
