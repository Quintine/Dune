import { PHASES, type FactionId } from './catalog';
import type { Game } from './engine';
import { acquireDuke, dukeController, DUKE_VIDAL_ID, type DukeSource } from './duke-vidal';
import { nexusCardMode } from './nexus-cards';
import { nexusCleanPlayBlocked } from './nexus-play-boundary';
import { quoteHomeworldEcazDuke } from './homeworld-ecaz-duke';
import { mixedE3NexusLeaderSkillsProfile, pairedE3NexusLeaderSkillsProfile, standaloneE3NexusLeaderSkillsProfile } from './leader-skill-profile';
import { mixedE3NexusProfile, pairedE3NexusProfile, standaloneE3NexusProfile } from './nexus-module-profile';
import { nexusCoreProfile } from './faction-module-profile';

const SUPPORTED_FACTIONS: Partial<Record<FactionId, true>> = {
  ecaz: true, moritani: true, atreides: true, harkonnen: true,
  emperor: true, fremen: true, guild: true, beneGesserit: true,
};

type DukeBefore = {
  controller: string | null;
  acquiredTurn: number | null;
  source: DukeSource | null;
  leader: { id: typeof DUKE_VIDAL_ID; dead: boolean; capturedBy: null; gholaBy: null };
};

/** A completed physical card play, not a second copy of the Duke's current custody. */
type NexusEcazDukeLivingReceipt = {
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

/** Version two exists only for a real captive, retaining its private original underlay. */
export type NexusEcazDukeCapturedReceipt = Omit<NexusEcazDukeLivingReceipt, 'before' | 'after'> & {
  version: 2;
  before: Omit<DukeBefore, 'leader'> & {
    leader: {
      id: typeof DUKE_VIDAL_ID;
      dead: false;
      deaths: number;
      usedAt: null;
      capturedBy: string;
      gholaBy: null;
      concealed: {
        captor: string; controller: string; dead: false; deaths: number; usedAt: string | null;
      } | null;
    };
  };
  after: NexusEcazDukeLivingReceipt['after'] & {
    leader: {
      id: typeof DUKE_VIDAL_ID; dead: false; deaths: number; usedAt: null;
      capturedBy: null; gholaBy: null; concealed: null;
    };
  };
};
/** New plays bind their actual quiet phase; historical Battle-only formats stay strict. */
type NexusEcazDukeTimedReceipt = {
  version: 3;
  phase: number;
} & (
  | (Omit<NexusEcazDukeLivingReceipt, 'phase'> & { custody: 'ordinary' })
  | (Omit<NexusEcazDukeCapturedReceipt, 'version' | 'phase'> & { custody: 'captured' })
);
type CapturedReceipt = NexusEcazDukeCapturedReceipt |
  Extract<NexusEcazDukeTimedReceipt, { custody: 'captured' }>;
export type NexusEcazDukeReceipt = NexusEcazDukeLivingReceipt |
  NexusEcazDukeCapturedReceipt | NexusEcazDukeTimedReceipt;

function capturedReceipt(receipt: NexusEcazDukeReceipt): receipt is CapturedReceipt {
  return 'version' in receipt && (receipt.version === 2 || receipt.custody === 'captured');
}

export function nexusEcazDukeEvent(
  turn: number, phase: number, owner: string, sequence: number,
  beforeController: string | null, beforeAcquiredTurn: number | null,
): string {
  return JSON.stringify(['nexusEcazDuke', turn, phase, owner, sequence,
    beforeController, beforeAcquiredTurn]);
}

export function nexusEcazDukeSignature(receipt: NexusEcazDukeReceipt): string {
  if (capturedReceipt(receipt)) {
    const leader = receipt.before.leader;
    const hidden = leader.concealed;
    const after = receipt.after;
    return JSON.stringify([receipt.version === 2
      ? 'nexusEcazDukeCapturedReceipt' : 'nexusEcazDukeCapturedTimedReceipt', receipt.version,
      receipt.event, receipt.owner, receipt.ownerFaction, receipt.card, receipt.mode,
      receipt.roster, receipt.advanced, receipt.turn, receipt.phase, receipt.sequence,
      receipt.before.controller, receipt.before.acquiredTurn, receipt.before.source,
      leader.id, leader.dead, leader.deaths, leader.usedAt, leader.capturedBy, leader.gholaBy,
      hidden && [hidden.captor, hidden.controller, hidden.dead, hidden.deaths, hidden.usedAt],
      after.controller, after.acquiredTurn, after.source,
      after.leader.id, after.leader.dead, after.leader.deaths, after.leader.usedAt,
      after.leader.capturedBy, after.leader.gholaBy, after.leader.concealed]);
  }
  return JSON.stringify(['version' in receipt ? 'nexusEcazDukeTimedReceipt' : 'nexusEcazDukeReceipt',
    receipt.event, receipt.owner,
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
  const hidden = duke?.leader.concealed;
  const masked = !!hidden && owner !== hidden.captor && owner !== hidden.controller;
  const eventCustody = masked && duke?.captureVisibility ? duke.captureVisibility : duke;
  const roster = g.players.map(player => player.faction);
  let blocked: string | null = null;
  if (!nexusEcazDukeModeSupported(g) || nexusCardMode('ecaz', holder.faction, roster) !== 'cunning')
    blocked = 'Ecaz Nexus Cunning requires a supported original paired or standalone Ecaz Nexus profile.';
  else if (duke && !duke.leader.dead && quoteHomeworldEcazDuke(g).nativeAcquisitionBlocked)
    blocked = 'Occupied Ecaz reserves Duke Vidal for its occupier or reciprocal ally.';
  else if (holder.ally) blocked = 'Use Ecaz Nexus Cunning while unallied.';
  else if (g.status !== 'playing')
    blocked = 'Wait until play begins before using Ecaz Nexus Cunning.';
  else if (nexusCleanPlayBlocked(g, automaticPending))
    blocked = 'Finish the current interaction before using Ecaz Nexus Cunning.';
  else if (!duke || duke.leader.id !== DUKE_VIDAL_ID || duke.leader.gholaBy)
    blocked = 'Only the shared non-Ghola Duke Vidal can be acquired.';
  else if (duke.leader.capturedBy && (!g.advanced ||
    !g.players.some(player => player.id === duke.leader.capturedBy && player.faction === 'harkonnen')))
    blocked = 'Duke Vidal lacks an original Harkonnen capture source.';
  else {
    try {
      acquireDuke(duke, owner, g.turn, 'ecazNexus');
      if (dukeController(duke) === owner) blocked = 'Ecaz already controls Duke Vidal.';
    } catch {
      blocked = duke.leader.usedAt && !duke.leader.dead
        ? 'Duke Vidal has already been used in battle this turn.'
        : 'Duke Vidal is unavailable for Ecaz Nexus acquisition.';
    }
  }
  return {
    event: nexusEcazDukeEvent(g.turn, g.phase, owner, g.nexusEcazDukeHistory?.length ?? 0,
      eventCustody?.controller ?? null, eventCustody?.acquiredTurn ?? null),
    blocked,
    dukeController: duke
      ? masked
        ? hidden!.controller ?? duke.controller
        : dukeController(duke)
      : null,
  };
}

export function nexusEcazDukeModeSupported(g: Game): boolean {
  if (nexusCoreProfile(g) && g.players.some(player => player.faction === 'ecaz'))
    return !!g.nexusCards?.cards;
  if ((mixedE3NexusProfile(g) || standaloneE3NexusProfile(g) || pairedE3NexusProfile(g)) &&
    g.players.some(player => player.faction === 'ecaz') &&
    !g.sandtrout)
    return !!g.nexusCards?.cards && g.players.length >= 3;
  if (g.leaderSkills && (mixedE3NexusLeaderSkillsProfile(g) || standaloneE3NexusLeaderSkillsProfile(g) || pairedE3NexusLeaderSkillsProfile(g)) &&
    g.players.some(player => player.faction === 'ecaz') && !g.sandtrout)
    return !!g.nexusCards?.cards && g.players.length >= 3;
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
  // History records actual server custody, not an unrelated owner's masked action token.
  const event = nexusEcazDukeEvent(g.turn, g.phase, owner, sequence, duke.controller, duke.acquiredTurn);
  const after = acquireDuke(duke, owner, g.turn, 'ecazNexus');
  if (duke.leader.capturedBy) {
    const hidden = duke.leader.concealed;
    const receipt: Extract<NexusEcazDukeTimedReceipt, { custody: 'captured' }> = {
      version: 3, custody: 'captured',
      event, owner, ownerFaction: 'ecaz', card: 'ecaz', mode: 'cunning',
      roster: g.players.map(player => player.faction), advanced: g.advanced,
      turn: g.turn, phase: g.phase, sequence,
      before: {
        controller: duke.controller, acquiredTurn: duke.acquiredTurn, source: duke.source,
        leader: {
          id: DUKE_VIDAL_ID, dead: false, deaths: duke.leader.deaths, usedAt: null,
          capturedBy: duke.leader.capturedBy, gholaBy: null,
          concealed: hidden ? {
            captor: hidden.captor, controller: hidden.controller!, dead: false,
            deaths: hidden.deaths, usedAt: hidden.usedAt ?? null,
          } : null,
        },
      },
      after: {
        controller: after.controller!, acquiredTurn: after.acquiredTurn!, source: 'ecazNexus',
        leader: {
          id: DUKE_VIDAL_ID, dead: false, deaths: after.leader.deaths, usedAt: null,
          capturedBy: null, gholaBy: null, concealed: null,
        },
      },
      signature: '',
    };
    receipt.signature = nexusEcazDukeSignature(receipt);
    return receipt;
  }
  const receipt: NexusEcazDukeReceipt = {
    version: 3, custody: 'ordinary',
    event, owner, ownerFaction: 'ecaz', card: 'ecaz', mode: 'cunning',
    roster: g.players.map(player => player.faction), advanced: g.advanced,
    turn: g.turn, phase: g.phase, sequence,
    before: {
      controller: duke.controller, acquiredTurn: duke.acquiredTurn, source: duke.source,
      leader: { id: DUKE_VIDAL_ID, dead: duke.leader.dead, capturedBy: null, gholaBy: null },
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

function recordedPhaseValid(g: Game, receipt: NexusEcazDukeReceipt): boolean {
  return 'version' in receipt && receipt.version === 3
    ? Number.isSafeInteger(receipt.phase) && receipt.phase >= 0 && receipt.phase < PHASES.length &&
      (receipt.turn !== g.turn || receipt.phase <= g.phase)
    : receipt.phase === 6 && (receipt.turn !== g.turn || g.phase >= 6);
}

/** Completed history is checked against its original seated roster and mode,
 * never against a later battle's, revival's, or turn's Duke custody or card hand. */
export function validateNexusEcazDuke(
  g: Game, receipt: NexusEcazDukeReceipt, index: number,
): void {
  if (!object(receipt))
    throw new Error('Ecaz Nexus Cunning lost its original physical play.');
  if (capturedReceipt(receipt)) {
    validateCapturedReceipt(g, receipt, index);
    return;
  }
  const before = receipt?.before;
  const after = receipt?.after;
  const leader = before?.leader;
  if (!keys(receipt, 'version' in receipt
    ? 'advanced,after,before,card,custody,event,mode,owner,ownerFaction,phase,roster,sequence,signature,turn,version'
    : 'advanced,after,before,card,event,mode,owner,ownerFaction,phase,roster,sequence,signature,turn') ||
    ('version' in receipt && (receipt.version !== 3 || receipt.custody !== 'ordinary')) ||
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
    !recordedPhaseValid(g, receipt) ||
    !Number.isSafeInteger(index) || index < 0 || receipt.sequence !== index ||
    leader.id !== DUKE_VIDAL_ID || typeof leader.dead !== 'boolean' ||
    leader.capturedBy !== null || leader.gholaBy !== null ||
    (leader.dead &&
      (before.controller !== null || before.acquiredTurn !== null || before.source !== null)) ||
    !(before.controller === null ||
      g.players.some(player => player.id === before.controller)) ||
    (before.controller === null
      ? before.acquiredTurn !== null || before.source !== null
      : !turn(before.acquiredTurn) || before.acquiredTurn > receipt.turn ||
        !['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(before.source as string) ||
        (before.source === 'moritani' &&
          (g.players.find(player => player.id === before.controller)?.faction !== 'moritani' ||
            before.acquiredTurn !== receipt.turn)) ||
        (before.source === 'ecazNexus' &&
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

function validateCapturedReceipt(g: Game, receipt: CapturedReceipt, index: number): void {
  const before = receipt.before;
  const leader = before?.leader;
  const hidden = leader?.concealed;
  const after = receipt.after;
  const returned = after?.leader;
  const controller = g.players.find(player => player.id === before?.controller);
  const captor = g.players.find(player => player.id === leader?.capturedBy);
  if (!keys(receipt, receipt.version === 2
    ? 'advanced,after,before,card,event,mode,owner,ownerFaction,phase,roster,sequence,signature,turn,version'
    : 'advanced,after,before,card,custody,event,mode,owner,ownerFaction,phase,roster,sequence,signature,turn,version') ||
    !(receipt.version === 2 || (receipt.version === 3 && receipt.custody === 'captured')) ||
    !object(before) || !keys(before, 'acquiredTurn,controller,leader,source') ||
    !object(leader) || !keys(leader, 'capturedBy,concealed,dead,deaths,gholaBy,id,usedAt') ||
    !object(after) || !keys(after, 'acquiredTurn,controller,leader,source') ||
    !object(returned) || !keys(returned, 'capturedBy,concealed,dead,deaths,gholaBy,id,usedAt') ||
    !nexusEcazDukeModeSupported(g) ||
    !g.players.some(player => player.id === receipt.owner && player.faction === 'ecaz') ||
    receipt.ownerFaction !== 'ecaz' || receipt.card !== 'ecaz' || receipt.mode !== 'cunning' ||
    !Array.isArray(receipt.roster) || receipt.roster.length !== g.players.length ||
    receipt.roster.some((faction, position) => faction !== g.players[position]?.faction) ||
    nexusCardMode('ecaz', receipt.ownerFaction, receipt.roster) !== 'cunning' ||
    typeof receipt.advanced !== 'boolean' || receipt.advanced !== g.advanced ||
    !turn(receipt.turn) || receipt.turn > g.turn ||
    !recordedPhaseValid(g, receipt) ||
    !Number.isSafeInteger(index) || index < 0 || receipt.sequence !== index ||
    leader.id !== DUKE_VIDAL_ID || leader.dead !== false ||
    !Number.isSafeInteger(leader.deaths) || leader.deaths < 0 ||
    leader.usedAt !== null || leader.gholaBy !== null ||
    !captor || captor.faction !== 'harkonnen' || !receipt.advanced ||
    leader.capturedBy === receipt.owner || leader.capturedBy === before.controller ||
    (before.controller === null
      ? before.acquiredTurn !== null || before.source !== null
      : !controller || !turn(before.acquiredTurn) || before.acquiredTurn > receipt.turn ||
        !['moritani', 'ecaz', 'ecazNexus', 'ally'].includes(before.source as string) ||
        (before.source === 'moritani' && controller.faction !== 'moritani') ||
        (before.source === 'ecazNexus' && controller.faction !== 'ecaz')) ||
    !(hidden === null || (object(hidden) &&
      keys(hidden, 'captor,controller,dead,deaths,usedAt') &&
      hidden.captor === leader.capturedBy && hidden.dead === false &&
      hidden.deaths === leader.deaths &&
      (hidden.usedAt === null || (typeof hidden.usedAt === 'string' && hidden.usedAt.length > 0)) &&
      hidden.controller !== hidden.captor &&
      g.players.some(player => player.id === hidden.controller) &&
      (before.controller === null || hidden.controller === before.controller))) ||
    returned.id !== DUKE_VIDAL_ID || returned.dead !== false ||
    returned.deaths !== leader.deaths || returned.usedAt !== null ||
    returned.capturedBy !== null || returned.gholaBy !== null || returned.concealed !== null ||
    after.controller !== receipt.owner || after.acquiredTurn !== receipt.turn || after.source !== 'ecazNexus' ||
    receipt.event !== nexusEcazDukeEvent(receipt.turn, receipt.phase, receipt.owner, receipt.sequence,
      before.controller, before.acquiredTurn) ||
    receipt.signature !== nexusEcazDukeSignature(receipt))
    throw new Error('Ecaz Nexus Cunning lost its original captured Duke custody or physical play.');
}
