import assert from 'node:assert/strict';
import {applyAction, viewGame, type Action, type Game} from '../game/engine';
import {harassWithdrawGame} from './fixture-harass-withdraw';
import {stoneHarassCustody, takeStoneHarassCard, STONE_CARD, MIRROR_CARD} from './fixture-stone-harass';
import {finishOccupyCardsAftermath} from './fixture-ecaz-occupy-cards';

export const IX_TOOTH = 'ix-poison-tooth';
export type IxRevealedCase = {
  game: Game;
  native: 'ixians' | 'tleilaxu';
  holder: 'a' | 'd';
  other: 'a' | 'd';
  kind: 'mirrorStone' | 'mirrorTooth' | 'stoneTooth';
  plans: {actor: string; action: Action}[];
};
/** Original native Ix/Richese setup and exact deck, then the upstream fixture's
 * explicit phase/board staging. Actual chooseBattle owns every battle control;
 * this is a conserved rule fixture, not an unstaged complete-game claim. */
export function ixRevealedWeaponFixture({advanced = false, native = 'ixians', holder = 'a',
  kind = 'mirrorStone'}: {advanced?: boolean; native?: 'ixians' | 'tleilaxu';
    holder?: 'a' | 'd'; kind?: IxRevealedCase['kind']} = {}): IxRevealedCase {
  const game = harassWithdrawGame({advanced, factions: [native, 'atreides', 'richese'],
    normal: native === 'ixians' ? 2 : 4, elite: native === 'ixians' ? 2 : 0,
    territory: 'shield_wall', sector: 8});
  for (const player of game.players) {
    game.deck.push(...player.hand);
    player.hand = [];
  }
  const other = holder === 'a' ? 'd' : 'a';
  const holderCard = kind === 'stoneTooth' ? STONE_CARD : MIRROR_CARD;
  const sourceCard = kind === 'mirrorStone' ? STONE_CARD : IX_TOOTH;
  takeStoneHarassCard(game, holder, holderCard);
  takeStoneHarassCard(game, other, sourceCard);
  const plans = (['a', 'd'] as const).map(actor => ({actor, action: {
    // Full ordinary commitment remains preflight-safe against every opposing
    // mixed Ix allocation; a hidden already-sealed zero dial is not a shortcut.
    type: 'battlePlan', dial: actor === 'a' ? 0 : 5,
    support: advanced && actor === 'd' ? 5 : 0,
    leader: game.players.find(player => player.id === actor)!.leaders[0].id,
    weapon: actor === holder ? holderCard : sourceCard,
  } satisfies Action}));
  stoneHarassCustody(game);
  return {game, native, holder, other, kind, plans};
}
export function revealIxWeapons(source: IxRevealedCase): Game {
  let game = source.game;
  for (const {actor, action} of source.plans) game = applyAction(game, actor, action);
  assert.equal(game.battle?.revealed, true);
  return game;
}
export function finishIxWeaponBattle(state: Game): Game {
  let game = state;
  assert.equal(game.decision, null, 'All native reveal choices must precede traitor calls.');
  for (const id of viewGame(game, 'a').battle!.traitorVoters)
    game = applyAction(game, id, {type: 'traitorCall', call: false});
  game = finishOccupyCardsAftermath(game, {stopAtFaceDance: true});
  if (game.decision?.kind === 'faceDance') {
    game = applyAction(game, game.decision.player, {type: 'decision', reveal: false});
    game = finishOccupyCardsAftermath(game);
  }
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
  stoneHarassCustody(game);
  return game;
}
