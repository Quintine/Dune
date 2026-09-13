import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer, viewGame,
  type Game, type GameView,
} from '../game/engine';
import { botActions } from '../game/bots';
import {
  DISCOVERY_TOKENS, placeDiscovery, rememberDiscoveryFace, revealDiscoveryToken,
  type DiscoveryTokenFace,
} from '../game/discoveries';
import { discoveryAction, discoveryBotActions, discoveryDiscardAction } from '../game/discovery-options';
import { DiscoveryDiscardDecision, DiscoveryPanel } from '../components/discoveries';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const html = (game: GameView, busy = false) => renderToStaticMarkup(createElement(DiscoveryPanel, { game, busy, act() {} }));
const discardHtml = (game: GameView, busy = false) => renderToStaticMarkup(createElement(DiscoveryDiscardDecision, { game, busy, act() {} }));

/** Genuine setup, then conserved board/card staging for Collection controls. */
function fixture() {
  let game = createGame('DISCOVERYCONTROLS', newPlayer('p', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  game.discoveryEnabled = true;
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeDiscoveryGameForAudit(game);
  for (let count = 0; game.status === 'setup' && count < 50; count++) {
    const owner = viewGame(game, 'p').setupPending[0];
    assert.ok(owner);
    const view = viewGame(game, owner);
    view.players.find(player => player.id === owner)!.bot = 'Hard';
    const action = botActions(view)[0];
    assert.ok(action);
    game = applyAction(game, owner, action);
  }
  assert.equal(game.status, 'playing');
  Object.assign(game, { phase: 7, turn: 2, active: null, ready: [], response: null, decision: null, phaseOpening: null });
  for (const player of game.players) {
    game.deck.push(...player.hand.splice(0));
    player.forces = {};
    player.reserves = 20;
    player.tanks = 0;
  }
  game.players[0].forces = { 'gara_kulon:8': 1, 'pasty_mesa:7': 1 };
  game.players[0].reserves = 18;
  return game;
}

function place(game: Game, face: DiscoveryTokenFace, known = false) {
  const token = game.discoveries!.tokens.find(token => token.face === face)!;
  const pool = game.discoveries!.tokens.filter(candidate => candidate.type === token.type && candidate.status === 'supply');
  const index = pool.findIndex(candidate => candidate.id === token.id);
  assert.ok(index >= 0);
  game.discoveries = placeDiscovery(game.discoveries!,
    token.type === 'hiereg' ? 'discovery-hagga-basin' : 'discovery-funeral-plain',
    () => (index + 0.5) / pool.length);
  if (known) game.discoveries = rememberDiscoveryFace(game.discoveries, token.id, 'atreides');
  return token.id;
}

void test('unknown backs expose only their type and placement; shared choices bind the quoted opaque token', () => {
  const game = fixture(), hidden = place(game, 'spice-stash'), known = place(game, 'cistern', true);
  const view = viewGame(game, 'p'), before = structuredClone(view);
  assert.deepEqual(discoveryAction(view, hidden, false), { type: 'discovery', token: hidden, reveal: false });
  assert.equal(discoveryAction(view, hidden, true), null);
  assert.equal(discoveryAction(view, known, false), null);
  assert.deepEqual(discoveryAction(view, known, true), { type: 'discovery', token: known, reveal: true });
  assert.equal(discoveryAction(view, 'discovery-token-99', false), null);
  const markup = html(view);
  assert.match(markup, /Smuggler discovery/);
  assert.match(markup, /Face down · unknown to you/);
  assert.match(markup, /Pasty Mesa · sector 7/);
  assert.doesNotMatch(markup, /Spice Stash|Receive seven spice/);
  assert.match(markup, /Read Cistern rules/);
  assert.match(markup, /Inspect Smuggler token privately/);
  assert.match(markup, /Reveal Cistern to everyone/);
  assert.deepEqual(discoveryBotActions(view).map(action => action.reveal), [false, true]);
  assert.deepEqual(view, before);
});

void test('Fremen and Guild privileged faces remain distinct from another seat’s private inspection', () => {
  const game = fixture();
  place(game, 'cistern');
  place(game, 'spice-stash');
  const fremen = viewGame(game, 'f'), guild = viewGame(game, 'g'), atreides = viewGame(game, 'p');
  assert.match(html(fremen), /Read Cistern rules/);
  assert.doesNotMatch(html(fremen), /Read Spice Stash rules/);
  assert.match(html(guild), /Read Spice Stash rules/);
  assert.doesNotMatch(html(guild), /Read Cistern rules/);
  assert.doesNotMatch(html(atreides), /Read (Cistern|Spice Stash) rules/);
  assert.deepEqual(discoveryBotActions(fremen), []);
  assert.deepEqual(discoveryBotActions(guild), []);
});

void test('all eight authorized faces have readable rules while shared location rules preserve parent-territory meaning', () => {
  const game = fixture();
  for (const definition of DISCOVERY_TOKENS) place(game, definition.id, true);
  const markup = html(viewGame(game, 'p'));
  for (const definition of DISCOVERY_TOKENS) assert.ok(markup.includes(`Read ${definition.name} rules`), definition.name);
  for (const text of ['opposing undialed force', 'two spice from the bank', 'Weather Control',
    'use a Truthtrance card as Karama', 'each spice blow that is collected', 'including the new card',
    'Receive seven spice', 'On a later turn', 'separate territory inside', 'At most two factions',
    'protected from storms and sandworms', 'before the storm and the mobile stronghold move']) assert.ok(markup.includes(text), text);
  assert.doesNotMatch(markup, /href="https?:/);
  assert.ok(markup.includes('Next-turn free entry, sole-occupant Cistern income and later-turn Ornithopter movement are available in the development prototype.'));
  assert.ok(markup.includes('Orgiz, mixed-force Jacurutu rewards and contested Cistern/Testing Station benefits remain pending.'));
});

void test('all four AI profiles inspect and then reveal through fresh private views and actual saved actions', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    let game = fixture();
    const token = place(game, 'spice-stash'), before = game.players[0].spice;
    for (const reveal of [false, true]) {
      const view = viewGame(game, 'p');
      view.players[0].bot = difficulty;
      const preserved = structuredClone(view), actions = discoveryBotActions(view);
      assert.deepEqual(actions, [{ type: 'discovery', token, reveal }]);
      for (const action of actions) assert.doesNotThrow(() => applyAction(reload(game), 'p', action));
      assert.deepEqual(view, preserved);
      game = applyAction(reload(game), 'p', actions[0]);
      if (!reveal) {
        assert.equal(game.players[0].spice, before);
        assert.doesNotMatch(html(viewGame(game, 'f')), /Read Spice Stash rules/);
      }
    }
    assert.equal(game.players[0].spice, before + 7);
    assert.equal(game.discoveries!.tokens.find(candidate => candidate.id === token)!.status, 'removed');
    assert.deepEqual(discoveryBotActions(viewGame(game, 'p')), []);
    assert.throws(() => applyAction(game, 'p', { type: 'discovery', token, reveal: true }));
  }
});

void test('carried and resolved tokens show public custody without a repeated reveal action', () => {
  const game = fixture(), carried = place(game, 'ornithopter'), removed = place(game, 'spice-stash');
  game.discoveries = revealDiscoveryToken(game.discoveries!, carried, game.turn, 'p').state;
  game.discoveries = revealDiscoveryToken(game.discoveries, removed, game.turn, 'p').state;
  assert.match(html(viewGame(game, 'p')), /Carried by you/);
  const observer = html(viewGame(game, 'f'));
  assert.match(observer, /Carried by Atreides/);
  assert.match(observer, /Resolved and removed/);
  assert.doesNotMatch(observer, /Reveal Ornithopter to everyone|Reveal Spice Stash to everyone/);
});

void test('a full-hand stash offers every owned card after its real draw, with private inspection and Worthless-first AI', () => {
  let game = fixture();
  const stash = place(game, 'treachery-card-stash', true), owner = game.players[0];
  for (const kind of ['shield', 'projectile', 'poison', 'worthless']) {
    const index = game.deck.findIndex(card => card.kind === kind);
    assert.ok(index >= 0);
    owner.hand.push(game.deck.splice(index, 1)[0]);
  }
  const newCard = game.deck[0].id, worthless = owner.hand.find(card => card.kind === 'worthless')!.id;
  game = applyAction(game, 'p', discoveryAction(viewGame(game, 'p'), stash, true)!);
  assert.equal(game.decision?.kind, 'discoveryDiscard');
  assert.equal(game.players[0].hand.length, 5);
  const view = viewGame(game, 'p'), actions = discoveryBotActions(view), before = structuredClone(view);
  assert.equal(actions.length, 5);
  assert.equal(actions[0].card, worthless);
  assert.equal(discoveryDiscardAction(view, 'not-owned'), null);
  assert.ok(discoveryDiscardAction(view, newCard));
  for (const action of actions) {
    const next = applyAction(reload(game), 'p', action);
    assert.equal(next.players[0].hand.length, 4);
    assert.equal(next.discard.filter(card => card.id === action.card).length, 1);
    assert.equal(next.discoveryStash?.stage, 'complete');
    assert.equal(discoveryDiscardAction(viewGame(next, 'p'), String(action.card)), null);
  }
  const markup = discardHtml(view);
  for (const card of game.players[0].hand) assert.ok(markup.includes(card.name), card.name);
  assert.match(markup, /Card to discard/);
  assert.match(markup, /Inspect card/);
  assert.match(markup, /new card is already in your hand/);
  const observer = viewGame(game, 'f');
  assert.equal(discardHtml(observer), '');
  assert.deepEqual(discoveryBotActions(observer), []);
  assert.match(discardHtml(view, true).match(/<select[^>]*>/)![0], /disabled=""/);
  const autopilot = structuredClone(view); autopilot.players[0].autopilot = 'Hard';
  assert.match(discardHtml(autopilot).match(/<select[^>]*>/)![0], /disabled=""/);
  assert.deepEqual(view, before);
});

void test('quoted blocking and human busy or autopilot controls retain readable tokens without offering actions', () => {
  const game = fixture(), token = place(game, 'cistern', true), view = viewGame(game, 'p');
  for (const busy of [true, false]) {
    const locked = structuredClone(view);
    if (!busy) locked.players[0].autopilot = 'Medium';
    const button = html(locked, busy).match(/<button[^>]*>Reveal Cistern to everyone<\/button>/)![0];
    assert.match(button, /disabled=""/);
    assert.match(html(locked, busy), /Read Cistern rules/);
  }
  const blocked = structuredClone(view);
  blocked.discoveries!.blocked = 'Finish the current interaction first.';
  assert.equal(discoveryAction(blocked, token, true), null);
  assert.deepEqual(discoveryBotActions(blocked), []);
  assert.match(html(blocked), /Finish the current interaction first/);
  assert.doesNotMatch(html(blocked), /Reveal Cistern to everyone/);
  const later = structuredClone(view); later.phase = 8;
  assert.equal(discoveryAction(later, token, true), null);
  assert.deepEqual(discoveryBotActions(later), []);
});
