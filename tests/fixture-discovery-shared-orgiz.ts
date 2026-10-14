import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { ORGIZ_PROCESSING_STATION, quoteDiscoveryCollection } from '../game/discovery-collection';
import { putDiscovery } from './fixture-discovery';
import { nativeTypedClearBoard, nativeTypedPhase, nativeTypedPlace } from './fixture-discovery-native-typed';
import { advanceTestingStationContest } from './fixture-testing-station-contest';

export type SharedOrgizStep = { actor: string; action: Action };

/** Fresh original Ecaz/Guild/Fremen Advanced Discovery game. Only conserved
 * unplayed Spice Card order, the printed supply token, reserve-counter positions
 * and board spice already produced by real blows are controlled; every phase,
 * reveal, payment, allocation, transfer and Collection is an original action. */
export function prepareSharedOrgizCollection() {
  let game = createGame('SHAREDORGIZ', newPlayer('e', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  for (const player of game.players)
    if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  game.discoveryEnabled = true;
  const initial = structuredClone(game);
  game = initializeDiscoveryGameForAudit(game);
  game = advanceTestingStationContest(game, state => state.status === 'playing');
  const ecaz = 'e', guild = 'g', fremen = 'f';
  for (const [position, name] of ['hagga_basin', 'cielago_south', 'red_chasm', 'funeral_plain'].entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position &&
      'territory' in card && card.territory === name && !card.discovery);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = nativeTypedPhase(game, 5);
  nativeTypedClearBoard(game);
  const token = putDiscovery(game, ORGIZ_PROCESSING_STATION);
  const source = `${token.territory}:${token.sector}`;
  assert.notEqual(token.sector, game.storm);
  nativeTypedPlace(game, fremen, source, 2);
  game = nativeTypedPhase(game, 7);
  assert.ok(viewGame(game, fremen).discoveries!.canInspect.includes(token.id));
  game = applyAction(game, fremen, { type: 'discovery', token: token.id, reveal: false });
  assert.ok(viewGame(game, fremen).discoveries!.canReveal.includes(token.id));
  game = applyAction(game, fremen, { type: 'discovery', token: token.id, reveal: true });
  game = nativeTypedPhase(game, 8);
  game = nativeTypedPhase(game, 5, 2);
  nativeTypedClearBoard(game);
  // Ecaz and its Guild ally hold the same real desert territory, so the original
  // quote creates the shared lot whose allocation decides the actual recipient.
  const haggaKeys = territory('hagga_basin').sectors.filter(sector => sector !== game.storm)
    .slice(0, 2).map(sector => `hagga_basin:${sector}`);
  assert.equal(haggaKeys.length, 2);
  const untouchedKey = 'the_great_flat:15';
  nativeTypedPlace(game, fremen, `${ORGIZ_PROCESSING_STATION}:0`, 1);
  nativeTypedPlace(game, ecaz, haggaKeys[0], 1);
  nativeTypedPlace(game, guild, haggaKeys[1], 1);
  // Conserved precondition, as in the original Collection tests: the Ecaz/Guild
  // alliance exists before this Collection. The governed behavior under audit is
  // the real allocation-then-transfer sequence below, not the pact's own rules.
  game.players.find(player => player.id === ecaz)!.ally = guild;
  game.players.find(player => player.id === guild)!.ally = ecaz;
  const boardSpice = Object.values(game.spice).reduce((sum, amount) => sum + amount, 0);
  assert.ok(boardSpice >= 6);
  game.spice = { [haggaKeys[0]]: 4, [haggaKeys[1]]: 2, [untouchedKey]: boardSpice - 6 };
  const ordinary = quoteSpiceCollection(game);
  assert.equal(ordinary.shared.length, 1);
  assert.deepEqual({ ...ordinary.shared[0], amount: 0 },
    { territory: 'hagga_basin', ecaz, ally: guild, amount: 0 });
  assert.ok(ordinary.shared[0].amount > 0, 'The real shared lot must hold collected desert spice.');
  assert.deepEqual(quoteDiscoveryCollection(game, ordinary).effects, []);
  const before = structuredClone(game);
  for (const player of game.players)
    Object.assign(player, { hand: [], traitors: [], traitorChoices: [], shipped: true, moved: 1 });
  Object.assign(game, { phase: 5, active: fremen, movementRemaining: [fremen], phaseOpening: null });
  return { initial, game, before, ordinary, boardSpice, token: token.id, source,
    haggaKeys, untouchedKey, ecaz, guild, fremen };
}

/** Settle the real Collection, then answer each original Ecaz allocation prompt. */
export function settleSharedOrgiz(
  position: ReturnType<typeof prepareSharedOrgizCollection>,
  choice: { kind: 'propose'; ecazShare: number } | { kind: 'equal' } = { kind: 'equal' },
) {
  const steps: SharedOrgizStep[] = [];
  let game = applyAction(position.game, position.fremen, { type: 'endMovement' });
  steps.push({ actor: position.fremen, action: { type: 'endMovement' } });
  assert.equal(game.phase, 7);
  const event = game.ecazCollection?.event ?? null;
  assert.ok(event, 'The real Collection must own its allocation event.');
  while (game.decision?.kind === 'ecazSpice' && steps.length < 20) {
    const actor = game.decision.player;
    const allocation = actor === position.ecaz ? choice : { kind: 'accept' as const };
    const action = { type: 'decision', event: game.ecazCollection!.event, allocation } as Action;
    game = applyAction(game, game.decision.player, action);
    steps.push({ actor: position.ecaz, action });
  }
  assert.equal(game.decision, null, 'The original shared allocation must settle without inventing another choice.');
  const stable = JSON.parse(JSON.stringify(game)) as Game;
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(stable))), stable);
  return { game, steps, event, receipts: game.ecazCollection?.settled ?? [] };
}
