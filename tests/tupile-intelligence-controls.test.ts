import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TupileIntelligence } from '../components/tupile-intelligence';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import {
  tupileIntelligenceActions,
  tupileIntelligenceCanAct,
  tupileIntelligenceChoice,
} from '../game/tupile-intelligence-options';

/** Projected facts isolate client/policy behavior. The engine supplies contact,
 * lifetime use, timing and private answer custody; the client cannot infer them. */
function fixture(): GameView {
  const g = createGame('TUPILECONTROLS', newPlayer('c', 'CHOAM', 'choam'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(g, { status: 'playing', phase: 2, turn: 3, active: 'a', order: ['a', 'e', 'c'], storm: 18 });
  const view = viewGame(g, 'c');
  view.tupileIntelligence = {
    owner: 'c', blocked: null,
    targets: [
      { player: 'a', faction: 'atreides', contact: ['homeworld:atreides'], blocked: null },
      { player: 'e', faction: 'emperor', contact: ['homeworld:emperor:salusa'], blocked: null },
    ],
    receipts: [],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(TupileIntelligence, { game, busy, act() {} }));
}

void test('Tupile choice emits exactly one selected category for a current eligible target without mutation', () => {
  const view = fixture();
  const before = structuredClone(view);
  for (const category of ['weapons', 'defenses'] as const)
    assert.deepEqual(tupileIntelligenceChoice(view, 'e', category), {
      blocked: null, action: { type: 'tupileIntelligence', target: 'e', category },
    });
  for (const target of ['c', 'missing'])
    assert.equal(tupileIntelligenceChoice(view, target, 'weapons').action, null);
  assert.equal(tupileIntelligenceChoice(view, 'a', 'both' as never).action, null);
  assert.deepEqual(view, before);
  view.tupileIntelligence!.targets.push({ ...view.tupileIntelligence!.targets[0] });
  assert.equal(tupileIntelligenceChoice(view, 'a', 'weapons').action, null);
});

void test('all policy profiles skip spent or ineligible factions and obey the server timing block', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = fixture();
    view.players.find((player) => player.id === view.me)!.bot = profile;
    view.tupileIntelligence!.targets[0].blocked = 'Already used against Atreides in this game.';
    assert.deepEqual(tupileIntelligenceActions(view), [
      { type: 'tupileIntelligence', target: 'e', category: 'weapons' },
    ]);
    view.tupileIntelligence!.blocked = 'Finish the current response before requesting intelligence.';
    assert.equal(tupileIntelligenceCanAct(view), false);
    assert.deepEqual(tupileIntelligenceActions(view), []);
    assert.equal(tupileIntelligenceChoice(view, 'e', 'defenses').blocked, view.tupileIntelligence!.blocked);
    view.tupileIntelligence!.blocked = null;
    view.tupileIntelligence!.targets[1].blocked = 'No current Homeworld contact.';
    assert.deepEqual(tupileIntelligenceActions(view), []);
  }
});

