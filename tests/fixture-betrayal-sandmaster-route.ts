import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { botEntryAllowed } from '../game/bot-mobility';
import { TERRITORIES, location, splitLocation } from '../game/board';
import { drawNexusCard } from '../game/nexus-cards';
import {
  sandmasterActionOrder, sandmasterShortestRoute, type SandmasterChoice,
} from '../game/sandmaster-movement';
import { createGuildBetrayalSkillsSetup } from './fixture-bureaucrat-betrayal-funding';

export const sandmasterTrainer = (game: Game) => game.players.find(player => player.id === 'trainer')!;

/** Only unplayed physical card ordering/custody is controlled. All setup, piles,
 * counters, wallets, movement budgets and Guild invoices use native actions. */
export function createBetrayalSandmasterRoute() {
  const setup = createGuildBetrayalSkillsSetup(false, false, 'sandmaster');
  let game = setup.trained;
  const inventory = game.nexusCards!.cards!;
  assert.ok(Object.values(inventory.hands).every(card => card === null));
  const guildIndex = inventory.deck.indexOf('guild');
  assert.ok(guildIndex >= 0);
  inventory.deck.unshift(inventory.deck.splice(guildIndex, 1)[0]);
  const controlledNexusOrder = [...inventory.deck];
  // Preserve the original singleton inventory, arranging its unplayed custody
  // before any shipment, exactly as the original Guild Betrayal fixture does.
  game.nexusCards!.cards = drawNexusCard(inventory, 'holder', game.players, () => 0);
  let orderedSpice = false;
  let printedPile = '';
  let printedAmount = 0;
  let controlledSpiceOrder: typeof game.spiceDeck = [];
  let betrayalPasses = 0;

  const step = (state: Game): Game => {
    if (state.pendingGuildBetrayal) {
      const frame = state.pendingGuildBetrayal;
      const actor = frame.required.find(id => !frame.passed.includes(id))!;
      betrayalPasses++;
      return applyAction(state, actor, { type: 'guildBetrayalPass', event: frame.invoice.event });
    }
    if (state.response) {
      const actor = state.players.find(player => !state.response!.passed.includes(player.id))!.id;
      return applyAction(state, actor, { type: 'passResponse' });
    }
    if (state.decision?.kind === 'guildShipment')
      return applyAction(state, state.decision.player, { type: 'decision', allow: true });
    if (state.decision?.kind === 'advisor')
      return applyAction(state, state.decision.player, { type: 'decision', accept: false });
    for (const player of state.players) {
      const view = viewGame(state, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const proposed = botActions(view)[0];
      if (!proposed) continue;
      const action: Action = proposed.type === 'stormDial' ? { ...proposed, amount: 0 } :
        proposed.type === 'bid' ? { type: 'passBid' } : proposed;
      return applyAction(state, player.id, action);
    }
    throw new Error(`Native Sandmaster fixture stalled at ${state.status}/${state.phase}/${state.decision?.kind}`);
  };

  for (let steps = 0; steps < 700; steps++) {
    if (game.status === 'playing' && game.phase === 1 && !orderedSpice) {
      assert.equal(game.spiceDiscard.flat().length, 0);
      const index = game.spiceDeck.findIndex(card => 'territory' in card &&
        sandmasterShortestRoute(game, 'trainer', 'polar_sink:0', location(card.territory, card.sector), 1));
      assert.ok(index >= 0, 'A printed first blow is adjacent to the original BG starting counter.');
      const card = game.spiceDeck.splice(index, 1)[0];
      assert.ok('territory' in card);
      printedPile = location(card.territory, card.sector);
      printedAmount = card.amount;
      const secondIndex = game.spiceDeck.findIndex(other => 'territory' in other);
      assert.ok(secondIndex >= 0);
      const second = game.spiceDeck.splice(secondIndex, 1)[0];
      game.spiceDeck.unshift(card, second);
      controlledSpiceOrder = structuredClone(game.spiceDeck);
      orderedSpice = true;
    }
    if (game.status === 'playing' && game.phase === 5 && !game.phaseOpening &&
      !game.response && !game.decision && !game.pendingGuildBetrayal) break;
    game = step(game);
  }
  assert.equal(game.phase, 5);
  assert.ok(!game.phaseOpening);
  assert.ok(orderedSpice);
  assert.equal(game.spice[printedPile], printedAmount, 'The original printed blow created the pile.');
  assert.equal(game.nexusCards!.cards!.hands.holder, 'guild', 'The conserved physical Guild face remains in recorded custody.');

  let shipped = false;
  for (let steps = 0; steps < 100 && game.active !== 'trainer'; steps++) {
    if (game.pendingGuildBetrayal || game.response || game.decision) {
      game = step(game);
      continue;
    }
    const actor = game.active!;
    if (!shipped && actor !== 'guild') {
      const view = viewGame(game, actor);
      const payer = view.players.find(player => player.id === actor)!;
      const destination = TERRITORIES.filter(t => t.type === 'stronghold').flatMap(t =>
        t.sectors.map(sector => ({ territory: t.id, sector }))).find(to =>
          botEntryAllowed(view, payer, to.territory, to.sector, 'ship'));
      assert.ok(destination);
      game = applyAction(game, actor, { type: 'ship', ...destination, amount: 1 });
      assert.ok(game.pendingGuildBetrayal, 'An unrelated ordinary shipment retains the original Betrayal gate.');
      shipped = true;
    } else game = applyAction(game, actor, { type: 'endMovement' });
  }
  while (game.pendingGuildBetrayal || game.response || game.decision) game = step(game);
  assert.equal(game.active, 'trainer');
  assert.ok(betrayalPasses > 0);
  const trainer = sandmasterTrainer(game);
  assert.equal(trainer.forces['polar_sink:0'], 1, 'The real original starting counter remains on the board.');
  assert.equal(trainer.reserves, 19);
  assert.equal(trainer.advisors?.polar_sink, undefined, 'Basic BG starting counter is a fighter.');
  const at = splitLocation(printedPile);
  const ordinary: Action = { type: 'move', from: 'polar_sink:0', amount: 1, territory: at.territory, sector: at.sector };
  const order = sandmasterActionOrder(viewGame(game, 'trainer'), 'trainer', ordinary);
  assert.ok(order);
  const route = sandmasterShortestRoute(game, 'trainer', 'polar_sink:0', printedPile, order.range);
  assert.ok(route);
  const choice: SandmasterChoice = { routes: { 'polar_sink:0': route }, collect: [printedPile] };
  const action: Action = { ...ordinary, sandmaster: choice };
  return { game, ordinary, action, order, choice, printedPile, printedAmount,
    betrayalPasses, controlledNexusOrder, controlledSpiceOrder };
}
