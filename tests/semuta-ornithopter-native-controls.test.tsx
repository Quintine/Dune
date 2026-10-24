import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemutaReaction } from '../components/semuta-reaction';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaOrnithopterAmbassadorFixture as fixture,
  actSemutaOrnithopterAmbassador as act,
  openSemutaOrnithopterAmbassadorGrant as grant,
  semutaOrnithopterAmbassadorPlayer as player,
  semutaOrnithopterAmbassadorInventory as inventory,
} from './fixture-semuta-ornithopter-ambassador';

type Props = Parameters<typeof SemutaReaction>[0];
type Control = { children?: unknown; disabled?: boolean; onClick: () => void };
function controls(node: unknown): Control[] {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; disabled?: boolean; onClick?: () => void }>).props;
  return [...(props.onClick ? [{ ...props, onClick: props.onClick }] : []), ...controls(props.children)];
}
function label(node: unknown): string {
  if (Array.isArray(node)) return node.map(label).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object' || !('props' in node)) return '';
  return label((node as ReactElement<{ children?: unknown }>).props.children);
}
const markup = (props: Props) => renderToStaticMarkup(createElement(SemutaReaction, props));
function actionFromControl(game: Game, actor: string, text: string, expected: Action): Action {
  const sent: Action[] = [], props = { game: viewGame(game, actor), busy: false,
    act: (action: Action) => { sent.push(action); } };
  const control = controls(SemutaReaction(props)).find(button => label(button.children) === text);
  assert.ok(control, `The actual native fresh group offers ${text}`);
  assert.equal(control.disabled, false);
  const busy = controls(SemutaReaction({ ...props, busy: true })).find(button => label(button.children) === text);
  assert.ok(busy); assert.equal(busy.disabled, true);
  busy.onClick(); assert.deepEqual(sent, [], 'Busy callbacks cannot acknowledge, commit or select');
  control.onClick(); assert.deepEqual(sent, [expected]); return sent[0];
}
function offerAction(game: Game, actor: string, commit = false): Action {
  const reaction = viewGame(game, actor).semutaReaction; assert.ok(reaction?.stage === 'offer');
  return actionFromControl(game, actor, commit ? 'Commit Semuta Drug' : 'Continue',
    { type: commit ? 'semutaCommit' : 'semutaPass', event: reaction.event });
}
function continueGroup(source: Game): Game {
  const pending = source.pendingTreacheryDiscard; assert.ok(pending?.reaction?.stage === 'offer');
  const event = pending.batch.event;
  let game = source;
  for (const seat of source.players) {
    const current = game.pendingTreacheryDiscard;
    if (!current || current.batch.event !== event) break;
    assert.equal(current.reaction?.stage, 'offer');
    if (!current.reaction!.passed.includes(seat.id))
      game = act(game, seat.id, offerAction(game, seat.id));
  }
  return game;
}
function assertMoved(game: Game, actor: string, twoGroups: boolean) {
  const mover = player(game, actor);
  assert.equal(mover.moved, twoGroups ? 2 : 1);
  assert.equal(mover.ornithopterExtraMoves ?? 0, twoGroups ? 1 : 0);
  assert.equal(mover.forces['habbanya_ridge_sietch:17'], 1);
  if (twoGroups) assert.equal(mover.forces['habbanya_ridge_flat:18'], 1);
  assert.equal(game.ornithopter, null);
}

