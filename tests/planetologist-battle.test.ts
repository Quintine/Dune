import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import {
  PLANETOLOGIST_BASE_SPECIALS,
  canUsePlanetologistBattleSpecial,
  isPlanetologistBattleSpecialCard,
  type BattleLeaderSkill,
} from '../game/leader-skill-combat';
import {
  BattleResolutionQuoteError,
  quoteBattleResolution,
  type BattleResolutionInput,
  type ResolutionCombatant,
} from '../game/battle-resolution-quote';
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
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function special(effect = 'atomics') {
  const card = baseDeck().find((candidate) => candidate.effect === effect);
  assert.ok(card);
  return card;
}

const assignment = (
  leader: string,
  faceUp = false,
  captured = false,
): BattleLeaderSkill => ({
  skill: 'planetologist',
  leader,
  faceUp,
  captured,
});

void test('the alternate battle role is bound to the nine exact base green Specials', () => {
  const eligible = baseDeck().filter(isPlanetologistBattleSpecialCard);
  assert.deepEqual(
    eligible.map((card) => card.id),
    PLANETOLOGIST_BASE_SPECIALS.map((card) => card.id),
  );
  assert.deepEqual(
    eligible.map((card) => card.name),
    [
      'Family Atomics',
      'Weather Control',
      'Hajr',
      'Tleilaxu Ghola',
      'Harvester',
      'Karama',
      'Karama',
      'Truthtrance',
      'Truthtrance',
    ],
  );
  assert.equal(
    baseDeck()
      .filter((card) => card.kind === 'hero')
      .some(isPlanetologistBattleSpecialCard),
    false,
  );
  assert.equal(ixBattleCards().some(isPlanetologistBattleSpecialCard), false);
  assert.equal(
    isPlanetologistBattleSpecialCard({
      ...special(),
      id: 'forged-green-special',
    }),
    false,
  );
});

void test('only the actual concealed or captured assigned leader may use the physical substitute', () => {
  const card = special();
  assert.equal(
    canUsePlanetologistBattleSpecial({
      assignments: [assignment('leader')],
      selectedLeader: 'leader',
      card,
    }),
    true,
  );
  assert.equal(
    canUsePlanetologistBattleSpecial({
      assignments: [assignment('leader', false, true)],
      selectedLeader: 'leader',
      card,
    }),
    true,
  );
  for (const input of [
    {
      assignments: [assignment('leader')],
      selectedLeader: 'other',
      card,
    },
    {
      assignments: [assignment('leader', true)],
      selectedLeader: 'leader',
      card,
    },
    {
      assignments: [
        {
          ...assignment('leader'),
          skill: 'warmaster' as const,
        },
      ],
      selectedLeader: 'leader',
      card,
    },
  ])
    assert.equal(canUsePlanetologistBattleSpecial(input), false);
});

function battle(): BattleResolutionInput {
  const side = (
    id: string,
    faction: 'emperor' | 'guild',
  ): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0] };
    return {
      id,
      faction,
      spice: 10,
      hand: [],
      leader,
      plan: {
        dial: id === 'a' ? 1 : 0,
        support: 0,
        leader: leader.id,
        weapon: null,
        defense: null,
      },
      forces: {
        normal: 5,
        elite: 0,
        eliteStrength: 2,
        freeSupport: false,
      },
    };
  };
  return {
    advanced: false,
    turn: 2,
    territory: 'arrakeen',
    attacker: side('a', 'emperor'),
    defender: side('d', 'guild'),
    voters: [
      { id: 'a', beneficiary: 'a', called: false, traitors: [] },
      { id: 'd', beneficiary: 'd', called: false, traitors: [] },
    ],
    participants: [
      { id: 'a', faction: 'emperor' },
      { id: 'd', faction: 'guild' },
    ],
    physicalCards: baseDeck(),
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}

function playPlanetologist(input: BattleResolutionInput, card = special()) {
  input.attacker.hand = [card];
  input.attacker.plan.weapon = card.id;
  input.attacker.leaderSkills = [assignment(input.attacker.plan.leader!)];
  return card;
}

void test('a surviving skilled disc gains two without activating the Special and discards it after winning', () => {
  const input = battle();
  const card = playPlanetologist(input);
  const before = structuredClone(input);
  const quote = quoteBattleResolution(input);
  assert.deepEqual(quote.leaderSkillBonuses.attacker, {
    bonus: 2,
    applied: [{ skill: 'planetologist', amount: 2, mode: 'skilled' }],
  });
  assert.equal(quote.effects?.defenderDead, false);
  assert.equal(quote.winner, 'a');
  assert.deepEqual(quote.discarded, [{ player: 'a', card: card.id }]);
  assert.deepEqual(quote.winnerCards, []);
  assert.deepEqual(input, before);
});

