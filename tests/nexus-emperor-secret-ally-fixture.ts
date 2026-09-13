import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  nexusTurnTwo,
  orderNexusSpice,
  finishNexusSpice,
  nexusReady,
  nexusInventory,
} from './fixture-nexus-cards';

/** Genuine Basic/Advanced initializer and real Nexus draw/bidding actions.
 * Shared setup returns starting hands to the deck; controlled physical spice
 * and Nexus order supplies the draw. The focused loss topology moves existing
 * reserve counters to Tanks; this is not an untouched full-game sample. */
export function nexusEmperorSecretAllyFixture(
  options: {
    advanced?: boolean;
    owner?: 'p' | 'q' | 'r';
    seatIds?: [string, string, string];
    tanks?: number;
    eliteTanks?: number;
  } = {},
) {
  const seatIds: [string,string,string] = options.seatIds ?? ['p', 'q', 'r'];
  const owner = seatIds[['p', 'q', 'r'].indexOf(options.owner ?? 'q')];
  let g = nexusTurnTwo({ advanced: options.advanced, seatIds });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  const others = g.players.filter((p) => p.id !== owner).map((p) => p.id);
  g = applyAction(g, others[0], { type: 'alliance', target: others[1] });
  g = applyAction(g, others[1], { type: 'alliance', target: others[0] });
  g = finishNexusSpice(g);
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  const cards = g.nexusCards!.cards!;
  cards.deck = ['emperor', ...cards.deck.filter((card) => card !== 'emperor')];
  g = applyAction(g, owner, {
    type: 'nexusCardChoice',
    turn: g.turn,
    card: null,
    choice: 'draw',
    ownRedraws: 0,
  });
  for (const id of g.nexusCards!.phase!.eligible)
    if (!g.nexusCards!.phase!.done.includes(id))
      g = applyAction(g, id, {
        type: 'nexusCardChoice',
        turn: g.turn,
        card: null,
        choice: 'keep',
        ownRedraws: 0,
      });
  assert.equal(g.phase, 2);
  g = nexusReady(g);
  for (let i = 0; g.phase === 3 && i < 15; i++) {
    if (g.phaseOpening)
      g = applyAction(
        g,
        g.players.find((p) => !g.phaseOpening!.passed.includes(p.id))!.id,
        { type: 'ready' },
      );
    else if (g.auction)
      g = applyAction(g, g.auction.active, { type: 'passBid' });
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 4);
  assert.equal(g.decision, null);
  const p = g.players.find((p) => p.id === owner)!;
  const tanks = options.tanks ?? 6,
    elite = options.eliteTanks ?? 0;
  assert.ok(tanks <= p.reserves && elite <= (p.elites?.reserves ?? 0));
  p.reserves -= tanks;
  p.tanks += tanks;
  if (p.elites) {
    p.elites.reserves -= elite;
    p.elites.tanks += elite;
  }
  const offer = viewGame(g, owner).nexusEmperorSecretAlly!;
  assert.ok(offer);
  const action = {
    type: 'nexusEmperorRevive',
    event: offer.event,
    elite: elite ? 1 : 0,
  };
  nexusInventory(g);
  const [target, observer] = g.players
    .filter((p) => p.id !== owner)
    .map((p) => p.id);
  return { g, owner, target, observer, action };
}
export function emperorNexusPhysical(g: Game) {
  nexusInventory(g);
  return g.players.map((p) => ({
    id: p.id,
    total:
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
    elite:
      (p.elites?.reserves ?? 0) +
      (p.elites?.tanks ?? 0) +
      Object.values(p.elites?.forces ?? {}).reduce((a, b) => a + b, 0),
  }));
}
