import assert from 'node:assert/strict';
import test from 'node:test';
import { treacheryDeck } from '../game/cards';
import { NEXUS_FACTIONS, type NexusState } from '../game/nexus-cards';
import {
  IxianBetrayalError, closeIxianBetrayalSource, createIxianBetrayalSource,
  initialIxianBetrayalCursor, ixianBetrayalEligible, ixianBetrayalResponders,
  validateIxianBetrayalFrame, validateIxianBetrayalHistory, validateIxianBetrayalSource,
  type IxianBetrayalAuthority, type IxianBetrayalContext, type IxianBetrayalKind,
  type IxianBetrayalReceipt,
} from '../game/nexus-ixian-betrayal';

const parent = 'current-original-native-attempt-parent';
function context(face: 'ixians' | 'richese' = 'ixians'): IxianBetrayalContext {
  return {
    status: 'playing', phase: 3, turn: 2, advanced: true, sequence: 0,
    players: [
      { id: 'ix', faction: 'ixians' }, { id: 'holder', faction: 'atreides' },
      { id: 'other', faction: 'fremen' }, { id: 'ally', faction: 'guild' },
    ],
    cards: {
      version: 1, deck: NEXUS_FACTIONS.filter(card => card !== face && card !== 'harkonnen'),
      discard: [], hands: { ix: null, holder: face, other: 'harkonnen', ally: null },
    },
    physicalCards: treacheryDeck(['ix']),
  };
}
function authority(kind: IxianBetrayalKind = 'bidding'): IxianBetrayalAuthority {
  return {
    kind, provider: 'ix', nativeWindow: kind === 'bidding' ? 'ixAuction' : 'ixTechnology',
    nativeContext: kind === 'bidding' ? 'undrawn-native-pool' : 'declared-unused-lot-exchange',
    nativeRequired: ['holder'], nativePassed: ['other', 'holder'],
  };
}
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

for (const kind of ['bidding', 'technology'] as const) {
  void test(`${kind} authorizes only the current native provider, phase, context and cursor`, () => {
    const ctx = context(), native = authority(kind);
    const source = createIxianBetrayalSource(ctx, native, parent);
    const invalidContexts: IxianBetrayalContext[] = [
      { ...ctx, status: 'setup' }, { ...ctx, phase: 4 }, { ...ctx, turn: ctx.turn + 1 },
      { ...ctx, sequence: 1 }, { ...ctx, advanced: false },
      { ...ctx, players: ctx.players.map(player => player.id === 'ix'
        ? { ...player, faction: 'emperor' } : player) },
    ];
    for (const changed of invalidContexts) {
      assert.throws(() => validateIxianBetrayalSource(changed, source, native, parent));
    }
    const invalidAuthorities: IxianBetrayalAuthority[] = [
      { ...native, provider: 'holder' }, { ...native, nativeContext: 'another-native-attempt' },
      { ...native, nativePassed: ['holder'] }, { ...native, nativeRequired: [] },
      { ...native, kind: kind === 'bidding' ? 'technology' : 'bidding' },
    ];
    for (const changed of invalidAuthorities) {
      assert.throws(() => validateIxianBetrayalSource(ctx, source, changed, parent), IxianBetrayalError);
    }
    assert.throws(() => validateIxianBetrayalSource(ctx, source, native, 'different-parent'), IxianBetrayalError);
    assert.deepEqual(source.required, ['holder', 'other']);
  });

  void test(`${kind} cannot precede its original native counter completion or change native window`, () => {
    const ctx = context(), native = authority(kind);
    const invalidAuthorities: IxianBetrayalAuthority[] = [
      { ...native, nativePassed: ['other'] },
      { ...native, nativePassed: ['holder', 'holder'] },
      { ...native, nativeRequired: ['holder', 'holder'] },
      { ...native, nativeRequired: ['absent'], nativePassed: ['absent'] },
      { ...native, nativePassed: ['holder', 'absent'] },
      { ...native, nativeWindow: kind === 'bidding' ? 'ixTechnology' : 'ixAuction' },
      { ...native, provider: 'other' }, { ...native, nativeContext: '' },
    ];
    for (const changed of invalidAuthorities) {
      assert.throws(() => createIxianBetrayalSource(ctx, changed, parent), IxianBetrayalError);
    }
    const noNativeCounter = { ...native, nativeRequired: [], nativePassed: [] };
    const source = createIxianBetrayalSource(ctx, noNativeCounter, parent);
    validateIxianBetrayalFrame(ctx, source, noNativeCounter, parent, ['holder', 'other'], []);
  });

  void test(`${kind} requires exact public responder and unique passed membership before any continuation`, () => {
    const ctx = context(), native = authority(kind);
    const source = createIxianBetrayalSource(ctx, native, parent);
    validateIxianBetrayalFrame(ctx, source, native, parent, ['holder', 'other'], ['other']);
    for (const [required, passed] of [
      [['holder'], []], [['other', 'holder'], []], [['holder', 'other', 'ally'], []],
      [['holder', 'other', 'other'], []], [['holder', 'other'], ['holder', 'holder']],
      [['holder', 'other'], ['ix']], [['holder', 'other'], ['absent']],
    ]) {
      assert.throws(() => validateIxianBetrayalFrame(ctx, source, native, parent, required, passed), IxianBetrayalError);
    }
    const missingCard = structuredClone(ctx);
    missingCard.cards.hands.other = null;
    missingCard.cards.deck.push('harkonnen');
    assert.throws(() => validateIxianBetrayalFrame(missingCard, source, native, parent,
      ['holder', 'other'], []), IxianBetrayalError);
    const allied = structuredClone(ctx);
    allied.players = allied.players.map(player => player.id === 'holder' ? { ...player, ally: 'ally' }
      : player.id === 'ally' ? { ...player, ally: 'holder' } : player);
    assert.throws(() => validateIxianBetrayalFrame(allied, source, native, parent,
      ['holder', 'other'], []), IxianBetrayalError);
  });

  void test(`${kind} rejects corrupted saved event, descriptor, role, membership and extra authority fields`, () => {
    const ctx = context(), native = authority(kind);
    const source = createIxianBetrayalSource(ctx, native, parent);
    for (const patch of [
      { event: 'invented-event' }, { provider: 'other' }, { sequence: 1 }, { turn: 1 },
      { kind: 'invented' }, { nativeContext: 'substituted-card' }, { signature: 'invented-signature' },
      { required: ['holder'] }, { eligible: 'other' }, { nativePassed: [] }, { extra: 'client-chosen-source' },
    ]) {
      const corrupt = Object.assign(structuredClone(source), patch);
      assert.throws(() => validateIxianBetrayalFrame(ctx, corrupt, native, parent,
        ['holder', 'other'], []), IxianBetrayalError);
    }
    assert.throws(() => createIxianBetrayalSource(ctx,
      Object.assign({}, native, { selectedCard: 'client-chosen-card' }), parent), IxianBetrayalError);
    assert.throws(() => createIxianBetrayalSource(ctx, native, ''), IxianBetrayalError);
  });
}

