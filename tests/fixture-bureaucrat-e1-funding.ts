import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame,
  newPlayer, type Action, type Game,
} from '../game/engine';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import {
  advancePairedIxNexusSkills, createPairedIxNexusSkillsFixture,
  finishPairedIxNexusSkillsBattle, pairedIxNexusSkillsPlayer,
  revealPairedIxNexusSkillsBattle, type PairedIxNexusSkillsFixture,
} from './fixture-paired-ix-nexus-skills';

export type BureaucratE1FundingStep = { actor: string; action: Action };
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Original six-seat paired E1 roster: both natives, four classics. */
export const BUREAUCRAT_E1_ROSTER = ['ixians', 'tleilaxu', 'guild', 'emperor', 'atreides', 'harkonnen'] as const;
/** The single classic seat trained with the native Bureaucrat skill. */
export const BUREAUCRAT_E1_TRAINER = 'atreides';
/** Original five-seat paired E1 roster without a Guild faction: the battle loser
 * can genuinely fund a five-force revival from its own spice. */
export const BUREAUCRAT_E1_REVIVAL_ROSTER = ['ixians', 'tleilaxu', 'atreides', 'harkonnen', 'emperor'] as const;
export const BUREAUCRAT_E1_REVIVAL_TRAINER = 'harkonnen';

/** Original 47/14/12 setup → real Storm → real Mentat → conserved worm →
 * real alliance → real closing draws. Only the native all14 shuffle is scoped;
 * wallets, phases, assignments and armies are never assigned. */
function entropy<T>(operation: () => T, rolls: number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) {
      for (let i = 0; i < array.length; i++) array[i] = rolls[cursor++] ?? 0xffffffff;
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function shuffleRolls(source: string[], desired: string[]): number[] {
  const working = [...source], rolls: number[] = [];
  assert.deepEqual([...source].sort(), [...desired].sort());
  for (let i = working.length - 1; i > 0; i--) {
    const from = working.indexOf(desired[i]); assert.ok(from >= 0 && from <= i);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[from]] = [working[from], working[i]];
  }
  return rolls;
}
function skillRolls(selected: LeaderSkillId[]): number[] {
  const source = LEADER_SKILL_CARDS.map(c => c.id);
  const remainder = source.filter(c => !selected.includes(c));
  const desired = selected.flatMap(c => [c, remainder.shift()!]);
  return shuffleRolls(source, [...desired, ...remainder]);
}
/** Only the native all14 shuffle order is scoped, so the named classic seat can
 * genuinely select the Bureaucrat card from its own original offer. */
function pairedE1Initial(
  code: string,
  factions: readonly string[],
  trainer: string,
  skills: Record<string, LeaderSkillId>,
  advanced: boolean,
): Game {
  let game = createGame(code, newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction as FactionId));
  game.nexusCards ??= { cards: null, phase: null };
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  assert.ok(factions.includes(trainer) && skills[trainer] === 'bureaucrat' && skills.ixians === 'suk-graduate');
  const selected = game.players.map(p => skills[p.faction]);
  return entropy(() => initializeLeaderSkillsGameForAudit(game), skillRolls(selected));
}
/** Build the shared paired E1 fixture with the native skills requested. The
 * shared helper assigns each seat the first card of its genuine offer. */
function pairedE1Skills(factions: readonly string[], trainer: string, advanced: boolean): PairedIxNexusSkillsFixture {
  const skills: Record<string, LeaderSkillId> = {
    ixians: 'suk-graduate', tleilaxu: 'sandmaster', guild: 'smuggler',
    emperor: 'rihani-decipherer', atreides: 'prana-bindu-adept', harkonnen: 'killer-medic',
    [trainer]: 'bureaucrat',
  };
  const fixture = createPairedIxNexusSkillsFixture({
    initial: pairedE1Initial(`BUREAUCRATE1${factions.length}${advanced ? 'A' : 'B'}`, factions, trainer, skills, advanced),
    advanced, skill: 'suk-graduate',
  });
  assert.equal(fixture.afterSetup.leaderSkills!.assignments.find(a => a.skill === 'bureaucrat')?.owner, trainer);
  return fixture;
}
/** Native response windows: pass every original unpassed counter holder. */
export function allowE1Responses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 60; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id));
    assert.ok(actor, 'An original unpassed counter holder must remain');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  return game;
}
export function chooseBureaucratE1Payment(game: Game, redirect = true): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player, { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}

