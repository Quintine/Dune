import assert from 'node:assert/strict';
import {applyAction, type Game} from '../game/engine';
import {completedIxSkillsGame} from './ix-skills-fixture';
import {completedTleilaxuSkillsGame} from './tleilaxu-skills-fixture';
import {completedChoamSkillsGame} from './choam-skills-fixture';
import {completedMoritaniSkillsGame} from './moritani-skills-fixture';
import {finishToMovement} from './fixture-advanced-source';

export const NATIVE_MENTAT_FAMILIES = ['ixians','tleilaxu','choam','moritani'] as const;
export type NativeMentatFamily = typeof NATIVE_MENTAT_FAMILIES[number];

/** Real native setup/assignment and Storm; conserved rule-unit battle position. */
export function nativeMentatBattle(family: NativeMentatFamily, matching = true, preview = true, begin = true): Game {
  const options = {requestedSkill:'mentat' as const};
  let game = family === 'ixians' ? completedIxSkillsGame(options)
    : family === 'tleilaxu' ? completedTleilaxuSkillsGame(options)
    : family === 'choam' ? completedChoamSkillsGame(options)
    : completedMoritaniSkillsGame(options);
  game = finishToMovement(game);
  if (preview) game.mentatQuestionPreview = true;
  const owner = game.players.find(p => p.faction === family)!;
  const target = game.players.find(p => p.faction === 'emperor')!;
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
  for (const p of [owner,target]) {
    assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= 2);
    p.reserves -= 2;
    p.forces['arrakeen:10'] = 2;
  }
  const weapon = game.expansions.includes('ix') ? 'Weirding Way' : 'Crysknife';
  const name = matching ? weapon : 'Baliset';
  const index = game.deck.findIndex(c => c.name === name);
  assert.ok(index >= 0);
  target.hand.push(...game.deck.splice(index,1));
  Object.assign(game,{phase:6,storm:18,active:owner.id,order:[owner.id,...game.players.filter(p => p.id !== owner.id).map(p => p.id)],ready:[],response:null,decision:null,phaseOpening:null});
  return begin ? applyAction(game,owner.id,{type:'chooseBattle',territory:'arrakeen',target:target.id}) : game;
}
