import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  nexusTraitorFixture,
  nexusTraitorBattle,
  nexusTraitorDraw,
  nexusTraitorReturn,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';

function hold(g: Game, owner: string, effect: string): string {
  const source = g.richeseCache?.some((card) => card.effect === effect)
    ? g.richeseCache
    : g.deck;
  const index = source.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0, `Missing physical ${effect}`);
  const card = source.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
function returnAction(g: Game): Action {
  const exchange = g.nexusTraitorExchanges!.at(-1)!;
  return {
    type: 'nexusTraitorReturn',
    event: exchange.event,
    cards: [...exchange.drawn],
  };
}
function rejectEverywhere(g: Game): void {
  const before = JSON.stringify(g);
  for (const player of g.players) {
    assert.throws(() => viewGame(g, player.id));
    assert.equal(JSON.stringify(g), before);
  }
  assert.throws(() => normalizeAutomaticGame(g));
  assert.equal(JSON.stringify(g), before);
  assert.throws(() => applyAction(g, 'p', returnAction(g)));
  assert.equal(JSON.stringify(g), before);
}
function pendingResponse(): Game {
  let g = nexusTraitorFixture({ opponentFaction: 'atreides' });
  hold(g, 'r', 'karama');
  g = nexusTraitorBattle(g, false);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  assert.equal(g.response?.kind, 'prescience');
  return g;
}
function beginBox(): Game {
  let g = nexusTraitorFixture({ opponentFaction: 'richese' });
  const box = hold(g, 'q', 'nullentropyBox');
  for (const kind of ['shield', 'projectile']) {
    const index = g.deck.findIndex((card) => card.kind === kind);
    assert.ok(index >= 0);
    g.discard.push(g.deck.splice(index, 1)[0]);
  }
  g.players[1].spice = 10;
  g = applyAction(g, 'q', { type: 'card', card: box });
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.ok(g.pendingNullentropy);
  return g;
}
function cards(g: Game): string[] {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((card) => card.id)
    .sort();
}
function truthPriority(g: Game): Game {
  for (let i = 0; g.truthtrance?.stage === 'priority' && i < 12; i++) {
    const owner = g.players.find((p) => !g.truthtrance!.passed.includes(p.id));
    assert.ok(owner);
    g = applyAction(g, owner.id, { type: 'truthPass' });
  }
  assert.equal(g.truthtrance?.stage, 'ask');
  return g;
}

void test('Cunning cannot lose or rebind its real suspended Prescience cancellation response', () => {
  const original = pendingResponse();
  const pending = nexusTraitorDraw(original);
  for (const mutate of [
    (g: Game) => {
      g.response = null;
    },
    (g: Game) => {
      g.response!.owner = 'r';
    },
    (g: Game) => {
      g.response!.passed.push('r');
    },
    (g: Game) => {
      g.battle!.preparation!.owner = 'q';
    },
  ]) {
    const changed = nexusReload(pending);
    mutate(changed);
    rejectEverywhere(changed);
  }
  let g = nexusTraitorReturn(
    normalizeAutomaticGame(nexusReload(pending)),
    pending.nexusTraitorExchanges![0].drawn,
  );
  assert.deepEqual(g.response, original.response);
  assert.deepEqual(g.battle, original.battle);
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 0 });
  assert.equal(g.battle!.prescience!.value, 0);
  nexusTraitorInventory(g);
});

void test('a pending Nexus exchange requires its original parent and pending markers', () => {
  const pending = nexusTraitorDraw(pendingResponse());
  for (const mutate of [
    (g: Game) => {
      delete g.nexusTraitorParent;
    },
    (g: Game) => {
      g.nexusTraitorParent = null;
    },
    (g: Game) => {
      g.nexusTraitorParent!.event = 'another-exchange';
    },
    (g: Game) => {
      g.nexusTraitorParent!.signature = 'changed';
    },
    (g: Game) => {
      delete g.nexusTraitorPending;
    },
    (g: Game) => {
      delete g.nexusTraitorParent;
      delete g.nexusTraitorPending;
    },
  ]) {
    const changed = nexusReload(pending);
    mutate(changed);
    rejectEverywhere(changed);
  }
});

