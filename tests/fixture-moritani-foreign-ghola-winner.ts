import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { leaders, type Card, type Leader } from '../game/cards';
import { splitLocation, territory } from '../game/board';
import {
  advanceMixedE3Moritani, assertMixedE3MoritaniPhysical, createMixedE3MoritaniSetup,
  mixedE3MoritaniClean, mixedE3MoritaniPlayer, mixedE3MoritaniReload, openMixedE3MoritaniBattle,
  orderMixedE3MoritaniSpice, revealMixedE3MoritaniPlans, settleMixedE3MoritaniBoundary,
  shipMixedE3Moritani, stepMixedE3Moritani,
  type MixedE3MoritaniBoundary, type MixedE3MoritaniOptions, type MixedE3MoritaniSetup,
  type MixedE3MoritaniStep,
} from './fixture-mixed-e3-moritani-nexus';

/**
 * Genuine original mixed E1/E3 no-Skills Nexus seats (`moritani, tleilaxu,
 * guild, emperor`; Ecaz plus the Ix deck; no Skills and no other optional
 * module). The only directed entropy is the original undealt Treachery deal,
 * so that both the native Tleilaxu seat and the classic Guild seat hold one
 * physical projectile card. Every hand, Traitor/Face Dancer, force, leader,
 * spice balance, shipment, plan, casualty and revival below is the engine’s own.
 */
export const foreignGholaWinnerOptions: MixedE3MoritaniOptions = {
  rules: 'advanced',
  families: ['ix'],
  natives: { ix: 'tleilaxu' },
  skills: false,
  startingCards: { guild: ['projectile'] },
};

/** The ordinary disc that really dies in combat and is later revived as a ghola. */
export const FOREIGN_GHOLA_DISC = 'guild-0';
/** Tleilaxu’s held native Traitor identity: the printed clock-3 Zoal card. */
const HELD_NATIVE_TRAITOR = 'tleilaxu-0';
const SHIPMENT_FORCES = 2;
/** The whole-dial commitment that exactly consumes those shipped counters. */
const WINNING_DIAL = 1;

export type ForeignGholaWinnerBattle = {
  before: Game; plans: MixedE3MoritaniStep[]; revealed: Game; after: Game;
  order: MixedE3MoritaniBoundary['kind'][];
  winner: string; loser: string; territory: string;
};
export type ForeignGholaWinnerRevival = {
  before: Game; step: MixedE3MoritaniStep; after: Game; ghola: Leader;
  deadDisc: Leader; livingBefore: number; cost: number;
};
export type ForeignGholaWinnerWindow = {
  battle: Omit<ForeignGholaWinnerBattle, 'order'>;
  /** The exact state that holds the private `moritaniAssassinate` decision. */
  game: Game;
  event: string; turn: number; territory: string; owner: string; opponent: string;
  faction: string; opposingLeader: string;
  /** Owner-only opportunity; a rival view must stay empty. */
  cards: { card: string; name: string; potentialBounty: number }[];
  blocked: string | null;
  rivalCards: number;
};
export type ForeignGholaWinnerFixture = {
  setup: MixedE3MoritaniSetup;
  initial: Game; afterSetup: Game;
  moritani: string; tleilaxu: string; guild: string; emperor: string;
  /** Moritani’s own printed stronghold; its real six counters stay there. */
  location: string;
  /** The genuinely held native Tleilaxu Traitor Card and its printed bounty. */
  target: string; bounty: number;
  /** Tleilaxu’s own disc that really died beside the Guild disc. */
  deadTleilaxuDisc: string;
  guildBattle: ForeignGholaWinnerBattle;
  revival: ForeignGholaWinnerRevival;
  window: ForeignGholaWinnerWindow;
  actions: MixedE3MoritaniStep[];
  staging: string[];
};

