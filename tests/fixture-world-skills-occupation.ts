import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import {
  actHomeworldPhaseOccupation, advanceHomeworldPhaseOccupation, completeHomeworldPhaseOccupation,
  createHomeworldPhaseOccupationFixture, finishHomeworldPhaseOccupation,
  homeworldPhaseOccupationClean, homeworldPhaseOccupationInventory, homeworldPhaseOccupationPlayer,
} from './fixture-homeworld-phase-occupation';

/** Banker observes another payer: Ecaz earns from Atreides' actual Bank10.
 * Atreides cannot earn its own shipment payment through its own Banker. */
export const WORLD_SKILLS_OCCUPATION_TRAINING = {
  atreides: 'warmaster', ecaz: 'spice-banker', ixians: 'mentat',
} as const;
export const actWorldSkillsOccupation = actHomeworldPhaseOccupation;
export const advanceWorldSkillsOccupation = advanceHomeworldPhaseOccupation;
export const finishWorldSkillsOccupation = finishHomeworldPhaseOccupation;
export const worldSkillsOccupationClean = homeworldPhaseOccupationClean;
export const worldSkillsOccupationInventory = homeworldPhaseOccupationInventory;
export const worldSkillsOccupationPlayer = homeworldPhaseOccupationPlayer;
export function worldSkillsOccupationSkillInventory(game: Game) {
  const skills = game.leaderSkills; assert.ok(skills);
  const cards = [...skills.deck, ...skills.assignments.map(assignment => assignment.skill),
    ...Object.values(skills.offers).flatMap(offer => offer.cards)].sort();
  assert.equal(new Set(cards).size, cards.length, 'Each original Skill Card retains one physical slot');
  assert.deepEqual(cards, LEADER_SKILL_CARDS.map(card => card.id).sort()); return cards;
}
export function worldSkillsOccupationDeferred(game: Game, owner = 'ecaz') {
  return viewGame(game, owner).spiceBankerIncome?.deferred.find(credit => credit.owner === owner)?.amount ?? 0;
}

/** Entirely native shared Caladan programme with original all14 offers. Only
 * original unopened skill/deck/scalar lotteries are selected; actual public
 * leaderSkill actions choose living native discs. There is no installed skill,
 * played card, army, wallet, occupation event or income receipt. The source
 * stops before the existing final Ix End Movement callback. */
export function createWorldSkillsOccupationFixture(options: { advanced?: boolean } = {}) {
  const source = createHomeworldPhaseOccupationFixture({ advanced: options.advanced ?? false,
    skills: true, training: WORLD_SKILLS_OCCUPATION_TRAINING });
  const banker = source.owner;
  const originalSkills = worldSkillsOccupationSkillInventory(source.setup);
  worldSkillsOccupationSkillInventory(source.game);
  const trainingActions = source.sourceActions.filter(step => step.action.type === 'leaderSkill');
  assert.equal(trainingActions.length, 3);
  for (const [actor, skill] of Object.entries(WORLD_SKILLS_OCCUPATION_TRAINING)) {
    const assignment = source.afterSetup.leaderSkills!.assignments.find(assignment => assignment.owner === actor);
    assert.ok(assignment); assert.equal(assignment.skill, skill);
    assert.ok(worldSkillsOccupationPlayer(source.afterSetup, actor).leaders.some(leader => leader.id === assignment.leader && !leader.dead));
    assert.ok(trainingActions.some(step => step.actor === actor && step.action.skill === skill && step.action.leader === assignment.leader));
  }
  const bankerSource = source.evacuation.after.spiceBankerIncome?.sources.find(receipt =>
    receipt.source.kind === 'shipment' && receipt.source.bankLegs.some(leg => leg.payer === source.native && leg.amount === 10));
  assert.ok(bankerSource?.grant);
  assert.equal(bankerSource.grant.owner, banker); assert.equal(bankerSource.grant.amount, 1);
  assert.equal(worldSkillsOccupationDeferred(source.game, banker), 1);
  return { ...source, banker, training: WORLD_SKILLS_OCCUPATION_TRAINING, trainingActions,
    originalSkills, bankerSource: structuredClone(bankerSource), staging: [] as string[],
    sourceDisclosure: 'Original all14 offer lottery is selected before the public Start. Three actual leaderSkill choices train native A Warmaster, Ecaz Banker and Ix Mentat; the shared programme earns both paid shipments and Caladan sole occupation.' };
}
export type WorldSkillsOccupationFixture = ReturnType<typeof createWorldSkillsOccupationFixture>;

export function completeWorldSkillsOccupation(f: WorldSkillsOccupationFixture, state = f.game) {
  const result = completeHomeworldPhaseOccupation(f, state);
  const bankerCollection = result.game.spiceBankerIncome?.collections.find(collection =>
    collection.turn === f.game.turn && collection.grants.includes(f.bankerSource.cursor));
  assert.ok(bankerCollection, 'The original Mentat event collects the earned Banker receipt');
  worldSkillsOccupationSkillInventory(result.game);
  return { ...result, bankerCollection: structuredClone(bankerCollection) };
}
