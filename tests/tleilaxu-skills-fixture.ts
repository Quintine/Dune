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
import { treacheryDeck } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { traitorDeck } from '../game/traitors';

export const TLEILAXU_SKILLS_SEATS = {
  tleilaxu: 't',
  atreides: 'a',
  emperor: 'e',
} as const;

export type TleilaxuSkillsFaction = keyof typeof TLEILAXU_SKILLS_SEATS;
export type TleilaxuSkillsFixtureOptions = {
  requestedSkill?: LeaderSkillId;
  skillOwner?: TleilaxuSkillsFaction;
};

const names: Record<TleilaxuSkillsFaction, string> = {
  tleilaxu: 'Tleilaxu',
  atreides: 'Atreides',
  emperor: 'Emperor',
};

export const reloadTleilaxuSkillsGame = (game: Game): Game =>
  JSON.parse(JSON.stringify(game)) as Game;

export function tleilaxuSkillsPlayer(game: Game, id: string): Player {
  const player = game.players.find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

export function rejectTleilaxuSkillsAction(
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

/** Count physical pieces only; projected/history copies do not create custody. */
export function assertTleilaxuSkillsCustody(game: Game): void {
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

  const treachery = [
    ...game.deck,
    ...game.discard,
    ...game.players.flatMap((player) => player.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
  ].map((card) => card.id);
  assert.deepEqual(treachery.sort(), treacheryDeck(['ix']).map((card) => card.id).sort());
  for (const player of game.players)
    assert.equal(
      player.reserves + player.tanks + Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
      `${player.name} must retain every physical force`,
    );

  if (game.status === 'playing' || game.status === 'finished') {
    const traitors = [
      ...game.traitorReserve!,
      ...game.players.flatMap((player) => player.traitors),
      ...game.players.flatMap((player) => (player.faceDancers ?? []).map((card) => card.leader)),
    ];
    assert.deepEqual(traitors.sort(), traitorDeck(game.players, true).sort());
    assert.equal(new Set(traitors).size, traitors.length);
  }
}

/** Real ready lobby and setup deal; only the production shuffle is controlled. */
export function initializedTleilaxuSkillsOffers(
  options: TleilaxuSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'warmaster';
  const skillOwner = options.skillOwner ?? 'tleilaxu';
  const factions = (
    [skillOwner, 'tleilaxu', 'atreides', 'emperor'] as TleilaxuSkillsFaction[]
  ).filter((faction, index, all) => all.indexOf(faction) === index);
  const first = factions[0];
  let game = createGame(
    'TLEISKIL',
    newPlayer(TLEILAXU_SKILLS_SEATS[first], names[first], first),
    false,
    ['ix'],
  );
  for (const faction of factions.slice(1))
    joinGame(game, newPlayer(TLEILAXU_SKILLS_SEATS[faction], names[faction], faction));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });

  const targetIndex = LEADER_SKILL_CARDS.findIndex((card) => card.id === requestedSkill);
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
  assert.equal(game.status, 'setup');
  assert.equal(game.setupStage, 'leaderSkills');
  assert.equal(game.leaderSkills!.offers[TLEILAXU_SKILLS_SEATS[skillOwner]].cards[0], requestedSkill);
  assertTleilaxuSkillsCustody(game);
  return game;
}

/** Complete skill assignment, ordinary Traitor selection and three Face Dancers. */
export function completedTleilaxuSkillsGame(
  options: TleilaxuSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'warmaster';
  const requestedOwner = TLEILAXU_SKILLS_SEATS[options.skillOwner ?? 'tleilaxu'];
  let game = initializedTleilaxuSkillsOffers(options);
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
  assert.equal(tleilaxuSkillsPlayer(game, 't').faceDancers, undefined);
  for (const player of game.players) {
    if (player.faction === 'tleilaxu') continue;
    const choice = tleilaxuSkillsPlayer(game, player.id).traitorChoices[0];
    assert.ok(choice);
    game = applyAction(game, player.id, { type: 'traitor', leader: choice });
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.setupStage, undefined);
  assert.deepEqual(tleilaxuSkillsPlayer(game, 't').traitors, []);
  assert.equal(tleilaxuSkillsPlayer(game, 't').faceDancers!.length, 3);
  assertTleilaxuSkillsCustody(game);
  return game;
}
