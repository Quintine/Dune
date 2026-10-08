import test from 'node:test';
import assert from 'node:assert/strict';
import { ecazHomeworldVictoryProgress, type EcazHomeworldVictoryProgress } from '../game/ecaz-homeworld-victory';
import { VictoryProgressError, strongholdProgress } from '../game/victory-progress';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { splitLocation } from '../game/board';
import { conserveEcazPosition, ecazHomeworldFixture, ecazSeat, observeEcazPosition } from './fixture-ecaz-homeworld-victory';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} original audit setup and conserved split holdings satisfy the printed High Ecaz condition`, () => {
    const { game, setup, movement, jointStronghold } = ecazHomeworldFixture(advanced);
    assert.equal(setup.homeworldEcazVictoryPreview, true);
    assert.equal(setup.homeworldOccupationPreview, true);
    assert.equal(movement.phase, 5);
    assert.equal(movement.response, null);
    assert.equal(movement.decision, null);
    assert.ok(!game.nexusCards);
    assert.ok(!game.techTokens && !game.strongholdCards && !game.discoveryEnabled);
    const before = JSON.stringify(game);
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.deepEqual(row, {
      owner: 'ec', members: game.order.filter(id => id === 'ec' || id === 'al'),
      population: 7, minimum: 7, high: true, jointStrongholds: [jointStronghold],
      foreignHomeworlds: [
        { world: 'homeworld:atreides', card: 'caladan', native: 'at', faction: 'atreides', holder: 'ec' },
        { world: 'homeworld:emperor', card: 'kaitain', native: 'em', faction: 'emperor', holder: 'al' },
      ],
      distinctNativeFactions: ['atreides', 'emperor'], qualifies: true, blocked: null,
    });
    assert.equal(JSON.stringify(game), before);
    assert.deepEqual(ecazHomeworldVictoryProgress(JSON.parse(before)), row);
    assert.equal(strongholdProgress(game).progress.find(row => row.player === 'ec')!.qualifies, false);
    homeworldGameIntegrity(game);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} six native Ecaz counters are Low; seven restores the independent printed win`, () => {
    const { game } = ecazHomeworldFixture(advanced);
    ecazSeat(game, 'ec').reserves = 6;
    observeEcazPosition(game, 'controlled-native-ecaz-six');
    const low = ecazHomeworldVictoryProgress(game)!;
    assert.equal(low.population, 6);
    assert.equal(low.high, false);
    assert.equal(low.qualifies, false);
    assert.equal(low.foreignHomeworlds.length, 2);
    ecazSeat(game, 'ec').reserves = 7;
    observeEcazPosition(game, 'controlled-native-ecaz-seven');
    assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
  });

  for (const holders of [['ec', 'ec'], ['al', 'al']] as const)
    void test(`${advanced ? 'Advanced' : 'Basic'} both distinct foreign worlds can be physically held by ${holders[0]}`, () => {
      const { game } = ecazHomeworldFixture(advanced, 'guild', holders);
      const row = ecazHomeworldVictoryProgress(game)!;
      assert.deepEqual(row.foreignHomeworlds.map(world => world.holder), [...holders]);
      assert.equal(row.qualifies, true);
    });

  void test(`${advanced ? 'Advanced' : 'Basic'} two worlds without one actual joint stronghold never qualify`, () => {
    const { game } = ecazHomeworldFixture(advanced);
    ecazSeat(game, 'al').forces = {};
    conserveEcazPosition(game);
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.deepEqual(row.jointStrongholds, []);
    assert.equal(row.foreignHomeworlds.length, 2);
    assert.equal(row.qualifies, false);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} a departed physical garrison is not a retained victory holding`, () => {
    const { game } = ecazHomeworldFixture(advanced);
    delete game.homeworlds!.custody!.visitors['homeworld:atreides'];
    observeEcazPosition(game, 'controlled-caladan-departure');
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.deepEqual(row.distinctNativeFactions, ['emperor']);
    assert.equal(row.qualifies, false);
    assert.equal(row.blocked, null);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} native repopulation expires the Basic holding outright while Advanced retains its original epoch`, () => {
    const { game } = ecazHomeworldFixture(advanced);
    ecazSeat(game, 'at').reserves = 20;
    observeEcazPosition(game, 'controlled-native-caladan-repopulation');
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.equal(row.qualifies, advanced);
    assert.equal(row.foreignHomeworlds.length, advanced ? 2 : 1);
    assert.equal(row.blocked, null, 'decided expiry is not an unresolved ambiguity');
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} contest removes Basic current-sole control while Advanced retains its original epoch`, () => {
    const { game } = ecazHomeworldFixture(advanced);
    game.homeworlds!.custody!.visitors['homeworld:atreides'].observer = { normal: 1, elite: 0 };
    ecazSeat(game, 'observer').reserves--;
    observeEcazPosition(game, 'controlled-third-homeworld-visitor');
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.equal(row.qualifies, advanced);
    assert.equal(row.blocked, null, 'contested presence is a decided expiry, not an ambiguity');
  });
}

void test('Emperor Kaitain and Salusa are two physical worlds of only one other native faction', () => {
  const { game } = ecazHomeworldFixture();
  delete game.homeworlds!.custody!.visitors['homeworld:atreides'];
  game.homeworlds!.custody!.visitors['homeworld:emperor:salusa'] = { ec: { normal: 1, elite: 0 } };
  observeEcazPosition(game, 'controlled-two-emperor-worlds');
  const row = ecazHomeworldVictoryProgress(game)!;
  assert.deepEqual(row.foreignHomeworlds.map(world => world.card), ['kaitain', 'salusa_secundus']);
  assert.deepEqual(row.distinctNativeFactions, ['emperor']);
  assert.equal(row.qualifies, false);
  assert.equal(row.blocked, null);
});

void test('own Ecaz and ally-native worlds are excluded rather than counted as other native factions', () => {
  const { game } = ecazHomeworldFixture();
  delete game.homeworlds!.custody!.visitors['homeworld:atreides'];
  // Deliberately hypothetical public custody, not a legal alliance action:
  // the real engine separately prohibits allies occupying each other's homes.
  game.homeworlds!.custody!.visitors['homeworld:ecaz'] = { al: { normal: 1, elite: 0 } };
  game.homeworlds!.custody!.visitors['homeworld:guild'] = { ec: { normal: 1, elite: 0 } };
  const row = ecazHomeworldVictoryProgress(game)!;
  assert.deepEqual(row.foreignHomeworlds.map(world => world.world), ['homeworld:emperor']);
  assert.deepEqual(row.distinctNativeFactions, ['emperor']);
  assert.equal(row.qualifies, false);
  assert.equal(row.blocked, null);
});

void test('joint stronghold under storm still counts; third fighters contest it and unrelated advisors do not', () => {
  const { game, jointStronghold, jointLocation } = ecazHomeworldFixture();
  game.storm = splitLocation(jointLocation).sector; // Hypothetical public-board storm, not a clock transition.
  assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
  ecazSeat(game, 'observer').forces = { [jointLocation]: 1 };
  ecazSeat(game, 'observer').reserves--;
  conserveEcazPosition(game);
  assert.deepEqual(ecazHomeworldVictoryProgress(game)!.jointStrongholds, []);
  ecazSeat(game, 'observer').advisors = { [jointStronghold]: {} };
  conserveEcazPosition(game);
  assert.deepEqual(ecazHomeworldVictoryProgress(game)!.jointStrongholds, [jointStronghold]);
  assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
});

void test('allied BG advisors are not a second joint fighter, and mandatory release cannot invent one', () => {
  const { game, jointStronghold, jointLocation } = ecazHomeworldFixture(true, 'beneGesserit');
  ecazSeat(game, 'al').advisors = { [jointStronghold]: {} };
  assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, false);
  ecazSeat(game, 'ec').forces = {};
  conserveEcazPosition(game);
  assert.equal(strongholdProgress(game).released.length, 1);
  assert.deepEqual(ecazHomeworldVictoryProgress(game)!.jointStrongholds, []);
  delete ecazSeat(game, 'al').advisors;
  ecazSeat(game, 'ec').forces = { [jointLocation]: 1 };
  conserveEcazPosition(game);
  assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
});

void test('a placed HMS is an actual joint stronghold, not an ordinary board pointer', () => {
  const { game } = ecazHomeworldFixture(true, 'ixians');
  game.mobileStronghold = { location: 'red_chasm:7' };
  for (const id of ['ec', 'al']) ecazSeat(game, id).forces = { 'hidden_mobile_stronghold:0': 1 };
  conserveEcazPosition(game);
  assert.deepEqual(ecazHomeworldVictoryProgress(game)!.jointStrongholds, ['hidden_mobile_stronghold']);
  assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
  ecazSeat(game, 'al').forces = { 'red_chasm:7': 1 };
  conserveEcazPosition(game);
  assert.deepEqual(ecazHomeworldVictoryProgress(game)!.jointStrongholds, []);
});

void test('public No-Field presence gives the same joint site for every concealed value without inventory reads', () => {
  const { game, jointLocation } = ecazHomeworldFixture(true, 'richese');
  ecazSeat(game, 'al').forces = {};
  conserveEcazPosition(game);
  let expected: EcazHomeworldVictoryProgress | null | undefined;
  for (const id of ['field-zero', 'field-three', 'field-five']) {
    const field = deployRicheseNoField(createRicheseNoField(['field-zero', 'field-three', 'field-five']), {
      tokenId: id, controller: 'al', location: splitLocation(jointLocation),
    });
    ecazSeat(game, 'al').noField = field;
    Object.defineProperty(field, 'tokens', { get() { throw new Error('Private inventory accessed'); } });
    const row = ecazHomeworldVictoryProgress(game);
    assert.equal(row!.qualifies, true);
    if (expected) assert.deepEqual(row, expected);
    expected = row;
  }
});

void test('public projection does not read hands, leaders, spice, predictions or technology income', () => {
  const { game } = ecazHomeworldFixture();
  const expected = ecazHomeworldVictoryProgress(game)!;
  for (const player of game.players)
    for (const key of ['hand', 'leaders', 'spice', 'prediction'])
      Object.defineProperty(player, key, { get() { throw new Error('Private player field accessed'); } });
  Object.defineProperty(game, 'techTokens', { get() { throw new Error('Unneeded technology accessed'); } });
  assert.deepEqual(ecazHomeworldVictoryProgress(game), expected);
});

void test('old contexts without the fresh marker return null without reserve, elite or Homeworld reads', () => {
  const { game } = ecazHomeworldFixture();
  delete game.homeworldEcazVictoryPreview;
  for (const player of game.players)
    for (const key of ['reserves', 'elites'])
      Object.defineProperty(player, key, { get() { throw new Error('Old context reserve accessed'); } });
  Object.defineProperty(game, 'homeworlds', { get() { throw new Error('Old context Homeworld accessed'); } });
  assert.equal(ecazHomeworldVictoryProgress(game), null);
});

void test('missing or legacy source history blocks a potential two-native win without creating holdings', () => {
  for (const legacy of [false, true]) {
    const { game } = ecazHomeworldFixture();
    if (legacy) delete game.homeworlds!.historyVersion;
    else delete game.homeworldOccupationHistory;
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.deepEqual(row.foreignHomeworlds, []);
    assert.deepEqual(row.distinctNativeFactions, []);
    assert.equal(row.qualifies, false);
    assert.notEqual(row.blocked, null);
    delete game.homeworlds!.custody!.visitors['homeworld:atreides'];
    assert.equal(ecazHomeworldVictoryProgress(game)!.blocked, null);
  }
});

void test('Basic current-sole control persists across turns while Advanced retains its original epoch', () => {
  for (const advanced of [false, true]) {
    const { game } = ecazHomeworldFixture(advanced);
    game.turn++;
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.equal(row.qualifies, true);
    assert.equal(row.blocked, null);
  }
});

void test('a physical unobserved new sole garrison cannot manufacture Advanced source qualification', () => {
  const { game, movement } = ecazHomeworldFixture();
  game.homeworldOccupationHistory = movement.homeworldOccupationHistory;
  const row = ecazHomeworldVictoryProgress(game)!;
  assert.equal(row.qualifies, false);
  assert.deepEqual(row.foreignHomeworlds, []);
  assert.notEqual(row.blocked, null);
});

void test('nonexistent Homeworlds, malformed public data and altered JSON source provenance reject with the victory error class', () => {
  const { game } = ecazHomeworldFixture();
  const cases = [
    (g: typeof game) => { g.homeworlds!.custody!.visitors['homeworld:nonexistent'] = { ec: { normal: 1, elite: 0 } }; },
    (g: typeof game) => { g.homeworlds!.custody!.visitors['homeworld:ecaz'] = { ec: { normal: 1, elite: 0 } }; },
    (g: typeof game) => { ecazSeat(g, 'al').ally = null; },
    (g: typeof game) => { ecazSeat(g, 'ec').reserves = -1; },
    (g: typeof game) => { g.turn = 0; },
    (g: typeof game) => { ecazSeat(g, 'ec').faction = 'harkonnen'; },
    (g: typeof game) => { g.homeworldOccupationHistory!.sources[1].cause = 'setup'; },
    (g: typeof game) => { g.homeworldOccupationHistory!.qualifications[0].player = 'observer'; },
    (g: typeof game) => { g.homeworldOccupationHistory!.snapshots[1] = '[]'; },
    (g: typeof game) => { delete g.homeworldOccupationPreview; },
  ];
  for (const mutate of cases) {
    const restored: typeof game = JSON.parse(JSON.stringify(game));
    mutate(restored);
    assert.throws(() => ecazHomeworldVictoryProgress(restored), VictoryProgressError);
  }
});
