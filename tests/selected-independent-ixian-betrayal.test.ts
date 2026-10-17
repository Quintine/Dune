import assert from 'node:assert/strict';
import test from 'node:test';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { richeseCards } from '../game/richese-cards';
import { NEXUS_FACTIONS, type NexusPlayer } from '../game/nexus-cards';
import {
  IxianBetrayalError, closeIxianBetrayalSource, createIxianBetrayalSource,
  initialIxianBetrayalCursor, ixianBetrayalEligible, ixianBetrayalResponders,
  validateIxianBetrayalFrame, validateIxianBetrayalHistory,
  type IxianBetrayalAuthority, type IxianBetrayalContext,
  type IxianBetrayalPhysicalSelection,
} from '../game/nexus-ixian-betrayal';

function fixture(mixed = true, advanced = true): IxianBetrayalContext {
  const players: NexusPlayer[] = mixed ? [
    { id: 'ix', faction: 'ixians' }, { id: 'holder', faction: 'richese' },
    { id: 'choam', faction: 'choam' }, { id: 'tl', faction: 'tleilaxu' },
    { id: 'observer', faction: 'atreides' },
  ] : [
    { id: 'ix', faction: 'ixians' }, { id: 'holder', faction: 'atreides' },
    { id: 'observer', faction: 'tleilaxu' },
  ];
  const expansions = mixed ? ['ix', 'choam'] : ['ix'];
  return {
    status: 'playing', phase: 3, turn: 2, advanced, sequence: 0,
    expansions, ecazTreachery: true, players,
    cards: { version: 1, deck: NEXUS_FACTIONS.filter(card => card !== 'ixians' && card !== 'guild'),
      discard: [], hands: Object.fromEntries(players.map(player =>
        [player.id, player.id === 'holder' ? 'ixians' : player.id === 'observer' ? 'guild' : null])) },
    physicalCards: [...treacheryDeck(expansions), ...ecazTreacheryCards(), ...(mixed ? richeseCards() : [])],
  };
}
function authority(technology = false): IxianBetrayalAuthority {
  return { kind: technology ? 'technology' : 'bidding', provider: 'ix',
    nativeWindow: technology ? 'ixTechnology' : 'ixAuction',
    nativeContext: technology ? 'original-native-unused-card-exchange' : 'original-undrawn-native-pool',
    nativeRequired: ['observer'], nativePassed: ['observer'] };
}
function selection(ctx: IxianBetrayalContext): IxianBetrayalPhysicalSelection {
  return { expansions: ctx.expansions, ecazTreachery: ctx.ecazTreachery,
    richese: ctx.players.some(player => player.faction === 'richese') };
}

