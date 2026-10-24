import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemutaReaction } from '../components/semuta-reaction';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaGholaIncomeFixture, actSemutaGholaIncome as act,
  passSemutaGholaIncome, allowSemutaGholaIncome,
  semutaGholaIncomePlayer as player,
} from './fixture-semuta-ghola-income';

type Props = Parameters<typeof SemutaReaction>[0];
type Control = { children?: unknown; disabled?: boolean; onClick: () => void };
function controls(node: unknown): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...controls(props.children)];
}
const markup = (props: Props) => renderToStaticMarkup(createElement(SemutaReaction, props));
function click(game: Game, actor: string, label: 'Continue' | 'Commit Semuta Drug'): Action {
  const sent: Action[] = [], props = { game: viewGame(game, actor), busy: false,
    act: (action: Action) => { sent.push(action); } };
  const control = controls(SemutaReaction(props)).find(button => button.children === label);
  assert.ok(control, `The actual fresh discard offers ${label}`);
  assert.equal(control.disabled, false);
  assert.match(markup(props), /Fresh Treachery discard/);
  assert.match(markup(props), /Continue when you are ready/);
  const busy = controls(SemutaReaction({ ...props, busy: true })).find(button => button.children === label);
  assert.ok(busy); assert.equal(busy.disabled, true);
  busy.onClick(); assert.deepEqual(sent, [], 'Busy callbacks cannot commit or acknowledge');
  control.onClick(); assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], { type: label === 'Continue' ? 'semutaPass' : 'semutaCommit',
    event: props.game.semutaReaction!.event });
  return sent[0];
}
function parkedIncome(game: Game) {
  const continuation = game.pendingTreacheryDiscard?.continuation;
  assert.ok(continuation?.kind === 'ordinaryCardDiscard');
  assert.equal(continuation.effect, 'ghola');
  const income = continuation.resume.response;
  assert.ok(income?.kind === 'revivalIncome');
  return structuredClone(income);
}

void test('real Ghola Continue remains readable and leaves income parked until every other seat responds', () => {
  const f = createSemutaGholaIncomeFixture();
  const originalIncome = player(f.game, f.incomeOwner).spice;
  const reserves = player(f.game, f.owner).reserves;
  let game = act(f.game, f.owner, f.gholaAction);
  const income = parkedIncome(game), event = game.pendingTreacheryDiscard!.batch.event;
  assert.equal(player(game, f.owner).reserves, reserves + 1);
  assert.equal(player(game, f.owner).tanks, 0);
  assert.equal(player(game, f.incomeOwner).spice, originalIncome);
  assert.equal(game.response, null);
  const before = structuredClone(game);
  for (let reading = 0; reading < 2; reading++) {
    const html = markup({ game: viewGame(game, f.owner), busy: false, act() {} });
    assert.match(html, />Continue<\/button>/);
    assert.match(html, /Continue when you are ready/);
  }
  assert.deepEqual(game, before, 'Reading cannot acknowledge the card or allow native income');
  game = act(game, f.owner, click(game, f.owner, 'Continue'));
  assert.deepEqual(parkedIncome(game), income);
  assert.equal(game.pendingTreacheryDiscard!.batch.event, event);
  assert.equal(game.response, null);
  const waited = markup({ game: viewGame(game, f.owner), busy: false, act() {} });
  assert.match(waited, /You continued. Waiting for other seats/);
  assert.doesNotMatch(waited, /<button/);
  assert.equal(player(game, f.incomeOwner).spice, originalIncome);
  game = passSemutaGholaIncome(game);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.deepEqual(game.response, income);
  assert.equal(player(game, f.owner).reserves, reserves + 1);
  assert.equal(player(game, f.incomeOwner).spice, originalIncome);
  assert.equal(SemutaReaction({ game: viewGame(game, f.owner), busy: false, act() {} }), null);
});

for (const fullHand of [false, true]) {
  void test(`real Ghola Commit forwards its event and atomically claims the sole card${fullHand ? ' at a full hand' : ''} before income resumes`, () => {
    const f = createSemutaGholaIncomeFixture({ fullHand });
    const originalIncome = player(f.game, f.incomeOwner).spice;
    const reserves = player(f.game, f.owner).reserves;
    const handSize = player(f.game, f.claimant).hand.length;
    const allowances = [player(f.game, f.owner).revived, player(f.game, f.owner).freeForcesRevived,
      player(f.game, f.owner).leaderRevived];
    let game = act(f.game, f.owner, f.gholaAction);
    const income = parkedIncome(game);
    const props = { game: viewGame(game, f.claimant), busy: false, act() {} };
    assert.equal(props.game.semutaReaction!.canCommit, true);
    assert.match(markup(props), />Continue<\/button>/);
    assert.match(markup(props), />Commit Semuta Drug<\/button>/);
    const html = markup({ ...props, busy: true });
    assert.match(html, /disabled=""[^>]*>Continue<\/button>/);
    assert.match(html, /disabled=""[^>]*>Commit Semuta Drug<\/button>/);
    const action = click(game, f.claimant, 'Commit Semuta Drug');
    const before = structuredClone(game);
    assert.throws(() => act(game, f.claimant, { ...action, event: 'stale-ghola-discard' }));
    assert.deepEqual(game, before);
    game = act(game, f.claimant, action);
    // One actual eligible Ghola finishes immediately under the existing sole-
    // candidate rule. No artificial second card or selection stage is installed.
    assert.equal(game.pendingTreacheryDiscard, null);
    assert.deepEqual(game.response, income);
    assert.equal(player(game, f.claimant).hand.length, handSize);
    assert.equal(player(game, f.claimant).hand.some(card => card.id === f.ghola), true);
    assert.equal(player(game, f.claimant).hand.some(card => card.id === f.semuta), false);
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
    assert.equal(player(game, f.owner).reserves, reserves + 1);
    assert.equal(player(game, f.owner).tanks, 0);
    assert.deepEqual([player(game, f.owner).revived, player(game, f.owner).freeForcesRevived,
      player(game, f.owner).leaderRevived], allowances);
    assert.equal(player(game, f.incomeOwner).spice, originalIncome);
    assert.equal(markup({ game: viewGame(game, f.claimant), busy: false, act() {} }), '');
    game = allowSemutaGholaIncome(game);
    assert.equal(player(game, f.incomeOwner).spice, originalIncome + 1);
    assert.equal(player(game, f.owner).reserves, reserves + 1);
  });
}
