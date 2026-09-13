import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';
import type { Card } from '../game/cards';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  LEADER_SKILL_CARDS,
  type LeaderSkillId,
} from '../game/leader-skill-cards';
import { newRevivalRules } from '../game/revival';

const DIRECT_SKILLS = [
  'warmaster',
  'master-of-assassins',
  'swordmaster-of-ginaz',
  'killer-medic',
  'prana-bindu-adept',
] as const;

function rejectUnchanged(g: Game, id: string, action: Action, message: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action), message);
  assert.deepEqual(g, before);
}

/** Put one requested physical skill first without bypassing the real setup deal. */
function initialized(target: LeaderSkillId = 'warmaster'): Game {
  let g = createGame('SKILLENG', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });

  const targetIndex = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === target,
  );
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = shuffleIndex-- === targetIndex ? 0 : 0xffffffff;
    return array;
  });
  try {
    g = initializeLeaderSkillsGameForAudit(g);
  } finally {
    mock.restoreAll();
  }
  assert.equal(g.leaderSkills!.offers.a.cards[0], target);
  return g;
}

function initializedVoiceGame(): Game {
  let g = createGame('SKILLVOICE', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });

  const targetIndex = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === 'warmaster',
  );
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = shuffleIndex-- === targetIndex ? 0 : 0xffffffff;
    return array;
  });
  try {
    g = initializeLeaderSkillsGameForAudit(g);
  } finally {
    mock.restoreAll();
  }
  g = applyAction(g, 'b', {
    type: 'predict',
    faction: 'atreides',
    turn: 3,
  });
  for (const id of ['a', 'b', 'e']) {
    const skills = viewGame(g, id).leaderSkills!;
    g = applyAction(g, id, {
      type: 'leaderSkill',
      event: skills.offer!.event,
      skill: skills.offer!.cards[0],
      leader: skills.eligibleLeaders[0].id,
    });
  }
  return finishSetup(g);
}

function assignSetup(state: Game, skill: LeaderSkillId): Game {
  let g = state;
  const atreides = g.leaderSkills!.offers.a;
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event: atreides.event,
    skill,
    leader: 'atreides-0',
  });
  const emperor = g.leaderSkills!.offers.e;
  g = applyAction(g, 'e', {
    type: 'leaderSkill',
    event: emperor.event,
    skill: emperor.cards[0],
    leader: 'emperor-0',
  });
  return g;
}

function finishSetup(state: Game): Game {
  let g = state;
  for (let step = 0; step < 8 && g.status === 'setup'; step += 1) {
    const owner = g.players.find((player) => player.traitorChoices.length > 0);
    assert.ok(owner, `setup stalled at ${g.setupStage}`);
    g = applyAction(g, owner.id, {
      type: 'traitor',
      leader: owner.traitorChoices[0],
    });
  }
  assert.equal(g.status, 'playing');
  return g;
}

function takeCard(g: Game, owner: string, predicate: (card: Card) => boolean) {
  const index = g.deck.findIndex(predicate);
  assert.ok(index >= 0, 'the requested physical battle card must exist');
  const [card] = g.deck.splice(index, 1);
  g.players.find((player) => player.id === owner)!.hand.push(card);
  return card;
}