void test('leader death suppresses the two-point band but never releases the revealed Special', () => {
  const input = battle();
  const card = playPlanetologist(input, special('weather'));
  const poison = baseDeck().find((candidate) => candidate.kind === 'poison')!;
  input.defender.hand = [poison];
  input.defender.plan.weapon = poison.id;
  const quote = quoteBattleResolution(input);
  assert.equal(quote.leaderDeaths.attacker, true);
  assert.equal(quote.leaderSkillBonuses.attacker.bonus, 0);
  assert.ok(
    quote.discarded.some(
      (entry) => entry.player === 'a' && entry.card === card.id,
    ),
  );
});

void test('the later discard instruction also binds a successful traitor caller', () => {
  const input = battle();
  const card = playPlanetologist(input, special('hajr'));
  input.voters = [
    {
      id: 'a',
      beneficiary: 'a',
      called: true,
      traitors: [input.defender.plan.leader!],
    },
    input.voters[1],
  ];
  const quote = quoteBattleResolution(input);
  assert.equal(quote.result, 'traitor');
  assert.equal(quote.winner, 'a');
  assert.deepEqual(quote.discarded, [{ player: 'a', card: card.id }]);
  assert.deepEqual(quote.winnerCards, []);
});

void test('Moritani cleanup cannot retain or reserve the mandatory Planetologist discard', () => {
  const input = battle();
  const card = playPlanetologist(input, special('truthtrance'));
  const worthless = baseDeck().find(
    (candidate) => candidate.kind === 'worthless',
  )!;
  const poison = baseDeck().find(
    (candidate) => candidate.kind === 'poison',
  )!;
  input.attacker.ally = 'm';
  input.attacker.hand = [card, worthless];
  input.attacker.plan.defense = worthless.id;
  input.defender.hand = [poison];
  input.defender.plan.weapon = poison.id;
  input.participants = [
    ...input.participants,
    { id: 'm', faction: 'moritani', ally: 'a' },
  ];
  const quote = quoteBattleResolution(input);
  assert.equal(quote.winner, 'd');
  assert.deepEqual(quote.retention?.played, [worthless.id]);
  assert.deepEqual(quote.retention?.eligible, [worthless.id]);
  assert.ok(
    quote.discarded.some(
      (entry) => entry.player === 'a' && entry.card === card.id,
    ),
  );
});

void test('quote validation rejects the Special in another role or with another leader without mutation', () => {
  for (const mutate of [
    (input: BattleResolutionInput, card: Card) => {
      input.attacker.plan.weapon = null;
      input.attacker.plan.defense = card.id;
    },
    (input: BattleResolutionInput) => {
      input.attacker.leaderSkills = [assignment('some-other-leader')];
    },
    (input: BattleResolutionInput) => {
      input.attacker.leaderSkills = [assignment(input.attacker.plan.leader!, true)];
    },
    (input: BattleResolutionInput, card: Card) => {
      input.attacker.hand = [{ ...card, name: 'Forged Special' }];
    },
    (input: BattleResolutionInput) => {
      input.attacker.leader!.dead = true;
    },
    (input: BattleResolutionInput) => {
      delete input.attacker.leader;
    },
  ]) {
    const input = battle();
    const card = playPlanetologist(input);
    mutate(input, card);
    const before = structuredClone(input);
    assert.throws(
      () => quoteBattleResolution(input),
      BattleResolutionQuoteError,
    );
    assert.deepEqual(input, before);
  }
});

function finishSetup(state: Game) {
  let game = state;
  for (let step = 0; game.status === 'setup' && step < 10; step += 1) {
    const owner = game.players.find((player) => player.traitorChoices.length);
    assert.ok(owner, `setup stalled at ${game.setupStage}`);
    game = applyAction(game, owner.id, {
      type: 'traitor',
      leader: owner.traitorChoices[0],
    });
  }
  assert.equal(game.status, 'playing');
  return game;
}

