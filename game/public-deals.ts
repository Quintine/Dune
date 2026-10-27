/** A public agreement between two human seats. Terms are recorded, not parsed
 * or automatically enforced by the game engine. */
export type PublicDeal = {
  id: string;
  from: string;
  to: string;
  terms: string;
  turn: number;
  status: 'offered' | 'active' | 'declined' | 'withdrawn' | 'released';
  releaseVotes: string[];
};

export type PublicDealSeat = { id: string; bot?: unknown; ally?: string | null };

export class PublicDealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicDealError';
  }
}

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireDeal(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PublicDealError(message);
}

function roster(players: readonly PublicDealSeat[]): void {
  requireDeal(Array.isArray(players) && players.length >= 1 && players.length <= 6 &&
    players.every(player => object(player) && id(player.id)) &&
    new Set(players.map(player => player.id)).size === players.length,
  'A deal requires distinct seated players.');
}
function participants(players: readonly PublicDealSeat[], from: string, to: string): [PublicDealSeat, PublicDealSeat] {
  const proposer = players.find(player => player.id === from);
  const recipient = players.find(player => player.id === to);
  requireDeal(proposer && recipient && proposer !== recipient && !proposer.bot && !recipient.bot,
    'A deal requires two different human seats.');
  return [proposer, recipient];
}
function notAllied(from: PublicDealSeat, to: PublicDealSeat): void {
  requireDeal(from.ally !== to.id && to.ally !== from.id,
    'This deal is available only between seats that are not already allied.');
}

/** Validate the persisted public ledger without imposing current alliance state
 * on earlier offers or active agreements. */
export function validatePublicDeals(value: unknown, players: readonly PublicDealSeat[]): asserts value is PublicDeal[] {
  roster(players);
  requireDeal(Array.isArray(value), 'The public deal ledger is malformed.');
  const ids = new Set<string>();
  for (const deal of value) {
    requireDeal(object(deal) && Object.keys(deal).sort().join(',') === 'from,id,releaseVotes,status,terms,to,turn' &&
      id(deal.id) && id(deal.from) && id(deal.to) && deal.from !== deal.to &&
      typeof deal.terms === 'string' && deal.terms.length > 0 && deal.terms.length <= 500 && deal.terms === deal.terms.trim() &&
      Number.isSafeInteger(deal.turn) && (deal.turn as number) > 0 &&
      typeof deal.status === 'string' && ['offered', 'active', 'declined', 'withdrawn', 'released'].includes(deal.status) &&
      Array.isArray(deal.releaseVotes) && deal.releaseVotes.every(id),
    'A public deal is malformed.');
    requireDeal(!ids.has(deal.id), 'Public deal IDs must be unique.');
    ids.add(deal.id);
    participants(players, deal.from, deal.to);
    const votes = deal.releaseVotes as string[];
    requireDeal(new Set(votes).size === votes.length && votes.every(vote => vote === deal.from || vote === deal.to) &&
      (deal.status === 'active' ? votes.length <= 1 : deal.status === 'released' ? votes.length === 2 : votes.length === 0),
    'The public deal has invalid release votes.');
  }
}

export function createPublicDeal(
  players: readonly PublicDealSeat[], actor: string, target: string, terms: string, turn: number, event: string,
): PublicDeal {
  roster(players);
  requireDeal(id(actor) && id(target) && actor !== target && id(event) && Number.isSafeInteger(turn) && turn > 0,
    'Choose a current public deal and two different seats.');
  requireDeal(typeof terms === 'string' && terms.trim().length > 0 && terms.trim().length <= 500,
    'Write deal terms between 1 and 500 characters.');
  const [from, to] = participants(players, actor, target);
  notAllied(from, to);
  return { id: event, from: actor, to: target, terms: terms.trim(), turn, status: 'offered', releaseVotes: [] };
}

export function respondPublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string, accept: boolean): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'offered' && actor === deal.to && typeof accept === 'boolean',
    'Only the recipient may accept or decline an outstanding deal.');
  if (accept) notAllied(...participants(players, deal.from, deal.to));
  return { ...deal, status: accept ? 'active' : 'declined', releaseVotes: [] };
}

export function withdrawPublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'offered' && actor === deal.from,
    'Only the proposer may withdraw an outstanding deal.');
  return { ...deal, status: 'withdrawn', releaseVotes: [] };
}

/** Each participant can vote to release an active deal or withdraw their vote.
 * Both votes release it permanently, even if the players later become allies. */
export function releasePublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string, agree: boolean): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'active' && (actor === deal.from || actor === deal.to) && typeof agree === 'boolean',
    'Only a participant may change a release vote on an active deal.');
  const votes = deal.releaseVotes.filter(vote => vote !== actor);
  if (agree) votes.push(actor);
  return { ...deal, status: votes.length === 2 ? 'released' : 'active', releaseVotes: votes };
}
