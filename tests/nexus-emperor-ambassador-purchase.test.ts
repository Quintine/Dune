import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { createGame, handLimit, newPlayer, type Game } from '../game/engine';
import { createNexusCards, drawNexusCard } from '../game/nexus-cards';
import {
  createAmbassadors, placeAmbassador, triggerAmbassador, validateAmbassadors,
  type AmbassadorEffect,
} from '../game/ecaz-ambassadors';
import {
  EmperorNexusPurchaseError, createEmperorNexusAmbassadorPurchase,
  emperorNexusAmbassadorPurchaseModeSupported,
  quoteEmperorNexusAmbassadorPurchase, signEmperorNexusPurchase, validateEmperorNexusPurchase,
  type EmperorNexusAmbassadorPurchase,
} from '../game/nexus-emperor-purchase';

const ENTRY = 'ambassador:2:1:57';

type FixtureOptions = {
  phase?: 1 | 5;
  /** Ecaz allied with Harkonnen, so the ally would be the beneficiary. */
  ally?: boolean;
  beneficiary?: string;
  /** Ecaz keeps the concealed Emperor Nexus Secret Ally card. */
  holder?: boolean;
  spice?: number;
  fullHand?: boolean;
  supply?: number;
  /** Set false to leave the physical token unconsumed in its stronghold. */
  consumed?: boolean;
  /** The Bene Gesserit token copies the Richese effect instead of the real token. */
  copy?: boolean;
  copyChoices?: AmbassadorEffect[];
  effect?: 'atreides' | 'richese';
  entrant?: string;
  turn?: number;
};