void test('real Nullentropy search remains paid once and intact through a Nexus exchange and JSON reload', () => {
  const original = beginBox();
  const inventory = cards(original);
  const paid = original.players[1].spice;
  const pending = nexusTraitorDraw(original);
  const beforeEarlyChoice = JSON.stringify(pending);
  assert.throws(
    () =>
      applyAction(pending, 'q', {
        type: 'decision',
        event: pending.pendingNullentropy!.event,
        card: pending.discard[0].id,
      }),
    /Nexus|return/i,
  );
  assert.equal(JSON.stringify(pending), beforeEarlyChoice);
  for (const mutate of [
    (g: Game) => {
      g.decision = null;
    },
    (g: Game) => {
      g.decision!.player = 'r';
    },
    (g: Game) => {
      g.pendingNullentropy = null;
    },
    (g: Game) => {
      g.pendingNullentropy!.resume.response = {
        kind: 'guildIncome',
        owner: 'p',
        amount: 3,
        passed: [],
      };
    },
  ]) {
    const changed = nexusReload(pending);
    mutate(changed);
    rejectEverywhere(changed);
  }
  let g = nexusTraitorReturn(
    normalizeAutomaticGame(nexusReload(pending)),
    pending.nexusTraitorExchanges![0].drawn,
  );
  assert.deepEqual(
    g.pendingNullentropy,
    nexusReload(original).pendingNullentropy,
  );
  assert.deepEqual(g.decision, original.decision);
  assert.equal(g.players[1].spice, paid);
  assert.equal(paid, 8);
  const selected = g.discard[0].id;
  g = applyAction(g, 'q', {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: selected,
  });
  assert.equal(g.pendingNullentropy, null);
  assert.equal(g.players[1].spice, paid);
  assert.ok(g.players[1].hand.some((card) => card.id === selected));
  assert.equal(
    g.discard.filter((card) => card.effect === 'nullentropyBox').length,
    1,
  );
  assert.deepEqual(cards(g), inventory);
});

void test('a real Truthtrance overlay restores the exchange and preceding response without consuming either twice', () => {
  const initial = pendingResponse();
  const truth = hold(initial, 'r', 'truthtrance');
  const pending = nexusTraitorDraw(initial);
  const originalBattle = structuredClone(pending.battle);
  const originalResponse = structuredClone(pending.response);
  const originalExchange = structuredClone(pending.nexusTraitorExchanges);
  const originalParent = structuredClone(pending.nexusTraitorParent);
  let g = applyAction(pending, 'r', { type: 'card', card: truth });
  g = truthPriority(normalizeAutomaticGame(nexusReload(g)));
  g = applyAction(g, 'r', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'p',
      fact: { kind: 'traitor', leader: g.players[0].traitors[0] },
    },
  });
  g = applyAction(nexusReload(g), 'p', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(g.truthtrance, null);
  assert.equal(g.pendingTreacheryDiscard, null);
  assert.deepEqual(g.response, originalResponse);
  assert.deepEqual(g.battle, originalBattle);
  assert.deepEqual(g.nexusTraitorExchanges, originalExchange);
  assert.deepEqual(g.nexusTraitorParent, originalParent);
  assert.equal(g.discard.filter((card) => card.id === truth).length, 1);
  assert.equal(viewGame(g, 'r').nexusTraitors!.pending!.choices.length, 0);
  g = nexusTraitorReturn(
    normalizeAutomaticGame(nexusReload(g)),
    g.nexusTraitorExchanges![0].drawn,
  );
  assert.deepEqual(g.response, originalResponse);
  assert.equal(g.nexusTraitorParent, null);
  assert.equal(g.nexusTraitorExchanges![0].stage, 'complete');
  nexusTraitorInventory(g);
});
