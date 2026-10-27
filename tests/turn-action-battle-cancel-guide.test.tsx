import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionGuideButton } from '../components/turn-action-promises';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

/** Controlled projected quote tests callback fencing, not battle legality. */
function projection(kind: 'voice' | 'prescience') {
  const game = createGame('TURNCANCELGUIDE', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(game, newPlayer('a', 'Declarer', kind === 'voice' ? 'beneGesserit' : 'atreides'));
  joinGame(game, newPlayer('r', 'Other', 'harkonnen'));
  const view = viewGame(game, 'p');
  view.status = 'playing'; view.turn = 2; view.phase = 6;
  view.response = { kind, owner: 'a', passed: [] };
  view.battle = { event: 'controlled-battle', territory: 'arrakeen', attacker: 'a', defender: 'p', revealed: false,
    submitted: [], traitorVoters: ['p', 'a'], traitorSubmitted: [], plans: {}, truthPromises: [],
  } as unknown as NonNullable<GameView['battle']>;
  const card = baseDeck().find(item => item.kind === 'special' && item.effect === 'karama'); assert.ok(card);
  const physical = { ...card, id: 'private-physical-karama' };
  view.players.find(player => player.id === 'p')!.hand = [physical];
  view.responseControls = { cancelCards: [physical.id], hasPassed: false };
  const event = 'controlled-truth-promise';
  const source = JSON.stringify(['karamaBattleCancel', 2, 'controlled-battle', 'arrakeen', kind, 'a']);
  view.turnActionPromises = [{ event, player: 'p', asker: 'a', turn: 2,
    mixed: { kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaBattleCancel', source } },
    answer: true, fulfilled: false, released: false }];
  const action: Action = { type: 'card', card: physical.id, mode: 'cancel',
    turnActionPromiseEvent: event, turnActionPromisePhase: 6 };
  view.turnActionGuide = { event, action };
  return { view, action };
}

for (const kind of ['voice', 'prescience'] as const) {
  void test(`human guide submits only the quoted printed Karama for current ${kind}`, () => {
    const { view, action } = projection(kind), sent: Action[] = [];
    const props = { game: view, busy: false, act: (next: Action) => sent.push(next) };
    const button = TurnActionGuideButton(props); assert.ok(button); assert.equal(button.props.disabled, false);
    const html = renderToStaticMarkup(createElement(TurnActionGuideButton, props));
    assert.match(html, kind === 'voice' ? /cancel this Voice/ : /cancel this Prescience/);
    assert.doesNotMatch(html, /private-physical-karama/);
    button.props.onClick(); assert.deepEqual(sent, [action]);
  });
}

void test('stale battle response or changed native cancellation quote prevents guide dispatch', () => {
  for (const mutate of [
    (view: GameView) => { view.response = null; },
    (view: GameView) => { view.response = { kind: 'prescience', owner: 'a', passed: [] }; },
    (view: GameView) => { view.responseControls!.cancelCards = []; },
    (view: GameView) => { view.battle!.event = 'another-battle'; },
  ]) {
    const { view } = projection('voice'), sent: Action[] = [];
    const button = TurnActionGuideButton({ game: view, busy: false, act: action => sent.push(action) });
    assert.ok(button); assert.equal(button.props.disabled, false);
    mutate(view); button.props.onClick(); assert.deepEqual(sent, []);
  }
});

void test('guide excludes non-printed cards and unavailable native quotes', () => {
  for (const mutate of [
    (view: GameView) => { view.responseControls!.cancelCards = []; },
    (view: GameView) => { view.players.find(player => player.id === 'p')!.hand![0].kind = 'worthless'; },
    (view: GameView) => { view.turnActionGuide!.action.mode = 'shipment'; },
  ]) {
    const { view } = projection('voice'); mutate(view);
    const button = TurnActionGuideButton({ game: view, busy: false, act() {} });
    assert.ok(button); assert.equal(button.props.disabled, true);
  }
});
