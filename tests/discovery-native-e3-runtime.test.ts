import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer, viewGame } from '../game/engine';
import { createTechTokens } from '../game/tech-tokens';
import { nativeTypedClearBoard, nativeTypedPhase, nativeTypedPlace, nativeTypedPlayer, nativeTypedReload, nativeTypedStep } from './fixture-discovery-native-typed';
import { putDiscovery } from './fixture-discovery';
import { giveAssassinationTraitor } from './moritani-assassinate-fixture';
import { openSkillsTechBattle, nextSkillsTechBattleStep } from './fixture-skills-tech-battle';

void test('native Moritani assassination retains the actual revealed Discovery battle source and physical traitor cost', () => {
  let game = createGame('DISCASSA', newPlayer('m', 'Moritani', 'moritani'), true, ['ecaz']);
  joinGame(game, newPlayer('g', 'Guild', 'guild')); joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  for (const player of game.players) player.ready = true;
  game.discoveryEnabled = true; game.techTokens = createTechTokens();
  game = initializeDiscoveryGameForAudit(game);
  for (let n = 0; game.status === 'setup' && n < 100; n++) game = nativeTypedStep(game);
  game = nativeTypedPhase(game, 5);
  nativeTypedClearBoard(game);
  // Conserved original supply token and reserve positions; inspect/reveal,
  // clocks, battle, assassination and reward are produced by original controls.
  const token = putDiscovery(game, 'cistern');
  nativeTypedPlace(game, 'm', `${token.territory}:${token.sector}`, 2);
  game = nativeTypedPhase(game, 7);
  game = applyAction(game, 'm', { type: 'discovery', token: token.id, reveal: false });
  game = applyAction(game, 'm', { type: 'discovery', token: token.id, reveal: true });
  game = nativeTypedPhase(game, 8);
  game = nativeTypedPhase(game, 5, 2);
  nativeTypedClearBoard(game);
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  for (const id of ['m', 'g']) nativeTypedPlace(game, id, 'cistern:0', 3);
  giveAssassinationTraitor(game, 'guild-1');
  game = nativeTypedPhase(game, 6);
  game = openSkillsTechBattle(game, 'm', 'g', 'cistern');
  for (const id of [game.battle!.attacker, game.battle!.defender]) {
    const leader = id === 'g' ? 'guild-0' : nativeTypedPlayer(game, 'm').leaders[4].id;
    game = applyAction(game, id, { type: 'battlePlan', leader, dial: 0, support: 0 });
  }
  for (const id of ['m', 'g']) game = applyAction(game, id, { type: 'traitorCall', call: false });
  for (let n = 0; game.decision?.kind !== 'moritaniAssassinate' && n < 100; n++) {
    const next = nextSkillsTechBattleStep(game); game = applyAction(game, next.actor, next.action);
  }
  assert.ok(game.decision?.kind === 'moritaniAssassinate');
  assert.equal(viewGame(game, 'm').moritaniAssassinate!.pending!.territory, 'cistern');
  const spice = nativeTypedPlayer(game, 'm').spice;
  const event = game.decision.event;
  game = applyAction(nativeTypedReload(game), 'm', { type: 'decision', event, card: 'guild-1' });
  assert.equal(nativeTypedPlayer(game, 'g').leaders.find(leader => leader.id === 'guild-1')!.dead, true);
  assert.equal(nativeTypedPlayer(game, 'm').spice, spice + 3);
  assert.equal(game.moritaniAssassinate!.opportunities[0].territory, 'cistern');
  assert.equal(game.moritaniAssassinate!.opportunities[0].card, 'guild-1');
  assert.equal(game.moritaniAssassinate!.opportunities[0].stage, 'revealed');
  assert.equal(viewGame(game, 'm').moritaniAssassinate!.history[0].territory, 'cistern');
});
