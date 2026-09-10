import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FACTIONS, type FactionId } from '../game/catalog';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { NEXUS_CARD_REFERENCE, NEXUS_PANEL_NAMES, nexusCardReference } from '../game/nexus-card-reference';

// Match Vinext's actual next/image alias in this isolated Node test process;
// render the production image implementation, not a component mock.
const imageAlias = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
} });
const { NexusCardFace, NexusCardGallery, NexusCards, nexusCardChoiceAction } = await import('../components/nexus-cards');
imageAlias.deregister();

/** Only public seats and the server's private owner projection feed the UI. */
function fixture(card: FactionId | null = null): GameView {
  const g = createGame('NEXUSCONTROLS', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(g, { status: 'playing', phase: 1, turn: 2, active: 'e' });
  const view = viewGame(g, 'a');
  view.nexusCards = { card, deckCount: card ? 9 : 10, discardCount: 0,
    held: { a: !!card, h: true, e: true }, turn: 2,
    choices: card ? ['keep', 'replace'] : ['keep', 'draw'], waiting: ['a', 'h'] };
  return view;
}
function markup(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(NexusCards, { game, busy, act() {} }));
}

void test('the original inventory renders twelve identities, all36 readable panels and inspect controls', () => {
  assert.equal(NEXUS_CARD_REFERENCE.length, 12);
  assert.deepEqual(NEXUS_CARD_REFERENCE.map((card) => card.faction).sort(), FACTIONS.map((faction) => faction.id).sort());
  const html = renderToStaticMarkup(createElement(NexusCardGallery));
  for (const mode of ['betrayal', 'cunning', 'secretAlly'] as const)
    assert.equal(html.split(`aria-label="${NEXUS_PANEL_NAMES[mode]}"`).length - 1, 12);
  assert.equal((html.match(/aria-label="Inspect [^"]+ Nexus card"/g) ?? []).length, 12);
  for (const card of NEXUS_CARD_REFERENCE) {
    for (const mode of ['betrayal', 'cunning', 'secretAlly'] as const) {
      assert.ok(card[mode].length > 30);
      assert.ok(html.includes(card[mode]));
    }
  }
});

void test('reference preserves materially different physical effects and original numerical limits', () => {
  assert.match(nexusCardReference('guild').betrayal, /whole shipment payment.*own payment.*Junction/);
  assert.match(nexusCardReference('guild').cunning, /second shipment.*cannot move unless.*Hajr/);
  assert.match(nexusCardReference('richese').cunning, /two No-Field.*one force.*reveal one/);
  assert.match(nexusCardReference('tleilaxu').secretAlly, /leader.*free.*five.*one spice each/);
  assert.match(nexusCardReference('emperor').secretAlly, /three extra forces free beyond/);
  assert.match(nexusCardReference('ecaz').cunning, /capture.*Tanks.*Ghola.*Moritani.*end of the turn/);
  assert.match(nexusCardReference('moritani').betrayal, /Return.*without revealing/);
  assert.match(nexusCardReference('harkonnen').betrayal, /replacement during Mentat Pause/);
  assert.match(nexusCardReference('choam').secretAlly, /not used in that battle/);
  assert.match(nexusCardReference('ixians').betrayal, /cannot prevent both/);
  assert.doesNotMatch(JSON.stringify(NEXUS_CARD_REFERENCE), /INTERNAL AUDIT|ALTERNATE SUPPLY CHAIN|entire Battle Plan/);
});

void test('draw, replacement and keep actions bind the exact offered turn and card without mutation', () => {
  for (const card of [null, 'fremen'] as const) {
    const view = fixture(card);
    const before = structuredClone(view);
    for (const choice of view.nexusCards!.choices)
      assert.deepEqual(nexusCardChoiceAction(view, choice), { type: 'nexusCardChoice', turn: 2, card, choice, ownRedraws: 0 });
    assert.equal(nexusCardChoiceAction(view, card ? 'draw' : 'replace'), null);
    assert.deepEqual(view, before);
  }
});

void test('private pre-draw policy applies in Basic and Advanced without a revealing post-draw prompt', () => {
  for (const advanced of [false, true]) {
    for (const card of [null, 'atreides', 'fremen'] as const) {
      const view = fixture(card);
      view.advanced = advanced;
      const choice = card ? 'replace' : 'draw';
      for (const ownRedraws of [0, 1, 2] as const)
        assert.deepEqual(nexusCardChoiceAction(view, choice, ownRedraws), { type: 'nexusCardChoice', turn: 2, card, choice, ownRedraws });
      assert.equal(nexusCardChoiceAction(view, choice, 3 as never), null);
      assert.equal(nexusCardChoiceAction(view, 'keep', 2)!.ownRedraws, 0);
      assert.match(markup(view), /aria-label="If I draw my faction"/);
      assert.match(markup(view), /Basic or Advanced play/);
      assert.match(markup(view), /Redraw whenever it appears/);
      view.nexusCards!.choices = [];
      view.nexusCards!.waiting = ['h'];
      assert.doesNotMatch(markup(view), /If I draw my faction|You drew your own faction|Redraw my faction card/);
    }
  }
});

void test('settled, stale, nonplaying and nonowner opportunities cannot generate an action', () => {
  for (const edit of [
    (view: GameView) => { view.nexusCards!.waiting = ['h']; },
    (view: GameView) => { view.nexusCards!.choices = []; },
    (view: GameView) => { view.nexusCards!.turn = 1; },
    (view: GameView) => { view.nexusCards!.turn = null; },
    (view: GameView) => { view.phase = 2; },
    (view: GameView) => { view.status = 'finished'; },
    (view: GameView) => { view.me = 'observer'; },
  ]) {
    const view = fixture();
    edit(view);
    assert.equal(nexusCardChoiceAction(view, 'draw'), null);
    assert.equal(nexusCardChoiceAction(view, 'keep'), null);
  }
});

void test('the owned face highlights its mode from the public roster and all three requirements remain readable', () => {
  for (const [card, mode] of [['atreides', 'Cunning'], ['harkonnen', 'Betrayal'], ['fremen', 'Secret Ally']] as const) {
    const html = markup(fixture(card));
    const privateFace = html.slice(html.indexOf('aria-label="Your private Nexus card"'), html.indexOf('<details'));
    assert.match(privateFace, new RegExp(`${mode}<span[^>]*>Your applicable mode`));
    assert.equal((privateFace.match(/Your applicable mode/g) ?? []).length, 1);
    assert.match(privateFace, /player only/);
    assert.match(privateFace, /Another player controls/);
    assert.match(privateFace, /is not in this game/);
  }
});

void test('controls expose public counts and waiting players, disable while busy, and offer no effect play action', () => {
  const view = fixture();
  const html = markup(view, true);
  assert.match(html, /Atreides inspections, Harkonnen exchanges, and Tleilaxu, Ixian, Bene Gesserit, Emperor and CHOAM Cunning/);
  assert.match(html, /other unfinished effects remain unavailable/);
  assert.doesNotMatch(html, /other card effects are not playable yet/);
  assert.match(html, /10 in deck · 0 discarded · 2 held/);
  assert.match(html, /Waiting for Nexus choices: Harkonnen/);
  assert.match(html, /You do not hold a Nexus card/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Draw a Nexus card/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Skip this draw/);
  assert.doesNotMatch(html, />Play |Activate effect|Use Betrayal/);
  const enlarged = renderToStaticMarkup(createElement(NexusCardFace, { card: 'atreides', enlarged: true }));
  assert.match(enlarged, /text-xl! leading-8!/);
  assert.doesNotMatch(enlarged, /<button/);
});

void test('rendering and legal choices never inspect other hands, source deck order, spice or secret battle fields', () => {
  const view = fixture('fremen');
  const expected = markup(view);
  for (const player of view.players)
    for (const field of ['hand', 'traitors', 'spice', 'prediction'])
      Object.defineProperty(player, field, { get() { throw new Error(`Private ${field} inspected`); } });
  for (const field of ['deck', 'discard', 'battle', 'hands', 'noField'])
    Object.defineProperty(view, field, { get() { throw new Error(`Source ${field} inspected`); } });
  Object.defineProperty(view.nexusCards!, 'hands', { get() { throw new Error('Opposing held identities inspected'); } });
  assert.equal(markup(view), expected);
  assert.ok(nexusCardChoiceAction(view, 'replace'));
  assert.ok(nexusCardChoiceAction(view, 'keep'));
});

void test('disabled module reads no player or card source and renders no inventory', () => {
  const view = fixture();
  view.nexusCards = null;
  Object.defineProperty(view, 'players', { get() { throw new Error('Unnecessary player access'); } });
  assert.equal(markup(view), '');
  assert.equal(nexusCardChoiceAction(view, 'draw'), null);
});
