import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, leaders, treacheryDeck } from '../game/cards';
import { NEXUS_FACTIONS, type NexusState } from '../game/nexus-cards';
import { createTraitorDeclaration } from '../game/traitor-declarations';
import { traitorDeck } from '../game/traitors';
import {
  HarkonnenBetrayalError, closeHarkonnenBetrayalSource, createHarkonnenBetrayalReplacement,
  createHarkonnenBetrayalSource, drawHarkonnenBetrayalReplacement,
  harkonnenBetrayalEligible, harkonnenBetrayalResponders, initialHarkonnenBetrayalCursor,
  validateHarkonnenBetrayalFrame, validateHarkonnenBetrayalHistory,
  validateHarkonnenBetrayalReplacement, validateHarkonnenBetrayalReplacements,
  validateHarkonnenBetrayalSource,
  type HarkonnenBetrayalAuthority, type HarkonnenBetrayalContext,
  type HarkonnenBetrayalReceipt, type HarkonnenBetrayalReplacement,
} from '../game/nexus-harkonnen-betrayal';

const parent = 'independently-produced-native-battle-parent';
function context(remote = false, face: 'harkonnen' | 'richese' = 'harkonnen'): HarkonnenBetrayalContext {
  const players: HarkonnenBetrayalContext['players'] = [
    { id: 'h', faction: 'harkonnen', ally: remote ? 'f' : null },
    { id: 'a', faction: 'atreides', ally: null },
    { id: 'e', faction: 'emperor', ally: null },
    { id: 'f', faction: 'fremen', ally: remote ? 'h' : null },
  ];
  const universe = traitorDeck(players.map(player => ({ leaders: leaders(player.faction) })));
  const custody = [
    { id: 'h', faction: 'harkonnen' as const, traitors: ['emperor-0', 'emperor-1', 'fremen-0', 'atreides-0'] },
    { id: 'a', faction: 'atreides' as const, traitors: ['harkonnen-0'] },
    { id: 'e', faction: 'emperor' as const, traitors: ['harkonnen-1'] },
    { id: 'f', faction: 'fremen' as const, traitors: ['harkonnen-2'] },
  ];
  const held = custody.flatMap(player => player.traitors);
  const otherFace = face === 'harkonnen' ? 'richese' : 'guild';
  return {
    status: 'playing', phase: 6, turn: 2, advanced: false, sequence: 0, players,
    cards: { version: 1, deck: NEXUS_FACTIONS.filter(card => card !== face && card !== otherFace),
      discard: [], hands: { h: null, a: face, e: otherFace, f: null } },
    physicalCards: baseDeck(), universe,
    traitors: { reserve: universe.filter(identity => !held.includes(identity)), players: custody },
    battle: { event: 'native-battle-0', attacker: remote ? 'f' : 'h', defender: 'e', heroLeaderIds: [],
      plans: { [remote ? 'f' : 'h']: { leader: remote ? 'fremen-1' : 'harkonnen-3' },
        e: { leader: 'emperor-0' } } },
  };
}
function authority(ctx: HarkonnenBetrayalContext): HarkonnenBetrayalAuthority {
  const remote = ctx.battle.attacker !== 'h';
  const declaration = createTraitorDeclaration({ ...ctx.battle,
    players: ctx.players.map(player => ({ ...player,
      traitors: ctx.traitors.players.find(seat => seat.id === player.id)!.traitors })),
  }, 'h');
  return { provider: 'h', declaration, nativeWindow: remote ? 'harkonnenTraitor' : 'direct',
    nativeContext: `native-allowed:${ctx.battle.event}`,
    nativeRequired: remote ? ['a', 'e'] : [], nativePassed: remote ? ['e', 'a'] : [] };
}
function closed(ctx = context(), outcome: 'pass' | 'use' = 'use') {
  const native = authority(ctx);
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  return closeHarkonnenBetrayalSource(source, outcome, outcome === 'use' ? 'a' : null,
    initialHarkonnenBetrayalCursor());
}
function later(ctx: HarkonnenBetrayalContext): HarkonnenBetrayalContext {
  const next = structuredClone(ctx);
  next.sequence++;
  next.battle.event = `native-battle-${next.sequence}`;
  next.battle.plans.e.leader = 'emperor-1';
  const hand = next.traitors.players.find(player => player.id === 'h')!.traitors;
  hand.splice(hand.indexOf('emperor-0'), 1);
  next.traitors.reserve.unshift('emperor-0');
  next.cards.hands.a = null;
  next.cards.discard.push('harkonnen');
  return next;
}
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

