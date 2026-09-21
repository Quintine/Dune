import type { BattleLeaderSkill } from './leader-skill-combat';
import { usesSurvivingSkilledLeader } from './leader-skill-combat';
import { validateNexusTraitorSnapshot, type NexusExchangePlayer, type NexusTraitorSnapshot } from './nexus-traitor-exchange';

export type RihaniSkill = { leader: string; normal: boolean; skilled: boolean };
export type RihaniReceipt = {
  event: string; turn: number; owner: string; skill: RihaniSkill;
  stage: 'offer' | 'return' | 'complete';
  before: NexusTraitorSnapshot; state: NexusTraitorSnapshot;
  deckAfterPeek: string[];
  peeked: string[]; drawn: string[]; eligible: string[]; used: string[];
  kept: string | null; given: string | null;
  signature: string;
};
function requireRihani(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const members = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && same([...a].sort(), [...b].sort());
function eligibleOldCards(owner: NexusExchangePlayer, used: readonly string[]): string[] {
  return owner.faction === 'tleilaxu'
    ? owner.faceDancers!.filter((card) => !card.revealed).map((card) => card.leader)
    : owner.traitors.filter((id) => !used.includes(id));
}
function unchangedHand(owner: NexusExchangePlayer, old: NexusExchangePlayer): boolean {
  return same(owner.traitors, old.traitors) && same(owner.faceDancers, old.faceDancers);
}
function augmentedHand(owner: NexusExchangePlayer, old: NexusExchangePlayer, drawn: readonly string[]): boolean {
  return owner.faction === 'tleilaxu'
    ? same(owner.faceDancers, [...old.faceDancers!, ...drawn.map((leader) => ({ leader, revealed: false }))])
    : same(owner.traitors, [...old.traitors, ...drawn]);
}
function exchangedHand(owner: NexusExchangePlayer, old: NexusExchangePlayer, kept: string, given: string): boolean {
  return owner.faction === 'tleilaxu'
    ? same(owner.faceDancers, [...old.faceDancers!.filter((card) => card.leader !== given), { leader: kept, revealed: false }])
    : members(owner.traitors, [...old.traitors.filter((id) => id !== given), kept]);
}
function shuffled<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const value = rng();
    requireRihani(value >= 0 && value < 1, 'Invalid Traitor Deck shuffle.');
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function rihaniSignature(receipt: RihaniReceipt): string {
  const { signature: _signature, ...body } = receipt;
  return JSON.stringify(body);
}
function signed(receipt: RihaniReceipt): RihaniReceipt {
  receipt.signature = rihaniSignature(receipt);
  return receipt;
}
export function rihaniVictorySkill(assignments: readonly BattleLeaderSkill[], leader: string | undefined, survives: boolean): RihaniSkill | null {
  const a = assignments.find((skill) => skill.skill === 'rihani-decipherer');
  if (!a) return null;
  const skilled = usesSurvivingSkilledLeader(assignments, 'rihani-decipherer', leader, survives);
  const normal = !a.captured && (a.faceUp || skilled) && (a.leader !== leader || survives);
  return normal || skilled ? { leader: a.leader, normal, skilled } : null;
}

/** Complete the compulsory private peek before offering the separately optional draw. */
export function beginRihani(snapshot: NexusTraitorSnapshot, universe: readonly string[],
  identity: Pick<RihaniReceipt, 'event' | 'turn' | 'owner' | 'skill'>, used: readonly string[], rng: () => number): RihaniReceipt {
  validateNexusTraitorSnapshot(snapshot, universe);
  const owner = snapshot.players.find((p) => p.id === identity.owner);
  requireRihani(owner, 'Rihani requires its original card owner.');
  const eligible = eligibleOldCards(owner, used);
  const optional = identity.skill.skilled && eligible.length > 0;
  requireRihani(!(identity.skill.normal || optional) || snapshot.reserve.length >= 2,
    'Rihani requires two physical cards in the Traitor Deck.');
  const state = structuredClone(snapshot);
  const peeked = identity.skill.normal ? shuffled(snapshot.reserve, rng).slice(0, 2) : [];
  if (identity.skill.normal) state.reserve = shuffled(state.reserve, rng);
  return signed({ ...identity, stage: optional ? 'offer' : 'complete', before: structuredClone(snapshot), state,
    deckAfterPeek: [...state.reserve], peeked, eligible, used: [...used], drawn: [], kept: null, given: null, signature: '' });
}

/** Validate recorded physical transitions, then bind a pending choice to current custody. */
export function validateRihani(receipt: RihaniReceipt, universe: readonly string[], current?: NexusTraitorSnapshot) {
  requireRihani(receipt.signature === rihaniSignature(receipt) &&
    ['offer', 'return', 'complete'].includes(receipt.stage) &&
    Number.isSafeInteger(receipt.turn) && receipt.turn > 0 && receipt.event &&
    typeof receipt.skill.normal === 'boolean' && typeof receipt.skill.skilled === 'boolean' &&
    (receipt.skill.normal || receipt.skill.skilled), 'The saved Rihani receipt is invalid.');
  validateNexusTraitorSnapshot(receipt.before, universe);
  validateNexusTraitorSnapshot(receipt.state, universe);
  const old = receipt.before.players.find((p) => p.id === receipt.owner);
  const owner = receipt.state.players.find((p) => p.id === receipt.owner);
  requireRihani(old && owner && owner.faction === old.faction &&
    same(receipt.before.players.filter((p) => p.id !== receipt.owner), receipt.state.players.filter((p) => p.id !== receipt.owner)),
    'Rihani changed another player’s physical Traitors.');
  requireRihani(Array.isArray(receipt.used) && new Set(receipt.used).size === receipt.used.length &&
    members(receipt.deckAfterPeek, receipt.before.reserve) &&
    (receipt.skill.normal || same(receipt.deckAfterPeek, receipt.before.reserve)) &&
    same(receipt.eligible, eligibleOldCards(old, receipt.used)) &&
    receipt.peeked.length === (receipt.skill.normal ? 2 : 0) &&
    new Set(receipt.peeked).size === receipt.peeked.length &&
    receipt.peeked.every((id) => receipt.before.reserve.includes(id)), 'Rihani lost its original inspection or unused cards.');
  requireRihani((receipt.drawn.length === 0 || receipt.drawn.length === 2) &&
    new Set(receipt.drawn).size === receipt.drawn.length && receipt.drawn.every((id) => receipt.before.reserve.includes(id)),
    'Rihani must draw two distinct physical cards.');
  if (!receipt.drawn.length) {
    requireRihani(receipt.stage !== 'return' && !receipt.kept && !receipt.given && unchangedHand(owner, old) &&
      same(receipt.state.reserve, receipt.deckAfterPeek), 'The undrawn Rihani offer changed hand custody.');
  } else {
    requireRihani(receipt.skill.skilled && receipt.eligible.length > 0, 'This Rihani cannot exchange an unused card.');
    requireRihani(same(receipt.drawn, receipt.deckAfterPeek.slice(0, 2)), 'Rihani did not draw from the saved deck order.');
    const remaining = receipt.deckAfterPeek.slice(2);
    if (receipt.stage === 'return') requireRihani(!receipt.kept && !receipt.given &&
      augmentedHand(owner, old, receipt.drawn) && same(receipt.state.reserve, remaining),
      'The pending Rihani return lost its drawn cards.');
    else requireRihani(receipt.stage === 'complete' && receipt.kept && receipt.drawn.includes(receipt.kept) &&
      receipt.given && receipt.eligible.includes(receipt.given) &&
      exchangedHand(owner, old, receipt.kept, receipt.given) &&
      members(receipt.state.reserve, [...remaining, receipt.given, ...receipt.drawn.filter((id) => id !== receipt.kept)]),
      'The completed Rihani exchange lost its exact new or returned card.');
  }
  if (receipt.stage === 'offer') requireRihani(receipt.skill.skilled && receipt.eligible.length > 0 && !receipt.drawn.length,
    'The Rihani draw offer is no longer available.');
  if (current) requireRihani(same(current, receipt.state), 'The Rihani choice no longer matches current Traitor custody.');
}

export function chooseRihaniDraw(receipt: RihaniReceipt, universe: readonly string[], current: NexusTraitorSnapshot, draw: boolean): RihaniReceipt {
  validateRihani(receipt, universe, current);
  requireRihani(receipt.stage === 'offer', 'This Rihani draw has already been answered.');
  const next = structuredClone(receipt);
  if (!draw) next.stage = 'complete';
  else {
    requireRihani(next.state.reserve.length >= 2, 'Rihani requires two physical cards in the Traitor Deck.');
    next.drawn = next.state.reserve.splice(0, 2);
    const owner = next.state.players.find((p) => p.id === next.owner)!;
    if (owner.faction === 'tleilaxu') owner.faceDancers!.push(...next.drawn.map((leader) => ({ leader, revealed: false })));
    else owner.traitors.push(...next.drawn);
    next.stage = 'return';
  }
  signed(next); validateRihani(next, universe); return next;
}
export function finishRihani(receipt: RihaniReceipt, universe: readonly string[], current: NexusTraitorSnapshot,
  kept: string, given: string, rng: () => number): RihaniReceipt {
  validateRihani(receipt, universe, current);
  requireRihani(receipt.stage === 'return' && receipt.drawn.includes(kept) && receipt.eligible.includes(given),
    'Keep one newly drawn Traitor and reveal one unused Traitor held before the draw.');
  const next = structuredClone(receipt), other = next.drawn.find((id) => id !== kept)!;
  const owner = next.state.players.find((p) => p.id === next.owner)!;
  if (owner.faction === 'tleilaxu')
    owner.faceDancers = owner.faceDancers!.filter((card) => card.leader !== given && card.leader !== other);
  else owner.traitors = owner.traitors.filter((id) => id !== given && id !== other);
  next.state.reserve = shuffled([...next.state.reserve, given, other], rng);
  next.kept = kept; next.given = given; next.stage = 'complete';
  signed(next); validateRihani(next, universe); return next;
}
