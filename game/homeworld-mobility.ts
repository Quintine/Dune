import type { Game } from './engine';
import type { HomeworldId } from './homeworld-cards';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

export type HomeworldMobilityContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;

/** Current physical native population, shared by validation, controls and AI.
 * Occupation retention is a separate unresolved lifecycle; this projection
 * does not infer an occupier or award any occupation advantage. */
function populationSide(
  context: HomeworldMobilityContext,
  playerId: string,
  card: HomeworldId,
): 'high' | 'low' | null {
  if (!context.homeworlds?.custody) return null;
  return (
    homeworldPopulations(
      homeworldContext(context),
      context.homeworlds.custody,
    ).find((home) => home.native === playerId && home.card === card)?.side ??
    null
  );
}

/** Only the Atreides Movement advantage: other legal card/auction knowledge
 * is unaffected. Callers still own the ordinary faction and timing checks. */
export function homeworldMovementForesightBlock(
  context: HomeworldMobilityContext,
  playerId: string,
): string | null {
  return populationSide(context, playerId, 'caladan') === 'low'
    ? 'Low-population Caladan prevents the Atreides Movement advantage from inspecting the next Spice Blow.'
    : null;
}

/** Relocation of the stronghold, including special Karama relocation. Troops
 * may still move through a stationary Hidden Mobile Stronghold normally. */
export function homeworldMobileStrongholdMovementBlock(
  context: HomeworldMobilityContext,
  playerId: string,
): string | null {
  return populationSide(context, playerId, 'ix') === 'low'
    ? 'Low-population Ix prevents movement of the Hidden Mobile Stronghold.'
    : null;
}

/** An existing No-Field marker's movement, not its shipment or revelation. */
export function homeworldNoFieldMovementBlock(
  context: HomeworldMobilityContext,
  playerId: string,
): string | null {
  return populationSide(context, playerId, 'richese') === 'low'
    ? 'Low-population Richese prevents movement of a No-Field token.'
    : null;
}

export type HomeworldSpiritualAdvisorQuote = {
  maximum: number;
  blocked: string | null;
};

/** Printed population allowance without requiring an available placement
 * resource. Cancellation validates the denied action without deploying forces;
 * ordinary games can still cancel a saved advisor after reserves disappear. */
export function homeworldSpiritualAdvisorAllowance(
  context: HomeworldMobilityContext,
  playerId: string,
  destination: string,
): number {
  if (
    !context.players.some(
      (p) => p.id === playerId && p.faction === 'beneGesserit',
    )
  )
    return 0;
  const side = populationSide(context, playerId, 'wallach_ix');
  return side === 'low'
    ? 0
    : side === 'high' && destination === 'polar_sink'
      ? 2
      : 1;
}

/** Free accompaniment to another faction's shipment only. Ordinary shipment
 * eligibility, destination legality and Karama windows remain caller-owned;
 * this never restricts paid BG shipments, movement or advisor stance changes.
 * Two advisors is an optional high-Wallach choice only at Polar Sink. */
export function homeworldSpiritualAdvisorQuote(
  context: HomeworldMobilityContext,
  playerId: string,
  destination: string,
): HomeworldSpiritualAdvisorQuote {
  const player = context.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.faction === 'beneGesserit',
  );
  if (!player)
    return {
      maximum: 0,
      blocked: 'Only Bene Gesserit can send spiritual advisors.',
    };
  const allowance = homeworldSpiritualAdvisorAllowance(
    context,
    playerId,
    destination,
  );
  if (allowance === 0)
    return {
      maximum: 0,
      blocked: 'Low-population Wallach IX prevents sending spiritual advisors.',
    };
  if (player.reserves === 0)
    return {
      maximum: 0,
      blocked: 'No reserve force is available to send as a spiritual advisor.',
    };
  return {
    maximum: Math.min(player.reserves, allowance),
    blocked: null,
  };
}

export function homeworldSpiritualAdvisorLimit(
  context: HomeworldMobilityContext,
  playerId: string,
  destination: string,
): number {
  return homeworldSpiritualAdvisorQuote(context, playerId, destination).maximum;
}
