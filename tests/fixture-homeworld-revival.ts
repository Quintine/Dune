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
import { botActions } from '../game/bots';
import { baseDeck, ixDeck } from '../game/cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';

export const revivalPlayer = (g: Game, id: string) =>
  g.players.find((player) => player.id === id)!;
export const revivalReload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Real Homeworld audit initialization and setup actions, including Tleilaxu
 * when requested. Only the later Charity phase and physical positions are
 * staged; no expansion faction substitution or invented revival receipt. */
export function homeworldRevivalFixture(
  options: {
    advanced?: boolean;
    tleilaxu?: boolean;
  } = {},
): Game {
  let g = createGame(
    'HOMEREVIVAL',
    newPlayer('f', 'Fremen', 'fremen'),
    options.advanced ?? false,
    options.tleilaxu ? ['ix'] : [],
  );
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  if (options.tleilaxu) joinGame(g, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g = applyAction(g, 'f', { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 100; n++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine Homeworld setup must make progress.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) {
    g.deck.push(...player.hand.splice(0));
    player.spice = 20;
  }
  Object.assign(g, {
    phase: 2,
    turn: 2,
    storm: 18,
    active: null,
    ready: [],
    order: g.players.map((player) => player.id),
    phaseOpening: null,
    response: null,
    decision: null,
  });
  positionRevivalForces(g, 'f', { native: 3, tanks: 5, eliteTanks: 2 });
  if (options.tleilaxu) positionRevivalForces(g, 't', { native: 9, tanks: 5 });
  revivalInventory(g);
  return g;
}

/** Place only Fremen/Tleilaxu counters, retaining all twenty physical IDs and
 * the three starred Fremen. Emperor's original Salusa allocation stays intact. */
export function positionRevivalForces(
  g: Game,
  id: string,
  counts: {
    native: number;
    tanks: number;
    eliteTanks?: number;
  },
) {
  const player = revivalPlayer(g, id);
  assert.ok(['fremen', 'tleilaxu'].includes(player.faction));
  const board = 20 - counts.native - counts.tanks;
  assert.ok(board >= 0);
  player.reserves = counts.native;
  player.tanks = counts.tanks;
  player.forces = board ? { 'arrakeen:10': board } : {};
  if (player.faction === 'fremen') {
    const eliteTanks = counts.eliteTanks ?? 0;
    const native = Math.min(counts.native, 3 - eliteTanks);
    const eliteBoard = 3 - eliteTanks - native;
    assert.ok(eliteTanks <= counts.tanks && eliteBoard <= board);
    player.elites = {
      reserves: native,
      tanks: eliteTanks,
      forces: eliteBoard ? { 'arrakeen:10': eliteBoard } : {},
      revived: 0,
    };
  }
  homeworldGameIntegrity(g);
}

/** Enter through actual Charity readiness, ordinary auction passes and Amal. */
export function enterHomeworldRevival(state: Game): Game {
  let g = state;
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  for (let n = 0; (g.phase === 3 || g.phaseOpening) && n < 100; n++) {
    if (g.phaseOpening) {
      const id = g.players.find(
        (player) => !g.phaseOpening!.passed.includes(player.id),
      )!.id;
      g = applyAction(g, id, { type: 'ready' });
    } else {
      assert.ok(g.auction?.active);
      g = applyAction(g, g.auction.active, { type: 'passBid' });
    }
  }
  assert.equal(g.phase, 4);
  assert.equal(g.phaseOpening ?? null, null);
  revivalInventory(g);
  return g;
}

export function holdRevivalCard(
  g: Game,
  owner: string,
  effect: string,
): string {
  const index = g.deck.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0, `${effect} must exist in actual deck custody.`);
  const [card] = g.deck.splice(index, 1);
  revivalPlayer(g, owner).hand.push(card);
  return card.id;
}

export function revivalInventory(g: Game) {
  homeworldGameIntegrity(g);
  const sum = (values: Record<string, number>) =>
    Object.values(values).reduce((a, b) => a + b, 0);
  for (const player of g.players) {
    const visitors = Object.values(g.homeworlds!.custody!.visitors).map(
      (groups) => groups[player.id] ?? { normal: 0, elite: 0 },
    );
    assert.equal(
      player.reserves +
        player.tanks +
        sum(player.forces) +
        visitors.reduce(
          (total, group) => total + group.normal + group.elite,
          0,
        ),
      20,
    );
    if (player.elites)
      assert.equal(
        player.elites.reserves +
          player.elites.tanks +
          sum(player.elites.forces) +
          visitors.reduce((total, group) => total + group.elite, 0),
        player.faction === 'fremen' ? 3 : 5,
      );
    assert.ok(player.spice >= 0);
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ];
  assert.deepEqual(
    cards.map((card) => card.id).sort(),
    [...baseDeck(), ...(g.expansions.includes('ix') ? ixDeck() : [])]
      .map((card) => card.id)
      .sort(),
  );
}

export function rejectRevivalAction(
  g: Game,
  actor: string,
  action: Action,
  error?: RegExp,
) {
  const before = structuredClone(g);
  if (error) assert.throws(() => applyAction(g, actor, action), error);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
