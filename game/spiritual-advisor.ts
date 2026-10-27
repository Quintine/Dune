import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { FactionId } from './catalog';
import type { Game } from './engine';
import { validCaladanEntryParent, validateCaladanTerrorPacket, type CaladanEntryParent } from './caladan-arrival';
import { currentHomeworldRevivalArrival } from './homeworld-revival-return';
import { presenceAt, type ForcePresence } from './force-presence';

export type SpiritualAdvisorSource = {
  event: string;
  owner: string;
  turn: number;
  phase: number;
  territory: string;
  sector: number;
  amount: number;
  revivalEvent?: string;
  victoryEvent?: string;
};

export type SpiritualAdvisorPlayer = ForcePresence & {
  id: string;
  faction: FactionId;
  advisors?: Readonly<Record<string, unknown>>;
};

export type SpiritualAdvisorBoardContext = {
  advanced: boolean;
  players: readonly SpiritualAdvisorPlayer[];
};

export type SpiritualAdvisorContext = SpiritualAdvisorBoardContext & MobileBoard & {
  status: string;
  turn: number;
  phase: number;
  homeworldRevivalReturn?: Pick<NonNullable<Game['homeworldRevivalReturn']>, 'event' | 'turn' | 'phase' | 'stage' | 'destination'>;
  homeworldVictoryReinforcement?: Pick<NonNullable<Game['homeworldVictoryReinforcement']>, 'event' | 'turn' | 'phase' | 'stage'> &
    Partial<Pick<NonNullable<Game['homeworldVictoryReinforcement']>, 'player' | 'destination' | 'terrorArrivals'>>;
  pendingSpiritualAdvisor?: Pick<NonNullable<Game['pendingSpiritualAdvisor']>, 'event' | 'turn' | 'phase'> & {
    decision: Pick<NonNullable<Game['pendingSpiritualAdvisor']>['decision'], 'player' | 'destination' | 'ambassadorEvent' | 'revivalEvent'> & {shipment?:string;caladanArrival?:CaladanEntryParent};
  };
  pendingAmbassador?: Pick<NonNullable<Game['pendingAmbassador']>,
    'event' | 'revivalEvent' | 'victoryEvent' | 'turn' | 'phase' | 'stage' | 'effect' | 'shipmentReceipt'> | null;
};

export type SpiritualAdvisorTarget = string | { territory: string; sector?: number };

export class SpiritualAdvisorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpiritualAdvisorError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireSpiritual(value: unknown, message: string): asserts value {
  if (!value) throw new SpiritualAdvisorError(message);
}

function nativeOwner(ctx: SpiritualAdvisorBoardContext, owner: string) {
  const players = ctx.players.filter((player) => player.id === owner);
  return players.length === 1 && players[0].faction === 'beneGesserit' ? players[0] : undefined;
}

function territoryId(target: SpiritualAdvisorTarget) {
  return typeof target === 'string' ? target : target.territory;
}

function hasResidents(player: SpiritualAdvisorPlayer, territory: string) {
  return Object.entries(player.forces).some(([key, count]) =>
    splitLocation(key).territory === territory && count > 0);
}

/** Physical28's Advanced Spiritual exception does not change ordinary arrival.
 * Polar Sink retains the selected provisional fallback, even with BG fighters. */
export function spiritualAdvisorTargetBlock(
  ctx: SpiritualAdvisorBoardContext,
  owner: string,
  target: SpiritualAdvisorTarget,
): string | null {
  if (!ctx.advanced) return null;
  const player = nativeOwner(ctx, owner);
  if (!player) return 'Spiritual Advisors need the current native Bene Gesserit owner.';
  const territory = territoryId(target);
  if (territory === 'polar_sink') return null;
  return hasResidents(player, territory) && !player.advisors?.[territory]
    ? 'Advanced Spiritual Advisors cannot accompany into a non-Polar territory containing your fighters; choose the Polar Sink or decline. Intrusion that already made them advisors removes this block.'
    : null;
}

/** Describe the incoming advisor group; target and resource permission remain
 * separate. No resident group or prior continuously-alone hold is changed. */