void test('Basic authorizes native Bidding but never Technology', () => {
  const ctx = { ...context(), advanced: false };
  const bidding = createIxianBetrayalSource(ctx, authority('bidding'), parent);
  validateIxianBetrayalSource(ctx, bidding, authority('bidding'), parent);
  assert.throws(() => createIxianBetrayalSource(ctx, authority('technology'), parent), IxianBetrayalError);
});

void test('public held-card parity does not authorize an irrelevant face, owner or allied holder', () => {
  const ix = context(), irrelevant = context('richese');
  const realSource = createIxianBetrayalSource(ix, authority(), parent);
  const irrelevantSource = createIxianBetrayalSource(irrelevant, authority(), parent);
  assert.equal(realSource.event, irrelevantSource.event);
  assert.deepEqual(realSource.required, irrelevantSource.required);
  assert.throws(() => closeIxianBetrayalSource(irrelevantSource, 'use', 'holder',
    initialIxianBetrayalCursor()), IxianBetrayalError);
  assert.deepEqual(ixianBetrayalResponders(ix.cards, ix.players), ['holder', 'other']);
  assert.deepEqual(ixianBetrayalResponders(irrelevant.cards, irrelevant.players), ['holder', 'other']);
  assert.equal(ixianBetrayalEligible(ix.cards, ix.players, 'holder'), true);
  assert.equal(ixianBetrayalEligible(irrelevant.cards, irrelevant.players, 'holder'), false);
  for (const holder of ['ix', 'other', 'ally', 'absent']) {
    assert.equal(ixianBetrayalEligible(ix.cards, ix.players, holder), false);
  }
  const allied = context();
  allied.players = allied.players.map(player => player.id === 'holder' ? { ...player, ally: 'ally' }
    : player.id === 'ally' ? { ...player, ally: 'holder' } : player);
  assert.deepEqual(ixianBetrayalResponders(allied.cards, allied.players), ['other']);
  assert.equal(ixianBetrayalEligible(allied.cards, allied.players, 'holder'), false);
  const nativeHeld = context();
  nativeHeld.cards.hands.holder = null;
  nativeHeld.cards.hands.ix = 'ixians';
  assert.deepEqual(ixianBetrayalResponders(nativeHeld.cards, nativeHeld.players), ['other']);
  assert.equal(ixianBetrayalEligible(nativeHeld.cards, nativeHeld.players, 'ix'), false);
});

