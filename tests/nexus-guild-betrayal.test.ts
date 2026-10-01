import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNexusCards, discardNexusCard, type NexusPlayer, type NexusState,
} from '../game/nexus-cards';
import {
  createGuildBetrayalInvoice, createGuildBetrayalReceipt, guildBetrayalEligible,
  guildBetrayalResponders, nexusGuildBetrayalEvent, nexusGuildBetrayalSourceReceipt,
  quoteGuildBetrayalFunding, signGuildBetrayalInvoice, signGuildBetrayalReceipt,
  validateGuildBetrayalHistory, validateGuildBetrayalInvoice,
  type GuildBetrayalAuthority, type GuildBetrayalContext, type GuildBetrayalCursor,
  type GuildBetrayalInvoice, type GuildBetrayalReceipt,
} from '../game/nexus-guild-betrayal';

const players: NexusPlayer[] = [
  { id: 'holder', faction: 'atreides' },
  { id: 'guild', faction: 'guild' },
  { id: 'shipper', faction: 'emperor', ally: 'donor' },
  { id: 'donor', faction: 'harkonnen', ally: 'shipper' },
];
const context: GuildBetrayalContext = { turn: 2, players };
function cards(face: 'guild' | 'choam' = 'guild'): NexusState {
  const inventory = createNexusCards(players, () => 0.5);
  inventory.deck.splice(inventory.deck.indexOf(face), 1);
  inventory.hands.holder = face;
  return inventory;
}
function authority(patch: Partial<GuildBetrayalAuthority> = {}): GuildBetrayalAuthority {
  return {
    shipper: 'shipper', price: 8, ownSpice: 5, allyPayment: 3, allyEscrow: 6,
    donor: 'donor', source: 'reserve', sourceSignature: 'native-force-group-and-quote',
    originalReceiver: 'guild', ...patch,
  };
}
function cursor(invoice: GuildBetrayalInvoice, status: 'pending' | 'completed'): GuildBetrayalCursor {
  return { sequence: invoice.sequence, event: invoice.event, turn: invoice.turn,
    sourceSignature: invoice.sourceSignature, status };
}
function completed(invoice: GuildBetrayalInvoice, used = true): GuildBetrayalReceipt {
  return createGuildBetrayalReceipt(context, invoice, {
    recipient: used ? 'holder' : null, holderFaction: used ? 'atreides' : null,
    holderUnallied: used ? true : null, nexusDiscardIndex: used ? 4 : null,
    sourceReceipt: nexusGuildBetrayalSourceReceipt(invoice),
  });
}

void test('only the canonical unallied non-native holder of the singleton Guild card is eligible', () => {
  const inventory = cards();
  assert.equal(guildBetrayalEligible(inventory, players, 'holder'), true);
  assert.equal(guildBetrayalEligible(inventory, players, 'guild'), false);
  assert.equal(guildBetrayalEligible(inventory, players, 'outsider'), false);
  assert.equal(guildBetrayalEligible(inventory, players,
    { id: 'holder', faction: 'atreides', ally: null } as never), false);
  assert.equal(guildBetrayalEligible(cards('choam'), players, 'holder'), false);
  const absentGuild = players.map(player => player.id === 'guild'
    ? { ...player, faction: 'fremen' as const } : player);
  assert.equal(guildBetrayalEligible(inventory, absentGuild, 'holder'), false);
  const allied = players.map(player => player.id === 'holder' ? { ...player, ally: 'guild' }
    : player.id === 'guild' ? { ...player, ally: 'holder' } : player);
  assert.equal(guildBetrayalEligible(inventory, allied, 'holder'), false);
  const counterfeit = structuredClone(inventory);
  counterfeit.hands.shipper = 'guild';
  assert.throws(() => guildBetrayalEligible(counterfeit, players, 'holder'));
  assert.deepEqual(guildBetrayalResponders(inventory, players), ['holder']);
  assert.deepEqual(guildBetrayalResponders(cards('choam'), players), ['holder']);
  assert.equal(guildBetrayalEligible(discardNexusCard(inventory, 'holder', players), players, 'holder'), false);
});

