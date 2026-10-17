import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, initializeFactionExpansionsGameForAudit,
  initializeLeaderSkillsGameForAudit, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';

export type IndependentCardModulesStep = { actor: string; action: Action };
export type IndependentCardModulesOptions = {
  advanced?: boolean;
  factions?: readonly FactionId[];
  expansions?: Game['expansions'];
  tech?: boolean;
  strongholds?: boolean;
  skills?: boolean;
  training?: Partial<Record<FactionId, LeaderSkillId>>;
  /** False keeps the original native deck for revealed-card comparisons. */
  independent?: boolean;
  homeworlds?: boolean;
};

/** Select only the original undealt fourteen-card lottery, never assignments. */
export function skillOfferRolls(game: Game, training: IndependentCardModulesOptions['training']): number[] {
  const source = LEADER_SKILL_CARDS.map(card => card.id), selected: LeaderSkillId[] = [];
  for (const player of game.players) {
    const skill = training?.[player.faction] ?? source.find(card => !selected.includes(card))!;
    assert.ok(source.includes(skill) && !selected.includes(skill), 'Use distinct original skill offers');
    selected.push(skill);
  }
  const rest = source.filter(card => !selected.includes(card));
  const desired = selected.flatMap(card => [card, rest.shift()!]).concat(rest);
  const working = [...source], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]);
    assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  return rolls;
}

/** Original unused modules and independent cards are selected before the real
 * development initializer. Keep the undealt `initial` input for existing native
 * constructors; `offered` is the actual post-initializer setup. No armies,
 * wallets, owners, phases or history are assigned afterward. */
export function createIndependentCardModulesFixture(options: IndependentCardModulesOptions = {}) {
  const factions = options.factions ?? ['emperor', 'atreides', 'guild'];
  const advanced = options.advanced ?? false;
  assert.ok(factions.length >= 2);
  let game = createGame('INDEPENDENTCARDMODULES', newPlayer(factions[0], factions[0], factions[0]),
    advanced, options.expansions ?? []);
  for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  if (options.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (options.tech ?? true) game.techTokens = createTechTokens();
  if (options.strongholds) game.strongholdCards = createStrongholdCards();
  const steps: IndependentCardModulesStep[] = [];
  for (const player of game.players) {
    const step: IndependentCardModulesStep = { actor: player.id, action: { type: 'ready' } };
    steps.push(step); game = applyAction(game, step.actor, step.action);
  }
  const initial = structuredClone(game);
  const rolls = options.skills ? skillOfferRolls(game, options.training) : [];
  let cursor = 0;
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length) array[0] = rolls[cursor++];
    else new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try {
    if (options.skills) {
      if (options.independent !== false) game.ecazTreachery = true;
      game = initializeLeaderSkillsGameForAudit(game);
    } else game = options.independent !== false ? initializeEcazTreacheryGameForAudit(game) :
      options.strongholds ? initializeStrongholdFactionsGameForAudit(game) : initializeFactionExpansionsGameForAudit(game);
  }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    let step: IndependentCardModulesStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!, player = game.players.find(seat => seat.id === actor)!;
      const skill = options.training?.[player.faction] ?? offer.cards.find(card => !own.unavailableSkills?.[card]);
      const leader = own.eligibleLeaders[0];
      assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader);
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const next = nextIndependentCardModulesStep(game); assert.ok(next, 'Complete original native setup');
      step = next;
    }
    steps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  return { initial, offered, game, steps };
}

/** Reuse original native choices, including all phase/module windows. */
export function nextIndependentCardModulesStep(game: Game): IndependentCardModulesStep | null {
  return nextStrongholdFactionsNativeStep(game);
}

export function advanceIndependentCardModules(game: Game, until: (state: Game) => boolean,
  steps: IndependentCardModulesStep[] = []): Game {
  let state = game;
  for (let count = 0; count < 1800; count++) {
    if (until(state)) return state;
    assert.notEqual(state.status, 'finished', 'Programme ended before its requested native boundary');
    const step = nextIndependentCardModulesStep(state);
    assert.ok(step, 'Supply the actual human Battle Plans before continuing');
    steps.push(structuredClone(step)); state = applyAction(state, step.actor, step.action);
  }
  throw Error('Independent module programme did not reach its requested boundary');
}
