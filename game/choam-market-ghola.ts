import type { Game, ResponseWindow } from './engine';
import type { ChoamMarket } from './choam-market';
import { quoteChoamSaleCancellation } from './choam-sale-cancellation';
import { CHOAM_AUDITOR_ID } from './cards';

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
  /** New Skills interruptions bind their committed revival through the optional choice. */
  leaderSkill?: {
    leader: string | null;
    offer: string | null;
    completed: boolean;
    signature: string;
  };
};

export function choamGholaEvent(pending: Pick<ChoamMarketGhola,
  'turn' | 'phase' | 'player' | 'card' | 'discardSequence'>) {
  return JSON.stringify(['choamGhola', pending.turn, pending.phase,
    pending.player, pending.card, pending.discardSequence]);
}

export function choamGholaSkillSignature(pending: ChoamMarketGhola): string {
  const skill = pending.leaderSkill;
  return JSON.stringify(['choamGholaSkill', pending.event, skill?.leader,
    skill?.offer, skill?.completed]);
}

export function choamGholaSkillOfferEvent(pending: ChoamMarketGhola, leader: string): string {
  return JSON.stringify(['choamGholaSkillOffer', pending.event, leader]);
}

function skillRevivalError(
  g: Game,
  pending: ChoamMarketGhola,
  decisions: readonly (Game['decision'] | undefined)[],
): string | null {
  const record = pending.leaderSkill;
  if (!g.leaderSkills && !record) return null;
  if (!g.leaderSkills || !record ||
      !(record.leader === null || (typeof record.leader === 'string' && record.leader)) ||
      !(record.offer === null || (typeof record.offer === 'string' && record.offer)) ||
      typeof record.completed !== 'boolean' || record.signature !== choamGholaSkillSignature(pending))
    return 'The saved market Ghola lost its committed Leader Skill revival.';
  const owner = g.players.find(player => player.id === pending.player)!;
  const leader = owner.leaders.find(candidate => candidate.id === record.leader);
  if (record.leader !== null && (!leader || leader.dead || leader.capturedBy || leader.gholaBy))
    return 'The market Ghola no longer has its own revived leader.';
  const offer = g.leaderSkills.offers[pending.player];
  if (record.offer === null) {
    if (!record.completed || offer || (record.leader !== null && record.leader !== CHOAM_AUDITOR_ID &&
        !g.leaderSkills.assignments.some(assignment => assignment.owner === pending.player)))
      return 'This market Ghola cannot omit its optional Leader Skill offer.';
    return null;
  }
  if (record.leader === null)
    return 'A market Ghola skill offer must name its revived leader.';
  if (record.offer !== choamGholaSkillOfferEvent(pending, record.leader))
    return 'The market Ghola skill event no longer matches its committed revival.';
  if (record.completed) {
    if (offer) return 'The completed market Ghola still has an unresolved skill offer.';
  } else {
    if (!offer || offer.event !== record.offer || offer.leader !== record.leader)
      return 'The market Ghola lost its original leader or optional skill offer.';
    // An ordinary-card/Truthtrance disposal may temporarily hold this owned
    // decision in its continuation. Its exact event remains required there.
    if (pending.stage === 'complete' &&
        !decisions.some(decision => decision?.kind === 'leaderSkillRevival' &&
          decision.player === pending.player && decision.event === record.offer))
      return 'The completed Ghola is waiting for its owned Leader Skill decision.';
  }
  return null;
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
  const marketOffers = Object.entries(g.leaderSkills?.offers ?? {})
    .filter(([, offer]) => typeof offer?.event === 'string' && offer.event.startsWith('["choamGholaSkillOffer",'));
  if (marketOffers.length && (!pending || marketOffers.length !== 1 || marketOffers[0][0] !== pending.player))
    return 'The Ghola Leader Skill offer lost its suspended market.';
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
  const skillError = skillRevivalError(g, pending,
    contexts.map(context => context && 'decision' in context ? context.decision : undefined));
  if (skillError) return skillError;
  try {
    quoteChoamSaleCancellation(g, pending.response);
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid suspended CHOAM sale.';
  }
  return null;
}
