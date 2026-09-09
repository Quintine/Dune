import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { forceRevivalQuote, newRevivalRules } from '../game/revival';

const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
const p = (g: Game, id: string) =>
  g.players.find((player) => player.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

function setup(roster: FactionId[] = ['fremen', 'emperor']) {
  let g = createGame(
    'HOMEREVIVALBENEFITS',
    newPlayer(roster[0], roster[0], roster[0]),
    false,
    roster.some((id) => id === 'tleilaxu' || id === 'ixians') ? ['ix'] : [],
  );
  for (const id of roster.slice(1)) joinGame(g, newPlayer(id, id, id));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const id of roster) g = applyAction(g, id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 30; i++) {
    let moved = false;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((v) => v.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      g = applyAction(g, player.id, action);
      moved = true;
      break;
    }
    assert.ok(moved);
  }
  assert.equal(g.status, 'playing');
  // Precisely stage a later Charity phase. Physical setup cards and counters
  // remain in their real zones; later positions below conserve every counter.
  Object.assign(g, {
    phase: 2,
    turn: 2,
    storm: 18,
    active: null,
    ready: [],
    order: roster,
    phaseOpening: null,
  });
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
  }
  return g;
}
function position(g: Game, id: string, reserves: number, tanks: number) {
  const player = p(g, id);
  const board = 20 - reserves - tanks;
  assert.ok(board >= 0);
  Object.assign(player, {
    reserves,
    tanks,
    forces: board ? { 'polar_sink:0': board } : {},
  });
  if (player.elites) {
    const total =
      player.faction === 'emperor' ? 5 : player.faction === 'fremen' ? 3 : 7;
    // These fixtures put only ordinary forces in Tanks. Remaining stars keep
    // their physical identities in native reserves or on the neutral board.
    const eliteReserves = Math.min(total, reserves);
    const eliteBoard = total - eliteReserves;
    assert.ok(eliteBoard <= board);
    player.elites = {
      reserves: eliteReserves,
      tanks: 0,
      forces: eliteBoard ? { 'polar_sink:0': eliteBoard } : {},
      revived: 0,
    };
  }
}
function inventory(g: Game) {
  for (const player of g.players) {
    assert.equal(player.reserves + player.tanks + sum(player.forces), 20);
    if (player.elites)
      assert.equal(
        player.elites.reserves +
          player.elites.tanks +
          sum(player.elites.forces),
        player.faction === 'emperor' ? 5 : player.faction === 'fremen' ? 3 : 7,
      );
    assert.ok(player.spice >= 0);
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ];
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  const before = reload(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), before);
}
/** Genuine Charity last-ready, real unsold auction lots, and public Amal passes. */
function enterRevival(state: Game) {
  let g = state;
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  for (let i = 0; (g.phase === 3 || g.phaseOpening) && i < 100; i++) {
    if (g.phaseOpening) {
      const id = g.players.find(
        (player) => !g.phaseOpening!.passed.includes(player.id),
      )!.id;
      g = applyAction(g, id, { type: 'ready' });
    } else {
      assert.equal(g.phase, 3);
      assert.ok(g.auction);
      g = applyAction(g, g.auction.active!, { type: 'passBid' });
    }
  }
  assert.equal(g.phase, 4);
  assert.equal(g.phaseOpening ?? null, null);
  inventory(g);
  return g;
}
function rejected(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function lowFremen(withTleilaxu = false) {
  const g = setup(withTleilaxu ? ['fremen', 'emperor', 'tleilaxu'] : undefined);
  position(g, 'fremen', 2, 6);
  if (withTleilaxu) position(g, 'tleilaxu', 12, 0);
  return enterRevival(g);
}
function hold(g: Game, owner: string, effect: string) {
  const index = g.deck.findIndex((card) => card.effect === effect);
  assert.ok(
    index >= 0,
    `Unheld ${effect} must exist in the real shuffled deck.`,
  );
  const [card] = g.deck.splice(index, 1);
  p(g, owner).hand.push(card);
  return card.id;
}

void test('one low Fremen group returns four free without a Tleilaxu expansion-of-limit response', () => {
  for (const tleilaxu of [false, true]) {
    const g = lowFremen(tleilaxu);
    const view = viewGame(g, 'fremen');
    assert.equal(view.revival.freeRemaining, 4);
    assert.equal(view.revival.forcesRemaining, 4);
    assert.equal(view.revival.limit, 4);
    const quote = forceRevivalQuote(g, p(g, 'fremen'), 4, 0);
    assert.equal(quote.cost, 0);
    assert.equal(quote.free, 4);
    const beforeSpice = p(g, 'fremen').spice;
    const done = applyAction(g, 'fremen', {
      type: 'revive',
      amount: 4,
      elite: 0,
    });
    assert.equal(done.pendingRevival ?? null, null);
    assert.equal(done.response, null);
    assert.equal(p(done, 'fremen').reserves, 6);
    assert.equal(p(done, 'fremen').tanks, 2);
    assert.equal(p(done, 'fremen').spice, beforeSpice);
    assert.equal(p(done, 'fremen').revived, 4);
    assert.equal(p(done, 'fremen').freeForcesRevived, 4);
    assert.equal(viewGame(done, 'fremen').revival.forcesRemaining, 0);
    assert.equal(
      done.log.some((entry) =>
        /expanded.*revival|limit.*five/i.test(entry.text),
      ),
      false,
    );
    inventory(done);
  }
});

void test('later separate Fremen requests recompute a crossed native threshold instead of retaining a phase-wide fourth free return', () => {
  let g = lowFremen();
  g = applyAction(g, 'fremen', { type: 'revive', amount: 1, elite: 0 });
  assert.equal(p(g, 'fremen').reserves, 3);
  assert.equal(viewGame(g, 'fremen').revival.freeRemaining, 2);
  assert.equal(viewGame(g, 'fremen').revival.limit, 3);
  rejected(g, 'fremen', { type: 'revive', amount: 3, elite: 0 });
  g = applyAction(reload(g), 'fremen', { type: 'revive', amount: 2, elite: 0 });
  assert.equal(p(g, 'fremen').revived, 3);
  assert.equal(p(g, 'fremen').tanks, 3);
  rejected(g, 'fremen', { type: 'revive', amount: 1, elite: 0 });
  inventory(g);
});

void test('Fremen alliance supplies three, with a fourth coming only from the recipient own low Homeworld', () => {
  for (const recipientLow of [false, true])
    for (const donorLow of [false, true]) {
      let g = setup();
      position(g, 'fremen', donorLow ? 2 : 10, 0);
      position(g, 'emperor', recipientLow ? 4 : 10, 5);
      p(g, 'fremen').ally = 'emperor';
      p(g, 'emperor').ally = 'fremen';
      p(g, 'fremen').allySinceTurn = 1;
      p(g, 'emperor').allySinceTurn = 1;
      g = enterRevival(g);
      g = applyAction(g, 'fremen', { type: 'grantRevival' });
      const amount = recipientLow ? 4 : 3;
      assert.equal(viewGame(g, 'emperor').revival.freeRemaining, amount);
      assert.equal(viewGame(g, 'emperor').revival.limit, amount);
      const before = p(g, 'emperor').spice;
      if (!recipientLow)
        rejected(g, 'emperor', { type: 'revive', amount: 4, elite: 0 });
      g = applyAction(g, 'emperor', { type: 'revive', amount, elite: 0 });
      assert.equal(p(g, 'emperor').spice, before);
      assert.equal(p(g, 'emperor').freeForcesRevived, amount);
      inventory(g);
    }
});

void test('La La La saved free-block rule suppresses the whole low rate, with no claim of a live unsupported CHOAM deck path', () => {
  let g = setup();
  position(g, 'fremen', 2, 5);
  position(g, 'emperor', 4, 5);
  g = enterRevival(g);
  // Explicit existing rule-context fixture: CHOAM's complete deck/setup remains
  // gated, so this does not fabricate a live Worthless declaration or receipt.
  g.revivalRules = { ...newRevivalRules(), freeBlocked: ['fremen', 'emperor'] };
  assert.equal(viewGame(g, 'fremen').revival.freeRemaining, 0);
  assert.equal(viewGame(g, 'emperor').revival.freeRemaining, 0);
  rejected(g, 'fremen', { type: 'revive', amount: 1, elite: 0 });
  const before = p(g, 'emperor').spice;
  const done = applyAction(g, 'emperor', {
    type: 'revive',
    amount: 2,
    elite: 0,
  });
  assert.equal(p(done, 'emperor').spice, before - 4);
  assert.equal(p(done, 'emperor').freeForcesRevived, 0);
  inventory(done);
});

void test('all four AI policies propose legal current low revival quantities without reading another player private cards', () => {
  const g = lowFremen();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(g, 'fremen');
    view.players.find((player) => player.id === 'fremen')!.bot = difficulty;
    assert.ok(
      view.players
        .filter((player) => player.id !== 'fremen')
        .every((player) => player.hand === undefined),
    );
    const before = structuredClone(view);
    const candidates = botActions(view);
    assert.deepEqual(view, before);
    const revivals = candidates.filter((action) => action.type === 'revive');
    assert.ok(revivals.length, `${difficulty} must expose some revival policy`);
    for (const action of revivals) {
      assert.ok(Number(action.amount) <= 4);
      const quote = forceRevivalQuote(
        g,
        p(g, 'fremen'),
        Number(action.amount),
        Number(action.elite ?? 0),
      );
      assert.equal(quote.cost, 0);
      assert.doesNotThrow(() => applyAction(g, 'fremen', action));
    }
  }
});

