import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';

/** Controlled native Basic state adapted from truth-travel-guild-fremen:
 * Fremen and Guild have an already-formed alliance, the Fremen has one
 * physical fighter in Arrakeen and 19 in reserves, and Harkonnen owns the two
 * original Truthtrances. This deliberately does not claim genuine setup or
 * alliance provenance. The deck and force totals are physical and all later
 * card, question, answer, transport and ground-movement actions are native. */
export function createSectorGuildGuardFixture() {
  const game = createGame('SECTORGUILDGUARDS', newPlayer('a', 'Asker', 'harkonnen'), false);
  game.players.push(newPlayer('p', 'Fremen', 'fremen'), newPlayer('g', 'Guild', 'guild'));
  Object.assign(game, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'p',
    order: ['p', 'a', 'g'], movementRemaining: ['p', 'a', 'g'], deck: baseDeck(), discard: [] });
  for (const player of game.players) {
    player.hand = []; player.forces = {}; player.reserves = 20; player.spice = 10; player.traitorChoices = [];
  }
  const fremen = game.players.find(player => player.id === 'p')!, guild = game.players.find(player => player.id === 'g')!;
  fremen.forces = { 'arrakeen:10': 1 }; fremen.reserves = 19; fremen.ally = 'g'; guild.ally = 'p';
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  game.deck = game.deck.filter(card => card.effect !== 'truthtrance');
  game.players.find(player => player.id === 'a')!.hand = truths;
  const inventory = (state: Game) => [...state.deck, ...state.discard, ...state.players.flatMap(player => player.hand)]
    .map(card => card.id).sort();
  const original = inventory(game);
  assert.equal(new Set(original).size, original.length);
  const claim = { kind: 'action' as const, action: { kind: 'ship' as const, territory: 'imperial_basin', minimum: 1, sector: 9 } };
  const ship = (territory: string, sector: number): Action => ({ type: 'guildShip', from: 'reserves',
    territory, sector, amount: 1, elite: 0, allyPayment: 0 });
  const movement: Action = { type: 'move', from: 'arrakeen:10', territory: 'oh_gap', sector: 9, amount: 1 };
  return { game, target: 'p', asker: 'a', guild: 'g', truths: truths.map(card => card.id),
    claim, ship, movement, inventory, original };
}
export type SectorGuildGuardFixture = ReturnType<typeof createSectorGuildGuardFixture>;
export function bindSectorGuildGuard(f: SectorGuildGuardFixture, mixed: unknown = f.claim,
  answer: 'yes' | 'no' = 'yes'): Game {
  let game = applyAction(f.game, f.asker, { type: 'card', card: f.truths[0] });
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id));
    assert.ok(player); game = applyAction(game, player.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  game = applyAction(game, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: game.turn, mixed: structuredClone(mixed),
  } });
  return applyAction(game, f.target, { type: 'truthAnswer', answer });
}
