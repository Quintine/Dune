import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';
import { moveSemutaEmperorCard, semutaEmperorCardId } from './fixture-semuta-emperor-share';

export const shrinePlayer = (game: Game, id: string) => game.players.find(p => p.id === id)!;
export function semutaShrineLobby(advanced = true) {
  let game = createGame('SEMUTASHRINE', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  game.discoveryEnabled = true;
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  return game;
}

/** Original ready lobby/setup and first Movement; then CONTROLLED physical
 * Shrine placement/occupation and conserved hand acquisition. Not an original
 * Discovery draw/entry journey or full-game acceptance. */
export function createControlledSemutaShrine(advanced = true) {
  let game = initializeSemutaGameForAudit(semutaShrineLobby(advanced));
  for (const position of [0, 1]) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && !card.discovery);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  for (let n = 0; n < 600; n++) {
    if (game.phase === 5 && game.active === 'g' && !game.phaseOpening && !game.response && !game.decision) break;
    const step = nextSemutaGuildIncomeNativeStep(game);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.phase, 5);
  assert.ok(!game.response && !game.decision && !game.phaseOpening);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const shrine = game.discoveries!.tokens.find(token => token.face === 'shrine')!;
  Object.assign(shrine, { status: 'placed', territory: 'gara_kulon', sector: 8, revealedTurn: game.turn });
  shrinePlayer(game, 'e').reserves--;
  shrinePlayer(game, 'e').forces['shrine:0'] = 1;
  const truth = semutaEmperorCardId(game, card => card.effect === 'truthtrance');
  const karama = semutaEmperorCardId(game, card => card.effect === 'karama');
  moveSemutaEmperorCard(game, truth, 'e');
  moveSemutaEmperorCard(game, karama, 'e');
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  return { game, truth, karama, holder: 'r', owner: 'e',
    provenance: 'CONTROLLED Shrine placement/occupation and conserved hand acquisition after genuine ready/setup/first Movement.' };
}

export function startShrineTruth(game: Game, karama: string): Game {
  game = applyAction(game, 'e', { type: 'card', card: karama, shrineTruthtrance: [karama] });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id))!;
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  const ask: Action = { type: 'truthAsk', question: { kind: 'fact', target: 'r',
    fact: { kind: 'hand', name: 'Semuta Drug' } } };
  game = applyAction(game, 'e', ask);
  return applyAction(game, 'r', { type: 'truthAnswer', answer: 'yes' });
}
