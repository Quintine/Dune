import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type GameView,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { cashInCards } from '../game/choam-karama';
import {
  createNexusInspection,
  allowNexusInspection,
  answerNexusInspection,
  reopenNexusInspection,
} from '../game/battle-inspections';

/** These are consumer tests of authoritative projected fields, not evidence
 * of Nexus acquisition or effect execution. The underlying ordinary battle
 * supplies real public map/leader/card shapes and conserved physical cards. */
function fixture(): GameView {
  let g = createGame('NEXUSBOTS', newPlayer('e', 'Emperor', 'emperor'));
  g.players.push(
    newPlayer('q', 'Guild', 'guild'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'e',
    order: ['e', 'q', 'h'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, { forces: {}, reserves: 20, spice: 20, hand: [] });
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  for (const kind of ['projectile', 'shield', 'poison', 'snooper'] as const) {
    const index = g.deck.findIndex((c) => c.kind === kind);
    g.players[0].hand.push(g.deck.splice(index, 1)[0]);
  }
  g = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  const v = viewGame(g, 'e');
  v.battle!.ownCommitments = [];
  v.battle!.nexusInsights = [];
  v.battle!.nexusInspection = null;
  v.nexusAtreides = null;
  return v;
}
const own = (v: GameView) => v.players.find((p) => p.id === v.me)!;

void test('all four profiles preserve simultaneous native and Nexus commitments including zero and null', () => {
  for (const difficulty of DIFFICULTIES)
    for (const fields of ['cards', 'dial', 'leader'] as const) {
      const v = fixture(),
        me = own(v),
        b = v.battle!;
      me.bot = difficulty;
      const weapon = me.hand!.find((c) => c.kind === 'projectile')!.id;
      b.ownCommitments =
        fields === 'cards'
          ? [
              {
                source: 'native',
                beneficiary: 'q',
                target: 'e',
                field: 'weapon',
                value: weapon,
              },
              {
                source: 'nexus',
                beneficiary: 'q',
                target: 'e',
                field: 'defense',
                value: null,
              },
            ]
          : fields === 'dial'
            ? [
                {
                  source: 'native',
                  beneficiary: 'q',
                  target: 'e',
                  field: 'weapon',
                  value: weapon,
                },
                {
                  source: 'nexus',
                  beneficiary: 'q',
                  target: 'e',
                  field: 'dial',
                  value: 0,
                },
              ]
            : [
                {
                  source: 'native',
                  beneficiary: 'q',
                  target: 'e',
                  field: 'leader',
                  value: me.leaders[1].id,
                },
                {
                  source: 'nexus',
                  beneficiary: 'q',
                  target: 'e',
                  field: 'dial',
                  value: 2,
                },
              ];
      const before = structuredClone(v),
        actions = botActions(v);
      assert.ok(actions.length);
      for (const action of actions) {
        assert.equal(action.type, 'battlePlan');
        for (const element of b.ownCommitments)
          assert.equal(action[element.field], element.value);
      }
      assert.deepEqual(v, before);
    }
});

void test('pending Nexus answers bind the battle event and preserve the earlier native weapon', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = fixture(),
      me = own(v),
      b = v.battle!;
    me.bot = difficulty;
    const weapon = me.hand!.find((c) => c.kind === 'projectile')!.id;
    b.ownCommitments = [
      {
        source: 'native',
        beneficiary: 'q',
        target: 'e',
        field: 'weapon',
        value: weapon,
      },
    ];
    b.preparation = {
      kind: 'nexusPrescienceAnswer',
      owner: 'e',
      beneficiary: 'q',
    };
    b.nexusInspection = {
      event: b.event!,
      mode: 'cunning',
      owner: 'q',
      target: 'e',
      field: 'defense',
      stage: 'answer',
    };
    const actions = botActions(v);
    assert.ok(actions.length);
    for (const action of actions) {
      assert.equal(action.type, 'nexusPrescienceAnswer');
      assert.equal(action.event, b.event);
      assert.ok(
        action.value === null ||
          me.hand!.some(
            (c) =>
              c.id === action.value && ['shield', 'snooper'].includes(c.kind),
          ),
      );
    }
    b.nexusInspection.stage = 'response';
    assert.deepEqual(botActions(v), []);
    b.nexusInspection.stage = 'answer';
    b.nexusInspection.event = 'old-battle';
    assert.deepEqual(botActions(v), []);
  }
});

