import assert from 'node:assert/strict';
import {
  applyAction, battles, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card, SpiceCard } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nextClassicSkillsStrongholdStep } from './fixture-classic-skills-stronghold';

export type CapturedSkillRevivalStep = { actor: string; action: Action };

export function capturedSkillPlayer(game: Game, actor: string): Player {
  const player = game.players.find(seat => seat.id === actor);
  assert.ok(player, `Missing original classic seat ${actor}`);
  return player;
}
/** The real windows that must be closed before a new native boundary is meaningful. */
export function capturedSkillClean(game: Game): boolean {
  return !game.phaseOpening && !game.response && !game.decision &&
    !game.pendingTreacheryDiscard && !game.pendingRevival;
}

/** Entropy control is confined to the original fourteen-card Leader Skill
 * shuffle. Every other native random request keeps its own behavior. */
function shuffledOffers<T>(selected: LeaderSkillId[], run: () => T): T {
  const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
  const remainder = working.filter(skill => !selected.includes(skill));
  const desired = selected.flatMap(skill => [skill, remainder.shift()!]);
  desired.push(...remainder);
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Only the native continuation the shared fixture already models is consumed. */
export function advanceCapturedSkill(game: Game, until: (state: Game) => boolean,
  actions: CapturedSkillRevivalStep[] = []): Game {
  let current = game;
  for (let n = 0; n < 1200; n++) {
    if (until(current)) return current;
    assert.notEqual(current.status, 'finished');
    const next = nextClassicSkillsStrongholdStep(current);
    assert.ok(next, 'The original continuation stopped at an unsealed human plan');
    actions.push(structuredClone(next));
    current = applyAction(current, next.actor, next.action);
  }
  throw Error('The original captive continuation did not reach its boundary');
}
/** Conserve original on-board counters into their own reserves; no subtype total changes. */
function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  staging.push('Conserved every original on-board counter into its own reserves before the labeled placements.');
}
function place(game: Game, actor: string, location: string, count: number): void {
  const player = capturedSkillPlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= count, 'Stage ordinary physical counters only');
  player.reserves -= count;
  player.forces[location] = (player.forces[location] ?? 0) + count;
}
function sectorOf(game: Game, id: string): number {
  const sector = territory(id).sectors.find(value => value !== 0 && value !== game.storm);
  assert.ok(sector !== undefined, `The original ${id} sector must stay out of the storm`);
  return sector;
}
function holdUnplayed(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[]): string {
  const owner = capturedSkillPlayer(game, actor);
  const held = owner.hand.find(matches);
  if (held) return held.id;
  const index = game.deck.findIndex(matches);
  const donor = index < 0 ? game.players.find(seat => seat.id !== actor && seat.hand.some(matches)) : undefined;
  assert.ok(index >= 0 || donor, 'The required original card must still be unplayed');
  assert.ok(owner.hand.length < handLimit(owner));
  const card = index >= 0 ? game.deck.splice(index, 1)[0]
    : donor!.hand.splice(donor!.hand.findIndex(matches), 1)[0];
  owner.hand.push(card);
  staging.push(`Conserved original unplayed ${card.id}: ${donor?.id ?? 'deck'} → ${actor} hand`);
  return card.id;
}
/** Four original leader-killing weapons are conserved for the winner's plans.
 * The winner keeps its played weapon, so one physical projectile covers all four. */
const BATTLE_SITES: { territory: string; atreides: string; harkonnen: string; capture?: boolean }[] = [
  { territory: 'arsunt', atreides: 'atreides-2', harkonnen: 'harkonnen-0' },
  { territory: 'tsimpo', atreides: 'atreides-3', harkonnen: 'harkonnen-1' },
  { territory: 'south_mesa', atreides: 'atreides-4', harkonnen: 'harkonnen-2' },
  { territory: 'arrakeen', atreides: 'atreides-0', harkonnen: 'harkonnen-4', capture: true },
];

export function assertCapturedSkillInventory(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const physical = [
    ...game.leaderSkills!.deck,
    ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
  ];
  assert.equal(physical.length, 14);
  assert.equal(new Set(physical).size, 14);
  assert.deepEqual([...physical].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20,
      'Every original physical counter stays in reserves, Tanks or on the board');
}

/** Genuine classic Advanced setup, four actual Movement/Combat battles that kill
 * three untrained Atreides leaders plus one more in the capture battle, an actual
 * Harkonnen Capture offer with Keep, then the real next Revival phase. Only
 * labeled conserved board counters and unplayed cards are relocated; no death,
 * capture identity, assignment, phase, wallet or outcome is written. */
