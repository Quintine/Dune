import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameTerritories, validGameLocation } from '../game/board';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { DISCOVERY_LOCATION_IDS, DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { reserveShipmentCost } from '../game/shipment-price';
import { deployRicheseNoField, moveRicheseNoField, projectRicheseNoField, validateRicheseNoField } from '../game/richese-no-field';
import {
  createDiscoveryNativeMarkerFixture, discoveryNativeMarkerShipmentWindow,
  nextDiscoveryNativeMarkerStep, revealDiscoveryNativeMarker, settleDiscoveryNativeMarkerShipment,
} from './fixture-discovery-native-marker';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));

function custody(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(),
    [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
    if (player.noField) validateRicheseNoField(player.noField);
  }
  validateDiscoveryState(game.discoveries!);
  assert.equal(game.discoveries!.tokens.length, 8);
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function legalPolicies(game: Game, actor: string) {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = difficulty;
    const choices = botActions(view);
    assert.ok(choices.length, `${difficulty} must offer an actual legal continuation.`);
    for (const action of choices) {
      const before = structuredClone(game);
      const next = applyAction(reload(game), actor, action);
      assert.deepEqual(game, before);
      custody(next);
    }
  }
}

void test('fresh E2 Discovery uses the original 35 ordinary cards, real cache, seven Spice Cards and eight tokens', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const fixture = createDiscoveryNativeMarkerFixture({ advanced, tech });
    assert.equal(treacheryDeck(['choam']).length, 35);
    const setup = fixture.setup;
    const ordinary = [...setup.deck, ...setup.players.flatMap(player => player.hand)];
    assert.deepEqual(ordinary.map(card => card.id).sort(), treacheryDeck(['choam']).map(card => card.id).sort());
    assert.deepEqual(setup.richeseCache!.map(card => card.id).sort(), richeseCards().map(card => card.id).sort());
    assert.equal(setup.spiceDeck.length, spiceDeck().length + 7);
    assert.deepEqual(setup.spiceDeck.flatMap(card => 'territory' in card && card.discovery ? [card.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(card => card.discovery).sort());
    assert.equal(setup.spiceDeck.filter(card => 'worm' in card && card.greatMaker).length, 1);
    assert.equal(setup.discoveries!.tokens.length, 8);
    assert.deepEqual(viewGame(setup, fixture.owner).discoveries!.tokens, []);
    assert.equal(fixture.game.phase, 7);
    assert.equal(fixture.game.turn, 1);
    assert.ok(fixture.actions.some(step => step.action.type === 'stormDial'));
    assert.ok(fixture.actions.some(step => step.action.type === 'ship'));
    assert.ok(fixture.actions.some(step => step.action.type === 'richeseBid'));
    assert.equal(Boolean(fixture.game.techTokens), tech);
    custody(fixture.game);
    const before = structuredClone(fixture.initial);
    assert.throws(() => applyAction(fixture.initial, fixture.initial.host, { type: 'start' }));
    assert.deepEqual(fixture.initial, before);
  }
});

void test('every known Discovery sector-zero location preserves private No-Field custody without authorizing arbitrary locations', () => {
  const fixture = createDiscoveryNativeMarkerFixture();
  const inventory = fixture.game.players.find(player => player.id === fixture.owner)!.noField!;
  const before = structuredClone(inventory);
  for (const territory of DISCOVERY_LOCATION_IDS) {
    const deployed = deployRicheseNoField(inventory, {
      tokenId: inventory.tokens[0].id, controller: fixture.owner, location: { territory, sector: 0 },
    });
    const moved = moveRicheseNoField(JSON.parse(JSON.stringify(deployed)), inventory.tokens[0].id, { territory, sector: 0 });
    assert.deepEqual(moved.tokens, inventory.tokens);
    assert.deepEqual(projectRicheseNoField(moved, false).deployed, {
      controller: fixture.owner, location: { territory, sector: 0 }, effectiveForces: 1,
    });
    assert.equal(validGameLocation(fixture.game, territory, 0), false);
  }
  for (const territory of ['invented-discovery', 'treachery-card-stash', 'arrakeen']) {
    assert.throws(() => deployRicheseNoField(inventory, {
      tokenId: inventory.tokens[0].id, controller: fixture.owner, location: { territory, sector: 0 },
    }));
  }
  assert.deepEqual(inventory, before);
});

