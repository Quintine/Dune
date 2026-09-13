import { LEADER_SKILL_CARDS, type LeaderSkillId } from './leader-skill-cards';

export type LeaderSkillOffer = {
  event: string;
  /** An empty revival offer is the choice whether to draw, not a free preview. */
  cards: LeaderSkillId[];
  /** Revival fixes the eligible leader; setup lets the owner choose. */
  leader: string | null;
};
export type LeaderSkillAssignment = {
  skill: LeaderSkillId;
  leader: string;
  owner: string;
};
export type LeaderSkillsState = {
  deck: LeaderSkillId[];
  offers: Record<string, LeaderSkillOffer>;
  assignments: LeaderSkillAssignment[];
};
export type LeaderSkillsView = {
  assignments: (LeaderSkillAssignment & {
    controller: string;
    captured: boolean;
    faceUp: boolean;
  })[];
  offer: LeaderSkillOffer | null;
  eligibleLeaders: { id: string; name: string }[];
  /** Only this player's genuine public choice is included. */
  battleChoice: { event: string; leader: string; skill: LeaderSkillId } | null;
};
export type SkillLeader = {
  id: string;
  dead: boolean;
  capturedBy?: string;
  gholaBy?: string;
};
export type SkillRoster = readonly {
  id: string;
  leaders: readonly SkillLeader[];
}[];
export class LeaderSkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaderSkillError';
  }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new LeaderSkillError(message);
}
function shuffled<T>(cards: readonly T[], random: () => number): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const roll = random();
    ensure(
      Number.isFinite(roll) && roll >= 0 && roll < 1,
      'Invalid skill shuffle.',
    );
    const j = Math.floor(roll * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createLeaderSkills(random: () => number): LeaderSkillsState {
  return {
    deck: shuffled(
      LEADER_SKILL_CARDS.map((card) => card.id),
      random,
    ),
    offers: {},
    assignments: [],
  };
}
/** Validate physical custody without treating a hidden skill as a new copy. */
export function validateLeaderSkills(
  state: LeaderSkillsState,
  roster: SkillRoster,
): void {
  ensure(
    state &&
      Array.isArray(state.deck) &&
      Array.isArray(state.assignments) &&
      state.offers &&
      typeof state.offers === 'object' &&
      !Array.isArray(state.offers),
    'Invalid saved Leader Skills state.',
  );
  const cards: string[] = [...state.deck];
  const assignedLeaders = new Set<string>();
  const originalOwners = new Set<string>();
  for (const assignment of state.assignments) {
    const owner = roster.find((p) => p.id === assignment.owner);
    ensure(
      owner?.leaders.some((leader) => leader.id === assignment.leader),
      'A skill must remain attached to its original leader.',
    );
    ensure(
      !assignedLeaders.has(assignment.leader),
      'A leader cannot hold two skills.',
    );
    assignedLeaders.add(assignment.leader);
    ensure(
      !originalOwners.has(assignment.owner),
      'A faction cannot acquire a second original skill while the captured replacement ruling is unresolved.',
    );
    originalOwners.add(assignment.owner);
    cards.push(assignment.skill);
  }
  for (const [owner, offer] of Object.entries(state.offers)) {
    ensure(
      !originalOwners.has(owner),
      'A faction with an assigned skill cannot hold another skill offer.',
    );
    ensure(
      roster.some((p) => p.id === owner) &&
        offer &&
        typeof offer.event === 'string' &&
        offer.event.length > 0 &&
        Array.isArray(offer.cards) &&
        (offer.cards.length === 2 ||
          (offer.leader !== null && offer.cards.length === 0)),
      'Invalid saved skill choice.',
    );
    ensure(
      offer.leader === null ||
        roster
          .find((p) => p.id === owner)
          ?.leaders.some((l) => l.id === offer.leader),
      'Invalid revival skill leader.',
    );
    cards.push(...offer.cards);
  }
  const canonical = LEADER_SKILL_CARDS.map((c) => c.id);
  ensure(
    cards.length === canonical.length &&
      new Set(cards).size === canonical.length &&
      canonical.every((id) => cards.includes(id)),
    'Leader Skills must preserve all fourteen physical cards exactly once.',
  );
}
/** Deal every initial two-card hand before any rejected card returns to the deck. */
export function dealLeaderSkills(
  state: LeaderSkillsState,
  players: readonly string[],
  event: string,
): LeaderSkillsState {
  ensure(
    !state.assignments.length &&
      !Object.keys(state.offers).length &&
      state.deck.length === LEADER_SKILL_CARDS.length,
    'Leader Skills have already been dealt.',
  );
  ensure(
    players.length >= 2 &&
      players.length <= 6 &&
      new Set(players).size === players.length &&
      !!event,
    'Choose two through six distinct skill recipients.',
  );
  const next = structuredClone(state);
  for (const player of players)
    next.offers[player] = {
      event,
      cards: next.deck.splice(0, 2),
      leader: null,
    };
  return next;
}
/** Callers supply the living own leader choices after excluding Auditor/captives. */
export function chooseLeaderSkill(
  state: LeaderSkillsState,
  owner: string,
  event: string,
  skill: string,
  leader: string,
  eligibleLeaders: readonly string[],
  random: () => number,
): LeaderSkillsState {
  const offer = state.offers[owner];
  ensure(
    !state.assignments.some((assignment) => assignment.owner === owner),
    'This faction already has an assigned Leader Skill.',
  );
  ensure(
    offer &&
      offer.event === event &&
      offer.cards.includes(skill as LeaderSkillId),
    'Choose one of your current Leader Skill cards.',
  );
  ensure(
    eligibleLeaders.includes(leader) &&
      (!offer.leader || offer.leader === leader),
    'Choose an eligible living leader for this skill.',
  );
  ensure(
    !state.assignments.some((assignment) => assignment.leader === leader),
    'This leader already has a skill.',
  );
  const next = structuredClone(state);
  next.assignments.push({ owner, leader, skill: skill as LeaderSkillId });
  next.deck = shuffled(
    [...next.deck, ...offer.cards.filter((card) => card !== skill)],
    random,
  );
  delete next.offers[owner];
  return next;
}
/** Death returns the physical card once; capture leaves it attached to the disc. */
export function returnDeadLeaderSkills(
  state: LeaderSkillsState,
  roster: SkillRoster,
  random: () => number,
): { state: LeaderSkillsState; returned: LeaderSkillAssignment[] } {
  const returned = state.assignments.filter(
    (assignment) =>
      roster
        .find((p) => p.id === assignment.owner)
        ?.leaders.find((l) => l.id === assignment.leader)?.dead,
  );
  if (!returned.length) return { state, returned };
  const next = structuredClone(state);
  next.assignments = next.assignments.filter(
    (assignment) => !returned.some((dead) => dead.leader === assignment.leader),
  );
  next.deck = shuffled(
    [...next.deck, ...returned.map((assignment) => assignment.skill)],
    random,
  );
  return { state: next, returned };
}
/** The capture/replacement question stays guarded while an original skill exists. */
export function offerRevivedLeaderSkill(
  state: LeaderSkillsState,
  owner: string,
  leader: string,
  event: string,
): LeaderSkillsState {
  if (
    state.assignments.some((assignment) => assignment.owner === owner) ||
    state.offers[owner]
  )
    return state;
  ensure(
    state.deck.length >= 2 && !!event,
    'Two physical cards are required for a revived leader skill choice.',
  );
  const next = structuredClone(state);
  next.offers[owner] = { event, cards: [], leader };
  return next;
}
export function drawRevivedLeaderSkills(
  state: LeaderSkillsState,
  owner: string,
  event: string,
): LeaderSkillsState {
  const offer = state.offers[owner];
  ensure(
    offer?.leader &&
      offer.event === event &&
      offer.cards.length === 0 &&
      state.deck.length >= 2,
    'Only a current undrawn revival offer may draw skill cards.',
  );
  const next = structuredClone(state);
  next.offers[owner].cards = next.deck.splice(0, 2);
  return next;
}
export function declineRevivedLeaderSkill(
  state: LeaderSkillsState,
  owner: string,
  event: string,
): LeaderSkillsState {
  const offer = state.offers[owner];
  ensure(
    offer?.leader && offer.event === event && offer.cards.length === 0,
    'Only an undrawn revival skill offer may be declined.',
  );
  const next = structuredClone(state);
  delete next.offers[owner];
  return next;
}
