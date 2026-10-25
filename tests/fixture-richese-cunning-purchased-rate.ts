import assert from 'node:assert/strict';
import { viewGame, type Action } from '../game/engine';
import { reserveShipmentCost } from '../game/shipment-price';
import { territory } from '../game/board';
import { quoteRicheseHomeworldPair } from '../game/richese-homeworld-shipment';
import {
  createRicheseHomeworldCunningFixture,
  actRicheseHomeworldCunning, nextRicheseHomeworldCunning, advanceRicheseHomeworldCunning,
  passRicheseHomeworldCunning, finishRicheseHomeworldCunning,
  commitRicheseHomeworldCunning, revealRicheseHomeworldCunning,
  richeseHomeworldCunningPlayer, richeseHomeworldCunningClean,
  richeseHomeworldCunningInventory, richeseHomeworldCunningNexusInventory,
  richeseHomeworldCunningPopulation,
} from './fixture-richese-homeworld-cunning';
import type { RicheseHomeworldShipmentStep } from './fixture-richese-homeworld-shipment';

export const actRicheseCunningPurchasedRate = actRicheseHomeworldCunning;
export const nextRicheseCunningPurchasedRate = nextRicheseHomeworldCunning;
export const advanceRicheseCunningPurchasedRate = advanceRicheseHomeworldCunning;
export const passRicheseCunningPurchasedRate = passRicheseHomeworldCunning;
export const finishRicheseCunningPurchasedRate = finishRicheseHomeworldCunning;
export const commitRicheseCunningPurchasedRate = commitRicheseHomeworldCunning;
export const revealRicheseCunningPurchasedRate = revealRicheseHomeworldCunning;
export const richeseCunningPurchasedRatePlayer = richeseHomeworldCunningPlayer;
export const richeseCunningPurchasedRateClean = richeseHomeworldCunningClean;
export const richeseCunningPurchasedRateInventory = richeseHomeworldCunningInventory;
export const richeseCunningPurchasedRateNexusInventory = richeseHomeworldCunningNexusInventory;
export const richeseCunningPurchasedRatePopulation = richeseHomeworldCunningPopulation;

/** Native original sources plus Emperor's actual printed Karama purchase for
 * active Richese. No source fields are added to the client pair declaration.
 * The optional costClaimed flag is an explicitly controlled supplement only. */
export function createRicheseCunningPurchasedRateFixture(options: {
  advanced?: boolean; companions?: number; guild?: boolean; costClaimed?: boolean;
} = {}) {
  const companions = options.companions ?? 11;
  assert.ok(Number.isSafeInteger(companions) && companions >= 0 && companions <= 16);
  const f = createRicheseHomeworldCunningFixture({ advanced: options.advanced,
    companions: Math.max(1, companions), guild: options.guild });
  const actions: RicheseHomeworldShipmentStep[] = structuredClone(f.actions);
  const beforePurchase = structuredClone(f.game), activationAction: Action = {
    type: 'card', mode: 'shipment', card: f.karama, target: f.owner,
  };
  let game = actRicheseCunningPurchasedRate(f.game, f.holder, activationAction, actions);
  game = finishRicheseCunningPurchasedRate(game, actions);
  const activation = { before: beforePurchase, steps: structuredClone(actions.slice(f.actions.length)), after: structuredClone(game) };
  assert.deepEqual(game.karamaShipping, { player: f.owner, owner: f.holder, card: f.karama });
  assert.equal(richeseCunningPurchasedRatePlayer(game, f.holder).hand.some(card => card.id === f.karama), false);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  if (options.costClaimed) Object.assign(game.karamaShipping!, { costClaimed: true as const });
  const p = richeseCunningPurchasedRatePlayer(game, f.owner), offer = viewGame(game, f.owner).nexusRicheseCunning;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The original purchased rate leaves native Cunning available');
  const quote = quoteRicheseHomeworldPair({ enabled: true, reserves: p.reserves, amount: companions, revealedValue: f.revealedValue });
  const action: Action = { type: 'ship', noField: f.concealedToken, event: p.noFieldEvent,
    revealedToken: f.revealedToken, nexus: offer.event,
    ...(companions ? { noFieldReserves: companions } : {}), territory: f.territory, sector: f.sector, allyPayment: 0 };
  const cost = reserveShipmentCost({ faction: 'richese', halfRate: true }, territory(f.territory).type, quote.priced);
  const guildCancel: Action | null = f.guildKarama ? { type: 'card', card: f.guildKarama, mode: 'cancel' } : null;
  const guildStop: Action | null = f.guildKarama ? { type: 'card', card: f.guildKarama, mode: 'special' } : null;
  assert.deepEqual(richeseCunningPurchasedRateInventory(game), f.originalInventory);
  assert.deepEqual(richeseCunningPurchasedRateNexusInventory(game), f.originalNexusInventory);
  return { ...f, game, source: structuredClone(game), beforeShipment: structuredClone(game), beforePurchase,
    beforeActivation: beforePurchase, activation, activationAction,
    purchaser: f.holder, shipper: f.owner, purchasedRate: structuredClone(game.karamaShipping!),
    grant: structuredClone(game.karamaShipping!), controlledCostClaimed: !!options.costClaimed,
    companions, noFieldReserves: companions, amount: companions,
    action, shipmentAction: action, shipmentStep: { actor: f.owner, action },
    pairQuote: quote, paid: quote.paid, physical: quote.physical, priced: quote.priced, revealedForces: quote.revealed,
    fullCost: reserveShipmentCost({ faction: 'richese', halfRate: false }, territory(f.territory).type, quote.priced),
    cost, shipmentCost: cost, nexusEvent: offer.event, offer: structuredClone(offer), guildCancel, guildStop,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [...f.staging,
      'After the actual original alliance, closing Richese draw and funded unused turn, Emperor plays its genuinely dealt Karama in shipment mode for active Richese. That exact physical card enters discard once and the original owner-labelled purchased grant is retained. The pair action carries only original client fields; the server owns its price-source record.',
      'Optional Guild really receives the other starting Karama and passes its empty Nexus choice. Its original No-Field counter, Advanced shipment interception, bank routing and unclaimed-activation refund remain caller controls. No faction, card, force, alliance, phase or grant is installed.',
      ...(options.costClaimed ? ['CONTROLLED SUPPLEMENT: after that genuine activation, set only its existing costClaimed flag true to represent previously claimed disposal cost. No physical card, duplicate identity, owner, phase, receipt or payment is created. This is not a claimed original Nullentropy programme.'] : []),
    ],
  };
}
export type RicheseCunningPurchasedRateFixture = ReturnType<typeof createRicheseCunningPurchasedRateFixture>;