void test('full original fee requires existing own funds or authorized prepaid ally escrow, never a later refund', () => {
  quoteGuildBetrayalFunding({ ...authority(), players });
  quoteGuildBetrayalFunding({ ...authority({ ownSpice: 0, allyPayment: 8, allyEscrow: 8 }), players });
  quoteGuildBetrayalFunding({ ...authority({ price: Number.MAX_SAFE_INTEGER,
    ownSpice: Number.MAX_SAFE_INTEGER, allyPayment: 0, allyEscrow: 0, donor: null }), players });
  const invalid: Partial<GuildBetrayalAuthority>[] = [
    { price: 0 }, { price: -1 }, { price: 0.5 }, { price: NaN }, { price: Infinity },
    { price: Number.MAX_SAFE_INTEGER + 1 }, { ownSpice: 4 }, { ownSpice: -1 },
    { ownSpice: Infinity }, { allyEscrow: 2 }, { allyEscrow: -1 },
    { allyPayment: 9 }, { allyPayment: -1 }, { allyPayment: 1.5 },
    { donor: 'holder' }, { donor: 'shipper' }, { donor: 'outsider' }, { donor: null },
    { allyPayment: 0 },
  ];
  for (const patch of invalid) {
    const quote = { ...authority(patch), players };
    const before = JSON.stringify(quote);
    assert.throws(() => quoteGuildBetrayalFunding(quote));
    assert.equal(JSON.stringify(quote), before);
  }
  // An unallied holder paying its own invoice cannot borrow the future receipt.
  const own = authority({ shipper: 'holder', ownSpice: 7, allyPayment: 0, allyEscrow: 0, donor: null });
  assert.throws(() => createGuildBetrayalInvoice(context, own, 1));
  const funded = createGuildBetrayalInvoice(context, { ...own, ownSpice: 8 }, 1);
  assert.equal(funded.ownPayment, 8);
  assert.equal(completed(funded).invoice.price, 8);
});

void test('a re-signed saved invoice cannot authorize its own stale price, route, payer or escrow', () => {
  for (const source of ['reserve', 'guildTransport', 'homeworld', 'junction'] as const) {
    const native = authority({ source });
    const invoice = createGuildBetrayalInvoice(context, native, 1);
    validateGuildBetrayalInvoice(context, invoice, native, 1);
    for (const patch of [
      { price: 7, ownPayment: 4 }, { sourceSignature: 'different-native-custody' },
      { source: source === 'homeworld' ? 'reserve' as const : 'homeworld' as const },
      { ownSpice: 8 }, { allyEscrow: 7 }, { originalReceiver: null },
      { shipper: 'donor' },
    ]) {
      const changed = { ...invoice, ...patch };
      changed.event = nexusGuildBetrayalEvent(changed.turn, changed.sequence, changed.shipper);
      changed.signature = signGuildBetrayalInvoice(changed);
      const before = JSON.stringify(changed);
      assert.throws(() => validateGuildBetrayalInvoice(context, changed, native, 1));
      assert.equal(JSON.stringify(changed), before);
    }
    assert.throws(() => validateGuildBetrayalInvoice({ ...context, turn: 3 }, invoice, native, 1));
    assert.throws(() => validateGuildBetrayalInvoice(context, invoice, native, 2));
    assert.throws(() => validateGuildBetrayalInvoice(context, { ...invoice, extra: true } as never, native, 1));
    const brokenAlliance = players.map(player => ({ ...player, ally: null }));
    assert.throws(() => validateGuildBetrayalInvoice({ ...context, players: brokenAlliance }, invoice, native, 1));
  }
});