export function createCapturedSkillRevivalFixture() {
  const actions: CapturedSkillRevivalStep[] = [], staging: string[] = [];
  let game = createGame('CAPTUREDSKILLREVIVAL', newPlayer('a', 'Atreides', 'atreides'), true);
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const act = (actor: string, action: Action): void => {
    actions.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const selected: LeaderSkillId[] = ['sandmaster', 'smuggler', 'prana-bindu-adept'];
  game = shuffledOffers(selected, () => initializeLeaderSkillsGameForAudit(game));
  const initial = structuredClone(game);
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const skill = selected[game.players.findIndex(player => player.id === actor)];
      assert.ok(view.offer && view.offer.cards.includes(skill));
      const leader = actor === 'a' ? 'atreides-1' : actor === 'h' ? 'harkonnen-3' : view.eligibleLeaders[0].id;
      assert.ok(capturedSkillPlayer(game, actor).leaders.some(disc => disc.id === leader));
      act(actor, { type: 'leaderSkill', event: offer.event, skill, leader });
    } else {
      const next = nextClassicSkillsStrongholdStep(game);
      assert.ok(next);
      act(next.actor, next.action);
    }
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  // Conserved original undealt Spice Card order for the two-turn suffix.
  const land = game.spiceDeck.filter(
    (card): card is Extract<SpiceCard, { territory: string }> => 'territory' in card);
  const front = land.slice(0, 4);
  game.spiceDeck = [...front, ...game.spiceDeck.filter(card => !front.includes(card as typeof front[number]))];
  staging.push('Ordered four conserved original unplayed non-worm Spice Cards; this is not a natural shuffle history');
  game = advanceCapturedSkill(game, state => state.phase === 5 && capturedSkillClean(state), actions);
  for (let n = 0; game.phase === 5 && game.active !== 'h' && n < 40; n++) {
    const next = nextClassicSkillsStrongholdStep(game);
    assert.ok(next);
    act(next.actor, next.action);
  }
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'h');
  reserveBoard(game, staging);
  act('h', { type: 'ship', territory: 'arrakeen', sector: sectorOf(game, 'arrakeen'), amount: 3 });
  staging.push('Harkonnen shipped three ordinary reserve counters into Arrakeen through the real Movement phase');
  const location = Object.fromEntries(BATTLE_SITES.map(site => [site.territory, `${site.territory}:${sectorOf(game, site.territory)}`]));
  for (const site of BATTLE_SITES) if (!site.capture) place(game, 'h', location[site.territory], 3);
  for (const site of BATTLE_SITES) place(game, 'a', location[site.territory], 3);
  staging.push('Conserved three ordinary counters per combatant at each of the four labeled battle sectors; no elite, wallet or phase assigned');
  const weapon = holdUnplayed(game, 'h', card => card.kind === 'projectile', staging);
  const ghola = holdUnplayed(game, 'a', card => card.effect === 'ghola', staging);
  game = advanceCapturedSkill(game, state => state.phase === 6 && capturedSkillClean(state) &&
    BATTLE_SITES.every(site => battles(state).some(entry => entry.territory === site.territory)), actions);
  let afterCapture: Game | undefined;
  for (const site of BATTLE_SITES) {
    const listing = battles(game).find(entry => entry.territory === site.territory);
    assert.ok(listing, `A real battle must remain open in ${site.territory}`);
    assert.equal(listing.chooser, game.active);
    act(listing.chooser, { type: 'chooseBattle', territory: site.territory,
      target: listing.attacker === listing.chooser ? listing.defender : listing.attacker });
    game = advanceCapturedSkill(game, state => !nextClassicSkillsStrongholdStep(state), actions);
    act('h', { type: 'battlePlan', leader: site.harkonnen, dial: 1, support: 0, weapon, defense: null });
    game = advanceCapturedSkill(game, state => !state.response && !state.phaseOpening && !state.decision, actions);
    act('a', { type: 'battlePlan', leader: site.atreides, dial: 0, support: 0, weapon: null, defense: null });
    game = advanceCapturedSkill(game, state => site.capture
      ? state.decision?.kind === 'captureOffer'
      : !state.battle && capturedSkillClean(state), actions);
    if (!site.capture) continue;
    const offer = game.decision;
    assert.ok(offer && offer.kind === 'captureOffer');
    act('h', { type: 'decision', accept: true });
    for (let n = 0; game.response && n < 20; n++) {
      const remaining = game.players.find(player => !game.response!.passed.includes(player.id));
      assert.ok(remaining);
      act(remaining.id, { type: 'passResponse' });
    }
    const captured = game.decision;
    assert.ok(captured && captured.kind === 'capturedLeader');
    assert.equal(captured.leader, 'atreides-1');
    act('h', { type: 'decision', mode: 'keep' });
    game = advanceCapturedSkill(game, state => !state.battle && capturedSkillClean(state), actions);
    afterCapture = structuredClone(game);
  }
  assert.ok(afterCapture);
  game = advanceCapturedSkill(game, state => state.turn === 2 && state.phase === 4 && capturedSkillClean(state), actions);
  const assignment = game.leaderSkills!.assignments.find(entry => entry.owner === 'a');
  assert.ok(assignment);
  assert.equal(assignment.leader, 'atreides-1');
  assert.equal(capturedSkillPlayer(game, 'a').leaders.find(disc => disc.id === 'atreides-1')?.capturedBy, 'h');
  assert.equal(capturedSkillPlayer(game, 'a').leaders.find(disc => disc.id === assignment.leader)?.dead, false);
  assertCapturedSkillInventory(game);
  return { initial, afterSetup, afterCapture, game, actor: 'a', captor: 'h', observer: 'g',
    captive: 'atreides-1', dead: 'atreides-0', deadCost: 5, ghola, weapon,
    assignment: structuredClone(assignment), actions, staging };
}
