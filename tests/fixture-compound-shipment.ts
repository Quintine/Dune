import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck } from '../game/cards';
import type { ShipmentExpression } from '../game/shipment-promises';

/** Genuine base setup; then explicitly conserved hands, force pools and clean turn-two movement topology. */
export function compoundShipmentGame(
  advanced = false,
  seatIds: readonly [string, string, string] = ['p', 'a', 'o'],
): Game {
  const factions = ['emperor', 'atreides', 'harkonnen'] as const;
  let g = createGame(
    'COMPOUNDSHIP',
    newPlayer(seatIds[0], 'Shipper', factions[0]),
    advanced,
  );
  for (let i = 1; i < factions.length; i++)
    joinGame(g, newPlayer(seatIds[i], factions[i], factions[i]));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeBaseGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 100; n++) {
    let progressed = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((other) => other.id === p.id)!.bot = 'Hard';
      const action = botActions(view)[0];
      if (!action) continue;
      g = applyAction(g, p.id, action);
      progressed = true;
      break;
    }
    assert.ok(progressed, 'Genuine setup has an entitled actor.');
  }
  assert.equal(g.status, 'playing');
  assert.equal(g.setupStage, undefined);
  Object.assign(g, {
    phase: 5,
    turn: 2,
    active: seatIds[0],
    storm: 18,
    order: [...seatIds],
    movementRemaining: [...seatIds],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      shipped: false,
      moved: 0,
      revived: 0,
    });
    if (p.elites) p.elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  }
  compoundShipmentCustody(g);
  return g;
}

/** Scenario preparation only: relocate an existing physical card, never fabricate it. */
export function holdCompoundShipmentCard(
  g: Game,
  owner: string,
  effect: string,
): string {
  const at = g.deck.findIndex((c) => c.effect === effect || c.kind === effect);
  assert.ok(at >= 0, `Physical ${effect} remains in the deck.`);
  const card = g.deck.splice(at, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}

/** Clone and perform the real card/priority actions; never mutate the input. */
export function openCompoundShipmentQuestion(state: Game): Game {
  let g: Game = JSON.parse(JSON.stringify(state));
  const asker = g.players[1].id;
  const card = holdCompoundShipmentCard(g, asker, 'truthtrance');
  g = applyAction(g, asker, { type: 'card', card });
  for (let n = 0; g.truthtrance?.stage === 'priority' && n < 10; n++) {
    const actor = g.players.find((p) => !g.truthtrance!.passed.includes(p.id));
    assert.ok(actor);
    g = applyAction(g, actor.id, { type: 'truthPass' });
  }
  assert.equal(g.truthtrance?.stage, 'ask');
  compoundShipmentCustody(g);
  return g;
}

/** Start a new real question and return the target-owned answer window. */
export function askCompoundShipment(
  g: Game,
  expression: ShipmentExpression,
): Game {
  return applyAction(openCompoundShipmentQuestion(g), g.players[1].id, {
    type: 'truthAsk',
    question: { kind: 'shipment', target: g.players[0].id, claim: expression },
  });
}

export function compoundShipmentCustody(g: Game): void {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites) {
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [where, amount] of Object.entries(p.elites.forces))
        assert.ok(amount <= (p.forces[where] ?? 0));
    }
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  const ids = cards.map((c) => c.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    ids,
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
}