for (const mixed of [false, true]) for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} selected ${mixed ? 'Ix/CHOAM with native cache' : 'Ix'} independent inventory cancels the original native Bidding attempt`, () => {
    const ctx = fixture(mixed, advanced), before = structuredClone(ctx), native = authority();
    assert.equal(ctx.physicalCards.length, mixed ? 60 : 50);
    const source = createIxianBetrayalSource(ctx, native, 'current-native-bidding-parent');
    assert.deepEqual(source.required, ['holder', 'observer']);
    assert.equal(source.eligible, 'holder');
    assert.deepEqual(ixianBetrayalResponders(ctx.cards, ctx.players, selection(ctx)), source.required);
    assert.equal(ixianBetrayalEligible(ctx.cards, ctx.players, 'holder', selection(ctx)), true);
    validateIxianBetrayalFrame(ctx, source, native, source.parent, source.required, ['observer']);
    const closed = closeIxianBetrayalSource(source, 'use', 'holder', initialIxianBetrayalCursor());
    assert.equal(closed.receipt.outcome, 'use', 'The receipt cancels this native attempt, not a different draw or exchange.');
    assert.equal(closed.receipt.source.nativeWindow, 'ixAuction');
    assert.equal(closed.cursor.sequence, 1);
    validateIxianBetrayalHistory([closed.receipt], closed.cursor, ctx.physicalCards, selection(ctx));
    assert.deepEqual(ctx, before, 'The pure native cancellation does not deal, discard or move physical inventory.');

    // Historical cancellation survives ordinary later custody changes; the
    // caller still supplies the same public complete selected inventory.
    const recycled = structuredClone(ctx);
    recycled.cards.hands.holder = null;
    recycled.cards.discard.push('ixians');
    recycled.physicalCards = [...recycled.physicalCards].reverse();
    validateIxianBetrayalHistory([closed.receipt], closed.cursor, recycled.physicalCards, selection(recycled));
    assert.throws(() => validateIxianBetrayalFrame({ ...ctx, sequence: 1 }, source,
      native, source.parent, source.required, []), IxianBetrayalError);
  });
}

void test('a passed native draw and a later canceled Technology exchange retain distinct original selected-deck sources', () => {
  const ctx = fixture(), bidding = authority();
  const first = createIxianBetrayalSource(ctx, bidding, 'original-draw-parent');
  const passed = closeIxianBetrayalSource(first, 'pass', null, initialIxianBetrayalCursor());
  assert.equal(passed.receipt.outcome, 'pass');
  const technology = authority(true), next = { ...ctx, sequence: passed.cursor.sequence };
  const second = createIxianBetrayalSource(next, technology, 'original-technology-parent');
  const used = closeIxianBetrayalSource(second, 'use', 'holder', passed.cursor);
  assert.notEqual(second.event, first.event);
  assert.equal(used.receipt.source.nativeWindow, 'ixTechnology');
  validateIxianBetrayalHistory([passed.receipt, used.receipt], used.cursor, ctx.physicalCards, selection(ctx));
  assert.throws(() => createIxianBetrayalSource({ ...next, advanced: false }, technology,
    second.parent), IxianBetrayalError, 'Basic does not gain Advanced Technology.');
  assert.throws(() => validateIxianBetrayalFrame(next, second, bidding, first.parent,
    second.required, []), IxianBetrayalError, 'The canceled exchange cannot authorize a different native draw.');
});

void test('selected physical inventories require all three independent faces and only the actually seated native cache', () => {
  const ctx = fixture(), before = structuredClone(ctx);
  const independentIndex = ctx.physicalCards.findIndex(card => card.id === 'ecaz-recruits');
  assert.ok(independentIndex >= 0);
  const missing = ctx.physicalCards.filter((_, index) => index !== independentIndex);
  const duplicated = [...ctx.physicalCards, ctx.physicalCards[independentIndex]];
  const malformed = [...structuredClone(ctx.physicalCards)];
  malformed[independentIndex] = { ...malformed[independentIndex], name: 'Invented Recruits' };
  const missingCache = ctx.physicalCards.filter(card => !richeseCards().some(cache => cache.id === card.id));
  for (const physicalCards of [missing, duplicated, malformed, missingCache])
    assert.throws(() => createIxianBetrayalSource({ ...ctx, physicalCards }, authority(),
      'original-parent'), IxianBetrayalError);
  const ixOnly = fixture(false);
  assert.throws(() => createIxianBetrayalSource({ ...ixOnly,
    physicalCards: [...ixOnly.physicalCards, ...richeseCards()] }, authority(), 'original-parent'), IxianBetrayalError);
  assert.throws(() => createIxianBetrayalSource({ ...ctx, ecazTreachery: false }, authority(),
    'original-parent'), IxianBetrayalError, 'A physical hand cannot silently opt into the independent variant.');
  assert.deepEqual(ctx, before);
});

void test('public selected families authorize native responders without admitting unselected native seats', () => {
  const ctx = fixture();
  for (const expansions of [['choam'], ['ix', 'ix'], ['ix', 'ecaz'], []])
    assert.throws(() => createIxianBetrayalSource({ ...ctx, expansions }, authority(),
      'original-parent'), IxianBetrayalError);
  assert.throws(() => ixianBetrayalResponders(ctx.cards, ctx.players), IxianBetrayalError,
    'Omitted selection keeps the original base/Ix/Tleilaxu roster contract.');
  for (const faction of ['ecaz', 'moritani'] as const) {
    const players = ctx.players.map(player => player.id === 'holder' ? { ...player, faction } : player);
    assert.throws(() => ixianBetrayalResponders(ctx.cards, players, selection(ctx)), IxianBetrayalError);
  }
  const allied = { ...ctx, players: ctx.players.map(player => player.id === 'holder'
    ? { ...player, ally: 'observer' } : player.id === 'observer' ? { ...player, ally: 'holder' } : player) };
  assert.deepEqual(ixianBetrayalResponders(allied.cards, allied.players, selection(allied)), []);
  assert.equal(ixianBetrayalEligible(allied.cards, allied.players, 'holder', selection(allied)), false);
});

for (const mixed of [false, true]) void test(`selected E3/${mixed ? 'Ix/CHOAM cache' : 'Ix'} native responders preserve original cancellation and physical cards`, () => {
  const original = fixture(mixed);
  const expansions = [...original.expansions!, 'ecaz'];
  const players: NexusPlayer[] = [...original.players.map(player => player.id === 'observer'
    ? {...player, faction:'ecaz' as const} : player), {id:'moritani', faction:'moritani'}];
  const ctx: IxianBetrayalContext = {...original, expansions, players,
    cards:{...original.cards, hands:{...original.cards.hands, moritani:null}},
    physicalCards:[...treacheryDeck(expansions), ...ecazTreacheryCards(), ...(mixed ? richeseCards() : [])]};
  const before = structuredClone(ctx);
  const source = createIxianBetrayalSource(ctx, authority(), 'original-selected-e3-native-pool');
  assert.equal(source.eligible, 'holder');
  assert.deepEqual(ixianBetrayalResponders(ctx.cards, players, selection(ctx)), source.required);
  const closed = closeIxianBetrayalSource(source, 'use', 'holder', initialIxianBetrayalCursor());
  validateIxianBetrayalHistory([closed.receipt], closed.cursor, ctx.physicalCards, selection(ctx));
  assert.equal(ctx.physicalCards.length, mixed ? 60 : 50);
  assert.deepEqual(ctx, before, 'Neither the native E3 presence nor cancellation changes the selected catalogue.');
  assert.throws(() => createIxianBetrayalSource({...ctx, ecazTreachery:false}, authority(),
    source.parent), IxianBetrayalError, 'This new selected E3 lane requires its real independent-card selection.');
});

void test('omitted selection preserves original Ix47 source and receipt grammar and rejects silent new card inventory', () => {
  const selected = fixture(false), ctx = { ...selected, physicalCards: treacheryDeck(['ix']) };
  delete ctx.expansions;
  delete ctx.ecazTreachery;
  const native = authority(), source = createIxianBetrayalSource(ctx, native, 'legacy-parent');
  const explicit = createIxianBetrayalSource({ ...ctx, expansions: ['ix'], ecazTreachery: false },
    native, 'legacy-parent');
  assert.deepEqual(explicit, source, 'Public configuration adds no unconditional receipt fields or signature changes.');
  const closed = closeIxianBetrayalSource(source, 'use', 'holder', initialIxianBetrayalCursor());
  validateIxianBetrayalHistory([closed.receipt], closed.cursor, ctx.physicalCards);
  assert.throws(() => validateIxianBetrayalHistory([closed.receipt], closed.cursor,
    selected.physicalCards), IxianBetrayalError);
  validateIxianBetrayalHistory([closed.receipt], closed.cursor, selected.physicalCards, selection(selected));
});
