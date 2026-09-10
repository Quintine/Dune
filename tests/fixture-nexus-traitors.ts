import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { createAuditorLeader, leaders, treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { drawNexusCard, validateNexusCards } from '../game/nexus-cards';
import { validateNexusTraitorSnapshot } from '../game/nexus-traitor-exchange';
import {
  enterNexusSpice,
  finishNexusSpice,
  orderNexusSpice,
} from './fixture-nexus-cards';

export function nexusTraitorFixture(
  options: {
    ownerFaction?: FactionId;
    opponentFaction?: FactionId;
    advanced?: boolean;
    ix?: boolean;
    seatIds?: [string, string, string];
    phase?: number;
  } = {},
): Game {
  const [p, q, r] = options.seatIds ?? ['p', 'q', 'r'];
  let g = createGame(
    'TRAITORAUDIT',
    newPlayer(p, 'Owner', 'harkonnen'),
    options.advanced ?? false,
    options.ix ? ['ix'] : [],
  );
  joinGame(g, newPlayer(q, 'Opponent', 'guild'));
  joinGame(g, newPlayer(r, 'Observer', 'fremen'));
  // Final faction is fixed before the genuine component/setup initializer.
  g.players[0] = newPlayer(p, 'Owner', options.ownerFaction ?? 'harkonnen');
  if (options.opponentFaction)
    g.players[1] = newPlayer(q, 'Opponent', options.opponentFaction);
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g.nexusCards = { cards: null, phase: null };
  g = initializeNexusGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 80; i++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const v = viewGame(g, player.id);
      v.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(v)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, `Setup stalled at ${g.setupStage}/${g.decision?.kind}`);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  if (
    options.ix ||
    (g.advanced && g.players.some((p) => p.faction === 'choam'))
  ) {
    // Resolve actual CHOAM markets and Ix phase openings before advancing.
    for (let i = 0; g.phase === 0 && i < 30; i++) {
      let next: Game | undefined;
      for (const p of g.players) {
        const v = viewGame(g, p.id);
        v.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
        const action = botActions(v)[0];
        if (action) {
          next = applyAction(g, p.id, action);
          break;
        }
      }
      assert.ok(
        next,
        `Storm stalled at ${g.decision?.kind}/${g.response?.kind}`,
      );
      g = next;
    }
    assert.equal(g.phase, 1);
  } else g = enterNexusSpice(g);
  orderNexusSpice(g, ['land', 'land']);
  if (
    options.ix ||
    (g.advanced && g.players.some((p) => p.faction === 'choam'))
  ) {
    for (let i = 0; g.phase === 1 && i < 40; i++) {
      let next: Game | undefined;
      for (const p of g.players) {
        const v = viewGame(g, p.id);
        v.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
        const action = botActions(v)[0];
        if (action) {
          next = applyAction(g, p.id, action);
          break;
        }
      }
      assert.ok(
        next,
        `Spice phase stalled at ${g.decision?.kind}/${g.response?.kind}`,
      );
      g = next;
    }
    assert.equal(g.phase, 2);
  } else g = finishNexusSpice(g);
  Object.assign(g, {
    phase: options.phase ?? 8,
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    active: p,
    storm: 18,
  });
  const cards = g.nexusCards!.cards!;
  cards.deck = [
    'harkonnen',
    ...cards.deck.filter((card) => card !== 'harkonnen'),
  ];
  g.nexusCards!.cards = drawNexusCard(cards, p, g.players, () => 0);
  nexusTraitorInventory(g);
  return g;
}
export function nexusTraitorInventory(g: Game): void {
  validateNexusCards(g.nexusCards!.cards!, g.players);
  const universe = traitorDeck(
    g.players.map((p) => ({
      leaders: [
        ...leaders(p.faction),
        ...(g.advanced && p.faction === 'choam' ? [createAuditorLeader()] : []),
      ],
    })),
    g.expansions.includes('ix'),
  );
  validateNexusTraitorSnapshot(
    {
      reserve: g.traitorReserve!,
      players: g.players.map((p) => ({
        id: p.id,
        faction: p.faction,
        traitors: [...p.traitors],
        ...(p.faceDancers
          ? { faceDancers: structuredClone(p.faceDancers) }
          : {}),
      })),
    },
    universe,
  );
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    treacheryDeck(g.expansions)
      .map((c) => c.id)
      .sort(),
  );
  for (const p of g.players)
    assert.equal(
      p.reserves +
        p.tanks +
        Object.values(p.forces).reduce((sum, n) => sum + n, 0),
      20,
    );
}
export function nexusTraitorDraw(g: Game, id = g.players[0].id): Game {
  const offer = viewGame(g, id).nexusTraitors!.offer!;
  assert.equal(offer.blocked, null);
  return applyAction(g, id, {
    type: 'nexusTraitorDraw',
    event: offer.event,
    mode: offer.mode,
  });
}
export function nexusTraitorReturn(
  g: Game,
  cards: string[],
  id = g.players[0].id,
): Game {
  return applyAction(g, id, {
    type: 'nexusTraitorReturn',
    event: viewGame(g, id).nexusTraitors!.pending!.event,
    cards,
  });
}
/** Preserve every physical traitor identity while staging a known held traitor. */
export function holdNexusTraitor(g: Game, id: string, card: string): void {
  const owner = g.players.find((p) => p.id === id)!;
  if (owner.traitors.includes(card)) return;
  const replace = owner.traitors[0];
  assert.ok(replace);
  const reserveIndex = g.traitorReserve!.indexOf(card);
  if (reserveIndex >= 0) g.traitorReserve![reserveIndex] = replace;
  else {
    const other = g.players.find((p) => p.traitors.includes(card));
    assert.ok(other);
    other.traitors[other.traitors.indexOf(card)] = replace;
  }
  owner.traitors[0] = card;
}
export function nexusTraitorBattle(g: Game, reveal = true): Game {
  const [owner, target] = g.players;
  Object.assign(g, {
    phase: 6,
    active: owner.id,
    order: g.players.map((p) => p.id),
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
  }
  for (const p of [owner, target]) {
    p.forces = { 'pasty_mesa:5': 5 };
    p.reserves = 15;
  }
  g = applyAction(g, owner.id, {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: target.id,
  });
  for (const id of [owner.id, target.id])
    if (g.battle!.preLeader && !g.battle!.preLeader.closed)
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.event,
      });
  if (!reveal) return g;
  while (g.battle!.preparation)
    g = applyAction(g, g.battle!.preparation.owner, {
      type: 'declineBattlePower',
    });
  for (const id of [owner.id, target.id])
    g = applyAction(g, id, {
      type: 'battlePlan',
      dial: 0,
      leader: g.players.find((p) => p.id === id)!.leaders[0].id,
    });
  assert.equal(g.battle!.revealed, true);
  return g;
}
