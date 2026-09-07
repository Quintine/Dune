import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { FACTIONS, type FactionId } from '../game/catalog';
import { richeseCards } from '../game/richese-cards';

const card = 'richese-portable-snooper';
function fixture(faction: FactionId = 'harkonnen', advanced = false) {
  let g = createGame('PORTABLE', newPlayer('p', 'Holder', faction), advanced, [
    'choam',
  ]);
  g.players.push(
    newPlayer('q', 'Opponent', faction === 'guild' ? 'emperor' : 'guild'),
  );
  if (faction !== 'richese')
    g.players.push(newPlayer('r', 'Richese', 'richese'));
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.active = 'p';
  g.order = g.players.map((p) => p.id);
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [];
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  g.players[0].hand = [g.richeseCache.find((c) => c.id === card)!];
  g.richeseCache = g.richeseCache.filter((c) => c.id !== card);
  const poison = g.deck.find((c) => c.kind === 'poison')!;
  g.players[1].hand = [poison];
  g.deck = g.deck.filter((c) => c.id !== poison.id);
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  for (const id of ['p', 'q'])
    g = applyAction(g, id, {
      type: 'battlePreparationReady',
      event: g.battle!.event,
    });
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function reveal(g: Game, normal = false, losing = false) {
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: losing ? 0 : 1,
    leader: g.players[0].leaders.reduce((a, b) =>
      a.strength >= b.strength ? a : b,
    ).id,
    defense: normal ? card : null,
  });
  return applyAction(g, 'q', {
    type: 'battlePlan',
    dial: losing ? 5 : 0,
    leader: g.players[1].leaders.reduce((a, b) =>
      (losing ? a.strength >= b.strength : a.strength <= b.strength) ? a : b,
    ).id,
    weapon: g.players[1].hand[0].id,
  });
}
const play = (g: Game, extra: Partial<Action> = {}) =>
  applyAction(g, 'p', {
    type: 'portableSnooper',
    card,
    event: g.battle!.event,
    ...extra,
  });
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const finish = (g: Game) =>
  applyAction(applyAction(g, 'q', { type: 'traitorCall', call: false }), 'p', {
    type: 'traitorCall',
    call: false,
  });

void test('all twelve holders use Portable in normal and late plans in Basic and Advanced with ordinary winner retention', () => {
  for (const f of FACTIONS)
    for (const advanced of [false, true])
      for (const normal of [false, true]) {
        let g = reveal(fixture(f.id, advanced), normal);
        const original = structuredClone(g.battle!.plans);
        if (!normal) g = play(g);
        assert.deepEqual(g.battle!.plans, original);
        const ownLeader = original.p.leader!;
        g = finish(g);
        assert.equal(
          g.players[0].leaders.find((l) => l.id === ownLeader)!.dead,
          false,
          `${f.id}/${advanced}/${normal}`,
        );
        assert.ok(g.players[0].hand.some((c) => c.id === card));
        assert.equal(g.discard.filter((c) => c.id === card).length, 0);
        assert.equal(g.decision?.kind, 'battleCards');
        assert.equal(g.players[0].spice, 10);
        assert.equal(g.players[1].spice, 10);
      }
});
void test('late play remains private until used, exposes its physical inspector, and leaves plan and prescience unchanged', () => {
  let g = reveal(fixture());
  g.battle!.prescience = { player: 'q', field: 'defense', value: null };
  const before = structuredClone(g);
  assert.equal(viewGame(g, 'q').portableSnooper, null);
  assert.equal(
    viewGame(g, 'q').battle!.cards.some((c) => c.id === card),
    false,
  );
  g = play(g);
  assert.deepEqual(before.battle!.plans, g.battle!.plans);
  assert.deepEqual(before.battle!.prescience, g.battle!.prescience);
  for (const id of ['p', 'q', 'r']) {
    const v = viewGame(g, id);
    assert.equal(v.battle!.lateDefense.p, card);
    assert.ok(v.battle!.cards.some((c) => c.id === card));
  }
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  assert.throws(() => play(g), /already/);
  assert.deepEqual(
    before.players.map((p) => p.spice),
    g.players.map((p) => p.spice),
  );
  assert.deepEqual(
    before.players.map((p) => p.forces),
    g.players.map((p) => p.forces),
  );
});
void test('late play is rejected before reveal, after own declaration, on stale events and for foreign or forged cards without mutation', () => {
  const early = fixture();
  assert.throws(() => play(early), /revealed/);
  const g = reveal(early),
    before = structuredClone(g);
  for (const action of [
    { type: 'portableSnooper', card, event: 'stale' },
    { type: 'portableSnooper', card: 'forged', event: g.battle!.event },
    { type: 'portableSnooper', card, event: g.battle!.event, target: 'q' },
  ])
    assert.throws(() => applyAction(g, 'p', action));
  assert.throws(() =>
    applyAction(g, 'q', {
      type: 'portableSnooper',
      card,
      event: g.battle!.event,
    }),
  );
  assert.deepEqual(g, before);
  const passed = applyAction(g, 'p', { type: 'traitorCall', call: false });
  assert.throws(() => play(passed), /already submitted/);
});
void test('played Portable is reserved against physical transfer and damaged saved custody cannot resolve a battle', () => {
  let g = reveal(fixture());
  const distrans = g.richeseCache!.find((c) => c.effect === 'distrans')!;
  g.players[0].hand.push(distrans);
  g.richeseCache = g.richeseCache!.filter((c) => c.id !== distrans.id);
  g = play(g);
  assert.throws(
    () =>
      applyAction(g, 'p', {
        type: 'card',
        card: distrans.id,
        target: 'r',
        give: card,
      }),
    /reserved/,
  );
  const before = structuredClone(g),
    damaged = reload(g);
  damaged.players[0].hand = damaged.players[0].hand.filter(
    (c) => c.id !== card,
  );
  assert.throws(() => finish(damaged), /missing/);
  assert.throws(() => normalizeAutomaticGame(damaged), /missing/);
  assert.deepEqual(g, before);
});
void test('a losing late defender discards the physical card once while a traitor result still overrides protection', () => {
  let g = reveal(fixture(), false, true);
  g = finish(play(g));
  assert.equal(
    g.players[0].hand.some((c) => c.id === card),
    false,
  );
  assert.equal(g.discard.filter((c) => c.id === card).length, 1);
  g = reveal(fixture());
  const victim = g.battle!.plans.p.leader!;
  g.players[1].traitors = [victim];
  g = play(g);
  g = applyAction(g, 'q', { type: 'traitorCall', call: true });
  g = applyAction(g, 'p', { type: 'traitorCall', call: false });
  assert.equal(g.players[0].leaders.find((l) => l.id === victim)!.dead, true);
  assert.equal(g.discard.filter((c) => c.id === card).length, 1);
});
