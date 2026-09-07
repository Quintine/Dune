import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

type VoiceKind = NonNullable<NonNullable<Game['battle']>['voice']>['kind'];

function fixture(advanced = false): Game {
  const g = createGame(
    'PLANLEGALREVIEW',
    newPlayer('p', 'Planner', 'emperor'),
    advanced,
  );
  g.players.push(newPlayer('o', 'Opponent', 'guild'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'o'],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: { 'arrakeen:10': 4 },
      reserves: 16,
      spice: 10,
      hand: [],
      traitors: [],
    });
  g.battle = {
    territory: 'arrakeen',
    attacker: 'p',
    defender: 'o',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  return g;
}
function card(kind: Card['kind']) {
  const c = [...baseDeck(), ...ixBattleCards()].find((c) => c.kind === kind);
  assert.ok(c, kind);
  return c;
}
function unavailable(g: Game) {
  g.players[0].leaders.forEach((l) => {
    l.usedAt = 'carthag';
  });
}
function projection(g: Game, difficulty: Difficulty) {
  const v = viewGame(g, 'p');
  v.players[0].bot = difficulty;
  return v;
}
function plans(g: Game, difficulty: Difficulty) {
  const v = projection(g, difficulty),
    before = structuredClone(v);
  const actions = botActions(v).filter((a) => a.type === 'battlePlan');
  assert.ok(
    actions.length > 0,
    `${difficulty}: a legal battle must remain finishable`,
  );
  assert.deepEqual(
    v,
    before,
    'Planning must not mutate the private projection.',
  );
  for (const action of actions) {
    assert.doesNotThrow(
      () => applyAction(g, 'p', action),
      `${difficulty}: ${JSON.stringify(action)}`,
    );
    assert.ok(
      !action.weapon || action.weapon !== action.defense,
      'One physical card cannot occupy both slots.',
    );
  }
  return actions;
}

void test('independent plan review: every profile uses available leaders and offers only empty slots when no leader can fight', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].hand = [card('projectile'), card('shield'), card('worthless')];
    assert.ok(plans(g, difficulty).every((a) => a.leader));
    unavailable(g);
    const empty = plans(g, difficulty);
    assert.ok(
      empty.every((a) => !a.leader && !a.weapon && !a.defense && !a.kwisatz),
    );
    g.players[0].leaders[0].usedAt = 'arrakeen';
    assert.ok(
      plans(g, difficulty).every(
        (a) => a.leader === g.players[0].leaders[0].id,
      ),
      'A disc used in this territory remains available.',
    );
  }
});

void test('independent plan review: a sole Cheap Hero is mandatory except when forbidden by Voice', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    unavailable(g);
    const hero = card('hero');
    g.players[0].hand = [hero, card('poison'), card('snooper')];
    assert.ok(plans(g, difficulty).every((a) => a.leader === hero.id));
    g.battle!.voice = { target: 'p', kind: 'hero', must: false };
    assert.ok(
      plans(g, difficulty).every((a) => !a.leader && !a.weapon && !a.defense),
    );
    g.players[0].leaders[0].usedAt = 'arrakeen';
    assert.ok(
      plans(g, difficulty).every(
        (a) => a.leader === g.players[0].leaders[0].id,
      ),
    );
    g.battle!.voice.must = true;
    assert.ok(plans(g, difficulty).every((a) => a.leader === hero.id));
  }
});

void test('independent plan review: Voice compulsion and prohibition use actual Weirding Way and Chemistry roles', () => {
  const configurations: {
    hand: Card[];
    kind: VoiceKind;
    must: boolean;
    required: (a: Action) => boolean;
    optional?: (a: Action) => boolean;
  }[] = [
    {
      hand: [card('weirdingWay'), card('poison'), card('shield')],
      kind: 'projectile',
      must: true,
      required: (a) => a.weapon === card('weirdingWay').id,
    },
    {
      hand: [card('weirdingWay'), card('poison')],
      kind: 'projectile',
      must: false,
      required: (a) => a.weapon !== card('weirdingWay').id,
      optional: (a) => a.defense === card('weirdingWay').id,
    },
    {
      hand: [card('weirdingWay'), card('poison')],
      kind: 'shield',
      must: true,
      required: () => true,
      optional: (a) => !a.defense,
    },
    {
      hand: [card('chemistry'), card('shield')],
      kind: 'snooper',
      must: true,
      required: (a) => a.defense === card('chemistry').id,
    },
    {
      hand: [card('chemistry'), card('shield')],
      kind: 'snooper',
      must: false,
      required: (a) => a.defense !== card('chemistry').id,
      optional: (a) => a.weapon === card('chemistry').id,
    },
    {
      hand: [card('chemistry'), card('shield')],
      kind: 'poison',
      must: true,
      required: () => true,
      optional: (a) => !a.weapon,
    },
    {
      hand: [card('shieldSnooper')],
      kind: 'snooper',
      must: true,
      required: (a) => a.defense === card('shieldSnooper').id,
    },
    {
      hand: [card('poisonBlade')],
      kind: 'projectile',
      must: true,
      required: (a) => a.weapon === card('poisonBlade').id,
    },
  ];
  for (const difficulty of DIFFICULTIES)
    for (const configuration of configurations) {
      const g = fixture();
      g.players[0].hand = configuration.hand;
      g.battle!.voice = {
        target: 'p',
        kind: configuration.kind,
        must: configuration.must,
      };
      const actions = plans(g, difficulty);
      assert.ok(
        actions.every(configuration.required),
        `${difficulty} ${configuration.kind} ${configuration.must}`,
      );
      if (configuration.optional)
        assert.ok(
          actions.some(configuration.optional),
          'Voice cannot force an alternate role or prohibit a different played role.',
        );
    }
});