void test('native paid markers ship into actual revealed nested sites, move out, and reveal 0/3/5 exactly once through JSON', () => {
  for (const advanced of [false, true]) {
    const fixture = createDiscoveryNativeMarkerFixture({ advanced, tech: true, face: 'shrine' });
    const window = discoveryNativeMarkerShipmentWindow(fixture);
    const owner = window.players.find(player => player.id === fixture.owner)!;
    const inventory = structuredClone(owner.noField!.tokens);
    assert.equal(validGameLocation(window, fixture.face, 0), true);
    assert.ok(gameTerritories(viewGame(window, fixture.owner)).some(territory => territory.id === fixture.face && territory.sectors[0] === 0));
    assert.equal(viewGame(window, fixture.owner).richeseNoField!.canShip, true);
    legalPolicies(window, fixture.owner);
    for (const token of inventory) {
      const action: Action = { type: 'ship', territory: fixture.face, sector: 0,
        noField: token.id, event: owner.noFieldEvent, allyPayment: 0 };
      const quoted = reserveShipmentCost({ faction: owner.faction, halfRate: false },
        gameTerritories(window).find(territory => territory.id === fixture.face)!.type, 1);
      assert.equal(quoted, 1);
      reject(window, fixture.collector, action);
      reject(window, fixture.owner, { ...action, event: 'stale-marker' });
      reject(window, fixture.owner, { ...action, territory: 'cistern' });
      reject(window, fixture.owner, { ...action, territory: 'arbitrary-sector-zero' });
      const corrupt = reload(window);
      corrupt.players.find(player => player.id === fixture.owner)!.noField!.tokens[1].id = token.id;
      if (token.id === inventory[1].id) corrupt.players.find(player => player.id === fixture.owner)!.noField!.tokens[0].id = token.id;
      reject(corrupt, fixture.owner, action);
      let game = applyAction(reload(window), fixture.owner, action);
      assert.equal(game.players.find(player => player.id === fixture.owner)!.reserves, owner.reserves);
      game = settleDiscoveryNativeMarkerShipment(reload(game));
      const shipped = game.players.find(player => player.id === fixture.owner)!;
      assert.equal(shipped.spice, owner.spice - quoted);
      assert.equal(shipped.reserves, owner.reserves);
      assert.deepEqual(shipped.forces, owner.forces);
      assert.deepEqual(shipped.noField!.tokens, inventory);
      const other = viewGame(game, fixture.collector);
      assert.equal(other.richeseNoField!.private, null);
      assert.equal(other.richeseNoField!.public.deployed!.effectiveForces, 1);
      for (const physical of inventory) assert.equal(JSON.stringify(other).includes(physical.id), false);
      for (const territory of ['cistern', 'unknown-nested-site']) {
        const corruptDeployment = reload(game);
        corruptDeployment.players.find(player => player.id === fixture.owner)!.noField!.deployed!.location = { territory, sector: 0 };
        reject(corruptDeployment, fixture.owner, { type: 'revealNoField', token: token.id, event: shipped.noFieldEvent });
      }
      const move: Action = { type: 'move', forces: {}, territory: fixture.parent, sector: fixture.parentSector,
        noField: token.id, event: shipped.noFieldEvent };
      reject(game, fixture.collector, move);
      reject(game, fixture.owner, { ...move, event: owner.noFieldEvent });
      game = applyAction(reload(game), fixture.owner, move);
      game = settleDiscoveryNativeMarkerShipment(game);
      const moved = game.players.find(player => player.id === fixture.owner)!;
      assert.deepEqual(moved.noField!.deployed!.location, { territory: fixture.parent, sector: fixture.parentSector });
      assert.deepEqual(moved.forces, owner.forces);
      assert.equal(moved.reserves, owner.reserves);
      assert.equal(moved.spice, owner.spice - quoted);
      assert.equal(moved.moved, owner.moved + 1);
      reject(game, fixture.owner, move);
      const reveal: Action = { type: 'revealNoField', token: token.id, event: moved.noFieldEvent };
      reject(game, fixture.collector, reveal);
      reject(game, fixture.owner, { ...reveal, event: shipped.noFieldEvent });
      const materialized = Math.min(token.value, moved.reserves);
      const key = `${fixture.parent}:${fixture.parentSector}`;
      game = applyAction(reload(game), fixture.owner, reveal);
      const revealed = game.players.find(player => player.id === fixture.owner)!;
      assert.equal(revealed.reserves, owner.reserves - materialized);
      assert.equal(revealed.forces[key] ?? 0, (owner.forces[key] ?? 0) + materialized);
      assert.equal(revealed.spice, owner.spice - quoted);
      assert.equal(revealed.noField!.deployed, null);
      assert.equal(revealed.noField!.lastShipped, token.id);
      assert.deepEqual(revealed.noField!.tokens, inventory);
      reject(game, fixture.owner, reveal);
      assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
      custody(game);
    }
  }
});