function battleFor(
  skill: (typeof DIRECT_SKILLS)[number],
  hide: boolean,
  onlySkilledLeader = false,
) {
  const g = finishSetup(assignSetup(initialized(skill), skill));
  const attacker = g.players.find((player) => player.id === 'a')!;
  const defender = g.players.find((player) => player.id === 'e')!;
  attacker.forces = { 'arrakeen:10': 5 };
  attacker.reserves = 15;
  defender.forces = { 'arrakeen:10': 5 };
  defender.reserves = 15;
  Object.assign(g, {
    phase: 6,
    storm: 18,
    order: ['a', 'e'],
    active: 'a',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
  }
  if (onlySkilledLeader)
    for (const leader of attacker.leaders.filter(
      (leader) => leader.id !== 'atreides-0',
    )) {
      leader.dead = true;
      leader.deaths = 1;
    }
  const role =
    skill === 'warmaster'
      ? takeCard(g, 'a', (card) => card.kind === 'worthless')
      : skill === 'master-of-assassins'
        ? takeCard(g, 'a', (card) => card.kind === 'poison')
        : skill === 'swordmaster-of-ginaz'
          ? takeCard(g, 'a', (card) => card.kind === 'projectile')
          : skill === 'killer-medic'
            ? takeCard(g, 'a', (card) => card.kind === 'snooper')
            : takeCard(g, 'a', (card) => card.kind === 'shield');
  let next = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  while (next.decision?.kind === 'leaderSkillVisibility') {
    const decision = next.decision;
    next = applyAction(next, decision.player, {
      type: 'leaderSkillVisibility',
      event: decision.event,
      hide: decision.player === 'a' ? hide : false,
    });
  }
  while (next.battle?.preparation)
    next = applyAction(next, next.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  return { g: next, role };
}

function resolvePlans(state: Game, attackerLeader: string, role: Card): Game {
  const slot =
    role.kind === 'snooper' || role.kind === 'shield' ? 'defense' : 'weapon';
  let g = applyAction(state, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: attackerLeader,
    [slot]: role.id,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'e', { type: 'traitorCall', call: false });
}

function killedSkillBattle(): Game {
  const { g: battle, role } = battleFor('master-of-assassins', true);
  const poison = takeCard(
    battle,
    'e',
    (card) => card.kind === 'poison' && card.id !== role.id,
  );
  let g = applyAction(battle, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
    weapon: role.id,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 1,
    leader: 'emperor-1',
    weapon: poison.id,
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'e', { type: 'traitorCall', call: false });
}

void test('real setup deals private choices before traitors, then publishes only completed assignments across JSON views', () => {
  let g = initialized();
  assert.equal(g.setupStage, 'leaderSkills');
  assert.ok(g.players.every((player) => player.hand.length === 1));
  assert.ok(g.players.every((player) => player.traitorChoices.length === 0));
  const aView = viewGame(g, 'a');
  const eView = viewGame(g, 'e');
  assert.equal(aView.leaderSkills!.offer!.cards.length, 2);
  assert.equal(eView.leaderSkills!.offer!.cards.length, 2);
  assert.notDeepEqual(
    aView.leaderSkills!.offer!.cards,
    eView.leaderSkills!.offer!.cards,
  );
  assert.equal('deck' in aView, false);
  assert.equal('traitorReserve' in aView, false);

  const event = g.leaderSkills!.offers.a.event;
  rejectUnchanged(
    g,
    'e',
    {
      type: 'leaderSkill',
      event,
      skill: 'warmaster',
      leader: 'atreides-0',
    },
    /current setup step|current Leader Skill cards/,
  );
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event,
    skill: 'warmaster',
    leader: 'atreides-0',
  });
  for (const viewer of ['a', 'e']) {
    const view = viewGame(JSON.parse(JSON.stringify(g)), viewer);
    assert.deepEqual(view.leaderSkills!.assignments, [
      {
        owner: 'a',
        leader: 'atreides-0',
        skill: 'warmaster',
        controller: 'a',
        captured: false,
        faceUp: true,
      },
    ]);
    assert.equal(
      view.leaderSkills!.offer?.event ?? null,
      g.leaderSkills!.offers[viewer]?.event ?? null,
    );
  }
  g = assignSetup(initialized(), 'warmaster');
  assert.equal(g.setupStage, 'traitors');
});

