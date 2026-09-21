import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES, location, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isPlanetologistBattleSpecialCard } from '../game/leader-skill-combat';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import {
  basicChoamLeaderSkillsProfile,
  ordinaryLeaderSkillModeSupported,
} from '../game/leader-skill-profile';
import { bureaucratPaymentModeSupported } from '../game/bureaucrat-payment';
import { planetologistMovementModeSupported } from '../game/planetologist-movement';
import { sandmasterModeSupported } from '../game/sandmaster-movement';
import { smugglerBattleModeSupported } from '../game/smuggler-battle';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { planetologistMoveDraft } from '../components/planetologist-movement';
import { sandmasterMoveDraft } from '../components/sandmaster-movement';
import {
  assertChoamSkillsCustody,
  choamSkillsPlayer as player,
  completedChoamSkillsGame,
  initializedChoamSkillsOffers,
  reloadChoamSkillsGame as reload,
  rejectChoamSkillsAction as reject,
} from './choam-skills-fixture';

function movementPosition(game: Game): Game {
  for (const participant of game.players) {
    participant.forces = {};
    participant.reserves = 20;
    participant.tanks = 0;
    participant.spice = 20;
    participant.moved = 0;
    participant.shipped = true;
  }
  Object.assign(game, {
    phase: 5,
    active: 'c',
    order: ['c', 'a', 'e'],
    storm: 18,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  return game;
}

function passResponses(state: Game): Game {
  let game = state;
  while (game.response) {
    const passer = game.players.find((candidate) => {
      const controls = viewGame(game, candidate.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(passer);
    game = applyAction(game, passer.id, { type: 'passResponse' });
  }
  return game;
}

function holdByName(game: Game, owner: string, name: string) {
  const index = game.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0, name);
  const [card] = game.deck.splice(index, 1);
  player(game, owner).hand.push(card);
  return card;
}

void test('all fourteen production skill faces deal through genuine Basic CHOAM setup', () => {
  for (const skill of LEADER_SKILL_CARDS) {
    const game = completedChoamSkillsGame({ requestedSkill: skill.id });
    assert.equal(
      game.leaderSkills!.assignments.find(
        (assignment) => assignment.owner === 'c',
      )!.skill,
      skill.id,
    );
    assert.equal(
      player(game, 'c').leaders.some((leader) => leader.id === 'choam-auditor'),
      false,
    );
    assert.equal(basicChoamLeaderSkillsProfile(game), true);
    for (const participant of game.players) {
      const view = viewGame(game, participant.id);
      assert.equal(view.leaderSkills!.offer, null);
      assert.equal(view.leaderSkills!.assignments.length, 3);
      assert.deepEqual(viewGame(reload(game), participant.id), view);
    }
    assertChoamSkillsCustody(game);
  }
});

void test('all bot profiles make a legal private skill choice and exact CHOAM profile gates are shared', () => {
  const offer = initializedChoamSkillsOffers({
    requestedSkill: 'planetologist',
  });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(offer), 'c');
    view.players.find((candidate) => candidate.id === 'c')!.bot = difficulty;
    const action = botActions(view).find(
      (candidate) => candidate.type === 'leaderSkill',
    );
    assert.ok(action, difficulty);
    assert.doesNotThrow(() => applyAction(offer, 'c', action));
  }

  const game = completedChoamSkillsGame();
  for (const gate of [
    basicChoamLeaderSkillsProfile,
    ordinaryLeaderSkillModeSupported,
    bureaucratPaymentModeSupported,
    planetologistMovementModeSupported,
    sandmasterModeSupported,
    smugglerBattleModeSupported,
  ]) {
    assert.equal(gate(game), true, gate.name);
    assert.equal(gate(viewGame(game, 'a')), true, `${gate.name} projected`);
  }
});

void test('Advanced CHOAM and Basic Richese retain audit admission without entering the exact normal profile', () => {
  for (const variant of ['advanced', 'richese'] as const) {
    let game = createGame(
      variant === 'advanced' ? 'CHOADVAN' : 'CHORICHE',
      newPlayer('c', 'CHOAM', 'choam'),
      variant === 'advanced',
      ['choam'],
    );
    joinGame(
      game,
      variant === 'richese'
        ? newPlayer('r', 'Richese', 'richese')
        : newPlayer('a', 'Atreides', 'atreides'),
    );
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    for (const participant of game.players)
      game = applyAction(game, participant.id, { type: 'ready' });
    game = initializeLeaderSkillsGameForAudit(game);
    assert.equal(game.setupStage, 'leaderSkills');
    assert.equal(basicChoamLeaderSkillsProfile(game), false);
    if (variant === 'advanced')
      assert.equal(
        player(game, 'c').leaders.some(
          (leader) => leader.id === 'choam-auditor',
        ),
        true,
      );
  }
});

void test('CHOAM Planetologist and Sandmaster controls and bots submit legal shared movement actions', () => {
  let game = movementPosition(
    completedChoamSkillsGame({ requestedSkill: 'planetologist' }),
  );
  const from = 'red_chasm:7';
  player(game, 'c').forces = { [from]: 3 };
  player(game, 'c').reserves = 17;
  const target = TERRITORIES.filter((territory) => territory.type === 'sand')
    .flatMap((territory) =>
      territory.sectors.map((sector) => location(territory.id, sector)),
    )
    .map(splitLocation)
    .find((at) => {
      const draft = planetologistMoveDraft(
        viewGame(game, 'c'),
        'range',
        at.territory,
        at.sector,
        { [from]: 3 },
        {},
      );
      return draft.action && at.territory !== 'red_chasm';
    });
  assert.ok(target);
  const draft = planetologistMoveDraft(
    viewGame(game, 'c'),
    'range',
    target.territory,
    target.sector,
    { [from]: 3 },
    {},
  );
  assert.equal(draft.blocked, null);
  assert.ok(draft.action);
  game.spice[location(target.territory, target.sector)] = 8;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'c');
    view.players.find((candidate) => candidate.id === 'c')!.bot = difficulty;
    const action = botActions(view).find(
      (candidate) =>
        candidate.type === 'move' && candidate.planetologist === 'range',
    );
    assert.ok(action, difficulty);
    assert.doesNotThrow(() => applyAction(game, 'c', action));
  }
  const moved = applyAction(reload(game), 'c', draft.action);
  assert.equal(
    player(moved, 'c').forces[location(target.territory, target.sector)],
    3,
  );

  game = movementPosition(
    completedChoamSkillsGame({ requestedSkill: 'sandmaster' }),
  );
  const sandFrom = 'wind_pass_north:17';
  player(game, 'c').forces = { [sandFrom]: 3 };
  player(game, 'c').reserves = 17;
  for (const territory of TERRITORIES)
    for (const sector of territory.sectors)
      game.spice[location(territory.id, sector)] = 2;
  const candidates = TERRITORIES.flatMap((territory) =>
    territory.sectors.map((sector) => ({ territory: territory.id, sector })),
  );
  const control = candidates
    .map((to) =>
      sandmasterMoveDraft(viewGame(game, 'c'), {
        type: 'move',
        territory: to.territory,
        sector: to.sector,
        forces: { [sandFrom]: 3 },
      }),
    )
    .find((candidate) => candidate.action && candidate.collectible.length > 0);
  assert.ok(control?.action);
  assert.doesNotThrow(() => applyAction(reload(game), 'c', control.action!));
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'c');
    view.players.find((candidate) => candidate.id === 'c')!.bot = difficulty;
    const action = botActions(view).find(
      (candidate) => candidate.type === 'move' && candidate.sandmaster,
    );
    assert.ok(action, difficulty);
    assert.doesNotThrow(() => applyAction(game, 'c', action));
  }
});

