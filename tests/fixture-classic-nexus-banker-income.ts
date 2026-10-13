import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSpiceBankerIncomeGameForAudit,
  joinGame, newPlayer, viewGame, type Game, type Action,
} from '../game/engine';
import { validateLeaderSkills } from '../game/leader-skills';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { withSpiceBankerIncomeSetupRandomness } from './fixture-spice-banker-income';
import { nextClassicNexusSkillsPaymentsNativeStep } from './fixture-classic-nexus-skills-payments';

export const nexusBankerPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
};
export const nexusBankerClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
export function nexusBankerStep(game: Game): Game {
  const step = nextClassicNexusSkillsPaymentsNativeStep(game);
  assert.ok(step, 'The original Nexus/Skills continuation must retain a legal participant');
  return applyAction(game, step.actor, step.action);
}
export function advanceNexusBanker(state: Game, until: (game: Game) => boolean): Game {
  let game = state;
  for (let n = 0; n < 1200; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = nexusBankerStep(game);
  }
  throw Error('Native Nexus Banker continuation missed its requested boundary');
}

/** Original fresh lobby selection, genuine offers and native shipment timing.
 * Only the original Skill shuffle is controlled to give the first seat Banker.
 * No wallet, force, phase, receipt, plan or Nexus hand is manufactured. */
export function createClassicNexusBankerFixture(options: {
  advanced?: boolean; amount?: number; payer?: 'g' | 'e'; tech?: boolean; strongholds?: boolean;
} = {}) {
  const { advanced = false, payer = 'g', amount = payer === 'g' ? 4 : 2, tech = false, strongholds = false } = options;
  let game = createGame('CLASSICNEXUSBANKER', newPlayer('a', 'Atreides', 'atreides'), advanced, []);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  game.nexusCards = { cards: null, phase: null };
  if (tech) game.techTokens = createTechTokens();
  if (strongholds) game.strongholdCards = createStrongholdCards();
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withSpiceBankerIncomeSetupRandomness(() => initializeSpiceBankerIncomeGameForAudit(game));
  const started = structuredClone(game);
  while (game.status === 'setup') {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const skills = viewGame(game, actor).leaderSkills!;
      const skill = actor === 'a' ? 'spice-banker' : skills.offer!.cards.find(id => !skills.unavailableSkills?.[id]);
      assert.ok(skill && skills.offer!.cards.includes(skill));
      game = applyAction(game, actor, { type: 'leaderSkill', event: skills.offer!.event,
        skill, leader: skills.eligibleLeaders[0].id });
    } else game = nexusBankerStep(game);
  }
  validateLeaderSkills(game.leaderSkills!, game.players);
  const setup = structuredClone(game);
  game = advanceNexusBanker(game, g => g.turn === 1 && g.phase === 5 && g.active === payer && nexusBankerClean(g));
  const action: Action = { type: 'ship', territory: 'polar_sink', sector: 0, amount, elite: 0 };
  const beforePayment = structuredClone(game);
  game = applyAction(game, payer, action);
  game = advanceNexusBanker(game, nexusBankerClean);
  return { lobby, started, setup, beforePayment, paid: game, payer, amount, action, owner: 'a' };
}

/** Stop around the actual phase transition so the separate Mentat grant is
 * never mistaken for ordinary Arrakeen/Tech/Collection income. */
export function collectClassicNexusBanker(state: Game) {
  let game = state;
  let beforeMentat: Game | undefined;
  for (let n = 0; n < 1200; n++) {
    if (game.phase === 8 && nexusBankerClean(game)) {
      assert.ok(beforeMentat);
      return { beforeMentat, collected: game };
    }
    const next = nexusBankerStep(game);
    if (game.phase !== 8 && next.phase === 8) beforeMentat = structuredClone(game);
    game = next;
  }
  throw Error('Native Nexus Banker did not reach actual Mentat');
}
