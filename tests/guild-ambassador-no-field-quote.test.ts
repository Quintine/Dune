import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { MOBILE_STRONGHOLD, TERRITORIES } from '../game/board';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import {
  GuildAmbassadorMarkerError,
  markerDestinations,
  markerOwner,
  quoteGuildAmbassadorMarker as quote,
  type GuildAmbassadorMarkerSelection,
} from '../game/guild-ambassador-no-field';

function fixture(faction: FactionId = 'ecaz', advanced = false) {
  const g = createGame('GUILDAMBMARKER', newPlayer('p', 'Recipient', faction), advanced);
  g.players.push(newPlayer('q', 'Other', 'atreides'),
    newPlayer('r', 'Supplier', faction === 'richese' ? 'ecaz' : 'richese'));
  Object.assign(g, { status: 'playing', turn: 2, phase: 5, storm: 18,
    active: 'q', order: ['p', 'q', 'r'] });
  for (const player of g.players)
    Object.assign(player, { forces: {}, reserves: 20, tanks: 0, spice: 5,
      elites: undefined, hand: [], shipped: true, moved: 2 });
  const owner = g.players.find((p) => p.faction === 'richese')!;
  owner.noField = createRicheseNoField(['token0', 'token3', 'token5']);
  owner.noFieldEvent = 'selection-event';
  if (owner.id !== 'p') {
    owner.ally = 'p';
    g.players[0].ally = owner.id;
  }
  return g;
}
function selection(extra: Partial<GuildAmbassadorMarkerSelection> = {}): GuildAmbassadorMarkerSelection {
  return { tokenId: 'token3', tokenEvent: 'selection-event',
    territory: 'sietch_tabr', sector: 14, ...extra };
}
function rejected(g: Game, chosen = selection(), checkFunds = true) {
  const before = structuredClone(g), previous = structuredClone(chosen);
  assert.throws(() => quote(g, 'p', chosen, checkFunds), GuildAmbassadorMarkerError);
  assert.deepEqual(g, before);
  assert.deepEqual(chosen, previous);
}
function priorMarker(g: Game, value: 0 | 3 | 5,
  territory = 'red_chasm', sector = 7) {
  const owner = markerOwner(g, 'p')!;
  owner.noField = deployRicheseNoField(owner.noField!, {
    tokenId: `token${value}`, controller: owner.id,
    location: { territory, sector },
  });
}

void test('native zero three and five substitute one free concealed marker with no reserve withdrawal', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 2, 20])
      for (const value of [0, 3, 5] as const) {
        const g = fixture('richese', advanced), p = g.players[0];
        p.reserves = reserves;
        p.spice = 0;
        const chosen = selection({ tokenId: `token${value}` }), before = structuredClone(g);
        const result = quote(g, 'p', chosen);
        assert.deepEqual({ ...result, marker: { ...result.marker, stateSignature: '' } }, {
          player: 'p', amount: 1, elite: 0, territory: 'sietch_tabr', sector: 14,
          advisors: false, cost: 0, allyPayment: 0,
          marker: { mode: 'own', owner: 'p', tokenId: `token${value}`,
            tokenEvent: 'selection-event', value, payer: 'p', ownerPayment: 0,
            recipientPayment: 0, stateSignature: '' },
        });
        assert.ok(result.marker.stateSignature);
        assert.deepEqual(g, before);
        assert.equal(markerOwner(g, 'p'), p);
        assert.ok(markerDestinations(g, 'p').some((to) => to.territory === 'sietch_tabr'));
      }
});