void test('independent plan review: canonical Portable Snooper obeys ordinary Snooper Voice and an absent required type does not force cards', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      portable = richeseCards().find((c) => c.effect === 'portableSnooper')!;
    g.players[0].hand = [portable, card('projectile')];
    g.battle!.voice = { target: 'p', kind: 'snooper', must: true };
    assert.ok(plans(g, difficulty).every((a) => a.defense === portable.id));
    g.battle!.voice.must = false;
    assert.ok(plans(g, difficulty).every((a) => a.defense !== portable.id));
    g.battle!.voice = { target: 'p', kind: 'hero', must: true };
    assert.ok(plans(g, difficulty).some((a) => !a.weapon && !a.defense));
    g.battle!.voice = { target: 'o', kind: 'projectile', must: false };
    assert.ok(
      plans(g, difficulty).some((a) => a.weapon === card('projectile').id),
      'Voice targeting the opponent must not restrict this player.',
    );
  }
});

void test('independent plan review: captured and foreign ghola custody replace unavailable native discs without inventing ownership', () => {
  for (const difficulty of DIFFICULTIES)
    for (const custody of ['capturedBy', 'gholaBy'] as const) {
      const g = fixture(true);
      unavailable(g);
      g.players[0].leaders[0].usedAt = undefined;
      g.players[0].leaders[0].capturedBy = 'o';
      const foreign = g.players[1].leaders[0];
      foreign[custody] = 'p';
      if (custody === 'capturedBy')
        foreign.concealed = { captor: 'p', dead: false, deaths: 0 };
      const actions = plans(g, difficulty);
      assert.ok(actions.every((a) => a.leader === foreign.id));
      foreign.usedAt = 'carthag';
      assert.ok(plans(g, difficulty).every((a) => !a.leader));
    }
});

void test('independent plan review: committed Cheap Hero and leaderless Prescience states recompute KH from the final leader', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true);
    g.players[0].faction = 'atreides';
    g.players[0].leaders = leaders('atreides');
    g.players[0].battleLosses = 7;
    g.players[0].kwisatz = { dead: false };
    const hero = card('hero');
    g.players[0].hand = [hero, card('shield')];
    g.battle!.prescience = { player: 'o', field: 'leader', value: hero.id };
    assert.ok(plans(g, difficulty).every((a) => a.leader === hero.id));
    g.players[0].hand = [card('shield')];
    unavailable(g);
    g.battle!.prescience.value = null;
    assert.ok(
      plans(g, difficulty).every(
        (a) => !a.leader && !a.weapon && !a.defense && !a.kwisatz,
      ),
    );
  }
});

void test('independent plan review: uninspected opposing hand, balance and sealed plan cannot alter candidates', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].hand = [card('projectile'), card('shield'), card('worthless')];
    g.players[1].hand = [card('poison')];
    g.battle!.plans.o = {
      dial: 0,
      support: 0,
      leader: 'guild-0',
      weapon: null,
      defense: null,
    };
    const before = botActions(projection(g, difficulty));
    const changed = structuredClone(g);
    changed.players[1].spice = 99999;
    changed.players[1].hand = [card('snooper')];
    changed.battle!.plans.o = {
      dial: 4,
      support: 0,
      leader: 'guild-4',
      weapon: null,
      defense: card('snooper').id,
    };
    assert.deepEqual(botActions(projection(changed, difficulty)), before);
    plans(g, difficulty);
    plans(changed, difficulty);
  }
});
