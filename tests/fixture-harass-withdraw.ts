import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeEcazTreacheryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck, type Card } from '../game/cards';
import { faction, type FactionId } from '../game/catalog';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { traitorDeck } from '../game/traitors';

export function takeHarassCard(g: Game, owner: string, cardId: string): Card {
  const target = g.players.find((p) => p.id === owner)!;
  for (const zone of [g.deck, g.discard, ...g.players.map((p) => p.hand)]) {
    const index = zone.findIndex((c) => c.id === cardId);
    if (index < 0) continue;
    const [card] = zone.splice(index, 1);
    target.hand.push(card);
    return card;
  }
  throw new Error(`Missing physical fixture card ${cardId}`);
}
export function finishHarassPreparation(game: Game): Game {
  for (let count = 0; count < 60; count++) {
    if (
      game.battle?.preLeader &&
      !game.battle.preLeader.closed &&
      !game.response &&
      !game.decision
    ) {
      const player = [game.battle.attacker, game.battle.defender].find(
        (id) => !game.battle!.preLeader!.ready.includes(id),
      )!;
      game = applyAction(game, player, {
        type: 'battlePreparationReady',
        event: game.battle.preLeader.event,
      });
    } else if (game.response) {
      const player = game.players.find(
        (p) => !game.response!.passed.includes(p.id),
      )!;
      game = applyAction(game, player.id, { type: 'passResponse' });
    } else if (game.battle?.preparation) {
      game = applyAction(game, game.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    } else if (game.decision?.kind === 'fullPlanOffer') {
      game = applyAction(game, game.decision.player, {
        type: 'decision',
        decline: true,
      });
    } else return game;
  }
  throw new Error('Battle preparation did not complete.');
}
/** Genuine variant setup; hands and Arrakeen losses/positions are explicitly staged with conserved pieces. */
export function harassWithdrawGame({
  advanced = false,
  factions = ['emperor', 'atreides', 'tleilaxu'] as readonly FactionId[],
  ids = ['a', 'd', 't'] as readonly string[],
  normal = 5,
  elite = 0,
  prepare = true,
  territory = 'arrakeen',
  sector = 10,
} = {}): Game {
  assert.equal(factions.length, ids.length);
  const expansions = [
    ...new Set(
      factions.map((id) => faction(id).expansion).filter((id) => id !== 'base'),
    ),
  ] as ('ix' | 'choam' | 'ecaz')[];
  let g = createGame(
    'HARASSQA',
    newPlayer(ids[0], factions[0], factions[0]),
    advanced,
    expansions,
  );
  factions
    .slice(1)
    .forEach((id, index) => joinGame(g, newPlayer(ids[index + 1], id, id)));
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeEcazTreacheryGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((p) => p.id === player.id)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const [index, player] of g.players.entries()) {
    g.deck.push(...player.hand);
    player.hand = [];
    const amount = index === 0 ? normal + elite : index === 1 ? 5 : 0;
    player.forces = amount ? { [`${territory}:${sector}`]: amount } : {};
    player.reserves = 20 - amount;
    player.tanks = 0;
    player.spice = 30;
    player.battleLosses = 0;
    if (player.elites) {
      const total =
        player.faction === 'emperor' ? 5 : player.faction === 'ixians' ? 7 : 3;
      const selected = index === 0 ? elite : 0;
      assert.ok(selected <= total);
      player.elites = {
        reserves: total - selected,
        tanks: 0,
        forces: selected ? { [`${territory}:${sector}`]: selected } : {},
        revived: 0,
      };
    } else assert.ok(index !== 0 || !elite);
  }
  takeHarassCard(g, ids[0], 'ecaz-harass-withdraw');
  Object.assign(g, {
    turn: 2,
    phase: 6,
    storm: 18,
    order: [...ids],
    active: ids[0],
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  g = applyAction(g, ids[0], {
    type: 'chooseBattle',
    territory,
    target: ids[1],
  });
  return prepare ? finishHarassPreparation(g) : g;
}
export function harassCustody(g: Game) {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.deepEqual(
    cards.map((c) => c.id).sort(),
    [...treacheryDeck(g.expansions), ...ecazTreacheryCards()]
      .map((c) => c.id)
      .sort(),
  );
  assert.deepEqual(
    [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => [
        ...p.traitors,
        ...(p.faceDancers ?? []).map((c) => c.leader),
      ]),
    ].sort(),
    traitorDeck(g.players, g.expansions.includes('ix')).sort(),
  );
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(
      [p.reserves, p.tanks, ...Object.values(p.forces)].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ),
    );
    if (p.elites) {
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'emperor' ? 5 : p.faction === 'ixians' ? 7 : 3,
      );
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, amount] of Object.entries(p.elites.forces))
        assert.ok(amount <= (p.forces[key] ?? 0));
    }
  }
}