void test('owned controls expose accessible opponent/category selection and one request button', () => {
  const html = markup(fixture());
  assert.match(html, /aria-label="Opposing faction"/);
  assert.match(html, /aria-label="Card count"/);
  assert.match(html, /value="weapons" selected=""/);
  assert.match(html, /value="defenses"/);
  assert.match(html, />Atreides<\/option>/);
  assert.match(html, />Emperor<\/option>/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.match(html, />Request intelligence<\/button>/);
  assert.doesNotMatch(html, /confirm|Reveal hand|Your private observations/i);
});

void test('private historical observations remain readable during a block and after JSON restoration', () => {
  const view = fixture();
  view.tupileIntelligence!.blocked = 'Occupation must be resolved before another request.';
  view.tupileIntelligence!.receipts = [
    { event: 'old-a', target: 'a', faction: 'atreides', category: 'weapons', spice: 13, count: 2, turn: 1, phase: 3 },
    { event: 'old-e', target: 'e', faction: 'emperor', category: 'defenses', spice: 0, count: 1, turn: 2, phase: 7 },
  ];
  const before = structuredClone(view);
  const html = markup(JSON.parse(JSON.stringify(view)));
  assert.match(html, /Your private observations/);
  assert.match(html, /13 spice, 2 weapons/);
  assert.match(html, /0 spice, 1 defense/);
  assert.match(html, /Turn 1 · Bidding/);
  assert.match(html, /Turn 2 · Spice collection/);
  assert.ok(html.indexOf('0 spice, 1 defense') < html.indexOf('13 spice, 2 weapons'));
  assert.match(html, /do not update/);
  assert.match(html, /Occupation must be resolved/);
  assert.match(html, /<button[^>]* disabled=""[^>]*>Request intelligence/);
  assert.deepEqual(view, before);
});

void test('busy, empty and spent-target controls cannot submit a new request', () => {
  const busy = markup(fixture(), true);
  assert.equal((busy.match(/<select[^>]* disabled=""/g) ?? []).length, 2);
  assert.match(busy, /<button[^>]* disabled=""[^>]*>Request intelligence/);
  const view = fixture();
  view.tupileIntelligence!.targets = [];
  assert.match(markup(view), /No eligible faction/);
  assert.match(markup(view), /No faction is currently available for a request/);
  assert.doesNotMatch(markup(view), /Choose a current opposing faction/);
  assert.match(markup(view), /<button[^>]* disabled=""[^>]*>Request intelligence/);
  assert.deepEqual(tupileIntelligenceActions(view), []);
  const spent = fixture();
  spent.tupileIntelligence!.targets[0].blocked = 'Already used against this faction in this game.';
  spent.tupileIntelligence!.targets[1].blocked = 'CHOAM must be on that faction’s Homeworld, or that faction must be on Tupile.';
  spent.tupileIntelligence!.blocked = 'Finish the current response before requesting intelligence.';
  spent.tupileIntelligence!.receipts = [
    { event: 'spent-a', target: 'a', faction: 'atreides', category: 'weapons', spice: 7, count: 1, turn: 1, phase: 5 },
  ];
  const unavailable = markup(spent);
  assert.match(unavailable, /No eligible faction/);
  assert.match(unavailable, /Atreides<\/strong>: Already used against this faction in this game/);
  assert.match(unavailable, /Emperor<\/strong>: CHOAM must be on that faction/);
  assert.match(unavailable, /Finish the current response before requesting intelligence/);
  assert.match(unavailable, /7 spice, 1 weapon/);
  assert.doesNotMatch(unavailable, /Choose a current opposing faction/);
  assert.deepEqual(tupileIntelligenceActions(spent), []);
});

void test('other seats cannot render or consult private offers, even if a malformed projection includes one', () => {
  const view = fixture();
  view.me = 'a';
  for (const field of ['targets', 'receipts'] as const)
    Object.defineProperty(view.tupileIntelligence!, field, { get() { throw new Error(`Private ${field} accessed`); } });
  assert.equal(markup(view), '');
  assert.equal(tupileIntelligenceCanAct(view), false);
  assert.deepEqual(tupileIntelligenceActions(view), []);
  assert.equal(tupileIntelligenceChoice(view, 'e', 'weapons').action, null);
  const missing = fixture();
  missing.tupileIntelligence = null;
  assert.equal(markup(missing), '');
  assert.deepEqual(tupileIntelligenceActions(missing), []);
});

void test('policy and panel never inspect opponent hands, balances, plans or private source state', () => {
  const view = fixture();
  const expected = markup(view);
  Object.defineProperty(view, 'players', { get() { throw new Error('Player source inspected'); } });
  for (const field of ['hand', 'spice', 'battle', 'homeworlds', 'noField', 'leaders'])
    Object.defineProperty(view, field, { get() { throw new Error(`Hidden ${field} inspected`); } });
  assert.equal(markup(view), expected);
  Object.defineProperty(view.tupileIntelligence!, 'receipts', { get() { throw new Error('History used for eligibility'); } });
  assert.deepEqual(tupileIntelligenceActions(view), [{ type: 'tupileIntelligence', target: 'a', category: 'weapons' }]);
  assert.ok(tupileIntelligenceChoice(view, 'e', 'defenses').action);
  view.status = 'finished';
  assert.deepEqual(tupileIntelligenceActions(view), []);
  assert.equal(tupileIntelligenceChoice(view, 'e', 'defenses').action, null);
});
