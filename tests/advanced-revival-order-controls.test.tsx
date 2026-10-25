import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevivalTurn, FinishRevivalTurn, finishRevivalTurnBlocked, revivalTurnOrderBlock } from '../components/revival-turn';
import { RevivalCommerce } from '../components/revival-commerce';
import { viewGame, type Action, type GameView } from '../game/engine';
import { createAdvancedRevivalOrderFixture, actAdvancedRevivalOrder } from './fixture-advanced-revival-order';

let original: ReturnType<typeof createAdvancedRevivalOrderFixture> | undefined;
function native() {
  original ??= createAdvancedRevivalOrderFixture();
  return { ...original, game: structuredClone(original.game) };
}
function projected() {
  const source = native();
  return viewGame(source.game, source.actor);
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(RevivalTurn, { game, busy, act() {} }));
}
function commerce(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(RevivalCommerce, { game, busy, act() {} }));
}
function button(html: string, label: string) {
  const found = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0])
    .find(value => value.includes(`>${label}</button>`));
  assert.ok(found, `The ${label} button is visible`); return found;
}
function click(game: GameView, busy = false): Action[] {
  const actions: Action[] = [];
  FinishRevivalTurn({ game, busy, act(action) { actions.push(action); } }).props.onClick();
  return actions;
}
function controlledCommerce(viewer: string, actor = viewer): GameView {
  const source = native(), game = viewGame(source.game, viewer);
  const originalOrder = [actor, ...game.players.map(player => player.id).filter(id => id !== actor)];
  // Controlled personalized order/leader/negotiation cases supplement the
  // native source below; they install no authoritative Game outcome or pieces.
  game.revivalOrder = { version: 1, turn: game.turn, original: originalOrder,
    remaining: [...originalOrder], completed: [], started: false };
  game.active = actor;
  game.revival.orderBlocked = actor === viewer ? null : 'Wait for the current Revival actor.';
  return game;
}

void test('native first Revival renders persistent actor remaining completed and explicit force/leader grouping', () => {
  const source = native(), game = viewGame(source.game, source.actor), before = structuredClone(game);
  assert.deepEqual(game.revivalOrder!.original, source.originalOrder);
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /aria-label="Revival turn order"/);
    assert.ok(html.includes(`Current Revival actor: ${game.players.find(player => player.id === source.actor)!.name}.`));
    assert.match(html, /Remaining Revival turns:/);
    assert.match(html, /Completed Revival turns: None yet/);
    for (const id of game.revivalOrder!.remaining) assert.ok(html.includes(game.players.find(player => player.id === id)!.name));
    assert.match(html, /aria-label="Provisional Revival grouping"/);
    assert.match(html, /force, leader and Kwisatz Haderach revival choices together/);
    assert.match(html, /Tleilaxu can still answer another player’s requests/);
    assert.doesNotMatch(button(html, 'Finish Revival turn'), /\sdisabled=/);
  }
  assert.deepEqual(game, before);
});

void test('the actual native Finish callback sends only ready and advances to the next original seat', () => {
  const source = native(), game = viewGame(source.game, source.actor);
  assert.deepEqual(click(game, true), []);
  const actions = click(game);
  assert.deepEqual(actions, [{ type: 'ready' }]);
  const next = actAdvancedRevivalOrder(source.game, source.actor, actions[0]);
  assert.equal(next.phase, 4);
  assert.deepEqual(next.revivalOrder!.completed, [source.actor]);
  assert.equal(next.active, next.revivalOrder!.remaining[0]);
  const finished = viewGame(next, source.actor);
  assert.match(markup(finished), /Your Revival turn is finished/);
  assert.match(button(markup(finished), 'Finish Revival turn'), /\sdisabled=/);
  assert.deepEqual(click(finished), []);
  assert.deepEqual(click(viewGame(next, next.active!)), [{ type: 'ready' }]);
});

void test('each native seat can explicitly finish once and the last actual control leaves Revival', () => {
  const source = native(); let game = source.game;
  const actors: string[] = [];
  while (game.phase === 4 && actors.length < source.originalOrder.length) {
    const actor = game.revivalOrder!.remaining[0];
    const actions = click(viewGame(game, actor));
    assert.deepEqual(actions, [{ type: 'ready' }]);
    actors.push(actor); game = actAdvancedRevivalOrder(game, actor, actions[0]);
  }
  assert.deepEqual(actors, source.originalOrder);
  assert.equal(game.phase, 5);
  assert.equal(markup(viewGame(game, source.owner)), '');
});

void test('genuine Basic and unstamped legacy Advanced views retain their existing controls without this component', () => {
  const basic = createAdvancedRevivalOrderFixture({ advanced: false });
  const basicView = viewGame(basic.game, basic.actor);
  assert.equal(basicView.revivalOrder, null);
  assert.equal(markup(basicView), '');
  assert.deepEqual(click(basicView), []);
  const legacy = projected(); legacy.revivalOrder = null;
  assert.equal(markup(legacy), ''); assert.deepEqual(click(legacy), []);
  assert.equal(revivalTurnOrderBlock(legacy), null);
});

void test('a different native viewer sees the current actor and a waiting reason while the actual callback is unavailable', () => {
  const source = native(), game = viewGame(source.game, source.outOfTurn);
  const html = markup(game);
  assert.match(html, /Current Revival actor:/);
  assert.ok(finishRevivalTurnBlocked(game));
  assert.match(button(html, 'Finish Revival turn'), /\sdisabled=/);
  assert.deepEqual(click(game), []);
  game.revival.orderBlocked = '';
  assert.deepEqual(click(game), [], 'Empty projected notices do not bypass the actual owner');
});

