import type { FactionId } from './catalog';

export type TleilaxuSpecialKaramaContext = {
  status: string;
  phase: number;
  advanced: boolean;
  owner: { id: string; faction: FactionId; specialKaramaUsed?: boolean };
  players: readonly { id: string }[];
  /** The authoritative engine supplies current spendable physical card IDs. */
  cards: readonly string[];
  /** The original normal-revival interruption, otherwise a quiet declaration. */
  pendingPlayer: string | null;
  blocked: string | null;
  targetBlocks?: Readonly<Record<string, string | null>>;
};

/** Supplied physical p38 H permits choosing any one player during Revival.
 * Tank count, hidden leader eligibility, prior returns and readiness do not
 * determine permission. Existing enclosing priorities and target exceptions do.
 */
export function quoteTleilaxuSpecialKarama(context: TleilaxuSpecialKaramaContext) {
  let blocked: string | null = null;
  if (!context.advanced) blocked = 'Special Karama powers require the Advanced game.';
  else if (context.owner.faction !== 'tleilaxu') blocked = 'Only native Tleilaxu may use this special Karama.';
  else if (context.status !== 'playing' || context.phase !== 4)
    blocked = 'Declare this special Karama during the Revival Phase.';
  else if (context.owner.specialKaramaUsed)
    blocked = 'Your special Karama power has already been used this game.';
  else if (context.blocked) blocked = context.blocked;
  else if (!context.cards.length) blocked = 'A spendable Karama card is required.';
  const targets = context.players
    .filter(player => context.pendingPlayer === null || player.id === context.pendingPlayer)
    .map(player => ({ player: player.id, blocked: context.targetBlocks?.[player.id] ?? null }));
  if (!blocked && !targets.length) blocked = 'Choose a player in this Revival Phase.';
  return { blocked, cards: [...context.cards], targets, pending: context.pendingPlayer !== null };
}
