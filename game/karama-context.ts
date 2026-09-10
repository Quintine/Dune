import type { Game, ResponseWindow } from './engine';

/** Identity evidence only: this does not execute or prove a cancellation suffix. */
const battleSource = (g: Game) =>
  g.battle
    ? {
        event: g.battle.event,
        territory: g.battle.territory,
        attacker: g.battle.attacker,
        defender: g.battle.defender,
        revealed: g.battle.revealed,
      }
    : null;
const aftermathSource = (g: Game) => ({
  lastBattle: g.lastBattle,
  context: g.lastBattleContext ?? null,
});
const auctionSource = (g: Game) => ({
  auction: g.auction,
  sale: g.currentAuctionSale ?? null,
  richeseBidding: g.richeseBidding ?? null,
  richeseAuction: g.richeseAuction ?? null,
});
const wormSource = (g: Game) => ({
  resolution: g.spiceResolution,
  sequence: g.spiceSequence,
  summoned: g.summonedWorm?.territory ?? null,
});
const movementSource = (g: Game) => ({
  active: g.active,
  remaining: g.movementRemaining,
});

type SourceSelector = (g: Game, response: ResponseWindow) => unknown;
/** Every supported response has an explicit parent selection. Do not replace
 * this with all pending records: independent interruptions may create those. */