void test('independent cursor rejects incomplete, orphan, stale, duplicate and foreign completed sources immutably', () => {
  const invoice = createGuildBetrayalInvoice(context, authority(), 1);
  const receipt = completed(invoice);
  const pending = cursor(invoice, 'pending');
  const settled = cursor(invoice, 'completed');
  validateGuildBetrayalHistory(context, [], pending, invoice);
  validateGuildBetrayalHistory(context, [receipt], settled, null);
  const invalid: [GuildBetrayalReceipt[], GuildBetrayalCursor, GuildBetrayalInvoice | null][] = [
    [[], pending, null], [[], settled, null], [[receipt], pending, invoice],
    [[receipt], settled, invoice], [[receipt, receipt], settled, null],
    [[receipt], { ...settled, sourceSignature: 'foreign-source' }, null],
    [[receipt], { ...settled, turn: 1 }, null],
    [[receipt], { ...settled, event: 'other-event' }, null],
    [[receipt], { ...settled, sequence: 2 }, null],
    [[receipt], { ...settled, extra: true } as never, null],
    [[], { sequence: 0, status: 'completed', event: null, turn: null, sourceSignature: null }, invoice],
  ];
  for (const [history, savedCursor, frame] of invalid) {
    const before = JSON.stringify([history, savedCursor, frame]);
    assert.throws(() => validateGuildBetrayalHistory(context, history, savedCursor, frame));
    assert.equal(JSON.stringify([history, savedCursor, frame]), before);
  }
  assert.throws(() => createGuildBetrayalReceipt({ ...context, turn: 3 }, invoice, {
    recipient: null, holderFaction: null, holderUnallied: null, nexusDiscardIndex: null,
    sourceReceipt: nexusGuildBetrayalSourceReceipt(invoice),
  }));
  for (const patch of [
    { recipient: 'guild', holderFaction: 'guild' as const },
    { recipient: 'outsider' }, { holderFaction: 'emperor' as const },
    { holderUnallied: false }, { card: null }, { nexusDiscardIndex: -1 },
    { sourceReceipt: '' }, { sourceReceipt: 'foreign-completed-source' },
  ]) {
    const corrupt = { ...receipt, ...patch };
    corrupt.signature = signGuildBetrayalReceipt(corrupt);
    assert.throws(() => validateGuildBetrayalHistory(context, [corrupt], settled, null));
  }
  assert.throws(() => validateGuildBetrayalHistory(context, [receipt], null as never, null));
});

void test('completed source facts survive later legitimate alliances, Nexus recycling and a second native invoice', () => {
  const first = createGuildBetrayalInvoice(context, authority(), 1);
  const receipt = completed(first);
  const laterPlayers = players.map(player => player.id === 'holder' ? { ...player, ally: 'guild' }
    : player.id === 'guild' ? { ...player, ally: 'holder' }
    : { ...player, ally: null });
  const later = { turn: 4, players: laterPlayers };
  const ownNative = authority({ shipper: 'shipper', price: 2, ownSpice: 2,
    allyPayment: 0, allyEscrow: 0, donor: null, source: 'homeworld',
    sourceSignature: 'later-physical-source', originalReceiver: null });
  const second = createGuildBetrayalInvoice(later, ownNative, 2);
  validateGuildBetrayalHistory(later, [receipt], cursor(second, 'pending'), second);
  const pass = createGuildBetrayalReceipt(later, second, {
    recipient: null, holderFaction: null, holderUnallied: null, nexusDiscardIndex: null,
    sourceReceipt: nexusGuildBetrayalSourceReceipt(second),
  });
  validateGuildBetrayalHistory(later, [receipt, pass], cursor(second, 'completed'), null);
  // Recycled discard position may shrink; original historic holder need not remain unallied.
  const recycled = createGuildBetrayalReceipt({ turn: 4, players }, second, {
    recipient: 'holder', holderFaction: 'atreides', holderUnallied: true, nexusDiscardIndex: 0,
    sourceReceipt: nexusGuildBetrayalSourceReceipt(second),
  });
  validateGuildBetrayalHistory(later, [receipt, recycled], cursor(second, 'completed'), null);
  assert.equal(guildBetrayalEligible(cards(), laterPlayers, 'holder'), false);
});
