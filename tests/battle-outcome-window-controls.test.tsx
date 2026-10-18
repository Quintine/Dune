import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleOutcomeWindowControls } from '../components/battle-outcome-window';
import { createBattleOutcomeWindow, readyBattleOutcomeWindow, reviseBattleOutcomeWindow } from '../game/battle-outcome-window';

const identity = { event: 'original-public-battle', attacker: 'a', defender: 'd', turn: 2 };
type Props = Parameters<typeof BattleOutcomeWindowControls>[0];
function props(onReady: (event: string) => void): Props {
  return { window: createBattleOutcomeWindow(identity, 0), me: 'a', busy: false, onReady,
    players: [{ id: 'a', name: 'Atreides player' }, { id: 'd', name: 'Richese player' }, { id: 'spectator', name: 'Observer' }] };
}
const markup = (value: Props) => renderToStaticMarkup(createElement(BattleOutcomeWindowControls, value));
function readyButton(value: Props): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> | null {
  const panel = BattleOutcomeWindowControls(value);
  const children = panel.props.children as (ReactElement<ButtonHTMLAttributes<HTMLButtonElement>> | false)[];
  return children.find(child => child && child.props.children === 'Finish final battle actions') || null;
}
const click = (value: Props) => readyButton(value)?.props.onClick?.({} as MouseEvent<HTMLButtonElement>);

void test('final battle controls persist public guidance and status until both players finish, with no automatic acknowledgement', () => {
  const sent: string[] = [], value = props(event => sent.push(event));
  const html = markup(value);
  assert.match(html, /aria-label="Final battle actions"/);
  assert.match(html, /<h3>Final battle actions<\/h3>/);
  assert.match(html, /Play any optional final battle card you want to use, then finish/);
  assert.match(html, /Battle resolution waits for both players/);
  assert.match(html, /Juice of Sapho changes the aggressor, both finished marks are cleared/);
  assert.match(html, /Atreides player: Choosing final actions/);
  assert.match(html, /Richese player: Choosing final actions/);
  assert.doesNotMatch(html, /autofocus|role="dialog"|role="alertdialog"/i);
  assert.deepEqual(sent, []);
  assert.equal(readyButton(value)!.props.disabled, false);
  click(value);
  assert.deepEqual(sent, [value.window.event]);
});

void test('busy, already finished and closed final battle controls cannot submit through their callback', () => {
  const sent: string[] = [], value = props(event => sent.push(event));
  const one = readyBattleOutcomeWindow(value.window, identity, 0, 'a', value.window.event);
  const both = readyBattleOutcomeWindow(one, identity, 0, 'd', one.event);
  for (const blocked of [{ ...value, busy: true }, { ...value, window: one }, { ...value, window: both }]) {
    assert.match(markup(blocked), /<button\b[^>]*\sdisabled=""[^>]*>Finish final battle actions/);
    click(blocked);
  }
  assert.deepEqual(sent, []);
  const defender = { ...value, me: 'd', window: one };
  assert.match(markup(defender), /Atreides player: Finished/);
  assert.equal(readyButton(defender)!.props.disabled, false);
  click(defender);
  assert.deepEqual(sent, [one.event]);
});

void test('a public Sapho revision renders fresh marks and sends only the new event', () => {
  const sent: string[] = [], value = props(event => sent.push(event));
  const one = readyBattleOutcomeWindow(value.window, identity, 0, 'a', value.window.event);
  const revised = { ...value, window: reviseBattleOutcomeWindow(one, identity, 0, 1) };
  const html = markup(revised);
  assert.equal((html.match(/Choosing final actions/g) ?? []).length, 2);
  assert.doesNotMatch(html, /: Finished/);
  assert.notEqual(revised.window.event, one.event);
  click(revised);
  assert.deepEqual(sent, [revised.window.event]);
});

void test('noncombatants see the same public participant status without a finish action', () => {
  const sent: string[] = [], value = { ...props(event => sent.push(event)), me: 'spectator' };
  const html = markup(value);
  assert.match(html, /Atreides player: Choosing final actions/);
  assert.match(html, /Richese player: Choosing final actions/);
  assert.doesNotMatch(html, /<button/);
  assert.equal(readyButton(value), null);
  click(value);
  assert.deepEqual(sent, []);
});