export interface BureaucratE1FundingBase {
  fixture: PairedIxNexusSkillsFixture;
  actions: BureaucratE1FundingStep[];
  /** Turn-2 Nexus window before the requested real alliance forms. */
  worm: Game;
  /** Genuine mutual alliance between the payer and the requested donor. */
  alliance: Game;
  /** Turn-2 Bidding boundary with the requested alliance already formed. */
  game: Game;
  payer: string;
  donor: string;
  trainer: string;
  ixians: string;
  tleilaxu: string;
  guild: string;
  emperor: string;
}
/** Genuine paired E1 setup with skills, a real worm Nexus and a real mutual
 * alliance between the payer and the requested donor. Never assigns wallets,
 * armies, phase, assignment or alliance state. */
export function createBureaucratE1FundingBase({
  advanced = false, payer = 'harkonnen', donor = 'ixians',
}: { advanced?: boolean; payer?: string; donor?: string } = {}): BureaucratE1FundingBase {
  assert.notEqual(payer, donor);
  const fixture = pairedE1Skills(BUREAUCRAT_E1_ROSTER, BUREAUCRAT_E1_TRAINER, advanced);
  const actions: BureaucratE1FundingStep[] = [];
  let game = structuredClone(fixture.beforeAlliance);
  assert.equal(game.turn, 2); assert.equal(game.phase, 1);
  assert.ok(game.nexus && game.players.every(p => p.ally === null));
  const worm = structuredClone(game);
  const allianceActions: BureaucratE1FundingStep[] = [payer, donor].map((actor, i) => ({
    actor, action: { type: 'alliance', target: [donor, payer][i] },
  }));
  for (const step of allianceActions) { actions.push(step); game = applyAction(game, step.actor, step.action); }
  assert.equal(pairedIxNexusSkillsPlayer(game, payer).ally, donor);
  assert.equal(pairedIxNexusSkillsPlayer(game, donor).ally, payer);
  const alliance = structuredClone(game);
  game = advancePairedIxNexusSkills(game, s => s.turn === 2 && s.phase === 3 && clean(s), actions);
  return {
    fixture, actions, worm, alliance, game,
    payer, donor, trainer: BUREAUCRAT_E1_TRAINER,
    ixians: 'ixians', tleilaxu: 'tleilaxu', guild: 'guild', emperor: 'emperor',
  };
}

// ---------------------------------------------------------------------------
// Ordinary auction whose original payee is the Emperor.
// ---------------------------------------------------------------------------

export interface BureaucratE1AuctionFixture extends BureaucratE1FundingBase {
  beforePledge: Game;
  beforeAction: Game;
  card: string;
  amount: number;
  payerShare: number;
  donorShare: number;
  action: Action;
  payee: string;
  physical: string[];
}

/** Only original unplayed-card custody is controlled here. */
export function bureaucratE1PhysicalCards(game: Game): string[] {
  const auction = game.auction;
  const remaining = auction
    ? auction.cards.slice(auction.index + Number(game.currentAuctionSale?.origin === 'normal'))
    : [];
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand), ...remaining]
    .map(card => card.id).sort();
}

