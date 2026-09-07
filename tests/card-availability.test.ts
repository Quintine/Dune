import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { ordinaryCardAvailability } from '../game/card-availability';

const effects = ['weather', 'atomics', 'hajr', 'harvester'] as const;
type Effect = (typeof effects)[number];
function fixture(effect: Effect) {
  const g = createGame('CARDTIME', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('b', 'Harkonnen', 'harkonnen'));
  g.status = 'playing';
  g.phase = effect === 'hajr' ? 5 : effect === 'harvester' ? 1 : 0;
  g.order = ['a', 'b'];
  g.active = 'a';
  const card = baseDeck().find((c) => c.effect === effect)!;
  g.players[0].hand = [card];
  g.players[0].forces =
    effect === 'atomics' ? { 'shield_wall:8': 10 } : { 'arrakeen:10': 10 };
  g.players[0].reserves = 10;
  g.players[1].forces = { 'carthag:11': 10 };
  g.players[1].reserves = 10;
  g.spiceWindow =
    effect === 'harvester'
      ? {
          territory: 'cielago_south',
          sector: 2,
          amount: 6,
          harvested: false,
        }
      : null;
  g.spice = effect === 'harvester' ? { 'cielago_south:2': 6 } : {};
  return {
    g,
    card,
    action: {
      type: 'card',
      card: card.id,
      ...(effect === 'weather' ? { amount: 2 } : {}),
    },
  };
}
function agrees(effect: Effect, change: (g: Game) => void, expected: boolean) {
  const { g, card, action } = fixture(effect);
  change(g);
  const input = JSON.stringify(g);
  const view = viewGame(g, 'a');
  const viewBefore = JSON.stringify(view);
  const result = ordinaryCardAvailability(
    view,
    card.id,
    effect === 'weather' ? { amount: action.amount } : undefined,
  );
  assert.equal(
    result?.available,
    expected,
    `${effect}: ${JSON.stringify(result)}`,
  );
  assert.equal(JSON.stringify(view), viewBefore);
  if (expected) {
    const next = applyAction(g, 'a', action);
    assert.ok(!next.players[0].hand.some((c) => c.id === card.id));
    assert.equal(next.discard.filter((c) => c.id === card.id).length, 1);
  } else {
    assert.ok(result && !result.available && result.reason.length > 0);
    assert.throws(() => applyAction(g, 'a', action));
  }
  assert.equal(
    JSON.stringify(g),
    input,
    'inspection and action validation preserve their input',
  );
}

