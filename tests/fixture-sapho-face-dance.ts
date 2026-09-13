import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  type Game,
} from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import {
  nextSaphoBattleAction,
  takeSaphoBattleCard,
} from './fixture-sapho-battle-order';

/** Real five-faction Ix/CHOAM setup; later hands, forces and one Face Dancer identity are staged by conserved swaps. */
export function saphoFaceDanceGame(advanced = false): {
  game: Game;
  winnerLeader: string;
  loserLeader: string;
} {
  const ids = ['a', 'b', 'c', 'r', 't'];
  const factions = [
    'emperor',
    'guild',
    'atreides',
    'richese',
    'tleilaxu',
  ] as const;
  let g = createGame(
    'SAPHOFD',
    newPlayer('a', 'Emperor', 'emperor'),
    advanced,
    ['ix', 'choam'],
  );
  for (let index = 1; index < ids.length; index++)
    joinGame(g, newPlayer(ids[index], factions[index], factions[index]));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeFactionExpansionsGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 100; step++) {
    const next = nextSaphoBattleAction(g);
    assert.ok(next);
    g = applyAction(g, next.player, next.action);
  }
  assert.equal(g.status, 'playing');
  for (const [index, p] of g.players.entries()) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = index < 3 ? { 'arrakeen:10': 3 } : {};
    p.reserves = index < 3 ? 17 : 20;
    p.tanks = 0;
    p.spice = 20;
    p.shipped = false;
    p.moved = 0;
    if (p.elites) p.elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  }
  takeSaphoBattleCard(g, 'a');
  const winnerLeader = [...g.players[1].leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0].id;
  const loserLeader = [...g.players[2].leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0].id;
  const dancer = g.players[4].faceDancers![0];
  const old = dancer.leader;
  const reserve = g.traitorReserve!.indexOf(winnerLeader);
  if (reserve >= 0) g.traitorReserve![reserve] = old;
  else {
    let replaced = false;
    for (const p of g.players) {
      const held = p.traitors.indexOf(winnerLeader);
      if (held >= 0) {
        p.traitors[held] = old;
        replaced = true;
        break;
      }
      const face = p.faceDancers?.find((card) => card.leader === winnerLeader);
      if (face) {
        face.leader = old;
        replaced = true;
        break;
      }
    }
    assert.ok(replaced, 'The genuine physical traitor identity must exist.');
  }
  dancer.leader = winnerLeader;
  Object.assign(g, {
    turn: 2,
    phase: 5,
    storm: 18,
    order: ids,
    active: 'a',
    movementRemaining: [...ids],
    guildTimingLocked: true,
    guildTimingGranted: false,
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  while (g.phaseOpening) {
    const next = nextSaphoBattleAction(g)!;
    g = applyAction(g, next.player, next.action);
  }
  assert.equal(g.phase, 6);
  saphoFaceDanceCustody(g);
  return { game: g, winnerLeader, loserLeader };
}
export function saphoFaceDanceCustody(g: Game) {
  assert.deepEqual(
    [
      ...g.deck,
      ...g.discard,
      ...(g.richeseCache ?? []),
      ...(g.richeseRemoved ?? []),
      ...g.players.flatMap((p) => p.hand),
    ]
      .map((c) => c.id)
      .sort(),
    [...treacheryDeck(g.expansions), ...richeseCards()].map((c) => c.id).sort(),
  );
  assert.deepEqual(
    [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => [
        ...p.traitors,
        ...(p.faceDancers ?? []).map((c) => c.leader),
      ]),
    ].sort(),
    traitorDeck(g.players, true).sort(),
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
