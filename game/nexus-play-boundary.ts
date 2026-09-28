import type { Game } from './engine';

/** Optional no-phase Nexus effects must not interrupt a committed parent. */
export function nexusCleanPlayBlocked(g: Game, automaticPending = false): boolean {
  return !!(automaticPending || g.response || g.decision || g.truthtrance || g.phaseOpening ||
    g.pendingKarama || g.pendingTreacheryDiscard || g.pendingNullentropy ||
    g.pendingExchange || g.pendingAmbassador || g.pendingRicheseGift ||
    g.pendingRichesePurchaseIncome || g.pendingRevival || g.pendingCapture ||
    g.pendingShipment || g.pendingHomeworldShipment || g.pendingIxMove ||
    g.pendingFremenMove || g.pendingMobileMove || g.pendingTerrorEntry ||
    g.pendingMoritaniPlacement || g.pendingEcazPlacement || g.pendingChoamMove ||
    g.pendingChoamWorthless || g.pendingChoamBattleIncome ||
    g.pendingChoamMarketGhola || g.pendingAuditor || g.pendingFaceDance ||
    g.pendingTech || g.pendingIxTechnology || g.pendingIxAlly ||
    g.pendingIxSubstitution || g.pendingIxRicheseTechnology ||
    g.pendingWinnerDiscards || g.pendingSukRescue || g.ornithopter ||
    g.summonedWorm || g.battle || g.auction || g.richeseAuction ||
    g.choamMarket || g.nexusTraitorPending ||
    g.nexusTraitorExchanges?.some(record => record.stage === 'return') ||
    g.nexusCards?.phase?.stage === 'drawing');
}
