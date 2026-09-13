import { leaders as printedLeaders, type Leader } from './cards';
import { FACTIONS, type FactionId } from './catalog';

export type MoritaniAssassinateReceipt = {
  event: string;
  turn: number;
  territory: string;
  owner: string;
  opponent: string;
  faction: FactionId;
  opposingLeader: string;
  stage: 'choice' | 'declined' | 'revealed' | 'replaced';
  card: string | null;
  bounty: number;
  replacement: string | null;
  signature: string;
};
export type MoritaniAssassinateState = {
  version: 1;
  owner: string;
  normalTraitorCall: boolean;
  opportunities: MoritaniAssassinateReceipt[];
};
export type MoritaniAssassinateTrigger = {
  advanced: boolean;
  owner: string;
  ownerFaction: FactionId;
  opponent: string;
  faction: FactionId;
  event: string;
  turn: number;
  territory: string;
  opposingLeader: string | null;
  opposingLeaderSurvived: boolean;
  normalBattle: boolean;
  lostBattle: boolean;
  traitorCalled: boolean;
};
export type MoritaniAssassinateContext = {
  state: MoritaniAssassinateState;
  receipt: MoritaniAssassinateReceipt;
  held: readonly string[];
  normallyRevealed: readonly string[];
  leaders: readonly Leader[];
};
/** The engine owns the full traitor universe and the actual Mentat draw.
 * These lists verify the still-reserved and permanently removed card zones. */
export type MoritaniAssassinateCustody = {
  turn: number;
  held: readonly string[];
  removed: readonly string[];
};
export type MoritaniAssassinateChoice = {
  card: string;
  name: string;
  bounty: number;
  dead: boolean;
};

const opponents: readonly FactionId[] = [
  'atreides',
  'beneGesserit',
  'guild',
  'emperor',
  'fremen',
];
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const exact = (value: unknown, keys: readonly string[]): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const identities = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(identifier) &&
  new Set(value).size === value.length;