void test('a restored pending marker declaration cannot retarget its final real response into an unknown or unrevealed site', () => {
  const fixture = createDiscoveryNativeMarkerFixture({ advanced: true, face: 'shrine' });
  const window = discoveryNativeMarkerShipmentWindow(fixture);
  const owner = window.players.find(player => player.id === fixture.owner)!;
  const token = owner.noField!.tokens.find(candidate => candidate.value === 5)!;
  // A real physical Karama keeps the native cancellation producer open.
  const karamaIndex = window.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  window.players.find(player => player.id === fixture.collector)!.hand.push(window.deck.splice(karamaIndex, 1)[0]);
  let game = applyAction(window, fixture.owner, { type: 'ship', noField: token.id,
    event: owner.noFieldEvent, territory: fixture.face, sector: 0, allyPayment: 0 });
  assert.ok(game.response?.kind === 'richeseNoField' && game.pendingShipment);
  let last = nextDiscoveryNativeMarkerStep(game);
  // Stop before the original pass that closes this response, not at an
  // incidental count of auto-passed or privately eligible seats.
  for (let n = 0; n < game.players.length; n++) {
    assert.equal(last.action.type, 'passResponse');
    const next = applyAction(game, last.actor, last.action);
    if (next.response?.kind !== 'richeseNoField') break;
    game = next;
    last = nextDiscoveryNativeMarkerStep(game);
  }
  for (const territory of ['cistern', 'unknown-nested-site']) {
    const corrupt = reload(game);
    corrupt.pendingShipment!.territory = territory;
    reject(corrupt, last.actor, last.action);
    assert.equal(corrupt.players.find(player => player.id === fixture.owner)!.spice, owner.spice);
    assert.equal(corrupt.players.find(player => player.id === fixture.owner)!.reserves, owner.reserves);
    assert.equal(corrupt.players.find(player => player.id === fixture.owner)!.noField!.deployed, null);
  }
  const done = settleDiscoveryNativeMarkerShipment(applyAction(reload(game), last.actor, last.action));
  const shipped = done.players.find(player => player.id === fixture.owner)!;
  assert.equal(shipped.spice, owner.spice - 1);
  assert.equal(shipped.reserves, owner.reserves);
  assert.deepEqual(shipped.noField!.deployed!.location, { territory: fixture.face, sector: 0 });
  custody(done);
});