void test('native two-group Continue then CHOAM Commit/Select keeps separate events and the original six-spice credit', () => {
  const f = fixture({ effect: 'choam', mode: 'twoGroups' });
  let game = act(f.game, f.entrant, f.move);
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ornithopterDiscard');
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const firstEvent = game.pendingTreacheryDiscard!.batch.event, moved = structuredClone(player(game, f.entrant).forces);
  const original = structuredClone(game);
  for (let reading = 0; reading < 2; reading++) {
    const html = markup({ game: viewGame(game, f.claimant), busy: false, act() {} });
    assert.match(html, /Continue when you are ready/);
    assert.match(html, />Continue<\/button>/);
    assert.match(html, />Commit Semuta Drug<\/button>/);
  }
  assert.deepEqual(game, original, 'Reading the retirement offer never advances its original arrival');
  game = continueGroup(game);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  assertMoved(game, f.entrant, true);
  game = grant(game, f);
  const cards = player(game, f.beneficiary).hand.slice(0, 2).map(card => card.id);
  assert.equal(cards.length, 2);
  const spice = player(game, f.beneficiary).spice;
  game = act(game, f.beneficiary,
    { type: 'decision', event: game.pendingAmbassador!.event, cards });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ambassador');
  const secondEvent = game.pendingTreacheryDiscard!.batch.event;
  assert.notEqual(secondEvent, firstEvent);
  assert.equal(player(game, f.beneficiary).spice, spice + 6);
  assert.deepEqual(viewGame(game, f.claimant).semutaReaction!.candidates, []);
  const beforeCommit = structuredClone(game);
  assert.throws(() => act(game, f.claimant, { type: 'semutaCommit', event: firstEvent }));
  assert.deepEqual(game, beforeCommit, 'The retired flight event cannot claim the later private grant');
  game = act(game, f.claimant, offerAction(game, f.claimant, true));
  const selection = viewGame(game, f.claimant).semutaReaction!;
  assert.equal(selection.stage, 'select'); assert.equal(selection.event, secondEvent);
  assert.deepEqual(selection.candidates.map(card => card.id).sort(), [...cards].sort());
  const beforeReading = structuredClone(game);
  for (let reading = 0; reading < 2; reading++) {
    const html = markup({ game: viewGame(game, f.claimant), busy: false, act() {} });
    assert.match(html, /Choose one eligible freshly discarded/);
    assert.match(html, /This choice cannot be declined or canceled/);
    assert.doesNotMatch(html, />Continue<\/button>/);
  }
  assert.deepEqual(game, beforeReading, 'Selection persists without another payout or movement');
  const card = selection.candidates.find(card => card.id === cards[0]); assert.ok(card);
  const selected = actionFromControl(game, f.claimant, `Claim ${card.name} (${card.id})`,
    { type: 'semutaSelect', event: secondEvent, card: card.id });
  game = act(game, f.claimant, selected);
  assert.equal(game.pendingTreacheryDiscard, null); assert.equal(game.pendingAmbassador, null);
  assert.equal(player(game, f.beneficiary).spice, spice + 6);
  assert.ok(player(game, f.claimant).hand.some(held => held.id === card.id));
  assert.equal(game.discard.filter(held => held.id === f.semuta).length, 1);
  assert.equal(game.discard.filter(held => held.id === f.ornithopter).length, 1);
  assert.deepEqual(player(game, f.entrant).forces, moved);
  assertMoved(game, f.entrant, true);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('native first-card Commit auto-claims Ornithopter before the BG-copied Ix replacement waits for actual Continues', () => {
  const f = fixture({ effect: 'ixians', mode: 'range3', copied: true });
  let game = act(f.game, f.entrant, f.move);
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const firstEvent = game.pendingTreacheryDiscard!.batch.event;
  game = act(game, f.claimant, offerAction(game, f.claimant, true));
  assert.equal(game.pendingTreacheryDiscard, null, 'The actual one-card flight group needs no selection stage');
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.ornithopter));
  assert.ok(!player(game, f.claimant).hand.some(card => card.id === f.semuta));
  assertMoved(game, f.entrant, false);
  game = grant(game, f);
  const discard = player(game, f.beneficiary).hand[0].id;
  const next = structuredClone(game.deck[0]); assert.ok(next);
  const deckSize = game.deck.length, spice = player(game, f.beneficiary).spice;
  game = act(game, f.beneficiary,
    { type: 'decision', event: game.pendingAmbassador!.event, cards: [discard] });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ambassador');
  assert.notEqual(game.pendingTreacheryDiscard!.batch.event, firstEvent);
  assert.equal(game.deck.length, deckSize); assert.equal(game.deck[0].id, next.id);
  const before = structuredClone(game);
  for (const seat of game.players) {
    const view = viewGame(game, seat.id);
    assert.equal(view.semutaReaction!.canCommit, false, 'The single Semuta was actually spent on the first card');
    const html = markup({ game: view, busy: false, act() {} });
    assert.match(html, /Continue when you are ready/);
    assert.doesNotMatch(html, />Commit Semuta Drug<\/button>/);
  }
  assert.deepEqual(game, before, 'Reading the second group cannot draw its pending replacement');
  game = continueGroup(game);
  assert.equal(game.pendingTreacheryDiscard, null); assert.equal(game.pendingAmbassador, null);
  assert.equal(game.deck.length, deckSize - 1);
  assert.ok(player(game, f.beneficiary).hand.some(card => card.id === next.id));
  assert.equal(player(game, f.beneficiary).spice, spice);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.ornithopter));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  assertMoved(game, f.entrant, false);
  assert.deepEqual(inventory(game), f.originalInventory);
});