function requireAssassinate(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function printed(faction: FactionId, id: string) {
  return FACTIONS.some((f) => f.id === faction)
    ? printedLeaders(faction).find((l) => l.id === id)
    : undefined;
}
function ordinaryIdentity(id: string) {
  return FACTIONS.some((f) => printed(f.id, id));
}
/** Consistency proof only; the engine separately binds the battle event and
 * phase continuation. No secret card identity enters this public trigger. */
export function moritaniAssassinateTrigger(
  input: MoritaniAssassinateTrigger,
): boolean {
  return (
    !!input &&
    input.advanced === true &&
    input.ownerFaction === 'moritani' &&
    identifier(input.owner) &&
    identifier(input.opponent) &&
    input.owner !== input.opponent &&
    identifier(input.event) &&
    identifier(input.territory) &&
    Number.isSafeInteger(input.turn) &&
    input.turn > 0 &&
    opponents.includes(input.faction) &&
    identifier(input.opposingLeader) &&
    !!printed(input.faction, input.opposingLeader) &&
    input.opposingLeaderSurvived === true &&
    input.normalBattle === true &&
    input.lostBattle === true &&
    input.traitorCalled === false
  );
}
export function moritaniAssassinateSignature(
  receipt: MoritaniAssassinateReceipt,
): string {
  return JSON.stringify([
    'moritaniAssassinate',
    receipt.event,
    receipt.turn,
    receipt.territory,
    receipt.owner,
    receipt.opponent,
    receipt.faction,
    receipt.opposingLeader,
    receipt.stage,
    receipt.card,
    receipt.bounty,
    receipt.replacement,
  ]);
}
export function createMoritaniAssassinateOpportunity(
  input: MoritaniAssassinateTrigger,
): MoritaniAssassinateReceipt {
  requireAssassinate(
    moritaniAssassinateTrigger(input),
    'Assassinate needs an Advanced native Moritani normal battle loss against a surviving opposing leader, without a traitor call.',
  );
  const receipt: MoritaniAssassinateReceipt = {
    event: input.event,
    turn: input.turn,
    territory: input.territory,
    owner: input.owner,
    opponent: input.opponent,
    faction: input.faction,
    opposingLeader: input.opposingLeader!,
    stage: 'choice',
    card: null,
    bounty: 0,
    replacement: null,
    signature: '',
  };
  receipt.signature = moritaniAssassinateSignature(receipt);
  return receipt;
}

export function validateMoritaniAssassinate(
  state: MoritaniAssassinateState,
  custody?: MoritaniAssassinateCustody,
): void {
  requireAssassinate(
    exact(state, ['version', 'owner', 'normalTraitorCall', 'opportunities']) &&
      state.version === 1 &&
      identifier(state.owner) &&
      typeof state.normalTraitorCall === 'boolean' &&
      Array.isArray(state.opportunities),
    'Invalid saved Moritani Assassinate state.',
  );
  if (custody)
    requireAssassinate(
      Number.isSafeInteger(custody.turn) &&
        custody.turn > 0 &&
        identities(custody.held) &&
        identities(custody.removed) &&
        !custody.held.some((id) => custody.removed.includes(id)),
      'Assassinate has invalid or overlapping physical traitor custody.',
    );
  const events = new Set<string>(),
    used = new Set<FactionId>(),
    cards = new Set<string>();
  for (const [index, r] of state.opportunities.entries()) {
    requireAssassinate(
      exact(r, [
        'event',
        'turn',
        'territory',
        'owner',
        'opponent',
        'faction',
        'opposingLeader',
        'stage',
        'card',
        'bounty',
        'replacement',
        'signature',
      ]) &&
        identifier(r.event) &&
        !events.has(r.event) &&
        identifier(r.territory) &&
        r.owner === state.owner &&
        identifier(r.opponent) &&
        r.opponent !== r.owner &&
        opponents.includes(r.faction) &&
        Number.isSafeInteger(r.turn) &&
        r.turn > 0 &&
        (!custody || r.turn <= custody.turn) &&
        (index === 0 || r.turn >= state.opportunities[index - 1].turn) &&
        identifier(r.opposingLeader) &&
        !!printed(r.faction, r.opposingLeader) &&
        ['choice', 'declined', 'revealed', 'replaced'].includes(r.stage) &&
        r.signature === moritaniAssassinateSignature(r),
      'Assassinate has a changed, duplicated or malformed battle opportunity.',
    );
    events.add(r.event);
    if (r.stage === 'choice' || r.stage === 'declined') {
      requireAssassinate(
        r.card === null &&
          r.bounty === 0 &&
          r.replacement === null &&
          (r.stage !== 'choice' ||
            (index === state.opportunities.length - 1 &&
              (!custody || r.turn === custody.turn))),
        'An unspent Assassinate choice cannot contain a reveal, bounty or replacement.',
      );
      continue;
    }
    const target =
      typeof r.card === 'string' ? printed(r.faction, r.card) : undefined;
    requireAssassinate(
      target &&
        r.card !== r.opposingLeader &&
        !used.has(r.faction) &&
        !cards.has(r.card!) &&
        Number.isSafeInteger(r.bounty) &&
        (r.bounty === 0 || r.bounty === target.strength),
      'Assassinate must use a different native traitor once per opposing faction for zero or printed bounty.',
    );
    used.add(r.faction);
    cards.add(r.card!);
    if (r.stage === 'revealed')
      requireAssassinate(
        r.replacement === null &&
          (!custody ||
            (r.turn === custody.turn &&
              custody.held.includes(r.card!) &&
              !custody.removed.includes(r.card!))),
        'The revealed Assassinate traitor must stay held until its Mentat replacement.',
      );
    else
      requireAssassinate(
        identifier(r.replacement) &&
          ordinaryIdentity(r.replacement) &&
          r.replacement !== r.card &&
          (!custody ||
            (custody.removed.includes(r.card!) &&
              !custody.held.includes(r.card!))),
        'The replaced Assassinate traitor needs one distinct replacement and its face-up removed card.',
      );
  }
}

/** Private diagnostics; callers must never gate a public pause on this result. */
export function moritaniAssassinateChoices(
  context: MoritaniAssassinateContext,
): {
  blocked: string | null;
  cards: MoritaniAssassinateChoice[];
  unavailable: { card: string; reason: string }[];
} {
  const { state, receipt, held, normallyRevealed, leaders } = context;
  validateMoritaniAssassinate(state);
  requireAssassinate(
    identities(held) && identities(normallyRevealed) && Array.isArray(leaders),
    'Assassinate needs distinct held/revealed traitors and the native leader pool.',
  );
  const current = state.opportunities.find((r) => r.event === receipt?.event);
  requireAssassinate(
    current &&
      exact(receipt, Object.keys(current)) &&
      moritaniAssassinateSignature(current) ===
        moritaniAssassinateSignature(receipt) &&
      receipt.signature === current.signature,
    'Choose the original saved Assassinate opportunity.',
  );
  const unavailable: { card: string; reason: string }[] = [];
  const stopped = (blocked: string) => ({ blocked, cards: [], unavailable });
  if (receipt.stage !== 'choice')
    return stopped('This Assassinate opportunity has already ended.');
  if (state.normalTraitorCall)
    return stopped(
      'Assassinate after an ordinary Moritani traitor call awaits its duration ruling.',
    );
  if (
    state.opportunities.some(
      (r) =>
        r.faction === receipt.faction &&
        (r.stage === 'revealed' || r.stage === 'replaced'),
    )
  )
    return stopped('Assassinate has already been used against this faction.');
  const reserved = new Set(
    state.opportunities
      .filter((r) => r.stage === 'revealed' || r.stage === 'replaced')
      .map((r) => r.card!),
  );
  const cards: MoritaniAssassinateChoice[] = [];
  for (const card of held) {
    const native = printed(receipt.faction, card);
    if (!native || card === receipt.opposingLeader) continue;
    let reason: string | null = null;
    if (normallyRevealed.includes(card))
      reason =
        'Using an already normally revealed Traitor Card for Assassinate remains pending.';
    else if (reserved.has(card))
      reason =
        'That Traitor Card is already reserved or removed by Assassinate.';
    const matches = leaders.filter((l) => l.id === card),
      leader = matches[0];
    if (
      !reason &&
      (matches.length !== 1 ||
        !leader ||
        leader.name !== native.name ||
        leader.strength !== native.strength ||
        leader.faction !== receipt.faction ||
        typeof leader.dead !== 'boolean' ||
        leader.capturedBy ||
        leader.gholaBy ||
        leader.concealed ||
        (leader.controller !== undefined &&
          leader.controller !== receipt.opponent))
    )
      reason =
        'Assassinate with missing, altered, captured or foreign-ghola target custody remains pending.';
    if (reason) {
      unavailable.push({ card, reason });
      continue;
    }
    cards.push({
      card,
      name: native.name,
      bounty: leader.dead ? 0 : native.strength,
      dead: leader.dead,
    });
  }
  return {
    blocked: cards.length
      ? null
      : (unavailable[0]?.reason ??
        'No different unrevealed native Traitor Card of this opposing faction is held.'),
    cards,
    unavailable,
  };
}
export function quoteMoritaniAssassinate(
  context: MoritaniAssassinateContext,
  card: string,
): {
  receipt: MoritaniAssassinateReceipt;
  leader: string;
  bounty: number;
  kill: boolean;
} {
  const choices = moritaniAssassinateChoices(context),
    choice = choices.cards.find((c) => c.card === card);
  requireAssassinate(
    !choices.blocked && choice,
    choices.blocked ?? 'Choose one eligible held Traitor Card for Assassinate.',
  );
  const receipt: MoritaniAssassinateReceipt = {
    ...context.receipt,
    stage: 'revealed',
    card: choice.card,
    bounty: choice.bounty,
    replacement: null,
    signature: '',
  };
  receipt.signature = moritaniAssassinateSignature(receipt);
  return {
    receipt,
    leader: choice.card,
    bounty: choice.bounty,
    kill: !choice.dead,
  };
}
