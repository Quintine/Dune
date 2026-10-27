import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { act, askTruthCharityCommitment as ask, bindTruthCharityCommitment as bind,
  createTruthCharityCommitmentFixture as fixture, inventory, player, rejectTruthCharityCommitment as reject } from './fixture-truth-charity-commitment';
import { declareTruthCharityPayments } from './fixture-truth-charity-payments';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { GameTable } = await import('../components/game-table');
const { Truthtrance } = await import('../components/truthtrance');
const { TruthCharityPromise } = await import('../components/truth-charity-promise');
aliases.deregister();
const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable, { game, busy: false, send: async () => {}, onExit() {} }));
const truth = (game: GameView) => renderToStaticMarkup(createElement(Truthtrance, { game, busy: false, act() {} }));

void test('Basic native Charity question, private answer controls and guided claim appear in the real table', () => {
  const f = fixture(); const declared = declareTruthCharityPayments(f).game;
  const asker = viewGame(declared, f.asker);
  assert.ok(asker.truthCharityTargets.includes(f.target));
  assert.match(truth(asker), /<option value="charity">[^<]*[Cc]harity/);
  assert.match(table(asker), /[Cc]harity/);
  // SSR confirms the selection is present; engine actions supply the question.
  const asked = ask(f), answerView = viewGame(asked, f.target);
  assert.equal(answerView.truthtrance?.question?.kind, 'charity');
  assert.ok(answerView.truthCharityAnswers?.includes('yes'));
  assert.ok(answerView.truthCharityAnswers?.includes('no'));
  assert.equal(viewGame(asked, f.asker).truthCharityAnswers, null);
  assert.match(truth(answerView), /Answer Yes/);
  assert.match(truth(answerView), /Answer No/);
  assert.match(table(answerView), /Answer Yes/);
  const bound = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const own = viewGame(bound, f.target), guide = own.truthCharityGuide;
  assert.ok(guide); assert.equal(guide.action.type, 'charity');
  assert.match(table(own), /[Cc]harity/);
  const claimed = act(bound, f.target, guide.action);
  assert.equal(player(claimed, f.target).charityTurn, claimed.turn);
  assert.deepEqual(inventory(claimed), f.originalCards);
});

void test('Basic No answer keeps its own readable Charity restriction and blocks the physical claim', () => {
  const f = fixture(), bound = bind(f, 'no').game;
  const own = viewGame(bound, f.target);
  assert.match(table(own), /[Cc]harity/);
  assert.throws(() => act(bound, f.target, { type: 'charity' }));
  assert.deepEqual(inventory(bound), f.originalCards);
});

void test('A live Charity bribe guide sends the native packet and cannot replay in a No continuation', () => {
  const f = fixture(), asked = ask(f, f.unprepared);
  const yes = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const own = viewGame(yes, f.target), sent: Action[] = [];
  assert.equal(own.truthCharityGuide?.action.type, 'bribe');
  const panel = TruthCharityPromise({ game: own, busy: false, send(action) { sent.push(action); } });
  assert.ok(panel);
  type GuideProps = { 'data-testid'?: string; disabled?: boolean; onClick?: () => void };
  const button = Children.toArray(panel.props.children).find(node =>
    isValidElement<GuideProps>(node) && node.props['data-testid'] === 'charity-promise-guide');
  assert.ok(isValidElement<GuideProps>(button));
  assert.equal(button.props.disabled, false);
  assert.ok(button.props.onClick); button.props.onClick();
  assert.deepEqual(sent, [own.truthCharityGuide!.action]);
  const paid = act(yes, f.target, sent[0]);
  assert.ok(player(paid, f.target).spice < 2);
  const no = act(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  reject(no, f.target, sent[0]);
});