for (const remote of [false, true]) {
  for (const advanced of [false, true]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} ${remote ? 'allied remote' : 'personal'} call binds its canonical declaration and original allowed native source`, () => {
      const ctx = { ...context(remote), advanced }, native = authority(ctx);
      const source = createHarkonnenBetrayalSource(ctx, native, parent);
      assert.equal(source.declaration.beneficiary, remote ? 'f' : 'h');
      assert.equal(source.declaration.target, 'e');
      assert.equal(source.declaration.identity, 'emperor-0');
      validateHarkonnenBetrayalFrame(ctx, source, native, parent, ['a', 'e'], ['e']);
      const changed: HarkonnenBetrayalAuthority[] = [
        { ...native, provider: 'a' }, { ...native, nativeContext: 'different-native-attempt' },
        { ...native, nativeWindow: remote ? 'direct' : 'harkonnenTraitor' },
        { ...native, declaration: { ...native.declaration, beneficiary: 'e' } },
        { ...native, declaration: { ...native.declaration, target: 'a' } },
        { ...native, declaration: { ...native.declaration, leader: 'emperor-1' } },
        { ...native, declaration: { ...native.declaration, identity: 'emperor-1' } },
        { ...native, declaration: { ...native.declaration, voter: 'a' } },
        { ...native, declaration: { ...native.declaration, event: 'another-battle' } },
      ];
      for (const invalid of changed) {
        assert.throws(() => validateHarkonnenBetrayalSource(ctx, source, invalid, parent), HarkonnenBetrayalError);
      }
      for (const invalid of [
        { ...ctx, status: 'setup' }, { ...ctx, phase: 7 }, { ...ctx, turn: 3 },
        { ...ctx, sequence: 1 }, { ...ctx, advanced: !advanced },
      ]) {
        assert.throws(() => validateHarkonnenBetrayalSource(invalid, source, native, parent), HarkonnenBetrayalError);
      }
      assert.throws(() => validateHarkonnenBetrayalSource(ctx, source, native, 'other-parent'), HarkonnenBetrayalError);
      const kh = structuredClone(ctx);
      kh.battle.plans.e.kwisatz = true;
      assert.throws(() => createHarkonnenBetrayalSource(kh, native, parent), HarkonnenBetrayalError);
    });
  }
}

void test('remote calls require all original native passes and correct live alliance roles', () => {
  const ctx = context(true), native = authority(ctx);
  for (const patch of [
    { nativePassed: ['e'] }, { nativePassed: ['e', 'e', 'a'] },
    { nativeRequired: ['a', 'e', 'absent'], nativePassed: ['e', 'a', 'absent'] },
    { nativePassed: ['e', 'a', 'absent'] }, { nativeContext: '' },
  ]) {
    assert.throws(() => createHarkonnenBetrayalSource(ctx, { ...native, ...patch }, parent), HarkonnenBetrayalError);
  }
  const unallied = structuredClone(ctx);
  unallied.players = unallied.players.map(player => ({ ...player, ally: null }));
  assert.throws(() => createHarkonnenBetrayalSource(unallied, native, parent), HarkonnenBetrayalError);
  const personal = context(), direct = authority(personal);
  assert.throws(() => createHarkonnenBetrayalSource(personal,
    { ...direct, nativeRequired: ['a'], nativePassed: ['a'] }, parent), HarkonnenBetrayalError);
});

void test('the matched opposing leader can be a captured classic leader, not only its faction original discs', () => {
  const ctx = context();
  ctx.battle.plans.e.leader = 'fremen-0';
  const native = authority(ctx);
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  const result = closeHarkonnenBetrayalSource(source, 'use', 'a', initialHarkonnenBetrayalCursor());
  assert.equal(source.declaration.target, 'e');
  assert.equal(source.declaration.identity, 'fremen-0');
  assert.equal(createHarkonnenBetrayalReplacement(result.receipt).identity, 'fremen-0');
  validateHarkonnenBetrayalHistory([result.receipt], result.cursor, ctx.universe);
});

void test('a personal native Harkonnen defender declares the actual attacking leader', () => {
  const ctx = context();
  ctx.battle.attacker = 'e';
  ctx.battle.defender = 'h';
  const native = authority(ctx);
  native.nativeWindow = 'direct';
  native.nativeRequired = [];
  native.nativePassed = [];
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  assert.equal(source.declaration.beneficiary, 'h');
  assert.equal(source.declaration.target, 'e');
  const result = closeHarkonnenBetrayalSource(source, 'use', 'a', initialHarkonnenBetrayalCursor());
  validateHarkonnenBetrayalHistory([result.receipt], result.cursor, ctx.universe);
});

void test('public acknowledgment membership is face neutral while only the private singleton owner may Use', () => {
  const real = context(), wrong = context(false, 'richese');
  const realSource = createHarkonnenBetrayalSource(real, authority(real), parent);
  const wrongSource = createHarkonnenBetrayalSource(wrong, authority(wrong), parent);
  assert.deepEqual(harkonnenBetrayalResponders(real.cards, real.players), ['a', 'e']);
  assert.deepEqual(harkonnenBetrayalResponders(wrong.cards, wrong.players), ['a', 'e']);
  assert.deepEqual(realSource.required, wrongSource.required);
  assert.equal(realSource.event, wrongSource.event);
  assert.equal(harkonnenBetrayalEligible(real.cards, real.players, 'a'), true);
  assert.equal(harkonnenBetrayalEligible(wrong.cards, wrong.players, 'a'), false);
  for (const holder of ['h', 'e', 'f', 'absent', null]) {
    assert.throws(() => closeHarkonnenBetrayalSource(realSource, 'use', holder,
      initialHarkonnenBetrayalCursor()), HarkonnenBetrayalError);
  }
  assert.throws(() => closeHarkonnenBetrayalSource(wrongSource, 'use', 'a',
    initialHarkonnenBetrayalCursor()), HarkonnenBetrayalError);
  const pass = closeHarkonnenBetrayalSource(wrongSource, 'pass', null, initialHarkonnenBetrayalCursor());
  validateHarkonnenBetrayalHistory([pass.receipt], pass.cursor, wrong.universe);
  const allied = context();
  allied.players = allied.players.map(player => ({ ...player,
    ally: player.id === 'a' ? 'f' : player.id === 'f' ? 'a' : null }));
  assert.deepEqual(harkonnenBetrayalResponders(allied.cards, allied.players), ['e']);
  assert.equal(harkonnenBetrayalEligible(allied.cards, allied.players, 'a'), false);
  const nativeHeld = context();
  nativeHeld.cards.hands.a = null;
  nativeHeld.cards.hands.h = 'harkonnen';
  assert.equal(harkonnenBetrayalEligible(nativeHeld.cards, nativeHeld.players, 'h'), false);
  assert.deepEqual(harkonnenBetrayalResponders(nativeHeld.cards, nativeHeld.players), ['e']);
});

void test('frame rejects missing, reordered, duplicated or foreign responders and passes', () => {
  const ctx = context(), native = authority(ctx);
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  for (const [required, passed] of [
    [['a'], []], [['e', 'a'], []], [['a', 'e', 'h'], []], [['a', 'e', 'e'], []],
    [['a', 'e'], ['a', 'a']], [['a', 'e'], ['h']], [['a', 'e'], ['absent']],
  ]) {
    assert.throws(() => validateHarkonnenBetrayalFrame(ctx, source, native, parent, required, passed), HarkonnenBetrayalError);
  }
  const changed = structuredClone(ctx);
  changed.cards.hands.e = null;
  changed.cards.deck.push('richese');
  assert.throws(() => validateHarkonnenBetrayalFrame(changed, source, native, parent, ['a', 'e'], []), HarkonnenBetrayalError);
});

void test('canonical stock rejects fabricated, duplicate, missing or foreign physical cards and universes', () => {
  const ctx = context(), native = authority(ctx);
  for (const cards of [baseDeck().slice(1), [...baseDeck(), baseDeck()[0]], treacheryDeck(['ix']),
    baseDeck().map((card, index) => index === 0 ? baseDeck()[1] : card)]) {
    assert.throws(() => createHarkonnenBetrayalSource({ ...ctx, physicalCards: cards }, native, parent));
  }
  for (const patch of [{ name: 'Forged' }, { kind: 'special' }, { effect: 'fake' },
    { id: 'fake' }, { extra: 'private-copy' }]) {
    assert.throws(() => createHarkonnenBetrayalSource({ ...ctx,
      physicalCards: [Object.assign({}, ctx.physicalCards[0], patch), ...ctx.physicalCards.slice(1)] }, native, parent));
  }
  for (const universe of [ctx.universe.slice(1), [...ctx.universe, ctx.universe[0]],
    ctx.universe.map((identity, index) => index === 0 ? 'cheap-hero-traitor' : identity)]) {
    assert.throws(() => createHarkonnenBetrayalSource({ ...ctx, universe }, native, parent));
  }
  const fabricated = structuredClone(ctx);
  fabricated.universe = fabricated.universe.map(identity => identity === 'emperor-0' ? 'forged-leader' : identity);
  fabricated.traitors.players[0].traitors[0] = 'forged-leader';
  assert.throws(() => createHarkonnenBetrayalSource(fabricated, native, parent));
  for (const variant of ['missing', 'duplicate', 'foreign', 'wrongRoster'] as const) {
    const changed = structuredClone(ctx);
    if (variant === 'missing') changed.traitors.reserve.pop();
    if (variant === 'duplicate') changed.traitors.reserve.push('emperor-0');
    if (variant === 'foreign') changed.traitors.reserve[0] = 'foreign-identity';
    if (variant === 'wrongRoster') changed.traitors.players[0].id = 'absent';
    assert.throws(() => createHarkonnenBetrayalSource(changed, native, parent));
  }
});

void test('Nexus census cannot hide missing, duplicate or foreign custody behind public parity', () => {
  const variants: NexusState[] = [];
  const duplicate = context().cards; duplicate.deck.push('harkonnen'); variants.push(duplicate);
  const missing = context().cards; missing.hands.a = null; variants.push(missing);
  const extra = context().cards; extra.hands.foreign = null; variants.push(extra);
  const unknown = context().cards; Object.assign(unknown.deck, { 0: 'unprinted-face' }); variants.push(unknown);
  for (const cards of variants) {
    assert.throws(() => harkonnenBetrayalResponders(cards, context().players));
    assert.throws(() => harkonnenBetrayalEligible(cards, context().players, 'a'));
  }
  const excluded = context();
  excluded.players = excluded.players.map(player => player.id === 'f' ? { ...player, faction: 'ixians' } : player);
  assert.throws(() => createHarkonnenBetrayalSource(excluded, authority(context()), parent));
});

void test('pending source freezes current physical custody and native identity before any cost', () => {
  const ctx = context(), native = authority(ctx);
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  const transferred = structuredClone(ctx);
  transferred.traitors.players[0].traitors.shift();
  transferred.traitors.players[1].traitors.push('emperor-0');
  assert.throws(() => validateHarkonnenBetrayalSource(transferred, source, native, parent), HarkonnenBetrayalError);
  const reordered = structuredClone(ctx);
  reordered.traitors.reserve.reverse();
  assert.throws(() => validateHarkonnenBetrayalSource(reordered, source, native, parent), HarkonnenBetrayalError);
  const undeclared = structuredClone(ctx);
  undeclared.traitors.players[0].traitors.shift();
  undeclared.traitors.reserve.push('emperor-0');
  assert.throws(() => createHarkonnenBetrayalSource(undeclared, native, parent), HarkonnenBetrayalError);
  for (const patch of [
    { signature: 'forged' }, { event: 'expired' }, { identity: 'forged' },
    { provider: 'a' }, { required: ['a'] }, { eligible: 'e' }, { inventory: 'forged' },
    { parent: 'forged' }, { extra: 'client-selector' },
  ]) {
    const corrupt = Object.assign(structuredClone(source), patch);
    assert.throws(() => validateHarkonnenBetrayalSource(ctx, corrupt, native, parent), HarkonnenBetrayalError);
  }
});

void test('quotes and closure preserve frozen inputs and produce independent saved values', () => {
  const ctx = context(true), native = authority(ctx), snapshot = structuredClone({ ctx, native });
  freeze(ctx); freeze(native);
  const source = createHarkonnenBetrayalSource(ctx, native, parent);
  freeze(source);
  const cursor = initialHarkonnenBetrayalCursor(); freeze(cursor);
  const result = closeHarkonnenBetrayalSource(source, 'use', 'a', cursor);
  validateHarkonnenBetrayalFrame(ctx, source, native, parent, source.required, ['e']);
  validateHarkonnenBetrayalHistory([result.receipt], result.cursor, ctx.universe);
  assert.deepEqual({ ctx, native }, snapshot);
  assert.deepEqual(cursor, initialHarkonnenBetrayalCursor());
  assert.notEqual(result.receipt.source, source);
  assert.notEqual(result.receipt.source.declaration, source.declaration);
  assert.notEqual(result.receipt.source.battle, source.battle);
  assert.notEqual(result.receipt.source.required, source.required);
});

void test('closed cursor is independent, exactly once, and rejects forged or missing history', () => {
  const ctx = context(), native = authority(ctx), source = createHarkonnenBetrayalSource(ctx, native, parent);
  const use = closed(ctx), pass = closed(ctx, 'pass');
  assert.throws(() => closeHarkonnenBetrayalSource(source, 'use', 'a', use.cursor), HarkonnenBetrayalError);
  assert.throws(() => closeHarkonnenBetrayalSource(source, 'pass', 'a', initialHarkonnenBetrayalCursor()), HarkonnenBetrayalError);
  const next = later(ctx);
  const nextSource = createHarkonnenBetrayalSource(next, authority(next), 'next-native-parent');
  for (const cursor of [
    { sequence: 0, signature: 'forged-genesis' },
    { sequence: 1, signature: 'forged-head' },
    { sequence: 1, signature: JSON.stringify(['harkonnenBetrayalHead', use.receipt.signature, 'use', 'a']) },
    { sequence: 2, signature: use.cursor.signature },
  ]) {
    assert.throws(() => closeHarkonnenBetrayalSource(nextSource, 'pass', null, cursor), HarkonnenBetrayalError);
  }
  for (const history of [[], [use.receipt, use.receipt], [pass.receipt]]) {
    assert.throws(() => validateHarkonnenBetrayalHistory(history, use.cursor, ctx.universe), HarkonnenBetrayalError);
  }
  for (const patch of [{ previous: 'forged' }, { signature: 'forged' }, { outcome: 'pass' }, { holder: 'e' }]) {
    assert.throws(() => validateHarkonnenBetrayalHistory([Object.assign(structuredClone(use.receipt), patch)], use.cursor), HarkonnenBetrayalError);
  }
  assert.throws(() => validateHarkonnenBetrayalHistory([use.receipt], { ...use.cursor, signature: 'forged' }), HarkonnenBetrayalError);
  assert.throws(() => validateHarkonnenBetrayalHistory([use.receipt], use.cursor, ctx.universe.slice(1)), HarkonnenBetrayalError);
});

void test('historical Use and its pending replacement survive return/recycling and later all-pass native attempts', () => {
  const ctx = context(), first = closed(ctx);
  const replacement = createHarkonnenBetrayalReplacement(first.receipt);
  const next = later(ctx), native = authority(next);
  const source = createHarkonnenBetrayalSource(next, native, 'independent-later-native-parent');
  const pass = closeHarkonnenBetrayalSource(source, 'pass', null, first.cursor);
  const history = [first.receipt, pass.receipt];
  validateHarkonnenBetrayalHistory(history, pass.cursor, next.universe);
  validateHarkonnenBetrayalReplacement(replacement, history, pass.cursor, next.universe);
  validateHarkonnenBetrayalReplacements(history, pass.cursor, [replacement], next.universe);
  assert.equal(replacement.event, first.receipt.source.event);
  assert.notEqual(replacement.event, pass.receipt.source.event);
  // A real shuffle can put the exact returned identity on top again.
  const drawn = drawHarkonnenBetrayalReplacement(replacement, history, pass.cursor,
    next.traitors.reserve[0], next.universe);
  assert.equal(drawn.drawn, replacement.identity);
  next.traitors.players[0].traitors.push(next.traitors.reserve.shift()!);
  next.cards.discard = [];
  next.cards.hands.f = 'harkonnen';
  validateHarkonnenBetrayalHistory(history, pass.cursor, next.universe);
  validateHarkonnenBetrayalReplacements(history, pass.cursor, [drawn], next.universe);
  assert.equal(drawn.status, 'drawn');
  assert.throws(() => drawHarkonnenBetrayalReplacement(drawn, history, pass.cursor, 'emperor-0'), HarkonnenBetrayalError);
  assert.equal(replacement.status, 'due');
  assert.equal(replacement.drawn, null);
});

void test('each successful Use has exactly one due or actual completed canonical private draw', () => {
  const ctx = context(), use = closed(ctx), pass = closed(ctx, 'pass');
  const due = createHarkonnenBetrayalReplacement(use.receipt), history = [use.receipt];
  assert.throws(() => createHarkonnenBetrayalReplacement(pass.receipt), HarkonnenBetrayalError);
  assert.throws(() => validateHarkonnenBetrayalReplacements(history, use.cursor, []), HarkonnenBetrayalError);
  assert.throws(() => validateHarkonnenBetrayalReplacements(history, use.cursor, [due, due]), HarkonnenBetrayalError);
  assert.throws(() => validateHarkonnenBetrayalReplacements([pass.receipt], pass.cursor, [due]), HarkonnenBetrayalError);
  for (const patch of [
    { provider: 'a' }, { turn: 3 }, { event: 'another-use' }, { identity: 'emperor-1' },
    { sequence: 1 }, { receipt: pass.cursor.signature }, { signature: 'forged' },
    { status: 'drawn', drawn: null }, { status: 'due', drawn: 'emperor-0' },
    { status: 'drawn', drawn: 'forged-identity' }, { extra: 'selector' },
  ]) {
    const corrupt = Object.assign(structuredClone(due), patch);
    assert.throws(() => validateHarkonnenBetrayalReplacement(corrupt, history, use.cursor), HarkonnenBetrayalError);
  }
  assert.throws(() => drawHarkonnenBetrayalReplacement(due, history, use.cursor, 'forged-identity'), HarkonnenBetrayalError);
  freeze(due);
  const drawn = drawHarkonnenBetrayalReplacement(due, history, use.cursor, 'atreides-1');
  validateHarkonnenBetrayalReplacements(history, use.cursor, [drawn]);
  assert.equal(drawn.drawn, 'atreides-1');
});

void test('bounded prototype rejects simultaneous replacement obligations but retains multiple completed Uses', () => {
  const ctx = context(), first = closed(ctx), firstDue = createHarkonnenBetrayalReplacement(first.receipt);
  const next = later(ctx);
  next.turn = 3;
  next.cards.discard = [];
  next.cards.hands.a = 'harkonnen';
  const source = createHarkonnenBetrayalSource(next, authority(next), 'next-turn-native-parent');
  const second = closeHarkonnenBetrayalSource(source, 'use', 'a', first.cursor);
  const secondDue = createHarkonnenBetrayalReplacement(second.receipt), history = [first.receipt, second.receipt];
  assert.throws(() => validateHarkonnenBetrayalReplacements(history, second.cursor, [firstDue, secondDue]), HarkonnenBetrayalError);
  const firstDrawn = drawHarkonnenBetrayalReplacement(firstDue, history, second.cursor, 'emperor-0');
  validateHarkonnenBetrayalReplacements(history, second.cursor, [firstDrawn, secondDue]);
  const secondDrawn = drawHarkonnenBetrayalReplacement(secondDue, history, second.cursor, 'emperor-1');
  validateHarkonnenBetrayalReplacements(history, second.cursor, [firstDrawn, secondDrawn]);
  assert.throws(() => validateHarkonnenBetrayalReplacements(history, second.cursor, [secondDrawn]), HarkonnenBetrayalError);
});

void test('native attempt history serialization stays linear with nonrecursive current and previous heads', () => {
  const ctx = context(), history: HarkonnenBetrayalReceipt[] = [];
  let cursor = initialHarkonnenBetrayalCursor(), halfway = 0;
  const replacements: HarkonnenBetrayalReplacement[] = [];
  for (let sequence = 0; sequence < 80; sequence++) {
    ctx.sequence = sequence;
    ctx.battle.event = `native-battle-${sequence}`;
    const source = createHarkonnenBetrayalSource(ctx, authority(ctx), `original-native-parent-${sequence}`);
    const result = closeHarkonnenBetrayalSource(source, 'pass', null, cursor);
    history.push(result.receipt);
    cursor = result.cursor;
    if (sequence === 39) halfway = JSON.stringify(history).length;
  }
  validateHarkonnenBetrayalHistory(history, cursor, ctx.universe);
  validateHarkonnenBetrayalReplacements(history, cursor, replacements, ctx.universe);
  assert.ok(JSON.stringify(history).length < halfway * 2.1);
  assert.ok(cursor.signature.length < 400);
});
