import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import {
  createAmbassadors,
  placeAmbassador,
  copiedAmbassadorEffects,
} from '../game/ecaz-ambassadors';
import { createDukeVidal, acquireDuke } from '../game/duke-vidal';

function fixture(advanced = false, allied = false) {
  const g = createGame(
    'ECAZDUKEBOTS',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    advanced,
  );
  g.players.push(
    newPlayer('in', 'Entrant', 'atreides'),
    newPlayer('al', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'al'],
    movementRemaining: ['in', 'ec', 'al'],
    deck: baseDeck(),
    dukeVidal: createDukeVidal(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  if (allied) {
    g.players[0].ally = 'al';
    g.players[2].ally = 'ec';
  }
  // Construct the existing placed-component checkpoint; the entry and every bot
  // resolution below use actual public actions, never a manually built offer.
  const inventory = createAmbassadors(() => 0);
  const token = inventory.tokens.find((t) => t.effect === 'ecaz')!;
  g.ecazAmbassadors = placeAmbassador(inventory, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  return g;
}
function enter(g: Game) {
  return applyAction(g, 'in', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
}
function botView(g: Game, level: (typeof DIFFICULTIES)[number], id = 'ec') {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = level;
  return view;
}
function action(g: Game, level: (typeof DIFFICULTIES)[number]) {
  const view = botView(g, level),
    before = structuredClone(view);
  const actions = botActions(view);
  assert.equal(actions.length, 1);
  assert.deepEqual(view, before, 'bot policy does not mutate its projection');
  assert.equal(actions[0].event, g.pendingAmbassador!.event);
  return actions[0];
}

for (const level of DIFFICULTIES)
  void test(`${level} explicitly acquires for Ecaz through real entry in Basic/Advanced, with or without an existing ally`, () => {
    for (const advanced of [false, true])
      for (const allied of [false, true]) {
        const g = enter(fixture(advanced, allied));
        assert.deepEqual(viewGame(g, 'ec').ambassadorEntry!.dukeAcquisition, {
          blocked: null,
        });
        const selected = action(g, level);
        assert.deepEqual(selected, {
          type: 'decision',
          event: g.pendingAmbassador!.event,
          trigger: true,
          beneficiary: 'ec',
          choice: 'duke',
        });
        const done = applyAction(
          JSON.parse(JSON.stringify(g)) as Game,
          'ec',
          selected,
        );
        assert.equal(done.pendingAmbassador, null);
        assert.equal(done.dukeVidal!.controller, 'ec');
        assert.equal(done.dukeVidal!.source, 'ecaz');
        assert.equal(done.dukeVidal!.acquiredTurn, 2);
        assert.deepEqual(done.dukeVidal!.leader, g.dukeVidal!.leader);
        assert.equal(
          done.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.zone,
          'supply',
        );
        assert.deepEqual(
          done.ecazAmbassadors!.cohort,
          g.ecazAmbassadors!.cohort,
        );
        assert.deepEqual(
          done.players,
          g.players,
          'no force, spice, hand, alliance or native-leader changes',
        );
        assert.equal(done.active, g.active);
        assert.deepEqual(done.movementRemaining, g.movementRemaining);
      }
  });

const unavailable: [string, (g: Game) => void][] = [
  [
    'Duke in Tanks',
    (g) => {
      g.dukeVidal!.leader.dead = true;
      g.dukeVidal!.leader.deaths = 1;
    },
  ],
  [
    'already controlled by Ecaz',
    (g) => {
      g.dukeVidal = acquireDuke(g.dukeVidal!, 'ec', 1, 'ecaz');
    },
  ],
  [
    'Advanced Harkonnen table remains gated',
    (g) => {
      g.advanced = true;
      g.players[2] = newPlayer('al', 'Harkonnen', 'harkonnen');
      Object.assign(g.players[2], {
        hand: [],
        forces: {},
        reserves: 20,
        spice: 20,
        traitors: [],
      });
    },
  ],
];
for (const [name, change] of unavailable)
  void test(`all four profiles leave the token in place when ${name}`, () => {
    const state = fixture();
    change(state);
    const g = enter(state);
    assert.ok(viewGame(g, 'ec').ambassadorEntry!.dukeAcquisition!.blocked);
    for (const level of DIFFICULTIES) {
      const selected = action(g, level);
      assert.deepEqual(selected, {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        decline: true,
      });
      const done = applyAction(g, 'ec', selected);
      assert.equal(done.pendingAmbassador, null);
      assert.deepEqual(done.dukeVidal, g.dukeVidal);
      assert.deepEqual(done.ecazAmbassadors, g.ecazAmbassadors);
    }
  });

void test('only the actual owner gets the choice, and bots cannot acquire from an unrelated seat', () => {
  const g = enter(fixture(true, true));
  for (const id of ['in', 'al'])
    for (const level of DIFFICULTIES) {
      assert.equal(viewGame(g, id).ambassadorEntry!.dukeAcquisition, null);
      assert.deepEqual(botActions(botView(g, level, id)), []);
    }
});
void test('all profiles rely on the server descriptor, with safe decline for a missing descriptor', () => {
  const g = enter(fixture());
  for (const level of DIFFICULTIES) {
    const view = botView(g, level);
    Object.defineProperty(view, 'dukeVidal', {
      get() {
        throw Error('Policy read raw Duke custody');
      },
    });
    assert.equal(botActions(view)[0].choice, 'duke');
    view.ambassadorEntry!.dukeAcquisition = null;
    assert.deepEqual(botActions(view), [
      { type: 'decision', event: g.pendingAmbassador!.event, decline: true },
    ]);
  }
});
void test('private opponent hands, resources and traitors do not change acquisition choices or become projected evidence', () => {
  const g = enter(fixture());
  const changed = structuredClone(g);
  changed.players[1].hand.push(changed.deck.shift()!);
  changed.players[1].spice = 1;
  changed.players[1].traitors = [changed.players[2].leaders[0].id];
  for (const level of DIFFICULTIES) {
    assert.deepEqual(action(g, level), action(changed, level));
    const view: GameView = botView(changed, level);
    assert.equal(view.players[1].hand, undefined);
    assert.equal(view.players[1].spice, undefined);
    assert.equal(view.players[1].traitors, undefined);
    assert.deepEqual(view.ambassadorEntry!.dukeAcquisition, { blocked: null });
  }
});
void test('enabling direct Ecaz acquisition never adds the reusable token to BG copy candidates', () => {
  const state = fixture().ecazAmbassadors!;
  assert.ok(!copiedAmbassadorEffects(state).includes('ecaz'));
});
