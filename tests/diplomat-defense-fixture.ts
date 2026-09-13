import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import { leaderSkillBattle } from './leader-skill-battle-fixture';

/** Genuine skill assignment and conserved battle staging; returns before sealing plans. */
export function diplomatDefenseGame(hide = false, advanced = false): Game {
  const game = leaderSkillBattle({
    skill: 'diplomat',
    unsealed: true,
    hide,
    advanced,
  });
  takeBattleCard(game, 'd', 'poison');
  takeBattleCard(game, 'd', 'snooper');
  return game;
}

export function takeBattleCard(
  game: Game,
  player: string,
  kind: Card['kind'],
): Card {
  const index = game.deck.findIndex((card) => card.kind === kind);
  assert.ok(index >= 0, `Missing fixture ${kind}`);
  const [card] = game.deck.splice(index, 1);
  game.players.find((p) => p.id === player)!.hand.push(card);
  return card;
}

export function revealDiplomatPlans(
  game: Game,
  slot: 'weapon' | 'defense' = 'defense',
): Game {
  const own = game.players[0],
    other = game.players[1];
  let next = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: game.battle!.leaderSkillHidden?.a ? 'emperor-0' : 'emperor-1',
    [slot]: own.hand.find((card) => card.kind === 'worthless')!.id,
  });
  next = applyAction(next, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
    weapon: other.hand.find((card) => card.kind === 'poison')!.id,
    defense: other.hand.find((card) => card.kind === 'snooper')!.id,
  });
  return next;
}
