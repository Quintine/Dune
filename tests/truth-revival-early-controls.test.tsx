import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevivalPromises, RevivalPromiseGuideButton } from '../components/revival-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { createTechTokens } from '../game/tech-tokens';
import {
  actTruthRevivalEarly, advanceTruthRevivalEarly, bindTruthRevivalEarly, completeTruthRevivalEarly,
  createTruthRevivalEarlyFixture, settleTruthRevivalEarly, truthRevivalEarlyClean, truthRevivalEarlyInventory,
} from './fixture-truth-revival-early';

type Props = Parameters<typeof RevivalPromiseGuideButton>[0];
function guide(props: Props) { const button = RevivalPromiseGuideButton(props); assert.ok(button); return button; }
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(RevivalPromises, { game, busy, send() {} }));

/** Controlled personalized preparation quotes only. The native source below
 * separately earns its Tanks, Truthtrance answer and preparation journey. */
function projected(phase: number, type: 'charity' | 'ready' | 'passBid' | 'decision' = 'charity'): GameView {
  const source = createGame('EARLYREVIVALCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.ready = [];
  game.revivalPromises = [{ event: 'early-revival-event', player: 'p', asker: 'a', turn: 2,
    counter: 'total', minimum: 3, answer: true, progress: 0 }];
  game.auction = phase === 3 ? { bid: 7, bidder: type === 'decision' ? 'p' : 'a', active: type === 'decision' ? 'a' : 'p',
    remaining: 2, inspectionBlocked: null, card: null } : null;
  game.decision = type === 'decision' ? { kind: 'auctionPayment', player: 'p' } : null;
  game.revivalPromiseGuide = { phase, action: { type, revivalPromiseEvent: 'early-revival-event',
    ...(type === 'decision' ? { karama: true, card: 'original-projected-karama' } : {}) } };
  return game;
}

void test('early Revival guidance stays visible in quiet Storm and Spice without inventing an immediate action', () => {
  for (const phase of [0, 1]) {
    const game = projected(phase); game.revivalPromiseGuide = null;
    const html = markup(game);
    assert.match(html, /Your Revival promises/); assert.match(html, /Your Revival opportunity is still ahead/);
    assert.match(html, /continue the current phase and keep the required spice and forces available/);
    assert.match(html, /These steps preserve your later Revival; they do not count as returned forces/);
    assert.equal(RevivalPromiseGuideButton({ game, busy: false, send() {} }), null);
    // Even a stale supplied preparation cannot create a Storm/Spice action.
    game.revivalPromiseGuide = { phase, action: { type: 'ready', revivalPromiseEvent: 'early-revival-event' } };
    const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, []);
  }
});

void test('actual phase-two Charity and Ready callbacks forward the current preparation quote and preserve zero return progress', () => {
  for (const type of ['charity', 'ready'] as const) {
    const game = projected(2, type), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalPromiseGuide!.action]); assert.equal(sent[0], game.revivalPromiseGuide!.action);
    assert.equal(game.revivalPromises[0].progress, 0);
    assert.match(markup(game), type === 'charity' ? /Claim Charity for your later Revival/ : /Finish Charity while preserving your Revival answers/);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
    game.ready = ['p']; press(button); assert.equal(sent.length, 1);
  }
});

void test('actual phase-three pass and owned auction-payment callbacks retain original funding and Karama packets', () => {
  for (const type of ['passBid', 'decision'] as const) {
    const game = projected(3, type), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalPromiseGuide!.action]); assert.equal(sent[0], game.revivalPromiseGuide!.action);
    assert.equal(game.revivalPromises[0].progress, 0);
    if (type === 'decision') {
      assert.equal(game.auction!.active, 'a', 'The owned payment decision, rather than the next bidder, owns this action.');
      assert.equal(sent[0].card, 'original-projected-karama'); assert.equal(sent[0].karama, true);
      assert.match(markup(game), /Use the quoted Karama auction payment for your later Revival/);
      assert.doesNotMatch(markup(game), /original-projected-karama/);
    } else assert.match(markup(game), /Pass this bid while preserving your Revival answers/);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
  const paid = projected(3, 'decision'); paid.revivalPromiseGuide!.action = {
    type: 'decision', karama: false, revivalPromiseEvent: 'early-revival-event',
  };
  assert.match(markup(paid), /Pay the current auction price while preserving your Revival answers/);
});

