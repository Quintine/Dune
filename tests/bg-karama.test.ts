import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  joinGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
const worthless = baseDeck().filter((c) => c.kind === 'worthless');
const karama = baseDeck().filter((c) => c.effect === 'karama');
const auctionCard = baseDeck().find((c) => c.kind === 'projectile')!;
function fixture() {
  let g = createGame(
    'BGKARAM2',
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'b', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'emperor', turn: 3 });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  g.advanced = true;
  g.phase = 2;
  g.players.forEach((p) => {
    p.spice = 20;
    p.hand = [];
  });
  g.players[0].hand = [worthless[0]];
  g.players[1].hand = [karama[0]];
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function cancel(g: Game) {
  return applyAction(g, 'e', {
    type: 'card',
    card: karama[0].id,
    mode: 'cancel',
  });
}
function auction() {
  const g = fixture();
  g.phase = 3;
  g.active = 'b';
  g.order = ['b', 'e', 'g'];
  g.auction = {
    cards: [auctionCard],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'b',
    passed: [],
    opener: 0,
    peekKnown: false,
  };
  g.deck = [];
  return g;
}
function winBid(state: Game, amount: number) {
  let g = applyAction(state, 'b', { type: 'bid', amount });
  g = applyAction(g, 'e', { type: 'passBid' });
  return applyAction(g, 'g', { type: 'passBid' });
}
void test('advanced Bene Gesserit receives two charity spice at every wealth level, with cancellation only at two or more', () => {
  for (const starting of [0, 1, 2, 20]) {
    let g = fixture();
    g.players[0].spice = starting;
    g = applyAction(g, 'b', { type: 'charity' });
    assert.equal(g.response?.kind, starting >= 2 ? 'bgCharity' : undefined);
    if (starting >= 2) assert.equal(g.players[0].spice, starting);
    g = allow(g);
    assert.equal(g.players[0].spice, starting + 2);
    assert.equal(viewGame(g, 'b').players[0].charityClaimed, true);
    assert.equal(viewGame(g, 'e').players[0].charityClaimed, undefined);
    assert.throws(
      () => applyAction(g, 'b', { type: 'charity' }),
      /once per turn/,
    );
  }
});
void test('canceling rich Bene Gesserit charity spends the attempt; ordinary charity cannot be farmed by bribing spice away', () => {
  let g = cancel(applyAction(fixture(), 'b', { type: 'charity' }));
  assert.equal(g.players[0].spice, 20);
  assert.throws(
    () => applyAction(g, 'b', { type: 'charity' }),
    /once per turn/,
  );
  g.turn++;
  g = allow(applyAction(g, 'b', { type: 'charity' }));
  assert.equal(g.players[0].spice, 22);
  g = fixture();
  g.advanced = false;
  g.players[0].spice = 1;
  g = applyAction(g, 'b', { type: 'charity' });
  assert.equal(g.players[0].spice, 2);
  g = applyAction(g, 'b', { type: 'bribe', target: 'e', amount: 2 });
  assert.throws(
    () => applyAction(g, 'b', { type: 'charity' }),
    /once per turn/,
  );
});
void test('Worthless conversion is limited to advanced Bene Gesserit, and invalid shipment attempts do not discard a card', () => {
  const g = fixture();
  const action = {
    type: 'card',
    card: worthless[0].id,
    mode: 'shipment',
    target: 'e',
  };
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'b', action), /active player/);
  assert.deepEqual(g, before);
  g.phase = 5;
  g.active = 'e';
  g.advanced = false;
  assert.throws(() => applyAction(g, 'b', action), /special card/);
  g.advanced = true;
  g.players[2].hand = [worthless[1]];
  assert.throws(
    () => applyAction(g, 'g', { ...action, card: worthless[1].id }),
    /special card/,
  );
});
void test('a Worthless shipment benefit resolves after its response or is canceled without consuming the recipient shipment', () => {
  let g = fixture();
  g.phase = 5;
  g.active = 'e';
  g = applyAction(g, 'b', {
    type: 'card',
    card: worthless[0].id,
    mode: 'shipment',
    target: 'e',
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.karamaShipping, null);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.discard.filter((c) => c.id === worthless[0].id).length, 1);
  const denied = cancel(g);
  assert.equal(denied.karamaShipping, null);
  assert.equal(denied.players[1].shipped, false);
  assert.equal(denied.pendingKarama, null);
  const granted = allow(g);
  assert.deepEqual(granted.karamaShipping, {
    player: 'e',
    owner: 'b',
    card: worthless[0].id,
  });
  assert.equal(granted.pendingKarama, null);
});
void test('canceling a Worthless cancellation restores the exact suspended response without exposing private payloads', () => {
  let g = fixture();
  g.players[0].hand.push(worthless[1]);
  g.players[1].ally = 'g';
  g.players[2].ally = 'e';
  g.response = {
    kind: 'emperorGift',
    owner: 'e',
    recipient: 'g',
    amount: 7,
    passed: ['g'],
  };
  const suspended = structuredClone(g.response);
  g = applyAction(g, 'b', {
    type: 'card',
    card: worthless[0].id,
    mode: 'cancel',
  });
  const publicView = viewGame(JSON.parse(JSON.stringify(g)), 'b');
  assert.equal('pendingKarama' in publicView, false);
  assert.equal(publicView.response?.amount, undefined);
  assert.equal(publicView.response?.intent, 'Cancel a power used by Emperor.');
  assert.throws(
    () =>
      applyAction(g, 'b', { type: 'card', card: karama[1].id, mode: 'cancel' }),
    /another faction/,
  );
  const blocked = cancel(g);
  assert.deepEqual(blocked.response, suspended);
  const resumed = allow(blocked);
  assert.equal(resumed.players[1].spice, 13);
  assert.equal(resumed.players[2].spice, 27);
  const successfulCancel = allow(g);
  assert.equal(successfulCancel.players[1].spice, 20);
  assert.equal(successfulCancel.players[2].spice, 20);
  assert.equal(successfulCancel.response, null);
});
void test('a real Karama cancels a faction power directly without opening a counter-Karama window', () => {
  const g = fixture();
  g.phase = 5; // Guild income is a completed shipment receipt.
  g.response = { kind: 'guildIncome', owner: 'g', amount: 5, passed: [] };
  const result = cancel(g);
  assert.equal(result.response, null);
  assert.equal(result.pendingKarama ?? null, null);
  assert.equal(result.players[2].spice, 20);
});
void test('Worthless direct acquisition retains the preexisting bid when canceled and enforces hand eligibility before discarding', () => {
  let g = auction();
  g.auction!.bidder = 'e';
  g.auction!.bid = 3;
  g = applyAction(g, 'b', {
    type: 'card',
    card: worthless[0].id,
    mode: 'purchase',
  });
  const denied = cancel(g);
  assert.equal(denied.auction!.bidder, 'e');
  assert.equal(denied.auction!.bid, 3);
  assert.equal(denied.players[0].hand.length, 0);
  const won = allow(g);
  assert.equal(won.players[0].hand[0].id, auctionCard.id);
  assert.equal(won.players[0].spice, 20);
  g = auction();
  g.players[0].hand = worthless.slice(0, 4);
  assert.throws(
    () =>
      applyAction(g, 'b', {
        type: 'card',
        card: worthless[0].id,
        mode: 'purchase',
      }),
    /eligible to bid/,
  );
  assert.equal(g.players[0].hand.length, 4);
});
void test('holding Worthless permits an overbid without discarding or revealing it if outbid', () => {
  let g = auction();
  g.players[0].spice = 1;
  g = applyAction(g, 'b', { type: 'bid', amount: 15 });
  assert.equal(g.response, null);
  assert.equal(g.players[0].hand[0].id, worthless[0].id);
  g = applyAction(g, 'e', { type: 'bid', amount: 16 });
  g = applyAction(g, 'g', { type: 'passBid' });
  g = applyAction(g, 'b', { type: 'passBid' });
  g = allow(applyAction(g, 'e', { type: 'decision', karama: false }));
  assert.equal(g.players[0].hand[0].id, worthless[0].id);
  assert.equal(g.players[0].spice, 1);
});
void test('auction payment may spend a selected Worthless or real Karama and only grants the card after conversion succeeds', () => {
  let g = auction();
  g.players[0].hand.push(karama[1]);
  g = winBid(g, 7);
  const pending = applyAction(g, 'b', {
    type: 'decision',
    karama: true,
    card: worthless[0].id,
  });
  assert.equal(pending.response?.kind, 'worthlessKarama');
  assert.equal(
    pending.players[0].hand.some((c) => c.id === auctionCard.id),
    false,
  );
  const completed = allow(pending);
  assert.equal(
    completed.players[0].hand.some((c) => c.id === auctionCard.id),
    true,
  );
  assert.equal(
    completed.players[0].hand.some((c) => c.id === karama[1].id),
    true,
  );
  const real = applyAction(g, 'b', {
    type: 'decision',
    karama: true,
    card: karama[1].id,
  });
  assert.equal(real.response, null);
  assert.equal(
    real.players[0].hand.some((c) => c.id === worthless[0].id),
    true,
  );
});
void test('canceled payment automatically uses its only funded alternative; provisional unfunded recovery restarts the same card without charging spice', () => {
  let g = winBid(auction(), 7);
  g = cancel(
    applyAction(g, 'b', {
      type: 'decision',
      karama: true,
      card: worthless[0].id,
    }),
  );
  assert.notEqual(g.decision?.kind, 'auctionPayment');
  g = allow(g);
  assert.equal(g.players[0].spice, 13);
  assert.equal(
    g.players[0].hand.filter((c) => c.id === auctionCard.id).length,
    1,
  );
  const paid = structuredClone(g);
  assert.throws(() => applyAction(g, 'b', { type: 'decision', karama: false }));
  assert.deepEqual(g, paid, 'a stale payment cannot charge again');
  g = auction();
  g.players[0].spice = 1;
  g = winBid(g, 70);
  g = cancel(
    applyAction(g, 'b', {
      type: 'decision',
      karama: true,
      card: worthless[0].id,
    }),
  );
  assert.equal(g.auction!.bid, 0);
  assert.equal(g.auction!.bidder, null);
  assert.equal(g.auction!.cards[0].id, auctionCard.id);
  assert.equal(g.active, 'b');
  assert.equal(g.players[0].spice, 1);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.decision, null);
});
void test('sealed or prescience-committed Worthless cards cannot be spent as Karama', () => {
  const g = fixture();
  g.response = { kind: 'guildIncome', owner: 'g', amount: 5, passed: [] };
  g.battle = {
    prepared: true,
    territory: 'arrakeen',
    attacker: 'b',
    defender: 'e',
    plans: {
      b: {
        dial: 0,
        leader: 'beneGesserit-0',
        weapon: worthless[0].id,
        defense: null,
        support: 0,
      },
    },
    revealed: false,
    traitorCalls: {},
  };
  const action = { type: 'card', card: worthless[0].id, mode: 'cancel' };
  assert.throws(() => applyAction(g, 'b', action), /sealed battle card/);
  g.battle.plans = {};
  g.battle.prescience = {
    player: 'e',
    field: 'weapon',
    value: worthless[0].id,
  };
  assert.throws(() => applyAction(g, 'b', action), /committed to prescience/);
  assert.equal(g.players[0].hand.length, 1);
});
void test('advanced AI claims rich charity once and can select Worthless for a required auction payment from its private view', () => {
  let g = fixture();
  g.players[0].bot = 'Hard';
  assert.deepEqual(botActions(viewGame(g, 'b'))[0], { type: 'charity' });
  g = allow(applyAction(g, 'b', { type: 'charity' }));
  assert.ok(botActions(viewGame(g, 'b')).every((a) => a.type !== 'charity'));
  g = auction();
  g.players[0].bot = 'Hard';
  g.players[0].spice = 1;
  g = winBid(g, 5);
  const action = botActions(viewGame(g, 'b'))[0];
  assert.equal(action.karama, true);
  assert.equal(applyAction(g, 'b', action).response?.kind, 'worthlessKarama');
});