function fixture(options: FixtureOptions = {}) {
  const g = createGame('AMBQUOTE', newPlayer('ec', 'Ecaz', 'ecaz'), false, ['ecaz']);
  g.players.push(newPlayer('at', 'Atreides', 'atreides'), newPlayer('ha', 'Harkonnen', 'harkonnen'));
  g.order = g.players.map(p => p.id);
  g.status = 'playing';
  g.turn = 2;
  g.phase = options.phase ?? 1;
  g.active = 'at';
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  g.discard = [];
  for (const player of g.players) {
    player.hand = [];
    player.spice = 10;
    player.ally = null;
    player.reserves = 20;
    player.tanks = 0;
    player.forces = {};
  }
  const ecaz = g.players[0], harkonnen = g.players[2];
  if (options.ally) {
    ecaz.ally = 'ha';
    harkonnen.ally = 'ec';
  }
  if (options.spice !== undefined) ecaz.spice = options.spice;
  if (options.fullHand) ecaz.hand = g.deck.splice(0, handLimit(ecaz));
  if (options.supply !== undefined) g.deck = g.deck.slice(0, options.supply);
  const cards = createNexusCards(g.players, () => 0);
  if ((options.holder ?? true) && !options.ally) {
    cards.deck = ['emperor', ...cards.deck.filter(card => card !== 'emperor')];
    g.nexusCards = { cards: drawNexusCard(cards, 'ec', g.players, () => 0), phase: null };
  } else g.nexusCards = { cards, phase: null };
  let state = createAmbassadors(() => 0.2);
  const effect = options.copy ? 'beneGesserit' : 'richese';
  const token = state.tokens.find(t => t.effect === effect)!;
  state.cohort = [
    token.id,
    ...state.tokens.filter(t => t.effect !== 'ecaz' && t.id !== token.id).slice(0, 4).map(t => t.id),
  ];
  for (const candidate of state.tokens) {
    candidate.zone = candidate.effect === 'ecaz' || state.cohort.includes(candidate.id) ? 'supply' : 'pool';
    candidate.location = null;
  }
  state = placeAmbassador(state, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  if (options.consumed ?? true) state = triggerAmbassador(state, token.id);
  validateAmbassadors(state);
  g.ecazAmbassadors = state;
  g.pendingAmbassador = {
    event: ENTRY,
    owner: 'ec',
    entrant: options.entrant ?? 'at',
    token: token.id,
    territory: 'arrakeen',
    sector: 10,
    turn: options.turn ?? g.turn,
    phase: g.phase,
    stage: 'purchase',
    resume: 'none',
    copyChoices: options.copyChoices ?? (options.copy ? ['richese'] : []),
    effect: options.effect ?? 'richese',
    beneficiary: options.beneficiary ?? (options.ally ? 'ha' : 'ec'),
  };
  return { g, ecaz };
}

function lobby(factions: Parameters<typeof newPlayer>[2][], expansions: string[]): Game {
  const g = createGame('AMBMODE', newPlayer(factions[0], factions[0], factions[0]), false, expansions);
  for (const faction of factions.slice(1)) g.players.push(newPlayer(faction, faction, faction));
  g.order = g.players.map(p => p.id);
  return g;
}


void test('private room, spice, supply and the concealed Nexus face only disable Use, never the Pay confirmation', () => {
  const cases: [string, FixtureOptions, string][] = [
    ['an allied buyer', { ally: true, beneficiary: 'ec' }, 'ec'],
    ['an allied beneficiary', { ally: true, beneficiary: 'ha' }, 'ha'],
    ['a buyer without the real card', { holder: false }, 'ec'],
    ['two spice', { spice: 2 }, 'ec'],
    ['a full hand', { fullHand: true }, 'ec'],
    ['an empty supply', { supply: 0 }, 'ec'],
  ];
  for (const [label, options, owner] of cases) {
    const { g } = fixture(options), before = structuredClone(g);
    const quote = quoteEmperorNexusAmbassadorPurchase(g, owner);
    assert.ok(quote.blocked, label);
    assert.deepEqual(g, before, label);
    if (options.supply !== 0) assert.throws(() => createEmperorNexusAmbassadorPurchase(g, owner, 'drawn-card'),
      EmperorNexusPurchaseError, label);
  }
  const { g } = fixture();
  g.players.push(newPlayer('em', 'Emperor', 'emperor'));
  g.order.push('em');
  assert.throws(() => quoteEmperorNexusAmbassadorPurchase(g, 'ec'), EmperorNexusPurchaseError);
});

void test('malformed original source or stale entry cannot be used to retain a purchase price', () => {
  const cases: [string, FixtureOptions, string][] = [
    ['an unconsumed token', { consumed: false }, 'ec'],
    ['a copied effect outside this cohort', { copy: true, copyChoices: [] }, 'ec'],
    ['another copied effect', { copy: true, copyChoices: ['atreides'] }, 'ec'],
    ['a different effect', { effect: 'atreides' }, 'ec'],
    ['another beneficiary', {}, 'ha'],
    ['a stale turn', { turn: 1 }, 'ec'],
    ['the buyer entering its own Ambassador', { entrant: 'ec' }, 'ec'],
  ];
  for (const [label, options, owner] of cases) {
    const { g } = fixture(options);
    assert.throws(() => quoteEmperorNexusAmbassadorPurchase(g, owner), EmperorNexusPurchaseError, label);
    assert.throws(() => createEmperorNexusAmbassadorPurchase(g, owner, 'drawn-card'), EmperorNexusPurchaseError, label);
  }
  // A copied Bene Gesserit token is a legal original source for the same price.
  assert.equal(quoteEmperorNexusAmbassadorPurchase(fixture({ copy: true }).g, 'ec').blocked, null);
});


void test('the offer keeps its supply proof before the draw and accepts the last drawn card afterwards', () => {
  const { g } = fixture({ supply: 1 });
  assert.equal(quoteEmperorNexusAmbassadorPurchase(g, 'ec').blocked, null);
  const last = g.deck[0];
  g.deck = [];
  const receipt = createEmperorNexusAmbassadorPurchase(g, 'ec', last.id);
  validateEmperorNexusPurchase(g, receipt);
  const duplicated = fixture();
  const shared = duplicated.g.deck[0];
  duplicated.g.discard.push(shared);
  assert.throws(() => createEmperorNexusAmbassadorPurchase(duplicated.g, 'ec', shared.id),
    /single physically drawn Treachery Card/);
  const undrawn = fixture();
  assert.throws(() => createEmperorNexusAmbassadorPurchase(undrawn.g, 'ec', undrawn.g.deck[0].id),
    /single physically drawn Treachery Card/);
  const later = fixture();
  later.ecaz.hand.push(later.g.deck.shift()!);
  assert.throws(() => createEmperorNexusAmbassadorPurchase(later.g, 'ec', later.ecaz.hand.at(-1)!.id),
    EmperorNexusPurchaseError);
});

void test('version three history rejects a changed trigger, price or retained balance even after re-signing', () => {
  const { g } = fixture();
  const card = g.deck[0];
  g.deck = g.deck.slice(1);
  const receipt = createEmperorNexusAmbassadorPurchase(g, 'ec', card.id);
  const invalid = (patch: Partial<EmperorNexusAmbassadorPurchase>, resign = false) => {
    const changed = { ...receipt, ...patch };
    if (resign) changed.signature = signEmperorNexusPurchase(changed);
    assert.throws(() => validateEmperorNexusPurchase(g, changed), EmperorNexusPurchaseError,
      JSON.stringify(patch));
  };
  // Every recorded field is inside the fixed signature tuple.
  for (const patch of [
    { entry: 'other-entry' }, { token: 'ambassador-1' }, { entrant: 'ha' },
    { card: 'other-card' }, { owner: 'ha' }, { price: 2 as never }, { sequence: 1 },
    { origin: 'cache' } as never, { phase: 5 as never }, { turn: 1 },
  ]) invalid(patch);
  for (const patch of [
    { version: 2 as never }, { price: 2 as never }, { price: 4 as never },
    { phase: 0 as never }, { phase: 9 as never }, { turn: 0 }, { turn: 3 },
    { beforeSpice: 2, afterSpice: 2 }, { afterSpice: 9 },
    { entrant: 'ec' }, { entry: ' ' }, { token: ' ' }, { entrant: ' ' },
    { card: ' ' }, { advanced: true },
    { round: 'round' } as never, { lot: 'lot' } as never, { seller: 'ha' } as never,
    { auctionIndex: 0 } as never, { bankSubsidy: 3 } as never,
  ]) invalid(patch, true);
});


void test('the public Ecaz envelope reuses original E3 Nexus and Skills profiles without an Emperor', () => {
  const standalone = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  standalone.nexusCards = { cards: null, phase: null };
  assert.equal(emperorNexusAmbassadorPurchaseModeSupported(standalone), true);
  // An undealt, concealed Nexus face is not part of the public mode proof.
  const skills = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  skills.nexusCards = { cards: null, phase: null };
  skills.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
  assert.equal(emperorNexusAmbassadorPurchaseModeSupported(skills), true);
  const paired = lobby(['ecaz', 'moritani', 'atreides'], ['ecaz']);
  paired.nexusCards = { cards: null, phase: null };
  assert.equal(emperorNexusAmbassadorPurchaseModeSupported(paired), true);
  const mixed = lobby(['ecaz', 'ixians', 'atreides'], ['ecaz', 'ix']);
  mixed.nexusCards = { cards: null, phase: null };
  assert.equal(emperorNexusAmbassadorPurchaseModeSupported(mixed), true);
  const withoutNexus = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  const withEmperor = lobby(['ecaz', 'emperor', 'harkonnen'], ['ecaz']);
  withEmperor.nexusCards = { cards: null, phase: null };
  const classicOnly = lobby(['atreides', 'harkonnen'], []);
  classicOnly.nexusCards = { cards: null, phase: null };
  const sandtrout = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  sandtrout.nexusCards = { cards: null, phase: null };
  sandtrout.sandtrout = true;
  const treachery = lobby(['ecaz', 'atreides', 'harkonnen'], ['ecaz']);
  treachery.nexusCards = { cards: null, phase: null };
  treachery.ecazTreachery = true;
  for (const unsupported of [withoutNexus, withEmperor, classicOnly, sandtrout, treachery])
    assert.equal(emperorNexusAmbassadorPurchaseModeSupported(unsupported), false);
});
