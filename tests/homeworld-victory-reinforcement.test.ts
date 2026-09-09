import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import { location, territory, MOBILE_STRONGHOLD } from '../game/board';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import {
  quoteHomeworldVictoryReinforcement as quote,
  quoteHomeworldVictoryReinforcementDestination as transfer,
  type HomeworldVictoryWitness,
  type HomeworldVictoryReinforcementContext,
} from '../game/homeworld-victory-reinforcement';

function fixture(
  population = 6,
  advanced = true,
): HomeworldVictoryReinforcementContext {
  const players = [
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  ];
  players[0].reserves = population;
  players[0].forces = { 'arrakeen:10': 2 };
  return {
    advanced,
    players,
    storm: 18,
    homeworlds: {
      custody: createHomeworldCustody(homeworldContext({ advanced, players })),
    },
  };
}
const victory = (
  territory = 'arrakeen',
  result: 'normal' | 'traitor' = 'normal',
): HomeworldVictoryWitness => ({
  event: 'battle:2:1',
  turn: 2,
  player: 'a',
  territory,
  result,
});

void test('high Caladan quotes one physical native force in both rules modes and for normal or traitor victory', () => {
  for (const advanced of [false, true])
    for (const result of ['normal', 'traitor'] as const) {
      const g = fixture(6, advanced);
      const before = structuredClone(g);
      const resultQuote = quote(g, victory('arrakeen', result));
      assert.equal(resultQuote.population, 6);
      assert.equal(resultQuote.survivors, 2);
      assert.equal(resultQuote.amount, 1);
      assert.deepEqual(
        resultQuote.destinations.map((d) => d.id),
        ['arrakeen:10'],
      );
      const moved = transfer(g, victory('arrakeen', result), 'arrakeen:10');
      assert.equal(
        moved.transfer.players.find((p) => p.id === 'a')!.reserves,
        5,
      );
      assert.deepEqual(g, before);
    }
});

void test('current native threshold and surviving own forces exclude low, empty, foreign visitors and another faction’s win', () => {
  const g = fixture(5);
  g.homeworlds!.custody!.visitors['homeworld:atreides'] = {
    h: { normal: 10, elite: 0 },
  };
  g.players[1].reserves = 10;
  assert.equal(quote(g, victory()).amount, 0);
  g.players[0].reserves = 6;
  g.players[0].forces = {};
  g.players[1].forces = { 'arrakeen:10': 1 };
  assert.equal(quote(g, victory()).amount, 0);
  assert.equal(quote(g, { ...victory(), player: 'h' }).amount, 0);
  g.homeworlds = null;
  g.players[0].forces = { 'arrakeen:10': 1 };
  assert.equal(quote(g, victory()).amount, 0);
});

void test('foreign Homeworld reinforcement transfers exactly one native force to the existing victorious garrison', () => {
  const g = fixture();
  g.homeworlds!.custody!.visitors['homeworld:harkonnen'] = {
    a: { normal: 2, elite: 0 },
  };
  const witness = victory('homeworld:harkonnen');
  assert.equal(quote(g, witness).survivors, 2);
  const next = transfer(g, witness, 'homeworld:harkonnen').transfer;
  assert.equal(next.players.find((p) => p.id === 'a')!.reserves, 5);
  assert.deepEqual(next.state.visitors['homeworld:harkonnen'].a, {
    normal: 3,
    elite: 0,
  });
  assert.equal(
    g.homeworlds!.custody!.visitors['homeworld:harkonnen'].a.normal,
    2,
  );
  delete g.homeworlds!.custody!.visitors['homeworld:harkonnen'];
  assert.equal(quote(g, witness).amount, 0);
});

void test('victory on native Caladan is a physical no-op, never a newly created or revived counter', () => {
  const g = fixture();
  const before = structuredClone(g);
  const result = quote(g, victory('homeworld:atreides'));
  assert.equal(result.amount, 0);
  assert.equal(result.survivors, 6);
  assert.deepEqual(result.destinations, []);
  assert.match(result.blocked!, /already on Caladan/);
  assert.throws(() =>
    transfer(g, victory('homeworld:atreides'), 'homeworld:atreides'),
  );
  assert.deepEqual(g, before);
});

