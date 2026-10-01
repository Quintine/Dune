import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, type Card } from '../game/cards';
import {
  IxianReplacementError,
  closeIxianReplacementSource,
  createIxianReplacementSource,
  initialIxianReplacementCursor,
  ixianReplacementEvent,
  validateIxianReplacementHistory,
  validateIxianReplacementSource,
  type IxianReplacementContext,
  type IxianReplacementReceipt,
} from '../game/nexus-ixian-replacement';

const [purchased, older, top, unsold] = baseDeck();
const parent = 'original-native-paid-sale-parent';

function context(): IxianReplacementContext {
  return {
    status: 'playing', phase: 3, turn: 1, sequence: 0,
    auction: { cards: [{ ...purchased }, { ...unsold }], index: 0, bidder: 'buyer', bid: 4 },
    sale: { winner: 'buyer', amount: 4, free: false, origin: 'normal', seller: null },
    players: [
      { id: 'buyer', hand: [{ ...older }, { ...purchased }], handLimit: 4 },
      { id: 'rival', hand: [], handLimit: 4 },
    ],
    physicalCards: [{ ...older }, { ...purchased }, { ...top }, { ...unsold }],
  };
}
function source(ctx: IxianReplacementContext = context()) {
  return createIxianReplacementSource(
    ctx, ixianReplacementEvent(ctx.turn, 'buyer', ctx.sequence, 0), parent,
  );
}

void test('retained purchases keep saved receipt history linear through the game horizon', () => {
  const physical = baseDeck();
  const history: IxianReplacementReceipt[] = [];
  let cursor = initialIxianReplacementCursor();
  for (let turn = 2; turn <= 10; turn++) {
    const ctx = context();
    ctx.turn = turn;
    ctx.sequence = cursor.sequence;
    ctx.auction!.cards = [purchased, top, unsold];
    ctx.players = [...ctx.players, { id: 'guild', hand: [], handLimit: 4 }];
    ctx.physicalCards = physical;
    const original = createIxianReplacementSource(ctx,
      ixianReplacementEvent(turn, 'buyer', cursor.sequence, 0), JSON.stringify(ctx));
    const closed = closeIxianReplacementSource(original, 'pass', null, cursor);
    cursor = closed.cursor;
    history.push(closed.receipt);
    validateIxianReplacementHistory(history, cursor, physical);
  }
  const firstBytes = JSON.stringify(history[0]).length;
  assert.ok(JSON.stringify(history.at(-1)).length <= firstBytes * 2,
    'a receipt must not embed recursively escaped predecessor receipts');
  assert.ok(JSON.stringify(history).length <= history.length * firstBytes * 2,
    'persisted history must grow with purchases, not exponentially');
});

void test('a live purchase cannot target another held card or a card no longer held by its buyer', () => {
  const original = source();
  const missing = context();
  missing.players = missing.players.map(player => player.id === 'buyer'
    ? { ...player, hand: [{ ...older }] }
    : { ...player, hand: [{ ...purchased }] });
  assert.throws(() => validateIxianReplacementSource(missing, original, parent), IxianReplacementError);
  const substituted = { ...original, card: { ...older } };
  assert.throws(() => validateIxianReplacementSource(context(), substituted, parent), IxianReplacementError);
});

void test('canonical descriptors cannot be redefined by a matching auction row and hand', () => {
  for (const patch of [
    { name: 'Another face' }, { kind: 'special' }, { effect: 'fabricated' },
    { id: 'nonphysical-card' }, { extra: 'not-a-card-field' },
  ]) {
    const ctx = context();
    const corrupt = { ...purchased, ...patch } as Card;
    ctx.auction!.cards = [corrupt, unsold];
    ctx.players = [{ ...ctx.players[0], hand: [older, corrupt] }, ctx.players[1]];
    ctx.physicalCards = [older, corrupt, top, unsold];
    assert.throws(() => source(ctx), IxianReplacementError);
  }
});

void test('duplicate physical cards reject even when the purchased hand itself looks legal', () => {
  for (const duplicate of [purchased, older, top, unsold]) {
    const ctx = context();
    ctx.physicalCards = [...ctx.physicalCards, { ...duplicate }];
    assert.throws(() => source(ctx), IxianReplacementError);
  }
  const anotherHolder = context();
  anotherHolder.players = [anotherHolder.players[0], {
    ...anotherHolder.players[1], hand: [{ ...purchased }],
  }];
  assert.throws(() => source(anotherHolder), IxianReplacementError);
});

