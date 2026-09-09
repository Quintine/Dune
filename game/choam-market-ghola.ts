import type { Game, ResponseWindow } from './engine';
import type { ChoamMarket } from './choam-market';
import { quoteChoamSaleCancellation } from './choam-sale-cancellation';

/** The sale is suspended, never replayed. Its physical card stays in its hand. */
export type ChoamMarketGhola = {
  turn: number;
  phase: number;
  player: string;
  card: string;
  discardSequence: number;
  event: string;
  stage: 'discard' | 'income' | 'complete';
  response: ResponseWindow;
  market: ChoamMarket;
};

export function choamGholaEvent(pending: Pick<ChoamMarketGhola,
  'turn' | 'phase' | 'player' | 'card' | 'discardSequence'>) {
  return JSON.stringify(['choamGhola', pending.turn, pending.phase,
    pending.player, pending.card, pending.discardSequence]);
}

/** Public timing shared by the server and the hand's ordinary-card controls. */
export function choamSaleGholaTiming(state: {
  status: string;
  response?: object | null;
  decision?: object | null;
  choamMarket?: { owner: string } | null;
}) {
  const response = state.response as { kind?: string; owner?: string } | null;
  return state.status === 'playing' &&
    response?.kind === 'choamSale' &&
    response.owner === state.choamMarket?.owner && !state.decision;
}

/** No current hand or population requirement: a nested effect may legitimately
 * move the sale card or change Tupile before the original declaration resumes. */
export function choamMarketGholaError(g: Game): string | null {
  const pending = g.pendingChoamMarketGhola;
  if (!pending) return null;
  if (
    g.status !== 'playing' || pending.turn !== g.turn || pending.phase !== g.phase ||
    !g.players.some((p) => p.id === pending.player) ||
    typeof pending.card !== 'string' || !pending.card ||
    !Number.isSafeInteger(pending.discardSequence) || pending.discardSequence < 1 ||
    pending.discardSequence > (g.treacheryDiscardSequence ?? 0) ||
    pending.event !== choamGholaEvent(pending) ||
    !['discard', 'income', 'complete'].includes(pending.stage) ||
    pending.response?.kind !== 'choamSale' ||
    !Array.isArray(pending.response.passed) ||
    new Set(pending.response.passed).size !== pending.response.passed.length ||
    pending.response.passed.some((id) => !g.players.some((p) => p.id === id)) ||
    JSON.stringify(pending.market) !== JSON.stringify(g.choamMarket)
  ) return 'The saved Ghola interruption no longer matches its CHOAM sale.';
  const discard = g.pendingTreacheryDiscard;
  if (
    (g.resolvedTreacheryDiscardSequence ?? 0) < pending.discardSequence &&
    !(discard?.sequence === pending.discardSequence &&
      discard.continuation.kind === 'ordinaryCardDiscard' &&
      discard.continuation.effect === 'ghola' &&
      discard.continuation.player === pending.player &&
      discard.continuation.card === pending.card)
  ) return 'The saved market interruption has no matching committed Ghola discard.';
  if (pending.stage === 'discard' && discard?.sequence !== pending.discardSequence)
    return 'The saved Ghola discard stage has no matching continuation.';
  if (pending.stage !== 'discard' &&
      (g.resolvedTreacheryDiscardSequence ?? 0) < pending.discardSequence)
    return 'The suspended market is waiting for its committed Ghola discard.';
  const continuation = discard?.continuation;
  const heldRevival = g.homeworldRevivalReturn;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume, g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
    heldRevival && ['choice', 'arrival'].includes(heldRevival.stage)
      ? { response: heldRevival.resumeResponse } : null];
  const incomes = contexts.flatMap((context) => {
    if (!context) return [];
    const karama = 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context.response, karama?.use?.kind === 'cancel' ? karama.use.response : null];
  }).filter((response) => response?.kind === 'revivalIncome' && response.intent === pending.event);
  if (pending.stage === 'income' && !incomes.length)
    return 'The saved Ghola income has lost its suspended market receipt.';
  if (pending.stage === 'complete' && incomes.length)
    return 'Finish the Ghola income before restoring its sale.';
  if (incomes.some((income) => income!.recipient !== pending.player || income!.amount !== 1 ||
      !g.players.some((p) => p.id === income!.owner && p.faction === 'tleilaxu')))
    return 'The saved Ghola income no longer matches the revived faction.';
  try {
    quoteChoamSaleCancellation(g, pending.response);
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid suspended CHOAM sale.';
  }
  return null;
}