export function createBureaucratE1AuctionFixture({
  advanced = false, payerShare = 5, donorShare = 3, donor = 'ixians',
}: { advanced?: boolean; payerShare?: number; donorShare?: number; donor?: string } = {}): BureaucratE1AuctionFixture {
  const base = createBureaucratE1FundingBase({ advanced, donor });
  const actions = [...base.actions];
  let game = structuredClone(base.game);
  for (let n = 0; game.auction!.active !== base.payer && n < game.players.length + 2; n++) {
    const action: Action = { type: 'passBid' };
    actions.push({ actor: game.auction!.active, action });
    game = applyAction(game, game.auction!.active, action);
  }
  assert.equal(game.auction!.active, base.payer);
  const physical = bureaucratE1PhysicalCards(game);
  const beforePledge = structuredClone(game);
  const pledge: Action = { type: 'pledgeAid', amount: donorShare };
  actions.push({ actor: donor, action: pledge });
  game = applyAction(game, donor, pledge);
  assert.equal(game.aid[donor].amount, donorShare);
  const beforeAction = structuredClone(game);
  const card = game.auction!.cards[game.auction!.index].id;
  const amount = payerShare + donorShare;
  const action: Action = { type: 'bid', amount, allyPayment: donorShare };
  return { ...base, actions, game, physical,
    beforePledge, beforeAction, card, amount, payerShare, donorShare, action, payee: base.emperor };
}

/** Commit the declared bid. Passes the remaining original bidders and declines
 * the native Ixian ally-card replacement (keeping the purchased card). */
export function payBureaucratE1Auction(fixture: BureaucratE1AuctionFixture, state = fixture.game): Game {
  const index = state.auction!.index;
  let game = applyAction(state, fixture.payer, fixture.action);
  for (let n = 0; !game.currentAuctionSale && game.auction?.index === index && n < game.players.length + 2; n++) {
    if (game.decision?.kind === 'auctionPayment') {
      game = applyAction(game, fixture.payer, { type: 'decision', karama: false });
      break;
    }
    assert.ok(!game.decision && !game.response);
    game = applyAction(game, game.auction!.active, { type: 'passBid' });
  }
  if (game.decision?.kind === 'ixAllyCard')
    game = applyAction(game, game.decision.player, { type: 'decision', accept: false });
  return game;
}

// ---------------------------------------------------------------------------
// Ordinary shipment whose original payee is the Guild.
// ---------------------------------------------------------------------------

export interface BureaucratE1ShipmentFixture extends BureaucratE1FundingBase {
  beforePledge: Game;
  beforeAction: Game;
  target: string;
  sector: number;
  action: Action;
  primary: number;
  donorAmount: number;
  amount: number;
  payee: string;
  physical: string[];
}

export function createBureaucratE1ShipmentFixture({
  advanced = false, primary = 5, donor = 'ixians', pledge = 3,
}: { advanced?: boolean; primary?: number; donor?: string; pledge?: number } = {}): BureaucratE1ShipmentFixture {
  const base = createBureaucratE1FundingBase({ advanced, donor });
  const actions = [...base.actions];
  let game = structuredClone(base.game);
  const payer = base.payer;
  game = advancePairedIxNexusSkills(game, s => s.turn === 2 && s.phase === 5 && s.active === payer && clean(s), actions);
  assert.equal(game.turn, 2); assert.equal(game.phase, 5);
  const target = 'habbanya_ridge_sietch';
  const sector = territory(target).sectors[0];
  assert.ok(game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(target))));
  const physical = bureaucratE1PhysicalCards(game);
  const beforePledge = structuredClone(game);
  const aid: Action = { type: 'pledgeAid', amount: pledge };
  actions.push({ actor: donor, action: aid });
  game = applyAction(game, donor, aid);
  assert.equal(game.aid[donor].amount, pledge);
  const beforeAction = structuredClone(game);
  const amount = primary + pledge;
  const action: Action = { type: 'ship', territory: target, sector, amount, elite: 0, allyPayment: pledge };
  return { ...base, actions, game, physical,
    beforePledge, beforeAction, target, sector, action, primary, donorAmount: pledge, amount, payee: base.guild };
}

/** Declare once. In Advanced the original Guild interception commits the ship. */
export function declareBureaucratE1Shipment(
  fixture: BureaucratE1ShipmentFixture,
): { game: Game; declared: Game; paid: Game; actions: BureaucratE1FundingStep[] } {
  const actions: BureaucratE1FundingStep[] = [];
  let game = applyAction(structuredClone(fixture.beforeAction), fixture.payer, fixture.action);
  actions.push({ actor: fixture.payer, action: fixture.action });
  const declared = structuredClone(game);
  if (game.decision?.kind === 'guildShipment') {
    const actor = game.decision.player;
    const action: Action = { type: 'decision', allow: true };
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  }
  return { game, declared, paid: structuredClone(game), actions };
}