const cancellationSources = {
  ecazCollection: (g) => ({ pending: g.ecazCollection ?? null }),
  moritaniPlacement: (g) => ({
    pending: g.pendingMoritaniPlacement ?? null,
    terror: g.moritaniTerror ?? null,
  }),
  ecazPlacement: (g) => ({
    pending: g.pendingEcazPlacement ?? null,
    ambassadors: g.ecazAmbassadors ?? null,
    placedTurn: g.ecazPlacementTurn,
  }),
  moritaniAlliance: (g) => ({
    entry: g.pendingTerrorEntry ?? null,
    ...(g.pendingTerrorEntry?.resume === 'ambassador'
      ? {
          ambassador: g.pendingAmbassador ?? null,
          ambassadors: g.ecazAmbassadors ?? null,
        }
      : {}),
    token: g.moritaniTerror?.tokens.find(
      (t) => t.id === g.pendingTerrorEntry?.token,
    ),
  }),
  moritaniDuke: (g) => ({
    duke: g.dukeVidal ?? null,
    acquisitionTurn: g.dukeAcquisitionTurn,
  }),
  moritaniRetention: (g) => ({
    ...aftermathSource(g),
    retention: g.moritaniRetention ?? null,
  }),
  voice: (g) => ({
    battle: battleSource(g),
    voice: g.battle?.voice ?? null,
    preparation: g.battle?.preparation ?? null,
  }),
  prescience: (g) => ({
    battle: battleSource(g),
    prescience: g.battle?.prescience ?? null,
    preparation: g.battle?.preparation ?? null,
  }),
  nexusPrescience: (g) => ({
    battle: battleSource(g),
    inspection: g.battle?.nexusInspection ?? null,
    preparation: g.battle?.preparation ?? null,
  }),
  nexusAdvisorFlip: (g) => ({
    ...movementSource(g),
    conversion: g.nexusAdvisorHistory?.find(record => record.stage === 'pending') ?? null,
  }),
  nexusSardaukar: (g) => ({
    battle: battleSource(g),
    declaration: g.nexusSardaukarHistory?.find(record => record.stage === 'pending') ?? null,
  }),
  advisor: (g, response) =>
    response.advisorResume === 'ambassador'
      ? {
          entry: g.pendingAmbassador ?? null,
          ambassadors: g.ecazAmbassadors ?? null,
        }
      : null,
  emperorIncome: (g, response) =>
    response.source === 'ambassador'
      ? {
          entry: g.pendingAmbassador ?? null,
          ambassadors: g.ecazAmbassadors ?? null,
        }
      : auctionSource(g),
  richesePurchaseIncome: (g) => g.pendingRichesePurchaseIncome ?? null,
  richeseGift: (g) => g.pendingRicheseGift ?? null,
  richeseNoField: (g) => ({
    ...movementSource(g),
    shipment: g.pendingShipment ?? null,
  }),
  harkonnenBonus: (g, response) =>
    response.source === 'ambassador'
      ? {
          entry: g.pendingAmbassador ?? null,
          ambassadors: g.ecazAmbassadors ?? null,
        }
      : auctionSource(g),
  harkonnenTraitor: (g) => ({
    battle: battleSource(g),
    plans: g.battle?.plans ?? null,
    calls: g.battle?.traitorCalls ?? null,
  }),
  guildIncome: () => null,
  emperorGift: () => null,
  emperorRevival: () => null,
  stormPeek: (g) => ({ card: g.stormCard, dialers: g.stormDialers }),
  stormProtection: (g, response) =>
    response.resume === 'storm' ? g.stormResolution : movementSource(g),
  wormPlacement: wormSource,
  wormSurvival: wormSource,
  wormAllyProtection: wormSource,
  atreidesAuction: auctionSource,
  atreidesSpice: (g) => ({
    sequence: g.spiceSequence,
    resolution: g.spiceResolution,
  }),
  guildTiming: (g) => ({
    ...movementSource(g),
    locked: g.guildTimingLocked,
    granted: g.guildTimingGranted,
  }),
  kwisatz: (g) => ({ battle: battleSource(g), checks: g.battle?.powerChecks }),
  capture: (g) => ({ ...aftermathSource(g), capture: g.pendingCapture }),
  eliteStrength: (g) => ({
    battle: battleSource(g),
    checks: g.battle?.powerChecks,
  }),
  fremenSupport: (g) => ({
    battle: battleSource(g),
    checks: g.battle?.powerChecks,
  }),
  advisorFlip: (g, response) =>
    response.advisorResume === 'ambassador'
      ? {
          entry: g.pendingAmbassador ?? null,
          ambassadors: g.ecazAmbassadors ?? null,
        }
      : response.advisorResume === 'wormRide'
        ? wormSource(g)
        : response.advisorResume === 'declaration'
          ? { battle: battleSource(g), active: g.active }
          : movementSource(g),
  bgCharity: () => null,
  choamCharity: () => null,
  choamInflation: (g) => ({
    inflation: g.inflation,
    attempted: g.inflationAttemptTurn,
  }),
  choamSale: (g) => g.choamMarket ?? null,
  choamWorthless: (g) => ({
    pending: g.pendingChoamWorthless ?? null,
    movement: g.pendingChoamWorthless?.movement
      ? g.pendingChoamMove
      : undefined,
    revival: g.pendingChoamWorthless?.revival ? g.pendingRevival : undefined,
    storm: g.pendingChoamWorthless?.storm ? g.stormResolution : undefined,
  }),
  choamBattleIncome: (g) => ({
    ...aftermathSource(g),
    income: g.pendingChoamBattleIncome,
  }),
  choamAudit: (g) => ({ ...aftermathSource(g), audit: g.pendingAuditor }),
  choamBattleAid: (g) => ({
    battle: battleSource(g),
    checks: g.battle?.powerChecks,
  }),
  // A direct second BG conversion is unavailable while this one is live.
  // Printed cancellation restores this saved use; it must never execute it.
  worthlessKarama: (g) => g.pendingKarama ?? null,
  faceDancerReplacement: (g, response) => ({
    replacement: g.players
      .find((p) => p.id === response.owner)
      ?.faceDancers?.find((c) => c.leader === response.intent),
  }),
  choamRevival: (g) => g.pendingRevival ?? null,
  revivalLimit: (g) => g.pendingRevival ?? null,
  revivalDiscount: (g) => g.pendingRevival ?? null,
  earlyRevival: (g) => g.pendingRevival ?? null,
  revivalIncome: () => null,
  foreignGhola: (g) => g.pendingRevival ?? null,
  ixSubstitution: (g) => ({
    ...aftermathSource(g),
    substitution: g.pendingIxSubstitution,
  }),
  ixMovement: (g) => ({ ...movementSource(g), movement: g.pendingIxMove }),
  fremenMovement: (g) => ({
    ...movementSource(g),
    movement: g.pendingFremenMove,
  }),
  mobileStronghold: (g) => ({
    move: g.pendingMobileMove,
    stronghold: g.mobileStronghold,
  }),
  richeseAuction: auctionSource,
  richeseBlackMarket: auctionSource,
  ixAuction: (g) => ({ pending: g.ixAuction, round: g.richeseBidding }),
  ixTechnology: (g) => ({
    ...auctionSource(g),
    substitution: g.pendingIxTechnology,
  }),
  ixAllyCard: (g) => ({ ...auctionSource(g), replacement: g.pendingIxAlly }),
} satisfies Record<ResponseWindow['kind'], SourceSelector>;

export class KaramaContextError extends Error {}

export function canceledResponseSource(
  g: Game,
  response: ResponseWindow,
): unknown {
  const select: SourceSelector | undefined = Object.hasOwn(
    cancellationSources,
    response.kind,
  )
    ? cancellationSources[response.kind]
    : undefined;
  const owner = g.players.find((p) => p.id === response.owner);
  const recipient =
    response.recipient === undefined
      ? undefined
      : g.players.find((p) => p.id === response.recipient);
  if (
    !select ||
    !owner ||
    (response.recipient !== undefined && !recipient) ||
    !Array.isArray(response.passed) ||
    new Set(response.passed).size !== response.passed.length ||
    response.passed.some((id) => !g.players.some((p) => p.id === id))
  )
    throw new KaramaContextError(
      'The canceled power does not have a valid saved source.',
    );
  return {
    owner: { id: owner.id, faction: owner.faction },
    recipient: recipient
      ? { id: recipient.id, faction: recipient.faction }
      : null,
    source: select(g, response),
  };
}