void test('actual Bidding exit snapshots low Tleilax; later crossing high suppresses others free income but preserves own, paid and Ghola income', () => {
  let g = setup(['tleilaxu', 'fremen', 'emperor']);
  position(g, 'tleilaxu', 7, 3);
  position(g, 'fremen', 2, 6);
  position(g, 'emperor', 12, 5);
  g = enterRevival(g);
  assert.deepEqual(g.homeworldRevival, {
    turn: 2,
    tleilaxu: { player: 'tleilaxu', low: true },
  });
  const initial = p(g, 'tleilaxu').spice;
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'tleilaxu', { type: 'revive', amount: 2, elite: 0 }),
    /timing ruling/,
  );
  assert.deepEqual(g, before);
  g = applyAction(g, 'tleilaxu', { type: 'revive', amount: 1, elite: 0 });
  assert.equal(p(g, 'tleilaxu').reserves, 8);
  assert.equal(
    p(g, 'tleilaxu').spice,
    initial + 1,
    'The low card does not suppress its owner free-revival income.',
  );
  // A later physical return from the board changes the current native side.
  // This narrow position seam preserves all twenty counters and the actual
  // phase-opening income receipt without inventing a threshold-crossing revival.
  position(g, 'tleilaxu', 9, p(g, 'tleilaxu').tanks);
  assert.equal(p(g, 'tleilaxu').reserves, 9);
  assert.equal(
    viewGame(g, 'tleilaxu').homeworlds!.worlds!.find(
      (world) => world.native === 'tleilaxu',
    )!.side,
    'high',
  );
  g = applyAction(reload(g), 'fremen', { type: 'revive', amount: 4, elite: 0 });
  assert.equal(p(g, 'tleilaxu').spice, initial + 1);
  assert.equal(g.revivalFreeIncome!.fremen, 2);
  g = applyAction(g, 'emperor', { type: 'revive', amount: 3, elite: 0 });
  assert.equal(
    p(g, 'tleilaxu').spice,
    initial + 5,
    'Four paid spice still reach Tleilaxu; the free counter gives no bank bonus.',
  );
  const card = hold(g, 'emperor', 'ghola');
  g = applyAction(g, 'emperor', { type: 'card', card, amount: 2, elite: 0 });
  assert.equal(
    p(g, 'tleilaxu').spice,
    initial + 6,
    'Ghola remains its separately named income event.',
  );
  assert.deepEqual(g.homeworldRevival, {
    turn: 2,
    tleilaxu: { player: 'tleilaxu', low: true },
  });
  inventory(g);
});

