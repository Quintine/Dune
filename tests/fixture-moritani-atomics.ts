import type { Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

/** A clean classic Moritani arrival; the room variant supplies authenticated IDs. */
export function atomicsFixtureGame(
  game: Game,
  ids: { moritani: string; entrant: string; ally: string },
  options: { advanced?: boolean; allied?: boolean; target?: string } = {},
) {
  const { moritani, entrant, ally } = ids;
  const owner = game.players.find(p => p.id === moritani)!;
  const incoming = game.players.find(p => p.id === entrant)!;
  const partner = game.players.find(p => p.id === ally)!;
  const target = options.target ?? 'arrakeen';
  Object.assign(game, {
    status: 'playing', phase: 5, turn: 2, storm: 18, active: entrant,
    order: [entrant, moritani, ally], deck: baseDeck(),
    movementRemaining: [entrant, moritani, ally],
  });
  for (const p of game.players)
    Object.assign(p, { hand: [], spice: 20, forces: {}, reserves: 20, tanks: 0,
      shipped: false, moved: 0 });
  if (options.allied !== false) {
    owner.ally = ally;
    partner.ally = moritani;
  }
  owner.forces = { 'carthag:11': 1 };
  owner.reserves = 19;
  partner.forces = { 'arrakeen:10': 2 };
  partner.reserves = 18;
  if (options.advanced) {
    incoming.forces = { 'arrakeen:10': 1 };
    incoming.reserves = 19;
    incoming.elites = {
      reserves: 2, tanks: 0, forces: { 'arrakeen:10': 1 }, revived: 0,
    };
  }
  owner.hand = game.deck.splice(0, 4);
  if (options.allied !== false) partner.hand = game.deck.splice(0, 4);
  game.moritaniTerror = createTerrorState(() => 0.2);
  const token = game.moritaniTerror.tokens.find(row => row.kind === 'atomics')!;
  game.moritaniTerror = placeTerror(game.moritaniTerror, token.id, target, 1);
  return { game, token: token.id };
}
