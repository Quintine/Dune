import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  initializeDiscoveryGameForAudit,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import {
  discoveryFixture,
  discoveryLobby,
  enterDiscoveryCollection,
} from './fixture-discovery';
import {
  DISCOVERY_SPICE_CARDS,
  validateDiscoveryState,
} from '../game/discoveries';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function custody(g: Game) {
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  validateDiscoveryState(g.discoveries!);
}
void test('Discovery real setup deals seven spice cards and eight opaque tokens while normal starts remain gated', () => {
  for (const advanced of [false, true]) {
    const lobby = discoveryLobby(advanced),
      before = structuredClone(lobby);
    assert.throws(() => applyAction(lobby, lobby.host, { type: 'start' }));
    assert.deepEqual(lobby, before);
    const g = initializeDiscoveryGameForAudit(lobby);
    assert.equal(g.spiceDeck.length, spiceDeck().length + 7);
    assert.equal(
      g.spiceDeck.filter((card) => 'worm' in card && card.greatMaker).length,
      1,
    );
    assert.deepEqual(
      g.spiceDeck
        .flatMap((card) =>
          'territory' in card && card.discovery ? [card.discovery] : [],
        )
        .sort(),
      DISCOVERY_SPICE_CARDS.map((c) => c.discovery).sort(),
    );
    assert.equal(g.discoveries!.tokens.length, 8);
    assert.deepEqual(viewGame(g, lobby.host).discoveries!.tokens, []);
  }
});
void test('Collection look remains private, deferred reveal survives reload, and a Spice Stash pays exactly once', () => {
  let g = discoveryFixture();
  const token = enterDiscoveryCollection(g, 'spice-stash');
  assert.equal(viewGame(g, 'a').discoveries!.tokens[0].face, null);
  assert.equal(viewGame(g, 'g').discoveries!.tokens[0].face, 'spice-stash');
  assert.equal(viewGame(g, 'f').discoveries!.tokens[0].face, null);
  const before = structuredClone(g);
  assert.throws(() =>
    applyAction(g, 'a', { type: 'discovery', token: token.id, reveal: true }),
  );
  assert.throws(() =>
    applyAction(g, 'g', { type: 'discovery', token: token.id, reveal: true }),
  );
  assert.deepEqual(g, before);
  g = applyAction(g, 'a', {
    type: 'discovery',
    token: token.id,
    reveal: false,
  });
  const v = viewGame(g, 'a');
  assert.equal(v.discoveries!.tokens[0].face, 'spice-stash');
  v.discoveries!.tokens[0].owner = 'forged';
  assert.equal(
    g.discoveries!.tokens.find((t) => t.id === token.id)!.owner,
    null,
  );
  assert.equal(viewGame(g, 'f').discoveries!.tokens[0].face, null);
  const spice = g.players[0].spice;
  g = applyAction(reload(g), 'a', {
    type: 'discovery',
    token: token.id,
    reveal: true,
  });
  assert.equal(g.players[0].spice, spice + 7);
  assert.equal(
    g.discoveries!.tokens.find((t) => t.id === token.id)!.status,
    'removed',
  );
  const done = structuredClone(g);
  assert.throws(() =>
    applyAction(g, 'a', { type: 'discovery', token: token.id, reveal: true }),
  );
  assert.deepEqual(g, done);
  custody(g);
});
void test('Treachery Card Stash draws past a full hand, keeps the draw private and accepts every held discard through recovery', () => {
  let g = discoveryFixture();
  const token = enterDiscoveryCollection(g, 'treachery-card-stash');
  // Exercise the previously flaky ID prefix collision with two distinct cards.
  const take = (id: string) => {
    const pile = [g.deck, g.discard, ...g.players.map((p) => p.hand)]
      .find((cards) => cards.some((card) => card.id === id))!;
    return pile.splice(pile.findIndex((card) => card.id === id), 1)[0];
  };
  const privateCard = take('treachery-3');
  const visibleSibling = take('treachery-32');
  g.players.find((p) => p.id === 'f')!.hand.push(visibleSibling);
  while (g.players[0].hand.length < 4) g.players[0].hand.push(g.deck.shift()!);
  g.deck.unshift(privateCard);
  const original = g.players[0].hand.map((c) => c.id),
    drawn = g.deck[0];
  g = applyAction(g, 'a', {
    type: 'discovery',
    token: token.id,
    reveal: false,
  });
  g = applyAction(g, 'a', { type: 'discovery', token: token.id, reveal: true });
  assert.equal(g.decision?.kind, 'discoveryDiscard');
  assert.equal(g.players[0].hand.length, 5);
  const otherView = JSON.stringify(viewGame(g, 'f'));
  assert.equal(otherView.includes(JSON.stringify(visibleSibling.id)), true);
  assert.equal(otherView.includes(JSON.stringify(drawn.id)), false);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [...original, drawn.id],
  );
  for (const card of g.players[0].hand) {
    const done = applyAction(reload(g), 'a', {
      type: 'decision',
      event: g.discoveryStash!.event,
      card: card.id,
    });
    assert.equal(done.players[0].hand.length, 4);
    assert.equal(done.discoveryStash!.stage, 'complete');
    assert.ok(done.discard.some((c) => c.id === card.id));
    custody(done);
    assert.deepEqual(normalizeAutomaticGame(done), done);
  }
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(g, 'a');
    v.players[0].bot = difficulty;
    const actions = botActions(v);
    assert.ok(actions.length);
    for (const action of actions)
      assert.doesNotThrow(() => applyAction(g, 'a', action));
  }
});
void test('a revealed location is initially empty and becomes an ordinary stronghold-price destination', () => {
  let g = discoveryFixture();
  const token = enterDiscoveryCollection(g, 'cistern');
  g = applyAction(g, 'a', {
    type: 'discovery',
    token: token.id,
    reveal: false,
  });
  g = applyAction(g, 'a', { type: 'discovery', token: token.id, reveal: true });
  assert.equal(
    g.discoveries!.tokens.find((t) => t.id === token.id)!.revealedTurn,
    g.turn,
  );
  assert.ok(g.players.every((p) => !p.forces['cistern:0']));
  assert.equal(
    viewGame(g, 'f').discoveries!.tokens.find((t) => t.id === token.id)!.face,
    'cistern',
  );
  custody(g);
});

