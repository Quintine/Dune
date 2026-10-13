import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nextClassicNexusSkillsPaymentsNativeStep } from './fixture-classic-nexus-skills-payments';

export type CapturedSkillSpecialStep = { actor: string; action: Action };
export const capturedSkillSpecialPlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player);
  return player;
};
export const capturedSkillSpecialClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Override only the requested original shuffle draws, forwarding every later draw. */
function draws<T>(rolls: number[], operation: () => T): T {
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
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function skillRolls(selected: LeaderSkillId[]): number[] {
  const working = LEADER_SKILL_CARDS.map(c => c.id);
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
  return rolls;
}
export function capturedSkillSpecialStock(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id).sort();
}
export function capturedSkillSpecialInventory(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck,
    ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills!.assignments.map(assignment => assignment.skill)].sort(),
  LEADER_SKILL_CARDS.map(card => card.id).sort());
}
export function advanceCapturedSkillSpecial(state: Game, until: (game: Game) => boolean,
  actions: CapturedSkillSpecialStep[] = []): Game {
  let game = state;
  for (let n = 0; n < 1200; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextClassicNexusSkillsPaymentsNativeStep(game);
    assert.ok(step, 'Only a real human battle plan may stop this native continuation');
    actions.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native captured-skill Special continuation did not reach its boundary');
}

/** Original Advanced classic E/H/G setup and paid deployment, original battle
 * plans, capture offer/random draw/Keep, and next-turn Revival. No board,
 * wallet, death, capture, assignment, phase or continuation is manufactured. */
export function createCapturedSkillSpecialRevivalFixture() {
  const actions: CapturedSkillSpecialStep[] = [], staging: string[] = [];
  let game = createGame('CAPTUREDSKILLSPECIAL', newPlayer('e', 'Emperor', 'emperor'), true, []);
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  for (const seat of game.players) act(seat.id, { type: 'ready' });
  const skills: LeaderSkillId[] = ['sandmaster', 'smuggler', 'prana-bindu-adept'];
  game = draws(skillRolls(skills), () => initializeLeaderSkillsGameForAudit(game));
  staging.push('Only original all14 Skill Card shuffle draws controlled; other initializer entropy native.');
  const initial = structuredClone(game);
  while (game.status === 'setup') {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leaders = capturedSkillSpecialPlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => actor === 'h' ? a.strength - b.strength : b.strength - a.strength);
      const skill = skills[game.players.findIndex(p => p.id === actor)];
      assert.ok(offer.cards.includes(skill) && !view.unavailableSkills?.[skill]);
      act(actor, { type: 'leaderSkill', event: offer.event, skill, leader: leaders[0].id });
    } else {
      const step = nextClassicNexusSkillsPaymentsNativeStep(game);
      assert.ok(step);
      act(step.actor, step.action);
    }
  }
  const setup = structuredClone(game);
  const stock = capturedSkillSpecialStock(game);
  const captive = game.leaderSkills!.assignments.find(a => a.owner === 'e')!.leader;
  assert.equal(capturedSkillSpecialPlayer(game, 'e').leaders.find(l => l.id === captive)!.name, 'Hasimir Fenring');
  // Unplayed original land cards avoid an unrelated first/second-turn Nexus.
  const land = game.spiceDeck.filter(c => 'territory' in c).slice(0, 4);
  assert.equal(land.length, 4);
  for (const [index, card] of land.entries())
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Four conserved original unplayed land Spice Cards ordered before their native draws.');
  const hold = (actor: string, matches: (card: Card) => boolean): string => {
    const player = capturedSkillSpecialPlayer(game, actor);
    const held = player.hand.find(matches);
    if (held) return held.id;
    const index = game.deck.findIndex(matches);
    const donor = index < 0 ? game.players.find(p => p.id !== actor && p.hand.some(matches)) : undefined;
    assert.ok(index >= 0 || donor, 'Only original unused physical cards may change custody');
    assert.ok(player.hand.length < handLimit(player));
    const card = index >= 0 ? game.deck.splice(index, 1)[0]
      : donor!.hand.splice(donor!.hand.findIndex(matches), 1)[0];
    player.hand.push(card);
    staging.push(`Conserved original unused ${card.id}: ${donor?.id ?? 'deck'} to ${actor}.`);
    return card.id;
  };
  const karama = hold('e', c => c.effect === 'karama');
  const weapon = hold('h', c => c.kind === 'projectile');
  game = advanceCapturedSkillSpecial(game, g => g.phase === 5 && g.active === 'e' && capturedSkillSpecialClean(g), actions);
  const beforeShipment = structuredClone(game);
  assert.equal(capturedSkillSpecialPlayer(game, 'h').forces['carthag:11'], 10);
  act('e', { type: 'ship', territory: 'carthag', sector: 11, amount: 2, elite: 0, allyPayment: 0 });
  game = advanceCapturedSkillSpecial(game, capturedSkillSpecialClean, actions);
  const afterShipment = structuredClone(game);
  assert.equal(capturedSkillSpecialPlayer(game, 'e').spice, capturedSkillSpecialPlayer(beforeShipment, 'e').spice - 2);
  act('e', { type: 'endMovement' });
  game = advanceCapturedSkillSpecial(game, g => g.phase === 6 && capturedSkillSpecialClean(g), actions);
  const beforeBattle = structuredClone(game);
  const chooser = game.active!;
  assert.ok(chooser === 'e' || chooser === 'h');
  act(chooser, { type: 'chooseBattle', territory: 'carthag', target: chooser === 'e' ? 'h' : 'e' });
  game = advanceCapturedSkillSpecial(game, g => !!g.battle && !g.battle.preparation &&
    (!g.battle.preLeader || g.battle.preLeader.closed) && capturedSkillSpecialClean(g), actions);
  const winner = capturedSkillSpecialPlayer(game, 'h').leaders.filter(l => !l.dead)
    .sort((a, b) => b.strength - a.strength)[0].id;
  const dead = capturedSkillSpecialPlayer(game, 'e').leaders.filter(l => l.id !== captive && !l.dead)
    .sort((a, b) => b.strength - a.strength)[0].id;
  const battle = game.battle!;
  for (const actor of [battle.attacker, battle.defender]) act(actor, {
    type: 'battlePlan', dial: actor === 'h' ? 1 : 0, support: actor === 'h' ? 1 : 0,
    leader: actor === 'h' ? winner : dead, ...(actor === 'h' ? { weapon } : {}),
  });
  for (const actor of [battle.attacker, battle.defender]) act(actor, { type: 'traitorCall', call: false });
  game = advanceCapturedSkillSpecial(game, g => g.decision?.kind === 'captureOffer', actions);
  const captureOffer = structuredClone(game);
  assert.equal(game.decision?.player, 'h');
  assert.equal(capturedSkillSpecialPlayer(game, 'e').leaders.find(l => l.id === dead)!.dead, true);
  act('h', { type: 'decision', accept: true });
  assert.equal(game.response?.kind, 'capture');
  // Fenring is the first original live candidate. Identity-preserving shuffle
  // rolls control only the original capture draw, never the resulting identity.
  const live = capturedSkillSpecialPlayer(game, 'e').leaders.filter(l => !l.dead && (!l.usedAt || l.usedAt === 'carthag'));
  assert.equal(live[0].id, captive);
  while (game.response?.kind === 'capture') {
    const remaining = game.players.filter(p => !game.response!.passed.includes(p.id) &&
      viewGame(game, p.id).responseControls!.cancelCards.length > 0);
    assert.ok(remaining.length);
    const actor = remaining[0].id;
    const action: Action = { type: 'passResponse' };
    if (remaining.length === 1) {
      actions.push({ actor, action });
      game = draws(Array(live.length - 1).fill(0xffffffff), () => applyAction(game, actor, action));
    } else act(actor, action);
  }
  assert.equal(game.decision?.kind, 'capturedLeader');
  if (game.decision?.kind === 'capturedLeader') assert.equal(game.decision.leader, captive);
  staging.push('Only original RANDOM CAPTURE shuffle draws controlled to retain original first live Fenring candidate.');
  act('h', { type: 'decision', mode: 'keep' });
  const afterCapture = structuredClone(game);
  game = advanceCapturedSkillSpecial(game, g => g.turn === 2 && g.phase === 4 && capturedSkillSpecialClean(g), actions);
  assert.equal(capturedSkillSpecialPlayer(game, 'e').leaders.find(l => l.id === captive)!.capturedBy, 'h');
  assert.equal(capturedSkillSpecialPlayer(game, 'e').specialKaramaUsed, undefined);
  assert.equal(capturedSkillSpecialPlayer(game, 'e').leaderRevived, false);
  capturedSkillSpecialInventory(game);
  assert.deepEqual(capturedSkillSpecialStock(game), stock);
  const action: Action = { type: 'card', mode: 'special', card: karama, leader: dead };
  return { initial, setup, beforeShipment, afterShipment, beforeBattle, captureOffer,
    afterCapture, game, captive, dead, karama, weapon, action, actions, staging, stock };
}