void test('allied materialization uses the exact reserve cap and rejects five actual counters instead of truncating', () => {
  for (const value of [0, 3, 5] as const)
    for (const reserves of [0, 1, 2, 3, 4, 5, 20]) {
      const g = fixture();
      g.players[0].reserves = reserves;
      const chosen = selection({ tokenId: `token${value}` });
      if (Math.min(value, reserves) > 4) {
        rejected(g, chosen);
      } else {
        const before = structuredClone(g), result = quote(g, 'p', chosen);
        assert.equal(result.amount, Math.min(value, reserves));
        assert.equal(result.marker.value, value);
        assert.equal(result.marker.mode, 'allied');
        assert.equal(result.marker.owner, 'r');
        assert.equal(result.cost, 1);
        assert.deepEqual(g, before);
      }
    }
});

void test('allied mandatory fees permit either full payer or only the exact two-spice equal split', () => {
  for (const faction of ['ecaz', 'guild'] as const)
    for (const stronghold of [false, true])
      for (const payer of ['p', 'r', 'both']) {
        const g = fixture(faction);
        // The independent grant keeps the compulsory printed transport fee,
        // including an already purchased rate or the Guild's native rate.
        Object.assign(g, { karamaShipping: { player: 'p' } });
        const chosen = selection({ payer,
          territory: stronghold ? 'sietch_tabr' : 'red_chasm',
          sector: stronghold ? 14 : 7 });
        if (stronghold && payer === 'both') {
          rejected(g, chosen);
          continue;
        }
        const result = quote(g, 'p', chosen), cost = stronghold ? 1 : 2;
        assert.equal(result.cost, cost);
        assert.equal(result.marker.ownerPayment,
          payer === 'r' ? cost : payer === 'both' ? 1 : 0);
        assert.equal(result.marker.recipientPayment,
          payer === 'p' ? cost : payer === 'both' ? 1 : 0);
        assert.equal(result.allyPayment, 0);
      }
  rejected(fixture(), selection({ payer: 'q' }));
  rejected(fixture('richese'), selection({ payer: 'r' }));
  const g = fixture();
  g.players[2].spice = 0;
  rejected(g);
  assert.equal(quote(g, 'p', selection({ payer: 'p' })).marker.recipientPayment, 1);
  g.players[0].spice = 0;
  rejected(g, selection({ payer: 'p' }));
  assert.equal(quote(g, 'p', selection({ payer: 'p' }), false).cost, 1);
  rejected(g, selection({ payer: 'r' }), false);
});

void test('allied typed reserves are selected within the real amount while native markers always have zero elites', () => {
  const g = fixture('emperor'), p = g.players[0];
  p.reserves = 4;
  p.elites = { reserves: 3, tanks: 0, forces: {}, revived: 0 };
  assert.equal(quote(g, 'p', selection()).elite, 2);
  assert.equal(quote(g, 'p', selection({ elite: 3 })).elite, 3);
  assert.equal(quote(g, 'p', selection({ tokenId: 'token5' })).elite, 3);
  for (const elite of [0, 1, 4]) rejected(g, selection({ elite }));
  assert.equal(quote(g, 'p', selection({ tokenId: 'token0' })).elite, 0);
  rejected(g, selection({ tokenId: 'token0', elite: 1 }));
  rejected(fixture('richese'), selection({ elite: 1 }));
});

void test('native prior markers require an explicit reveal and shared last-token history remains binding', () => {
  const g = fixture('richese');
  priorMarker(g, 3);
  rejected(g, selection({ tokenId: 'token5' }));
  assert.throws(() => markerDestinations(g, 'p'), GuildAmbassadorMarkerError);
  g.players[0].noField!.deployed = null;
  rejected(g, selection());
  assert.equal(quote(g, 'p', selection({ tokenId: 'token5' })).amount, 1);
  g.players[0].noField!.hiddenReturn = true;
  rejected(g, selection());
  assert.equal(quote(g, 'p', selection({ tokenId: 'token0' })).marker.value, 0);
  rejected(fixture(), selection({ tokenEvent: 'old-selection-event' }));
  rejected(fixture(), selection({ tokenId: 'unknown-token' }));
});

