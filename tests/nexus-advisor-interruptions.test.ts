import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import {
  nexusAdvisorFixture,
  nexusAdvisorPlayer,
  holdAdvisorKarama,
  beginNexusAdvisorFlip,
  allowNexusAdvisorFlip,
} from './fixture-nexus-advisors';
import { nexusReload } from './fixture-nexus-cards';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

function inventory(g: Game) {
  assert.deepEqual(
    [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((p) => p.hand),
      ...g.richeseCache!,
    ]
      .map((card) => card.id)
      .sort(),
    [...treacheryDeck(g.expansions), ...richeseCards()]
      .map((card) => card.id)
      .sort(),
  );
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}

function paidSearch() {
  let g = nexusAdvisorFixture({ opponentFaction: 'richese' });
  const boxIndex = g.richeseCache!.findIndex(
    (card) => card.effect === 'nullentropyBox',
  );
  assert.ok(boxIndex >= 0);
  const box = g.richeseCache!.splice(boxIndex, 1)[0];
  g.players[1].hand.push(box);
  const karama = holdAdvisorKarama(g);
  for (const kind of ['shield', 'projectile']) {
    const index = g.deck.findIndex((card) => card.kind === kind);
    assert.ok(index >= 0);
    g.discard.push(g.deck.splice(index, 1)[0]);
  }
  g.players[1].spice = 10;
  const original = nexusReload(g);
  g = beginNexusAdvisorFlip(g, ['arrakeen', 'pasty_mesa']);
  const response = structuredClone(g.response);
  g = applyAction(g, 'q', { type: 'card', card: box.id });
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.equal(g.pendingNullentropy?.resume.response?.kind, 'nexusAdvisorFlip');
  assert.deepEqual(g.pendingNullentropy!.resume.response, response);
  assert.equal(g.players[1].spice, 8);
  inventory(g);
  return { g, original, response, karama, box: box.id };
}

function finishSearch(g: Game) {
  return applyAction(g, 'q', {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: g.discard[0].id,
  });
}

void test('paid Nullentropy suspends the advisor response and restores its exact batch once after a private JSON recovery', () => {
  const f = paidSearch();
  let g = nexusReload(f.g);
  const before = nexusReload(g);
  assert.deepEqual(normalizeAutomaticGame(g), before);
  for (const player of g.players) {
    assert.deepEqual(
      viewGame(nexusReload(g), player.id),
      viewGame(g, player.id),
    );
    if (player.id !== 'q')
      assert.equal(viewGame(g, player.id).nullentropy, null);
  }
  assert.deepEqual(
    nexusAdvisorPlayer(g).advisors,
    nexusAdvisorPlayer(f.original).advisors,
  );
  const selected = g.discard[0].id;
  g = finishSearch(g);
  assert.deepEqual(g.response, f.response);
  assert.equal(g.nexusAdvisorHistory!.at(-1)!.stage, 'pending');
  assert.equal(g.players[1].spice, 8);
  assert.ok(g.players[1].hand.some((card) => card.id === selected));
  assert.equal(g.discard.filter((card) => card.id === f.box).length, 1);
  g = allowNexusAdvisorFlip(nexusReload(g));
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, { carthag: {} });
  assert.equal(g.nexusAdvisorHistory!.at(-1)!.stage, 'completed');
  assert.equal(g.nexusAdvisorHistory!.length, 1);
  assert.deepEqual(
    g.players.map((player) => player.forces),
    f.original.players.map((player) => player.forces),
  );
  assert.equal(g.players[1].spice, 8);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  inventory(g);
});

void test('the restored advisor response still accepts one Karama after Box recovery without undoing the paid search', () => {
  const f = paidSearch();
  let g = finishSearch(nexusReload(f.g));
  const selected = f.g.discard[0].id;
  g = applyAction(g, 'q', { type: 'card', card: f.karama, mode: 'cancel' });
  g = allowNexusAdvisorFlip(nexusReload(g));
  assert.equal(g.nexusAdvisorHistory!.at(-1)!.stage, 'canceled');
  assert.deepEqual(
    nexusAdvisorPlayer(g).advisors,
    nexusAdvisorPlayer(f.original).advisors,
  );
  assert.equal(g.players[1].spice, 8);
  assert.ok(g.players[1].hand.some((card) => card.id === selected));
  assert.equal(g.discard.filter((card) => card.id === f.box).length, 1);
  assert.equal(g.discard.filter((card) => card.id === f.karama).length, 1);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((card) => card === 'beneGesserit')
      .length,
    1,
  );
  inventory(g);
});

void test('damaged advisor parents inside a paid search reject reads, automatic progress and card selection immutably', () => {
  const { g: paid } = paidSearch();
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.pendingNullentropy!.resume.response = null;
    },
    (g) => {
      g.pendingNullentropy!.resume.response!.intent = 'stale';
    },
    (g) => {
      g.pendingNullentropy!.resume.response!.owner = 'q';
    },
    (g) => {
      delete g.nexusAdvisorLast;
    },
    (g) => {
      delete g.nexusAdvisorHistory;
    },
    (g) => {
      g.nexusAdvisorHistory![0].stage = 'completed';
    },
    (g) => {
      g.players[0].moved++;
    },
    (g) => {
      g.players[0].forces['arrakeen:10']++;
      g.players[0].reserves--;
    },
  ];
  for (const mutate of mutations) {
    const g = nexusReload(paid);
    mutate(g);
    const before = nexusReload(g);
    for (const player of g.players) assert.throws(() => viewGame(g, player.id));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() => finishSearch(g));
    assert.deepEqual(g, before);
  }
});
