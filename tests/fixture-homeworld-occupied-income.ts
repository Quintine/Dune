import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldOccupationGameForAudit, joinGame,
  newPlayer, viewGame, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { FACTIONS, type FactionId } from '../game/catalog';
import { HOMEWORLD_CARDS, type HomeworldId } from '../game/homeworld-cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { observeHomeworldOccupation } from '../game/homeworld-occupation-history';

/** Original selected decks, fresh Homeworld occupation audit setup and real
 * setup actions. Only the later Collection positions/alliance are controlled
 * test positions; the original history observes them, not fabricated facts. */
export function occupiedIncomeFixture(cardId: HomeworldId = 'caladan', advanced = false, allied = true) {
  const card = HOMEWORLD_CARDS.find(card => card.id === cardId)!;
  const nativeFaction = card.faction;
  const used = [nativeFaction];
  const choose = (choices: FactionId[]) => {
    const faction = choices.find(faction => !used.includes(faction))!;
    used.push(faction);
    return faction;
  };
  const factions = [nativeFaction, choose(['guild', 'atreides']),
    choose(['harkonnen', 'emperor']), choose(['fremen', 'beneGesserit'])];
  const expansion = FACTIONS.find(faction => faction.id === nativeFaction)!.expansion;
  let game = createGame('OCCUPIEDINCOME', newPlayer('native', 'Native', nativeFaction), advanced,
    expansion === 'base' ? [] : [expansion]);
  for (const [index, faction] of factions.slice(1).entries())
    joinGame(game, newPlayer(['owner', 'ally', 'competitor'][index], faction, faction));
  game = applyAction(game, 'native', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 120; step++) {
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(game, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Original setup must make progress.');
    game = next;
  }
  assert.equal(game.status, 'playing');
  const setup = structuredClone(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  // Controlled, conserved placement. Do not discard/deal or reset card IDs.
  for (const player of game.players) {
    Object.assign(player, { forces: {}, reserves: 20, tanks: 0, ally: null });
    if (player.elites) Object.assign(player.elites, {
      reserves: player.faction === 'fremen' ? 3 : player.faction === 'ixians' ? 7 : 5,
      tanks: 0, forces: {},
    });
  }
  const custody = game.homeworlds!.custody!;
  custody.visitors = {};
  if (advanced && game.players.some(player => player.faction === 'emperor'))
    custody.salusa = { normal: 0, elite: 5 };
  const native = game.players.find(player => player.id === 'native')!;
  native.reserves = 0;
  native.tanks = 20;
  if (native.elites) {
    native.elites.tanks = native.elites.reserves;
    native.elites.reserves = 0;
  }
  if (nativeFaction === 'emperor' && advanced) custody.salusa = { normal: 0, elite: 0 };
  const owner = game.players.find(player => player.id === 'owner')!;
  if (allied) {
    owner.ally = 'ally';
    game.players.find(player => player.id === 'ally')!.ally = owner.id;
  }
  const world = `homeworld:${nativeFaction}${cardId === 'salusa_secundus' ? ':salusa' : ''}`;
  custody.visitors[world] = { owner: { normal: 1, elite: 0 } };
  owner.reserves--;
  observeControlledIncomePosition(game, `controlled-${cardId}-sole`);
  homeworldGameIntegrity(game);
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort(), cards);
  return { game, world, cards, setup };
}

export function observeControlledIncomePosition(game: Game, event: string): void {
  game.homeworldOccupationHistory = observeHomeworldOccupation(game.homeworldOccupationHistory!,
    homeworldContext(game), game.homeworlds!.custody!, game.turn, 'change', event);
  homeworldGameIntegrity(game);
}

/** Real original phases/actions into Movement; only the conserved position is
 * controlled. Never jump the phase clock to obtain a Collection decision. */
export function occupiedIncomeMovementFixture(cardId: HomeworldId = 'caladan', advanced = false, allied = true) {
  const fixture = occupiedIncomeFixture(cardId, advanced, allied);
  let game = fixture.setup;
  for (let step = 0; !(game.phase === 5 && !game.response && !game.decision && !game.phaseOpening) && step < 500; step++) {
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      if (action.type === 'stormDial') action.amount = 0;
      next = applyAction(game, player.id, action);
      break;
    }
    assert.ok(next, 'Original phases must reach the controlled Movement boundary.');
    game = next;
  }
  assert.equal(game.phase, 5);
  for (const player of game.players) {
    assert.equal(player.tanks, 0, 'The position cannot resurrect previously lost counters.');
    const position = fixture.game.players.find(seat => seat.id === player.id)!;
    player.forces = structuredClone(position.forces);
    player.reserves = position.reserves;
    player.tanks = position.tanks;
    player.ally = position.ally;
    if (player.elites) player.elites = structuredClone(position.elites!);
  }
  game.homeworlds!.custody = structuredClone(fixture.game.homeworlds!.custody!);
  observeControlledIncomePosition(game, `controlled-${cardId}-real-movement-boundary`);
  return { ...fixture, game };
}