void test('CHOAM Smuggler ships its physical companion and Bureaucrat distinguishes qualifying payments', () => {
  let game = movementPosition(
    completedChoamSkillsGame({ requestedSkill: 'smuggler' }),
  );
  player(game, 'c').shipped = false;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'c');
    view.players.find((candidate) => candidate.id === 'c')!.bot = difficulty;
    const action = botActions(view).find(
      (candidate) => candidate.type === 'ship' && candidate.smuggler === true,
    );
    assert.ok(action, difficulty);
    assert.doesNotThrow(() => applyAction(game, 'c', action));
  }
  const ship: Action = {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 3,
    smuggler: true,
  };
  game = applyAction(game, 'c', ship);
  assert.equal(player(game, 'c').forces['carthag:11'], 3);
  assert.equal(player(game, 'c').reserves, 17);
  assert.equal(player(game, 'c').spice, 18);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  assertChoamSkillsCustody(game);

  game = movementPosition(
    completedChoamSkillsGame({ requestedSkill: 'bureaucrat' }),
  );
  const own = applyAction(game, 'c', { type: 'bribe', target: 'e', amount: 5 });
  assert.notEqual(own.decision?.kind, 'bureaucratPayment');
  const small = applyAction(game, 'a', {
    type: 'bribe',
    target: 'e',
    amount: 4,
  });
  assert.notEqual(small.decision?.kind, 'bureaucratPayment');
  const bank = reload(game);
  bank.active = 'a';
  player(bank, 'a').shipped = false;
  const smallBankPayment = applyAction(bank, 'a', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 1,
  });
  assert.notEqual(smallBankPayment.decision?.kind, 'bureaucratPayment');
  game = applyAction(game, 'a', { type: 'bribe', target: 'e', amount: 5 });
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(game.decision.player, 'c');
  const event = game.bureaucratPaymentEvent;
  const done = applyAction(reload(game), 'c', {
    type: 'decision',
    event,
    redirect: true,
  });
  assert.equal(player(done, 'a').spice, 15);
  assert.equal(player(done, 'e').bribes, 3);
  assert.equal(done.bureaucratPayments!.used.length, 1);
  reject(done, 'c', { type: 'decision', event, redirect: true });
  assertChoamSkillsCustody(done);
});