void test('all profiles choose only an offered distinct Nexus field and respect public interruption fences', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = fixture();
    own(v).bot = difficulty;
    v.nexusCards = {
      card: 'atreides',
      deckCount: 11,
      discardCount: 0,
      held: { e: true, q: false, h: false },
      turn: 2,
      choices: [],
      waiting: [],
    };
    v.nexusAtreides = {
      event: v.battle!.event!,
      mode: 'cunning',
      fields: ['defense', 'leader', 'dial'],
      blocked: null,
    };
    assert.deepEqual(botActions(v), [
      {
        type: 'nexusAtreides',
        event: v.battle!.event,
        mode: 'cunning',
        field: 'defense',
      },
    ]);
    v.nexusAtreides.mode = 'secretAlly';
    v.nexusAtreides.fields = ['weapon', 'dial'];
    assert.equal(
      botActions(v)[0].field,
      ['Easy', 'Medium'].includes(difficulty) ? 'dial' : 'weapon',
    );
    for (const edit of [
      (x: GameView) => {
        x.nexusAtreides!.blocked = 'Awaiting timing ruling';
      },
      (x: GameView) => {
        x.nexusAtreides!.event = 'old-battle';
      },
      (x: GameView) => {
        x.nexusCards!.card = 'ecaz';
      },
      (x: GameView) => {
        x.automaticContinuationPending = true;
      },
      (x: GameView) => {
        x.phaseOpening = { passed: [] };
      },
      (x: GameView) => {
        x.response = { kind: 'voice', owner: 'q', passed: [] };
      },
    ]) {
      const blocked = structuredClone(v);
      edit(blocked);
      assert.ok(botActions(blocked).every((a) => a.type !== 'nexusAtreides'));
    }
    v.nexusCards.waiting = ['q'];
    assert.deepEqual(botActions(v), []);
  }
});

void test('private enemy fields are never consulted and retired Nexus observations are not current predictions', () => {
  const v = fixture();
  own(v).bot = 'Hard';
  const base = botActions(v);
  v.battle!.nexusInspection = {
    event: v.battle!.event!,
    mode: 'secretAlly',
    owner: 'e',
    target: 'q',
    field: 'weapon',
    stage: 'answer',
  };
  v.battle!.nexusInsights = [
    {
      field: 'weapon',
      value: 'treachery-3',
      label: 'Historical only',
      active: false,
    },
  ];
  for (const p of v.players.filter((p) => p.id !== v.me))
    for (const field of ['hand', 'spice', 'traitors'])
      Object.defineProperty(p, field, {
        get() {
          throw Error(`Read private ${field}`);
        },
        configurable: true,
      });
  assert.deepEqual(botActions(v), base);
});

void test('CHOAM cash-in reserves both answered sources but releases a retired Nexus binding without losing its history', () => {
  const state = createGame('NEXUSCASH', newPlayer('a', 'Atreides', 'atreides'));
  state.players.push(newPlayer('c', 'CHOAM', 'choam'));
  const cards = baseDeck()
      .filter((c) => c.kind === 'worthless')
      .slice(0, 3),
    p = state.players[1];
  p.hand = cards;
  const native = { player: 'a', field: 'weapon' as const, value: cards[0].id };
  const context = {
    event: 'battle-cash',
    attacker: 'a',
    defender: 'c',
    players: state.players,
    native,
  };
  const inspection = answerNexusInspection(
    context,
    allowNexusInspection(
      context,
      createNexusInspection(context, {
        mode: 'cunning',
        owner: 'a',
        target: 'c',
        field: 'defense',
      }),
    ),
    cards[1].id,
  );
  state.battle = {
    event: context.event,
    territory: 'arrakeen',
    attacker: 'a',
    defender: 'c',
    plans: {},
    revealed: false,
    traitorCalls: {},
    prescience: native,
    nexusInspection: inspection,
  };
  assert.deepEqual(
    cashInCards(state, p).map((c) => c.id),
    [cards[2].id],
  );
  state.battle.nexusInspection = reopenNexusInspection(context, inspection);
  assert.deepEqual(
    cashInCards(state, p).map((c) => c.id),
    [cards[1].id, cards[2].id],
  );
  assert.deepEqual(state.battle.nexusInspection.answers, [cards[1].id]);
});
