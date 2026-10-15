import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, type Card } from '../game/cards';
import { createGame, handLimit, newPlayer, type Game } from '../game/engine';
import { createNexusCards, drawNexusCard } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import {
  EmperorNexusPurchaseError, createEmperorNexusSpecialPurchase,
  quoteEmperorNexusSpecialPurchase, signEmperorNexusPurchase, validateEmperorNexusPurchase,
  type EmperorNexusSpecialPurchase,
} from '../game/nexus-emperor-purchase';

function holdEmperor(g: Game, owner = 'r') {
  const cards = createNexusCards(g.players, () => 0);
  cards.deck = ['emperor', ...cards.deck.filter(card => card !== 'emperor')];
  g.nexusCards = { cards: drawNexusCard(cards, owner, g.players, () => 0), phase: null };
}

function original() {
  const g = createGame('SPECIALQUOTE', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'), newPlayer('c', 'CHOAM', 'choam'));
  g.order = g.players.map(player => player.id);
  g.status = 'playing';
  g.turn = 2;
  g.phase = 5;
  g.deck = baseDeck();
  g.discard = [];
  for (const player of g.players) {
    player.hand = [];
    player.spice = 3;
    player.ally = null;
  }
  const buyer = g.players[0];
  const activation = g.deck.find(card => card.effect === 'karama')!;
  g.deck = g.deck.filter(card => card.id !== activation.id);
  buyer.hand = [activation, ...g.deck.splice(0, handLimit(buyer) - 1)];
  const acquire = richeseCards()[0];
  g.richeseCache = [acquire];
  holdEmperor(g);
  return { g, buyer, activation, acquire };
}


void test('retention requires native Advanced Richese, actual unallied Emperor custody and three whole own spice', () => {
  const cases: [string, (g: Game) => void][] = [
    ['basic game', g => { g.advanced = false; }],
    ['foreign purchaser', g => { g.players[0].faction = 'atreides'; }],
    ['native Emperor seated', g => { g.players[1].faction = 'emperor'; }],
    ['allied Richese', g => { g.players[0].ally = 'h'; g.players[1].ally = 'r'; }],
    ['no dealt Nexus', g => { g.nexusCards!.cards = null; }],
    ['another physical holder', g => {
      g.nexusCards!.cards!.hands.r = null;
      g.nexusCards!.cards!.hands.h = 'emperor';
    }],
    ['a different Nexus face', g => {
      const cards = g.nexusCards!.cards!;
      cards.hands.r = 'guild';
      cards.deck = ['emperor', ...cards.deck.filter(card => card !== 'guild')];
    }],
    ['duplicated Emperor Nexus', g => { g.nexusCards!.cards!.discard.push('emperor'); }],
    ['only two own spice despite aid', g => {
      g.players[0].spice = 2;
      g.aid.h = { recipient: 'r', amount: 10 };
    }],
    ['fractional own spice', g => { g.players[0].spice = 3.5; }],
  ];
  for (const [label, change] of cases) {
    const { g, buyer, activation, acquire } = original();
    change(g);
    assert.ok(quoteEmperorNexusSpecialPurchase(g, buyer.id).blocked, label);
    assert.throws(() => createEmperorNexusSpecialPurchase(g, buyer.id, activation.id, acquire.id),
      EmperorNexusPurchaseError, label);
  }
});

void test('original Richese Nexus profiles compose, but unsupported full overlays cannot grant the benefit', () => {
  const single = original();
  single.g.players.pop();
  single.g.order = single.g.players.map(player => player.id);
  holdEmperor(single.g);
  single.g.homeworlds = { custody: null };
  assert.equal(quoteEmperorNexusSpecialPurchase(single.g, 'r').blocked, null);
  const mixed = original();
  mixed.g.expansions = ['choam', 'ix'];
  mixed.g.players[1].faction = 'ixians';
  holdEmperor(mixed.g);
  assert.equal(quoteEmperorNexusSpecialPurchase(mixed.g, 'r').blocked, null);
  const skills = original();
  skills.g.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
  assert.equal(quoteEmperorNexusSpecialPurchase(skills.g, 'r').blocked, null);
  for (const change of [
    (g: Game) => { g.advancedPreview = true; },
    (g: Game) => { g.ecazTreachery = true; },
    (g: Game) => { g.sandtrout = true; },
    (g: Game) => { g.nexusCards = undefined; },
    (g: Game) => { g.expansions = ['choam', 'ix', 'ecaz']; },
  ]) {
    const { g, activation, acquire } = original();
    change(g);
    assert.ok(quoteEmperorNexusSpecialPurchase(g, 'r').blocked);
    assert.throws(() => createEmperorNexusSpecialPurchase(g, 'r', activation.id, acquire.id),
      EmperorNexusPurchaseError);
  }
});

void test('both selected cards must remain physical singletons across native custody zones before commit', () => {
  const duplicate: [string, (g: Game, card: Card) => void][] = [
    ['another hand', (g, card) => { g.players[1].hand.push(card); }],
    ['deck', (g, card) => { g.deck.push(card); }],
    ['discard', (g, card) => { g.discard.push(card); }],
    ['cache', (g, card) => { g.richeseCache!.push(card); }],
    ['removed cache', (g, card) => { g.richeseRemoved = [card]; }],
    ['Ix setup stock', (g, card) => { g.ixSetupCards = [card]; }],
    ['Ix auction stock', (g, card) => { g.ixAuction = { count: 1, cards: [card] }; }],
  ];
  for (const selected of ['activation', 'acquire'] as const) {
    for (const [zone, change] of duplicate) {
      const source = original();
      change(source.g, source[selected]);
      assert.throws(() => createEmperorNexusSpecialPurchase(
        source.g, 'r', source.activation.id, source.acquire.id,
      ), /one exact native cache card/, `${selected} duplicated in ${zone}`);
    }
  }
  for (const change of [
    (g: Game) => { g.players[0].hand = []; },
    (g: Game) => { g.players[1].hand.push(...g.players[0].hand); g.players[0].hand = []; },
    (g: Game) => { g.richeseCache = []; },
    (g: Game) => { g.players[0].hand.push(g.richeseCache!.pop()!); },
    (g: Game) => { g.richeseCache![0] = { ...g.richeseCache![0], name: 'Substituted face' }; },
    (g: Game) => { g.richeseCache![0] = { ...g.richeseCache![0], id: 'invented-cache-card' }; },
  ]) {
    const { g, activation, acquire } = original();
    change(g);
    assert.throws(() => createEmperorNexusSpecialPurchase(g, 'r', activation.id, acquire.id),
      EmperorNexusPurchaseError);
  }
});

void test('historical source, financial and strict-schema corruption is rejected even when re-signed', () => {
  const { g, activation, acquire } = original();
  const receipt = createEmperorNexusSpecialPurchase(g, 'r', activation.id, acquire.id);
  const patches: Partial<EmperorNexusSpecialPurchase>[] = [
    { price: 0 as never }, { price: 2 as never }, { price: 4 as never },
    { beforeSpice: 2, afterSpice: 2 }, { beforeSpice: 3.5, afterSpice: 3.5 },
    { afterSpice: 0 }, { afterSpice: 6 },
    { phase: 0 }, { phase: 9 }, { turn: 0 }, { turn: 3 }, { sequence: -1 },
    { turn: 1 }, { phase: 3 }, { sequence: 1 },
    { owner: 'h' }, { faction: 'harkonnen' as never }, { advanced: false as never },
    { origin: 'cache' as never }, { activation: ' ' }, { activation: acquire.id },
    { card: 'invented-cache-card' }, { card: activation.id },
    { seller: 'r' } as never, { bankSubsidy: 3 } as never,
    { auctionIndex: 0 } as never, { entry: 'fabricated-ambassador' } as never,
  ];
  for (const patch of patches) {
    const changed = { ...receipt, ...patch };
    changed.signature = signEmperorNexusPurchase(changed);
    assert.throws(() => validateEmperorNexusPurchase(g, changed),
      EmperorNexusPurchaseError, JSON.stringify(patch));
  }
  g.players[1].faction = 'emperor';
  assert.throws(() => validateEmperorNexusPurchase(g, receipt), EmperorNexusPurchaseError);
  g.players[1].faction = 'harkonnen';
  g.advanced = false;
  assert.throws(() => validateEmperorNexusPurchase(g, receipt), EmperorNexusPurchaseError);
});

