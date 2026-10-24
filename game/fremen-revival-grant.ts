import type { Game } from './engine';

export type FremenRevivalGrantSource = {
  turn: number;
  owner: string;
  recipient: string;
};

export type FremenRevivalGrantContext = Pick<
  Game,
  'status' | 'phase' | 'turn' | 'players' | 'freeRevival' | 'revivalRules' | 'recruits'
>;

export class FremenRevivalGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FremenRevivalGrantError';
  }
}

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Permission only. The engine owns the response and commits or denies this
 * source once; normal revival quotes retain rates, prior usage and payment.
 * No busy gate belongs here because settlement validates its own response. */
export function fremenRevivalGrantBlock(
  g: FremenRevivalGrantContext,
  owner: string,
): string | null {
  if (g.status !== 'playing' || g.phase !== 4 || !count(g.turn) || g.turn < 1)
    return 'Grant Fremen allied free revival during the current Revival phase.';
  if (!id(owner) || !Array.isArray(g.players))
    return 'The grant needs the current native Fremen owner.';
  const owners = g.players.filter(player => player.id === owner);
  const fremen = owners[0];
  if (owners.length !== 1 || fremen.faction !== 'fremen' ||
      g.players.filter(player => player.faction === 'fremen').length !== 1)
    return 'The grant needs the current native Fremen owner.';
  const recipients = g.players.filter(player => player.id === fremen.ally);
  const recipient = recipients[0];
  if (!id(fremen.ally) || recipients.length !== 1 ||
      recipient.id === owner || recipient.ally !== owner)
    return 'The grant needs the Fremen owner’s current mutual ally.';
  if (!Array.isArray(g.freeRevival))
    return 'The current Fremen revival permissions are invalid.';
  if (g.freeRevival.includes(recipient.id))
    return 'Fremen allied free revival has already been granted this phase.';
  if (g.revivalRules?.fremenGrantBlocked !== undefined &&
      (!Array.isArray(g.revivalRules.fremenGrantBlocked) ||
        g.revivalRules.fremenGrantBlocked.some(target => !id(target))))
    return 'The current Fremen grant prevention record is invalid.';
  if (g.revivalRules?.fremenGrantBlocked?.includes(recipient.id))
    return 'Karama prevented this Fremen allied grant for the current Revival phase.';
  if (g.recruits?.turn === g.turn &&
      (!count(recipient.revived) ||
        (recipient.freeForcesRevived === undefined
          ? recipient.revived > 0
          : !count(recipient.freeForcesRevived) ||
            recipient.freeForcesRevived > recipient.revived)))
    return 'The ally’s prior normal revival usage is inconsistent or unknown; this grant cannot safely change its rate.';
  return null;
}

export function quoteFremenRevivalGrant(
  g: FremenRevivalGrantContext,
  owner: string,
): FremenRevivalGrantSource {
  const blocked = fremenRevivalGrantBlock(g, owner);
  if (blocked) throw new FremenRevivalGrantError(blocked);
  const fremen = g.players.find(player => player.id === owner)!;
  return { turn: g.turn, owner, recipient: fremen.ally! };
}

/** Bind the original relationship and turn before either response outcome.
 * No source supplied by a client may retarget a pending grant. */
export function validateFremenRevivalGrant(
  g: FremenRevivalGrantContext,
  source: FremenRevivalGrantSource,
): void {
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      Object.keys(source).sort().join(',') !== 'owner,recipient,turn' ||
      !count(source.turn) || source.turn !== g.turn ||
      !id(source.owner) || !id(source.recipient))
    throw new FremenRevivalGrantError('The Fremen allied revival grant has lost its original source.');
  const current = quoteFremenRevivalGrant(g, source.owner);
  if (current.recipient !== source.recipient)
    throw new FremenRevivalGrantError('The Fremen allied revival grant no longer matches its original ally.');
}

/** Owner-only status. No wallet, Tanks, prior counts or quoted free amount is
 * projected; the existing normal revival panel owns numerical allowances. */
export function projectFremenRevivalGrant(
  g: FremenRevivalGrantContext,
  viewer: string,
): { recipient: string; granted: boolean; blocked: string | null } | null {
  if (!id(viewer) || !Array.isArray(g.players)) return null;
  const owners = g.players.filter(player => player.id === viewer);
  const owner = owners[0];
  if (owners.length !== 1 || owner.faction !== 'fremen' ||
      !id(owner.ally) || owner.ally === owner.id ||
      g.players.filter(player => player.id === owner.ally).length !== 1)
    return null;
  return {
    recipient: owner.ally,
    granted: Array.isArray(g.freeRevival) && g.freeRevival.includes(owner.ally),
    blocked: fremenRevivalGrantBlock(g, viewer),
  };
}