/** A real sector of the destination that the shipped counters may legally use. */
function arrivalSector(g: Game, id: string): number {
  const sectors = territory(id).sectors;
  return sectors.find((sector) => sector === 0 || sector !== g.storm) ?? sectors[0];
}
/** A living, unused disc of one real seat, strongest or weakest first. */
function freeDisc(g: Game, actor: string, order: 'strong' | 'weak', exclude: readonly string[] = []): Leader {
  const pool = mixedE3MoritaniPlayer(g, actor).leaders
    .filter((l) => !l.dead && !l.capturedBy && !l.gholaBy && !l.usedAt && !exclude.includes(l.id));
  const sorted = [...pool].sort((a, b) => order === 'strong' ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(sorted[0], `The original ${actor} pool must still hold a usable disc.`);
  return sorted[0];
}
function cardInHand(g: Game, actor: string, kind: Card['kind']): string {
  const card = mixedE3MoritaniPlayer(g, actor).hand.find((c) => c.kind === kind);
  assert.ok(card, `The original deal must have given ${actor} a ${kind}.`);
  return card.id;
}

/** Consume only the real owner-labelled boundaries a resolved battle produces. */
function drive(g: Game, actions: MixedE3MoritaniStep[]): { game: Game; order: MixedE3MoritaniBoundary['kind'][] } {
  const order: MixedE3MoritaniBoundary['kind'][] = [];
  for (let n = 0; n < 24; n++) {
    const boundary = settleMixedE3MoritaniBoundary(g, null, actions);
    order.push(boundary.kind);
    g = boundary.game;
    if (boundary.kind === 'settled') return { game: g, order };
    const decision = g.decision;
    assert.ok(decision, `The ${boundary.kind} boundary needs its real owner decision.`);
    if (decision.kind === 'battleLosses')
      g = stepMixedE3Moritani(g, { actor: decision.player,
        action: { type: 'decision', choice: 0 } }, actions);
    else if (decision.kind === 'battleCards')
      g = stepMixedE3Moritani(g, { actor: decision.player,
        action: { type: 'decision', discard: [] } }, actions);
    else if (decision.kind === 'faceDance')
      g = stepMixedE3Moritani(g, { actor: decision.player,
        action: { type: 'decision', reveal: false } }, actions);
    else if (decision.kind === 'techToken')
      g = stepMixedE3Moritani(g, { actor: decision.player,
        action: { type: 'decision', token: decision.choices[0] } }, actions);
    else assert.fail(`Unexpected original battle aftermath decision ${decision.kind}.`);
  }
  throw Error('The original battle aftermath did not settle.');
}

/** One complete original battle: real declaration, real sealed plans, real cleanup. */
function fightBattle(g: Game, first: string, second: string, plans: readonly MixedE3MoritaniStep[],
  actions: MixedE3MoritaniStep[]): ForeignGholaWinnerBattle {
  const before = mixedE3MoritaniReload(g);
  const declared = advanceMixedE3Moritani(openMixedE3MoritaniBattle(before, first, second, actions),
    (s) => !!s.battle && mixedE3MoritaniClean(s) && !s.battle.preparation &&
      s.battle.preLeader?.closed !== false, actions);
  const revealed = revealMixedE3MoritaniPlans(mixedE3MoritaniReload(declared), plans, actions);
  const driven = drive(revealed, actions);
  const after = mixedE3MoritaniReload(driven.game);
  assert.equal(after.battle ?? null, null, 'The original battle must settle.');
  return { before, plans: [...plans], revealed, after, order: driven.order,
    winner: after.lastBattleContext!.winner!, loser: after.lastBattleContext!.combatants
      .find((id) => id !== after.lastBattleContext!.winner)!, territory: after.lastBattleContext!.territory };
}

/**
 * An actual ordinary foreign native disc dies through original combat and
 * Tleilaxu legally revives it as a foreign ghola; a later real Tleilaxu victory
 * with that surviving disc opens Moritani’s private Advanced loss choice, whose
 * logical faction stays Tleilaxu and whose target pool is Tleilaxu’s printed
 * Traitor identities — not the borrowed disc’s printed faction.
 */
export function createMoritaniForeignGholaWinnerFixture(): ForeignGholaWinnerFixture {
  const setup = createMixedE3MoritaniSetup(foreignGholaWinnerOptions);
  const actions = setup.actions;
  const staging = [
    'Two original controls only: the undealt Treachery deal entropy (so the native Tleilaxu seat and the classic Guild seat each hold one physical projectile card), and the shared helper’s positioning of unplayed original Spice Cards before the opening blow. No starting card, Traitor/Face Dancer, force, leader, spice balance, plan or battle is assigned.',
    'Both shipments are ordinary phase-five Shipment actions, both battles are declared from the engine’s own battle-choice offer with real private plans, and the foreign return is the engine’s own Revival action with its own price and custody.',
  ];
  const moritani = setup.moritani, tleilaxu = setup.native;
  const guild = setup.seats.guild!, emperor = setup.seats.emperor!;
  assert.ok(guild && emperor && tleilaxu && moritani);
  assert.equal(setup.nativeFaction, 'tleilaxu');
  assert.equal(setup.target, HELD_NATIVE_TRAITOR);
  assert.ok(mixedE3MoritaniPlayer(setup.afterSetup, moritani).traitors.includes(setup.target),
    'The setup deal really gave Moritani the native Tleilaxu Traitor Card.');

  let g = mixedE3MoritaniReload(setup.afterSetup);
  orderMixedE3MoritaniSpice(g);

  // Turn one: Tleilaxu really ships into Tuek’s Sietch, where the ordinary Guild
  // disc and one of Tleilaxu’s own discs die in the original sealed battle.
  const guildHome = splitLocation(Object.keys(mixedE3MoritaniPlayer(g, guild).forces)[0]).territory;
  const shipment = shipMixedE3Moritani(g, tleilaxu,
    `${guildHome}:${arrivalSector(g, guildHome)}`, SHIPMENT_FORCES, 0, actions);
  assert.equal(mixedE3MoritaniPlayer(shipment.before, tleilaxu).reserves -
    mixedE3MoritaniPlayer(shipment.settled, tleilaxu).reserves, SHIPMENT_FORCES,
  'The real Tleilaxu shipment moved exactly its own reserve counters.');
  const tleilaxuVictim = freeDisc(shipment.settled, tleilaxu, 'strong', [setup.target]);
  assert.notEqual(tleilaxuVictim.id, setup.target,
    'The disc Moritani holds a Traitor Card for stays out of this battle.');
  const guildBattle = fightBattle(shipment.settled, guild, tleilaxu, [
    { actor: tleilaxu, action: { type: 'battlePlan', leader: tleilaxuVictim.id,
      dial: WINNING_DIAL, support: 0, weapon: cardInHand(shipment.settled, tleilaxu, 'projectile') } },
    { actor: guild, action: { type: 'battlePlan', leader: FOREIGN_GHOLA_DISC,
      dial: 0, support: 0, weapon: cardInHand(shipment.settled, guild, 'projectile') } },
  ], actions);
  assert.equal(guildBattle.winner, tleilaxu, 'The native Tleilaxu really wins the original battle.');
  const killedGuild = mixedE3MoritaniPlayer(guildBattle.after, guild)
    .leaders.find((l) => l.id === FOREIGN_GHOLA_DISC)!;
  const killedTleilaxu = mixedE3MoritaniPlayer(guildBattle.after, tleilaxu)
    .leaders.find((l) => l.id === tleilaxuVictim.id)!;
  assert.equal(killedGuild.dead, true, 'The ordinary Guild disc really died in combat.');
  assert.equal(killedGuild.gholaBy, undefined);
  assert.equal(killedTleilaxu.dead, true, 'Tleilaxu loses one of its own discs in that battle.');
  assert.equal(mixedE3MoritaniPlayer(guildBattle.after, tleilaxu).leaders.filter((l) => !l.dead).length, 4,
    'Tleilaxu is one disc short of the five-disc active pool.');
  assert.equal(mixedE3MoritaniPlayer(guildBattle.after, tleilaxu)
    .leaders.find((l) => l.id === setup.target)!.dead, false, 'The held target disc is still alive.');

  // Turn two revival: the genuine half-price foreign return, settled by the engine.
  g = advanceMixedE3Moritani(guildBattle.after,
    (s) => s.turn === 2 && s.phase === 4 && mixedE3MoritaniClean(s), actions);
  const beforeRevival = mixedE3MoritaniReload(g);
  const cost = Math.ceil(killedGuild.strength / 2);
  assert.ok(mixedE3MoritaniPlayer(beforeRevival, tleilaxu).spice >= cost,
    'The genuine battle bounty funds the real foreign return.');
  const revivalStep: MixedE3MoritaniStep = { actor: tleilaxu,
    action: { type: 'reviveForeignGhola', leader: FOREIGN_GHOLA_DISC } };
  g = advanceMixedE3Moritani(stepMixedE3Moritani(beforeRevival, revivalStep, actions),
    (s) => mixedE3MoritaniClean(s) && !s.pendingRevival, actions);
  const afterRevival = mixedE3MoritaniReload(g);
  const ghola = mixedE3MoritaniPlayer(afterRevival, guild).leaders.find((l) => l.id === FOREIGN_GHOLA_DISC)!;
  assert.equal(ghola.dead, false, 'The real Tleilaxu revival returned the foreign disc.');
  assert.equal(ghola.gholaBy, tleilaxu, 'The disc is held as a Tleilaxu foreign ghola.');
  assert.equal(ghola.faction, 'guild', 'Its printed faction is unchanged.');
  assert.equal(mixedE3MoritaniPlayer(afterRevival, tleilaxu).spice,
    mixedE3MoritaniPlayer(beforeRevival, tleilaxu).spice - cost, 'The half-price cost was paid once.');
  assert.equal(mixedE3MoritaniPlayer(afterRevival, tleilaxu).leaderRevived, true);
  const revival: ForeignGholaWinnerRevival = { before: beforeRevival, step: revivalStep,
    after: afterRevival, ghola, deadDisc: killedGuild, livingBefore: 4, cost };

  // Turn two battle: the surviving foreign ghola really wins against Moritani.
  assert.ok((mixedE3MoritaniPlayer(afterRevival, moritani).forces[setup.location] ?? 0) > 0,
    'Moritani must really hold its own starting stronghold to lose the battle there.');
  g = shipMixedE3Moritani(afterRevival, tleilaxu, setup.location, SHIPMENT_FORCES, 0, actions).settled;
  const lossBefore = mixedE3MoritaniReload(g);
  const lossPlans: MixedE3MoritaniStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: freeDisc(lossBefore, moritani, 'weak').id,
      dial: 0, support: 0 } },
    { actor: tleilaxu, action: { type: 'battlePlan', leader: FOREIGN_GHOLA_DISC,
      dial: WINNING_DIAL, support: 0 } },
  ];
  const lossDeclared = advanceMixedE3Moritani(openMixedE3MoritaniBattle(lossBefore, moritani, tleilaxu, actions),
    (s) => !!s.battle && mixedE3MoritaniClean(s) && !s.battle.preparation &&
      s.battle.preLeader?.closed !== false, actions);
  const lossRevealed = revealMixedE3MoritaniPlans(lossDeclared, lossPlans, actions);
  const opened = settleMixedE3MoritaniBoundary(lossRevealed, null, actions);
  assert.equal(opened.kind, 'assassination',
    `The foreign-ghola victory must open Moritani’s private choice first (${opened.kind}).`);
  g = opened.game;
  assert.equal(g.decision?.kind, 'moritaniAssassinate');
  const receipt = g.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'choice');
  assert.equal(receipt.opposingLeader, FOREIGN_GHOLA_DISC,
    'The trigger binds the physically foreign surviving disc, not the winner’s own roster.');
  assert.equal(leaders('tleilaxu').some((l) => l.id === receipt.opposingLeader), false,
    'No Tleilaxu disc won this battle.');
  assert.equal(receipt.faction, 'tleilaxu',
    'The logical faction is the victorious player, so the target pool is Tleilaxu’s.');
  const own = viewGame(g, moritani).moritaniAssassinate!;
  assert.ok(own.pending, 'Moritani must really receive the private opportunity.');
  const rival = viewGame(g, tleilaxu).moritaniAssassinate!;
  assert.equal(mixedE3MoritaniPlayer(g, guild).leaders.find((l) => l.id === FOREIGN_GHOLA_DISC)!.dead, false,
    'The winning foreign disc survived the battle.');
  const window: ForeignGholaWinnerWindow = {
    battle: { before: lossBefore, plans: lossPlans, revealed: lossRevealed, after: mixedE3MoritaniReload(g),
      winner: tleilaxu, loser: moritani, territory: setup.location },
    game: mixedE3MoritaniReload(g),
    event: receipt.event, turn: receipt.turn, territory: receipt.territory, owner: receipt.owner,
    opponent: receipt.opponent, faction: receipt.faction, opposingLeader: receipt.opposingLeader,
    cards: own.pending!.cards.map((choice) => ({ ...choice })),
    blocked: own.pending!.blocked, rivalCards: rival.pending?.cards.length ?? 0,
  };
  assert.ok(window.cards.some((choice) => choice.card === setup.target),
    'The genuinely held native Tleilaxu Traitor Card is a legal reveal.');
  assert.equal(window.cards.every((choice) =>
    leaders('tleilaxu').some((l) => l.id === choice.card)), true,
  'Every eligible reveal is a printed Tleilaxu Traitor identity.');
  assert.equal(window.cards.some((choice) => choice.card === FOREIGN_GHOLA_DISC), false,
    'The borrowed disc’s printed faction never supplies the target pool.');
  assert.equal(window.rivalCards, 0, 'Rivals see the decision without Moritani’s private options.');
  assert.equal(window.cards.find((choice) => choice.card === setup.target)!.potentialBounty,
    leaders('tleilaxu')[0].strength, 'The printed bounty of the held card is quoted.');

  return {
    setup, initial: setup.initial, afterSetup: setup.afterSetup,
    moritani, tleilaxu, guild, emperor, location: setup.location,
    target: setup.target, bounty: leaders('tleilaxu')[0].strength,
    deadTleilaxuDisc: tleilaxuVictim.id, guildBattle, revival, window, actions, staging,
  };
}