void test('Nexus eligibility cannot accept duplicate, missing, foreign-seat or unknown physical stock', () => {
  const variants: NexusState[] = [];
  const duplicate = context().cards;
  duplicate.deck.push('ixians'); variants.push(duplicate);
  const missing = context().cards;
  missing.hands.holder = null; variants.push(missing);
  const foreign = context().cards;
  foreign.hands.foreign = null; variants.push(foreign);
  const wrongVersion = context().cards;
  Object.assign(wrongVersion, { version: 2 }); variants.push(wrongVersion);
  const unknown = context().cards;
  Object.assign(unknown.deck, { 0: 'nonphysical-face' }); variants.push(unknown);
  for (const cards of variants) {
    assert.throws(() => ixianBetrayalEligible(cards, context().players, 'holder'));
    assert.throws(() => ixianBetrayalResponders(cards, context().players));
  }
  const ctx = context();
  ctx.players = ctx.players.map(player => player.id === 'other' ? { ...player, ally: 'holder' } : player);
  assert.throws(() => ixianBetrayalEligible(ctx.cards, ctx.players, 'holder'));
});

void test('both native kinds require canonical complete Ix47 stock, not matching fabricated descriptors', () => {
  for (const kind of ['bidding', 'technology'] as const) {
    const native = authority(kind);
    for (const patch of [
      { name: 'Substituted face' }, { kind: 'special' }, { effect: 'fabricated' },
      { id: 'foreign-physical-card' }, { extra: 'private-descriptor-field' },
    ]) {
      const ctx = context();
      const corrupt = Object.assign({}, ctx.physicalCards[0], patch);
      ctx.physicalCards = [corrupt, ...ctx.physicalCards.slice(1)];
      assert.throws(() => createIxianBetrayalSource(ctx, native, parent), IxianBetrayalError);
    }
    for (const cards of [treacheryDeck(), treacheryDeck(['ix']).slice(1),
      [...treacheryDeck(['ix']), treacheryDeck(['ix'])[0]],
      treacheryDeck(['ix']).map((card, index) => index === 0 ? treacheryDeck(['ix'])[1] : card),
    ]) {
      assert.throws(() => createIxianBetrayalSource({ ...context(), physicalCards: cards }, native, parent), IxianBetrayalError);
    }
    const excluded = context();
    excluded.players = excluded.players.map(player => player.id === 'other' ? { ...player, faction: 'richese' } : player);
    assert.throws(() => createIxianBetrayalSource(excluded, native, parent), IxianBetrayalError);
  }
});

void test('creation, validation and closure accept frozen inputs without aliasing source memberships', () => {
  const ctx = context(), native = authority();
  const snapshot = structuredClone({ ctx, native });
  freeze(ctx); freeze(native);
  const source = createIxianBetrayalSource(ctx, native, parent);
  freeze(source);
  const cursor = initialIxianBetrayalCursor(); freeze(cursor);
  const closed = closeIxianBetrayalSource(source, 'use', 'holder', cursor);
  validateIxianBetrayalFrame(ctx, source, native, parent, source.required, ['other']);
  validateIxianBetrayalHistory([closed.receipt], closed.cursor, ctx.physicalCards);
  assert.deepEqual({ ctx, native }, snapshot);
  assert.deepEqual(cursor, initialIxianBetrayalCursor());
  assert.notEqual(closed.receipt.source, source);
  for (const key of ['required', 'nativeRequired', 'nativePassed'] as const) {
    assert.notEqual(closed.receipt.source[key], source[key]);
    assert.deepEqual(closed.receipt.source[key], source[key]);
  }
});

void test('closure enforces use/pass outcomes, required holder and independent exactly-once cursor', () => {
  const source = createIxianBetrayalSource(context(), authority(), parent);
  const cursor = initialIxianBetrayalCursor();
  for (const holder of ['ix', 'other', 'ally', 'absent', null]) {
    assert.throws(() => closeIxianBetrayalSource(source, 'use', holder, cursor), IxianBetrayalError);
  }
  assert.throws(() => closeIxianBetrayalSource(source, 'pass', 'holder', cursor), IxianBetrayalError);
  const used = closeIxianBetrayalSource(source, 'use', 'holder', cursor);
  assert.equal(used.cursor.sequence, 1);
  assert.throws(() => closeIxianBetrayalSource(source, 'use', 'holder', used.cursor), IxianBetrayalError);
  assert.throws(() => validateIxianBetrayalSource({ ...context(), sequence: 1 }, source, authority(), parent), IxianBetrayalError);
  const passed = closeIxianBetrayalSource(source, 'pass', null, cursor);
  validateIxianBetrayalHistory([passed.receipt], passed.cursor);
  assert.throws(() => validateIxianBetrayalHistory([used.receipt], passed.cursor), IxianBetrayalError);
});

