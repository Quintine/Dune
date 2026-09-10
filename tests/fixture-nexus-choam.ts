import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import { gameDistance, splitLocation, TERRITORIES } from '../game/board';
import { treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { newRevivalRules } from '../game/revival';
import {
  nexusTraitorFixture,
  nexusTraitorInventory,
} from './fixture-nexus-traitors';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';

export type NexusChoamEffect =
  | 'kulon'
  | 'laLaLa'
  | 'gamont'
  | 'baliset'
  | 'jubba';
export const NEXUS_CHOAM_EFFECTS: NexusChoamEffect[] = [
  'kulon',
  'laLaLa',
  'gamont',
  'baliset',
  'jubba',
];
export type NexusChoamFixture = {
  g: Game;
  owner: string;
  target: string;
  observer: string;
  cost: Card;
  karama?: string;
  effect: NexusChoamEffect;
  selection: Record<string, unknown>;
};
export function holdNexusChoamCard(g: Game, owner: string, kind: string): Card {
  const index = g.deck.findIndex(
    (c) => c.kind === kind || c.effect === kind || c.name === kind,
  );
  assert.ok(index >= 0, `Missing physical ${kind}`);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card;
}
/** Final identities, faction roster, Advanced mode and Nexus components precede
 * genuine setup. Only conserved later board positions/phase boundaries are
 * staged; the public revival, move, storm and Mentat choices use real actions. */
export function nexusChoamFixture(
  effect: NexusChoamEffect,
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    opponentFaction?: 'guild' | 'emperor' | 'richese';
    costKind?: string;
    karama?: boolean;
  } = {},
): NexusChoamFixture {
  const [owner, target, observer] = options.seatIds ?? ['p', 'q', 'r'];
  const phase =
    effect === 'laLaLa'
      ? 4
      : effect === 'gamont'
        ? 7
        : effect === 'jubba'
          ? 0
          : 5;
  let g = nexusTraitorFixture({
    ownerFaction: 'choam',
    opponentFaction: options.opponentFaction,
    advanced: options.advanced ?? true,
    seatIds: [owner, target, observer],
    phase,
  });
  const cards = g.nexusCards!.cards!,
    index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner]!;
  cards.hands[owner] = 'choam';
  for (const p of g.players) {
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      moved: 0,
      shipped: true,
      revived: 0,
    });
    if (p.elites)
      Object.assign(p.elites, {
        forces: {},
        reserves: p.faction === 'emperor' ? 5 : 3,
        tanks: 0,
        revived: 0,
      });
  }
  Object.assign(g, {
    active: owner,
    order: [owner, target, observer],
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
    pendingRevival: null,
    choamMarket: null,
    movementRemaining: [owner, target, observer],
    spice: {},
  });
  const cost = holdNexusChoamCard(g, owner, options.costKind ?? 'projectile');
  const karama =
    options.karama === false
      ? undefined
      : holdNexusChoamCard(g, target, 'karama').id;
  const p = g.players[0],
    q = g.players[1];
  let selection: Record<string, unknown> = {};
  if (effect === 'laLaLa') {
    g.revivalRules = newRevivalRules();
    q.tanks = 4;
    q.reserves = 16;
    g = applyAction(g, target, { type: 'revive', amount: 3 });
    assert.equal(g.decision?.kind, 'choamFreeRevival');
    selection = { target };
  } else if (effect === 'jubba') {
    g.storm = 5;
    g.stormPending = 3;
    p.forces = { 'red_chasm:7': 4 };
    p.reserves = 16;
    q.forces = { 'red_chasm:7': 3 };
    q.reserves = 17;
    g.spice = { 'red_chasm:7': 8 };
    for (const id of g.order) g = applyAction(g, id, { type: 'ready' });
    assert.equal(g.decision?.kind, 'choamStorm');
    selection = { territory: 'red_chasm' };
  } else if (effect === 'baliset') {
    const source = 'red_chasm:7';
    const to = TERRITORIES.flatMap((t) =>
      t.sectors.map((s) => `${t.id}:${s}`),
    ).find((key) => {
      const loc = splitLocation(key);
      return (
        loc.territory !== 'red_chasm' &&
        loc.sector !== g.storm &&
        gameDistance(
          g,
          source,
          key,
          (k) => splitLocation(k).sector === g.storm,
        ) === 1
      );
    });
    assert.ok(to);
    p.forces = { [to]: 1 };
    p.reserves = 19;
    q.forces = { [source]: 3 };
    q.reserves = 17;
    g.active = target;
    g = applyAction(g, target, {
      type: 'move',
      from: source,
      amount: 2,
      ...splitLocation(to),
    });
    assert.equal(g.decision?.kind, 'choamMovement');
    selection = { target, territory: splitLocation(to).territory };
  } else if (effect === 'gamont') {
    q.forces = { 'arrakeen:10': 2 };
    q.reserves = 18;
    for (const id of g.order)
      if (g.phase === 7) g = applyAction(g, id, { type: 'ready' });
    assert.equal(g.decision?.kind, 'choamMarket');
    g = applyAction(g, owner, { type: 'decision', done: true });
    for (const id of g.order)
      if (!g.ready.includes(id)) g = applyAction(g, id, { type: 'ready' });
    assert.equal(g.decision?.kind, 'choamMarket');
    g = applyAction(g, owner, { type: 'decision', done: true });
    assert.equal(g.decision?.kind, 'choamMentat');
    selection = { target, from: 'arrakeen:10', elite: 0 };
  } else {
    p.forces = { 'red_chasm:7': 3 };
    p.reserves = 17;
  }
  nexusChoamInventory(g);
  return { g, owner, target, observer, cost, karama, effect, selection };
}
export function nexusChoamRequest(f: NexusChoamFixture, g = f.g): Action {
  return {
    type: 'card',
    mode: 'choam',
    card: f.cost.id,
    effect: f.effect,
    nexus: JSON.stringify([
      'nexusChoam',
      g.turn,
      g.phase,
      f.owner,
      f.cost.id,
      f.effect,
    ]),
    ...f.selection,
  };
}
export function nexusChoamInventory(g: Game) {
  if (!g.richeseCache) return nexusTraitorInventory(g);
  const extra = richeseCards(),
    ids = new Set(extra.map((card) => card.id));
  assert.deepEqual(
    [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((p) => p.hand),
      ...g.richeseCache,
    ]
      .map((card) => card.id)
      .sort(),
    [...treacheryDeck(g.expansions), ...extra].map((card) => card.id).sort(),
  );
  // The shared traitor fixture checks the ordinary deck. Above we independently
  // include every native Richese component, then reuse its other physical checks.
  const ordinary = structuredClone(g);
  ordinary.deck = ordinary.deck.filter((card) => !ids.has(card.id));
  ordinary.discard = ordinary.discard.filter((card) => !ids.has(card.id));
  for (const p of ordinary.players)
    p.hand = p.hand.filter((card) => !ids.has(card.id));
  nexusTraitorInventory(ordinary);
}
export const nexusChoamAllow = nexusAllow;
export const nexusChoamReload = nexusReload;
