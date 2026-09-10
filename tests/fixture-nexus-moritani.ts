import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { drawNexusCard } from '../game/nexus-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { TERROR_KINDS, type TerrorKind } from '../game/moritani-terror';
import { TERRITORIES } from '../game/board';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import {
  enterNexusSpice,
  finishNexusSpice,
  orderNexusSpice,
  nexusAllow,
  nexusReload,
} from './fixture-nexus-cards';

export type NexusMoritaniFixture = {
  g: Game;
  owner: string;
  target: string;
  observer: string;
  karama?: string;
};
/** Final faction/seat/module choices precede genuine initialization. The later
 * conserved position is staged before actual Collection -> Mentat actions. */
export function nexusMoritaniFixture(
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    homeworlds?: boolean;
    native?: number;
    karama?: boolean;
    stack?: boolean;
  } = {},
): NexusMoritaniFixture {
  const [owner, target, observer] = options.seatIds ?? ['p', 'q', 'r'];
  let g = createGame(
    'MORITANINEXUS',
    newPlayer(owner, 'Moritani', 'moritani'),
    options.advanced ?? false,
    [],
  );
  joinGame(g, newPlayer(target, 'Guild', 'guild'));
  joinGame(g, newPlayer(observer, 'Fremen', 'fremen'));
  if (options.homeworlds)
    g = applyAction(g, owner, { type: 'homeworlds', enabled: true });
  g.nexusCards = { cards: null, phase: null };
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeNexusGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 80; i++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const v = viewGame(g, p.id);
      v.players.find((s) => s.id === p.id)!.bot = 'Easy';
      const a = botActions(v)[0];
      if (a) {
        next = applyAction(g, p.id, a);
        break;
      }
    }
    assert.ok(next, `Setup stalled at ${g.setupStage}/${g.decision?.kind}`);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  g = enterNexusSpice(g);
  orderNexusSpice(g, ['land', 'land']);
  g = finishNexusSpice(g);
  for (const p of g.players) {
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      shipped: true,
      moved: 0,
    });
    if (p.elites)
      Object.assign(p.elites, { forces: {}, reserves: 3, tanks: 0 });
  }
  // Complete the first genuine Mentat opportunity before staging turn two.
  // Stack fixtures actually place Sabotage at that first opportunity.
  Object.assign(g, {
    phase: 5,
    active: target,
    movementRemaining: [target],
    order: [owner, target, observer],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    spice: {},
    storm: 18,
  });
  g = applyAction(g, target, { type: 'endMovement' });
  if (g.decision?.kind === 'grummanCollection')
    g = applyAction(g, owner, {
      type: 'decision',
      event: g.grummanCollection!.event,
      decline: true,
    });
  for (const id of g.order) g = applyAction(g, id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  g = options.stack
    ? nexusAllow(
        applyAction(g, owner, {
          type: 'decision',
          token: nexusMoritaniToken(g, 'sabotage').id,
          territory: 'arrakeen',
        }),
      )
    : applyAction(g, owner, { type: 'decision', decline: true });
  let nextSpiceOrdered = false;
  for (let step = 0; g.phase !== 2 && step < 80; step++) {
    if (g.phase === 1 && !nextSpiceOrdered) {
      orderNexusSpice(g, ['land', 'land']);
      nextSpiceOrdered = true;
    }
    g = automaticStep(g);
  }
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 2);
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      shipped: true,
      moved: 0,
    });
    if (p.elites)
      Object.assign(p.elites, { forces: {}, reserves: 3, tanks: 0 });
  }
  const native = options.native ?? 8;
  g.players[0].reserves = native;
  g.players[0].forces = { 'polar_sink:0': 20 - native };
  const cards = g.nexusCards!.cards!;
  cards.deck = [
    'moritani',
    ...cards.deck.filter((card) => card !== 'moritani'),
  ];
  g.nexusCards!.cards = drawNexusCard(cards, owner, g.players, () => 0);
  const karama =
    options.karama === false
      ? undefined
      : holdNexusMoritaniCard(g, target, 'karama').id;
  Object.assign(g, {
    turn: 2,
    phase: 5,
    active: target,
    movementRemaining: [target],
    order: [owner, target, observer],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    spice: {},
    storm: 18,
  });
  g = applyAction(g, target, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  if (g.decision?.kind === 'grummanCollection')
    g = applyAction(g, owner, {
      type: 'decision',
      event: g.grummanCollection!.event,
      decline: true,
    });
  for (const id of g.order) g = applyAction(g, id, { type: 'ready' });
  assert.equal(g.phase, 8);
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  nexusMoritaniInventory(g);
  return { g, owner, target, observer, karama };
}
export function holdNexusMoritaniCard(g: Game, owner: string, kind: string) {
  const i = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
  assert.ok(i >= 0);
  const card = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card;
}
function automaticStep(g: Game): Game {
  for (const p of g.players) {
    const v = viewGame(g, p.id);
    v.players.find((s) => s.id === p.id)!.bot = 'Easy';
    const action = botActions(v)[0];
    if (action) return applyAction(g, p.id, action);
  }
  throw new Error(
    `Phase progression stalled at ${g.phase}/${g.decision?.kind}/${g.response?.kind}`,
  );
}
export const nexusMoritaniToken = (g: Game, kind: TerrorKind) =>
  g.moritaniTerror!.tokens.find((token) => token.kind === kind)!;
export function nexusMoritaniRequest(
  f: NexusMoritaniFixture,
  kind: TerrorKind = 'robbery',
  territory = 'red_chasm',
  g = f.g,
): Action {
  return {
    type: 'decision',
    token: nexusMoritaniToken(g, kind).id,
    territory,
    nexus: viewGame(g, f.owner).nexusMoritani!.event,
  };
}
export function nexusMoritaniInventory(g: Game) {
  nexusTraitorInventory(g);
  if (g.homeworlds) homeworldGameIntegrity(g);
  assert.deepEqual(
    g.moritaniTerror!.tokens.map((t) => t.kind).sort(),
    [...TERROR_KINDS].sort(),
  );
  assert.equal(new Set(g.moritaniTerror!.tokens.map((t) => t.id)).size, 6);
}
/** Advance actual phase boundaries with legal bot choices before shipping;
 * signed placement and Nexus phase history are retained unchanged. */
export function nexusMoritaniMovement(state: Game): Game {
  let g = nexusReload(state);
  const target = g.players.find((p) => p.faction === 'guild')!;
  // Finish actual Mentat, Storm, Spice Blow, Charity, Bidding and Revival.
  // In particular the Nexus phase receipt is created by the real next Storm.
  for (let step = 0; g.phase !== 5 && step < 160; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(
      next,
      `Next-turn progression stalled at ${g.phase}/${g.decision?.kind}/${g.response?.kind}`,
    );
    g = next;
  }
  assert.equal(g.phase, 5);
  for (let step = 0; g.active !== target.id && step < g.players.length; step++)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.active, target.id);
  assert.equal(g.players.find((p) => p.id === target.id)!.shipped, false);
  nexusMoritaniInventory(g);
  return g;
}
export function nexusMoritaniArrival(
  state: Game,
  territory: string,
  amount = 3,
): Game {
  let g = nexusMoritaniMovement(state);
  const target = g.players.find((p) => p.faction === 'guild')!;
  const sector = TERRITORIES.find((t) => t.id === territory)!.sectors.find(
    (s) => s !== g.storm,
  )!;
  g = applyAction(g, target.id, { type: 'ship', territory, sector, amount });
  nexusMoritaniInventory(g);
  return g;
}
export const nexusMoritaniAllow = nexusAllow;
export const nexusMoritaniReload = nexusReload;
