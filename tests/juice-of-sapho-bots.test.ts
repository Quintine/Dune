import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import {
  cardPresentation,
  richeseCardActionBlock,
} from '../game/card-presentation';
const SAPHO = 'richese-juice-of-sapho';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(holder = 'e') {
  const g = createGame('SAPHOBOTS', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    order: ['e', 'h', 'r'],
    playerPositions: { e: 1, h: 3, r: 6 },
    storm: 18,
    deck: baseDeck(),
    richeseCache: richeseCards(),
    richeseRemoved: [],
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  const index = g.richeseCache!.findIndex((c) => c.id === SAPHO);
  player(g, holder).hand.push(g.richeseCache!.splice(index, 1)[0]);
  return g;
}
function ready(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function auction(holder = 'e', method: 'onceAround' | 'silent' = 'onceAround') {
  let g = ready(fixture(holder));
  assert.equal(g.decision?.kind, 'richeseDeclaration');
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    position: 'first',
  });
  return applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: g.richeseCache![0].id,
    method,
    direction: 'counterclockwise',
  });
}
function movement(holder = 'h', advanced = false) {
  let g = fixture(holder);
  g.phase = 4;
  g.advanced = advanced;
  g = ready(g);
  assert.equal(g.phase, 5);
  return g;
}
function actions(g: Game, id: string, level: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = level;
  const before = structuredClone(view),
    proposals = botActions(view);
  assert.deepEqual(
    view,
    before,
    'AI must leave its personalized projection unchanged',
  );
  for (const a of proposals)
    assert.doesNotThrow(
      () => applyAction(JSON.parse(JSON.stringify(g)), id, a),
      JSON.stringify(a),
    );
  return proposals;
}
function use(
  g: Game,
  id: string,
  level: Difficulty,
  scope: string,
  mode: string,
) {
  const candidates = actions(g, id, level);
  assert.equal(candidates.length, 1);
  const action = candidates[0];
  assert.equal(action.card, SAPHO);
  assert.equal(action.scope, scope);
  assert.equal(action.mode, mode);
  const next = applyAction(g, id, action);
  assert.equal(
    player(next, id).hand.some((c) => c.id === SAPHO),
    false,
  );
  assert.equal(next.discard.filter((c) => c.id === SAPHO).length, 1);
  assert.deepEqual(viewGame(next, id).saphoOptions, []);
  assert.ok(actions(next, id, level).every((a) => a.card !== SAPHO));
  assert.throws(() => applyAction(next, id, action));
  return next;
}

void test('all four profiles use Once Around last, discard once and finish actual bidding without another opportunity', () => {
  for (const level of DIFFICULTIES) {
    const start = auction();
    assert.equal(start.richeseAuction!.active, 'e');
    let g = use(start, 'e', level, 'onceAround', 'last');
    assert.deepEqual(g.richeseAuction!.order, ['h', 'r', 'e']);
    const event = g.richeseAuction!.event;
    for (
      let n = 0;
      n < 5 && g.richeseAuction?.event === event && !g.richeseAuction.outcome;
      n++
    ) {
      const id = g.richeseAuction.active!;
      const proposal = actions(g, id, level)[0];
      assert.ok(proposal);
      g = applyAction(g, id, proposal);
    }
    assert.ok(g.richeseAuction?.event !== event || g.richeseAuction.outcome);
    assert.equal(g.discard.filter((c) => c.id === SAPHO).length, 1);
  }
});
void test('all four profiles can choose the sole first option before a Once Around lot begins', () => {
  for (const level of DIFFICULTIES) {
    const start = auction('r');
    assert.deepEqual(
      viewGame(start, 'r').saphoOptions.map((o) => o.mode),
      ['first'],
    );
    const g = use(start, 'r', level, 'onceAround', 'first');
    assert.equal(g.richeseAuction!.active, 'r');
    assert.deepEqual(g.richeseAuction!.acted, []);
  }
});
void test('all four profiles use public movement options in both directions and preserve completed turn bookkeeping', () => {
  for (const level of DIFFICULTIES)
    for (const early of [false, true]) {
      const start = movement();
      if (early) start.spice = { 'hagga_basin:8': 6 };
      const g = use(start, 'h', level, 'movement', early ? 'first' : 'last');
      assert.deepEqual(g.order, start.order);
      assert.equal(
        early ? g.movementRemaining![0] : g.movementRemaining!.at(-1),
        'h',
      );
      for (const p of g.players) {
        assert.equal(p.shipped, false);
        assert.equal(p.moved, 0);
        assert.equal(p.reserves, 20);
      }
      assert.equal(g.active, early ? 'h' : 'e');
    }
});
void test('with no derived option AI never invents Sapho in Silent bidding, after acting, or another phase', () => {
  for (const level of DIFFICULTIES) {
    const silent = auction('e', 'silent');
    assert.deepEqual(viewGame(silent, 'e').saphoOptions, []);
    assert.ok(actions(silent, 'e', level).every((a) => a.card !== SAPHO));
    let acted = auction();
    acted = applyAction(acted, 'e', {
      type: 'richeseBid',
      event: acted.richeseAuction!.event,
      amount: 1,
    });
    assert.deepEqual(viewGame(acted, 'e').saphoOptions, []);
    assert.ok(actions(acted, 'e', level).every((a) => a.card !== SAPHO));
    const other = fixture();
    assert.deepEqual(viewGame(other, 'e').saphoOptions, []);
    assert.ok(actions(other, 'e', level).every((a) => a.card !== SAPHO));
  }
});
void test('private opposing balances, hands and sealed bids cannot change the owner timing policy', () => {
  for (const level of DIFFICULTIES) {
    for (const start of [auction(), movement('e')]) {
      const changed = structuredClone(start);
      player(changed, 'h').hand = changed.deck.splice(0, 2);
      player(changed, 'h').spice = 999;
      const before = viewGame(start, 'e'),
        after = viewGame(changed, 'e');
      assert.deepEqual(before.saphoOptions, after.saphoOptions);
      assert.deepEqual(
        actions(start, 'e', level),
        actions(changed, 'e', level),
      );
      assert.deepEqual(viewGame(changed, 'h').saphoOptions, []);
    }
    const start = auction('e', 'silent'),
      changed = structuredClone(start);
    // Rival sealed bids remain private; no Sapho action should appear in either view.
    const first = applyAction(start, 'h', {
      type: 'richeseBid',
      event: start.richeseAuction!.event,
      amount: 1,
    });
    const second = applyAction(changed, 'h', {
      type: 'richeseBid',
      event: changed.richeseAuction!.event,
      amount: 2,
    });
    assert.deepEqual(actions(first, 'e', level), actions(second, 'e', level));
  }
});
void test('Sapho presentation directs players to the bounded controls and explicitly identifies unfinished modes', () => {
  const card = richeseCards().find((c) => c.id === SAPHO)!;
  assert.match(richeseCardActionBlock(card)!, /Juice of Sapho panel/);
  const presentation = cardPresentation(card);
  assert.match(presentation.availability!, /Once Around first/);
  assert.match(presentation.availability!, /Battle aggressor.*unfinished/);
  assert.match(presentation.gameplay!.join(' '), /Discard Juice of Sapho/);
  assert.equal(richeseCardActionBlock({ ...card, id: 'forged' }), null);
});
