import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { botActions } from '../game/bots';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { quoteHomeworldCustody } from '../game/homeworld-custody';

export const tupilePlayer = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
export const tupileReload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Real faction setup creates both signed ledgers using the final authenticated
 * seat IDs. Only conserved armies and a settled movement opportunity are staged;
 * the default contact then comes from an actual paid Homeworld shipment. */
export function tupileIntelligenceFixture(options: {
  seatIds?: [string, string, string]; contact?: boolean; advanced?: boolean;
} = {}): Game {
  const [c, a, h] = options.seatIds ?? ['c', 'a', 'h'];
  let g = createGame('TUPILEINTELLIGENCE', newPlayer(c, 'CHOAM', 'choam'), options.advanced ?? false, []);
  joinGame(g, newPlayer(a, 'Atreides', 'atreides'));
  joinGame(g, newPlayer(h, 'Harkonnen', 'harkonnen'));
  g = applyAction(g, c, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 60; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = applyAction(g, p.id, action); break; }
    }
    assert.ok(next, `Setup stalled at ${g.setupStage}/${g.decision?.kind}`);
    g = next;
  }
  assert.equal(g.status, 'playing');
  assert.equal(g.homeworlds?.historyVersion, 1);
  assert.equal(g.tupileIntelligence?.owner, c);
  assert.deepEqual(g.homeworldOccupationHistory?.qualifications, []);
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    Object.assign(p, { spice: 20, forces: {}, reserves: 20, tanks: 0, shipped: false, moved: 0 });
  }
  Object.assign(tupilePlayer(g, c), { reserves: 10, forces: { 'polar_sink:0': 10 } });
  Object.assign(g, {
    phase: 5, turn: 2, active: c, order: [c, a, h], movementRemaining: [c, a, h],
    ready: [], phaseOpening: null, response: null, decision: null, storm: 18, spice: {},
  });
  if (options.contact !== false) g = enterTupileContact(g);
  tupileInventory(g);
  return g;
}

export function enterTupileContact(g: Game): Game {
  const owner = g.players.find((p) => p.faction === 'choam')!;
  return applyAction(g, owner.id, {
    type: 'homeworldShip', event: viewGame(g, owner.id).homeworldShipment!.event,
    destination: 'homeworld:atreides', sources: { 'homeworld:choam': { normal: 1, elite: 0 } },
  });
}

/** Conserved leave/reentry scenarios exercise current contact without forging
 * occupation or intelligence receipts. Both worlds retain native garrisons. */
export function positionTupileContact(g: Game, present: boolean): void {
  const owner = g.players.find((p) => p.faction === 'choam')!;
  const one = { normal: 1, elite: 0 }, zero = { normal: 0, elite: 0 };
  const quote = quoteHomeworldCustody(homeworldContext(g), g.homeworlds!.custody!, [
    { homeworld: 'homeworld:choam', player: owner.id, withdraw: present ? one : zero, deposit: present ? zero : one },
    { homeworld: 'homeworld:atreides', player: owner.id, withdraw: present ? zero : one, deposit: present ? one : zero },
  ]);
  g.homeworlds!.custody = quote.state;
  for (const p of quote.players) tupilePlayer(g, p.id).reserves = p.reserves;
  tupileInventory(g);
}

export function holdTupileCard(g: Game, id: string, kind: string): Card {
  const index = g.deck.findIndex((card) => card.id === kind || card.kind === kind || card.effect === kind);
  assert.ok(index >= 0, `Missing canonical card ${kind}`);
  const card = g.deck.splice(index, 1)[0];
  tupilePlayer(g, id).hand.push(card);
  return card;
}
export function tupileReject(g: Game, id: string, action: Action, match: RegExp = /./): void {
  const before = tupileReload(g);
  assert.throws(() => applyAction(g, id, action), match);
  assert.deepEqual(g, before);
}
export function tupileInventory(g: Game): void {
  homeworldGameIntegrity(g);
  for (const p of g.players) {
    const visitors = Object.values(g.homeworlds!.custody!.visitors)
      .reduce((sum, world) => sum + (world[p.id]?.normal ?? 0) + (world[p.id]?.elite ?? 0), 0);
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0) + visitors, 20);
  }
  assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)].map((c) => c.id).sort(), baseDeck().map((c) => c.id).sort());
}
