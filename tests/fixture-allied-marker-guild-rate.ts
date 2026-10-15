import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';

export interface AlliedMarkerRateStep { actor: string; action: Action }
export interface AlliedMarkerGuildRateOptions {
  token?: 'zero' | 'five';
  payer?: 'supplier' | 'recipient';
  unaffordable?: boolean;
  independentCard?: boolean;
  advanced?: boolean;
}
export interface AlliedMarkerGuildRateFixture {
  initial: Game;
  beforeAction: Game;
  actions: AlliedMarkerRateStep[];
  action: Action;
  owner: string;
  recipient: string;
  observer: string;
  token: 'zero' | 'five';
  payer: string;
  territory: string;
  sector: number;
  target: string;
  priorSource: string;
  karama: string;
  independentKarama: string | null;
  amount: number;
  provenance: string[];
}
export const alliedMarkerRatePlayer = (g: Game, id: string) => {
  const p = g.players.find(seat => seat.id === id); assert.ok(p); return p;
};
export const alliedMarkerRateReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export function stepAlliedMarkerRate(g: Game, step: AlliedMarkerRateStep, actions?: AlliedMarkerRateStep[]) {
  const next = applyAction(alliedMarkerRateReload(g), step.actor, step.action);
  actions?.push(structuredClone(step));
  return next;
}

/** Bounded CONTROLLED source from richese-allied-no-field.test.ts, not an
 * original setup/action-only chronology. Its turn, alliance, empty armies,
 * ten-spice wallets and prior three-marker deployment are assigned here.
 * Karama cards move out of the actual base deck, conserving physical identity;
 * they are controlled acquisitions, not auction purchases. The original paired
 * E3 producer excludes Richese from its supported roster. Every subsequent
 * wallet reduction, offer, consent, response and settlement is an actual action.
 */
export function createAlliedMarkerGuildRate(options: AlliedMarkerGuildRateOptions = {}): AlliedMarkerGuildRateFixture {
  const owner = 'r', recipient = 'g', observer = 'a';
  let game = createGame('ALLIEDMARKERRATE', newPlayer(owner, 'Richese', 'richese'),
    options.advanced ?? true, ['choam']);
  game.players.push(newPlayer(recipient, 'Guild', 'guild'), newPlayer(observer, 'Atreides', 'atreides'));
  game.status = 'playing'; game.phase = 5; game.turn = 2; game.active = recipient;
  game.order = [owner, recipient, observer]; game.movementRemaining = [recipient, owner, observer];
  game.storm = 18; game.deck = baseDeck();
  for (const p of game.players) {
    p.forces = {}; p.reserves = 20; p.tanks = 0; p.spice = 10; p.hand = [];
    p.traitorChoices = []; p.traitors = [];
  }
  const supplier = alliedMarkerRatePlayer(game, owner);
  supplier.ally = recipient; alliedMarkerRatePlayer(game, recipient).ally = owner;
  supplier.noField = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']), {
    tokenId: 'three', controller: owner, location: { territory: 'red_chasm', sector: 7 },
  });
  supplier.noFieldEvent = 'event-a';
  const cards: string[] = [];
  for (let n = 0; n < (options.independentCard ? 2 : 1); n++) {
    const index = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
    const [card] = game.deck.splice(index, 1);
    alliedMarkerRatePlayer(game, observer).hand.push(card); cards.push(card.id);
  }
  const initial = alliedMarkerRateReload(game), actions: AlliedMarkerRateStep[] = [];
  if (options.unaffordable) game = stepAlliedMarkerRate(game, { actor: recipient,
    action: { type: 'bribe', target: observer, amount: 9 } }, actions);
  const token = options.token ?? 'five', payer = options.payer === 'supplier' ? owner : recipient;
  const territory = 'imperial_basin', sector = 10;
  const action: Action = { type: 'offerRicheseNoField', token, event: supplier.noFieldEvent,
    payer, territory, sector };
  return { initial, beforeAction: alliedMarkerRateReload(game), actions, action,
    owner, recipient, observer, token, payer, territory, sector, target: `${territory}:${sector}`,
    priorSource: 'red_chasm:7', karama: cards[0], independentKarama: cards[1] ?? null,
    amount: token === 'zero' ? 0 : 5,
    provenance: [
      'CONTROLLED existing allied-loan setup: turn 2 Shipment, Richese/Guild alliance, 20 counters and 10 spice per seat, prior Richese-controlled three-marker in Red Chasm sector 7.',
      'One or two real Karama identities are removed from the undealt base deck into Atreides custody; no original auction purchase is claimed.',
      'Optional Guild poverty comes only from an actual nine-spice bribe. All loan offers, recipient consents, responses and physical settlement are actual actions from this bounded source.',
    ] };
}

