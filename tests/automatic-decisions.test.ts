import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
const cards = baseDeck();
const shield = cards.find((c) => c.kind === 'shield')!;
const karama = cards.find((c) => c.effect === 'karama')!;
const worthless = cards.find((c) => c.kind === 'worthless')!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function auction() {
  const g = createGame('AUTODECS', newPlayer('w', 'Winner', 'guild'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('a', 'Observer', 'atreides'),
  );
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  g.active = 'a';
  g.order = ['w', 'e', 'a'];
  g.players.forEach((p) => {
    p.hand = [];
    p.spice = 10;
  });
  g.auction = {
    cards: [shield],
    index: 0,
    bid: 5,
    bidder: 'w',
    active: 'a',
    passed: ['e'],
    opener: 0,
    peekKnown: true,
    allyPayment: 0,
  };
  g.deck = [];
  return g;
}
const win = (g: Game) => applyAction(g, 'a', { type: 'passBid' });
function pendingPayment(g: Game) {
  g.decision = { kind: 'auctionPayment', player: 'w' };
  g.active = 'w';
  return g;
}
function battle() {
  const g = auction();
  g.phase = 6;
  g.auction = null;
  g.active = 'a';
  g.players[0].faction = 'guild';
  g.players[1].hand = [shield];
  g.players[1].forces = { 'arrakeen:10': 3 };
  g.players[1].reserves = 17;
  g.players[2].forces = { 'arrakeen:10': 3 };
  g.players[2].reserves = 17;
  g.battle = {
    territory: 'arrakeen',
    attacker: 'a',
    defender: 'e',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
    fullPlan: { owner: 'a', target: 'e' },
  };
  return g;
}
const targetPlan = {
  type: 'battlePlan',
  dial: 0,
  leader: 'emperor-0',
  defense: shield.id,
};
const ownPlan = { type: 'battlePlan', dial: 0, leader: 'atreides-0' };

void test('a funded winning bid with no Karama pays immediately and follows Emperor income once', () => {
  const initial = auction();
  const before = JSON.stringify(initial);
  const g = win(initial);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.equal(g.auction, null);
  assert.equal(g.players[0].spice, 5);
  assert.equal(g.players[1].spice, 15);
  assert.deepEqual(g.players[0].hand, [shield]);
  assert.deepEqual(
    g.log.filter((e) => e.automatic).map((e) => e.automatic!.name),
    ['Auction payment', 'Auction income'],
  );
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  assert.equal(JSON.stringify(initial), before);
  assert.throws(() => applyAction(g, 'w', { type: 'decision', karama: false }));
});

void test('automatic payment consumes exactly the declared ally split and still pauses for a real income response', () => {
  const initial = auction();
  initial.players[0].spice = 2;
  initial.players[0].ally = 'a';
  initial.players[2].ally = 'w';
  initial.players[2].hand = [karama];
  initial.aid.a = { recipient: 'w', amount: 4 };
  initial.auction!.allyPayment = 3;
  const g = win(initial);
  assert.equal(g.decision, null);
  assert.equal(g.response?.kind, 'emperorIncome');
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[2].spice, 10);
  assert.equal(g.aid.a.amount, 1);
  assert.equal(g.players[1].spice, 10);
  assert.deepEqual(viewGame(g, 'a').responseControls?.cancelCards, [karama.id]);
  assert.deepEqual(g.players[0].hand, [shield]);
});

void test('a physical Karama preserves spice-versus-card choice without spending either method', () => {
  const initial = auction();
  initial.players[0].hand = [karama];
  const g = win(initial);
  assert.equal(g.decision?.kind, 'auctionPayment');
  assert.equal(g.players[0].spice, 10);
  assert.deepEqual(g.players[0].hand, [karama]);
  const paid = applyAction(g, 'w', {
    type: 'decision',
    karama: true,
    card: karama.id,
  });
  assert.equal(paid.players[0].spice, 10);
  assert.equal(paid.players[1].spice, 10);
  assert.deepEqual(paid.players[0].hand, [shield]);
  assert.equal(paid.discard.filter((c) => c.id === karama.id).length, 1);
});

void test('BG Worthless preserves a payment choice only in Advanced mode and only when physically spendable', () => {
  for (const advanced of [false, true]) {
    const initial = auction();
    initial.advanced = advanced;
    initial.players[0].faction = 'beneGesserit';
    initial.players[0].hand = [worthless];
    const g = win(initial);
    assert.equal(g.decision?.kind === 'auctionPayment', advanced);
    assert.equal(g.players[0].spice, advanced ? 10 : 5);
  }
  const reserved = auction();
  reserved.advanced = true;
  reserved.players[0].faction = 'beneGesserit';
  reserved.players[0].hand = [worthless];
  reserved.moritaniRetention = {
    owner: 'a',
    player: 'w',
    territory: 'arrakeen',
    turn: 2,
    played: [worthless.id],
    eligible: [worthless.id],
    stage: 'choose',
  };
  const g = normalizeAutomaticGame(pendingPayment(reserved));
  assert.equal(g.players[0].spice, 5);
  assert.ok(g.players[0].hand.some((c) => c.id === worthless.id));
});

