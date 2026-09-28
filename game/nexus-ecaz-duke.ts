import type { FactionId } from './catalog';
import type { Game } from './engine';
import { acquireDuke, DUKE_VIDAL_ID, type DukeSource } from './duke-vidal';
import { nexusCardMode } from './nexus-cards';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';

const SUPPORTED_FACTIONS: Partial<Record<FactionId, true>> = {
  ecaz: true, moritani: true, atreides: true, harkonnen: true,
  emperor: true, fremen: true, guild: true, beneGesserit: true,
};

type DukeBefore = {
  controller: string | null;
  acquiredTurn: number | null;
  source: DukeSource | null;
  leader: { id: typeof DUKE_VIDAL_ID; dead: false; capturedBy: null; gholaBy: null };
};

/** A completed physical card play, not a second copy of the Duke's current custody. */
export type NexusEcazDukeReceipt = {
  event: string;
  owner: string;
  ownerFaction: 'ecaz';
  card: 'ecaz';
  mode: 'cunning';
  roster: FactionId[];
  advanced: boolean;
  turn: number;
  phase: 6;
  sequence: number;
  before: DukeBefore;
  after: { controller: string; acquiredTurn: number; source: 'ecazNexus' };
  signature: string;
};

export function nexusEcazDukeEvent(
  turn: number, phase: number, owner: string, sequence: number,
  beforeController: string | null, beforeAcquiredTurn: number | null,
): string {
  return JSON.stringify(['nexusEcazDuke', turn, phase, owner, sequence,
    beforeController, beforeAcquiredTurn]);
}

export function nexusEcazDukeSignature(receipt: NexusEcazDukeReceipt): string {
  return JSON.stringify(['nexusEcazDukeReceipt', receipt.event, receipt.owner,
    receipt.ownerFaction, receipt.card, receipt.mode, receipt.roster,
    receipt.advanced, receipt.turn, receipt.phase, receipt.sequence,
    receipt.before.controller, receipt.before.acquiredTurn, receipt.before.source,
    receipt.before.leader.id, receipt.before.leader.dead,
    receipt.before.leader.capturedBy, receipt.before.leader.gholaBy,
    receipt.after.controller, receipt.after.acquiredTurn, receipt.after.source]);
}

/** Only the owner can see that the held card is Ecaz Cunning. The boundary is
 * deliberately quiet: this action must not create or interrupt a public pause. */
export function quoteNexusEcazDuke(g: Game, owner: string, automaticPending = false):
  { event: string; blocked: string | null; dukeController: string | null } | null {
  const holder = g.players.find(player => player.id === owner);
  if (!holder || holder.faction !== 'ecaz' ||
    g.nexusCards?.cards?.hands[owner] !== 'ecaz') return null;
  const duke = g.dukeVidal;
  const roster = g.players.map(player => player.faction);
  let blocked: string | null = null;
  if (g.advanced && g.players.some(player => player.faction === 'harkonnen'))
    blocked = 'Duke Vidal battle use is unavailable with Advanced Harkonnen.';
  else if (!nexusEcazDukeModeSupported(g) || nexusCardMode('ecaz', holder.faction, roster) !== 'cunning')
    blocked = 'Ecaz Nexus Cunning currently requires paired Ecaz and Moritani with Nexus alone.';
  else if (holder.ally) blocked = 'Use Ecaz Nexus Cunning while unallied.';
  else if (g.status !== 'playing' || g.phase !== 6)
    blocked = 'Use Ecaz Nexus Cunning at the Battle phase boundary.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using Ecaz Nexus Cunning.';
  else if (!duke || duke.leader.id !== DUKE_VIDAL_ID || duke.leader.dead ||
    duke.leader.capturedBy || duke.leader.gholaBy)
    blocked = 'Only a living, uncaptured, non-Ghola Duke Vidal can be acquired.';
  else if (duke.leader.usedAt)
    blocked = 'Duke Vidal has already been used in battle this turn.';
  else if (duke.controller === owner)
    blocked = 'Ecaz already controls Duke Vidal.';
  return {
    event: nexusEcazDukeEvent(g.turn, 6, owner, g.nexusEcazDukeHistory?.length ?? 0,
      duke?.controller ?? null, duke?.acquiredTurn ?? null),
    blocked,
    dukeController: duke?.controller ?? null,
  };
}

export function nexusEcazDukeModeSupported(g: Game): boolean {
  return !!g.nexusCards?.cards && g.players.length >= 3 && g.players.length <= 6 &&
    g.players.some(player => player.faction === 'ecaz') &&
    g.players.some(player => player.faction === 'moritani') &&
    g.players.every(player => SUPPORTED_FACTIONS[player.faction] === true) &&
    new Set(g.players.map(player => player.faction)).size === g.players.length &&
    !(g.advanced && g.players.some(player => player.faction === 'harkonnen')) &&
    !g.homeworlds && !g.leaderSkills && !g.discoveryEnabled &&
    !g.discoveries && !g.ecazTreachery && !g.sandtrout &&
    !g.techTokens && !g.strongholdCards &&
    g.expansions.every(expansion => expansion === 'ecaz');
}

