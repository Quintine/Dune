import assert from 'node:assert/strict';
import { applyAction, initializeDiscoveryGameForAudit, viewGame, type Game } from '../game/engine';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { ORGIZ_PROCESSING_STATION, quoteDiscoveryCollection } from '../game/discovery-collection';
import { discoveryFixture, putDiscovery } from './fixture-discovery';
import { nativeTypedClearBoard, nativeTypedPhase, nativeTypedPlace, nativeTypedStep } from './fixture-discovery-native-typed';

/** Fresh original classic Discovery setup and phase controls. No phase, clock,
 * wallet, deck identity or receipt is manufactured. Only conserved unplayed
 * Spice Card order, supply-token, reserve-counter and board-spice positions are
 * controlled. Orgiz inspect/reveal and Collection are original engine actions. */
export function prepareOrgizCollection(advanced: boolean, initial?: Game) {
  let game: Game;
  if (initial) {
    assert.equal(initial.advanced, advanced);
    game = initializeDiscoveryGameForAudit({ ...structuredClone(initial), discoveryEnabled: true });
    for (let step = 0; game.status === 'setup' && step < 100; step++) game = nativeTypedStep(game);
    assert.equal(game.status, 'playing');
  } else game = discoveryFixture(advanced);
  const owner = game.players.find(player => player.faction === 'atreides')!.id;
  const payer = game.players.find(player => player.faction === 'guild')!.id;
  const supporter = game.players.find(player => player.faction === 'fremen')!.id;
  for (const [position, territory] of ['hagga_basin', 'cielago_south', 'red_chasm', 'funeral_plain'].entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position &&
      'territory' in card && card.territory === territory && !card.discovery);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = nativeTypedPhase(game, 5);
  nativeTypedClearBoard(game);
  // Conserved original supply token -> its printed placement; no reveal staged.
  const token = putDiscovery(game, ORGIZ_PROCESSING_STATION);
  const source = `${token.territory}:${token.sector}`;
  assert.notEqual(token.sector, game.storm);
  nativeTypedPlace(game, owner, source, 2);
  game = nativeTypedPhase(game, 7);
  assert.ok(viewGame(game, owner).discoveries!.canInspect.includes(token.id));
  game = applyAction(game, owner, { type: 'discovery', token: token.id, reveal: false });
  assert.ok(viewGame(game, owner).discoveries!.canReveal.includes(token.id));
  game = applyAction(game, owner, { type: 'discovery', token: token.id, reveal: true });
  assert.equal(game.log.filter(entry => entry.automatic?.name === 'Orgiz Processing Station').length, 0);
  game = nativeTypedPhase(game, 8);
  game = nativeTypedPhase(game, 5, 2);
  nativeTypedClearBoard(game);
  // Conserved original reserve counters -> revealed Orgiz, three rival desert
  // sectors, own Collection, and a normal stronghold bank-income prefix.
  const haggaKeys = territory('hagga_basin').sectors.filter(sector => sector !== game.storm)
    .slice(0, 2).map(sector => `hagga_basin:${sector}`);
  assert.equal(haggaKeys.length, 2);
  const cielagoKey = `cielago_south:${territory('cielago_south').sectors.find(sector => sector !== game.storm)!}`;
  const ownKey = game.storm === 7 ? 'funeral_plain:15' : 'red_chasm:7';
  const untouchedKey = 'the_great_flat:15';
  nativeTypedPlace(game, owner, `${ORGIZ_PROCESSING_STATION}:0`, 1);
  nativeTypedPlace(game, owner, ownKey, 1);
  for (const key of [...haggaKeys, cielagoKey]) nativeTypedPlace(game, payer, key, 1);
  nativeTypedPlace(game, supporter, 'carthag:11', 1);
  assert.notEqual(game.storm, 11);
  // Relocate only actual spice already produced by original Spice Blows. Keep
  // every excess counter in an untouched deposit; do not debit a private wallet.
  const boardSpice = Object.values(game.spice).reduce((sum, amount) => sum + amount, 0);
  assert.ok(boardSpice >= 8);
  game.spice = {
    [haggaKeys[0]]: 3, [haggaKeys[1]]: 1, [cielagoKey]: 2,
    [ownKey]: 1, [untouchedKey]: boardSpice - 7,
  };
  const ordinary = quoteSpiceCollection(game);
  const discovery = quoteDiscoveryCollection(game, ordinary);
  const before = structuredClone(game);
  return { game, before, ordinary, discovery, boardSpice, owner, payer, token: token.id, source,
    haggaKeys, cielagoKey, ownKey, untouchedKey };
}

/** Continue only original pending/phase controls into the new Collection. */
export function commitOrgizCollection(state: Game): Game {
  let game = state;
  for (let step = 0; step < 100 && (game.phase !== 7 || game.phaseOpening || game.response || game.decision); step++) {
    assert.equal(game.turn, 2);
    assert.ok(game.phase === 5 || game.phase === 6 || game.phase === 7);
    game = nativeTypedStep(game);
  }
  assert.equal(game.phase, 7);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  return game;
}