// ---------------------------------------------------------------------------
// Paid Tleilaxu revival income at phase four.
// ---------------------------------------------------------------------------

export interface BureaucratE1RevivalFixture {
  fixture: PairedIxNexusSkillsFixture;
  actions: BureaucratE1FundingStep[];
  staging: string[];
  game: Game;
  payer: string;
  trainer: string;
  tleilaxu: string;
  opponent: string;
  amount: number;
  counterCard?: string;
}

function holdE1Card(
  game: Game,
  actor: string,
  match: (card: Game['deck'][number]) => boolean,
  staging: string[],
): string {
  const owner = pairedIxNexusSkillsPlayer(game, actor);
  const held = owner.hand.find(match);
  if (held) return held.id;
  const index = game.deck.findIndex(match);
  assert.ok(index >= 0 && owner.hand.length > 0 && owner.hand.length <= handLimit(owner));
  const outgoing = owner.hand[0], incoming = game.deck[index];
  owner.hand[0] = incoming; game.deck[index] = outgoing;
  staging.push(`Native revival boundary: swap original unplayed ${incoming.id} with held ${outgoing.id} for ${actor}; retain physical cards and hand size.`);
  return incoming.id;
}

/** Genuine paired E1 revival boundary: a real battle returns the payer's forces
 * to the tanks, then Tleilaxu's native expanded-limit benefit genuinely lets a
 * five-force paid revival exceed five spice. Never assigns wallets or tanks. */
export function createBureaucratE1RevivalFixture({
  advanced = false, payer = 'atreides', amount = 5, counter = false,
}: { advanced?: boolean; payer?: string; amount?: number; counter?: boolean } = {}): BureaucratE1RevivalFixture {
  const fixture = pairedE1Skills(BUREAUCRAT_E1_REVIVAL_ROSTER, BUREAUCRAT_E1_REVIVAL_TRAINER, advanced);
  const actions: BureaucratE1FundingStep[] = [];
  const staging: string[] = [];
  assert.notEqual(payer, BUREAUCRAT_E1_REVIVAL_TRAINER);
  assert.equal(fixture.opponent, payer, 'The requested revival payer must be the original battle loser with tanks');
  let game = finishPairedIxNexusSkillsBattle(revealPairedIxNexusSkillsBattle(fixture), 'complete');
  const counterCard = counter
    ? holdE1Card(game, BUREAUCRAT_E1_REVIVAL_TRAINER, card => card.effect === 'karama', staging)
    : undefined;
  game = advancePairedIxNexusSkills(game, s => s.turn === 3 && s.phase === 4 && clean(s), actions);
  const grant: Action = { type: 'tleilaxuRevivalLimit', target: payer };
  actions.push({ actor: 'tleilaxu', action: grant });
  game = applyAction(game, 'tleilaxu', grant);
  return {
    fixture, actions, staging, game, payer, trainer: BUREAUCRAT_E1_REVIVAL_TRAINER,
    tleilaxu: 'tleilaxu', opponent: fixture.opponent, amount, counterCard,
  };
}

/** Declare the paid force revival and clear Tleilaxu's native stop. The
 * resulting income response either resolves inside the action (no counter
 * holder) or remains for the caller to cancel or pass. */
export function reviveBureaucratE1(fixture: BureaucratE1RevivalFixture, state = fixture.game): Game {
  let game = applyAction(state, fixture.payer, { type: 'revive', amount: fixture.amount });
  if (game.decision?.kind === 'revivalStop') {
    assert.equal(game.decision.player, fixture.tleilaxu);
    game = applyAction(game, fixture.tleilaxu, { type: 'decision', decline: true });
  }
  return game;
}

export function payBureaucratE1Revival(fixture: BureaucratE1RevivalFixture, state = fixture.game): Game {
  return allowE1Responses(reviveBureaucratE1(fixture, state));
}