void test('a legal full hand permits net-zero replacement but an already over-cap hand does not', () => {
  const full = context();
  full.players = [{ ...full.players[0], handLimit: 2 }, full.players[1]];
  const original = source(full);
  const before = structuredClone(full);
  const result = closeIxianReplacementSource(original, 'use', top, initialIxianReplacementCursor());
  assert.equal(result.receipt.source.card.id, purchased.id);
  assert.equal(result.receipt.replacement?.id, top.id);
  assert.deepEqual(full, before);
  const overCap = { ...full, players: [{ ...full.players[0], handLimit: 1 }, full.players[1]] };
  assert.throws(() => source(overCap), IxianReplacementError);
});

void test('paid and printed Karama sources retain their native amount without recalculating payment', () => {
  const paid = source();
  assert.equal(paid.amount, 4);
  assert.equal(paid.free, false);
  for (const bid of [0, 4]) {
    const karama = context();
    karama.auction = { ...karama.auction!, bid };
    karama.sale = { ...karama.sale!, amount: bid, free: true };
    const receipt = source(karama);
    assert.equal(receipt.amount, bid);
    assert.equal(receipt.free, true);
  }
  const unpaid = context();
  unpaid.auction = { ...unpaid.auction!, bid: 0 };
  unpaid.sale = { ...unpaid.sale!, amount: 0 };
  assert.throws(() => source(unpaid), IxianReplacementError);
});

void test('current source must preserve normal origin, bidder, lot, price, payment kind, parent and cursor', () => {
  const original = source();
  const variants: IxianReplacementContext[] = [
    { ...context(), status: 'finished' },
    { ...context(), phase: 4 },
    { ...context(), turn: 2 },
    { ...context(), sequence: 1 },
    { ...context(), auction: null },
    { ...context(), sale: null },
    { ...context(), auction: { ...context().auction!, bidder: 'rival' } },
    { ...context(), auction: { ...context().auction!, index: 1 } },
    { ...context(), auction: { ...context().auction!, bid: 5 } },
    { ...context(), sale: { ...context().sale!, winner: 'rival' } },
    { ...context(), sale: { ...context().sale!, amount: 5 } },
    { ...context(), sale: { ...context().sale!, free: true } },
    { ...context(), sale: { ...context().sale!, origin: 'cache' } },
    { ...context(), sale: { ...context().sale!, origin: 'blackMarket' } },
    { ...context(), sale: { ...context().sale!, seller: 'rival' } },
  ];
  for (const ctx of variants)
    assert.throws(() => validateIxianReplacementSource(ctx, original, parent), IxianReplacementError);
  assert.throws(() => validateIxianReplacementSource(context(), original, 'changed-parent'), IxianReplacementError);
  assert.throws(() => createIxianReplacementSource(context(), 'stale-event', parent), IxianReplacementError);
});

void test('an empty deck permits newly discarded purchased card redraw; unsold row is not duplicate custody', () => {
  const ctx = context();
  // The physical census has only hands and the separate unsold row: no draw deck.
  ctx.physicalCards = [older, purchased, unsold];
  const original = source(ctx);
  const result = closeIxianReplacementSource(original, 'use', purchased, initialIxianReplacementCursor());
  assert.equal(result.receipt.replacement?.id, purchased.id);
  validateIxianReplacementHistory([result.receipt], result.cursor, [older, purchased, unsold]);
  // Counting the delivered row alias again is a real custody error.
  assert.throws(() => source({ ...ctx, physicalCards: [...ctx.physicalCards, purchased] }), IxianReplacementError);
});

