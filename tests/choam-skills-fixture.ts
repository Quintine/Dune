import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { treacheryDeck } from '../game/cards';
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
import { traitorDeck } from '../game/traitors';

export const CHOAM_SKILLS_SEATS = {
  choam: 'c',
  atreides: 'a',
  emperor: 'e',
} as const;

export type ChoamSkillsFaction = keyof typeof CHOAM_SKILLS_SEATS;
export type ChoamSkillsFixtureOptions = {
  requestedSkill?: LeaderSkillId;
  skillOwner?: ChoamSkillsFaction;
  seats?: Readonly<Record<ChoamSkillsFaction, string>>;
  code?: string;
};

const names: Record<ChoamSkillsFaction, string> = {
  choam: 'CHOAM',
  atreides: 'Atreides',
  emperor: 'Emperor',
};

export const reloadChoamSkillsGame = (game: Game): Game =>
  JSON.parse(JSON.stringify(game)) as Game;

export function choamSkillsPlayer(game: Game, id: string): Player {
  const player = game.players.find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

export function rejectChoamSkillsAction(
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

/** Count only physical inventories; projections and history are not custody. */
export function assertChoamSkillsCustody(game: Game): void {
  const skills = game.leaderSkills!;
  const physicalSkills = [
    ...skills.deck,
    ...Object.values(skills.offers).flatMap((offer) => offer.cards),
    ...skills.assignments.map((assignment) => assignment.skill),
  ];
  const canonicalSkills = LEADER_SKILL_CARDS.map((card) => card.id);
  assert.equal(physicalSkills.length, 14);
  assert.equal(new Set(physicalSkills).size, 14);
  assert.deepEqual([...physicalSkills].sort(), [...canonicalSkills].sort());

  const physicalTreachery = [
    ...game.deck,
    ...game.discard,
    ...game.players.flatMap((player) => player.hand),
    ...(game.auction?.cards.slice(
      game.auction.index + (game.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ].map((card) => card.id);
  const canonicalTreachery = treacheryDeck(['choam']).map((card) => card.id);
  assert.equal(physicalTreachery.length, 35);
  assert.equal(new Set(physicalTreachery).size, 35);
  assert.deepEqual(physicalTreachery.sort(), canonicalTreachery.sort());

  for (const player of game.players) {
    const forces =
      player.reserves +
      player.tanks +
      Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    assert.equal(
      forces,
      20,
      `${player.name} must retain all twenty physical forces`,
    );
  }

  if (game.status === 'playing' || game.status === 'finished') {
    const physicalTraitors = [
      ...game.traitorReserve!,
      ...game.players.flatMap((player) => player.traitors),
    ];
    const canonicalTraitors = traitorDeck(game.players, game.advanced);
    assert.equal(physicalTraitors.length, canonicalTraitors.length);
    assert.equal(new Set(physicalTraitors).size, physicalTraitors.length);
    assert.deepEqual(physicalTraitors.sort(), canonicalTraitors.sort());
  }
}

/** Real ready lobby and setup deal; only the production skill shuffle is controlled. */
export function initializedChoamSkillsOffers(
  options: ChoamSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'planetologist';
  const skillOwner = options.skillOwner ?? 'choam';
  const seats = options.seats ?? CHOAM_SKILLS_SEATS;
  const factions = (
    [skillOwner, 'choam', 'atreides', 'emperor'] as ChoamSkillsFaction[]
  ).filter((faction, index, all) => all.indexOf(faction) === index);
  const first = factions[0];
  let game = createGame(
    options.code ?? 'CHOSKILL',
    newPlayer(seats[first], names[first], first),
    false,
    ['choam'],
  );
  for (const faction of factions.slice(1))
    joinGame(game, newPlayer(seats[faction], names[faction], faction));
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
  assert.equal(game.status, 'setup');
  assert.equal(game.setupStage, 'leaderSkills');
  assert.equal(
    game.leaderSkills!.offers[seats[skillOwner]].cards[0],
    requestedSkill,
  );
  assertChoamSkillsCustody(game);
  return game;
}

/** Complete genuine skill assignment and ordinary Traitor selection. */
export function completedChoamSkillsGame(
  options: ChoamSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'planetologist';
  const seats = options.seats ?? CHOAM_SKILLS_SEATS;
  const requestedOwner = seats[options.skillOwner ?? 'choam'];
  let game = initializedChoamSkillsOffers(options);
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
    const choice = choamSkillsPlayer(game, player.id).traitorChoices[0];
    assert.ok(choice);
    game = applyAction(game, player.id, { type: 'traitor', leader: choice });
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.setupStage, undefined);
  assertChoamSkillsCustody(game);
  return game;
}
