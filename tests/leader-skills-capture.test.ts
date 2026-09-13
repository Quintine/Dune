import assert from 'node:assert/strict';
import { mock } from 'node:test';
import test from 'node:test';
import { baseDeck, type Card } from '../game/cards';
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
import { placeFixtureHand } from './fixture-hand';

const SEATS = [
  ['e', 'Emperor seat', 'emperor'],
  ['h', 'Harkonnen seat', 'harkonnen'],
  ['a', 'Atreides seat', 'atreides'],
  ['b', 'Bene Gesserit seat', 'beneGesserit'],
  ['f', 'Fremen seat', 'fremen'],
  ['g', 'Guild seat', 'guild'],
] as const;

function assertSkillCustody(g: Game) {
  assert.ok(g.leaderSkills);
  const physical = [
    ...g.leaderSkills.deck,
    ...g.leaderSkills.assignments.map((assignment) => assignment.skill),
    ...Object.values(g.leaderSkills.offers).flatMap((offer) => offer.cards),
  ];
  assert.equal(physical.length, 14);
  assert.equal(new Set(physical).size, 14);
  assert.deepEqual(
    [...physical].sort(),
    LEADER_SKILL_CARDS.map((card) => card.id).sort(),
  );
}

/** Put Warmaster in the Emperor's genuine two-card offer. */
function beginSetup(): Game {
  let g = createGame(
    'SKILLCAP',
    newPlayer(SEATS[0][0], SEATS[0][1], SEATS[0][2]),
  );
  for (const [id, name, faction] of SEATS.slice(1))
    joinGame(g, newPlayer(id, name, faction));
  for (const [id] of SEATS) g = applyAction(g, id, { type: 'ready' });

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

  assert.equal(g.setupStage, 'prediction');
  g = applyAction(g, 'b', {
    type: 'predict',
    faction: 'atreides',
    turn: 4,
  });
  assert.equal(g.setupStage, 'leaderSkills');
  assert.ok(g.leaderSkills?.offers.e.cards.includes('warmaster'));
  assertSkillCustody(g);
  return g;
}

function finishSetup(
  state: Game,
  emperorSkillLeader: 'emperor-1' | 'emperor-2',
): Game {
  let g = state;
  for (const [id] of SEATS) {
    const view = viewGame(g, id);
    const offer = view.leaderSkills!.offer!;
    g = applyAction(g, id, {
      type: 'leaderSkill',
      event: offer.event,
      skill: id === 'e' ? 'warmaster' : offer.cards[0],
      leader:
        id === 'e'
          ? emperorSkillLeader
          : view.leaderSkills!.eligibleLeaders[0].id,
    });
  }
  assert.equal(g.setupStage, 'traitors');
  while (g.setupStage === 'traitors') {
    const owner = g.players.find((player) => player.traitorChoices.length);
    assert.ok(owner);
    g = applyAction(g, owner.id, {
      type: 'traitor',
      leader: owner.traitorChoices[0],
    });
  }
  assert.equal(g.setupStage, 'forces');
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  assert.equal(g.status, 'playing');
  assertSkillCustody(g);
  return g;
}

function takeCard(kind: Card['kind'], excluded: readonly string[] = []): Card {
  const card = baseDeck().find(
    (candidate) => candidate.kind === kind && !excluded.includes(candidate.id),
  );
  assert.ok(card, `expected a physical ${kind} card`);
  return card;
}

function passResponses(state: Game): Game {
  let g = state;
  while (g.response) {
    const owner = g.players.find(
      (player) => !g.response!.passed.includes(player.id),
    );
    assert.ok(owner);
    g = applyAction(g, owner.id, { type: 'passResponse' });
  }
  return g;
}