void test('busy finished and inconsistent current order projections guard the actual callback', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.revivalOrder!.completed.push(game.me); },
    game => { game.revivalOrder!.remaining = []; },
    game => { game.revivalOrder!.turn++; },
    game => { game.turn++; }, game => { game.phase = 5; },
    game => { game.status = 'finished'; }, game => { game.active = null; },
    game => { game.revival.orderBlocked = 'The current native turn is unavailable.'; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.deepEqual(click(game), []);
    assert.equal(FinishRevivalTurn({ game, busy: false, act() {} }).props.disabled, true);
  }
  assert.deepEqual(click(projected(), true), []);
  const finished = projected(); finished.revivalOrder!.remaining = [];
  assert.match(markup(finished), /All Revival turns are finished/);
});

void test('pending Revival response decision automatic action and owned autopilot prevent early finishing', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.response = { kind: 'revivalIncome', owner: game.me, passed: [] }; },
    game => { game.decision = { kind: 'revivalStop', player: game.me, recipient: game.me, revival: 'forces' }; },
    game => { game.truthtrance = {} as NonNullable<GameView['truthtrance']>; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.revival.pending = true; },
    game => { game.automaticContinuationPending = true; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.deepEqual(click(game), []);
    assert.match(button(markup(game), 'Finish Revival turn'), /\sdisabled=/);
  }
});

void test('a stale actual callback cannot finish another actor or a new Revival round', () => {
  for (const anotherRound of [false, true]) {
    const game = projected(), actions: Action[] = [];
    const leaf = FinishRevivalTurn({ game, busy: false, act(action) { actions.push(action); } });
    assert.equal(leaf.props.disabled, false);
    if (anotherRound) { game.turn++; game.revivalOrder!.turn++; }
    else {
      game.revivalOrder!.completed.push(game.me); game.revivalOrder!.remaining.shift();
      game.active = game.revivalOrder!.remaining[0];
    }
    leaf.props.onClick(); assert.deepEqual(actions, []);
  }
});

void test('an unaccepted negotiated request does not remove the current explicit Finish choice', () => {
  const game = projected();
  game.revivalRequests[game.me] = { leader: game.players.find(player => player.id === game.me)!.leaders[0].id, price: null };
  assert.deepEqual(click(game), [{ type: 'ready' }]);
  assert.doesNotMatch(button(markup(game), 'Finish Revival turn'), /\sdisabled=/);
});

void test('controlled native request accept and withdrawal controls follow own turn without disabling the entire commerce panel', () => {
  const source = native();
  for (const ownsTurn of [true, false]) {
    const game = controlledCommerce(source.owner, ownsTurn ? source.owner : source.responder);
    const me = game.players.find(player => player.id === game.me)!;
    me.spice = 50; me.leaders[0].dead = true;
    game.revivalRequests[game.me] = { leader: me.leaders[0].id, price: 2 };
    const html = commerce(game);
    for (const label of ['Accept revival price', 'Withdraw request']) {
      if (ownsTurn) assert.doesNotMatch(button(html, label), /\sdisabled=/);
      else assert.match(button(html, label), /\sdisabled=/);
    }
    delete game.revivalRequests[game.me];
    const request = commerce(game);
    const selector = request.match(/<select\b[^>]*id="revival-request-leader"[^>]*>/)?.[0];
    assert.ok(selector);
    if (ownsTurn) assert.doesNotMatch(selector, /\sdisabled=/);
    else assert.match(selector, /\sdisabled=/);
  }
});

void test('controlled out-of-turn Tleilaxu can quote decline and support others while their own foreign ghola remains unavailable', () => {
  const source = native();
  for (const ownsTurn of [true, false]) {
    const game = controlledCommerce(source.responder, ownsTurn ? source.responder : source.owner);
    const me = game.players.find(player => player.id === game.me)!;
    const other = game.players.find(player => player.id === source.owner)!;
    me.spice = 50; me.leaders[0].dead = true; me.ally = other.id; other.leaders[0].dead = true;
    game.revivalRules.expanded = []; game.revivalRules.limitBlocked = false;
    game.revivalRules.discountBlocked = false; game.revivalRules.allyDiscount = null;
    game.revivalRequests[other.id] = { leader: other.leaders[0].id, price: null };
    const html = commerce(game);
    const ghola = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]).find(value => value.includes('as a ghola'));
    assert.ok(ghola);
    if (ownsTurn) assert.doesNotMatch(ghola, /\sdisabled=/);
    else assert.match(ghola, /\sdisabled=/);
    for (const label of ['Quote this price', 'Decline request', 'Allow five revivals', 'Offer ally half-price revival'])
      assert.doesNotMatch(button(html, label), /\sdisabled=/);
    for (const label of ['Quote this price', 'Decline request', 'Allow five revivals', 'Offer ally half-price revival'])
      assert.match(button(commerce(game, true), label), /\sdisabled=/);
  }
});

void test('the order display and actual Finish callback read only public order actor names and owned action availability', () => {
  const game = projected();
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'reserves', 'leaders', 'forces', 'tanks'])
    Object.defineProperty(player, field, { get() { throw Error(`Revival order read unrelated ${player.id}.${field}`); } });
  for (const field of ['homeworlds', 'revivalRequests', 'allLeaders'])
    Object.defineProperty(game, field, { get() { throw Error(`Revival order read unrelated ${field}`); } });
  assert.match(markup(game), /Current Revival actor:/);
  assert.deepEqual(click(game), [{ type: 'ready' }]);
});