function engineBattle(hide: boolean) {
  let game = createGame('PLANETBATTLE', newPlayer('a', 'A', 'emperor'));
  joinGame(game, newPlayer('d', 'D', 'guild'));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  const targetIndex = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === 'planetologist',
  );
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
  const attackerOffer = game.leaderSkills!.offers.a;
  assert.equal(attackerOffer.cards[0], 'planetologist');
  game = applyAction(game, 'a', {
    type: 'leaderSkill',
    event: attackerOffer.event,
    skill: 'planetologist',
    leader: 'emperor-0',
  });
  const defenderOffer = game.leaderSkills!.offers.d;
  game = applyAction(game, 'd', {
    type: 'leaderSkill',
    event: defenderOffer.event,
    skill: defenderOffer.cards[0],
    leader: 'guild-0',
  });
  game = finishSetup(game);
  for (const player of game.players) {
    game.deck.push(...player.hand);
    player.hand = [];
    player.forces = { 'arrakeen:10': 5 };
    player.reserves = 15;
  }
  const index = game.deck.findIndex((card) => card.effect === 'atomics');
  assert.ok(index >= 0);
  const [card] = game.deck.splice(index, 1);
  game.players[0].hand.push(card);
  Object.assign(game, {
    phase: 6,
    storm: 18,
    order: ['a', 'd'],
    active: 'a',
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  game = applyAction(game, 'a', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'd',
  });
  while (game.decision?.kind === 'leaderSkillVisibility') {
    const decision = game.decision;
    game = applyAction(game, decision.player, {
      type: 'leaderSkillVisibility',
      event: decision.event,
      hide: decision.player === 'a' ? hide : false,
    });
  }
  while (game.battle?.preparation)
    game = applyAction(game, game.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  return { game, card };
}

function unchanged(game: Game, player: string, action: Action, error: RegExp) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, player, action), error);
  assert.deepEqual(game, before);
}

void test('the real engine accepts only a concealed Planetologist plan and preserves actual-Weapon Voice', () => {
  const publicSkill = engineBattle(false);
  unchanged(
    publicSkill.game,
    'a',
    {
      type: 'battlePlan',
      dial: 0,
      leader: 'emperor-0',
      weapon: publicSkill.card.id,
    },
    /behind the shield/,
  );

  const { game, card } = engineBattle(true);
  unchanged(
    game,
    'a',
    {
      type: 'battlePlan',
      dial: 0,
      leader: 'emperor-1',
      weapon: card.id,
    },
    /eligible Planetologist Special/,
  );
  const poisonIndex = game.deck.findIndex(
    (candidate) => candidate.kind === 'poison',
  );
  assert.ok(poisonIndex >= 0);
  const [poison] = game.deck.splice(poisonIndex, 1);
  game.players[0].hand.push(poison);
  game.battle!.voice = { target: 'a', kind: 'poison', must: true };
  unchanged(
    game,
    'a',
    {
      type: 'battlePlan',
      dial: 0,
      leader: 'emperor-0',
      weapon: card.id,
    },
    /comply with the Voice/,
  );
  delete game.battle!.voice;
  const planned = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    weapon: card.id,
  });
  assert.equal(planned.battle!.plans.a.weapon, card.id);
  assert.equal(planned.storm, game.storm, 'Family Atomics utility did not fire');
});

void test('all four bot profiles offer a legal physical Planetologist battle plan', () => {
  const { game, card } = engineBattle(true);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'a');
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const plans = botActions(view).filter(
      (action) =>
        action.type === 'battlePlan' &&
        action.leader === 'emperor-0' &&
        action.weapon === card.id,
    );
    assert.ok(plans.length, `${difficulty} omitted the physical Special`);
    assert.doesNotThrow(
      () => applyAction(game, 'a', plans[0]),
      `${difficulty} emitted an invalid Planetologist plan`,
    );
  }
});

void test('the real engine resolves and discards a winning Planetologist Special exactly once', () => {
  const { game: battleState, card } = engineBattle(true);
  let game = applyAction(battleState, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    weapon: card.id,
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
  });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  assert.equal(
    game.discard.filter((candidate) => candidate.id === card.id).length,
    1,
  );
  assert.equal(
    game.players[0].hand.some((candidate) => candidate.id === card.id),
    false,
  );
  assert.equal(game.pendingWinnerDiscards, null);
  assert.equal(game.lastBattleContext?.winnerDiscards?.completed, true);
});

void test('a skilled disc that dies between traitor votes cannot supply a stale Planetologist plan', () => {
  const { game: battleState, card } = engineBattle(true);
  let game = applyAction(battleState, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    weapon: card.id,
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
  });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  const skilled = game.players[0].leaders.find(
    (leader) => leader.id === 'emperor-0',
  )!;
  skilled.dead = true;
  skilled.deaths += 1;
  unchanged(
    game,
    'd',
    { type: 'traitorCall', call: false },
    /dead or missing leader/,
  );
});