void test('closed history remains valid after physical Nexus recycling and a later holder change', () => {
  const ctx = context();
  const first = createIxianBetrayalSource(ctx, authority(), parent);
  const closed = closeIxianBetrayalSource(first, 'use', 'holder', initialIxianBetrayalCursor());
  ctx.cards.hands.holder = null;
  ctx.cards.discard.push('ixians');
  validateIxianBetrayalHistory([closed.receipt], closed.cursor, [...ctx.physicalCards].reverse());
  assert.equal(ixianBetrayalEligible(ctx.cards, ctx.players, 'holder'), false);
  // A later settled Nexus can recycle the same physical card into another hand.
  ctx.cards.discard.pop();
  ctx.cards.deck.push('harkonnen');
  ctx.cards.hands.other = 'ixians';
  ctx.turn++; ctx.sequence = closed.cursor.sequence;
  const second = createIxianBetrayalSource(ctx, authority('technology'), 'later-native-parent');
  const later = closeIxianBetrayalSource(second, 'use', 'other', closed.cursor);
  assert.equal(ixianBetrayalEligible(ctx.cards, ctx.players, 'other'), true);
  validateIxianBetrayalHistory([closed.receipt, later.receipt], later.cursor, ctx.physicalCards);
  assert.throws(() => validateIxianBetrayalSource(ctx, first, authority(), parent), IxianBetrayalError);
});

void test('history rejects deletion, duplicate/reordered closure, forged outcomes and disconnected cursor', () => {
  const ctx = context();
  const first = closeIxianBetrayalSource(createIxianBetrayalSource(ctx, authority(), parent),
    'use', 'holder', initialIxianBetrayalCursor());
  ctx.sequence = first.cursor.sequence;
  const second = closeIxianBetrayalSource(createIxianBetrayalSource(ctx, authority('technology'), parent),
    'pass', null, first.cursor);
  const history = [first.receipt, second.receipt];
  for (const corrupt of [[], [second.receipt], [first.receipt, first.receipt],
    [second.receipt, first.receipt], [first.receipt, second.receipt, second.receipt]]) {
    assert.throws(() => validateIxianBetrayalHistory(corrupt, second.cursor), IxianBetrayalError);
  }
  for (const patch of [{ holder: 'other' }, { outcome: 'pass' }, { previous: 'unrelated-head' },
    { signature: 'forged' }, { extra: 'hidden-current-ownership' }]) {
    const changed = Object.assign(structuredClone(first.receipt), patch);
    assert.throws(() => validateIxianBetrayalHistory([changed, second.receipt], second.cursor), IxianBetrayalError);
  }
  assert.throws(() => validateIxianBetrayalHistory(history, first.cursor), IxianBetrayalError);
  assert.throws(() => validateIxianBetrayalHistory(history, { sequence: 2, signature: 'disconnected' }), IxianBetrayalError);
});

void test('persisted multi-attempt history grows linearly with bounded predecessor links', () => {
  const ctx = context();
  const history: IxianBetrayalReceipt[] = [];
  let cursor = initialIxianBetrayalCursor();
  for (let index = 0; index < 80; index++) {
    ctx.turn = 1 + Math.floor(index / 8); ctx.sequence = cursor.sequence;
    const source = createIxianBetrayalSource(ctx, authority(index % 2 ? 'technology' : 'bidding'), parent);
    const closed = closeIxianBetrayalSource(source, index % 2 ? 'use' : 'pass', index % 2 ? 'holder' : null, cursor);
    history.push(closed.receipt); cursor = closed.cursor;
  }
  validateIxianBetrayalHistory(history, cursor, ctx.physicalCards);
  const firstSize = JSON.stringify(history[0]).length;
  assert.ok(JSON.stringify(history.at(-1)).length < firstSize * 2,
    'later saved attempts must not recursively embed previous full receipts');
  assert.ok(JSON.stringify(history).length < firstSize * history.length * 2,
    'a full game horizon must remain linearly serializable for saved-room recovery');
});
