import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  RuleError,
} from '../game/engine';
import { baseDeck, treacheryDeck } from '../game/cards';
import { charityAmount, charityMultiplier } from '../game/charity';
import { createTechTokens } from '../game/tech-tokens';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(advanced = false) {
  const g = createGame('INFLATE2', newPlayer('c', 'CHOAM', 'choam'), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 7;
  g.order = ['c', 'e', 'b'];
  g.deck = baseDeck();
  g.players.forEach((p) => {
    p.spice = 20;
    p.traitorChoices = [];
  });
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  while (g.decision?.kind === 'choamMarket')
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response) {
    const p = g.players.find(
      (p) =>
        !viewGame(g, p.id).responseControls?.hasPassed &&
        !!viewGame(g, p.id).responseControls?.cancelCards.length,
    )!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function place(g: Game, side: 'double' | 'cancel' = 'double') {
  return applyAction(g, 'c', { type: 'choamInflation', side });
}
function contest(g: Game, count = 1, id = 'e') {
  for (let n = 0; n < count; n++) {
    const index = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(index >= 0);
    g.players.find((p) => p.id === id)!.hand.push(g.deck.splice(index, 1)[0]);
  }
  return g;
}
function cancel(g: Game) {
  const card = g.players
    .find((p) => p.id === 'e')!
    .hand.find((card) => card.effect === 'karama');
  assert.ok(card, 'canceller must hold Karama before the declaration');
  return applyAction(g, 'e', { type: 'card', card: card.id, mode: 'cancel' });
}
function nextCharity(state: Game) {
  const g = structuredClone(state);
  g.turn++;
  g.phase = 1;
  g.nexus = true;
  g.ready = [];
  return ready(g);
}
function mentat(state: Game) {
  const g = structuredClone(state);
  g.phase = 7;
  g.ready = [];
  return ready(g);
}
void test('Inflation placement is a CHOAM Mentat action with a response before the token enters play', () => {
  const initial = contest(fixture());
  assert.throws(() => place(initial), /Mentat/);
  let g = ready(initial);
  assert.throws(
    () => applyAction(g, 'e', { type: 'choamInflation', side: 'double' }),
    /CHOAM/,
  );
  assert.throws(
    () => applyAction(g, 'c', { type: 'choamInflation', side: 'invalid' }),
    /Choose/,
  );
  g = applyAction(g, 'e', { type: 'ready' });
  g = place(g);
  assert.equal(g.response?.kind, 'choamInflation');
  assert.equal(g.inflation, undefined);
  assert.deepEqual(g.ready, []);
  g = allow(g);
  assert.deepEqual(g.inflation, {
    side: 'double',
    placedTurn: 1,
    updatedTurn: 1,
    flipped: false,
  });
  assert.equal(g.inflationUsed, true);
  assert.equal(charityMultiplier(g), 1);
  assert.equal(initial.inflation, undefined);
});
void test('both Inflation orders last two charity phases, flip once and are permanently removed', () => {
  for (const side of ['double', 'cancel'] as const) {
    let g = allow(place(ready(fixture()), side));
    for (let i = 0; i < 2; i++) {
      const expected = (i === 0 ? side === 'double' : side === 'cancel')
        ? 2
        : 0;
      const before = g.players[0].spice;
      g = allow(nextCharity(g));
      assert.equal(charityMultiplier(g), expected);
      assert.equal(g.players[0].spice, before + 6 * expected);
      g = mentat(g);
      assert.equal(g.response, null);
      if (i === 0) {
        assert.equal(g.inflation?.flipped, true);
        assert.notEqual(g.inflation?.side, side);
      } else assert.equal(g.inflation, null);
    }
    assert.equal(g.inflationUsed, true);
    assert.throws(() => place(g), /already used/);
    const before = g.players[0].spice;
    g = allow(nextCharity(g));
    assert.equal(g.players[0].spice, before + 6);
  }
});
void test('Double changes ordinary payout, preserves ordinary eligibility and doubles advanced Bene Gesserit', () => {
  const initial = allow(nextCharity(allow(place(ready(fixture(true))))));
  for (const [starting, ordinary, bg] of [
    [0, 4, 4],
    [1, 2, 4],
    [2, 0, 4],
    [20, 0, 4],
  ]) {
    let g = structuredClone(initial);
    g.players[1].spice = starting;
    g.players[2].spice = starting;
    assert.equal(charityAmount(g, g.players[1]), ordinary);
    assert.equal(charityAmount(g, g.players[2]), bg);
    const before = g.players[0].spice;
    if (ordinary) g = applyAction(g, 'e', { type: 'charity' });
    else assert.throws(() => applyAction(g, 'e', { type: 'charity' }), /fewer/);
    g = allow(applyAction(g, 'b', { type: 'charity' }));
    assert.equal(g.players[1].spice, starting + ordinary);
    assert.equal(g.players[2].spice, starting + bg);
    assert.equal(g.players[0].spice, before - ordinary - bg);
  }
});
void test('Cancel suppresses all claims and CHOAM income, including wealthy advanced Bene Gesserit', () => {
  let g = nextCharity(allow(place(ready(fixture(true)), 'cancel')));
  assert.equal(g.response, null);
  assert.equal(g.players[0].spice, 20);
  for (const p of g.players) {
    assert.equal(charityAmount(g, p), 0);
    assert.throws(() => applyAction(g, p.id, { type: 'charity' }), /fewer/);
    assert.equal(viewGame(g, p.id).charity.incomePending, false);
  }
  g = ready(g);
  assert.equal(g.phase, 3);
});
void test('canceling doubled CHOAM income preserves doubled charity from the bank', () => {
  let g = cancel(nextCharity(contest(allow(place(ready(fixture(true)))))));
  g.players[0].spice = 0;
  g.players[1].spice = 1;
  g = applyAction(g, 'c', { type: 'charity' });
  g = applyAction(g, 'e', { type: 'charity' });
  g = allow(applyAction(g, 'b', { type: 'charity' }));
  assert.deepEqual(
    g.players.map((p) => p.spice),
    [4, 3, 24],
  );
  assert.equal(g.inflation?.side, 'double');
});
void test('canceling doubled wealthy Bene Gesserit charity does not charge CHOAM', () => {
  let g = allow(nextCharity(allow(place(ready(fixture(true))))));
  const before = g.players[0].spice;
  g = cancel(applyAction(contest(g), 'b', { type: 'charity' }));
  assert.equal(g.players[0].spice, before);
  assert.equal(g.players[2].spice, 20);
});
void test('canceled placement preserves the token for a later Mentat but prevents another attempt this phase', () => {
  let g = cancel(place(ready(contest(fixture()))));
  assert.equal(g.inflationUsed, undefined);
  assert.equal(g.inflation, undefined);
  assert.throws(() => place(g, 'cancel'), /already attempted/);
  g.turn++;
  g = allow(place(g, 'cancel'));
  assert.equal(g.inflation?.side, 'cancel');
  assert.equal(g.inflation?.placedTurn, 2);
});
void test('mandatory flip and removal do not open a Karama window and do not repeat on phase reentry', () => {
  let g = allow(nextCharity(allow(place(ready(fixture())))));
  g = mentat(g);
  assert.equal(g.inflation?.side, 'cancel');
  const before = structuredClone(g.inflation);
  g = mentat(g);
  assert.deepEqual(g.inflation, before);
  assert.equal(g.response, null);
  const card = g.deck.find((c) => c.effect === 'karama')!;
  g.players[1].hand.push(card);
  assert.throws(
    () => applyAction(g, 'e', { type: 'card', card: card.id, mode: 'cancel' }),
    RuleError,
  );
});
void test('Double prohibits bribes immediately, then permits them after flipping to Cancel', () => {
  let g = allow(place(ready(fixture())));
  g.phase = 0;
  assert.throws(
    () => applyAction(g, 'e', { type: 'bribe', target: 'b', amount: 1 }),
    /Bribes are prohibited/,
  );
  g = mentat(allow(nextCharity(g)));
  g.phase = 0;
  g = applyAction(g, 'e', { type: 'bribe', target: 'b', amount: 1 });
  assert.equal(g.players[2].bribes, 1);
});
void test('existing bribes still settle at Mentat when Inflation flips onto Double', () => {
  let g = allow(place(ready(fixture()), 'cancel'));
  g = allow(nextCharity(g));
  g = applyAction(g, 'e', { type: 'bribe', target: 'b', amount: 3 });
  g = mentat(g);
  assert.equal(g.inflation?.side, 'double');
  assert.equal(g.players[2].spice, 23);
  assert.equal(g.players[2].bribes, 0);
});
void test('Inflation leaves Spice Production payout unchanged and CHOAM income alone does not trigger it', () => {
  let g = fixture();
  g.techTokens = createTechTokens();
  g.techTokens.production.owner = 'e';
  g = allow(nextCharity(allow(place(ready(g)))));
  assert.equal(g.techTokens!.production.spice, 0);
  g.players[1].spice = 0;
  g = applyAction(g, 'e', { type: 'charity' });
  assert.equal(g.players[1].spice, 4);
  assert.equal(g.techTokens!.production.spice, 1);
  g = ready(g);
  assert.equal(g.players[1].spice, 5);
});
void test('Amal phase opening precedes the mandatory Mentat flip', () => {
  let g = allow(nextCharity(allow(place(ready(fixture())))));
  g.expansions.push('ix');
  g.deck = treacheryDeck(['ix']);
  const amal = g.deck.find((c) => c.effect === 'amal')!;
  g.deck = g.deck.filter((c) => c.id !== amal.id);
  g.players[0].hand.push(amal);
  g = mentat(g);
  assert.ok(g.phaseOpening);
  assert.equal(g.inflation?.side, 'double');
  const before = g.players[0].spice;
  g = applyAction(g, 'c', { type: 'card', card: amal.id });
  assert.equal(g.players[0].spice, Math.floor(before / 2));
  g = ready(g);
  assert.equal(g.inflation?.side, 'cancel');
});
void test('Inflation lifecycle persists across JSON reconnects with identical public status', () => {
  let g = allow(place(ready(fixture())));
  g = JSON.parse(JSON.stringify(g)) as Game;
  assert.deepEqual(viewGame(g, 'c').inflation, viewGame(g, 'e').inflation);
  g = mentat(allow(nextCharity(g)));
  g = JSON.parse(JSON.stringify(g)) as Game;
  g = mentat(allow(nextCharity(g)));
  assert.equal(g.inflation, null);
  assert.equal(viewGame(g, 'b').inflationUsed, true);
});
void test('all AI levels place Inflation legally, finish its response and do not claim canceled charity', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = ready(fixture(true));
    g.players[0].bot = difficulty;
    g = applyAction(g, 'c', botActions(viewGame(g, 'c'))[0]);
    assert.equal(g.response, null);
    assert.equal(g.inflationUsed, true);
    g = allow(g);
    assert.equal(botActions(viewGame(g, 'c'))[0].type, 'ready');
    if (g.inflation!.side === 'double') g = mentat(allow(nextCharity(g)));
    g = allow(nextCharity(g));
    assert.equal(charityMultiplier(g), 0);
    g.players.forEach((p) => {
      p.bot = difficulty;
      p.spice = 0;
    });
    for (const p of g.players)
      assert.equal(botActions(viewGame(g, p.id))[0].type, 'ready');
  }
});