/** Call before changing the shared disc or discarding the held card. */
export function createNexusEcazDukeReceipt(
  g: Game, owner: string, sequence = g.nexusEcazDukeHistory?.length ?? 0,
): NexusEcazDukeReceipt {
  const offer = quoteNexusEcazDuke(g, owner);
  if (!offer || offer.blocked || sequence !== (g.nexusEcazDukeHistory?.length ?? 0))
    throw new Error(offer?.blocked ?? 'Ecaz Nexus Cunning is unavailable.');
  const duke = g.dukeVidal!;
  const after = acquireDuke(duke, owner, g.turn, 'ecazNexus');
  const receipt: NexusEcazDukeReceipt = {
    event: offer.event, owner, ownerFaction: 'ecaz', card: 'ecaz', mode: 'cunning',
    roster: g.players.map(player => player.faction), advanced: g.advanced,
    turn: g.turn, phase: 6, sequence,
    before: {
      controller: duke.controller, acquiredTurn: duke.acquiredTurn, source: duke.source,
      leader: { id: DUKE_VIDAL_ID, dead: false, capturedBy: null, gholaBy: null },
    },
    after: { controller: after.controller!, acquiredTurn: after.acquiredTurn!, source: 'ecazNexus' },
    signature: '',
  };
  receipt.signature = nexusEcazDukeSignature(receipt);
  return receipt;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string): boolean =>
  Object.keys(value).sort().join(',') === names;
const turn = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

/** Completed history is checked against its original seated roster and mode,
 * never against a later battle's, revival's, or turn's Duke custody or card hand. */
export function validateNexusEcazDuke(
  g: Game, receipt: NexusEcazDukeReceipt, index: number,
): void {
  const before = receipt?.before;
  const after = receipt?.after;
  const leader = before?.leader;
  if (!object(receipt) || !keys(receipt,
    'advanced,after,before,card,event,mode,owner,ownerFaction,phase,roster,sequence,signature,turn') ||
    !object(before) || !keys(before, 'acquiredTurn,controller,leader,source') ||
    !object(leader) || !keys(leader, 'capturedBy,dead,gholaBy,id') ||
    !object(after) || !keys(after, 'acquiredTurn,controller,source') ||
    !nexusEcazDukeModeSupported(g) ||
    !g.players.some(player => player.id === receipt.owner && player.faction === 'ecaz') ||
    receipt.ownerFaction !== 'ecaz' || receipt.card !== 'ecaz' || receipt.mode !== 'cunning' ||
    !Array.isArray(receipt.roster) || receipt.roster.length !== g.players.length ||
    receipt.roster.some((faction, position) => faction !== g.players[position]?.faction) ||
    nexusCardMode('ecaz', receipt.ownerFaction, receipt.roster) !== 'cunning' ||
    typeof receipt.advanced !== 'boolean' || receipt.advanced !== g.advanced ||
    !turn(receipt.turn) || receipt.turn > g.turn ||
    receipt.phase !== 6 || (receipt.turn === g.turn && g.phase < 6) ||
    !Number.isSafeInteger(index) || index < 0 || receipt.sequence !== index ||
    leader.id !== DUKE_VIDAL_ID || leader.dead !== false ||
    leader.capturedBy !== null || leader.gholaBy !== null ||
    !(before.controller === null ||
      g.players.some(player => player.id === before.controller)) ||
    (before.controller === null
      ? before.acquiredTurn !== null || before.source !== null
      : !turn(before.acquiredTurn) || before.acquiredTurn > receipt.turn ||
        !['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(before.source as string) ||
        (before.source === 'moritani' &&
          (g.players.find(player => player.id === before.controller)?.faction !== 'moritani' ||
            before.acquiredTurn !== receipt.turn)) ||
        ((before.source === 'ecaz' || before.source === 'ecazNexus') &&
          g.players.find(player => player.id === before.controller)?.faction !== 'ecaz') ||
        (before.source === 'ecazNexus' && before.acquiredTurn !== receipt.turn)) ||
    before.controller === receipt.owner ||
    after.controller !== receipt.owner || after.source !== 'ecazNexus' ||
    after.acquiredTurn !== receipt.turn ||
    receipt.event !== nexusEcazDukeEvent(receipt.turn, receipt.phase,
      receipt.owner, receipt.sequence, before.controller, before.acquiredTurn) ||
    receipt.signature !== nexusEcazDukeSignature(receipt))
    throw new Error('Ecaz Nexus Cunning lost its original Duke custody or physical play.');
}