void test('allied prior reveal uses the supplier stock before checking actual destination occupancy', () => {
  for (const [oldValue, ownerReserves, allowed] of [
    [0, 20, true], [3, 0, true], [3, 1, false], [5, 2, false],
  ] as const) {
    const g = fixture('emperor'), owner = g.players[2];
    g.players[0].reserves = 4;
    owner.reserves = ownerReserves;
    priorMarker(g, oldValue, 'sietch_tabr', 14);
    const chosen = selection({ tokenId: oldValue === 5 ? 'token3' : 'token5' });
    if (allowed) {
      const before = structuredClone(g), result = quote(g, 'p', chosen);
      assert.equal(result.amount, 4);
      assert.ok(markerDestinations(g, 'p').some((to) => to.territory === 'sietch_tabr'));
      assert.deepEqual(g, before);
    } else {
      rejected(g, chosen);
      assert.ok(!markerDestinations(g, 'p').some((to) => to.territory === 'sietch_tabr'));
    }
    assert.equal(owner.noField!.deployed!.tokenId, `token${oldValue}`);
    assert.equal(owner.reserves, ownerReserves);
  }
  const g = fixture();
  priorMarker(g, 3);
  rejected(g); // A compulsory reveal never clears the shared last-shipped ban.
  const before = structuredClone(g);
  assert.equal(quote(g, 'p', selection({ tokenId: 'token0' })).amount, 0);
  assert.deepEqual(g, before);
});

void test('a No-Field recipient must be Richese or its current reciprocal off-planet ally', () => {
  const mutations: ((g: Game) => void)[] = [
    (g) => { g.players[0].ally = null; },
    (g) => { g.players[2].ally = null; },
    (g) => { g.players[0].ally = 'q'; },
    (g) => { g.players[0].faction = 'fremen'; },
    (g) => { g.players[2].faction = 'harkonnen'; },
  ];
  for (const mutate of mutations) {
    const g = fixture();
    mutate(g);
    rejected(g);
  }
  assert.equal(markerOwner(fixture(), 'q'), null);
  assert.equal(markerOwner(fixture(), 'missing'), null);
});

void test('printed sectors, storm, mobile-stronghold exclusion and occupying sides apply to markers', () => {
  const g = fixture('richese');
  g.mobileStronghold = { location: 'wind_pass:14' };
  g.storm = 14;
  for (const to of [
    { territory: 'sietch_tabr', sector: 14 },
    { territory: 'wind_pass', sector: 14 },
    { territory: 'sietch_tabr', sector: 15 },
    { territory: MOBILE_STRONGHOLD, sector: 0 },
    { territory: 'homeworld', sector: 0 },
    { territory: 'discovery', sector: 0 },
  ]) rejected(g, selection(to));
  assert.equal(quote(g, 'p', selection({ territory: 'wind_pass', sector: 15 })).amount, 1);
  assert.equal(quote(g, 'p', selection({ territory: 'polar_sink', sector: 0 })).amount, 1);
  assert.ok(markerDestinations(g, 'p').every((to) =>
    to.sector !== 14 && to.territory !== MOBILE_STRONGHOLD));
  g.storm = 18;
  g.players[1].forces = { 'sietch_tabr:14': 1 };
  g.players[2].forces = { 'sietch_tabr:14': 1 };
  rejected(g);
});

void test('native Ecaz co-occupation and existing Bene Gesserit advisor stance retain shared entry rules', () => {
  const g = fixture();
  priorMarker(g, 3, 'sietch_tabr', 14);
  g.players[1].forces = { 'sietch_tabr:14': 1 };
  assert.equal(quote(g, 'p', selection({ tokenId: 'token0' })).advisors, false);
  const bg = fixture('beneGesserit', true);
  bg.players[0].forces = { 'sietch_tabr:14': 1 };
  bg.players[0].advisors = { sietch_tabr: { lockedTurn: bg.turn } };
  bg.players[1].forces = { 'sietch_tabr:14': 1 };
  bg.players[2].forces = { 'sietch_tabr:14': 1 };
  assert.equal(quote(bg, 'p', selection()).advisors, true);
  bg.advanced = false;
  rejected(bg);
});

