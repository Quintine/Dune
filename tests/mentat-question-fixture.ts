import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';

export const mentatReload = (game: Game): Game =>
  JSON.parse(JSON.stringify(game)) as Game;
export const mentatPlayer = (game: Game, id: string) =>
  game.players.find((player) => player.id === id)!;
export function takeMentatCard(game: Game, player: string, name: string) {
  const pool =
    name === 'Stone Burner' || name === 'Mirror Weapon'
      ? game.richeseCache!
      : game.deck;
  const index = pool.findIndex((card) => card.name === name);
  assert.ok(index >= 0, `Missing fixture card ${name}`);
  const [card] = pool.splice(index, 1);
  mentatPlayer(game, player).hand.push(card);
  return card;
}
/** Genuine public skill assignment and setup, followed by a conserved battle position. */
export function mentatQuestionGame({
  advanced = false,
  choam = false,
  cards = ['Crysknife', 'Snooper'],
  begin = true,
  captured = false,
  preview = true,
}: {
  advanced?: boolean;
  choam?: boolean;
  cards?: string[];
  begin?: boolean;
  captured?: boolean;
  preview?: boolean;
} = {}): Game {
  const native = choam ? 'richese' : 'emperor';
  let game = createGame(
    'MENTATQA',
    newPlayer('a', 'Mentat owner', native),
    advanced,
    choam ? ['choam'] : [],
  );
  joinGame(
    game,
    newPlayer('d', 'Questioned opponent', captured ? 'harkonnen' : 'atreides'),
  );
  joinGame(game, newPlayer('o', 'Observer', 'guild'));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  // Server-only review fixture opt-in; ordinary Leader Skills starts remain unchanged.
  if (preview) game.mentatQuestionPreview = true;
  const index = LEADER_SKILL_CARDS.findIndex((card) => card.id === 'mentat');
  let cursor = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = cursor-- === index ? 0 : 0xffffffff;
    return array;
  });
  try {
    game = initializeLeaderSkillsGameForAudit(game);
  } finally {
    mock.restoreAll();
  }
  assert.ok(game.leaderSkills!.offers.a.cards.includes('mentat'));
  for (let step = 0; game.status === 'setup' && step < 80; step++) {
    let progress = false;
    for (const player of game.players) {
      const offer = game.leaderSkills!.offers[player.id];
      const actions =
        game.setupStage === 'leaderSkills' && offer
          ? [
              {
                type: 'leaderSkill',
                event: offer.event,
                skill: player.id === 'a' ? 'mentat' : offer.cards[0],
                leader: `${player.faction}-0`,
              },
            ]
          : game.setupStage === 'traitors' && player.traitorChoices.length
            ? [{ type: 'traitor', leader: player.traitorChoices[0] }]
            : botActions(viewGame(game, player.id));
      for (const action of actions)
        try {
          game = applyAction(game, player.id, action);
          progress = true;
          break;
        } catch {}
      if (progress) break;
    }
    assert.ok(progress, `Setup stalled at ${game.setupStage}`);
  }
  assert.equal(game.status, 'playing');
  for (const player of game.players) {
    game.deck.push(...player.hand);
    Object.assign(player, {
      hand: [],
      forces: player.id === 'o' ? {} : { 'arrakeen:10': 5 },
      reserves: player.id === 'o' ? 20 : 15,
      tanks: 0,
      spice: 20,
    });
  }
  takeMentatCard(game, 'a', 'Baliset');
  takeMentatCard(game, 'o', 'Karama');
  for (const name of cards) takeMentatCard(game, 'd', name);
  if (captured) mentatPlayer(game, 'a').leaders[0].capturedBy = 'd';
  Object.assign(game, {
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'a',
    order: ['a', 'd', 'o'],
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  return begin
    ? applyAction(game, 'a', {
        type: 'chooseBattle',
        territory: 'arrakeen',
        target: 'd',
      })
    : game;
}
export function finishMentatPosture(game: Game, hide = true): Game {
  while (game.decision?.kind === 'leaderSkillVisibility') {
    const decision = game.decision;
    game = applyAction(game, decision.player, {
      type: 'leaderSkillVisibility',
      event: decision.event,
      hide: decision.player === 'a' ? hide : false,
    });
  }
  return game;
}