void test('early guide callbacks reject changed phase, actor, parent payment, event, quote and interrupted windows', () => {
  const common: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; },
    game => { game.revivalPromiseGuide!.phase = 4; },
    game => { game.revivalPromiseGuide = { phase: game.phase, action: { ...game.revivalPromiseGuide!.action } }; },
    game => { game.revivalPromiseGuide = null; }, game => { game.revivalPromises[0].event = 'expired'; },
    game => { game.revivalPromises[0].fulfilled = true; }, game => { game.revivalPromises[0].released = true; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const type of ['passBid', 'decision'] as const) {
    const specific: ((game: GameView) => void)[] = type === 'decision' ? [
      game => { game.decision = null; }, game => { game.decision = { kind: 'auctionPayment', player: 'a' }; },
      game => { game.decision = { kind: 'revivalStop', player: 'p', recipient: 'a', revival: 'forces' }; },
      game => { game.revivalPromiseGuide!.action.card = 'another-card'; },
    ] : [game => { game.auction!.active = 'a'; }, game => { game.decision = { kind: 'auctionPayment', player: 'p' }; }];
    for (const change of [...common, ...specific]) {
      const game = projected(3, type), sent: Action[] = [];
      const props = { game, busy: false, send(action: Action) { sent.push(action); } };
      const button = guide(props); change(game); press(button); assert.deepEqual(sent, []);
    }
  }
  const props = { game: projected(2), busy: false, send() { assert.fail('A now-busy preparation cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
  for (const [phase, type] of [[2, 'passBid'], [2, 'decision'], [3, 'ready']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
});

void test('preparation guidance never opens private holdings or the unrevealed original auction card', () => {
  for (const type of ['passBid', 'decision'] as const) {
    const game = projected(3, type), sent: Action[] = [];
    for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'tanks', 'reserves'])
      Object.defineProperty(seat, key, { get() { throw Error(`No unneeded private ${key}`); }, configurable: true });
    Object.defineProperty(game.auction!, 'card', { get() { throw Error('No unrevealed lot inspection'); } });
    assert.match(markup(game), /Your Revival promises/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, [game.revivalPromiseGuide!.action]);
  }
});

void test('genuine Basic and Advanced Charity-funded early answers follow actual Charity, pass and native-return callbacks', () => {
  for (const advanced of [false, true]) {
    const f = createTruthRevivalEarlyFixture({ advanced, phase: 2, poor: true });
    let game = bindTruthRevivalEarly(f).game;
    const dispatch = (phase: number, type: string) => {
      const view = viewGame(game, f.target), sent: Action[] = [], next = view.revivalPromiseGuide;
      assert.ok(next); assert.equal(next.phase, phase); assert.equal(next.action.type, type);
      press(guide({ game: view, busy: false, send(action) { sent.push(action); } }));
      assert.deepEqual(sent, [next.action]); game = actTruthRevivalEarly(game, f.target, sent[0]);
    };
    assert.match(markup(viewGame(game, f.target)), /Claim Charity for your later Revival/);
    dispatch(2, 'charity');
    assert.equal(game.players.find(player => player.id === f.target)!.spice, 2);
    assert.equal(game.revivalPromises!.find(promise => promise.player === f.target)!.progress, 0);
    dispatch(2, 'ready');
    game = advanceTruthRevivalEarly(game, state => state.phase === 3 && truthRevivalEarlyClean(state) && state.auction?.active === f.target);
    assert.match(markup(viewGame(game, f.target)), /Pass this bid while preserving your Revival answers/);
    dispatch(3, 'passBid');
    assert.equal(game.revivalPromises!.find(promise => promise.player === f.target)!.progress, 0);
    game = completeTruthRevivalEarly(f, game).game;
    dispatch(4, 'revive'); game = settleTruthRevivalEarly(game);
    const promise = game.revivalPromises!.find(promise => promise.player === f.target)!;
    assert.equal(promise.progress, 2); assert.equal(promise.fulfilled, true);
    assert.deepEqual(truthRevivalEarlyInventory(game), f.originalCards);
  }
});

void test('controlled native Richese zero/pass guides retain their event and owned opportunity without reading sealed bids', () => {
  for (const method of ['silent', 'onceAround'] as const) {
    const game = projected(3, 'passBid');
    const native = createRicheseAuction({ event: 'native-controlled-lot', cardId: 'controlled-card', owner: 'a',
      method, source: 'cache', eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
    game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
      ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
    game.revivalPromiseGuide = { phase: 3, action: { type: 'richeseBid', event: native.event,
      amount: method === 'silent' ? 0 : null, allyPayment: 0, revivalPromiseEvent: 'early-revival-event' } };
    const sent: Action[] = [], props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalPromiseGuide.action]);
    assert.match(markup(game), method === 'silent' ? /Submit zero in this Silent auction/ : /Pass this Richese bid/);
    game.richeseAuction.event = 'later-lot'; press(button); assert.equal(sent.length, 1);
    game.richeseAuction.event = native.event;
    if (method === 'silent') game.richeseAuction.submitted.push('p'); else game.richeseAuction.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
});
