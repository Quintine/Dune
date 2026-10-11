import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import {
  initializeNexusModulePaymentsSetup, nextNexusModulePaymentsNativeStep,
} from './fixture-nexus-module-payments';
import { nexusReady, orderNexusSpice } from './fixture-nexus-cards';

/** Original setup, first-Storm Tech and first-Mentat Stronghold ownership precede
 * the turn-two appearance. Only the physical card/deck order and two reserve
 * counters are staged; no phase, wallet, owner or earned receipt is manufactured. */
export function nexusFremenComponentsAppearance(options: {
  advanced: boolean; tech: boolean; strongholds: boolean;
}) {
  let game = initializeNexusModulePaymentsSetup({
    ...options, ownerFaction: 'fremen',
  });
  for (let n = 0; n < 1600; n++) {
    if (game.status === 'playing' && game.turn === 2 && game.phase === 1 &&
      !game.phaseOpening && !game.response && !game.decision) break;
    assert.ok(game.turn <= 2, 'Stop at the original second-turn Spice Blow.');
    const step = nextNexusModulePaymentsNativeStep(game);
    assert.ok(step, `Original continuation stopped at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.turn, 2); assert.equal(game.phase, 1);
  assert.ok(!game.phaseOpening && !game.decision && !game.response);
  const fremen = game.players.find(player => player.faction === 'fremen')!;
  assert.ok(fremen.reserves - (fremen.elites?.reserves ?? 0) >= 2);
  const sourceSector = game.storm === 14 ? 15 : 14;
  const source = `wind_pass:${sourceSector}`;
  fremen.reserves -= 2;
  fremen.forces[source] = (fremen.forces[source] ?? 0) + 2;
  const cards = game.nexusCards!.cards!;
  const cardIndex = cards.deck.indexOf('fremen');
  assert.ok(cardIndex >= 0);
  cards.deck.splice(cardIndex, 1);
  cards.hands[fremen.id] = 'fremen';
  orderNexusSpice(game, ['worm', 'land']);
  const empty = game.spiceDeck.find(card => 'territory' in card &&
    game.players.every(player => presenceAt(player, card.territory) === 0));
  assert.ok(empty && 'territory' in empty);
  game.spiceDeck.splice(game.spiceDeck.indexOf(empty), 1);
  game.spiceDiscard[0].push(empty);
  const before = structuredClone(game);
  game = nexusReady(game);
  return { game, before, actor: fremen.id, source, sourceSector };
}

export function completeNexusFremenComponentsRide(state: Game): Game {
  let game = state;
  for (let n = 0; n < 100 && game.decision?.kind !== 'nexusFremenCunningRide'; n++) {
    const step = nextNexusModulePaymentsNativeStep(game);
    assert.ok(step, 'The original post-Nexus ride needs a legal continuation.');
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.decision?.kind, 'nexusFremenCunningRide');
  return game;
}
