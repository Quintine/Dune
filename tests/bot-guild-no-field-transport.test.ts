import assert from 'node:assert/strict';
import test from 'node:test';
import { guildNoFieldTransportActions as actions } from '../game/bot-guild-no-field-transport';
import { createGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { territory } from '../game/board';
import { guildTransportQuote } from '../game/transport-quote';
import { botHomeworldShipmentPaymentAllowed } from '../game/homeworld-payment-options';

/** Public/owner-entitled projection fixtures for this bot adapter only.
 * These are not played-state or physical card/force acquisition programmes.
 */
function fixture(mode: 'native' | 'secret' = 'native', value: 0 | 3 | 5 = 0): GameView {
  const source = createGame('BOT-NF-GUILD', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  source.players.push(newPlayer(mode === 'native' ? 'g' : 'f', 'Partner', mode === 'native' ? 'guild' : 'fremen'),
    newPlayer('a', 'Atreides', 'atreides'), newPlayer('e', 'Emperor', 'emperor'));
  const view = viewGame(source, 'r');
  Object.assign(view, { status: 'playing', phase: 5, turn: 2, active: 'r',
    order: source.players.map(player => player.id),
    storm: 18, response: null, decision: null, truthtrance: null, phaseOpening: null,
    automaticContinuationPending: false });
  for (const seat of view.players) {
    seat.forces = {};
    seat.ally = null;
    seat.shipped = false;
  }
  const own = view.players[0];
  own.spice = 2;
  own.reserves = 0;
  if (mode === 'native') {
    own.ally = 'g';
    view.players[1].ally = 'r';
  }
  view.aid.available = 0;
  const location = { territory: 'imperial_basin', sector: 10 };
  const tokenId = `nf-${value}`;
  const publicMarker = { deployed: { controller: 'r', location: { ...location }, effectiveForces: 1 as const }, lastUsed: null };
  own.noField = publicMarker;
  view.richeseNoField = {
    owner: 'r', event: 'owned-marker-view-source', public: publicMarker,
    private: { tokens: [{ id: 'nf-0', value: 0 }, { id: 'nf-3', value: 3 }, { id: 'nf-5', value: 5 }],
      lastShipped: tokenId, deployed: { tokenId, controller: 'r', location: { ...location } } },
    canShip: false, homeworldForcesEnabled: false, shipBlock: 'A marker is already deployed.',
    canReveal: true, revealBlock: null, canOfferAlly: false, allyOfferBlock: 'No ordinary allied offer.',
    allyPricing: null, allyDeclined: false, allyOffer: null,
  };
  if (mode === 'secret') {
    view.nexusCards = { card: 'guild', deckCount: 11, discardCount: 0,
      held: Object.fromEntries(view.players.map(player => [player.id, player.id === 'r'])),
      turn: null, choices: [], waiting: [] };
    view.nexusGuildSecretAlly = { event: JSON.stringify(['nexusGuildSecretAlly', view.turn, view.me]), blocked: null };
  }
  return view;
}
function legal(view: GameView, choices: Action[]): void {
  assert.ok(choices.length > 0);
  for (const choice of choices) {
    const quote = guildTransportQuote(view, choice);
    assert.deepEqual(quote.unavailableReasons, [], JSON.stringify(choice));
    assert.equal(botHomeworldShipmentPaymentAllowed(view, choice), true);
    assert.ok(quote.quote);
    assert.equal(quote.physicalForces, 0);
    assert.equal(choice.type, 'guildShip');
    assert.equal(choice.noField, view.richeseNoField!.private!.deployed!.tokenId);
    assert.equal(choice.event, view.richeseNoField!.event);
    assert.deepEqual(choice.forces, {});
    assert.equal(choice.allyPayment, quote.quote.pledgedPayment);
    assert.equal(choice.amount, undefined);
    assert.equal(choice.from, undefined);
  }
}

void test('a reciprocal Guild ally chooses quoted marker-only cross routes without revelation or native reserve return', () => {
  const view = fixture(), before = structuredClone(view), choices = actions(view);
  legal(view, choices);
  assert.ok(choices.every(choice => choice.territory !== 'imperial_basin' && choice.territory !== 'reserves'));
  assert.ok(choices.every(choice => choice.nexus === undefined));
  assert.deepEqual(actions(view), choices, 'enumeration remains stable');
  assert.deepEqual(view, before);
  const variant = fixture('native', 5);
  variant.players[0].reserves = 20;
  assert.deepEqual(actions(variant).map(choice => ({ ...choice, noField: undefined })),
    choices.map(choice => ({ ...choice, noField: undefined })), 'hidden value and reserves do not choose permission or destinations');
  view.players[1].ally = null;
  assert.deepEqual(actions(view), [], 'a one-sided alliance supplies no Guild permission');
});

void test('an actual absent-Guild Secret Ally adds its original Nexus source and permits a concealed reserve return', () => {
  const view = fixture('secret'), choices = actions(view);
  legal(view, choices);
  const returned = choices.find(choice => choice.territory === 'reserves');
  assert.ok(returned);
  assert.equal(returned.sector, 0);
  assert.ok(choices.every(choice => choice.nexus === view.nexusGuildSecretAlly!.event));
  const wrongCard = structuredClone(view);
  wrongCard.nexusCards!.card = 'ecaz';
  assert.deepEqual(actions(wrongCard), []);
  const allied = structuredClone(view);
  allied.players[0].ally = 'f';
  allied.players[1].ally = 'r';
  assert.deepEqual(actions(allied), [], 'Secret Ally does not manufacture a real alliance');
});

void test('stale or missing owned sources and closed shipment windows produce no marker transport packet', () => {
  const view = fixture(), old = actions(view);
  legal(view, old);
  view.richeseNoField!.event = 'renewed-owned-marker-source';
  assert.ok(actions(view).every(choice => choice.event === view.richeseNoField!.event));
  assert.ok(guildTransportQuote(view, old[0]).unavailableReasons.length > 0);
  const absent = fixture();
  absent.richeseNoField = null;
  assert.deepEqual(actions(absent), []);
  const foreign = fixture();
  foreign.richeseNoField!.private!.deployed!.controller = 'g';
  assert.deepEqual(actions(foreign), []);
  const used = fixture();
  used.players[0].shipped = true;
  assert.deepEqual(actions(used), []);
  const waiting = fixture();
  waiting.phaseOpening = { passed: [] };
  assert.deepEqual(actions(waiting), []);
  const otherTurn = fixture();
  otherTurn.active = 'g';
  assert.deepEqual(actions(otherTurn), []);
});

void test('shared quotes exclude storm and occupied destinations and supply only the minimum pledged funding', () => {
  const sourceStorm = fixture();
  sourceStorm.storm = 10;
  assert.deepEqual(actions(sourceStorm), []);
  const view = fixture();
  const carthag = territory('carthag').sectors[0], arrakeen = territory('arrakeen').sectors[0];
  view.players[1].forces[`carthag:${carthag}`] = 1;
  view.players[2].forces[`arrakeen:${arrakeen}`] = 1;
  view.players[3].forces[`arrakeen:${arrakeen}`] = 1;
  const choices = actions(view);
  legal(view, choices);
  assert.ok(choices.every(choice => choice.territory !== 'carthag' && choice.territory !== 'arrakeen'));
  view.players[0].spice = 0;
  assert.deepEqual(actions(view), []);
  view.aid.available = 1;
  const funded = actions(view);
  legal(view, funded);
  assert.ok(funded.every(choice => choice.allyPayment === 1));
});
