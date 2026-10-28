import assert from 'node:assert/strict';
import test from 'node:test';
import { ecazHomeworldVictoryProgress } from '../game/ecaz-homeworld-victory';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldOccupationMarker, observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import { deployRicheseNoField, recallRicheseNoField, type NoFieldValue } from '../game/richese-no-field';
import type { Game } from '../game/engine';
import { ecazHomeworldFixture, ecazSeat } from './fixture-ecaz-homeworld-victory';

const world = 'homeworld:emperor';

/** The original fixture has native setup and a deliberately staged, conserved
 * victory position. Exchange its one physical visitor for a real hidden token;
 * no token denomination is added to the Homeworld force ledger. */
function replaceVisitorWithMarker(game: Game, value: NoFieldValue) {
  const owner = ecazSeat(game, 'al');
  const marker = owner.noField!.tokens.find(token => token.value === value)!;
  assert.deepEqual(game.homeworlds!.custody!.visitors[world].al, { normal: 1, elite: 0 });
  delete game.homeworlds!.custody!.visitors[world].al;
  delete game.homeworlds!.custody!.visitors[world];
  owner.reserves++;
  owner.noField = deployRicheseNoField(owner.noField!, {
    tokenId: marker.id, controller: owner.id, location: { homeworld: world },
  });
  observe(game, `controlled-marker-${value}`);
  return marker;
}

function observe(game: Game, event: string) {
  homeworldGameIntegrity(game);
  game.homeworldOccupationHistory = observeHomeworldOccupation(game.homeworldOccupationHistory!,
    homeworldContext(game), game.homeworlds!.custody!, game.turn, 'change', event,
    homeworldOccupationMarker(game.players));
  homeworldGameIntegrity(game);
}

function physicalInventory(game: Game) {
  const worlds = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  return Object.fromEntries(game.players.map(player => [player.id, player.reserves + player.tanks +
    Object.values(player.forces).reduce((sum, n) => sum + n, 0) + worlds
      .filter(home => home.native !== player.id)
      .reduce((sum, home) => sum + (home.forces[player.id]?.normal ?? 0) + (home.forces[player.id]?.elite ?? 0), 0)]));
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} High Ecaz victory counts an ally's concealed Homeworld marker without its value`, () => {
    const base = ecazHomeworldFixture(advanced, 'richese').game;
    const before = ecazHomeworldVictoryProgress(base)!;
    const inventory = physicalInventory(base);
    assert.equal(before.qualifies, true);
    const outcomes = ([0, 3, 5] as const).map(value => {
      const game = structuredClone(base);
      const marker = replaceVisitorWithMarker(game, value);
      const row = ecazHomeworldVictoryProgress(game)!;
      assert.equal(row.qualifies, true);
      assert.deepEqual(row.foreignHomeworlds, before.foreignHomeworlds);
      assert.equal(game.homeworlds!.custody!.visitors[world], undefined);
      assert.deepEqual(physicalInventory(game), inventory);
      assert.equal(JSON.stringify(row).includes(marker.id), false);
      return row;
    });
    assert.deepEqual(outcomes[0], outcomes[1]);
    assert.deepEqual(outcomes[1], outcomes[2]);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} High Ecaz requires a currently present marker even after prior occupation`, () => {
    const game = ecazHomeworldFixture(advanced, 'richese').game;
    const marker = replaceVisitorWithMarker(game, 3);
    assert.equal(ecazHomeworldVictoryProgress(game)!.qualifies, true);
    const owner = ecazSeat(game, 'al');
    owner.noField = recallRicheseNoField(owner.noField!, marker.id);
    observe(game, 'controlled-marker-departure');
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.equal(row.qualifies, false);
    assert.deepEqual(row.distinctNativeFactions, ['atreides']);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} an opposing World visitor contests a marker-only ally holding under native occupation rules`, () => {
    const game = ecazHomeworldFixture(advanced, 'richese').game;
    replaceVisitorWithMarker(game, 5);
    const observer = ecazSeat(game, 'observer');
    assert.ok(observer.reserves > 0);
    observer.reserves--;
    game.homeworlds!.custody!.visitors[world] = { observer: { normal: 1, elite: 0 } };
    observe(game, 'controlled-marker-contest');
    const row = ecazHomeworldVictoryProgress(game)!;
    assert.equal(row.qualifies, advanced, 'Advanced keeps its original occupation while Basic requires current sole occupation.');
    assert.equal(row.blocked, null);
  });
}