export function spiritualAdvisorArrival(
  ctx: SpiritualAdvisorBoardContext,
  owner: string,
  target: SpiritualAdvisorTarget,
): { advisors: boolean; matching: boolean; alone: boolean } {
  if (!ctx.advanced) return { advisors: false, matching: false, alone: false };
  const player = nativeOwner(ctx, owner);
  requireSpiritual(player, 'Spiritual Advisors need the current native Bene Gesserit owner.');
  const territory = territoryId(target);
  const matching = hasResidents(player, territory) && !player.advisors?.[territory];
  return {
    advisors: !matching,
    matching,
    alone: !ctx.players.some((other) => other.id !== owner && presenceAt(other, territory) > 0),
  };
}

/** Original foreign-shipment event and packet bind a prevented matching retry.
 * Destination sector does not create another use of the same opportunity. */
export function spiritualAdvisorMatchingKey(source: SpiritualAdvisorSource): string {
  return JSON.stringify([
    'spiritualAdvisorMatching', source.event, source.owner, source.turn, source.territory, source.amount,
  ]);
}

/** Public receipt only. Native resource entitlement and target permissions are
 * checked by the original shipment parent, before any physical placement. */
export function validateSpiritualAdvisorSource(ctx: SpiritualAdvisorContext, source: SpiritualAdvisorSource): void {
  requireSpiritual(record(source) &&
    Object.keys(source).sort().join(',') === (source.phase === 4
      ? 'amount,event,owner,phase,revivalEvent,sector,territory,turn' : source.victoryEvent !== undefined
      ? 'amount,event,owner,phase,sector,territory,turn,victoryEvent' : 'amount,event,owner,phase,sector,territory,turn') &&
    identifier(source.event) && identifier(source.owner) && positive(source.turn) && source.turn === ctx.turn &&
    source.phase === ctx.phase && [1, 3, 4, 5, 6, 8].includes(source.phase) && ctx.status === 'playing' &&
    identifier(source.territory) && Number.isSafeInteger(source.sector) && source.sector >= 0 &&
    (source.amount === 1 || source.amount === 2),
  'Spiritual Advisors lost their exact current-turn public shipment source.');
  requireSpiritual(nativeOwner(ctx, source.owner), 'Spiritual Advisors lost their current native Bene Gesserit owner.');
  requireSpiritual(gameTerritories(ctx).some((place) =>
    place.id === source.territory && place.sectors.includes(source.sector)),
  'Spiritual Advisors need their current board destination and sector.');
  if (source.victoryEvent !== undefined)
    requireSpiritual(source.phase === 6, 'A Caladan child source belongs only to its original Battle phase.');
  if (source.phase === 6) {
    const parent = ctx.homeworldVictoryReinforcement;
    requireSpiritual(record(parent) && identifier(parent.event) && parent.turn === ctx.turn &&
      parent.phase === 6 && parent.stage === 'arrival',
    'Victory Spiritual Advisors need their original current-turn Caladan arrival parent.');
    const frame = ctx.pendingSpiritualAdvisor, ambassador = ctx.pendingAmbassador;
    const decision = frame?.decision;
    if (decision?.caladanArrival) {
      const child=decision.caladanArrival;
      requireSpiritual(record(frame) && frame.event===source.event && frame.turn===ctx.turn && frame.phase===6 &&
        decision.player===source.owner && decision.ambassadorEvent===undefined && decision.revivalEvent===undefined &&
        validCaladanEntryParent(child) && child.spiritual===undefined && child.event===parent.event &&
        source.victoryEvent===parent.event && identifier(parent.player) && identifier(parent.destination) &&
        decision.shipment===child.terror.owner && decision.destination===`${child.terror.territory}:${child.terror.sector}`,
        'Victory Spiritual Advisors need their original committed Sneak Attack group.');
      try { validateCaladanTerrorPacket({turn:ctx.turn,phase:ctx.phase,players:ctx.players,
        victoryPlayer:parent.player,terrorArrivals:parent.terrorArrivals??[]},child.terror,parent.destination,parent.event); }
      catch { throw new SpiritualAdvisorError('Victory Spiritual Advisors lost their committed Sneak Attack history.'); }
      requireSpiritual(source.territory===child.terror.territory || source.territory==='polar_sink',
        'Victory Spiritual Advisors need the actual Sneak Attack territory or Polar Sink.');
      return;
    }
    requireSpiritual(source.victoryEvent===undefined, 'This Guild Ambassador source does not carry a Sneak Attack grant.');
    requireSpiritual(record(frame) && frame.event === source.event && frame.turn === ctx.turn && frame.phase === 6 &&
      record(decision) && decision.player === source.owner && identifier(decision.ambassadorEvent) &&
      decision.revivalEvent === undefined && record(ambassador) && ambassador.event === decision.ambassadorEvent &&
      ambassador.victoryEvent === parent.event && ambassador.revivalEvent === undefined &&
      ambassador.turn === ctx.turn && ambassador.phase === 6 && ambassador.stage === 'arrival' && ambassador.effect === 'guild',
    'Victory Spiritual Advisors need their original owned Guild Ambassador child.');
    const receipt = ambassador.shipmentReceipt;
    requireSpiritual(record(receipt) && receipt.next === 'advisor' && record(receipt.order) &&
      identifier(receipt.order.territory) && Number.isSafeInteger(receipt.order.sector) &&
      identifier(decision.destination),
    'Victory Spiritual Advisors need their original committed Guild shipment destination.');
    const destination = splitLocation(decision.destination);
    requireSpiritual(decision.destination === `${destination.territory}:${destination.sector}` &&
      decision.destination === `${receipt.order.territory}:${receipt.order.sector}` &&
      gameTerritories(ctx).some(place => place.id === destination.territory && place.sectors.includes(destination.sector)),
    'Victory Spiritual Advisors need their original board Guild shipment destination.');
    requireSpiritual(source.territory === destination.territory || source.territory === 'polar_sink',
    'Victory Spiritual Advisors need the original Guild shipment territory or Polar Sink.');
  }
  if (source.phase === 4) {
    const parent = currentHomeworldRevivalArrival(ctx.homeworldRevivalReturn);
    requireSpiritual(identifier(source.revivalEvent) && record(parent) &&
      parent.event === source.revivalEvent && parent.turn === ctx.turn && parent.phase === 4 &&
      parent.stage === 'arrival' && identifier(parent.destination),
    'Revival Spiritual Advisors need their original current-turn arrival parent.');
    const destination = splitLocation(parent.destination);
    requireSpiritual(parent.destination === `${destination.territory}:${destination.sector}` &&
      gameTerritories(ctx).some(place => place.id === destination.territory && place.sectors.includes(destination.sector)),
    'Revival Spiritual Advisors need their original board arrival parent.');
    const frame = ctx.pendingSpiritualAdvisor, ambassador = ctx.pendingAmbassador;
    const decision = frame?.decision;
    const childDestination = identifier(decision?.destination) ? splitLocation(decision.destination) : null;
    const guildChild = record(frame) && frame.event === source.event && frame.turn === ctx.turn && frame.phase === 4 &&
      record(decision) && decision.player === source.owner && identifier(decision.ambassadorEvent) &&
      (decision.revivalEvent === undefined || decision.revivalEvent === source.revivalEvent) &&
      record(ambassador) && ambassador.event === decision.ambassadorEvent && ambassador.revivalEvent === source.revivalEvent &&
      ambassador.turn === ctx.turn && ambassador.phase === 4 && ambassador.stage === 'arrival' &&
      childDestination && decision.destination === `${childDestination.territory}:${childDestination.sector}` &&
      gameTerritories(ctx).some(place => place.id === childDestination.territory && place.sectors.includes(childDestination.sector)) &&
      source.territory === childDestination.territory;
    requireSpiritual(source.territory === 'polar_sink' ||
      (decision?.ambassadorEvent !== undefined ? guildChild : source.territory === destination.territory),
    'Revival Spiritual Advisors need the original board arrival, its owned Guild shipment or Polar Sink.');
  }
}
