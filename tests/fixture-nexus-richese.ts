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
import type { FactionId } from '../game/catalog';
import { drawNexusCard } from '../game/nexus-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import {
  enterNexusSpice,
  finishNexusSpice,
  orderNexusSpice,
  nexusAllow,
  nexusReload,
} from './fixture-nexus-cards';

export type NexusRicheseOwner =
  | 'atreides'
  | 'emperor'
  | 'fremen'
  | 'guild'
  | 'beneGesserit'
  | 'ixians'
  | 'harkonnen';
export type NexusRicheseFixtureOptions = {
  seatIds?: [string, string, string];
  ownerFaction?: NexusRicheseOwner;
  opponentFaction?:
    | 'guild'
    | 'harkonnen'
    | 'moritani'
    | 'beneGesserit'
    | 'ixians';
  guild?: boolean;
  advanced?: boolean;
  homeworlds?: boolean;
  spice?: number;
  karama?: boolean;
};
export type NexusRicheseFixture = {
  g: Game;
  owner: string;
  target: string;
  observer: string;
  karama?: string;
};

/** Final roster, module choices and production seat IDs precede genuine setup.
 * Conserved reserves are staged only after a real completed Nexus phase. */
export function nexusRicheseFixture(
  options: NexusRicheseFixtureOptions = {},
): NexusRicheseFixture {
  const [owner, target, observer] = options.seatIds ?? ['p', 'q', 'r'];
  const ownerFaction = options.ownerFaction ?? 'atreides';
  const opponentFaction =
    options.opponentFaction ??
    ((options.guild && ownerFaction !== 'guild') || ownerFaction === 'harkonnen'
      ? 'guild'
      : 'harkonnen');
  assert.notEqual(ownerFaction, opponentFaction);
  const observerFaction = (
    ['fremen', 'atreides', 'emperor'] as FactionId[]
  ).find((f) => f !== ownerFaction && f !== opponentFaction)!;
  let g = createGame(
    'RICHESENEXUS',
    newPlayer(owner, ownerFaction, ownerFaction),
    options.advanced ?? false,
    ownerFaction === 'ixians' || opponentFaction === 'ixians' ? ['ix'] : [],
  );
  // The unfinished E3 public deck gate is separate from native Moritani audit
  // setup. Fix the final faction before readiness and genuine initialization.
  joinGame(
    g,
    newPlayer(
      target,
      opponentFaction,
      opponentFaction === 'moritani' ? 'harkonnen' : opponentFaction,
    ),
  );
  if (opponentFaction === 'moritani')
    g.players[1] = newPlayer(target, opponentFaction, opponentFaction);
  joinGame(g, newPlayer(observer, observerFaction, observerFaction));
  if (options.homeworlds)
    g = applyAction(g, owner, { type: 'homeworlds', enabled: true });
  g.nexusCards = { cards: null, phase: null };
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeNexusGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 100; step++) {
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
    assert.ok(
      next,
      `Richese Nexus setup stalled at ${g.setupStage}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  if (g.expansions.includes('ix')) {
    for (let step = 0; g.phase === 0 && step < 60; step++) g = fixtureStep(g);
    assert.equal(g.phase, 1);
    orderNexusSpice(g, ['land', 'land']);
    for (let step = 0; g.phase === 1 && step < 60; step++) g = fixtureStep(g);
    assert.equal(g.phase, 2);
  } else {
    g = enterNexusSpice(g);
    orderNexusSpice(g, ['land', 'land']);
    g = finishNexusSpice(g);
  }
  for (const p of g.players) {
    const eliteTotal = p.elites
      ? p.elites.reserves +
        p.elites.tanks +
        Object.values(p.elites.forces).reduce((s, n) => s + n, 0)
      : 0;
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      shipped: false,
      moved: 0,
    });
    if (p.advisors) p.advisors = {};
    if (p.elites)
      Object.assign(p.elites, { forces: {}, reserves: eliteTotal, tanks: 0 });
  }
  const cards = g.nexusCards!.cards!;
  cards.deck = ['richese', ...cards.deck.filter((c) => c !== 'richese')];
  g.nexusCards!.cards = drawNexusCard(cards, owner, g.players, () => 0);
  const karama = options.karama
    ? holdNexusRicheseCard(g, target, 'karama').id
    : undefined;
  g.players[0].spice = options.spice ?? 20;
  Object.assign(g, {
    phase: 5,
    active: owner,
    order: [owner, target, observer],
    movementRemaining: [owner, target, observer],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    spice: {},
    storm: 18,
    hajr: [],
  });
  nexusRicheseInventory(g);
  return { g, owner, target, observer, karama };
}
export function holdNexusRicheseCard(g: Game, owner: string, kind: string) {
  const i = g.deck.findIndex((c) => c.kind === kind || c.effect === kind);
  assert.ok(i >= 0);
  const card = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card;
}
function fixtureStep(g: Game): Game {
  for (const p of g.players) {
    const v = viewGame(g, p.id);
    v.players.find((s) => s.id === p.id)!.bot = 'Easy';
    const action = botActions(v)[0];
    if (action) return applyAction(g, p.id, action);
  }
  throw new Error(
    `Richese fixture progression stalled at ${g.phase}/${g.decision?.kind}`,
  );
}
export function nexusRicheseRequest(
  f: NexusRicheseFixture,
  amount = 5,
  territory = 'arrakeen',
  sector = 10,
  g = f.g,
): Action {
  return {
    type: 'ship',
    territory,
    sector,
    amount,
    nexus: viewGame(g, f.owner).nexusRichese!.event,
  };
}
export function nexusRicheseInventory(g: Game) {
  nexusTraitorInventory(g);
  if (g.homeworlds) homeworldGameIntegrity(g);
}
export const nexusRicheseAllow = nexusAllow;
export const nexusRicheseReload = nexusReload;
