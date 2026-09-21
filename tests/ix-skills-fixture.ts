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

export const IX_SKILLS_SEATS = {
  tleilaxu: 't',
  ixians: 'i',
  emperor: 'e',
} as const;

export type IxSkillsFaction = keyof typeof IX_SKILLS_SEATS;
export type IxSkillsFixtureOptions = {
  requestedSkill?: LeaderSkillId;
  skillOwner?: IxSkillsFaction;
};

const names: Record<IxSkillsFaction, string> = {
  tleilaxu: 'Tleilaxu',
  ixians: 'Ixians',
  emperor: 'Emperor',
};

export const reloadIxSkillsGame = (game: Game): Game =>
  JSON.parse(JSON.stringify(game)) as Game;

export function ixSkillsPlayer(game: Game, id: string): Player {
  const player = game.players.find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

export function rejectIxSkillsAction(
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
export function assertIxSkillsCustody(game: Game): void {
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
    ...(game.ixSetupCards ?? []),
    ...(game.ixAuction?.cards ?? []),
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

  const ixians = ixSkillsPlayer(game, 'i');
  assert.equal(ixians.elites!.reserves + ixians.elites!.tanks + Object.values(ixians.elites!.forces).reduce((a, b) => a + b, 0), 7);
  for (const [key, count] of Object.entries(ixians.elites!.forces))
    assert.ok(count <= (ixians.forces[key] ?? 0));

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
export function initializedIxSkillsOffers(
  options: IxSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'planetologist';
  const skillOwner = options.skillOwner ?? 'ixians';
  const factions = (
    [skillOwner, 'ixians', 'tleilaxu', 'emperor'] as IxSkillsFaction[]
  ).filter((faction, index, all) => all.indexOf(faction) === index);
  const first = factions[0];
  let game = createGame(
    'IXSKILLS',
    newPlayer(IX_SKILLS_SEATS[first], names[first], first),
    false,
    ['ix'],
  );
  for (const faction of factions.slice(1))
    joinGame(game, newPlayer(IX_SKILLS_SEATS[faction], names[faction], faction));
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
  assert.equal(game.setupStage, 'skillTreachery');
  assert.equal(game.decision?.kind, 'ixSetup');
  assert.equal(game.ixSetupCards!.length, game.players.length);
  assert.ok(game.players.every(player => player.hand.length === 0 && player.traitorChoices.length === 0));
  assertIxSkillsCustody(game);
  game = applyAction(reloadIxSkillsGame(game), 'i', {type: 'decision', card: game.ixSetupCards![0].id});
  assert.equal(game.setupStage, 'leaderSkills');
  assert.equal(game.ixSetupCards, null);
  assert.equal(game.leaderSkills!.offers[IX_SKILLS_SEATS[skillOwner]].cards[0], requestedSkill);
  assertIxSkillsCustody(game);
  return game;
}

/** Complete skills, Traitors, three Face Dancers and the first Storm HMS placement. */
export function completedIxSkillsGame(
  options: IxSkillsFixtureOptions = {},
): Game {
  const requestedSkill = options.requestedSkill ?? 'planetologist';
  const requestedOwner = IX_SKILLS_SEATS[options.skillOwner ?? 'ixians'];
  let game = initializedIxSkillsOffers(options);
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
  assert.equal(ixSkillsPlayer(game, 't').faceDancers, undefined);
  for (const player of game.players) {
    if (player.faction === 'tleilaxu') continue;
    const choice = ixSkillsPlayer(game, player.id).traitorChoices[0];
    assert.ok(choice);
    game = applyAction(game, player.id, { type: 'traitor', leader: choice });
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.setupStage, undefined);
  assert.deepEqual(ixSkillsPlayer(game, 't').traitors, []);
  assert.equal(ixSkillsPlayer(game, 't').faceDancers!.length, 3);
  for (let step = 0; step < 20 && game.decision?.kind !== 'mobileStronghold'; step++) {
    if (game.phaseOpening) {
      const owner = game.players.find(player => !game.phaseOpening!.passed.includes(player.id));
      assert.ok(owner);
      game = applyAction(reloadIxSkillsGame(game), owner.id, {type: 'ready'});
    } else if (game.stormPending !== null) {
      const owner = game.players.find(player => !game.ready.includes(player.id));
      assert.ok(owner);
      game = applyAction(reloadIxSkillsGame(game), owner.id, {type: 'ready'});
    } else {
      const owner = game.stormDialers.find(id => game.stormDials[id] === undefined);
      assert.ok(owner);
      game = applyAction(reloadIxSkillsGame(game), owner, {type: 'stormDial', amount: 0});
    }
  }
  assert.equal(game.decision?.kind, 'mobileStronghold');
  game = applyAction(reloadIxSkillsGame(game), 'i', {type: 'decision', location: 'polar_sink:0'});
  assert.equal(game.mobileStronghold!.location, 'polar_sink:0');
  assert.equal(game.phase, 1);
  assertIxSkillsCustody(game);
  return game;
}
