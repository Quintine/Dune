import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { createSemutaGuildTransport } from './fixture-semuta-guild-transport';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';

export function createSemutaShipmentPrice(options: { advanced?: boolean; homeworlds?: boolean } = {}) {
  const original = createSemutaGuildTransport({ advanced: options.advanced,
    route: options.homeworlds ? 'world' : 'reserve' });
  let game = structuredClone(original.boughtKarama);
  const actions: { actor: string; action: Action }[] = [];
  for (let n = 0; !(game.phase === 5 && game.active === 'a' && !game.response &&
    !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard) && n < 1600; n++) {
    const next = nextSemutaGuildIncomeNativeStep(game); actions.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.phase, 5); assert.equal(game.active, 'a');
  assert.ok(game.players.find(p => p.id === 'e')!.hand.some(card => card.id === original.karama));
  assert.ok(game.players.find(p => p.id === 'g')!.hand.some(card => card.id === original.semuta));
  const beforeAction = structuredClone(game);
  const action: Action = { type: 'card', card: original.karama, mode: 'shipment', target: 'a' };
  game = applyAction(game, 'e', action);
  assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:shipment');
  assert.equal(game.karamaShipping, null);
  return { original, actions, beforeAction, action, game,
    owner: 'e', beneficiary: 'a', guild: 'g', holder: 'g',
    karama: original.karama, semuta: original.semuta,
    provenance: [...original.provenance,
      'Fork from actual paid Karama purchase; real native progression to the original Atreides shipment turn.',
      'Emperor actually spends its own printed card for the other active player; no played state assigned.'] };
}

export function reactSemutaShipmentPrice(state: Game, claim: boolean) {
  const pending = state.pendingTreacheryDiscard; assert.ok(pending);
  const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
  const event = pending.batch.event;
  let game = state;
  if (claim) return applyAction(game, 'g', { type: 'semutaCommit', event });
  for (const seat of game.players.filter(p => !reaction.passed.includes(p.id)))
    game = applyAction(game, seat.id, { type: 'semutaPass', event });
  return game;
}

export function semutaPurchasedShipment(game: Game, homeworlds = false) {
  if (homeworlds) {
    const quote = homeworldShipmentChoice(viewGame(game, 'a'), 'homeworld:emperor',
      { 'homeworld:atreides': { normal: 3, elite: 0 } });
    assert.ok(quote.action, quote.blocked ?? undefined);
    return { action: quote.action, target: 'homeworld:emperor', amount: 3, cost: 2 };
  }
  const destination = TERRITORIES.find(t => t.type === 'sand' &&
    t.sectors.some(s => s !== game.storm) && game.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination); const sector = destination.sectors.find(s => s !== game.storm)!;
  const action: Action = { type: 'ship', territory: destination.id, sector,
    amount: 3, elite: 0, allyPayment: 0 };
  return { action, target: `${destination.id}:${sector}`, amount: 3, cost: 3 };
}

export function allowSemutaPurchasedShipment(state: Game) {
  let game = state;
  if (game.decision?.kind === 'guildShipment')
    game = applyAction(game, 'g', { type: 'decision', allow: true });
  else if (game.decision?.kind === 'homeworldShipmentGuild')
    game = applyAction(game, 'g', { type: 'decision', event: game.decision.event, allow: true });
  return game;
}