void test('pass closes without a draw, and neither pass nor use can reuse an already closed cursor', () => {
  const original = source();
  const passed = closeIxianReplacementSource(original, 'pass', null, initialIxianReplacementCursor());
  validateIxianReplacementHistory([passed.receipt], passed.cursor);
  assert.throws(() => closeIxianReplacementSource(original, 'use', top, passed.cursor), IxianReplacementError);
  assert.throws(() => closeIxianReplacementSource(original, 'pass', null, passed.cursor), IxianReplacementError);
  assert.throws(() => closeIxianReplacementSource(original, 'pass', top, initialIxianReplacementCursor()), IxianReplacementError);
  assert.throws(() => closeIxianReplacementSource(original, 'use', null, initialIxianReplacementCursor()), IxianReplacementError);
  assert.throws(() => closeIxianReplacementSource(original, 'use', { ...top, name: 'wrong' }, initialIxianReplacementCursor()), IxianReplacementError);
});

void test('closed receipts survive JSON reload, transfer and a later purchase of the same recycled physical card', () => {
  const first = closeIxianReplacementSource(source(), 'use', top, initialIxianReplacementCursor());
  const later = context();
  later.turn = 2;
  later.sequence = first.cursor.sequence;
  const second = closeIxianReplacementSource(source(later), 'pass', null, first.cursor);
  const history = JSON.parse(JSON.stringify([first.receipt, second.receipt]));
  const cursor = JSON.parse(JSON.stringify(second.cursor));
  // Historical purchased and drawn cards can now be anywhere in the live census.
  validateIxianReplacementHistory(history, cursor, [top, unsold, purchased, older]);
  assert.equal(history[0].source.card.id, history[1].source.card.id);
  assert.notEqual(history[0].source.event, history[1].source.event);
});

void test('history removal, reordering, altered source/outcome and a changed independent cursor reject', () => {
  const first = closeIxianReplacementSource(source(), 'use', top, initialIxianReplacementCursor());
  const ctx = context();
  ctx.turn = 2;
  ctx.sequence = 1;
  const second = closeIxianReplacementSource(source(ctx), 'pass', null, first.cursor);
  const history = [first.receipt, second.receipt];
  const invalid: IxianReplacementReceipt[][] = [
    [], [first.receipt], [second.receipt, first.receipt], [first.receipt, first.receipt],
    [first.receipt, { ...second.receipt, previous: 'unrelated-chain' }],
    [first.receipt, { ...second.receipt, source: { ...second.receipt.source, amount: 7 } }],
    [first.receipt, { ...second.receipt, replacement: top }],
    [{ ...first.receipt, replacement: older }, second.receipt],
  ];
  for (const records of invalid)
    assert.throws(() => validateIxianReplacementHistory(records, second.cursor), IxianReplacementError);
  assert.throws(() => validateIxianReplacementHistory(history, { ...second.cursor, signature: 'changed-head' }), IxianReplacementError);
  assert.throws(() => validateIxianReplacementHistory(history, { ...second.cursor, sequence: 1 }), IxianReplacementError);
  assert.throws(() => validateIxianReplacementHistory(history, initialIxianReplacementCursor()), IxianReplacementError);
});

void test('receipt snapshots cannot be mutated through original source or native draw references', () => {
  const ctx = context();
  const before = structuredClone(ctx);
  const original = source(ctx);
  const drawn = { ...top };
  const result = closeIxianReplacementSource(original, 'use', drawn, initialIxianReplacementCursor());
  assert.deepEqual(ctx, before);
  original.card.name = 'mutated original source reference';
  drawn.name = 'mutated native draw reference';
  assert.equal(result.receipt.source.card.name, purchased.name);
  assert.equal(result.receipt.replacement?.name, top.name);
  validateIxianReplacementHistory([result.receipt], result.cursor);
});

void test('unknown saved receipt fields and malformed canonical custody fail closed', () => {
  const original = source();
  assert.throws(() => validateIxianReplacementSource(context(), { ...original, extra: true } as never, parent), IxianReplacementError);
  assert.throws(() => validateIxianReplacementSource(context(), null as never, parent), IxianReplacementError);
  const result = closeIxianReplacementSource(original, 'pass', null, initialIxianReplacementCursor());
  assert.throws(() => validateIxianReplacementHistory([{ ...result.receipt, extra: true } as never], result.cursor), IxianReplacementError);
  assert.throws(() => validateIxianReplacementHistory([result.receipt], { ...result.cursor, extra: true } as never), IxianReplacementError);
  assert.throws(() => validateIxianReplacementHistory([result.receipt], result.cursor, [{ ...purchased, effect: 'forged' }]), IxianReplacementError);
});