function clearBattlePreparation(state: Game): Game {
  let g = state;
  while (
    g.decision?.kind === 'leaderSkillVisibility' ||
    g.decision?.kind === 'fullPlanOffer' ||
    g.battle?.preparation
  )
    if (g.decision?.kind === 'leaderSkillVisibility')
      g = applyAction(g, g.decision.player, {
        type: 'leaderSkillVisibility',
        event: g.decision.event,
        hide: false,
      });
    else if (g.decision?.kind === 'fullPlanOffer')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else
      g = applyAction(g, g.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  return g;
}

function resolveBattle(state: Game): Game {
  let g = applyAction(state, 'h', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  while (
    g.decision?.kind === 'battleLosses' ||
    g.decision?.kind === 'battleCards'
  )
    g = applyAction(
      g,
      g.decision.player,
      g.decision.kind === 'battleLosses'
        ? { type: 'decision', choice: 0 }
        : { type: 'decision', discard: [] },
    );
  return g;
}

function captureOffer(
  emperorSkillLeader: 'emperor-1' | 'emperor-2' = 'emperor-1',
): Game {
  let g = finishSetup(beginSetup(), emperorSkillLeader);
  const emperor = g.players.find((player) => player.id === 'e')!;
  const harkonnen = g.players.find((player) => player.id === 'h')!;
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
    player.traitors = [];
  }
  Object.assign(g, {
    advanced: true,
    phase: 6,
    active: 'h',
    order: ['h', 'e', 'a', 'b', 'f', 'g'],
    ready: [],
    storm: 18,
    decision: null,
    response: null,
    phaseOpening: null,
  });
  harkonnen.forces = { 'red_chasm:7': 10 };
  harkonnen.reserves = 10;
  emperor.forces = { 'red_chasm:7': 10 };
  emperor.reserves = 10;
  for (const leader of emperor.leaders.slice(2)) {
    leader.dead = true;
    leader.deaths = 1;
  }
  if (emperorSkillLeader === 'emperor-2') {
    emperor.leaders[2].dead = false;
    emperor.leaders[2].deaths = 0;
    emperor.leaders[2].usedAt = 'arrakeen';
  }
  const poison = takeCard('poison');
  placeFixtureHand(g, 1, [poison]);

  g = applyAction(g, 'h', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = clearBattlePreparation(g);
  assert.equal(g.decision, null, JSON.stringify(g.decision));
  g = applyAction(g, 'h', {
    type: 'battlePlan',
    dial: 0,
    leader: 'harkonnen-1',
    weapon: poison.id,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  g = resolveBattle(g);
  assert.equal(g.decision?.kind, 'captureOffer');
  return g;
}

function acceptCapture(state: Game): Game {
  let g = applyAction(state, 'h', { type: 'decision', accept: true });
  g = passResponses(g);
  assert.equal(g.decision?.kind, 'capturedLeader');
  return g;
}

void test('the genuine audit setup offers eligible leaders to all six base factions including Harkonnen', () => {
  const g = beginSetup();
  assert.deepEqual(
    new Set(g.players.map((player) => player.faction)),
    new Set(SEATS.map(([, , faction]) => faction)),
  );
  for (const [id, , faction] of SEATS) {
    const view = viewGame(g, id);
    assert.equal(view.leaderSkills?.offer?.cards.length, 2, faction);
    assert.equal(view.leaderSkills?.eligibleLeaders.length, 5, faction);
    assert.ok(
      view.leaderSkills!.eligibleLeaders.every((leader) =>
        leader.id.startsWith(`${faction}-`),
      ),
      faction,
    );
  }
  assert.doesNotThrow(() => finishSetup(g, 'emperor-1'));
});

void test('a captured skilled leader and attached card become public while replacement revival remains rejected atomically', () => {
  const g = acceptCapture(captureOffer());
  for (const [viewer] of SEATS) {
    const view = viewGame(g, viewer);
    assert.deepEqual(
      view.leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'e',
      ),
      {
        owner: 'e',
        leader: 'emperor-1',
        skill: 'warmaster',
        controller: 'h',
        captured: true,
        faceUp: false,
      },
    );
    assert.equal(
      view.players
        .find((player) => player.id === 'e')!
        .leaders.find((leader) => leader.id === 'emperor-1')!.capturedBy,
      'h',
    );
    assert.equal(
      view.decision?.kind === 'capturedLeader' && view.decision.leader,
      'emperor-1',
    );
  }
  assert.ok(
    g.log.some(
      (entry) =>
        entry.text.includes('Captain Aramsham') &&
        entry.text.includes('Warmaster'),
    ),
  );

  const kept = applyAction(g, 'h', { type: 'decision', mode: 'keep' });
  kept.phase = 4;
  kept.decision = null;
  kept.response = null;
  const emperor = kept.players.find((player) => player.id === 'e')!;
  emperor.spice = 20;
  emperor.leaderRevived = false;
  const before = structuredClone(kept);
  assert.throws(
    () =>
      applyAction(kept, 'e', {
        type: 'reviveLeader',
        leader: 'emperor-0',
      }),
    /replacement-skill ruling/,
  );
  assert.deepEqual(kept, before);
  assertSkillCustody(kept);
});

void test('the captor gets only the lower battle bonus and a surviving captive returns with the same skill', () => {
  let g = applyAction(acceptCapture(captureOffer()), 'h', {
    type: 'decision',
    mode: 'keep',
  });
  const emperor = g.players.find((player) => player.id === 'e')!;
  const harkonnen = g.players.find((player) => player.id === 'h')!;
  emperor.leaders[2].dead = false;
  emperor.leaders[2].deaths = 0;
  delete emperor.leaders[2].usedAt;
  Object.assign(g, {
    phase: 6,
    active: 'h',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  harkonnen.forces = { 'red_chasm:7': 10 };
  harkonnen.reserves = 10;
  emperor.forces = { 'red_chasm:7': 10 };
  emperor.reserves = 10;
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
    player.traitors = [];
  }
  const firstWorthless = takeCard('worthless');
  const secondWorthless = takeCard('worthless', [firstWorthless.id]);
  placeFixtureHand(g, 1, [firstWorthless]);
  placeFixtureHand(g, 0, [secondWorthless]);

  g = applyAction(g, 'h', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = clearBattlePreparation(g);
  g = applyAction(g, 'h', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
    weapon: firstWorthless.id,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-2',
    weapon: secondWorthless.id,
  });
  g = resolveBattle(g);

  assert.ok(
    g.log.some((entry) =>
      entry.text.includes('Harkonnen won in Red Chasm (8–3)'),
    ),
  );
  const skillLogs = g.log.filter(
    (entry) => entry.automatic?.name === 'Leader Skill',
  );
  assert.ok(
    skillLogs.some(
      (entry) =>
        entry.text.includes('Warmaster') &&
        entry.text.includes('gained 3 battle strength'),
    ),
  );
  assert.ok(
    skillLogs.every(
      (entry) =>
        !entry.text.includes('Warmaster') ||
        !entry.text.includes('gained 1 battle strength'),
    ),
  );
  assert.equal(
    g.players
      .find((player) => player.id === 'e')!
      .leaders.find((leader) => leader.id === 'emperor-1')!.capturedBy,
    undefined,
  );
  for (const [viewer] of SEATS)
    assert.deepEqual(
      viewGame(g, viewer).leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'e',
      ),
      {
        owner: 'e',
        leader: 'emperor-1',
        skill: 'warmaster',
        controller: 'e',
        captured: false,
        faceUp: true,
      },
    );
  assertSkillCustody(g);
});

void test('executing the known skilled captive returns exactly that card and keeps the inferred identity public', () => {
  let g = acceptCapture(captureOffer());
  g = applyAction(g, 'h', { type: 'decision', mode: 'execute' });
  assert.equal(
    g.leaderSkills!.assignments.some(
      (assignment) => assignment.leader === 'emperor-1',
    ),
    false,
  );
  assert.equal(
    g.leaderSkills!.deck.filter((skill) => skill === 'warmaster').length,
    1,
  );
  for (const [viewer] of SEATS) {
    const leader = viewGame(g, viewer)
      .players.find((player) => player.id === 'e')!
      .leaders.find((candidate) => candidate.id === 'emperor-1')!;
    assert.equal(leader.dead, true);
    assert.equal(leader.deaths, 2);
  }
  assert.ok(
    g.log.some(
      (entry) =>
        entry.automatic?.name === 'Leader Skill lost' &&
        entry.text.includes('Warmaster'),
    ),
  );
  assertSkillCustody(g);
});

void test('capturing an unskilled leader preserves the existing private identity boundary', () => {
  const offered = captureOffer('emperor-2');
  const outsiderBefore = viewGame(offered, 'g').players.find(
    (player) => player.id === 'e',
  )!.leaders;
  const g = acceptCapture(offered);
  assert.equal(g.players[0].leaders[1].capturedBy, 'h');
  assert.deepEqual(
    viewGame(g, 'g').players.find((player) => player.id === 'e')!.leaders,
    outsiderBefore,
  );
  const outsiderDecision = viewGame(g, 'g').decision;
  const captorDecision = viewGame(g, 'h').decision;
  assert.equal(
    outsiderDecision?.kind === 'capturedLeader' && outsiderDecision.leader,
    '',
  );
  assert.equal(
    captorDecision?.kind === 'capturedLeader' && captorDecision.leader,
    'emperor-1',
  );
  assert.deepEqual(
    viewGame(g, 'g').leaderSkills!.assignments.find(
      (assignment) => assignment.owner === 'e',
    ),
    {
      owner: 'e',
      leader: 'emperor-2',
      skill: 'warmaster',
      controller: 'e',
      captured: false,
      faceUp: true,
    },
  );
  assert.ok(g.log.every((entry) => !entry.text.includes('Captain Aramsham')));
  assertSkillCustody(g);
});