void test('permission is territorial; sector choices stay at the original battle and storm/HMS remain explicitly blocked', () => {
  const g = fixture();
  const sectors = territory('imperial_basin').sectors;
  g.players[0].forces = { [location('imperial_basin', sectors[0])]: 1 };
  g.storm = sectors[1];
  const options = quote(g, victory('imperial_basin')).destinations;
  assert.equal(options.length, sectors.length);
  assert.match(options.find((d) => d.sector === g.storm)!.blocked!, /storm/);
  assert.equal(options.find((d) => d.sector !== g.storm)!.blocked, null);
  assert.throws(() => transfer(g, victory('imperial_basin'), 'arrakeen:10'));
  g.mobileStronghold = { owner: 'h', location: 'arrakeen:10' } as NonNullable<
    HomeworldVictoryReinforcementContext['mobileStronghold']
  >;
  g.players[0].forces = { [location(MOBILE_STRONGHOLD, 0)]: 1 };
  assert.match(
    quote(g, victory(MOBILE_STRONGHOLD)).destinations[0].blocked!,
    /Hidden Mobile Stronghold/,
  );
});

void test('actual entry boundaries retain occupancy, BG Intrusion and public low-Grumman count distinctions', () => {
  const g = fixture();
  const bg = newPlayer('b', 'BG', 'beneGesserit');
  bg.forces = { 'arrakeen:10': 1 };
  bg.reserves = 19;
  g.players.push(bg);
  assert.match(quote(g, victory()).destinations[0].blocked!, /Intrusion/);
  g.players.pop();
  const moritani = newPlayer('m', 'Moritani', 'moritani');
  moritani.reserves = 8;
  g.players.push(moritani);
  let state = createTerrorState(() => 0);
  const token = state.tokens[0];
  state = placeTerror(state, token.id, 'arrakeen', 1);
  g.moritaniTerror = state;
  assert.match(quote(g, victory()).destinations[0].blocked!, /Terror/);
  moritani.reserves = 7;
  assert.equal(quote(g, victory()).destinations[0].blocked, null);
  g.players[0].ally = 'h';
  g.players[1].ally = 'a';
  g.players[1].forces = { 'arrakeen:10': 1 };
  assert.match(quote(g, victory()).destinations[0].blocked!, /ally/);
});

void test('malformed witnesses, physical forces and unknown locations reject without input mutation', () => {
  const g = fixture();
  for (const change of [
    { event: '' },
    { turn: 0 },
    { turn: NaN },
    { player: 'absent' },
    { result: 'explosion' },
    { territory: 'homeworld:missing' },
    { territory: 'arrakeen:10' },
    { extra: true },
  ]) {
    const bad = { ...victory(), ...change } as HomeworldVictoryWitness;
    const before = structuredClone(g);
    assert.throws(() => quote(g, bad));
    assert.deepEqual(g, before);
  }
  for (const count of [-1, 0.5, 21]) {
    g.players[0].forces = { 'arrakeen:10': count };
    assert.throws(() => quote(g, victory()));
  }
});

void test('public-only quoting and transfer do not read private hands, spice, Tanks or hidden No-Field size', () => {
  const g = fixture();
  const richese = newPlayer('r', 'Richese', 'richese');
  Object.defineProperty(richese, 'noField', {
    value: {
      deployed: {
        location: { territory: 'carthag', sector: 11 },
        get size() {
          throw new Error('private No-Field size');
        },
        get count() {
          throw new Error('private No-Field count');
        },
      },
    },
  });
  g.players.push(richese);
  for (const player of g.players)
    for (const key of ['hand', 'spice', 'tanks', 'traitors', 'leaders'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error(`private ${key}`);
        },
      });
  const expected = quote(g, victory());
  assert.equal(expected.amount, 1);
  Object.freeze(g.players[0].forces);
  assert.equal(
    transfer(g, victory(), 'arrakeen:10').transfer.players[0].reserves,
    5,
  );
});
