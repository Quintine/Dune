import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemutaReaction } from '../components/semuta-reaction';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaArrivalOverlapFixture as fixture,
  actSemutaArrivalOverlap as act,
  player, inventory,
  openOverlapAmbassadorGrant as grant,
  openOverlapTerrorDiscard as terrorDiscard,
  finishOverlapTerror as finishTerror,
} from './fixture-semuta-arrival-overlap';

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
function click(game: Game, actor: string, text: string, expected: Action): Action {
  const sent: Action[] = [], props = { game: viewGame(game, actor), busy: false,
    act: (action: Action) => { sent.push(action); } };
  const control = controls(SemutaReaction(props)).find(button => label(button.children) === text);
  assert.ok(control, `The actual shared-entry discard offers ${text}`);
  assert.equal(control.disabled, false);
  const busy = controls(SemutaReaction({ ...props, busy: true }))
    .find(button => label(button.children) === text);
  assert.ok(busy); assert.equal(busy.disabled, true);
  busy.onClick(); assert.deepEqual(sent, [], 'Busy callbacks cannot advance a suspended native reaction');
  control.onClick(); assert.deepEqual(sent, [expected]);
  return sent[0];
}
function offerAction(game: Game, actor: string, commit = false): Action {
  const reaction = viewGame(game, actor).semutaReaction;
  assert.ok(reaction?.stage === 'offer');
  return click(game, actor, commit ? 'Commit Semuta Drug' : 'Continue',
    { type: commit ? 'semutaCommit' : 'semutaPass', event: reaction.event });
}
function continueGroup(source: Game): Game {
  const pending = source.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  let game = source;
  for (const seat of source.players) {
    const current = game.pendingTreacheryDiscard, reaction = current?.reaction;
    if (!current || current.batch.event !== event || reaction?.stage !== 'offer') break;
    if (!reaction.passed.includes(seat.id)) game = act(game, seat.id, offerAction(game, seat.id));
  }
  return game;
}
function readOffer(game: Game, actor: string, native: 'ambassador' | 'terror', canCommit: boolean) {
  const before = structuredClone(game);
  assert.ok(game.pendingArrivalOverlap);
  for (let reading = 0; reading < 2; reading++) {
    const view = viewGame(game, actor), html = markup({ game: view, busy: false, act() {} });
    assert.equal(view.arrivalOverlap?.active, native);
    assert.match(html, /Continue when you are ready/);
    assert.match(html, />Continue<\/button>/);
    assert.equal(html.includes('>Commit Semuta Drug</button>'), canCommit);
  }
  assert.deepEqual(game, before, 'Reading persistent text cannot finish either originally earned opportunity');
}
function claim(game: Game, actor: string, wanted: string): Game {
  game = act(game, actor, offerAction(game, actor, true));
  const reaction = viewGame(game, actor).semutaReaction;
  if (reaction?.stage === 'select') {
    const before = structuredClone(game);
    const html = markup({ game: viewGame(game, actor), busy: false, act() {} });
    assert.match(html, /Choose one eligible freshly discarded/);
    assert.doesNotMatch(html, />Continue<\/button>/);
    assert.match(html, /This choice cannot be declined or canceled/);
    assert.deepEqual(game, before);
    const card = reaction.candidates.find(card => card.id === wanted); assert.ok(card);
    game = act(game, actor, click(game, actor, `Claim ${card.name} (${card.id})`,
      { type: 'semutaSelect', event: reaction.event, card: card.id }));
  }
  assert.ok(player(game, actor).hand.some(card => card.id === wanted));
  return game;
}
function arrived(game: Game, entrant: string, location: string) {
  assert.equal(player(game, entrant).forces[location], 1);
  return { forces: structuredClone(player(game, entrant).forces), reserves: player(game, entrant).reserves,
    tanks: player(game, entrant).tanks, spice: player(game, entrant).spice, moved: player(game, entrant).moved };
}
function finished(game: Game, f: ReturnType<typeof fixture>, originalInventory: string[]) {
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.active, f.entrant);
  assert.equal(game.decision, null);
  assert.deepEqual(inventory(game), originalInventory);
  assert.equal(SemutaReaction({ game: viewGame(game, f.claimant), busy: false, act() {} }), null);
  return act(game, f.entrant, { type: 'endMovement' });
}

