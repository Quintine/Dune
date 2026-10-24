import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, validateAmbassadors } from '../game/ecaz-ambassadors';
import { createDukeVidal } from '../game/duke-vidal';
import { actDukeAmbassador as act, type DukeAmbassadorStep } from './fixture-duke-ambassador';
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;

/** Controlled Advanced source, with the original actual shipment/trigger path.
 * These assigned cohort/loss facts are not earned gameplay or start proof. */
export function createControlledAmbassadorKhRepeatFixture(marker = 2, live = false) {
  const actions: DukeAmbassadorStep[] = [];
  const step = (game: Game, actor: string, action: Parameters<typeof act>[2]) => act(game, actor, action, actions);
  let game = createGame('AMBASSADORKHREPEAT', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, ['ecaz']);
  game.players.push(newPlayer('atreides', 'Atreides', 'atreides'), newPlayer('guild', 'Guild', 'guild'));
  Object.assign(game, { status: 'playing', turn: 2, phase: 5, storm: 18, active: 'guild',
    order: ['guild', 'ecaz', 'atreides'], movementRemaining: ['guild', 'ecaz', 'atreides'], deck: baseDeck() });
  for (const p of game.players) { p.hand = []; p.forces = {}; p.reserves = 20; p.spice = 12; }
  game.dukeVidal = createDukeVidal();
  const state = createAmbassadors(() => 0);
  const cohort = ['tleilaxu', ...state.tokens.map(t => t.effect).filter(e => e !== 'tleilaxu' && e !== 'ecaz')].slice(0, 5);
  state.cohort = state.tokens.filter(t => cohort.includes(t.effect)).map(t => t.id);
  for (const token of state.tokens) { token.zone = token.effect === 'ecaz' || state.cohort.includes(token.id) ? 'supply' : 'pool'; token.location = null; }
  const token = state.tokens.find(t => t.effect === 'tleilaxu')!; token.zone = 'placed'; token.location = 'arrakeen';
  validateAmbassadors(state); game.ecazAmbassadors = state;
  const p = player(game, 'atreides'); p.ally = 'ecaz'; player(game, 'ecaz').ally = p.id;
  p.revivalCycle = live ? 3 : 2; p.leaderRevived = true; p.battleLosses = 10;
  p.kwisatz = { dead: true, revivalCycle: marker, usedAt: 'imperial_basin' };
  for (const leader of p.leaders) { leader.dead = !live; leader.deaths = 3; }
  game = step(game, 'guild', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 });
  while (game.response) game = step(game, game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  if (game.decision?.kind === 'guildShipment') {
    game = step(game, game.decision.player, { type: 'decision', allow: true });
    while (game.response) game = step(game, game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  }
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  const event = game.pendingAmbassador!.event;
  game = step(game, 'ecaz', { type: 'decision', event, trigger: true, beneficiary: 'atreides', choice: 'effect' });
  return { game, event, actions, sourceActionCount: actions.length };
}
