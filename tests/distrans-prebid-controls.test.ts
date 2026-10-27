import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DistransTransferAction, type DistransTransferActionProps } from '../components/distrans-transfer-action';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { richeseCards } from '../game/richese-cards';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { Distrans } = await import('../components/distrans');
aliases.deregister();

// Controlled entitled projections supplement the separate native pre-bid sources.
// No authoritative hand, auction, payment or rule result is installed in a Game.
// React renders the stateful wrapper; only the hook-free action leaf is called
// directly to exercise its actual callback.
function projected(advanced = false): GameView {
  const game = createGame('DISTRANSPREBIDCONTROLS', newPlayer('d', 'Donor', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('t', 'Target', 'atreides'));
  joinGame(game, newPlayer('o', 'Other player', 'emperor'));
  const view = viewGame(game, 'd');
  const card = richeseCards().find(candidate => candidate.effect === 'distrans');
  const given = baseDeck().find(candidate => candidate.kind === 'shield');
  const other = baseDeck().find(candidate => candidate.kind === 'projectile');
  assert.ok(card && given && other);
  view.status = 'playing'; view.phase = 3; view.active = 't';
  view.auction = { bid: 0, bidder: null, active: 't', remaining: 2, card: null, inspectionBlocked: null };
  view.distrans = {
    card, blocked: null,
    choices: [
      { recipient: 't', blocked: null, cards: [given, other], unavailable: [] },
      { recipient: 'o', blocked: null, cards: [other, given], unavailable: [] },
    ],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(Distrans, { game, busy, act() {} }));
}
function transferButton(html: string) {
  const button = html.match(/<button\b(?=[^>]*data-testid="distrans-transfer")[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(button, 'The projected transfer action is present');
  return button;
}
function propsFor(game: GameView, recipient = 't', index = 0): DistransTransferActionProps {
  const distrans = game.distrans!;
  const choice = distrans.choices.find(candidate => candidate.recipient === recipient);
  return {
    card: distrans.card,
    recipient: choice ? { id: choice.recipient, name: game.players.find(player => player.id === choice.recipient)?.name } : undefined,
    given: choice?.cards[index], reason: distrans.blocked ?? choice?.blocked ?? null,
    reasonId: 'controlled-distrans-reason', busy: false, act() {},
  };
}
function click(props: DistransTransferActionProps): Action[] {
  const actions: Action[] = [];
  const button = DistransTransferAction({ ...props, act(action) { actions.push(action); } });
  button.props.onClick();
  return actions;
}

void test('an entitled untouched ordinary lot keeps the transfer enabled in Basic and Advanced projections', () => {
  for (const advanced of [false, true]) {
    const game = projected(advanced), before = structuredClone(game);
    const html = markup(game);
    assert.doesNotMatch(transferButton(html), /\sdisabled=/);
    assert.match(transferButton(html), /Give Shield to Target and discard Distrans/);
    assert.equal((html.match(/<select\b/g) ?? []).length, 2);
    assert.match(html, /<label[^>]*>Recipient<\/label>/);
    assert.match(html, /<label[^>]*>Your card to transfer<\/label>/);
    assert.match(html, /aria-label="Inspect card: Distrans"/);
    assert.match(html, /aria-label="Inspect card: Shield"/);
    assert.deepEqual(click(propsFor(game)), [{ type: 'card', card: game.distrans!.card.id, target: 't', give: game.distrans!.choices[0].cards[0].id }]);
    assert.deepEqual(game, before);
  }
});

void test('live bid, pass-only and started special-auction blocks come from the authoritative projection', () => {
  for (const context of ['live bid', 'pass-only lot', 'started special auction']) {
    const game = projected();
    const reason = `Controlled ${context}: Distrans is unavailable until this lot resolves.`;
    if (context === 'live bid') { game.auction!.bid = 2; game.auction!.bidder = 't'; }
    // A pass-only lot has the same public zero-bid descriptor as an untouched
    // lot. The controls must follow the private projection rather than guess.
    game.distrans!.blocked = reason;
    for (const choice of game.distrans!.choices) {
      choice.blocked = reason;
      choice.unavailable = choice.cards.map(card => ({ card, reason }));
      choice.cards = [];
    }
    const html = markup(game), button = transferButton(html);
    assert.match(button, /\sdisabled=/);
    assert.ok(html.includes(reason));
    const reasonId = button.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(reasonId);
    assert.ok(html.includes(`<p id="${reasonId}" class="notice">${reason}</p>`));
    assert.deepEqual(click(propsFor(game)), []);
  }
});

void test('each actual leaf callback sends exactly its offered recipient and physical card', () => {
  const game = projected(), before = structuredClone(game);
  for (const choice of game.distrans!.choices) for (let index = 0; index < choice.cards.length; index++) {
    const actions = click(propsFor(game, choice.recipient, index));
    assert.deepEqual(actions, [{ type: 'card', card: game.distrans!.card.id, target: choice.recipient, give: choice.cards[index].id }]);
    assert.deepEqual(Object.keys(actions[0]).sort(), ['card', 'give', 'target', 'type']);
  }
  assert.deepEqual(click(propsFor(game, 'not-offered')), []);
  assert.deepEqual(game, before);
});

void test('busy, missing recipient and missing card guard the actual callback and disabled control', () => {
  const game = projected(), available = propsFor(game);
  assert.match(transferButton(markup(game, true)), /\sdisabled=/);
  for (const props of [
    { ...available, busy: true },
    { ...available, recipient: undefined },
    { ...available, given: undefined },
    { ...available, reason: 'This transfer is currently blocked.' },
  ]) {
    assert.deepEqual(click(props), []);
    const html = renderToStaticMarkup(createElement(DistransTransferAction, props));
    assert.match(transferButton(html), /\sdisabled=/);
  }
  game.distrans!.choices = [];
  assert.match(markup(game), /No recipient is available/);
  assert.match(transferButton(markup(game)), /\sdisabled=/);
  const noCards = projected(); noCards.distrans!.choices.forEach(choice => { choice.cards = []; });
  assert.match(markup(noCards), /No other card is available to transfer to this player/);
  assert.match(transferButton(markup(noCards)), /\sdisabled=/);
  noCards.distrans = null;
  assert.equal(markup(noCards), '');
});

void test('projected recipient and card reservations retain fallback selection, private reasons and inspection', () => {
  const game = projected(), first = game.distrans!.choices[0];
  first.blocked = 'The recipient has no free slot.';
  first.cards = [];
  let html = markup(game);
  assert.match(transferButton(html), /to Other player and discard Distrans/);
  assert.doesNotMatch(transferButton(html), /\sdisabled=/);
  assert.match(html, /Target — unavailable/);
  const choice = game.distrans!.choices[1], reserved = choice.cards.pop()!;
  choice.unavailable = [{ card: reserved, reason: 'Your Shield is committed to the current sealed plan.' }];
  html = markup(game);
  assert.match(html, /Your cards unavailable for this transfer/);
  assert.match(html, /Your Shield is committed to the current sealed plan/);
  assert.match(html, /aria-label="Inspect card: Shield"/);
  assert.doesNotMatch(transferButton(html), /Give Shield/);
  assert.deepEqual(click(propsFor(game, 't')), []);
});

void test('brief provisional timing guidance stays visible without an extra confirmation flow', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /aria-label="Provisional Distrans bid timing"/);
    assert.match(html, /Provisional bid timing: you may transfer before the first bid or pass on an ordinary, Once Around or normal Black Market lot/);
    assert.match(html, /before the first sealed submission in a Silent lot/);
    assert.match(html, /Once that bidding has begun, the lot stays blocked while unresolved/);
    assert.match(html, /No spice is paid/);
    assert.match(html, /without a recipient confirmation or Karama response/);
    assert.doesNotMatch(html, /Confirm transfer|Accept transfer|Acknowledge|countdown/);
  }
});

void test('the panel and actual transfer action never read private hands, capacity or auction internals', () => {
  const game = projected();
  Object.defineProperty(game, 'auction', { get() { throw Error('Distrans controls recreated auction timing'); } });
  for (const field of ['richeseAuction', 'discard', 'decision', 'response', 'truthtrance'])
    Object.defineProperty(game, field, { get() { throw Error(`Distrans controls read unrelated state ${field}`); } });
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'leaders', 'forces', 'handLimit'])
    Object.defineProperty(player, field, { get() { throw Error(`Distrans controls read private or capacity field ${field}`); } });
  assert.doesNotMatch(transferButton(markup(game)), /\sdisabled=/);
  assert.deepEqual(click(propsFor(game)), [{ type: 'card', card: game.distrans!.card.id, target: 't', give: game.distrans!.choices[0].cards[0].id }]);
});
