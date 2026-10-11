import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import { assertAdvancedNativeCustody } from './fixture-advanced-native-skills';

export type SemutaSkillsStep = { actor: string; action: Action };
export const reloadSemutaSkills = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function semutaSkillsPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}

/** Control only the original fourteen-card shuffle, not native setup lotteries.
 * Safe companion skills keep this fixture focused on the normal Mentat consumer. */
function withOriginalOffers<T>(initialize: () => T): T {
  const selected: LeaderSkillId[] = ['mentat', 'killer-medic', 'swordmaster-of-ginaz'];
  const originalCards = LEADER_SKILL_CARDS.map(c => c.id);
  const remaining = originalCards.filter(c => !selected.includes(c));
  const desired = selected.flatMap(c => [c, remaining.shift()!]);
  desired.push(...remaining);
  const working = [...originalCards], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor(((j + 0.5) / (i + 1)) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[cursor++];
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Fresh native Richese/CHOAM setup; no played save conversion or invented
 * assignment. Every seat selects its actual two-card offer on an eligible disc. */
export function initializeSemutaSkillsGame(advanced = false, tech = false, strongholds = false): Game {
  assert.ok(advanced || !strongholds, 'Original Stronghold Cards require Advanced rules');
  let game = createGame('SEMUTASKILLS', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  if (tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = withOriginalOffers(() => initializeSemutaGameForAudit(game, true));
  const selected: Record<string, LeaderSkillId> = {
    r: 'mentat', a: 'killer-medic', e: 'swordmaster-of-ginaz',
  };
  for (let step = 0; game.status === 'setup' && step < 250; step++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor], own = viewGame(game, actor).leaderSkills!;
      const eligible = new Set(own.eligibleLeaders.map(l => l.id));
      const leader = semutaSkillsPlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      const skill = selected[actor];
      assert.ok(offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader,
        'Actual original offer and living eligible leader must supply training');
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill, leader: leader.id });
    } else {
      const next = nextRicheseSkillsTechNativeStep(game);
      game = applyAction(game, next.actor, next.action);
    }
  }
  assert.equal(game.status, 'playing');
  assertAdvancedNativeCustody(game);
  return game;
}

/** Explicit physical staging AFTER original offers/training: exchange the
 * requested card with the owner's existing card, retaining both exact slots
 * and the original living trained leader. No assignment is added or removed. */
export function swapSemutaSkill(game: Game, owner: string, skill: LeaderSkillId): string {
  const skills = game.leaderSkills!;
  validateLeaderSkills(skills, game.players);
  const assignment = skills.assignments.find(a => a.owner === owner);
  assert.ok(assignment, 'Only an actually trained original owner may exchange a physical card');
  const leader = semutaSkillsPlayer(game, owner).leaders.find(l => l.id === assignment.leader);
  assert.ok(leader && !leader.dead && !leader.capturedBy && !leader.gholaBy);
  if (assignment.skill === skill) return assignment.leader;
  const previous = assignment.skill, donor = skills.assignments.find(a => a.skill === skill);
  if (donor) donor.skill = previous;
  else {
    const offer = Object.values(skills.offers).find(o => o.cards.includes(skill));
    if (offer) offer.cards[offer.cards.indexOf(skill)] = previous;
    else {
      const index = skills.deck.indexOf(skill);
      assert.ok(index >= 0, 'Requested original physical skill must have a real custody slot');
      skills.deck[index] = previous;
    }
  }
  assignment.skill = skill;
  validateLeaderSkills(skills, game.players);
  return assignment.leader;
}

