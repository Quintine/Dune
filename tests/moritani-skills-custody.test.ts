import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { newRevivalRules } from '../game/revival';
import {
  assertMoritaniSkillsCustody,
  completedMoritaniSkillsGame,
  enterMoritaniSkillsTerror,
  initializedMoritaniSkillsOffers,
  moritaniSkillsPlayer,
  placeMoritaniSkillsTerror,
  rejectMoritaniSkillsAction,
  reloadMoritaniSkillsGame,
} from './moritani-skills-fixture';

const forceTotal = (game: Game, id: string) => {
  const player = moritaniSkillsPlayer(game, id);
  return (
    player.reserves +
    player.tanks +
    Object.values(player.forces).reduce((sum, count) => sum + count, 0)
  );
};

void test('genuine Basic Moritani setup keeps all fourteen skill cards and each two-card offer private', () => {
  const game = initializedMoritaniSkillsOffers({
    requestedSkill: 'warmaster',
    skillOwner: 'moritani',
  });
  assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.deepEqual(
    new Set(game.players.map((player) => player.faction)),
    new Set(['moritani', 'atreides', 'emperor']),
  );
  assert.equal(game.leaderSkills!.deck.length, 8);
  assert.equal(Object.keys(game.leaderSkills!.offers).length, 3);
  assert.equal(game.leaderSkills!.assignments.length, 0);
  assertMoritaniSkillsCustody(game);

  for (const viewer of game.players) {
    const view = viewGame(reloadMoritaniSkillsGame(game), viewer.id);
    assert.deepEqual(
      view.leaderSkills!.offer,
      game.leaderSkills!.offers[viewer.id],
    );
    assert.equal(view.leaderSkills!.offer!.cards.length, 2);
    assert.equal('deck' in view.leaderSkills!, false);
    assert.equal('offers' in view.leaderSkills!, false);
  }
});

void test('Terror Assassination returns exactly the killed leader skill once and real revival offers one private optional replacement after JSON restore', () => {
  let game = completedMoritaniSkillsGame({
    requestedSkill: 'warmaster',
    skillOwner: 'emperor',
  });
  const assignment = game.leaderSkills!.assignments.find(
    (candidate) => candidate.owner === 'e',
  )!;
  assert.deepEqual(assignment, {
    owner: 'e',
    leader: 'emperor-0',
    skill: 'warmaster',
  });
  const emperor = moritaniSkillsPlayer(game, 'e');
  for (const leader of emperor.leaders)
    if (leader.id !== assignment.leader) {
      leader.dead = true;
      leader.deaths = 1;
    }

  const forceTotals = Object.fromEntries(
    game.players.map((player) => [player.id, forceTotal(game, player.id)]),
  );
  game = placeMoritaniSkillsTerror(game, 'assassination');
  assert.deepEqual(
    Object.fromEntries(
      game.players.map((player) => [player.id, forceTotal(game, player.id)]),
    ),
    forceTotals,
  );
  const beforeEntry = reloadMoritaniSkillsGame(game);
  game = enterMoritaniSkillsTerror(game, 'e');
  assert.equal(moritaniSkillsPlayer(game, 'e').reserves,
    moritaniSkillsPlayer(beforeEntry, 'e').reserves - 1);
  assert.equal(moritaniSkillsPlayer(game, 'e').forces['carthag:11'], 1);
  assert.equal(forceTotal(game, 'e'), forceTotals.e);
  assert.equal(viewGame(game, 'm').terrorEntry!.kind, 'assassination');
  assert.equal('kind' in viewGame(game, 'e').terrorEntry!, false);
  assert.equal(game.leaderSkills!.deck.includes('warmaster'), false);

  const killed = applyAction(game, 'm', {
    type: 'decision',
    reveal: true,
  });
  const killedLeader = moritaniSkillsPlayer(killed, 'e').leaders.find(
    (leader) => leader.id === assignment.leader,
  )!;
  assert.equal(killedLeader.dead, true);
  assert.equal(killedLeader.deaths, 1);
  assert.equal(
    killed.leaderSkills!.assignments.some(
      (candidate) => candidate.owner === 'e',
    ),
    false,
  );
  assert.equal(
    killed.leaderSkills!.deck.filter((skill) => skill === 'warmaster').length,
    1,
  );
  assertMoritaniSkillsCustody(killed);
  rejectMoritaniSkillsAction(killed, 'm', {
    type: 'decision',
    reveal: true,
  });

  const restored = reloadMoritaniSkillsGame(killed);
  Object.assign(restored, {
    phase: 4,
    active: null,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    revivalRules: newRevivalRules(),
  });
  const restoredEmperor = moritaniSkillsPlayer(restored, 'e');
  restoredEmperor.spice = 20;
  restoredEmperor.leaderRevived = false;
  const offered = applyAction(restored, 'e', {
    type: 'reviveLeader',
    leader: assignment.leader,
  });
  assert.equal(offered.decision?.kind, 'leaderSkillRevival');
  assert.equal(
    moritaniSkillsPlayer(offered, 'e').leaders.find(
      (leader) => leader.id === assignment.leader,
    )!.dead,
    false,
  );
  assert.deepEqual(viewGame(offered, 'e').leaderSkills!.offer!.cards, []);
  assert.equal(viewGame(offered, 'm').leaderSkills!.offer, null);
  assert.equal(viewGame(offered, 'a').leaderSkills!.offer, null);
  assertMoritaniSkillsCustody(offered);

  const event = offered.leaderSkills!.offers.e.event;
  rejectMoritaniSkillsAction(
    offered,
    'm',
    { type: 'leaderSkill', event, mode: 'draw' },
    /not waiting for you/,
  );
  rejectMoritaniSkillsAction(
    offered,
    'e',
    { type: 'leaderSkill', event: `${event}:stale`, mode: 'draw' },
    /not waiting for you/,
  );

  const declined = applyAction(reloadMoritaniSkillsGame(offered), 'e', {
    type: 'leaderSkill',
    event,
    mode: 'decline',
  });
  assert.equal(declined.decision, null);
  assert.equal(declined.leaderSkills!.offers.e, undefined);
  assert.equal(
    declined.leaderSkills!.assignments.some(
      (candidate) => candidate.owner === 'e',
    ),
    false,
  );
  assertMoritaniSkillsCustody(declined);

  const drawn = applyAction(reloadMoritaniSkillsGame(offered), 'e', {
    type: 'leaderSkill',
    event,
    mode: 'draw',
  });
  const privateOffer = viewGame(reloadMoritaniSkillsGame(drawn), 'e')
    .leaderSkills!.offer!;
  assert.equal(privateOffer.cards.length, 2);
  assert.equal(viewGame(drawn, 'm').leaderSkills!.offer, null);
  assert.equal(viewGame(drawn, 'a').leaderSkills!.offer, null);
  assertMoritaniSkillsCustody(drawn);

  const choice = {
    type: 'leaderSkill',
    event,
    skill: privateOffer.cards[0],
    leader: assignment.leader,
  } as const;
  const selected = applyAction(drawn, 'e', choice);
  assert.deepEqual(
    selected.leaderSkills!.assignments.find(
      (candidate) => candidate.owner === 'e',
    ),
    {
      owner: 'e',
      leader: assignment.leader,
      skill: privateOffer.cards[0],
    },
  );
  assert.equal(selected.leaderSkills!.offers.e, undefined);
  assertMoritaniSkillsCustody(selected);
  rejectMoritaniSkillsAction(
    selected,
    'e',
    choice,
    /not waiting for you/,
  );
});