void test('the four shared availability checks agree with legal server effects', () => {
  for (const effect of effects) agrees(effect, () => {}, true);
});
void test('all four cards report pending table windows and reject without mutation', () => {
  const pauses: ((g: Game) => void)[] = [
    (g) => {
      g.status = 'lobby';
    },
    (g) => {
      g.status = 'setup';
    },
    (g) => {
      g.status = 'finished';
    },
    (g) => {
      g.truthtrance = {
        stage: 'priority',
        queue: [],
        passed: [],
        question: null,
      };
    },
    (g) => {
      g.phaseOpening = { passed: [], initialize: false };
    },
    (g) => {
      g.response = { kind: 'atreidesAuction', owner: 'b', passed: [] };
    },
    (g) => {
      g.decision = { kind: 'auctionPayment', player: 'b' };
    },
  ];
  for (const effect of effects)
    for (const pause of pauses) agrees(effect, pause, false);
});
void test('Weather Control stays available after dials and confirmations, but validates the selected distance', () => {
  agrees(
    'weather',
    (g) => {
      g.stormDialers = ['a', 'b'];
      g.stormDials = { a: 20, b: 20 };
      g.stormPending = 40;
      g.ready = ['b'];
    },
    true,
  );
  agrees(
    'weather',
    (g) => {
      g.phase = 1;
    },
    false,
  );
  for (const amount of [0, 10, -1, 11, 1.5, NaN, Infinity, '2', undefined]) {
    const { g, card, action } = fixture('weather');
    const result = ordinaryCardAvailability(viewGame(g, 'a'), card.id, {
      amount,
    });
    const valid = amount === 0 || amount === 10;
    assert.equal(result?.available, valid);
    if (valid)
      assert.equal(
        applyAction(g, 'a', { ...action, amount }).stormPending,
        amount,
      );
    else assert.throws(() => applyAction(g, 'a', { ...action, amount }));
  }
  const { g, card } = fixture('weather');
  assert.equal(
    ordinaryCardAvailability(viewGame(g, 'a'), card.id)?.available,
    true,
    'omitting selection asks about timing only',
  );
});
void test('Hajr requires the active movement owner and cannot grant a third move', () => {
  agrees(
    'hajr',
    (g) => {
      g.active = 'b';
    },
    false,
  );
  agrees(
    'hajr',
    (g) => {
      g.phase = 6;
    },
    false,
  );
  agrees(
    'hajr',
    (g) => {
      g.hajr = ['a'];
    },
    false,
  );
  agrees(
    'hajr',
    (g) => {
      g.hajr = ['b'];
      g.players[0].shipped = true;
      g.players[0].moved = 1;
    },
    true,
  );
});
void test('Family Atomics checks actual fighters and a surviving Shield Wall', () => {
  agrees(
    'atomics',
    (g) => {
      g.shieldWallDestroyed = true;
    },
    false,
  );
  agrees(
    'atomics',
    (g) => {
      g.phase = 5;
    },
    false,
  );
  agrees(
    'atomics',
    (g) => {
      g.players[0].forces = { 'sietch_tabr:14': 10 };
    },
    false,
  );
  agrees(
    'atomics',
    (g) => {
      g.players[0].forces = { 'shield_wall:8': 10 };
    },
    true,
  );
  agrees(
    'atomics',
    (g) => {
      g.advanced = true;
      g.players[0].faction = 'beneGesserit';
      g.players[0].advisors = { shield_wall: {} };
      g.players[1].forces = { 'shield_wall:8': 10 };
    },
    false,
  );
});
void test('Harvester distinguishes fresh, repeated, closed and legacy blow windows', () => {
  agrees(
    'harvester',
    (g) => {
      g.spiceWindow = null;
    },
    false,
  );
  agrees(
    'harvester',
    (g) => {
      g.phase = 2;
    },
    false,
  );
  agrees(
    'harvester',
    (g) => {
      g.spiceWindow!.harvested = true;
    },
    false,
  );
  agrees(
    'harvester',
    (g) => {
      g.spiceWindow!.harvested = true;
      g.spiceWindow!.harvesters = 1;
    },
    true,
  );
  agrees(
    'harvester',
    (g) => {
      g.spiceWindow!.harvested = true;
      g.spiceWindow!.harvesters = 1;
      g.spiceWindow!.harvesterClosed = true;
    },
    false,
  );
  agrees(
    'harvester',
    (g) => {
      g.storm = 2;
      g.spice = {};
    },
    true,
  );
});
void test('availability is deterministic, needs no random draws and ignores other players hidden cards', (t) => {
  for (const effect of effects) {
    const { g, card } = fixture(effect);
    const view = viewGame(g, 'a');
    const original = JSON.stringify(view);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw new Error('No random draw is allowed');
    });
    const first = ordinaryCardAvailability(view, card.id);
    const second = ordinaryCardAvailability(JSON.parse(original), card.id);
    assert.deepEqual(first, second);
    assert.equal(random.mock.callCount(), 0);
    random.mock.restore();
    g.players[1].hand = baseDeck();
    g.deck = baseDeck().reverse();
    g.discard = baseDeck();
    assert.deepEqual(
      ordinaryCardAvailability(viewGame(g, 'a'), card.id),
      first,
    );
    assert.equal(JSON.stringify(view), original);
  }
});
void test('unrelated effects retain their validators and unowned identities are rejected', () => {
  const { g } = fixture('weather');
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[0].hand.push(karama);
  const view = viewGame(g, 'a');
  assert.equal(ordinaryCardAvailability(view, karama.id), null);
  assert.equal(
    ordinaryCardAvailability(view, 'unowned-card')?.available,
    false,
  );
});