/** Only pass a current physical card holder's actual cancel opportunity. */
export function passAlliedMarkerRateResponses(state: Game, kind: 'richeseNoField' | 'guildRate',
  actions?: AlliedMarkerRateStep[]) {
  let game = alliedMarkerRateReload(state);
  for (let n = 0; game.response?.kind === kind && n < 20; n++) {
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    })?.id;
    assert.ok(actor, 'The pending response needs a real eligible card holder.');
    game = stepAlliedMarkerRate(game, { actor, action: { type: 'passResponse' } }, actions);
  }
  assert.notEqual(game.response?.kind, kind);
  return game;
}

/** Includes original source fields before any price cancellation. */
export function declareAlliedMarkerGuildRate(f: AlliedMarkerGuildRateFixture, state = f.beforeAction,
  action = f.action) {
  const actions: AlliedMarkerRateStep[] = [];
  let game = stepAlliedMarkerRate(state, { actor: f.owner, action }, actions);
  const offer = structuredClone(game.richeseAllyOffer); assert.ok(offer);
  const beforeAcceptance = alliedMarkerRateReload(game);
  game = stepAlliedMarkerRate(game, { actor: f.recipient,
    action: { type: 'decision', event: offer.event, accept: true, elite: 0 } }, actions);
  const accepted = alliedMarkerRateReload(game);
  game = passAlliedMarkerRateResponses(game, 'richeseNoField', actions);
  if (game.decision?.kind === 'guildShipment') {
    assert.equal(game.decision.amount, 1);
    game = stepAlliedMarkerRate(game, { actor: f.recipient,
      action: { type: 'decision', allow: true } }, actions);
  }
  return { game, actions, beforeAcceptance, accepted, offer };
}

/** API/UI-loadable genuine pending rate scene; no response or decision is staged. */
export function createAlliedMarkerGuildRateScene(options: AlliedMarkerGuildRateOptions = {}) {
  const fixture = createAlliedMarkerGuildRate(options);
  const declared = declareAlliedMarkerGuildRate(fixture);
  assert.equal(declared.game.response?.kind, 'guildRate');
  assert.equal(declared.game.pendingShipment?.cost, 1);
  assert.ok(viewGame(declared.game, fixture.observer).responseControls?.cancelCards.includes(fixture.karama));
  return { ...fixture, ...declared, declarationActions: declared.actions,
    actions: [...fixture.actions, ...declared.actions],
    original: {
      offer: declared.offer, cost: 1, bankOnly: true,
      source: { owner: fixture.owner, controller: fixture.recipient, tokenId: fixture.token,
        tokenEvent: alliedMarkerRatePlayer(fixture.beforeAction, fixture.owner).noFieldEvent,
        territory: fixture.territory, sector: fixture.sector },
      supplierPayment: fixture.payer === fixture.owner ? 1 : 0,
      recipientPayment: fixture.payer === fixture.recipient ? 1 : 0,
    },
    cancel: { actor: fixture.observer,
      action: { type: 'card', mode: 'cancel', card: fixture.karama } as Action },
  };
}
