/** Written terms remain player-managed. Typed payment terms use the native
 * bribe rules; older two-seat records omit participants and acceptVotes. */
export type PublicDealPayment = {
  kind: 'immediateBribe';
  payer: string;
  recipient: string;
  amount: number;
} | {
  kind: 'deferredBribe';
  payer: string;
  recipient: string;
  amount: number;
  dueTurn: number;
};
export type PublicDealPaymentStatus = 'pending' | 'paid' | 'void' | 'released';
export type PublicDeal = {
  id: string;
  from: string;
  to: string;
  terms: string;
  turn: number;
  status: 'offered' | 'active' | 'declined' | 'withdrawn' | 'released';
  releaseVotes: string[];
  /** Present together only on the multi-party record format. */
  participants?: string[];
  acceptVotes?: string[];
  /** Exact gross bribe; immediate payment settles on final acceptance. */
  payment?: PublicDealPayment;
  /** Present only for accepted or released deferred payments. */
  paymentStatus?: PublicDealPaymentStatus;
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
function participants(players: readonly PublicDealSeat[], ids: readonly string[]): PublicDealSeat[] {
  const seats = ids.map(seat => players.find(player => player.id === seat));
  requireDeal(ids.length >= 2 && ids.length <= 6 && ids.every(id) &&
    new Set(ids).size === ids.length && seats.every(seat => seat && !seat.bot),
  'A deal requires distinct human seats.');
  return seats as PublicDealSeat[];
}
function notAllied(seats: readonly PublicDealSeat[]): void {
  requireDeal(seats.every((seat, index) => seats.slice(index + 1).every(other =>
    seat.ally !== other.id && other.ally !== seat.id)),
  'A deal is available only between seats that are not allied with each other.');
}

/** These accessors do not rewrite legacy two-party saves. Call after validation. */
export function publicDealParticipants(deal: PublicDeal): string[] {
  return deal.participants ? [...deal.participants] : [deal.from, deal.to];
}
export function publicDealAcceptVotes(deal: PublicDeal): string[] {
  if (deal.acceptVotes) return [...deal.acceptVotes];
  return deal.status === 'active' || deal.status === 'released'
    ? [deal.from, deal.to] : [deal.from];
}
function orderedSubset(votes: readonly string[], parties: readonly string[]): boolean {
  return new Set(votes).size === votes.length &&
    votes.every(vote => parties.includes(vote)) &&
    votes.every((vote, index) => index === 0 || parties.indexOf(votes[index - 1]) < parties.indexOf(vote));
}

/** Parse one public gross payment term; no funds move until native settlement. */
export function parsePublicDealPayment(value: unknown, parties: readonly string[], turn?: number): PublicDealPayment {
  requireDeal(object(value) && id(value.payer) && id(value.recipient) && value.payer !== value.recipient &&
    parties.includes(value.payer) && parties.includes(value.recipient) &&
    typeof value.amount === 'number' && Number.isSafeInteger(value.amount) && value.amount > 0,
  'Choose a positive whole bribe between two deal participants.');
  if (value.kind === 'immediateBribe') {
    requireDeal(Object.keys(value).sort().join(',') === 'amount,kind,payer,recipient',
      'Choose an exact immediate bribe term.');
    return { kind: 'immediateBribe', payer: value.payer, recipient: value.recipient, amount: value.amount };
  }
  requireDeal(value.kind === 'deferredBribe' &&
    Object.keys(value).sort().join(',') === 'amount,dueTurn,kind,payer,recipient' &&
    Number.isSafeInteger(turn) && (turn as number) > 0 && value.dueTurn === turn,
  'Choose a deferred bribe due in the deal’s current turn.');
  return { kind: 'deferredBribe', payer: value.payer, recipient: value.recipient,
    amount: value.amount, dueTurn: turn as number };
}

/** Validate persisted ledger shape and lifecycle without applying current
 * alliance restrictions retroactively to existing agreements. */
export function validatePublicDeals(value: unknown, players: readonly PublicDealSeat[]): asserts value is PublicDeal[] {
  roster(players);
  requireDeal(Array.isArray(value), 'The public deal ledger is malformed.');
  const ids = new Set<string>();
  for (const deal of value) {
    const keys = object(deal) ? Object.keys(deal).filter(key => key !== 'payment' && key !== 'paymentStatus').sort().join(',') : '';
    const multi = keys === 'acceptVotes,from,id,participants,releaseVotes,status,terms,to,turn';
    requireDeal(object(deal) && (multi || keys === 'from,id,releaseVotes,status,terms,to,turn') &&
      id(deal.id) && id(deal.from) && id(deal.to) && deal.from !== deal.to &&
      typeof deal.terms === 'string' && deal.terms.length > 0 && deal.terms.length <= 500 && deal.terms === deal.terms.trim() &&
      Number.isSafeInteger(deal.turn) && (deal.turn as number) > 0 &&
      typeof deal.status === 'string' && ['offered', 'active', 'declined', 'withdrawn', 'released'].includes(deal.status) &&
      Array.isArray(deal.releaseVotes) && deal.releaseVotes.every(id),
    'A public deal is malformed.');
    requireDeal(!ids.has(deal.id), 'Public deal IDs must be unique.');
    ids.add(deal.id);

    let parties: string[];
    if (multi) {
      requireDeal(Array.isArray(deal.participants) && deal.participants.length >= 3 &&
        deal.participants.length <= 6 && deal.participants.every(id) &&
        deal.participants[0] === deal.from && deal.participants[1] === deal.to &&
        Array.isArray(deal.acceptVotes) && deal.acceptVotes.every(id), 'The public deal participants are malformed.');
      parties = deal.participants;
      participants(players, parties);
      const accepts = deal.acceptVotes as string[];
      requireDeal(accepts[0] === deal.from && orderedSubset(accepts, parties) &&
        (deal.status === 'active' || deal.status === 'released'
          ? accepts.length === parties.length : accepts.length < parties.length),
      'The public deal has invalid acceptance votes.');
    } else {
      parties = [deal.from, deal.to];
      participants(players, parties);
    }
    const payment = Object.prototype.hasOwnProperty.call(deal, 'payment')
      ? parsePublicDealPayment(deal.payment, parties, deal.turn as number) : undefined;
    if (payment?.kind === 'deferredBribe') {
      const status = deal.paymentStatus;
      requireDeal(deal.status === 'active' ? status === 'pending' || status === 'paid' || status === 'void' :
        deal.status === 'released' ? status === 'released' || status === 'paid' :
          !Object.hasOwn(deal, 'paymentStatus'), 'The deferred payment status does not match the deal lifecycle.');
    } else requireDeal(!Object.hasOwn(deal, 'paymentStatus'),
      'Only an accepted deferred payment has a payment status.');
    const votes = deal.releaseVotes as string[];
    requireDeal(new Set(votes).size === votes.length && votes.every(vote => parties.includes(vote)) &&
      (!multi || orderedSubset(votes, parties)) &&
      (deal.status === 'active' ? votes.length < parties.length :
        deal.status === 'released' ? votes.length === parties.length : votes.length === 0),
    'The public deal has invalid release votes.');
  }
}

function validOffer(players: readonly PublicDealSeat[], actor: string, targets: readonly string[], terms: string, turn: number, event: string): string {
  roster(players);
  requireDeal(id(actor) && id(event) && Number.isSafeInteger(turn) && turn > 0,
    'Choose a current public deal and seated participants.');
  requireDeal(typeof terms === 'string' && terms.trim().length > 0 && terms.trim().length <= 500,
    'Write deal terms between 1 and 500 characters.');
  notAllied(participants(players, [actor, ...targets]));
  return terms.trim();
}

export function createPublicDeal(
  players: readonly PublicDealSeat[], actor: string, target: string, terms: string, turn: number, event: string,
  payment?: PublicDealPayment,
): PublicDeal {
  const text = validOffer(players, actor, [target], terms, turn, event);
  const paymentTerm = arguments.length >= 7 ? { payment: parsePublicDealPayment(payment, [actor, target], turn) } : {};
  return { id: event, from: actor, to: target, terms: text, turn, status: 'offered', releaseVotes: [],
    ...paymentTerm };
}

export function createMultipartyPublicDeal(
  players: readonly PublicDealSeat[], actor: string, targets: readonly string[], terms: string, turn: number, event: string,
  payment?: PublicDealPayment,
): PublicDeal {
  requireDeal(Array.isArray(targets) && targets.length >= 2 && targets.length <= 5,
    'Choose two through five other participants.');
  const text = validOffer(players, actor, targets, terms, turn, event);
  const paymentTerm = arguments.length >= 7 ? { payment: parsePublicDealPayment(payment, [actor, ...targets], turn) } : {};
  return { id: event, from: actor, to: targets[0], terms: text, turn, status: 'offered',
    releaseVotes: [], participants: [actor, ...targets], acceptVotes: [actor],
    ...paymentTerm };
}

export function respondPublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string, accept: boolean): PublicDeal {
  validatePublicDeals([deal], players);
  const parties = publicDealParticipants(deal);
  requireDeal(deal.status === 'offered' && actor !== deal.from && parties.includes(actor) && typeof accept === 'boolean',
    'Only an invited recipient may accept or decline an outstanding deal.');
  if (!accept) return { ...deal, status: 'declined', releaseVotes: [] };
  notAllied(participants(players, parties));
  if (!deal.participants) return { ...deal, status: 'active', releaseVotes: [],
    ...(deal.payment?.kind === 'deferredBribe' ? { paymentStatus: 'pending' as const } : {}) };
  const alreadyAccepted = publicDealAcceptVotes(deal);
  requireDeal(!alreadyAccepted.includes(actor), 'This participant already accepted the offer.');
  const accepts = parties.filter(seat => seat === actor || alreadyAccepted.includes(seat));
  const active = accepts.length === parties.length;
  return { ...deal, acceptVotes: accepts, status: active ? 'active' : 'offered', releaseVotes: [],
    ...(active && deal.payment?.kind === 'deferredBribe' ? { paymentStatus: 'pending' as const } : {}) };
}