void test('each connected physical card role grants +3 only after its skilled leader moves behind the shield', () => {
  for (const skill of DIRECT_SKILLS) {
    const { g, role } = battleFor(skill, true);
    assert.equal(
      viewGame(g, 'a').leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'a',
      )!.faceUp,
      false,
    );
    const resolved = resolvePlans(g, 'atreides-0', role);
    const defenderScore =
      skill === 'master-of-assassins' || skill === 'swordmaster-of-ginaz'
        ? 0
        : 5;
    assert.ok(
      resolved.log.some((entry) =>
        entry.text.includes(`Atreides won in Arrakeen (8–${defenderScore})`),
      ),
      `${skill} did not add three through the real engine battle`,
    );
    assert.ok(
      resolved.log.some(
        (entry) =>
          entry.automatic?.name === 'Leader Skill' &&
          entry.text.includes('gained 3 battle strength'),
      ),
    );
  }
});

void test('a face-up skilled leader is inadmissible while another leader and Cheap Hero receive the normal +1', () => {
  const { g, role } = battleFor('warmaster', false);
  rejectUnchanged(
    g,
    'a',
    {
      type: 'battlePlan',
      dial: 0,
      leader: 'atreides-0',
      weapon: role.id,
    },
    /behind the shield/,
  );
  const resolved = resolvePlans(g, 'atreides-1', role);
  assert.ok(
    resolved.log.some((entry) =>
      entry.text.includes('Atreides won in Arrakeen (6–5)'),
    ),
  );

  const heroBattle = battleFor('warmaster', false);
  const hero = takeCard(heroBattle.g, 'a', (card) => card.kind === 'hero');
  const heroResolved = resolvePlans(heroBattle.g, hero.id, heroBattle.role);
  assert.ok(
    heroResolved.log.some((entry) =>
      entry.text.includes('Emperor won in Arrakeen (1–5)'),
    ),
  );

  const mandatory = battleFor('warmaster', true, true);
  assert.equal(
    viewGame(mandatory.g, 'a').leaderSkills!.assignments.find(
      (assignment) => assignment.owner === 'a',
    )!.faceUp,
    false,
  );
  assert.doesNotThrow(() =>
    resolvePlans(mandatory.g, 'atreides-0', mandatory.role),
  );
});

void test('a Voice that forbids the last alternate Cheap Hero automatically conceals the only skilled leader without replaying powers', () => {
  let g = initializedVoiceGame();
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
    player.forces = {};
    player.reserves = 20;
  }
  const heroIndex = g.deck.findIndex((card) => card.kind === 'hero');
  assert.ok(heroIndex >= 0);
  const [hero] = g.deck.splice(heroIndex, 1);
  g.players.find((player) => player.id === 'a')!.hand.push(hero);
  const atreides = g.players.find((player) => player.id === 'a')!;
  atreides.forces = { 'arrakeen:10': 5 };
  atreides.reserves = 15;
  g.players.find((player) => player.id === 'b')!.forces = {
    'arrakeen:10': 5,
  };
  g.players.find((player) => player.id === 'b')!.reserves = 15;
  for (const leader of atreides.leaders.filter(
    (leader) => leader.id !== 'atreides-0',
  )) {
    leader.dead = true;
    leader.deaths = 1;
  }
  Object.assign(g, {
    phase: 6,
    storm: 18,
    order: ['a', 'b', 'e'],
    active: 'a',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'b',
  });
  while (g.decision?.kind === 'leaderSkillVisibility')
    g = applyAction(g, g.decision.player, {
      type: 'leaderSkillVisibility',
      event: g.decision.event,
      hide: false,
    });
  assert.equal(g.battle!.preparation?.kind, 'voice');
  g = applyAction(g, 'b', { type: 'voice', kind: 'hero', must: false });
  assert.equal(g.battle!.leaderSkillHidden?.a, true);
  assert.equal(
    g.log.filter(
      (entry) =>
        entry.automatic?.name === 'Leader Skill' &&
        entry.text.includes('behind the shield'),
    ).length,
    1,
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
  });
  assert.equal(g.battle!.plans.a.leader, 'atreides-0');
  assert.equal(g.battle!.voice?.kind, 'hero');
});

