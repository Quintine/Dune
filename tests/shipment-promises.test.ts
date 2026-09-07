import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { TERRITORIES } from '../game/board';
import type { FactionId } from '../game/catalog';

const factions: FactionId[] = [
  'atreides',
  'beneGesserit',
  'emperor',
  'fremen',
  'guild',
  'harkonnen',
];
function fixture(faction: FactionId = 'emperor') {
  const others = factions.filter((f) => f !== faction && f !== 'guild');
  const g = createGame(
    'SHIPTRUTH',
    newPlayer('a', 'Asker', others[0]),
    false,
    [],
  );
  g.players.push(
    newPlayer('p', 'Shipper', faction),
    newPlayer('o', 'Observer', others[1]),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'a', 'o'],
    movementRemaining: ['p', 'a', 'o'],
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players) {
    p.spice = 100;
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.traitorChoices = [];
  }
  return g;
}
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function ask(state: Game, minimum = 6, territory = 'carthag') {
  let g = structuredClone(state);
  const card = hold(g, 'a', 'Truthtrance');
  g = applyAction(g, 'a', { type: 'card', card });
  while (g.truthtrance?.stage === 'priority') {
    const player = g.players.find(
      (p) => !g.truthtrance!.passed.includes(p.id),
    )!;
    g = applyAction(g, player.id, { type: 'truthPass' });
  }
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'shipment', target: 'p', territory, minimum },
  });
}
function answer(g: Game, value: 'yes' | 'no') {
  return applyAction(g, 'p', { type: 'truthAnswer', answer: value });
}
function bind(
  g: Game,
  value: 'yes' | 'no' = 'yes',
  minimum = 6,
  territory = 'carthag',
) {
  return answer(ask(g, minimum, territory), value);
}
function ship(
  g: Game,
  amount: number,
  territory = 'carthag',
  sector = TERRITORIES.find((t) => t.id === territory)!.sectors[0],
) {
  return applyAction(g, 'p', { type: 'ship', territory, sector, amount });
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('all six Basic factions answer and fulfill every minimum from one through twenty with physical reserve forces', () => {
  for (const faction of factions)
    for (let n = 1; n <= 20; n++) {
      const initial = fixture(faction),
        asked = ask(initial, n, 'the_great_flat');
      assert.deepEqual(
        viewGame(asked, 'p').truthShipmentAnswers,
        ['yes', 'no'],
        `${faction}/${n}`,
      );
      reject(asked, 'a', { type: 'truthAnswer', answer: 'yes' });
      reject(asked, 'p', { type: 'truthAnswer', answer: 'unknown' });
      const promised = answer(reload(asked), 'yes'),
        done = ship(promised, n, 'the_great_flat');
      assert.equal(done.players[1].reserves, 20 - n);
      assert.equal(done.players[1].forces['the_great_flat:15'], n);
      assert.equal(done.shipmentPromises?.[0].fulfilled, true);
      assert.equal(done.players[1].shipped, true);
      assert.equal(
        done.discard.filter((c) => c.effect === 'truthtrance').length,
        1,
      );
      assert.deepEqual(normalizeAutomaticGame(reload(done)), reload(done));
    }
});

void test('joint Yes and No predicates retain the full legal amount interval and any legal destination sector', () => {
  const g = bind(bind(fixture(), 'yes', 6, 'wind_pass'), 'no', 8, 'wind_pass');
  for (const amount of [6, 7])
    for (const sector of [14, 15, 16, 17]) {
      const done = ship(g, amount, 'wind_pass', sector);
      assert.ok(done.shipmentPromises?.every((p) => p.fulfilled));
      assert.equal(done.players[1].forces[`wind_pass:${sector}`], amount);
    }
  for (const amount of [1, 5, 8, 20])
    reject(g, 'p', {
      type: 'ship',
      territory: 'wind_pass',
      sector: 15,
      amount,
    });
  const first = bind(fixture());
  const implied = ask(first, 3, 'carthag');
  assert.deepEqual(viewGame(implied, 'p').truthShipmentAnswers, ['yes']);
  reject(implied, 'p', { type: 'truthAnswer', answer: 'no' });
  const incompatible = ask(first, 1, 'arrakeen');
  assert.deepEqual(viewGame(incompatible, 'p').truthShipmentAnswers, ['no']);
  reject(incompatible, 'p', { type: 'truthAnswer', answer: 'yes' });
});

void test('No forbids only matching reserve shipments and permits fewer forces, another destination, movement first or no shipment', () => {
  const initial = fixture();
  initial.players[1].forces = { 'arrakeen:10': 1 };
  initial.players[1].reserves = 19;
  const g = bind(initial, 'no');
  reject(g, 'p', { type: 'ship', territory: 'carthag', sector: 11, amount: 6 });
  assert.equal(ship(g, 5).players[1].forces['carthag:11'], 5);
  assert.equal(
    ship(g, 6, 'wind_pass', 15).players[1].forces['wind_pass:15'],
    6,
  );
  const moved = applyAction(g, 'p', {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  assert.equal(moved.shipmentPromises?.[0].fulfilled, true);
  const skipped = applyAction(g, 'p', { type: 'endMovement' });
  assert.equal(skipped.shipmentPromises?.[0].fulfilled, true);
});

void test('Yes cannot be evaded by moving first, ending movement or another Guild shipment, but fulfillment permits later movement', () => {
  const initial = fixture('guild');
  initial.players[1].forces = { 'arrakeen:10': 1 };
  initial.players[1].reserves = 19;
  const g = bind(initial);
  reject(g, 'p', { type: 'endMovement' });
  reject(g, 'p', {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  reject(g, 'p', {
    type: 'guildShip',
    from: 'arrakeen:10',
    territory: 'carthag',
    sector: 11,
    amount: 1,
  });
  reject(g, 'p', { type: 'guildShip', from: 'arrakeen:10', amount: 1 });
  let done = ship(g, 6);
  if (done.decision?.kind === 'advisor')
    done = applyAction(done, done.decision.player, {
      type: 'decision',
      accept: false,
    });
  assert.doesNotThrow(() =>
    applyAction(done, 'p', {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'imperial_basin',
      sector: 10,
      amount: 1,
    }),
  );
  assert.doesNotThrow(() => applyAction(done, 'p', { type: 'endMovement' }));
});

void test('storm, allied occupancy and two enemy factions deny impossible Yes without exposing a private witness', () => {
  for (const blocked of ['storm', 'ally', 'full']) {
    const g = fixture();
    if (blocked === 'storm') g.storm = 11;
    else {
      g.players[0].forces = { 'carthag:11': 1 };
      g.players[0].reserves = 19;
      if (blocked === 'ally') {
        g.players[0].ally = 'p';
        g.players[1].ally = 'a';
      } else {
        g.players[2].forces = { 'carthag:11': 1 };
        g.players[2].reserves = 19;
      }
    }
    const asked = ask(g);
    assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['no']);
    reject(asked, 'p', { type: 'truthAnswer', answer: 'yes' });
    for (const id of ['a', 'o']) {
      assert.equal(viewGame(asked, id).truthShipmentAnswers, null);
      assert.equal(viewGame(asked, id).shipmentCompletion, null);
    }
  }
  const g = fixture();
  g.storm = 15;
  const promised = bind(g, 'yes', 1, 'wind_pass');
  assert.doesNotThrow(() => ship(promised, 1, 'wind_pass', 14));
  reject(promised, 'p', {
    type: 'ship',
    territory: 'wind_pass',
    sector: 15,
    amount: 1,
  });
});

void test('Ghola, retained Karama and recoverable outgoing ally escrow combine into an executable completion', () => {
  let g = fixture();
  g.players[1].reserves = 1;
  g.players[1].tanks = 5;
  g.players[1].forces = { 'arrakeen:10': 14 };
  g.players[1].spice = 3;
  g.players[1].ally = 'o';
  g.players[2].ally = 'p';
  const ghola = hold(g, 'p', 'Tleilaxu Ghola'),
    karama = hold(g, 'p', 'Karama');
  g = applyAction(g, 'p', { type: 'pledgeAid', amount: 2 });
  const asked = ask(g);
  assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['yes', 'no']);
  let next = answer(asked, 'yes');
  const actions: Action[] = [];
  for (let i = 0; i < 5 && !next.players[1].shipped; i++) {
    const completion = viewGame(next, 'p').shipmentCompletion;
    assert.ok(completion?.actions.length);
    actions.push(completion.actions[0]);
    next = applyAction(next, 'p', completion.actions[0]);
  }
  assert.equal(next.players[1].shipped, true);
  assert.equal(next.players[1].forces['carthag:11'], 6);
  assert.equal(next.players[1].spice, 0);
  assert.equal(next.players[1].tanks, 0);
  assert.equal(next.aid.p.amount, 0);
  assert.ok(actions.some((a) => a.type === 'pledgeAid'));
  assert.ok(actions.some((a) => a.card === ghola));
  assert.ok(actions.some((a) => a.card === karama));
  const limited = fixture();
  limited.players[1].reserves = 1;
  limited.players[1].tanks = 10;
  hold(limited, 'p', 'Tleilaxu Ghola');
  assert.deepEqual(viewGame(ask(limited, 7), 'p').truthShipmentAnswers, ['no']);
});

void test('active Karama and incoming ally escrow count, while unpledged ally funds and incoming bribes do not', () => {
  let g = fixture();
  g.players[1].spice = 0;
  g.players[1].ally = 'o';
  g.players[2].ally = 'p';
  const card = hold(g, 'a', 'Karama');
  g = applyAction(g, 'a', {
    type: 'card',
    card,
    mode: 'shipment',
    target: 'p',
  });
  g = applyAction(g, 'o', { type: 'pledgeAid', amount: 3 });
  const done = ship(bind(g), 6);
  assert.equal(done.players[1].forces['carthag:11'], 6);
  assert.equal(done.aid.o.amount, 0);
  const poor = fixture();
  poor.players[1].spice = 0;
  poor.players[1].bribes = 100;
  poor.players[1].ally = 'o';
  poor.players[2].ally = 'p';
  hold(poor, 'o', 'Karama');
  assert.deepEqual(viewGame(ask(poor), 'p').truthShipmentAnswers, ['no']);
});

void test('Guild-allied Fremen southern-reserve transport can fulfill outside ordinary reinforcement radius and No rejects that same event', () => {
  const g = fixture('fremen');
  g.players[2].faction = 'guild';
  g.players[1].ally = 'o';
  g.players[2].ally = 'p';
  g.players[1].spice = 3;
  const positive = bind(g);
  reject(positive, 'p', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 6,
  });
  assert.equal(
    viewGame(positive, 'p').shipmentCompletion?.actions.at(-1)?.type,
    'guildShip',
  );
  const command: Action = {
    type: 'guildShip',
    from: 'reserves',
    territory: 'carthag',
    sector: 11,
    amount: 6,
  };
  const done = applyAction(positive, 'p', command);
  assert.equal(done.players[1].reserves, 14);
  assert.equal(done.players[1].spice, 0);
  assert.equal(done.shipmentPromises?.[0].fulfilled, true);
  reject(bind(g, 'no'), 'p', command);
  const alone = fixture('fremen');
  assert.deepEqual(viewGame(ask(alone), 'p').truthShipmentAnswers, ['no']);
});

void test('voluntary bribes and spending the only required Ghola or Karama cannot destroy a feasible Yes', () => {
  const plain = fixture();
  plain.players[1].spice = 6;
  const g = bind(plain);
  reject(g, 'p', { type: 'bribe', target: 'o', amount: 1 });
  const discounted = fixture();
  discounted.players[1].spice = 3;
  discounted.players[1].reserves = 20;
  const karama = hold(discounted, 'p', 'Karama');
  const promised = bind(discounted);
  // Donating the only rate card to a different active recipient is rejected by timing,
  // and a legitimate unrelated cancellation must not consume the promised resource.
  const response = structuredClone(promised);
  response.players[2].faction = 'guild';
  response.response = {
    kind: 'guildIncome',
    owner: 'o',
    amount: 1,
    passed: [],
  };
  reject(response, 'p', { type: 'card', card: karama, mode: 'cancel' });
  const revival = fixture();
  revival.players[1].reserves = 1;
  revival.players[1].tanks = 5;
  revival.players[1].leaders[0].dead = true;
  const ghola = hold(revival, 'p', 'Tleilaxu Ghola');
  reject(bind(revival), 'p', {
    type: 'card',
    card: ghola,
    leader: revival.players[1].leaders[0].id,
  });
});

void test('opposing aid withdrawal releases a now-impossible answer once, while recoverable outgoing pledges preserve the obligation', () => {
  let g = fixture();
  g.players[1].spice = 0;
  g.players[1].ally = 'o';
  g.players[2].ally = 'p';
  g = applyAction(g, 'o', { type: 'pledgeAid', amount: 6 });
  g = bind(g);
  const released = applyAction(g, 'o', { type: 'pledgeAid', amount: 0 });
  assert.equal(released.shipmentPromises?.[0].released, true);
  assert.doesNotThrow(() =>
    applyAction(released, 'p', { type: 'endMovement' }),
  );
  assert.deepEqual(normalizeAutomaticGame(reload(released)), reload(released));
  let recoverable = fixture();
  recoverable.players[1].spice = 6;
  recoverable.players[1].ally = 'o';
  recoverable.players[2].ally = 'p';
  recoverable = bind(recoverable);
  recoverable = applyAction(recoverable, 'p', { type: 'pledgeAid', amount: 6 });
  assert.notEqual(recoverable.shipmentPromises?.[0].released, true);
  assert.deepEqual(viewGame(recoverable, 'p').shipmentCompletion?.actions[0], {
    type: 'pledgeAid',
    amount: 0,
  });
  reject(recoverable, 'p', { type: 'endMovement' });
});

void test('malformed questions and unsupported public scopes reject without discarding the queued Truthtrance; legacy saves remain playable', () => {
  const initial = fixture(),
    card = hold(initial, 'a', 'Truthtrance');
  let g = applyAction(initial, 'a', { type: 'card', card });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  for (const minimum of [
    0,
    -1,
    21,
    0.5,
    Infinity,
    NaN,
    '6',
    null,
    Number.MAX_SAFE_INTEGER,
  ])
    reject(g, 'a', {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: 'p',
        territory: 'carthag',
        minimum,
      },
    });
  for (const change of [
    'advanced',
    'expansion',
    'phase',
    'spent',
    'inactive',
    'territory',
  ]) {
    const bad = structuredClone(g);
    if (change === 'advanced') bad.advanced = true;
    if (change === 'expansion') bad.expansions = ['ix'];
    if (change === 'phase') bad.phase = 4;
    if (change === 'spent') bad.players[1].shipped = true;
    if (change === 'inactive') bad.active = 'a';
    reject(bad, 'a', {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: 'p',
        territory: change === 'territory' ? 'missing' : 'carthag',
        minimum: 6,
      },
    });
  }
  const legacy = reload(fixture());
  delete legacy.shipmentPromises;
  assert.doesNotThrow(() => ship(legacy, 1));
  assert.doesNotThrow(() => applyAction(legacy, 'p', { type: 'endMovement' }));
});

