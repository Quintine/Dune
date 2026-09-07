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
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { reserveShipmentCost } from '../game/shipment-price';

function fixture(
  faction: FactionId = 'emperor',
  other: FactionId = 'atreides',
): Game {
  const g = createGame('SHIPBUDGET', newPlayer('p', 'Shipper', faction));
  g.players.push(newPlayer('other', 'Other', other));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['p', 'other'];
  g.active = 'p';
  g.movementRemaining = ['p', 'other'];
  for (const p of g.players) {
    p.spice = 0;
    p.forces = {};
    p.hand = [];
  }
  return g;
}
function candidates(g: Game, difficulty: Difficulty) {
  const state = structuredClone(g);
  state.players[0].bot = difficulty;
  return botActions(viewGame(state, 'p'));
}
const ships = (actions: Action[]) => actions.filter((a) => a.type === 'ship');
function expectedCost(g: Game, action: Action) {
  const p = g.players[0];
  if (p.faction === 'fremen') return 0;
  const standard =
    Number(action.amount) *
    (territory(String(action.territory)).type === 'stronghold' ? 1 : 2);
  const half =
    p.faction === 'guild' ||
    g.players.some((x) => x.faction === 'guild' && x.id === p.ally) ||
    g.karamaShipping?.player === p.id;
  return half ? Math.ceil(standard / 2) : standard;
}
function compareBudget(g: Game, difficulty: Difficulty, authoritative = true) {
  const rich = structuredClone(g);
  rich.players[0].spice = 1000;
  // No board spice or forces in these fixtures: increasing own balance does not
  // alter destination ranking, only the affordability filter being tested.
  const baseline = ships(candidates(rich, difficulty));
  assert.ok(baseline.length > 0);
  const budget = g.players[0].spice + viewGame(g, 'p').aid.available;
  const expected = baseline.filter((a) => expectedCost(g, a) <= budget);
  const actual = ships(candidates(g, difficulty));
  assert.deepEqual(
    actual,
    expected,
    `${difficulty}: keep candidate amounts and relative order`,
  );
  if (authoritative)
    for (const action of actual)
      assert.doesNotThrow(
        () => applyAction(g, 'p', action),
        `${difficulty}: ${JSON.stringify(action)}`,
      );
  return actual;
}

void test('all profiles filter zero-spice ordinary ships and retain only one-force stronghold ships at one spice', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    assert.deepEqual(compareBudget(g, difficulty), []);
    g.players[0].spice = 1;
    const actions = compareBudget(g, difficulty);
    assert.ok(actions.length > 0);
    assert.ok(
      actions.every(
        (a) =>
          a.amount === 1 &&
          territory(String(a.territory)).type === 'stronghold',
      ),
    );
  }
});

void test('Guild half-rate uses ceiling on total shipment, including three-force stronghold and sand prices', () => {
  assert.equal(
    reserveShipmentCost({ faction: 'guild', halfRate: true }, 'stronghold', 3),
    2,
  );
  assert.equal(
    reserveShipmentCost({ faction: 'guild', halfRate: true }, 'sand', 3),
    3,
  );
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('guild');
    g.players[0].spice = 1;
    const one = compareBudget(g, difficulty);
    assert.ok(one.every((a) => Number(a.amount) < 3));
    g.players[0].spice = 2;
    const two = compareBudget(g, difficulty);
    if (difficulty !== 'Easy')
      assert.ok(
        two.some(
          (a) =>
            a.amount === 3 &&
            territory(String(a.territory)).type === 'stronghold',
        ),
      );
    assert.ok(
      !two.some(
        (a) =>
          a.amount === 3 &&
          territory(String(a.territory)).type !== 'stronghold',
      ),
    );
    g.players[0].spice = 3;
    compareBudget(g, difficulty);
  }
});

void test('current Guild ally receives half-rate and a broken alliance does not retain it', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('emperor', 'guild');
    g.players[0].ally = 'other';
    g.players[1].ally = 'p';
    g.players[0].spice = 2;
    const allied = compareBudget(g, difficulty);
    if (difficulty !== 'Easy') assert.ok(allied.some((a) => a.amount === 3));
    g.players[0].ally = null;
    g.players[1].ally = null;
    const unallied = compareBudget(g, difficulty);
    assert.ok(unallied.every((a) => Number(a.amount) < 3));
  }
});

void test('available ally pledge funds shipment while unpledged or differently earmarked spice does not', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].ally = 'other';
    g.players[1].ally = 'p';
    g.players[1].spice = 500;
    assert.deepEqual(compareBudget(g, difficulty), []);
    g.aid.other = { recipient: 'p', amount: 3 };
    assert.ok(compareBudget(g, difficulty).length > 0);
    g.aid.other = { recipient: 'other', amount: 3 };
    assert.deepEqual(compareBudget(g, difficulty), []);
  }
});

void test('legal Fremen free reserve candidates survive zero budget', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('fremen');
    const actions = compareBudget(g, difficulty);
    assert.ok(actions.length > 0);
    assert.ok(actions.every((a) => expectedCost(g, a) === 0));
  }
});

void test('Karama discount follows its beneficiary rather than card owner or another active player', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].spice = 2;
    g.karamaShipping = { player: 'p', owner: 'other' };
    const recipient = compareBudget(g, difficulty);
    if (difficulty !== 'Easy') assert.ok(recipient.some((a) => a.amount === 3));
    g.karamaShipping = { player: 'other', owner: 'p' };
    const ownerOnly = compareBudget(g, difficulty);
    assert.ok(ownerOnly.every((a) => Number(a.amount) < 3));
  }
});

void test('opponents hidden balances cannot fund paid Guild transport or change shipment choices', () => {
  for (const difficulty of DIFFICULTIES) {
    const paid = fixture();
    paid.players[0].spice = 1;
    const paidBefore = candidates(paid, difficulty);
    paid.players[1].spice = 999999;
    assert.deepEqual(candidates(paid, difficulty), paidBefore);
    const g = fixture('fremen', 'guild');
    g.players[0].ally = 'other';
    g.players[1].ally = 'p';
    const before = candidates(g, difficulty);
    const transports = before.filter((a) => a.type === 'guildShip');
    assert.deepEqual(transports, []);
    g.players[1].spice = 999999;
    assert.deepEqual(candidates(g, difficulty), before);
    g.players[0].spice = 1000;
    const funded = candidates(g, difficulty).filter(
      (a) => a.type === 'guildShip',
    );
    assert.ok(funded.length > 0);
    for (const action of funded)
      assert.doesNotThrow(() => applyAction(g, 'p', action));
  }
});