export type ForeignGholaWinnerOutcome = {
  window: Game; after: Game; mentat: Game; replacement: string; retired: string; bounty: number;
};

/**
 * Reveal the real held native Tleilaxu Traitor Card, then walk the original
 * battle cleanup, phase seven and the Mentat Pause set-aside/replacement to the
 * point where the engine has already drawn the private replacement.
 */
export function revealMoritaniForeignGholaWitness(f: ForeignGholaWinnerFixture,
  card: string = f.target): ForeignGholaWinnerOutcome {
  let g = mixedE3MoritaniReload(f.window.game);
  assert.equal(g.decision?.kind, 'moritaniAssassinate');
  const choice = f.window.cards.find((candidate) => candidate.card === card);
  assert.ok(choice, 'Choose one of the real private reveal options.');
  const before = mixedE3MoritaniPlayer(g, f.moritani);
  const victim = mixedE3MoritaniPlayer(g, f.tleilaxu).leaders.find((l) => l.id === card)!;
  assert.equal(victim.dead, false, 'This original witness selects a living native target.');
  const rivalSpice = mixedE3MoritaniPlayer(g, f.tleilaxu).spice;
  const reserveBefore = [...(g.traitorReserve ?? [])];
  g = stepMixedE3Moritani(g, { actor: f.moritani,
    action: { type: 'decision', event: f.window.event, card } }, f.actions);
  const after = mixedE3MoritaniReload(g);
  const killed = mixedE3MoritaniPlayer(after, f.tleilaxu).leaders.find((l) => l.id === card)!;
  assert.equal(killed.dead, true, 'The revealed native disc really died.');
  assert.equal(killed.deaths, victim.deaths + 1);
  assert.equal(mixedE3MoritaniPlayer(after, f.moritani).spice, before.spice + victim.strength,
    'The printed bounty is paid once from the bank.');
  assert.equal(mixedE3MoritaniPlayer(after, f.tleilaxu).spice, rivalSpice, 'The revealing seat pays nothing.');
  assert.equal(after.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
  const settled = advanceMixedE3Moritani(after,
    (s) => s.turn === 2 && s.phase === 8 &&
      s.moritaniAssassinate?.opportunities.at(-1)?.stage === 'replaced', f.actions);
  const receipt = settled.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced');
  assert.equal(receipt.card, card);
  const replacement = receipt.replacement;
  assert.ok(replacement && replacement !== card);
  assert.equal(settled.traitorReserve!.length, reserveBefore.length - 1,
    'Exactly one private Mentat replacement was drawn.');
  assert.equal(settled.traitorReserve!.includes(card), false,
    'The revealed card stays a public face-up set-aside, never back in the reserve.');
  assert.equal(mixedE3MoritaniPlayer(settled, f.moritani).traitors.includes(replacement), true);
  assert.equal(mixedE3MoritaniPlayer(settled, f.moritani).traitors.includes(card), false);
  assert.equal(Object.hasOwn(viewGame(settled, f.tleilaxu).moritaniAssassinate!.history.at(-1)!,
    'replacement'), false, 'The public history never carries the private replacement.');
  assertMixedE3MoritaniPhysical(settled);
  const heldBefore = mixedE3MoritaniPlayer(f.window.game, f.moritani).forces[f.location] ?? 0;
  assert.equal(mixedE3MoritaniPlayer(settled, f.moritani).forces[f.location] ?? 0, heldBefore,
    'Moritani’s real counters at its starting stronghold are unchanged by the loss and its aftermath.');
  return { window: f.window.game, after, mentat: settled, replacement, retired: card, bounty: receipt.bounty };
}


/** A rejected action must not move any original stock. */
export function rejectForeignGholaWinnerAction(g: Game, actor: string, action: Action): void {
  const before = mixedE3MoritaniReload(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