void test('a killed skilled leader loses its card before scoring and a real revival privately offers a new draw', () => {
  let g = killedSkillBattle();
  assert.ok(
    g.log.some((entry) => entry.text.includes('Emperor won in Arrakeen (0–1)')),
  );
  assert.equal(
    g.leaderSkills!.assignments.some((assignment) => assignment.owner === 'a'),
    false,
  );
  assert.ok(g.leaderSkills!.deck.includes('master-of-assassins'));

  const atreides = g.players.find((player) => player.id === 'a')!;
  for (const leader of atreides.leaders) {
    leader.dead = true;
    leader.deaths = Math.max(1, leader.deaths);
  }
  atreides.spice = 20;
  atreides.leaderRevived = false;
  g.phase = 4;
  g.revivalRules = newRevivalRules();
  g.decision = null;
  g.response = null;
  g = applyAction(g, 'a', {
    type: 'reviveLeader',
    leader: 'atreides-0',
  });
  assert.equal(g.decision?.kind, 'leaderSkillRevival');
  assert.deepEqual(viewGame(g, 'a').leaderSkills!.offer!.cards, []);
  assert.equal(viewGame(g, 'e').leaderSkills!.offer, null);

  const event = g.decision!.event;
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event,
    mode: 'draw',
  });
  const privateOffer = viewGame(JSON.parse(JSON.stringify(g)), 'a')
    .leaderSkills!.offer!;
  assert.equal(privateOffer.cards.length, 2);
  assert.equal(viewGame(g, 'e').leaderSkills!.offer, null);
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event,
    skill: privateOffer.cards[0],
    leader: 'atreides-0',
  });
  assert.equal(g.leaderSkills!.offers.a, undefined);
  assert.equal(
    g.leaderSkills!.assignments.find((assignment) => assignment.owner === 'a')
      ?.leader,
    'atreides-0',
  );
  assert.doesNotThrow(() => viewGame(JSON.parse(JSON.stringify(g)), 'e'));
});

void test('Ghola revival during an unfinished battle preserves its power stage through the private draw and new visibility choice', () => {
  let g = killedSkillBattle();
  const atreides = g.players.find((player) => player.id === 'a')!;
  const emperor = g.players.find((player) => player.id === 'e')!;
  atreides.forces['carthag:11'] = 1;
  atreides.reserves -= 1;
  emperor.forces['carthag:11'] = 1;
  emperor.reserves -= 1;
  const ghola = takeCard(g, 'a', (card) => card.effect === 'ghola');
  Object.assign(g, {
    phase: 6,
    storm: 18,
    order: ['a', 'e'],
    active: 'a',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'carthag',
    target: 'e',
  });
  while (g.decision?.kind === 'leaderSkillVisibility')
    g = applyAction(g, g.decision.player, {
      type: 'leaderSkillVisibility',
      event: g.decision.event,
      hide: false,
    });
  assert.ok(g.battle!.preparation);
  const preparation = structuredClone(g.battle!.preparation);

  g = applyAction(g, 'a', {
    type: 'card',
    card: ghola.id,
    leader: 'atreides-0',
  });
  assert.equal(g.decision?.kind, 'leaderSkillRevival');
  assert.deepEqual(g.battle!.preparation, preparation);
  const event = g.decision!.event;
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event,
    mode: 'draw',
  });
  const offer = viewGame(g, 'a').leaderSkills!.offer!;
  g = applyAction(g, 'a', {
    type: 'leaderSkill',
    event,
    skill: offer.cards[0],
    leader: 'atreides-0',
  });
  assert.equal(g.decision?.kind, 'leaderSkillVisibility');
  assert.equal(g.decision!.resumePowers, false);
  assert.deepEqual(g.battle!.preparation, preparation);
  g = applyAction(g, 'a', {
    type: 'leaderSkillVisibility',
    event: g.decision!.event,
    hide: true,
  });
  assert.equal(g.decision, null);
  assert.deepEqual(g.battle!.preparation, preparation);
  g = applyAction(g, preparation!.owner, { type: 'declineBattlePower' });
  assert.notDeepEqual(g.battle?.preparation, preparation);
  assert.equal(g.discard.filter((card) => card.id === ghola.id).length, 1);
});