void test('actual high Tleilax phase opening permits one ordinary free-income payment per other faction and does not recreate a consumed receipt', () => {
  let g = setup(['tleilaxu', 'emperor']);
  position(g, 'tleilaxu', 9, 0);
  position(g, 'emperor', 4, 5);
  g = enterRevival(g);
  assert.equal(g.homeworldRevival!.tleilaxu.low, false);
  const before = p(g, 'tleilaxu').spice;
  g = applyAction(g, 'emperor', { type: 'revive', amount: 1, elite: 0 });
  assert.equal(p(g, 'tleilaxu').spice, before + 1);
  // Emperor crosses to high after the first return; its second return is now
  // paid. This tests both dynamic rate and the independent income receipt.
  g = applyAction(reload(g), 'emperor', {
    type: 'revive',
    amount: 1,
    elite: 0,
  });
  assert.equal(p(g, 'tleilaxu').spice, before + 3);
  assert.equal(g.revivalFreeIncome!.emperor, 2);
  inventory(g);
});

void test('every AI respects the projected low-Homeworld special-Karama boundary and can allow the saved revival', () => {
  let g = setup(['fremen', 'tleilaxu', 'atreides']);
  position(g, 'fremen', 2, 12);
  position(g, 'tleilaxu', 12, 0);
  // This interaction uses the same real physical components under Advanced
  // timing; public Advanced/Homeworld starts remain independently gated.
  g.advanced = true;
  g = enterRevival(g);
  const card = hold(g, 'tleilaxu', 'karama');
  g = applyAction(g, 'fremen', { type: 'revive', amount: 1, elite: 0 });
  assert.equal(g.decision?.kind, 'revivalStop');
  const before = reload(g);
  assert.match(
    viewGame(g, 'tleilaxu').revival.specialKaramaBlock!,
    /revival-overlap ruling/,
  );
  rejected(g, 'tleilaxu', { type: 'card', card, mode: 'special' });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(g), 'tleilaxu');
    view.players.find((player) => player.id === 'tleilaxu')!.bot = difficulty;
    const candidates = botActions(view);
    assert.deepEqual(candidates, [{ type: 'decision', decline: true }]);
    const allowed = applyAction(reload(g), 'tleilaxu', candidates[0]);
    assert.equal(p(allowed, 'fremen').reserves, 3);
    assert.equal(p(allowed, 'fremen').tanks, 11);
    assert.equal(p(allowed, 'tleilaxu').specialKaramaUsed ?? false, false);
    assert.ok(p(allowed, 'tleilaxu').hand.some((held) => held.id === card));
    assert.equal(
      viewGame(allowed, 'tleilaxu').revival.specialKaramaBlock,
      null,
    );
    inventory(allowed);
  }
  assert.deepEqual(g, before);
});