void test('malformed physical marker or typed custody and malformed selections reject without mutation', () => {
  const mutations: ((g: Game) => void)[] = [
    (g) => { g.players[0].reserves = -1; },
    (g) => { g.players[2].reserves = NaN; },
    (g) => { g.players[0].elites = { reserves: 21, tanks: 0, forces: {}, revived: 0 }; },
    (g) => { g.players[1].forces = { 'unknown:0': 1 }; },
    (g) => { g.players[1].forces = { 'red_chasm:7': -1 }; },
    (g) => { g.players[1].elites = { reserves: 0, tanks: 0, revived: 0,
      forces: { 'red_chasm:7': 1 } }; },
    (g) => { g.players[2].noField!.tokens[0].id = 'token3'; },
    (g) => { g.players[2].noFieldEvent = ''; },
    (g) => { priorMarker(g, 0); g.players[2].noField!.deployed!.controller = 'p'; },
    (g) => { g.players[0].forces = { 'sietch_tabr:14': Number.MAX_SAFE_INTEGER }; },
    (g) => { g.storm = 19; },
  ];
  for (const mutate of mutations) {
    const g = fixture();
    mutate(g);
    rejected(g);
  }
  for (const extra of [
    { tokenId: null }, { tokenEvent: 1 }, { sector: 1.5 }, { payer: '' },
    { elite: -1 }, { elite: NaN }, { elite: '0' },
  ]) rejected(fixture(), { ...selection(), ...extra } as unknown as GuildAmbassadorMarkerSelection);
});

void test('quotes and destination choices never consult cards RNG or an unchecked recipient balance', () => {
  const g = fixture(), chosen = selection({ payer: 'p' });
  priorMarker(g, 0);
  const expected = quote(g, 'p', chosen, false), destinations = markerDestinations(g, 'p');
  for (const player of g.players)
    for (const key of ['hand', 'leaders', 'traitors'])
      Object.defineProperty(player, key, { get() { throw new Error(`private ${key}`); } });
  Object.defineProperty(g.players[0], 'spice', {
    get() { throw new Error('unchecked private recipient balance'); },
  });
  for (const key of ['deck', 'discard', 'aid'])
    Object.defineProperty(g, key, { get() { throw new Error(`unneeded ${key}`); } });
  const random = Math.random;
  Math.random = () => { throw new Error('unexpected RNG'); };
  try {
    assert.deepEqual(quote(g, 'p', chosen, false), expected);
    assert.deepEqual(markerDestinations(g, 'p'), destinations);
  } finally {
    Math.random = random;
  }
});

void test('the destination domain remains finite and every zero-reserve native choice has a quote witness', () => {
  const g = fixture('richese');
  g.players[0].reserves = 0;
  const before = structuredClone(g), choices = markerDestinations(g, 'p');
  assert.ok(choices.length > 0);
  assert.equal(new Set(choices.map((to) => `${to.territory}:${to.sector}`)).size, choices.length);
  assert.ok(choices.length <= TERRITORIES.flatMap((to) => to.sectors).length);
  for (const to of choices) {
    const result = quote(g, 'p', selection({ ...to, tokenId: 'token0' }));
    assert.equal(result.amount, 1);
    assert.equal(result.advisors, to.advisors);
  }
  const signature = quote(g, 'p', selection()).marker.stateSignature;
  assert.equal(quote(g, 'p', selection()).marker.stateSignature, signature);
  g.players[1].forces = { 'red_chasm:7': 1 };
  assert.notEqual(quote(g, 'p', selection()).marker.stateSignature, signature);
  g.players[1].forces = {};
  assert.deepEqual(g, before);
  choices.length = 0;
  assert.ok(markerDestinations(g, 'p').length > 0);
});