export function semutaSkillsInventory(game: Game): string[] {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.equal(new Set(cards).size, cards.length, 'Each original Treachery Card has one physical slot');
  return cards;
}
export function semutaSkillsPhysical(game: Game) {
  return structuredClone({
    players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces,
      reserves: p.reserves, tanks: p.tanks, elites: p.elites, leaders: p.leaders,
      traitors: p.traitors, revealedTraitors: p.revealedTraitors })),
    skills: game.leaderSkills, tech: game.techTokens, strongholds: game.strongholdCards,
  });
}
export type SemutaSkillsMentatFixture = {
  game: Game; owner: 'r'; target: 'e'; spender: 'a'; trainer: string;
  semuta: string; hajr: string; weapon: string; fallback: string; territory: string; location: string;
};
function takeCard(game: Game, actor: string, identity: string): string {
  const zones = [game.deck, game.discard, game.richeseCache!, ...game.players.map(p => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex(c => c.id === identity || c.name === identity || c.effect === identity);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    semutaSkillsPlayer(game, actor).hand.push(card);
    return card.id;
  }
  throw Error(`No original physical ${identity} card remains available`);
}

/** Genuine setup and original phase controls reach Movement. Only the conserved
 * board/hand position is staged: native forces return to their own reserves,
 * then five original counters per combatant and canonical cards change slots.
 * Wallets, printed leaders, skill training, turn, phase and module custody stay real. */
export function createSemutaSkillsMentatFixture(advanced = false, tech = false, strongholds = false): SemutaSkillsMentatFixture {
  let game = initializeSemutaSkillsGame(advanced, tech, strongholds);
  for (let n = 0; n < 1500; n++) {
    if (game.phase === 5 && !game.phaseOpening && !game.response && !game.decision) break;
    assert.equal(game.turn, 1);
    const next = nextRicheseSkillsTechNativeStep(game);
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.phase, 5);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  // End preceding actual movement owners, leaving Atreides as the real Hajr owner.
  for (let n = 0; game.active !== 'a' && n < 3; n++)
    game = applyAction(game, game.active!, { type: 'endMovement' });
  assert.equal(game.active, 'a');
  const physical = semutaSkillsPhysical(game), cards = semutaSkillsInventory(game);
  for (const player of game.players) {
    game.deck.push(...player.hand); player.hand = [];
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
  }
  const battleTerritory = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm));
  assert.ok(battleTerritory);
  const location = `${battleTerritory.id}:${battleTerritory.sectors[0]}`;
  for (const actor of ['r', 'e']) {
    const player = semutaSkillsPlayer(game, actor);
    assert.ok(player.reserves >= 5);
    player.reserves -= 5; player.forces[location] = 5;
  }
  const semuta = takeCard(game, 'r', SEMUTA_DRUG_ID), hajr = takeCard(game, 'a', 'hajr');
  const weapon = takeCard(game, 'e', 'Crysknife'), fallback = takeCard(game, 'e', 'Snooper');
  assertAdvancedNativeCustody(game);
  assert.deepEqual(semutaSkillsInventory(game), cards);
  for (const player of game.players) {
    const before = physical.players.find(p => p.id === player.id)!;
    assert.equal(player.spice, before.spice);
    assert.deepEqual(player.leaders, before.leaders);
  }
  assert.deepEqual(game.leaderSkills, physical.skills);
  return { game, owner: 'r', target: 'e', spender: 'a',
    trainer: game.leaderSkills!.assignments.find(a => a.owner === 'r')!.leader,
    semuta, hajr, weapon, fallback, territory: battleTerritory.id, location };
}
export function semutaSkillsDiscardStep(fixture: SemutaSkillsMentatFixture): SemutaSkillsStep {
  return { actor: fixture.spender, action: { type: 'card', card: fixture.hajr } };
}
export function reactSemutaSkillsDiscard(state: Game, claim: boolean): Game {
  let game = state;
  const pending = game.pendingTreacheryDiscard!;
  assert.equal(pending.reaction?.stage, 'offer');
  const event = pending.batch.event;
  if (claim) return applyAction(game, 'r', { type: 'semutaCommit', event });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
/** The discarded Hajr continuation must return Atreides' Movement first.
 * Native movement closings then choose the original Richese/Emperor battle. */
export function openSemutaSkillsMentat(state: Game, fixture: SemutaSkillsMentatFixture): Game {
  let game = state;
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.active, fixture.spender);
  assert.equal(game.phase, 5);
  for (let n = 0; game.phase === 5 && n < 5; n++)
    game = applyAction(game, game.active!, { type: 'endMovement' });
  assert.equal(game.phase, 6);
  for (let n = 0; game.phaseOpening && n < 3; n++) {
    const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!;
    game = applyAction(game, actor.id, { type: 'ready' });
  }
  const actor = game.active!;
  assert.ok(actor === fixture.owner || actor === fixture.target);
  return applyAction(game, actor, { type: 'chooseBattle', territory: fixture.territory,
    target: actor === fixture.owner ? fixture.target : fixture.owner });
}
