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
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

function fixture() {
  const g = createGame(
    'DISTRANSREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    active: 'a',
    order: ['r', 'a', 'e'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
  }
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  return g;
}
function hold(g: Game, owner: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const i = source.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const card = source.splice(i, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
const send = (g: Game, who: string, action: Action) =>
  applyAction(g, who, action);
const transfer = (g: Game, who: string, target: string, give: string) =>
  send(g, who, { type: 'card', card: 'richese-distrans', target, give });
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();

void test('a real affirmative Truthtrance promise cannot be broken by transferring its sole promised weapon', () => {
  let g = fixture();
  g.advanced = false;
  g.phase = 6;
  g.storm = 18;
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 4 };
    p.reserves = 16;
  }
  g.players[0].ally = null;
  g.players[1].ally = null;
  g.battle = {
    territory: 'arrakeen',
    attacker: 'r',
    defender: 'a',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  hold(g, 'r', 'Distrans');
  const weapon = hold(g, 'r', 'Maula Pistol');
  const truth = hold(g, 'a', 'Truthtrance');
  g = send(g, 'a', { type: 'card', card: truth });
  while (g.truthtrance!.stage === 'priority')
    g = send(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = send(g, 'a', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'r',
      claim: { kind: 'weapon', name: 'Maula Pistol' },
    },
  });
  g = send(g, 'r', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.battle!.truthPromises![0].released, undefined);
  const before = structuredClone(g);
  assert.throws(
    () => transfer(g, 'r', 'e', weapon),
    /promise|Truthtrance|truthful/i,
  );
  assert.deepEqual(g, before);
  const choice = viewGame(g, 'r').distrans!.choices.find(
    (c) => c.recipient === 'e',
  )!;
  assert.equal(
    choice.cards.some((c) => c.id === weapon),
    false,
  );
  assert.ok(
    choice.unavailable.some(
      (entry) =>
        entry.card.id === weapon &&
        /promise|Truthtrance|truthful/i.test(entry.reason),
    ),
  );
});

void test('pending Richese gifts reserve both a Distrans activation and a prospective transferred card', () => {
  for (const reserved of ['Distrans', 'Karama']) {
    let g = fixture();
    const d = hold(g, 'r', 'Distrans');
    const give = hold(g, 'r', reserved === 'Distrans' ? 'Shield' : 'Karama');
    hold(g, 'e', 'Karama');
    const gift = reserved === 'Distrans' ? d : give;
    g = send(g, 'r', { type: 'richeseGift', card: gift });
    assert.equal(g.response?.kind, 'richeseGift');
    const before = structuredClone(g);
    assert.throws(
      () => transfer(reload(g), 'r', 'e', give),
      /reserved|gift|committed/i,
    );
    assert.deepEqual(g, before);
    assert.equal(inventory(g).filter((id) => id === gift).length, 1);
  }
});

void test('third-party Distrans may fill a pending gift recipient and make settlement abort without losing either card', () => {
  let g = fixture();
  const gift = hold(g, 'r', 'Karama');
  hold(g, 'e', 'Distrans');
  const give = hold(g, 'e', 'Shield');
  hold(g, 'e', 'Karama');
  for (const name of ['Maula Pistol', 'Lasgun', 'Baliset']) hold(g, 'a', name);
  const before = inventory(g);
  g = send(g, 'r', { type: 'richeseGift', card: gift });
  const pending = reload(g).pendingRicheseGift;
  const response = structuredClone(g.response);
  g = transfer(reload(g), 'e', 'a', give);
  assert.deepEqual(g.pendingRicheseGift, pending);
  assert.deepEqual(g.response, response);
  assert.equal(g.players[1].hand.length, 4);
  g = send(g, 'e', { type: 'passResponse' });
  assert.equal(g.pendingRicheseGift, null);
  assert.ok(g.players[0].hand.some((c) => c.id === gift));
  assert.ok(g.players[1].hand.some((c) => c.id === give));
  assert.deepEqual(inventory(g), before);
});

void test('the pending gift recipient can use Distrans to free room without changing the reserved gift or parent response', () => {
  let g = fixture();
  const gift = hold(g, 'r', 'Karama');
  hold(g, 'a', 'Distrans');
  const give = hold(g, 'a', 'Shield');
  hold(g, 'a', 'Maula Pistol');
  hold(g, 'e', 'Karama');
  const before = inventory(g);
  g = send(g, 'r', { type: 'richeseGift', card: gift });
  const pending = reload(g).pendingRicheseGift;
  g = transfer(reload(g), 'a', 'e', give);
  assert.deepEqual(g.pendingRicheseGift, pending);
  assert.equal(g.players[1].hand.length, 1);
  g = send(g, 'e', { type: 'passResponse' });
  assert.equal(g.players[1].hand.length, 2);
  assert.ok(g.players[1].hand.some((c) => c.id === gift));
  assert.equal(g.pendingRicheseGift, null);
  assert.deepEqual(inventory(g), before);
});

void test('real Harkonnen extraction reserves future recipient slots and enough outgoing cards for the mandatory return', () => {
  for (const initialSize of [4, 3]) {
    let g = fixture();
    hold(g, 'r', 'Distrans');
    const give = hold(g, 'r', 'Shield');
    const k = hold(g, 'e', 'Karama');
    for (const name of ['Maula Pistol', 'Lasgun', 'Baliset', 'Snooper'].slice(
      0,
      initialSize,
    ))
      hold(g, 'a', name);
    const original = g.players[1].hand.map((c) => c.id);
    const before = inventory(g);
    g = send(g, 'e', {
      type: 'card',
      mode: 'special',
      card: k,
      target: 'a',
      amount: 2,
    });
    if (initialSize === 4) {
      const snapshot = structuredClone(g);
      assert.throws(() => transfer(g, 'r', 'a', give), /room|exchange/);
      assert.deepEqual(g, snapshot);
    } else g = transfer(reload(g), 'r', 'a', give);
    g = send(reload(g), 'e', {
      type: 'decision',
      returnCards: g.players[2].hand
        .filter((c) => original.includes(c.id))
        .map((c) => c.id),
    });
    assert.equal(g.players[1].hand.length, 4);
    assert.deepEqual(inventory(g), before);
  }
  let g = fixture();
  hold(g, 'e', 'Distrans');
  const k = hold(g, 'e', 'Karama');
  const give = hold(g, 'a', 'Shield');
  hold(g, 'a', 'Maula Pistol');
  g = send(g, 'e', {
    type: 'card',
    mode: 'special',
    card: k,
    target: 'a',
    amount: 2,
  });
  const before = structuredClone(g);
  assert.throws(() => transfer(g, 'e', 'r', give), /enough|exchange/);
  assert.deepEqual(g, before);
});

void test('accepted Ix replacement remains reserved through a saved parent response inside a pending gift', () => {
  let g = fixture();
  const d = hold(g, 'a', 'Distrans');
  const give = hold(g, 'a', 'Shield');
  const gift = hold(g, 'r', 'Karama');
  hold(g, 'e', 'Karama');
  g.pendingIxAlly = { player: 'a', card: give, free: false };
  g.response = { kind: 'ixAllyCard', owner: 'e', passed: [] };
  g = send(g, 'r', { type: 'richeseGift', card: gift });
  assert.equal(g.pendingRicheseGift!.resume.response!.kind, 'ixAllyCard');
  const before = structuredClone(g);
  assert.throws(
    () => transfer(g, 'a', 'e', give),
    /replacement|committed|Ixian/,
  );
  assert.deepEqual(g, before);
  g.pendingIxAlly!.card = d;
  const changed = structuredClone(g);
  assert.throws(
    () => transfer(g, 'a', 'e', give),
    /replacement|committed|Ixian/,
  );
  assert.deepEqual(g, changed);
});
