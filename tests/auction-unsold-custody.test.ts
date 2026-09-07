import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';

// Exposed Charity-phase fixture, then real readiness, bidding, payment and
// income allowance produce the pending Harkonnen bonus below. Cards are
// physically extracted; only the explicitly marked corruption is fabricated.
function live(harkCount = 1, keepBgCounter = true) {
  let g = createGame(
    'SALEQUOTE',
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    true,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 2,
    ready: [],
    order: ['h', 'e', 'b', 'g'],
    deck: baseDeck(),
    discard: [],
    phaseOpening: null,
    response: null,
    decision: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  const hold = (id: string, match: (c: Game['deck'][number]) => boolean) => {
    const i = g.deck.findIndex(match);
    assert.ok(i >= 0);
    const card = g.deck.splice(i, 1)[0];
    g.players.find((p) => p.id === id)!.hand.push(card);
    return card;
  };
  const own = hold('h', (c) => c.effect === 'karama'),
    printed = hold('g', (c) => c.effect === 'karama'),
    bg = hold('b', (c) => c.kind === 'worthless');
  if (!keepBgCounter) {
    g.players[2].hand = [];
    g.deck.push(bg);
  }
  while (g.players[0].hand.length < harkCount) hold('h', () => true);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  assert.ok(g.auction);
  g = applyAction(g, 'h', { type: 'bid', amount: 4 });
  for (let i = 0; !g.decision && !g.response && i < 20; i++)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  assert.equal(g.decision?.kind, 'auctionPayment');
  return { g, own, printed, bg };
}
function paid(harkCount = 1, free = false, keepBgCounter = true) {
  const f = live(harkCount, keepBgCounter);
  return {
    ...f,
    g: applyAction(f.g, 'h', {
      type: 'decision',
      karama: free,
      ...(free ? { card: f.own.id } : {}),
    }),
  };
}
function passOne(state: Game) {
  let g = state;
  const kind = g.response!.kind,
    use = JSON.stringify(g.pendingKarama?.use);
  for (
    let i = 0;
    g.response?.kind === kind &&
    JSON.stringify(g.pendingKarama?.use) === use &&
    i < 20;
    i++
  ) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}

function bonus() {
  const f = paid();
  f.g = passOne(f.g);
  assert.equal(f.g.response?.kind, 'harkonnenBonus');
  assert.ok(f.g.auction!.cards.length > f.g.auction!.index + 1);
  return f;
}
function duplicateUnsold(g: Game, zone: 'deck' | 'hand') {
  const card = structuredClone(g.auction!.cards[g.auction!.index + 1]);
  if (zone === 'deck') g.deck.push(card);
  else g.players.find((p) => p.id === 'e')!.hand.push(card);
  return card.id;
}
for (const zone of ['deck', 'hand'] as const) {
  void test(`duplicate unsold card in ${zone} rejects printed and BG cancellation before accepting cost`, () => {
    const f = bonus();
    duplicateUnsold(f.g, zone);
    const before = structuredClone(f.g);
    for (const form of ['printed', 'bg'] as const) {
      assert.throws(() =>
        applyAction(f.g, form === 'printed' ? 'g' : 'b', {
          type: 'card',
          card: f[form].id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(f.g, before);
      assert.equal(f.g.discard.filter((c) => c.id === f[form].id).length, 0);
    }
  });
  void test(`saved paid BG allowance rejects newly duplicated unsold ${zone} custody without another discard`, () => {
    const f = bonus();
    const paid = applyAction(f.g, 'b', {
      type: 'card',
      card: f.bg.id,
      mode: 'cancel',
    });
    assert.equal(paid.response?.kind, 'worthlessKarama');
    const bad = JSON.parse(JSON.stringify(paid)) as Game;
    duplicateUnsold(bad, zone);
    const before = structuredClone(bad);
    assert.throws(() => passOne(bad));
    assert.deepEqual(bad, before);
    assert.equal(bad.discard.filter((c) => c.id === f.bg.id).length, 1);
    assert.equal(bad.auction!.index, f.g.auction!.index);
    assert.equal(bad.response?.kind, 'worthlessKarama');
  });
}
void test('valid unsold custody permits paid BG continuation while the acquired current card remains a historical auction alias', () => {
  const f = bonus(),
    acquired = f.g.auction!.cards[f.g.auction!.index].id;
  assert.equal(f.g.players[0].hand.filter((c) => c.id === acquired).length, 1);
  const expectedNext = f.g.auction!.cards[f.g.auction!.index + 1].id;
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.bg.id,
    mode: 'cancel',
  });
  const done = passOne(JSON.parse(JSON.stringify(paid)) as Game);
  assert.equal(done.auction!.index, f.g.auction!.index + 1);
  assert.equal(done.auction!.cards[done.auction!.index].id, expectedNext);
  assert.equal(
    done.deck.some((c) => c.id === expectedNext),
    false,
  );
  assert.equal(done.players[0].hand.filter((c) => c.id === acquired).length, 1);
  assert.equal(done.auction!.cards[0].id, acquired);
  assert.equal(done.players[0].spice, f.g.players[0].spice);
  assert.equal(done.players[1].spice, f.g.players[1].spice);
  assert.equal(done.discard.filter((c) => c.id === f.bg.id).length, 1);
});
