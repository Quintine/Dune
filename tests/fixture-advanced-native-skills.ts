import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeSpiceBankerIncomeGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type AdvancedNativeSkillsOptions = {
  family: 'ixians' | 'choam';
  requestedSkill?: LeaderSkillId;
  skillOwner?: FactionId;
  opponents?: readonly FactionId[];
  bankerIncome?: boolean;
  /** Continue this actual authenticated lobby/setup without replacing its seats. */
  initial?: Game;
};

export function advancedNativePlayer(game: Game, faction: FactionId): Player {
  const player = game.players.find(p => p.faction === faction);
  assert.ok(player, `Missing actual ${faction} seat`);
  return player;
}

/** Only the first physical all14 shuffle is controlled. Later native shuffles
 * use real entropy. Place the requested skill in its actual owner's offer. */
function withSkillShuffle<T>(skill: LeaderSkillId, ownerIndex: number, initialize: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  const target = LEADER_SKILL_CARDS.findIndex(card => card.id === skill);
  const slot = ownerIndex * 2;
  assert.ok(target >= 0 && slot < LEADER_SKILL_CARDS.length);
  let index = LEADER_SKILL_CARDS.length - 1;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index <= 0) return Reflect.apply(original, crypto, [array]) as V;
    assert.ok(array instanceof Uint32Array && array.length === 1);
    const swap = index === Math.max(target, slot) ? Math.min(target, slot) : index;
    array[0] = swap === index ? 0xffffffff : Math.ceil(swap * 0x100000000 / (index + 1));
    index--;
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Genuine fresh Advanced native lobby, native starting-card decisions and
 * physical skill offers. No played save is converted and no deck is cherry-picked. */
export function initializeAdvancedNativeSkillsSetup(options: AdvancedNativeSkillsOptions): Game {
  const ownerFaction = options.skillOwner ?? options.family;
  const expansion = options.family === 'ixians' ? 'ix' : 'choam';
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions = [ownerFaction, options.family, ...(options.opponents ?? ['atreides', 'emperor'] as FactionId[])]
      .filter((faction, index, all) => all.indexOf(faction) === index);
    game = createGame('ADVNATIVE', newPlayer(factions[0], factions[0], factions[0]), true, [expansion]);
    for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  }
  assert.equal(game.advanced, true);
  assert.ok(game.expansions.includes(expansion));
  const owner = advancedNativePlayer(game, ownerFaction);
  if (game.status === 'setup') {
    assert.ok(game.leaderSkills && game.turn === 1 && game.phase === 0,
      'Only the original fresh native skill setup may continue.');
    return game;
  }
  assert.equal(game.status, 'lobby');
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  return withSkillShuffle(options.requestedSkill ?? 'suk-graduate', game.players.findIndex(p => p.id === owner.id),
    () => options.bankerIncome ? initializeSpiceBankerIncomeGameForAudit(game) : initializeLeaderSkillsGameForAudit(game));
}

/** Finish original setup decisions from the actual own-seat projections. */
export function completeAdvancedNativeSkillsSetup(state: Game, options: AdvancedNativeSkillsOptions): Game {
  let game = state;
  const owner = advancedNativePlayer(game, options.skillOwner ?? options.family).id;
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.decision?.kind === 'ixSetup') {
      const actor = game.decision.player;
      const card = viewGame(game, actor).ixTechnology!.setup![0];
      assert.ok(card);
      game = applyAction(game, actor, { type: 'decision', card: card.id });
    } else if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const requested = options.requestedSkill ?? 'suk-graduate';
      const skill = actor === owner && offer.cards.includes(requested) && !view.unavailableSkills?.[requested]
        ? requested : offer.cards.find(card => !view.unavailableSkills?.[card]);
      assert.ok(skill && view.eligibleLeaders[0]);
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill, leader: view.eligibleLeaders[0].id });
    } else game = advancedNativeStep(game);
  }
  assert.equal(game.status, 'playing');
  return game;
}

export function completedAdvancedNativeSkillsGame(options: AdvancedNativeSkillsOptions): Game {
  return completeAdvancedNativeSkillsSetup(initializeAdvancedNativeSkillsSetup(options), options);
}

export function advancedNativeStep(game: Game): Game {
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next);
  return applyAction(game, next.actor, next.action);
}

export function advanceAdvancedNativeSkillsToPhase(state: Game, target: number): Game {
  let game = state;
  for (let i = 0; (game.phase !== target || game.phaseOpening || game.response || game.decision)
    && game.turn === state.turn && game.status === 'playing' && i < 1000; i++) game = advancedNativeStep(game);
  assert.equal(game.turn, state.turn);
  assert.equal(game.phase, target);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  return game;
}

export function rejectAdvancedNativeAction(game: Game, actor: string, action: Action, pattern?: RegExp): void {
  const before = structuredClone(game);
  if (pattern) assert.throws(() => applyAction(game, actor, action), pattern);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

export function assertAdvancedNativeCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'ixians' ? 7 : 5);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
}

/** Explicit controlled rule-unit position AFTER genuine setup. Return every
 * deployed piece to its own reserves, then transfer only the selected forces;
 * preserve real wallets, leaders, traits and every physical skill/treachery card.
 * This is not claimed to be a played turn history. */
export function createAdvancedNativeSkillBattle(options: AdvancedNativeSkillsOptions): Game {
  const game = completedAdvancedNativeSkillsGame(options);
  const owner = advancedNativePlayer(game, options.skillOwner ?? options.family);
  const enemy = advancedNativePlayer(game, 'emperor');
  for (const p of game.players) {
    game.deck.push(...p.hand);
    p.hand = [];
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {};
    }
  }
  for (const p of [owner, enemy]) {
    assert.ok(p.reserves >= 8);
    p.reserves -= 8;
    p.forces['wind_pass:14'] = 8;
  }
  if (owner.faction === 'ixians') {
    owner.elites!.reserves -= 2;
    owner.elites!.forces['wind_pass:14'] = 2;
  }
  Object.assign(game, { phase: 6, active: owner.id, order: [owner.id, enemy.id, ...game.players.filter(p => p !== owner && p !== enemy).map(p => p.id)],
    storm: 18, ready: [], decision: null, response: null, phaseOpening: null });
  assertAdvancedNativeCustody(game);
  return game;
}

export function openAdvancedNativeSkillBattle(state: Game, actor: string, target: string): Game {
  let game = applyAction(state, actor, { type: 'chooseBattle', territory: 'wind_pass', target });
  for (let i = 0; (game.response || game.decision || game.battle?.preparation) && i < 100; i++) {
    if (game.decision?.kind === 'leaderSkillVisibility') {
      game = applyAction(game, game.decision.player, { type: 'leaderSkillVisibility', event: game.decision.event, hide: true });
    } else game = advancedNativeStep(game);
  }
  assert.equal(game.decision, null);
  assert.equal(game.response, null);
  return game;
}

/** Resolve only native response/cleanup actions, stopping at optional Suk rescue. */
export function finishAdvancedNativeSkillAftermath(state: Game): Game {
  let game = state;
  for (let i = 0; (game.response || game.decision || game.battle || game.pendingTreacheryDiscard) && i < 100; i++) {
    if (game.decision?.kind === 'sukRescue') break;
    if (game.decision?.kind === 'ixSubstitution') {
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    } else if (game.decision?.kind === 'battleCards') {
      game = applyAction(game, game.decision.player, { type: 'decision', discard: [] });
    } else game = advancedNativeStep(game);
  }
  return game;
}
