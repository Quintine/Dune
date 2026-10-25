import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EcazDukeAcquisitionChoices } from '../components/ecaz-duke-acquisition-choices';
import { createDukeVidal } from '../game/duke-vidal';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { EcazEntry } = await import('../components/ecaz-entry');
aliases.deregister();

// Controlled projections supplement the separate native acquisition sources.
// Only the public view is changed: no played alliance, Duke custody, Ambassador
// token, force, hand or entry is installed in a Game. React renders the stateful
// wrapper; only the hook-free choices leaf is called directly for callbacks.
function projected(advanced = false): GameView {
  const game = createGame('ECAZDUKEALLYCONTROLS', newPlayer('e', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  joinGame(game, newPlayer('a', 'Atreides ally', 'atreides'));
  joinGame(game, newPlayer('i', 'Emperor entrant', 'emperor'));
  const view = viewGame(game, 'e');
  view.status = 'playing'; view.phase = 5; view.turn = 2;
  view.decision = { kind: 'ecazAmbassador', player: 'e' };
  view.dukeVidal = createDukeVidal();
  view.ambassadorEntry = {
    event: 'controlled-ecaz-duke-entry', owner: 'e', entrant: 'i',
    territory: 'arrakeen', stage: 'offer', effect: 'ecaz', beneficiary: null,
    noField: null, shipment: null, movement: null,
    allianceOffer: { blocked: 'The entrant is already allied.' },
    dukeAcquisition: { blocked: null }, dukeLoan: null,
    beneficiaries: [{ player: 'e', blocked: null }, { player: 'a', blocked: null }],
    copies: [], cards: [], revival: null,
  };
  return view;
}
function markup(game: GameView, busy = false, wrapper = false) {
  return renderToStaticMarkup(createElement(wrapper ? EcazEntry : EcazDukeAcquisitionChoices, {
    game, busy, act() {},
  }));
}
function button(html: string, recipient: string) {
  const found = html.match(new RegExp(`<button\\b(?=[^>]*data-testid="ecaz-duke-acquisition-${recipient}")[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
  assert.ok(found, `Duke choice for ${recipient}`); return found;
}
function click(node: ReactNode, recipient: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode; onClick?: () => void; 'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === `ecaz-duke-acquisition-${recipient}` && child.props.onClick) {
      child.props.onClick(); return true;
    }
    if (click(child.props.children, recipient)) return true;
  }
  return false;
}
function choose(game: GameView, recipient: string, busy = false): Action[] {
  const actions: Action[] = [];
  click(EcazDukeAcquisitionChoices({ game, busy, act(action) { actions.push(action); } }), recipient);
  return actions;
}

void test('Ecaz Duke choices allow the projected existing ally when self acquisition is blocked', () => {
  for (const advanced of [false, true]) {
    const game = projected(advanced), entry = game.ambassadorEntry!;
    entry.dukeAcquisition!.blocked = 'Ecaz already controls Duke Vidal.';
    entry.beneficiaries[0].blocked = 'Ecaz already controls Duke Vidal.';
    const html = markup(game);
    assert.match(button(html, 'e'), /\sdisabled=/);
    assert.doesNotMatch(button(html, 'a'), /\sdisabled=/);
    assert.match(html, /Ecaz already controls Duke Vidal/);
    assert.match(html, /Acquire Duke Vidal for Atreides ally/);
    assert.deepEqual(choose(game, 'e'), []);
    assert.deepEqual(choose(game, 'a'), [{
      type: 'decision', event: entry.event, trigger: true, beneficiary: 'a', choice: 'duke',
    }]);
  }
});

void test('each offered Duke recipient sends exactly its own event-bound acquisition action', () => {
  const game = projected(), before = structuredClone(game);
  for (const recipient of ['e', 'a']) {
    assert.deepEqual(choose(game, recipient), [{
      type: 'decision', event: 'controlled-ecaz-duke-entry', trigger: true,
      beneficiary: recipient, choice: 'duke',
    }]);
    assert.doesNotMatch(button(markup(game), recipient), /\sdisabled=/);
  }
  assert.deepEqual(choose(game, 'i'), [], 'No unoffered entrant choice is manufactured');
  assert.deepEqual(game, before);
});

void test('busy and per-recipient blocks suppress actual Duke callbacks while reasons remain visible', () => {
  const game = projected();
  assert.deepEqual(choose(game, 'e', true), []); assert.deepEqual(choose(game, 'a', true), []);
  const busy = markup(game, true);
  assert.match(button(busy, 'e'), /\sdisabled=/); assert.match(button(busy, 'a'), /\sdisabled=/);
  game.ambassadorEntry!.beneficiaries[1].blocked = 'The chosen beneficiary already controls Duke Vidal.';
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /The chosen beneficiary already controls Duke Vidal/);
    assert.match(button(html, 'a'), /\sdisabled=/);
    assert.match(button(html, 'a'), /aria-describedby="ecaz-duke-controlled-ecaz-duke-entry-a-blocked"/);
    assert.doesNotMatch(button(html, 'e'), /\sdisabled=/);
    assert.deepEqual(choose(game, 'a'), []);
  }
});

void test('an empty beneficiary list retains only the old self descriptor and its unavailable reason', () => {
  const game = projected(), entry = game.ambassadorEntry!;
  entry.beneficiaries = [];
  assert.match(markup(game), /Acquire Duke Vidal for Ecaz/);
  assert.doesNotMatch(markup(game), /Acquire Duke Vidal for Atreides ally/);
  assert.deepEqual(choose(game, 'e'), [{
    type: 'decision', event: entry.event, trigger: true, beneficiary: 'e', choice: 'duke',
  }]);
  assert.deepEqual(choose(game, 'a'), []);
  entry.dukeAcquisition!.blocked = 'Duke Vidal is unavailable for this acquisition.';
  assert.match(markup(game), /Duke Vidal is unavailable for this acquisition/);
  assert.deepEqual(choose(game, 'e'), []);
  entry.dukeAcquisition = null;
  assert.match(markup(game), /Duke acquisition is unavailable for this opportunity/);
  assert.deepEqual(choose(game, 'e'), []);
});

void test('waiting foreign and closed entry views never expose a standalone Duke transfer', () => {
  for (const change of ['absent', 'viewer', 'owner', 'actor', 'decision', 'stage', 'effect'] as const) {
    const game = projected();
    if (change === 'absent') game.ambassadorEntry = null;
    if (change === 'viewer') game.me = 'a';
    if (change === 'owner') game.ambassadorEntry!.owner = 'i';
    if (change === 'actor') game.decision!.player = 'i';
    if (change === 'decision') game.decision = null;
    if (change === 'stage') game.ambassadorEntry!.stage = 'loan';
    if (change === 'effect') game.ambassadorEntry!.effect = 'fremen';
    assert.equal(markup(game), '', change);
    assert.deepEqual(choose(game, 'e'), [], change); assert.deepEqual(choose(game, 'a'), [], change);
  }
  const waiting = projected(); waiting.decision!.player = 'i';
  assert.equal(markup(waiting, false, true), '');
});

void test('ordinary Duke tenure guidance stays readable and distinguishes the new-alliance turn loan', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /Provisional ordinary acquisition/);
    assert.match(html, /until battle use, including when unused beyond this turn/);
    assert.match(html, /The separate Duke loan after a new alliance lasts for the current turn/);
    assert.match(html, /Only Ecaz may revive him/);
    assert.match(html, /The Ambassador returns to your supply/);
    assert.doesNotMatch(html, /Confirm|Acknowledge|countdown|once per turn/);
  }
});

void test('the React-rendered entry retains one Duke inspector and its original alliance and loan controls', () => {
  const game = projected();
  game.ambassadorEntry!.beneficiaries[0].blocked = 'The self choice is blocked.';
  const html = markup(game, false, true);
  assert.equal((html.match(/aria-label="Inspect leader: Duke Prad Vidal"/g) ?? []).length, 1);
  assert.match(html, /Acquire Duke Vidal for Atreides ally/);
  assert.match(html, /Offer alliance to Emperor entrant/);
  assert.match(html, /The entrant is already allied/);
  assert.match(html, /Leave Ambassador in place/);
  assert.doesNotMatch(button(html, 'a'), /\sdisabled=/);
  game.ambassadorEntry!.stage = 'loan';
  const loan = markup(game, false, true);
  assert.match(loan, /Lend Duke Vidal to the new ally/);
  assert.match(loan, /Continue without lending Duke/);
  assert.match(loan, /unused living Duke is set aside at turn end/);
  assert.doesNotMatch(loan, /ecaz-duke-acquisition-|Provisional ordinary acquisition/);
});

void test('Duke recipient controls use only public names and authoritative beneficiary reasons', () => {
  const game = projected();
  Object.defineProperty(game.ambassadorEntry!, 'dukeAcquisition', { get() { throw Error('Read the compatibility self descriptor despite offered beneficiaries'); } });
  Object.defineProperty(game, 'dukeVidal', { get() { throw Error('Read Duke custody to recreate projected eligibility'); } });
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'leaders', 'forces'])
    Object.defineProperty(player, field, { get() { throw Error(`Duke choices read private or custody field ${field}`); } });
  assert.match(markup(game), /Acquire Duke Vidal for Atreides ally/);
  assert.deepEqual(choose(game, 'a'), [{
    type: 'decision', event: 'controlled-ecaz-duke-entry', trigger: true, beneficiary: 'a', choice: 'duke',
  }]);
});
