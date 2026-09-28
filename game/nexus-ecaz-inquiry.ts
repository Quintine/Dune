import type { Game, Player } from './engine';
import type { FactionId } from './catalog';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { nexusCardMode } from './nexus-cards';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';

export type EcazInquiryReceipt = {
  event: string;
  owner: string;
  ownerFaction: FactionId;
  target: string;
  targetFaction: FactionId;
  turn: number;
  phase: number;
  scope: 'native';
  answer: boolean;
  signature: string;
};

export function ecazInquiryEvent(turn: number, phase: number, owner: string, index: number): string {
  return JSON.stringify(['nexusEcazInquiry', turn, phase, owner, index]);
}

export function ecazInquirySignature(receipt: EcazInquiryReceipt): string {
  return JSON.stringify([receipt.event, receipt.owner, receipt.ownerFaction, receipt.target,
    receipt.targetFaction, receipt.turn, receipt.phase, receipt.scope, receipt.answer]);
}

/** No target hand or leader custody is read while offering every public target. */
export function quoteEcazInquiry(g: Game, owner: string, automaticPending = false) {
  const holder = g.players.find(player => player.id === owner);
  if (!holder || g.nexusCards?.cards?.hands[owner] !== 'ecaz' ||
    nexusCardMode('ecaz', holder.faction, g.players.map(player => player.faction)) !== 'secretAlly')
    return null;
  let blocked: string | null = null;
  if (holder.ally) blocked = 'Use a Nexus card while unallied.';
  else if (g.status !== 'playing') blocked = 'Use Ecaz Secret Ally during play.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using Ecaz Secret Ally.';
  return {
    event: ecazInquiryEvent(g.turn, g.phase, owner, g.nexusEcazInquiries?.length ?? 0),
    blocked,
    targets: g.players.map(player => ({ id: player.id, name: player.name })),
  };
}

/** Native printed leader identity survives death, capture and later revival.
 * Foreign Ghola discs and the separate Duke/Cheap Hero identities do not enter. */
export function ecazInquiryAnswer(owner: Player, target: Player): boolean {
  return owner.leaders.some(leader => leader.faction === owner.faction &&
    leader.id !== DUKE_VIDAL_ID && target.traitors.includes(leader.id));
}

export function ecazInquiryHistory(g: Game, owner: string) {
  const visible: Pick<EcazInquiryReceipt, 'event' | 'target' | 'turn' | 'phase' | 'answer'>[] = [];
  for (const receipt of g.nexusEcazInquiries ?? [])
    if (receipt.owner === owner)
      visible.push({ event: receipt.event, target: receipt.target,
        turn: receipt.turn, phase: receipt.phase, answer: receipt.answer });
  return visible;
}

/** Historical answers do not re-read a hand changed after the accepted play. */
export function validateEcazInquiry(g: Game, receipt: EcazInquiryReceipt, index: number): void {
  const owner = g.players.find(player => player.id === receipt?.owner);
  const target = g.players.find(player => player.id === receipt?.target);
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
    Object.keys(receipt).sort().join(',') !==
      'answer,event,owner,ownerFaction,phase,scope,signature,target,targetFaction,turn' ||
    !owner || !target || !!g.players.find(player => player.faction === 'ecaz') ||
    !g.nexusCards?.cards || owner.faction !== receipt.ownerFaction ||
    target.faction !== receipt.targetFaction || receipt.scope !== 'native' ||
    typeof receipt.answer !== 'boolean' ||
    !Number.isSafeInteger(receipt.turn) || receipt.turn < 1 || receipt.turn > g.turn ||
    !Number.isSafeInteger(receipt.phase) || receipt.phase < 0 || receipt.phase > 8 ||
    (receipt.turn === g.turn && receipt.phase > g.phase) ||
    receipt.event !== ecazInquiryEvent(receipt.turn, receipt.phase, receipt.owner, index) ||
    receipt.signature !== ecazInquirySignature(receipt))
    throw new Error('Ecaz Nexus inquiry lost its original private answer or seated factions.');
}