void test('CHOAM Select retires its shared-entry discard before the original Sabotage opportunity uses Continue', () => {
  const f = fixture({ effect: 'choam', first: 'ambassador', arrival: 'shipment', terror: 'sabotage' });
  const originalInventory = inventory(f.game);
  let game = grant(act(f.game, f.arrivalStep.actor, f.arrivalStep.action), f);
  const originalArrival = arrived(game, f.entrant, f.location);
  const spice = player(game, f.owner).spice;
  game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, cards: f.chosenCards });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ambassador');
  assert.equal(player(game, f.owner).spice, spice + 6);
  const firstEvent = game.pendingTreacheryDiscard!.batch.event;
  readOffer(game, f.claimant, 'ambassador', true);
  game = claim(game, f.claimant, f.chosenCards[0]);
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingAmbassador, null);
  assert.equal(player(game, f.owner).spice, spice + 6);
  game = terrorDiscard(game, f);
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'terrorDiscard');
  assert.notEqual(game.pendingTreacheryDiscard!.batch.event, firstEvent);
  readOffer(game, f.claimant, 'terror', false);
  const before = structuredClone(game);
  assert.throws(() => act(game, f.claimant, { type: 'semutaCommit', event: firstEvent }));
  assert.deepEqual(game, before, 'The first discard cannot acknowledge or claim the second native event');
  game = continueGroup(game);
  assert.equal(game.pendingTerrorEntry?.stage, 'gift');
  game = finishTerror(game, f);
  assert.deepEqual(arrived(game, f.entrant, f.location), originalArrival);
  assert.equal(player(game, f.owner).spice, spice + 6);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  finished(game, f, originalInventory);
});

void test('Sabotage Commit claims its sole card before the second-owner Ix replacement waits for Continue', () => {
  const f = fixture({ effect: 'ixians', first: 'terror', arrival: 'movement', terror: 'sabotage' });
  const originalInventory = inventory(f.game);
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  const originalArrival = arrived(game, f.entrant, f.location);
  game = terrorDiscard(game, f);
  const discarded = game.pendingTreacheryDiscard!.batch.entries[0].card.id;
  readOffer(game, f.claimant, 'terror', true);
  game = claim(game, f.claimant, discarded);
  assert.equal(game.pendingTerrorEntry?.stage, 'gift');
  assert.ok(!game.pendingAmbassador, 'Gift still belongs to the first original owner');
  game = finishTerror(game, f);
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  game = grant(game, f);
  const top = game.deck[0].id, size = game.deck.length, spice = player(game, f.owner).spice;
  game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, cards: f.chosenCards });
  assert.equal(game.deck.length, size);
  readOffer(game, f.claimant, 'ambassador', false);
  game = continueGroup(game);
  assert.equal(game.deck.length, size - 1);
  assert.ok(player(game, f.owner).hand.some(card => card.id === top));
  assert.equal(player(game, f.owner).spice, spice);
  assert.deepEqual(arrived(game, f.entrant, f.location), originalArrival);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  finished(game, f, originalInventory);
});

void test('Robbery Continue preserves its single draw while a later copied CHOAM Select claims a different fresh group', () => {
  const f = fixture({ effect: 'choam', first: 'terror', arrival: 'shipment', terror: 'robbery', copied: true });
  const originalInventory = inventory(f.game);
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  const originalArrival = arrived(game, f.entrant, f.location);
  const size = game.deck.length;
  game = terrorDiscard(game, f);
  assert.equal(game.deck.length, size - 1);
  const firstEvent = game.pendingTreacheryDiscard!.batch.event;
  readOffer(game, f.claimant, 'terror', true);
  game = continueGroup(game);
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  game = grant(game, f);
  const spice = player(game, f.owner).spice;
  game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, cards: f.chosenCards });
  assert.notEqual(game.pendingTreacheryDiscard!.batch.event, firstEvent);
  readOffer(game, f.claimant, 'ambassador', true);
  game = claim(game, f.claimant, f.chosenCards[1]);
  assert.equal(player(game, f.owner).spice, spice + 6);
  assert.equal(game.deck.length, size - 1, 'The first owner does not draw again after the copied grant');
  assert.deepEqual(arrived(game, f.entrant, f.location), originalArrival);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  finished(game, f, originalInventory);
});

void test('first-owner Ix Continue draws once before the second-owner Robbery Commit closes its own discard', () => {
  const f = fixture({ effect: 'ixians', first: 'ambassador', arrival: 'movement', terror: 'robbery' });
  const originalInventory = inventory(f.game);
  let game = grant(act(f.game, f.arrivalStep.actor, f.arrivalStep.action), f);
  const originalArrival = arrived(game, f.entrant, f.location);
  const top = game.deck[0].id, size = game.deck.length;
  game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, cards: f.chosenCards });
  readOffer(game, f.claimant, 'ambassador', true);
  game = continueGroup(game);
  assert.equal(game.deck.length, size - 1);
  assert.ok(player(game, f.owner).hand.some(card => card.id === top));
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  game = terrorDiscard(game, f);
  const discarded = game.pendingTreacheryDiscard!.batch.entries[0].card.id;
  assert.equal(game.deck.length, size - 2);
  readOffer(game, f.claimant, 'terror', true);
  game = claim(game, f.claimant, discarded);
  assert.equal(game.deck.length, size - 2);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  assert.deepEqual(arrived(game, f.entrant, f.location), originalArrival);
  finished(game, f, originalInventory);
});
