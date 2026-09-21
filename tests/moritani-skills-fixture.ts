import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  type Action,
  type Game,
  type Player,
} from '../game/engine';
import {
  LEADER_SKILL_CARDS,
  type LeaderSkillId,
} from '../game/leader-skill-cards';
import type { TerrorKind } from '../game/moritani-terror';

export const MORITANI_SKILLS_SEATS = {
  moritani: 'm',
  atreides: 'a',
  emperor: 'e',
} as const;

export type MoritaniSkillsFaction = keyof typeof MORITANI_SKILLS_SEATS;

export type MoritaniSkillsFixtureOptions = {
  requestedSkill?: LeaderSkillId;
  skillOwner?: MoritaniSkillsFaction;
};

const names: Record<MoritaniSkillsFaction, string> = {
  moritani: 'Moritani',
  atreides: 'Atreides',
  emperor: 'Emperor',
};

export const reloadMoritaniSkillsGame = (game: Game): Game =>
  JSON.parse(JSON.stringify(game)) as Game;

export function moritaniSkillsPlayer(game: Game, id: string): Player {
  return game.players.find((player) => player.id === id)!;
}

export function rejectMoritaniSkillsAction(
  game: Game,
  id: string,
  action: Action,
  pattern?: RegExp,
): void {
  const before = structuredClone(game);
  if (pattern) assert.throws(() => applyAction(game, id, action), pattern);
  else assert.throws(() => applyAction(game, id, action));
  assert.deepEqual(game, before);
}

export function assertMoritaniSkillsCustody(game: Game): void {
  const skills = game.leaderSkills!;
  const physical = [
    ...skills.deck,
    ...Object.values(skills.offers).flatMap((offer) => offer.cards),
    ...skills.assignments.map((assignment) => assignment.skill),
  ];
  const canonical = LEADER_SKILL_CARDS.map((card) => card.id);
  assert.equal(physical.length, canonical.length);
  assert.equal(new Set(physical).size, canonical.length);
  assert.deepEqual([...physical].sort(), [...canonical].sort());
}

/**
 * Reach the real private Leader Skill setup offers from a ready Basic lobby.
 * Seating the requested owner first lets the production shuffle seam put that
 * requested physical card at the front of its genuine two-card deal.
 */
export function initializedMoritaniSkillsOffers(
  options: MoritaniSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'warmaster';
  const skillOwner = options.skillOwner ?? 'moritani';
  const factions = (
    [skillOwner, 'moritani', 'atreides', 'emperor'] as MoritaniSkillsFaction[]
  ).filter((faction, index, all) => all.indexOf(faction) === index);
  const first = factions[0];
  let game = createGame(
    'MORISKIL',
    newPlayer(MORITANI_SKILLS_SEATS[first], names[first], first),
    false,
    ['ecaz'],
  );
  for (const faction of factions.slice(1))
    joinGame(
      game,
      newPlayer(MORITANI_SKILLS_SEATS[faction], names[faction], faction),
    );
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });

  const targetIndex = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === requestedSkill,
  );
  assert.ok(targetIndex >= 0);
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = shuffleIndex-- === targetIndex ? 0 : 0xffffffff;
    return array;
  });
  try {
    game = initializeLeaderSkillsGameForAudit(game);
  } finally {
    mock.restoreAll();
  }

  const owner = MORITANI_SKILLS_SEATS[skillOwner];
  assert.equal(game.status, 'setup');
  assert.equal(game.setupStage, 'leaderSkills');
  assert.equal(game.leaderSkills!.offers[owner].cards[0], requestedSkill);
  assertMoritaniSkillsCustody(game);
  return game;
}

/** Complete skills, traitors, and Moritani's six-force placement by actions. */
export function completedMoritaniSkillsGame(
  options: MoritaniSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'warmaster';
  const skillOwner = options.skillOwner ?? 'moritani';
  const requestedOwner = MORITANI_SKILLS_SEATS[skillOwner];
  let game = initializedMoritaniSkillsOffers(options);

  for (const player of game.players) {
    const offer = game.leaderSkills!.offers[player.id];
    game = applyAction(game, player.id, {
      type: 'leaderSkill',
      event: offer.event,
      skill: player.id === requestedOwner ? requestedSkill : offer.cards[0],
      leader: player.leaders[0].id,
    });
  }
  assert.equal(game.setupStage, 'traitors');
  for (const player of game.players) {
    const choice = moritaniSkillsPlayer(game, player.id).traitorChoices[0];
    assert.ok(choice);
    game = applyAction(game, player.id, { type: 'traitor', leader: choice });
  }
  assert.deepEqual(game.decision, {
    kind: 'moritaniSetup',
    player: MORITANI_SKILLS_SEATS.moritani,
  });
  game = applyAction(game, MORITANI_SKILLS_SEATS.moritani, {
    type: 'decision',
    territory: 'polar_sink',
    sector: 0,
  });
  assert.equal(game.status, 'playing');
  assert.equal(game.setupStage, undefined);
  assert.equal(moritaniSkillsPlayer(game, 'm').forces['polar_sink:0'], 6);
  assert.equal(moritaniSkillsPlayer(game, 'm').reserves, 14);
  assertMoritaniSkillsCustody(game);
  return game;
}

/**
 * Stage only the phase controls, then place a real hidden Terror token through
 * the Mentat decision and its complete response window. Force custody is not
 * changed by this helper.
 */
export function placeMoritaniSkillsTerror(
  state: Game,
  kind: TerrorKind,
  territory = 'carthag',
): Game {
  let game = structuredClone(state);
  Object.assign(game, {
    phase: 7,
    active: null,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  assert.equal(game.phase, 8);
  assert.equal(game.decision?.kind, 'moritaniPlacement');
  const token = game.moritaniTerror!.tokens.find(
    (candidate) => candidate.kind === kind,
  );
  assert.ok(token);
  game = applyAction(game, MORITANI_SKILLS_SEATS.moritani, {
    type: 'decision',
    token: token.id,
    territory,
  });
  while (game.response) {
    const responder = game.players.find(
      (player) => !game.response!.passed.includes(player.id),
    );
    assert.ok(responder);
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  assert.equal(
    game.moritaniTerror!.tokens.find((candidate) => candidate.id === token.id)
      ?.location,
    territory,
  );
  return game;
}

/** Stage Shipment and perform the entrant's real reserve shipment. */
export function enterMoritaniSkillsTerror(
  state: Game,
  entrant: string,
  territory = 'carthag',
  sector = 11,
  amount = 1,
): Game {
  const game = structuredClone(state);
  Object.assign(game, {
    phase: 5,
    storm: 18,
    active: entrant,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    movementRemaining: [...game.order],
  });
  const player = moritaniSkillsPlayer(game, entrant);
  player.shipped = false;
  player.moved = 0;
  return applyAction(game, entrant, {
    type: 'ship',
    territory,
    sector,
    amount,
  });
}
