import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { botActions } from '../game/bots';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { placeTerror, type TerrorKind } from '../game/moritani-terror';

export const grummanPlayer = (g: Game, id: string) =>
  g.players.find((p) => p.id === id)!;
export const grummanReload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Real Homeworld audit initialization and faction setup. Only the conserved
 * pre-Collection board position is staged; no signed phase/arrival is fabricated.
 * Runtime Moritani support here does not lift its public expansion-start gate. */
export function grummanCollectionFixture(
  options: {
    native?: number;
    advanced?: boolean;
    seatIds?: [string, string, string];
  } = {},
): Game {
  const [m, a, h] = options.seatIds ?? ['m', 'a', 'g'];
  let g = createGame(
    'GRUMMANCOLLECTION',
    newPlayer(m, 'Moritani', 'moritani'),
    options.advanced ?? false,
    [],
  );
  joinGame(g, newPlayer(a, 'Atreides', 'atreides'));
  joinGame(g, newPlayer(h, 'Harkonnen', 'harkonnen'));
  g = applyAction(g, m, { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 60; n++) {
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
    assert.ok(next, `Setup stalled at ${g.setupStage}/${g.decision?.kind}`);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    Object.assign(p, {
      spice: 20,
      forces: {},
      reserves: 20,
      tanks: 0,
      shipped: true,
      moved: 0,
    });
  }
  const owner = grummanPlayer(g, m);
  owner.reserves = options.native ?? 8;
  owner.forces = { 'polar_sink:0': 20 - owner.reserves };
  assert.ok(g.moritaniTerror);
  const robbery = g.moritaniTerror.tokens.find(
    (token) => token.kind === 'robbery',
  )!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, robbery.id, 'arrakeen', 1);
  Object.assign(g, {
    phase: 5,
    turn: 2,
    active: a,
    movementRemaining: [a],
    order: [a, m, h],
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
    storm: 18,
    spice: {},
  });
  grummanInventory(g);
  return g;
}

export function enterGrummanCollection(g: Game): Game {
  const before = grummanReload(g);
  const next = applyAction(g, g.active!, { type: 'endMovement' });
  assert.deepEqual(g, before);
  assert.equal(next.phase, 7);
  grummanInventory(next);
  return next;
}
export function grummanToken(g: Game, kind: TerrorKind) {
  return g.moritaniTerror!.tokens.find((token) => token.kind === kind)!;
}
export function addGrummanToken(
  g: Game,
  kind: TerrorKind = 'sabotage',
  territory = 'arrakeen',
): Game {
  assert.equal(g.decision?.kind, 'grummanCollection');
  return applyAction(g, g.grummanCollection!.player, {
    type: 'decision',
    event: g.grummanCollection!.event,
    mode: 'add',
    token: grummanToken(g, kind).id,
    territory,
  });
}
export function holdGrummanCard(g: Game, player: string, kind: string): Card {
  const index = g.deck.findIndex(
    (card) => card.kind === kind || card.effect === kind,
  );
  assert.ok(index >= 0, `Missing ${kind}`);
  const card = g.deck.splice(index, 1)[0];
  grummanPlayer(g, player).hand.push(card);
  return card;
}
/** Later movement checkpoint preserves the actual Collection receipt/stack.
 * IDs derive from factions so SQL fixtures can bind seats before signing. */
export function stageGrummanArrival(g: Game): Game {
  const next = grummanReload(g);
  const entrant = next.players.find((p) => p.faction === 'atreides')!;
  Object.assign(next, {
    turn: g.turn + 1,
    phase: 5,
    active: entrant.id,
    movementRemaining: [entrant.id],
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  entrant.shipped = false;
  entrant.moved = 0;
  grummanInventory(next);
  return next;
}
export function enterGrummanStack(g: Game, amount = 1): Game {
  return applyAction(g, g.active!, {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount,
  });
}
export function grummanReject(
  g: Game,
  id: string,
  action: Action,
  match: RegExp = /./,
): void {
  const before = grummanReload(g);
  assert.throws(() => applyAction(g, id, action), match);
  assert.deepEqual(g, before);
}
export function grummanInventory(g: Game): void {
  homeworldGameIntegrity(g);
  for (const p of g.players)
    assert.equal(
      p.reserves +
        p.tanks +
        Object.values(p.forces).reduce((sum, n) => sum + n, 0),
      20,
    );
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((card) => card.id)
      .sort(),
    baseDeck()
      .map((card) => card.id)
      .sort(),
  );
  assert.equal(g.moritaniTerror!.tokens.length, 6);
  assert.equal(
    new Set(g.moritaniTerror!.tokens.map((token) => token.id)).size,
    6,
  );
  assert.equal(
    new Set(g.moritaniTerror!.tokens.map((token) => token.kind)).size,
    6,
  );
}