void test('each physical Discovery blow destroys the whole parent territory including Fremen before placing six new spice and a private token', () => {
  for (const printed of DISCOVERY_SPICE_CARDS) {
    let g = discoveryFixture();
    const index = g.spiceDeck.findIndex(
      (card) => 'territory' in card && card.discovery === printed.discovery,
    );
    assert.ok(index >= 0);
    const card = g.spiceDeck.splice(index, 1)[0];
    g.spiceDeck.unshift(card);
    Object.assign(g, { phase: 1, ready: [], storm: 18, stormPending: null });
    const key = `${printed.territory}:${printed.sector}`;
    for (const p of [g.players[0], g.players[2]]) {
      p.reserves -= 2;
      p.forces[key] = 2;
    }
    g.spice[key] = 4;
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    assert.equal(g.spiceWindow?.territory, printed.territory);
    assert.equal(g.spice[key], 6);
    for (const p of [g.players[0], g.players[2]]) {
      assert.equal(p.forces[key], undefined);
      assert.equal(p.tanks, 2);
    }
    assert.equal(
      g.discoveries!.tokens.filter((token) => token.status === 'placed').length,
      1,
    );
    assert.equal(viewGame(g, 'a').discoveries!.tokens[0].face, null);
    custody(g);
  }
});

void test('Discovery spice still destroys old forces under the storm and does not discard the separately placed token', () => {
  let g = discoveryFixture();
  const printed = DISCOVERY_SPICE_CARDS[0];
  const index = g.spiceDeck.findIndex(
    (card) => 'territory' in card && card.discovery === printed.discovery,
  );
  g.spiceDeck.unshift(g.spiceDeck.splice(index, 1)[0]);
  Object.assign(g, {
    phase: 1,
    ready: [],
    storm: printed.sector,
    stormPending: null,
  });
  const key = `${printed.territory}:${printed.sector}`;
  g.players[0].reserves--;
  g.players[0].forces[key] = 1;
  g.spice[key] = 3;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.spice[key], undefined);
  assert.equal(g.players[0].tanks, 1);
  assert.equal(
    g.discoveries!.tokens.filter((token) => token.status === 'placed').length,
    1,
  );
  custody(g);
});