void test('one paid marker can enter a revealed parent-nested site by real movement and reveal there without merging physical force custody', () => {
  const fixture = createDiscoveryNativeMarkerFixture({ face: 'cistern' });
  let game = discoveryNativeMarkerShipmentWindow(fixture);
  const owner = game.players.find(player => player.id === fixture.owner)!;
  const before = structuredClone(owner);
  const token = owner.noField!.tokens.find(candidate => candidate.value === 5)!;
  game = applyAction(game, fixture.owner, { type: 'ship', noField: token.id, event: owner.noFieldEvent,
    territory: fixture.parent, sector: fixture.parentSector, allyPayment: 0 });
  game = settleDiscoveryNativeMarkerShipment(game);
  const shipped = game.players.find(player => player.id === fixture.owner)!;
  const move: Action = { type: 'move', forces: {}, noField: token.id, event: shipped.noFieldEvent,
    territory: fixture.face, sector: 0 };
  reject(game, fixture.owner, { ...move, territory: 'shrine' });
  game = applyAction(reload(game), fixture.owner, move);
  game = settleDiscoveryNativeMarkerShipment(game);
  const moved = game.players.find(player => player.id === fixture.owner)!;
  assert.deepEqual(moved.forces, before.forces);
  assert.equal(moved.reserves, before.reserves);
  assert.deepEqual(moved.noField!.deployed!.location, { territory: fixture.face, sector: 0 });
  game = applyAction(reload(game), fixture.owner, { type: 'revealNoField', token: token.id, event: moved.noFieldEvent });
  const revealed = game.players.find(player => player.id === fixture.owner)!;
  assert.equal(revealed.forces[`${fixture.face}:0`], 5);
  assert.equal(revealed.reserves, before.reserves - 5);
  assert.equal(revealed.spice, before.spice - 2);
  custody(game);
});

void test('CHOAM opens the actual Treachery Card Stash at five, draws six, owns every discard and returns to five without payment/refund', () => {
  for (const advanced of [false, true]) {
    const fixture = createDiscoveryNativeMarkerFixture({ advanced, face: 'treachery-card-stash', collector: 'choam' });
    const before = fixture.game;
    const choam = before.players.find(player => player.id === fixture.collector)!;
    assert.equal(handLimit(choam), 5);
    assert.equal(viewGame(before, fixture.collector).players.find(player => player.id === fixture.collector)!.handLimit, 5);
    // Explicit conserved custody staging, not an invented card or auction receipt.
    while (choam.hand.length < 5) {
      const physical = before.deck.shift();
      assert.ok(physical);
      choam.hand.push(physical);
    }
    fixture.staging.push('Moved undealt original ordinary cards into CHOAM hand to exercise its real five-card boundary.');
    const wallet = choam.spice, original = choam.hand.map(card => card.id), drawn = before.deck[0];
    assert.ok(drawn);
    custody(before);
    const game = revealDiscoveryNativeMarker(fixture);
    assert.equal(game.decision?.kind, 'discoveryDiscard');
    assert.equal(game.decision?.player, fixture.collector);
    assert.equal(game.players.find(player => player.id === fixture.collector)!.hand.length, 6);
    assert.deepEqual(game.players.find(player => player.id === fixture.collector)!.hand.map(card => card.id), [...original, drawn.id]);
    assert.equal(game.players.find(player => player.id === fixture.collector)!.spice, wallet);
    assert.equal(game.deck.length, before.deck.length - 1);
    const other = JSON.stringify(viewGame(game, fixture.owner));
    assert.equal(other.includes(JSON.stringify(drawn.id)), false);
    assert.equal(viewGame(game, fixture.collector).players.find(player => player.id === fixture.collector)!.handCount, 6);
    legalPolicies(game, fixture.collector);
    for (const card of game.players.find(player => player.id === fixture.collector)!.hand) {
      const action: Action = { type: 'decision', event: game.discoveryStash!.event, card: card.id };
      reject(game, fixture.owner, action);
      reject(game, fixture.collector, { ...action, event: 'stale-stash' });
      reject(game, fixture.collector, { ...action, card: 'invented-card' });
      let done = applyAction(reload(game), fixture.collector, action);
      done = settleDiscoveryNativeMarkerShipment(done);
      assert.equal(done.discoveryStash!.stage, 'complete');
      assert.equal(done.players.find(player => player.id === fixture.collector)!.hand.length, 5);
      assert.equal(done.players.find(player => player.id === fixture.collector)!.spice, wallet);
      assert.equal(done.deck.length, before.deck.length - 1);
      assert.equal(done.discard.filter(physical => physical.id === card.id).length, 1);
      assert.equal(done.discoveries!.tokens.find(token => token.id === fixture.token)!.status, 'removed');
      reject(done, fixture.collector, action);
      reject(done, fixture.collector, { type: 'discovery', token: fixture.token, reveal: true });
      assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
      custody(done);
    }
    custody(game);
  }
});
