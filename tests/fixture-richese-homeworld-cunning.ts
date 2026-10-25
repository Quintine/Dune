import assert from 'node:assert/strict';
import { viewGame, type Action } from '../game/engine';
import type { NoFieldValue } from '../game/richese-no-field';
import { quoteRicheseHomeworldPair } from '../game/richese-homeworld-shipment';
import {
  createRicheseHomeworldShipmentFixture,
  actRicheseHomeworldShipment, nextRicheseHomeworldShipment, advanceRicheseHomeworldShipment,
  passRicheseHomeworldShipment, finishRicheseHomeworldShipment,
  commitRicheseHomeworldShipment, revealRicheseHomeworldShipment,
  richeseHomeworldShipmentPlayer, richeseHomeworldShipmentClean,
  richeseHomeworldShipmentInventory, richeseHomeworldShipmentNexusInventory,
  richeseHomeworldShipmentPopulation,
} from './fixture-richese-homeworld-shipment';

export const actRicheseHomeworldCunning = actRicheseHomeworldShipment;
export const nextRicheseHomeworldCunning = nextRicheseHomeworldShipment;
export const advanceRicheseHomeworldCunning = advanceRicheseHomeworldShipment;
export const passRicheseHomeworldCunning = passRicheseHomeworldShipment;
export const finishRicheseHomeworldCunning = finishRicheseHomeworldShipment;
export const commitRicheseHomeworldCunning = commitRicheseHomeworldShipment;
export const revealRicheseHomeworldCunning = revealRicheseHomeworldShipment;
export const richeseHomeworldCunningPlayer = richeseHomeworldShipmentPlayer;
export const richeseHomeworldCunningClean = richeseHomeworldShipmentClean;
export const richeseHomeworldCunningInventory = richeseHomeworldShipmentInventory;
export const richeseHomeworldCunningNexusInventory = richeseHomeworldShipmentNexusInventory;
export const richeseHomeworldCunningPopulation = richeseHomeworldShipmentPopulation;

/** Original Homeworld+Nexus setup and paid native funding, before any pair
 * declaration. Emperor and Atreides actually ally at the turn-two worm; the
 * unallied Richese really draws its original Cunning singleton afterward. */
export function createRicheseHomeworldCunningFixture(options: {
  advanced?: boolean; companions?: number; revealedValue?: NoFieldValue; concealedValue?: NoFieldValue; guild?: boolean;
} = {}) {
  const revealedValue = options.revealedValue ?? 5, concealedValue = options.concealedValue ?? 3;
  assert.notEqual(revealedValue, concealedValue, 'The two original physical tokens must be distinct');
  const f = createRicheseHomeworldShipmentFixture({ advanced: options.advanced,
    companions: options.companions, value: concealedValue, nexus: true, guild: options.guild });
  assert.ok(f.nexusDraw && f.nexusAlliance && f.observer);
  const p = richeseHomeworldCunningPlayer(f.game, f.owner), offer = viewGame(f.game, f.owner).nexusRicheseCunning;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The actually drawn native Richese Cunning is live');
  assert.equal(p.ally, null); assert.equal(f.game.nexusCards!.cards!.hands[f.owner], 'richese');
  const revealed = p.noField!.tokens.find(token => token.value === revealedValue); assert.ok(revealed);
  const concealed = p.noField!.tokens.find(token => token.value === concealedValue); assert.ok(concealed);
  const action: Action = { type: 'ship', noField: concealed.id, event: p.noFieldEvent,
    revealedToken: revealed.id, nexus: offer.event, noFieldReserves: f.companions,
    territory: f.territory, sector: f.sector, allyPayment: 0 };
  const quote = quoteRicheseHomeworldPair({ enabled: true, reserves: p.reserves,
    amount: f.companions, revealedValue });
  return { ...f, source: structuredClone(f.game), beforeShipment: structuredClone(f.game),
    singleAction: f.action, action, shipmentAction: action, shipmentStep: { actor: f.owner, action },
    nexusEvent: offer.event, offer: structuredClone(offer),
    revealedValue, revealedToken: revealed.id, concealedValue, concealedToken: concealed.id,
    value: concealedValue, markerValue: concealedValue, token: concealed.id, tokenId: concealed.id,
    paid: quote.paid, physical: quote.physical, priced: quote.priced, revealedForces: quote.revealed, pairQuote: quote,
    staging: [...f.staging,
      `This native ${f.guild ? 'four' : 'three'}-seat branch stops before the original two-token Cunning declaration. Its Emperor/Atreides alliance is earned, Richese is unallied, the original Richese Nexus is actually held and empty Carthag11 is the funded destination. No two-seat all-unallied draw is manufactured.`,
      'The proposed pair uses one concealed three token and one immediate faceup five token by default, plus eleven paid original reserves. Root’s explicitly provisional composition reserves the paid group first, materializes only the remaining stock for the immediate token and leaves the other token concealed. The original Nexus spend, No-Field Karama counter, one combined invoice and later reserve-capped reveal remain real caller actions.',
    ],
  };
}
export type RicheseHomeworldCunningFixture = ReturnType<typeof createRicheseHomeworldCunningFixture>;
