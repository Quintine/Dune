import type { Game } from './engine';
import { nexusCardMode } from './nexus-cards';

/** The public offer is identical for every loser; only the loser sees eligibility. */
export type NexusMoritaniRetentionReceipt = {
  event: string;
  player: string;
  played: string[];
  eligible: string[];
  stage: 'pending' | 'offer' | 'complete';
  kept?: string | null;
  signature: string;
};

export function nexusMoritaniRetentionSignature(
  receipt: NexusMoritaniRetentionReceipt,
): string {
  return JSON.stringify([
    receipt.event, receipt.player, receipt.played, receipt.eligible,
    receipt.stage, receipt.kept ?? null,
  ]);
}

export function quoteNexusMoritaniRetention(
  game: Game, viewer: string, decision: Game['decision'] = game.decision,
) {
  const pending = game.moritaniRetention;
  if (pending?.source !== 'nexus' || pending.stage !== 'choose' ||
      decision?.kind !== 'moritaniRetention' || decision.player !== viewer ||
      pending.player !== viewer || pending.event !== decision.event)
    return null;
  const owner = game.players.find(player => player.id === viewer)!;
  const canKeep = !owner.ally &&
    game.nexusCards?.cards?.hands[viewer] === 'moritani' &&
    nexusCardMode('moritani', owner.faction, game.players.map(player => player.faction)) === 'secretAlly' &&
    pending.eligible.length > 0;
  return { event: pending.event, canKeep };
}
