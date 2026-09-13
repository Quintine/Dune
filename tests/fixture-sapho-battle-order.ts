import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';

export const SAPHO_BATTLE_CARD = 'richese-juice-of-sapho';
export function takeSaphoBattleCard(
  g: Game,
  owner: string,
  card = SAPHO_BATTLE_CARD,
) {
  for (const zone of [
    g.deck,
    g.discard,
    g.richeseCache ?? [],
    ...g.players.map((p) => p.hand),
  ]) {
    const at = zone.findIndex((c) => c.id === card);
    if (at < 0) continue;
    g.players.find((p) => p.id === owner)!.hand.push(zone.splice(at, 1)[0]);
    return;
  }
  throw new Error(`Missing physical fixture card ${card}`);
}
/** Genuine faction setup, followed by explicitly conserved hands and multi-battle topology. */
export function saphoBattleOrderGame({
  advanced = false,
  holder = 'c',
  seatIds = ['a', 'b', 'c', 'r'] as readonly [string, string, string, string],
  geometry = 'shared' as 'shared' | 'separate',
} = {}): Game {
  const factions = ['emperor', 'guild', 'atreides', 'richese'] as const;
  let g = createGame(
    'SAPHOBAT',
    newPlayer(seatIds[0], 'Emperor', factions[0]),
    advanced,
    ['choam'],
  );
  for (let i = 1; i < seatIds.length; i++)
    joinGame(g, newPlayer(seatIds[i], factions[i], factions[i]));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeFactionExpansionsGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 100; step++) {
    const next = nextSaphoBattleAction(g);
    assert.ok(next, 'Genuine setup must have an owned action.');
    g = applyAction(g, next.player, next.action);
  }
  assert.equal(g.status, 'playing');
  const shared: Record<string, number>[] = [
    { 'arrakeen:10': 3, 'carthag:11': 3 },
    { 'arrakeen:10': 3, 'carthag:11': 3, 'imperial_basin:9': 3 },
    { 'arrakeen:10': 3, 'imperial_basin:9': 3 },
    {},
  ];
  const separate: Record<string, number>[] = [
    { 'carthag:11': 4 },
    { 'carthag:11': 4 },
    { 'arrakeen:10': 4 },
    { 'arrakeen:10': 4 },
  ];
  for (const [index, p] of g.players.entries()) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = { ...(geometry === 'shared' ? shared[index] : separate[index]) };
    p.reserves = 20 - Object.values(p.forces).reduce((a, b) => a + b, 0);
    p.tanks = 0;
    p.spice = 30;
    p.shipped = false;
    p.moved = 0;
    if (p.elites) p.elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  }
  const index = ['a', 'b', 'c', 'r'].indexOf(holder);
  const owner = index >= 0 ? seatIds[index] : holder;
  takeSaphoBattleCard(g, owner);
  // Starting from a clean combined-turn boundary avoids inventing completed battles.
  Object.assign(g, {
    turn: 2,
    phase: 5,
    storm: 18,
    order: [...seatIds],
    active: seatIds[0],
    movementRemaining: [...seatIds],
    guildTimingLocked: true,
    guildTimingGranted: false,
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.phase, 6);
  saphoBattleCustody(g);
  return g;
}
export function saphoBattleOrderAction(
  g: Game,
  owner: string,
  mode: 'first' | 'last',
): Action {
  const option = viewGame(g, owner).saphoOptions.find(
    (o) => o.scope === 'battleOrder' && o.mode === mode,
  );
  assert.ok(option, `Missing ${mode} battle-order option for ${owner}.`);
  return { type: 'card', card: SAPHO_BATTLE_CARD, ...option };
}
export function chooseSaphoBattleAction(g: Game): {
  player: string;
  action: Action;
} {
  assert.ok(g.active && !g.battle);
  const choice = viewGame(g, g.active).battleChoices.find(
    (c) => c.chooser === g.active,
  );
  assert.ok(choice);
  return {
    player: g.active,
    action: {
      type: 'chooseBattle',
      territory: choice.territory,
      target: choice.attacker === g.active ? choice.defender : choice.attacker,
    },
  };
}
/** One real owner action, suitable for either applyAction or authenticated room.act. */
export function nextSaphoBattleAction(
  g: Game,
): { player: string; action: Action } | null {
  if (
    !g.response &&
    !g.decision &&
    g.battle?.preparation &&
    (!g.battle.preLeader || g.battle.preLeader.closed) &&
    ['voice', 'prescience'].includes(g.battle.preparation.kind)
  )
    return {
      player: g.battle.preparation.owner,
      action: { type: 'declineBattlePower' },
    };
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    view.players.find((player) => player.id === p.id)!.bot = 'Medium';
    if (
      g.battle &&
      !g.response &&
      !g.decision &&
      !g.battle.preparation &&
      (!g.battle.preLeader || g.battle.preLeader.closed) &&
      !g.battle.prescience &&
      !g.battle.nexusInspection &&
      !g.battle.voice &&
      [g.battle.attacker, g.battle.defender].includes(p.id) &&
      !g.battle.plans[p.id]
    ) {
      const leader = p.leaders.find(
        (l) =>
          !l.dead &&
          !l.capturedBy &&
          (!l.usedAt || l.usedAt === g.battle!.territory),
      );
      if (leader)
        return {
          player: p.id,
          action: {
            type: 'battlePlan',
            dial: 0,
            support: 0,
            leader: leader.id,
          },
        };
    }
    const action = botActions(view)[0];
    if (action) return { player: p.id, action };
  }
  return null;
}
export function resolveSaphoBattle(state: Game): Game {
  let g = state;
  assert.ok(g.battle);
  for (let step = 0; step < 120; step++) {
    if (
      !g.battle &&
      (g.phase !== 6 || viewGame(g, g.players[0].id).battleOrder?.current)
    )
      return g;
    const next = nextSaphoBattleAction(g);
    assert.ok(
      next,
      'The selected battle must retain a finite owned continuation.',
    );
    g = applyAction(g, next.player, next.action);
  }
  throw new Error('Battle continuation exceeded its fixture limit.');
}
export function saphoBattleCustody(g: Game) {
  const physical = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...g.players.flatMap((p) => p.hand),
  ];
  assert.deepEqual(
    physical.map((c) => c.id).sort(),
    [...treacheryDeck(g.expansions), ...richeseCards()].map((c) => c.id).sort(),
  );
  assert.deepEqual(
    [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => p.traitors),
    ].sort(),
    traitorDeck(g.players, false).sort(),
  );
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
  }
}