void test('native Worthless power executes through its response and preserves physical custody', () => {
  let game = movementPosition(
    completedChoamSkillsGame({ requestedSkill: 'warmaster' }),
  );
  player(game, 'c').shipped = false;
  const kulon = holdByName(game, 'c', 'Kulon');
  holdByName(game, 'e', 'Karama');
  game = applyAction(game, 'c', {
    type: 'card',
    mode: 'choam',
    card: kulon.id,
  });
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(
    player(game, 'c').hand.some((card) => card.id === kulon.id),
    true,
  );
  game = passResponses(game);
  assert.equal(game.choamMovement?.bonus, 1);
  assert.equal(game.discard.filter((card) => card.id === kulon.id).length, 1);
  assertChoamSkillsCustody(game);
});

void test('native Worthless market sale pays from the bank and preserves the 35-card skill game', () => {
  let game = completedChoamSkillsGame({ requestedSkill: 'warmaster' });
  const worthless = holdByName(game, 'c', 'Baliset');
  holdByName(game, 'e', 'Karama');
  const spiceBefore = player(game, 'c').spice;
  Object.assign(game, {
    phase: 2,
    active: null,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    choamCharity: { turn: game.turn, canceled: false },
  });
  for (const participant of game.players)
    game = applyAction(game, participant.id, { type: 'ready' });
  assert.equal(game.decision?.kind, 'choamMarket');
  game = applyAction(game, 'c', {
    type: 'decision',
    mode: 'sell',
    card: worthless.id,
  });
  assert.equal(game.response?.kind, 'choamSale');
  assert.equal(
    player(game, 'c').hand.some((card) => card.id === worthless.id),
    true,
  );
  game = passResponses(game);
  assert.equal(player(game, 'c').spice, spiceBefore + 2);
  assert.equal(
    game.discard.filter((card) => card.id === worthless.id).length,
    1,
  );
  assert.equal(game.bureaucratPayments?.pending, undefined);
  assertChoamSkillsCustody(game);
});

void test('a real concealed Planetologist green Special is discarded once after battle', () => {
  let game = completedChoamSkillsGame({ requestedSkill: 'planetologist' });
  const assignment = game.leaderSkills!.assignments.find(
    (candidate) => candidate.owner === 'c',
  )!;
  for (const participant of game.players) {
    game.deck.push(...participant.hand);
    participant.hand = [];
    participant.forces = { 'arrakeen:10': 5 };
    participant.reserves = 15;
  }
  for (const name of ['Poison Tooth', 'Artillery Strike']) {
    const ordinary = game.deck.find((card) => card.name === name);
    assert.ok(ordinary);
    assert.equal(isPlanetologistBattleSpecialCard(ordinary), false);
  }
  const specialIndex = game.deck.findIndex(isPlanetologistBattleSpecialCard);
  assert.ok(specialIndex >= 0);
  const [special] = game.deck.splice(specialIndex, 1);
  player(game, 'c').hand.push(special);
  assert.equal(
    ['Poison Tooth', 'Artillery Strike'].includes(special.name),
    false,
  );
  Object.assign(game, {
    phase: 6,
    storm: 18,
    order: ['c', 'a', 'e'],
    active: 'c',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  game = applyAction(game, 'c', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  while (game.decision?.kind === 'leaderSkillVisibility') {
    const decision = game.decision;
    game = applyAction(game, decision.player, {
      type: 'leaderSkillVisibility',
      event: decision.event,
      hide: decision.player === 'c',
    });
  }
  while (game.battle?.preparation)
    game = applyAction(game, game.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  game = applyAction(game, 'c', {
    type: 'battlePlan',
    dial: 4,
    leader: assignment.leader,
    weapon: special.id,
  });
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: player(game, 'a').leaders.find(
      (leader) =>
        leader.id !==
        game.leaderSkills!.assignments.find(
          (candidate) => candidate.owner === 'a',
        )!.leader,
    )!.id,
  });
  game = applyAction(game, 'c', { type: 'traitorCall', call: false });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  assert.equal(game.discard.filter((card) => card.id === special.id).length, 1);
  assert.equal(
    player(game, 'c').hand.some((card) => card.id === special.id),
    false,
  );
  assert.equal(game.pendingWinnerDiscards, null);
  assertChoamSkillsCustody(game);
});
