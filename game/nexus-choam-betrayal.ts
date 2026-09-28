import type { Card } from './cards';
import type { Game } from './engine';
import { nexusCardMode } from './nexus-cards';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';

export type NexusChoamBetrayalOffer = Readonly<{
  event: string;
  blocked: string | null;
  target: Readonly<{ id: string; name: string; handSize: number | null }>;
}>;

/** The sampled card is a private, committed Treachery identity, not offer data. */
export type NexusChoamBetrayal = {
  event: string;
  turn: number;
  phase: number;
  owner: string;
  target: string;
  card: string;
  handBefore: number;
  stage: 'discard' | 'complete';
  signature: string;
};

export function nexusChoamBetrayalEvent(
  turn: number, phase: number, owner: string, target: string,
): string {
  return JSON.stringify(['nexusChoamBetrayal', turn, phase, owner, target]);
}

export function nexusChoamBetrayalSignature(record: NexusChoamBetrayal): string {
  return JSON.stringify([record.event, record.turn, record.phase, record.owner,
    record.target, record.card, record.handBefore, record.stage]);
}

/** The hand count is public during Bidding only; identities are never offer data. */
export function quoteNexusChoamBetrayal(
  g: Game, owner: string, automaticPending = false,
): NexusChoamBetrayalOffer | null {
  const holder = g.players.find(player => player.id === owner);
  const choam = g.players.find(player => player.faction === 'choam');
  if (!holder || !choam || choam.id === owner ||
    g.nexusCards?.cards?.hands[owner] !== 'choam' ||
    nexusCardMode('choam', holder.faction, g.players.map(player => player.faction)) !== 'betrayal')
    return null;
  const handSize = g.phase === 3 ? choam.hand.length : null;
  let blocked: string | null = null;
  if (holder.ally) blocked = 'Use a Nexus card while unallied.';
  else if (g.status !== 'playing') blocked = 'Use CHOAM Betrayal during play.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using CHOAM Betrayal.';
  else if (handSize === 0) blocked = 'CHOAM has no Treachery cards to discard.';
  return {
    event: nexusChoamBetrayalEvent(g.turn, g.phase, owner, choam.id),
    blocked,
    target: { id: choam.id, name: choam.name, handSize },
  };
}

/** Verify intrinsic history against the original seated Betrayal mode and one
 * conserved physical card, without requiring its former hand to remain held. */
export function validateNexusChoamBetrayal(
  g: Game, record: NexusChoamBetrayal, physicalCards: readonly Card[],
): void {
  const keys = 'card,event,handBefore,owner,phase,signature,stage,target,turn';
  const owner = record && g.players.find(player => player.id === record.owner);
  const target = record && g.players.find(player => player.id === record.target);
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
    Object.keys(record).sort().join(',') !== keys ||
    !owner || !target || owner.id === target.id || target.faction !== 'choam' ||
    owner.faction === 'choam' ||
    nexusCardMode('choam', owner.faction, g.players.map(player => player.faction)) !== 'betrayal' ||
    !Number.isSafeInteger(g.turn) || g.turn < 1 ||
    !Number.isSafeInteger(g.phase) || g.phase < 0 || g.phase > 8 ||
    !Number.isSafeInteger(record.turn) || record.turn < 1 || record.turn > g.turn ||
    !Number.isSafeInteger(record.phase) || record.phase < 0 || record.phase > 8 ||
    (record.turn === g.turn && record.phase > g.phase) ||
    !Number.isSafeInteger(record.handBefore) || record.handBefore < 1 ||
    typeof record.card !== 'string' || !record.card.trim() ||
    (record.stage !== 'discard' && record.stage !== 'complete') ||
    record.event !== nexusChoamBetrayalEvent(record.turn, record.phase,
      record.owner, record.target) ||
    record.signature !== nexusChoamBetrayalSignature(record) ||
    !Array.isArray(physicalCards))
    throw new Error('CHOAM Betrayal has lost its original roster, event or physical Treachery card.');
  let matches = 0;
  for (const card of physicalCards)
    if (card?.id === record.card) matches++;
  if (matches !== 1)
    throw new Error('CHOAM Betrayal has lost its original physical Treachery card.');
}
