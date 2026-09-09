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
import type { FactionId } from '../game/catalog';
import { baseDeck, ixDeck } from '../game/cards';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import { quoteHomeworldCustody } from '../game/homeworld-custody';

export const victoryPlayer = (g: Game, id: string) =>
  g.players.find((player) => player.id === id)!;
export const victoryReload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Genuine setup and physical cards; only the later phase and force positions
 * are staged. Optional Tleilaxu uses its actual Ix setup, not a faction swap. */
export function caladanVictoryFixture(
  options: {
    advanced?: boolean;
    tleilaxu?: boolean;
    native?: number;
    seatIds?: Record<string, string>;
    extraSeats?: readonly { id: string; faction: FactionId }[];
  } = {},
): Game {
  const id = (key: string) => options.seatIds?.[key] ?? key;
  let g = createGame(
    'CALADANVICTORY',
    newPlayer(id('a'), 'Atreides', 'atreides'),
    options.advanced ?? false,
    options.tleilaxu ? ['ix'] : [],
  );
  joinGame(g, newPlayer(id('g'), 'Guild', 'guild'));
  if (options.tleilaxu) joinGame(g, newPlayer(id('t'), 'Tleilaxu', 'tleilaxu'));
  // Audit-only final roster is fixed before setup signs public history.
  for (const extra of options.extraSeats ?? [])
    g.players.push(newPlayer(id(extra.id), extra.faction, extra.faction));
  g = applyAction(g, id('a'), { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 100; n++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const command = botActions(view)[0];
      if (command) {
        next = applyAction(g, player.id, command);
        break;
      }
    }
    assert.ok(next, 'Genuine Homeworld setup must supply an action.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) {
    g.deck.push(...player.hand.splice(0));
    player.spice = 20;
  }
  Object.assign(g, {
    phase: 6,
    turn: 2,
    storm: 18,
    phaseOpening: null,
    response: null,
    decision: null,
    active: id('a'),
    ready: [],
    order: g.players.map((player) => player.id),
  });
  positionVictoryArmy(g, id('a'), options.native ?? 6, 3);
  positionVictoryArmy(g, id('g'), 17, 3);
  if (options.tleilaxu) positionVictoryArmy(g, id('t'), 20, 0);
  for (const extra of options.extraSeats ?? []) {
    const player = victoryPlayer(g, id(extra.id));
    Object.assign(player, { reserves: 20, tanks: 0, forces: {} });
  }
  victoryInventory(g);
  return g;
}

export function positionVictoryArmy(
  g: Game,
  id: string,
  native: number,
  battleForces: number,
  tanks = 0,
) {
  const player = victoryPlayer(g, id);
  assert.equal(player.elites, undefined);
  const rest = 20 - native - battleForces - tanks;
  assert.ok(rest >= 0);
  Object.assign(player, {
    reserves: native,
    tanks,
    forces: {
      ...(battleForces ? { 'hagga_basin:12': battleForces } : {}),
      ...(rest ? { 'polar_sink:0': rest } : {}),
    },
  });
  homeworldGameIntegrity(g);
}

/** A scenario invasion conserves exact native/visitor custody. Actual shipment
 * availability and its phase-five reactions are outside these battle tests. */
export function positionVictoryInvader(
  g: Game,
  id: string,
  destination: string,
  amount: number,
) {
  const quote = quoteHomeworldCustody(
    homeworldContext(g),
    g.homeworlds!.custody!,
    [
      {
        homeworld: `homeworld:${victoryPlayer(g, id).faction}`,
        player: id,
        withdraw: { normal: amount, elite: 0 },
        deposit: { normal: 0, elite: 0 },
      },
      {
        homeworld: destination,
        player: id,
        withdraw: { normal: 0, elite: 0 },
        deposit: { normal: amount, elite: 0 },
      },
    ],
  );
  g.homeworlds!.custody = quote.state;
  for (const player of quote.players)
    victoryPlayer(g, player.id).reserves = player.reserves;
  victoryInventory(g);
}

export function holdVictoryCard(g: Game, player: string, kind: string): string {
  const index = g.deck.findIndex(
    (card) => card.kind === kind || card.effect === kind,
  );
  assert.ok(index >= 0, `An actual ${kind} must be available.`);
  const [card] = g.deck.splice(index, 1);
  victoryPlayer(g, player).hand.push(card);
  return card.id;
}

export function prepareVictoryBattle(
  state: Game,
  territory = 'hagga_basin',
  attacker = 'a',
  defender = 'g',
): Game {
  let g = applyAction(state, attacker, {
    type: 'chooseBattle',
    territory,
    target: defender,
  });
  for (let n = 0; n < 40; n++) {
    if (g.response) {
      const responder = g.players.find(
        (player) => !g.response!.passed.includes(player.id),
      )!;
      g = applyAction(g, responder.id, { type: 'passResponse' });
    } else if (g.battle?.preparation) {
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    } else if (g.decision) {
      assert.equal(g.decision.kind, 'fullPlanOffer');
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    } else break;
  }
  assert.ok(g.battle && !g.battle.preparation && !g.decision && !g.response);
  return g;
}

export function commitVictoryPlans(
  state: Game,
  options: {
    a?: Partial<Action>;
    g?: Partial<Action>;
  } = {},
): Game {
  let g = state;
  const atreides = g.players.find((player) => player.faction === 'atreides')!;
  const guildSeat = g.players.find((player) => player.faction === 'guild')!;
  const a = atreides.leaders.reduce((best, leader) =>
    leader.strength > best.strength ? leader : best,
  );
  const guild = guildSeat.leaders.reduce((best, leader) =>
    leader.strength < best.strength ? leader : best,
  );
  g = applyAction(g, atreides.id, {
    type: 'battlePlan',
    leader: a.id,
    dial: 1,
    support: g.advanced ? 1 : 0,
    ...options.a,
  });
  g = applyAction(g, guildSeat.id, {
    type: 'battlePlan',
    leader: guild.id,
    dial: 0,
    support: 0,
    ...options.g,
  });
  return g;
}

export function finishVictoryCalls(
  state: Game,
  calls: Record<string, boolean> = {},
): Game {
  let g = state;
  for (let n = 0; g.battle && n < 10; n++) {
    const view = viewGame(g, g.battle!.attacker).battle!;
    const voter = view.traitorVoters.find(
      (id) => g.battle!.traitorCalls[id] === undefined,
    );
    assert.ok(
      voter,
      'The revealed battle must have an outstanding real traitor voter.',
    );
    g = applyAction(g, voter, {
      type: 'traitorCall',
      call: calls[voter] ?? false,
    });
  }
  assert.equal(g.battle, null);
  return g;
}

export function victoryInventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const player of g.players) {
    const visitors = Object.values(g.homeworlds!.custody!.visitors).reduce(
      (sum, world) =>
        sum + (world[player.id]?.normal ?? 0) + (world[player.id]?.elite ?? 0),
      0,
    );
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0) +
        visitors,
      20,
    );
    assert.ok(player.spice >= 0);
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
  ];
  assert.deepEqual(
    cards.map((card) => card.id).sort(),
    [...baseDeck(), ...(g.expansions.includes('ix') ? ixDeck() : [])]
      .map((card) => card.id)
      .sort(),
  );
}