void test('Sabotage discards only Treachery cards while skill custody and shared projections stay unchanged', () => {
  let game = completedMoritaniSkillsGame({
    requestedSkill: 'warmaster',
    skillOwner: 'emperor',
  });
  game = placeMoritaniSkillsTerror(game, 'sabotage');
  const beforeEntry = reloadMoritaniSkillsGame(game);
  const entrantCard = moritaniSkillsPlayer(beforeEntry, 'e').hand[0];
  assert.ok(entrantCard);
  game = enterMoritaniSkillsTerror(game, 'e');
  const revealed = applyAction(game, 'm', {
    type: 'decision',
    reveal: true,
  });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'gift');
  assert.equal(
    moritaniSkillsPlayer(revealed, 'e').hand.some(
      (card) => card.id === entrantCard.id,
    ),
    false,
  );
  assert.equal(
    revealed.discard.filter((card) => card.id === entrantCard.id).length,
    1,
  );
  assert.deepEqual(revealed.leaderSkills, beforeEntry.leaderSkills);
  assertMoritaniSkillsCustody(revealed);

  const projections = revealed.players.map(
    (player) => viewGame(reloadMoritaniSkillsGame(revealed), player.id).leaderSkills!,
  );
  for (const projection of projections) {
    assert.deepEqual(projection.assignments, projections[0].assignments);
    assert.equal(projection.offer, null);
    assert.equal('deck' in projection, false);
  }
  const opponentView = viewGame(revealed, 'a');
  assert.equal('discard' in opponentView, false);
  assert.equal(JSON.stringify(opponentView).includes(entrantCard.id), false);

  const done = applyAction(reloadMoritaniSkillsGame(revealed), 'm', {
    type: 'decision',
    decline: true,
  });
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  assert.deepEqual(done.leaderSkills, beforeEntry.leaderSkills);
  assertMoritaniSkillsCustody(done);
  rejectMoritaniSkillsAction(done, 'm', {
    type: 'decision',
    decline: true,
  });
});
