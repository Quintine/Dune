import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, RuleError, type Game } from '../game/engine';
import { quoteVictory, VictoryQuoteError } from '../game/victory-quote';
import { strongholdProgress } from '../game/victory-progress';
import { ecazHomeworldFixture, ecazSeat, observeEcazPosition } from './fixture-ecaz-homeworld-victory';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { TERRITORIES } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function originalCollection(game: Game): Game {
  game = normalizeAutomaticGame(game);
  for (let step = 0; !(game.phase === 7 && !game.phaseOpening && !game.response && !game.decision) && step < 300; step++) {
    if (game.phaseOpening) {
      const player = game.players.find(player => !game.phaseOpening!.passed.includes(player.id))!;
      game = applyAction(game, player.id, { type: 'ready' });
    } else if (game.response) {
      const player = game.players.find(player => !game.response!.passed.includes(player.id))!;
      game = applyAction(game, player.id, { type: 'passResponse' });
    } else if (game.decision?.kind === 'homeworldOccupiedIncome') {
      const player = game.decision.player, offer = viewGame(game, player).homeworldOccupiedIncome!;
      game = applyAction(game, player, { type: 'decision', event: offer.event, world: offer.world, ownAmount: offer.amount });
    } else if (game.decision?.kind === 'guildTiming')
      game = applyAction(game, game.decision.player, { type: 'decision', take: true });
    else if (game.phase === 5 && game.active && !game.decision)
      game = applyAction(game, game.active, { type: 'endMovement' });
    else if (game.phase === 6 && !game.decision) {
      const player = game.players.find(player => !game.ready.includes(player.id))!;
      game = applyAction(game, player.id, { type: 'ready' });
    } else throw new Error('The original Collection fixture requires another supported owned choice.');
  }
  assert.equal(game.phase, 7);
  return game;
}
function originalMentat(game: Game) {
  for (const player of game.players) if (!game.ready.includes(player.id))
    game = applyAction(JSON.parse(JSON.stringify(game)), player.id, { type: 'ready' });
  assert.equal(game.phase, 8);
  return game;
}

void test('actual original Mentat awards the high Ecaz two-native-world alliance win with one joint stronghold and no ordinary point inflation', () => {
  const fixture = ecazHomeworldFixture(true);
  let game = originalCollection(fixture.game);
  const ordinary = strongholdProgress(game).progress.find(row => row.player === 'ec')!;
  assert.equal(ordinary.strongholds.length, 1); assert.equal(ordinary.jointlyOccupied.length, 1); assert.equal(ordinary.qualifies, false);
  assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
  const row = viewGame(game, 'ec').ecazHomeworldVictory!;
  assert.equal(row.population, 7); assert.equal(row.qualifies, true);
  assert.deepEqual(new Set(row.distinctNativeFactions), new Set(['atreides', 'emperor']));
  const cards = biddingPhysicalIds(game), forces = game.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves, tanks: player.tanks }));
  for (const difficulty of DIFFICULTIES) {
    let result: Game = JSON.parse(JSON.stringify(game));
    for (const player of result.players) {
      const view = viewGame(result, player.id); view.players.find(seat => seat.id === player.id)!.bot = difficulty;
      const ready = botActions(view).find(action => action.type === 'ready');
      assert.ok(ready, `${difficulty} has its original legal Collection readiness`);
      result = applyAction(result, player.id, ready);
    }
    assert.equal(result.status, 'finished');
    assert.deepEqual(new Set(result.winner), new Set(['ec', 'al']));
    assert.deepEqual(biddingPhysicalIds(result), cards);
  }
  game = originalMentat(game);
  assert.equal(game.status, 'finished'); assert.deepEqual(new Set(game.winner), new Set(['ec', 'al']));
  assert.deepEqual(biddingPhysicalIds(game), cards);
  assert.deepEqual(game.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves, tanks: player.tanks })), forces);
});

void test('native population6 does not award this win despite the same actual joint site and two occupied native factions', () => {
  const fixture = ecazHomeworldFixture(true);
  ecazSeat(fixture.game, 'ec').reserves--; ecazSeat(fixture.game, 'ec').tanks++;
  observeEcazPosition(fixture.game, 'controlled-native-six-before-original-check');
  let game = originalCollection(fixture.game);
  assert.equal(viewGame(game, 'ec').ecazHomeworldVictory!.high, false);
  game = originalMentat(game);
  assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
});

for (const predicted of ['ecaz', 'guild'] as const) void test(`actual BG prediction of ${predicted} replaces the printed Ecaz alliance win without changing public progress`, () => {
  let game = originalCollection(ecazHomeworldFixture(true).game);
  const progress = viewGame(game, 'ec').ecazHomeworldVictory!;
  ecazSeat(game, 'observer').prediction = { faction: predicted, turn: game.turn };
  assert.equal(viewGame(game, 'al').ecazHomeworldVictory!.qualifies, progress.qualifies);
  game = originalMentat(game);
  assert.deepEqual(game.winner, ['observer']); assert.equal(game.status, 'finished');
});

void test('the original winner quote unions a simultaneous ordinary side before applying private prediction', () => {
  const fixture = ecazHomeworldFixture(true);
  const game = originalCollection(fixture.game);
  // Labelled surviving native counters: a different faction holds three ordinary sites.
  const sites = TERRITORIES.filter(site => site.type === 'stronghold' &&
    site.id !== fixture.jointStronghold && !site.sectors.includes(game.storm)).slice(0, 3)
    .map(site => `${site.id}:${site.sectors[0]}`);
  assert.equal(sites.length, 3);
  const other = ecazSeat(game, 'observer');
  assert.equal(other.faction, 'beneGesserit');
  delete other.advisors; other.forces = Object.fromEntries(sites.map(site => [site, 1])); other.reserves -= 3;
  observeEcazPosition(game, 'controlled-separate-ordinary-winner');
  const quote = quoteVictory(game, game);
  assert.deepEqual(new Set(quote.winner), new Set(['ec', 'al', 'observer']));
  assert.equal(quote.ecazHomeworld?.qualifies, true);
});

void test('a wrong detached public Ecaz source cannot authorize an otherwise ordinary original victory quote', () => {
  const game = originalCollection(ecazHomeworldFixture(true).game), changed = structuredClone(game);
  changed.turn++;
  const before = structuredClone(game);
  assert.throws(() => quoteVictory(game, changed), VictoryQuoteError);
  assert.deepEqual(game, before);
  const markerless = structuredClone(game); delete markerless.homeworldEcazVictoryPreview;
  assert.deepEqual(quoteVictory(markerless).winner, []);
  assert.equal(viewGame(markerless, 'ec').ecazHomeworldVictory, null);
  const malformed = structuredClone(game); delete malformed.homeworldOccupationHistory;
  const frozen = structuredClone(malformed);
  assert.throws(() => applyAction(malformed, 'ec', { type: 'ready' }), RuleError);
  assert.deepEqual(malformed, frozen);
});
