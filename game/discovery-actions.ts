import type { Game } from './engine';
import { fighterCount } from './advisors';
import { projectDiscoveryState } from './discoveries';

export type DiscoveryStash = {
  event: string;
  token: string;
  owner: string;
  turn: number;
  card: string;
  hand: string[];
  stage: 'choose' | 'discard' | 'complete';
  discarded: string | null;
  signature: string;
};
export function discoveryStashSignature(record: DiscoveryStash) {
  return JSON.stringify([
    record.event,
    record.token,
    record.owner,
    record.turn,
    record.card,
    record.hand,
    record.stage,
    record.discarded,
  ]);
}
/** A private view of physical tokens and the current player's Collection choices. */
export function discoveryChoices(g: Game, owner: string, automatic: boolean) {
  const p = g.players.find((player) => player.id === owner);
  if (!g.discoveries || !p) return null;
  const view = projectDiscoveryState(g.discoveries, p.faction);
  const blocked =
    g.status !== 'playing' || g.phase !== 7
      ? 'Inspect or reveal during Spice Collection.'
      : automatic ||
          g.truthtrance ||
          g.response ||
          g.decision ||
          g.phaseOpening ||
          g.pendingKarama ||
          g.pendingTreacheryDiscard ||
          g.pendingNullentropy ||
          g.pendingExchange ||
          g.pendingAmbassador ||
          g.pendingRicheseGift ||
          g.pendingRichesePurchaseIncome ||
          g.nexusCards?.phase?.stage === 'drawing' ||
          g.nexusTraitorExchanges?.some((record) => record.stage === 'return')
        ? 'Finish the current interaction first.'
        : null;
  const eligible = view.tokens.filter(
    (token) =>
      token.status === 'placed' &&
      token.revealedTurn === null &&
      token.territory &&
      fighterCount(p, token.territory) > 0,
  );
  return {
    ...view,
    blocked,
    canInspect: blocked
      ? []
      : eligible
          .filter((token) => token.face === null)
          .map((token) => token.id),
    canReveal: blocked
      ? []
      : eligible
          .filter((token) => token.face !== null)
          .map((token) => token.id),
  };
}