export function withdrawPublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'offered' && actor === deal.from,
    'Only the proposer may withdraw an outstanding deal.');
  return { ...deal, status: 'withdrawn', releaseVotes: [] };
}

/** All participants must agree to release; either may withdraw a pending vote. */
export function releasePublicDeal(deal: PublicDeal, players: readonly PublicDealSeat[], actor: string, agree: boolean): PublicDeal {
  validatePublicDeals([deal], players);
  const parties = publicDealParticipants(deal);
  requireDeal(deal.status === 'active' && parties.includes(actor) && typeof agree === 'boolean',
    'Only a participant may change a release vote on an active deal.');
  let votes = deal.releaseVotes.filter(vote => vote !== actor);
  if (agree) votes.push(actor);
  if (deal.participants) votes = parties.filter(seat => votes.includes(seat));
  const released = votes.length === parties.length;
  return { ...deal, status: released ? 'released' : 'active', releaseVotes: votes,
    ...(released && deal.payment?.kind === 'deferredBribe' && deal.paymentStatus !== 'paid'
      ? { paymentStatus: 'released' as const } : {}) };
}

/** The engine must first authorize the native payer and exact bribe action.
 * Apply this transition on its detached action state, so native failure rolls
 * both the payment and the status change back together. */
export function markPublicDealPaid(deal: PublicDeal, players: readonly PublicDealSeat[], payer: string): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'active' && deal.payment?.kind === 'deferredBribe' &&
    deal.paymentStatus === 'pending' && deal.payment.payer === payer,
  'Only the payer may settle a pending deferred deal payment.');
  return { ...deal, paymentStatus: 'paid' };
}

/** The caller must establish actual external impossibility before voiding. */
export function voidPublicDealPayment(deal: PublicDeal, players: readonly PublicDealSeat[]): PublicDeal {
  validatePublicDeals([deal], players);
  requireDeal(deal.status === 'active' && deal.payment?.kind === 'deferredBribe' && deal.paymentStatus === 'pending',
    'Only a pending deferred deal payment can become impossible.');
  return { ...deal, paymentStatus: 'void' };
}