void test('private feasible answers and preparation witnesses do not change any opposing view', () => {
  const affordable = fixture(),
    poor = structuredClone(affordable);
  poor.players[1].spice = 0;
  const a = ask(affordable),
    b = ask(poor);
  assert.deepEqual(viewGame(a, 'p').truthShipmentAnswers, ['yes', 'no']);
  assert.deepEqual(viewGame(b, 'p').truthShipmentAnswers, ['no']);
  for (const id of ['a', 'o'])
    assert.deepEqual(viewGame(a, id), viewGame(b, id));
  const six = structuredClone(affordable);
  six.players[1].spice = 6;
  const high = bind(affordable),
    low = bind(six);
  assert.ok(viewGame(high, 'p').shipmentCompletion);
  assert.ok(viewGame(low, 'p').shipmentCompletion);
  for (const id of ['a', 'o']) {
    assert.equal(viewGame(high, id).shipmentCompletion, null);
    assert.deepEqual(viewGame(high, id), viewGame(low, id));
  }
});

void test('saved malformed promise bindings reject before action or normalization while old and fulfilled JSON remain valid', () => {
  const valid = bind(fixture());
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.shipmentPromises![0].minimum = 0;
    },
    (g) => {
      g.shipmentPromises![0].territory = 'missing';
    },
    (g) => {
      g.shipmentPromises![0].player = 'missing';
    },
    (g) => {
      g.shipmentPromises![0].asker = 'p';
    },
    (g) => {
      g.shipmentPromises![0].turn = g.turn + 1;
    },
    (g) => {
      Object.assign(g.shipmentPromises![0], { answer: 'yes' });
    },
    (g) => {
      g.shipmentPromises![0].fulfilled = true;
      g.shipmentPromises![0].released = true;
    },
    (g) => {
      g.advanced = true;
    },
    (g) => {
      g.phase = 4;
    },
    (g) => {
      g.active = 'a';
    },
    (g) => {
      g.players[1].shipped = true;
    },
    (g) => {
      Object.assign(g, { shipmentPromises: {} });
    },
  ];
  for (const change of changes) {
    const invalid = reload(valid);
    change(invalid);
    const before = structuredClone(invalid);
    assert.throws(() => normalizeAutomaticGame(invalid), /shipment promise/);
    reject(invalid, 'p', { type: 'endMovement' });
    assert.deepEqual(invalid, before);
  }
  const old = reload(valid);
  old.shipmentPromises![0].turn--;
  assert.doesNotThrow(() => applyAction(old, 'p', { type: 'endMovement' }));
  const fulfilled = reload(ship(valid, 6));
  assert.equal(fulfilled.shipmentPromises![0].fulfilled, true);
  assert.deepEqual(normalizeAutomaticGame(fulfilled), fulfilled);
});
