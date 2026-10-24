import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';

/** Close only the actual final-priority controls. Do not bypass a response,
 * pending native decision, Stone count, casualty choice or cleanup. */
export function finishBattleOutcomeWindow(source: Game): Game {
  let game = source;
  for (let count = 0; count < 2; count++) {
    const window = game.battle?.outcomeWindow;
    if (!window || window.closed) return game;
    assert.ok(!game.response && !game.decision && !game.phaseOpening,
      'Finish the actual native control before final battle priority');
    const actor = [window.attacker, window.defender].find(id => !window.ready.includes(id));
    assert.ok(actor);
    const own = viewGame(game, actor).battle!.outcomeWindow;
    assert.ok(own && !own.closed);
    game = applyAction(game, actor, { type: 'battleOutcomeReady', event: own.event });
  }
  assert.ok(!game.battle?.outcomeWindow || game.battle.outcomeWindow.closed);
  return game;
}
