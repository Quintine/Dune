import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, type Game } from '../game/engine';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';

function dealtSkillGame(native: 'emperor' | 'atreides' | 'harkonnen', advanced: boolean, skill: LeaderSkillId = 'suk-graduate'): Game {
  let game = createGame('SUKTEST', newPlayer('a', 'Rescuer', native), advanced);
  joinGame(game, newPlayer('d', 'Opponent', 'guild'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  const index = LEADER_SKILL_CARDS.findIndex((card) => card.id === skill);
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = shuffleIndex-- === index ? 0 : 0xffffffff;
    return array;
  });
  try { game = initializeLeaderSkillsGameForAudit(game); }
  finally { mock.restoreAll(); }
  assert.equal(game.leaderSkills!.offers.a.cards[0], skill);
  return game;
}

export function advancedAtreidesSukOffer(): Game {
  return dealtSkillGame('atreides', true);
}

/** Genuine module setup, then a conserved, explicitly staged battle position. */
export function leaderSkillBattle({ skill = 'suk-graduate' as LeaderSkillId, hide = true, advanced = false, elite = false, bluff = false, captured = false, capturedNativeSkill = undefined as LeaderSkillId | undefined, weaponKills = false, dial = 4, atreides = false, territory = 'arrakeen', sector = 10 } = {}): Game {
  const native = captured ? 'harkonnen' : atreides ? 'atreides' : 'emperor';
  let game = dealtSkillGame(native, advanced, skill);
  for (const id of ['a', 'd']) {
    const offer = game.leaderSkills!.offers[id];
    const selected = id === 'a' && advanced && atreides && skill === 'suk-graduate' ? offer.cards[1] : offer.cards[0];
    game = applyAction(game, id, { type: 'leaderSkill', event: offer.event,
      skill: selected, leader: id === 'a' ? `${native}-0` : 'guild-0' });
  }
  if (advanced && atreides && skill === 'suk-graduate') {
    // Stage an old saved assignment only after setup legally returned Suk to the deck.
    const assignment = game.leaderSkills!.assignments.find((a) => a.owner === 'a')!;
    const sukIndex = game.leaderSkills!.deck.indexOf('suk-graduate');
    assert.ok(sukIndex >= 0);
    game.leaderSkills!.deck[sukIndex] = assignment.skill;
    assignment.skill = 'suk-graduate';
    validateLeaderSkills(game.leaderSkills!, game.players);
  }
  for (let i = 0; game.status === 'setup' && i < 10; i++) {
    const owner = game.players.find((p) => p.traitorChoices.length);
    assert.ok(owner);
    game = applyAction(game, owner.id, { type: 'traitor', leader: owner.traitorChoices[0] });
  }
  assert.equal(game.status, 'playing');
  if (captured) {
    const [own, other] = game.leaderSkills!.assignments;
    [own.skill, other.skill] = [other.skill, own.skill];
    game.players[1].leaders[0].capturedBy = 'a';
    if (capturedNativeSkill && own.skill !== capturedNativeSkill) {
      const index = game.leaderSkills!.deck.indexOf(capturedNativeSkill);
      assert.ok(index >= 0);
      [own.skill, game.leaderSkills!.deck[index]] = [game.leaderSkills!.deck[index], own.skill];
    }
  }
  const battleKey = `${territory}:${sector}`;
  for (const player of game.players) {
    game.deck.push(...player.hand); player.hand = [];
    player.forces = { [battleKey]: 5 }; player.reserves = 15; player.tanks = 0;
    player.spice = 20; player.battleLosses = 0;
    if (player.elites) player.elites = { forces: {}, reserves: 5, tanks: 0, revived: 0 };
  }
  if (elite) game.players[0].elites = { forces: { [battleKey]: 2 }, reserves: 3, tanks: 0, revived: 0 };
  const cardIndex = game.deck.findIndex((card) => card.kind === 'worthless');
  assert.ok(cardIndex >= 0);
  const [played] = game.deck.splice(cardIndex, 1);
  game.players[0].hand.push(played);
  let enemyWeapon: string | undefined;
  if (weaponKills) {
    const index = game.deck.findIndex((card) => card.kind === 'projectile');
    assert.ok(index >= 0);
    const [weapon] = game.deck.splice(index, 1);
    game.players[1].hand.push(weapon); enemyWeapon = weapon.id;
  }
  Object.assign(game, { phase: 6, storm: 18, order: ['a', 'd'], active: 'a', ready: [], decision: null, response: null, phaseOpening: null });
  game = applyAction(game, 'a', { type: 'chooseBattle', territory, target: 'd' });
  while (game.decision?.kind === 'leaderSkillVisibility') {
    const decision = game.decision;
    game = applyAction(game, decision.player, { type: 'leaderSkillVisibility', event: decision.event,
      hide: decision.player === 'a' ? hide : false });
  }
  while (game.battle?.preparation)
    game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
  if (game.decision?.kind === 'fullPlanOffer')
    game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
  game = applyAction(game, 'a', { type: 'battlePlan', dial, support: advanced ? 3 : 0,
    leader: captured ? 'guild-0' : hide && !bluff ? `${native}-0` : `${native}-1`, weapon: played.id });
  game = applyAction(game, 'd', { type: 'battlePlan', dial: 0, leader: 'guild-1', weapon: enemyWeapon });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  return game;
}

export function resolveLeaderSkillBattle(game: Game): Game {
  return applyAction(game, 'd', { type: 'traitorCall', call: false });
}