void test('normalization does not invent an ally split or bypass provisional unfunded recovery', () => {
  const g = auction();
  g.players[0].spice = 1;
  g.players[0].ally = 'a';
  g.players[2].ally = 'w';
  g.aid.a = { recipient: 'w', amount: 5 };
  g.auction!.allyPayment = 1;
  const waiting = normalizeAutomaticGame(pendingPayment(g));
  assert.equal(waiting.decision?.kind, 'auctionPayment');
  assert.equal(waiting.players[0].spice, 1);
  assert.equal(waiting.aid.a.amount, 5);
  assert.throws(
    () => applyAction(waiting, 'w', { type: 'decision', karama: false }),
    /no longer funded/,
  );
  const unfunded = auction();
  unfunded.players[0].spice = 0;
  const recovered = win(unfunded);
  assert.equal(recovered.auction!.bidder, null);
  assert.equal(recovered.auction!.bid, 0);
  assert.equal(recovered.decision, null);
  assert.equal(recovered.players[0].hand.length, 0);
});

void test('Truthtrance, phase opening and genuine responses retain priority over a singleton payment', () => {
  for (const overlay of ['truth', 'opening', 'response'] as const) {
    const g = pendingPayment(auction());
    if (overlay === 'truth')
      g.truthtrance = {
        stage: 'ask',
        queue: [{ player: 'a', card: 'truth' }],
        passed: [],
        question: null,
      };
    if (overlay === 'opening')
      g.phaseOpening = { initialize: false, passed: [] };
    if (overlay === 'response') {
      g.response = { kind: 'guildIncome', owner: 'e', amount: 1, passed: [] };
      g.players[2].hand = [karama];
    }
    const next = normalizeAutomaticGame(g);
    assert.equal(next.decision?.kind, 'auctionPayment');
    assert.equal(next.players[0].spice, 10);
    assert.equal(next.players[0].hand.length, 0);
  }
});

void test('target seals first, inspection stays private and persistent, and the second plan reveals without acknowledgement', () => {
  const initial = battle();
  assert.throws(
    () => applyAction(initial, 'a', ownPlan),
    /requested by special/,
  );
  const g = applyAction(initial, 'e', targetPlan);
  assert.equal(g.decision, null);
  assert.equal(g.battle!.revealed, false);
  assert.deepEqual(
    viewGame(reload(g), 'a').battle?.fullPlanInsight?.plan,
    g.battle!.plans.e,
  );
  assert.equal(viewGame(g, 'w').battle?.fullPlanInsight, null);
  assert.equal(viewGame(g, 'e').battle?.fullPlanInsight, null);
  assert.equal(
    g.log.filter((e) => e.automatic?.name === 'Full plan inspection').length,
    1,
  );
  assert.ok(
    g.log.every(
      (e) => !e.text.includes(shield.name) && !e.text.includes('emperor-0'),
    ),
  );
  const done = applyAction(reload(g), 'a', ownPlan);
  assert.equal(done.battle!.revealed, true);
  assert.equal(viewGame(done, 'a').battle?.fullPlanInsight, null);
});

void test('legacy inspection acknowledgement normalizes once while preserving exact commitments and owner entitlement', () => {
  const g = battle();
  g.battle!.plans.e = {
    dial: 0,
    support: 0,
    leader: 'emperor-0',
    weapon: null,
    defense: shield.id,
  };
  g.decision = { kind: 'fullPlanRead', player: 'a', target: 'e' };
  const before = JSON.stringify(g);
  const next = normalizeAutomaticGame(reload(g));
  assert.equal(next.decision, null);
  assert.deepEqual(next.battle, g.battle);
  assert.deepEqual(next.players, g.players);
  assert.equal(JSON.stringify(g), before);
  assert.deepEqual(normalizeAutomaticGame(reload(next)), reload(next));
  assert.ok(viewGame(next, 'a').battle?.fullPlanInsight);
  const controlled = applyAction(g, 'a', {
    type: 'setAutopilot',
    difficulty: 'Easy',
  });
  assert.deepEqual(controlled.decision, g.decision);
});

void test('an external Atreides inspection remains private without delaying either combatant after the target seals', () => {
  const g = battle();
  g.battle!.fullPlan!.owner = 'a';
  g.battle!.attacker = 'w';
  g.players[0].forces = { 'arrakeen:10': 3 };
  g.players[0].reserves = 17;
  g.players[2].forces = {};
  g.players[2].reserves = 20;
  const next = applyAction(g, 'e', targetPlan);
  assert.equal(next.decision, null);
  assert.ok(viewGame(next, 'a').battle?.fullPlanInsight);
  assert.equal(viewGame(next, 'w').battle?.fullPlanInsight, null);
  const done = applyAction(next, 'w', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-0',
  });
  assert.equal(done.battle!.revealed, true);
});
