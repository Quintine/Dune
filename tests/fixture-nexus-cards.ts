import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck, type SpiceCard } from '../game/cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';

export const nexusReload = (g: Game): Game => JSON.parse(JSON.stringify(g));
export const nexusPlayer = (g: Game, id: string) =>
  g.players.find((p) => p.id === id)!;

/** Final seat identities precede the genuine base setup. The only module seam
 * enables the unfinished Nexus module through its explicit audit initializer. */
export function nexusFixture(
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    hostFaction?: 'fremen' | 'moritani' | 'ecaz';
  } = {},
): Game {
  const [f, a, h] = options.seatIds ?? ['f', 'a', 'h'];
  let g = createGame(
    'NEXUSAUDIT',
    newPlayer(
      f,
      options.hostFaction ?? 'fremen',
      options.hostFaction ?? 'fremen',
    ),
    options.advanced ?? false,
    [],
  );
  joinGame(g, newPlayer(a, 'Atreides', 'atreides'));
  joinGame(g, newPlayer(h, 'Harkonnen', 'harkonnen'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g.nexusCards = { cards: null, phase: null };
  g = initializeNexusGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 60; i++) {
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
  assert.equal(g.homeworlds, undefined);
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  nexusInventory(g);
  return g;
}

export function nexusReady(state: Game): Game {
  let g = state;
  for (const p of state.players)
    if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
export function nexusAllow(state: Game): Game {
  let g = state;
  for (let i = 0; g.response && i < 20; i++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
/** Later turns stage only a settled Storm boundary after a completed phase.
 * The tracker for the next Spice Blow is always created by actual Storm play. */
export function enterNexusSpice(state: Game, nextTurn = false): Game {
  let g = nexusReload(state);
  if (nextTurn) {
    assert.equal(g.nexusCards?.phase?.stage, 'complete');
    Object.assign(g, {
      turn: g.turn + 1,
      phase: 0,
      ready: [],
      stormPending: null,
      stormDialers: g.players.slice(0, 2).map((p) => p.id),
      stormDials: {},
    });
  }
  assert.equal(g.phase, 0);
  for (const id of g.stormDialers)
    g = applyAction(g, id, { type: 'stormDial', amount: g.turn === 1 ? 0 : 1 });
  g = nexusAllow(nexusReady(g));
  assert.equal(g.phase, 1);
  assert.equal(g.nexusCards?.phase?.stage, 'spice');
  return g;
}
/** Reorder existing physical spice cards without adding/removing their census. */
export function orderNexusSpice(g: Game, kinds: ('land' | 'worm')[]): void {
  const all = [...g.spiceDeck, ...g.spiceDiscard.flat()];
  const front: SpiceCard[] = [];
  for (const kind of kinds) {
    const index = all.findIndex((card) =>
      kind === 'land' ? 'territory' in card : 'worm' in card,
    );
    assert.ok(index >= 0);
    front.push(all.splice(index, 1)[0]);
  }
  g.spiceDeck = [...front, ...all];
  g.spiceDiscard = [[], []];
}
export function finishNexusSpice(state: Game): Game {
  let g = state;
  for (
    let i = 0;
    g.phase === 1 && g.nexusCards?.phase?.stage === 'spice' && i < 30;
    i++
  ) {
    if (g.response) g = nexusAllow(g);
    else if (g.decision?.kind === 'wormRide')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        accept: false,
      });
    else {
      assert.equal(g.decision, null);
      g = nexusReady(g);
    }
  }
  assert.notEqual(g.nexusCards?.phase?.stage, 'spice');
  return g;
}
export function nexusTurnTwo(
  options: {
    seatIds?: [string, string, string];
    advanced?: boolean;
    hostFaction?: 'fremen' | 'moritani' | 'ecaz';
  } = {},
): Game {
  const first = enterNexusSpice(nexusFixture(options));
  orderNexusSpice(first, ['land', 'land']);
  return enterNexusSpice(finishNexusSpice(first), true);
}
export function nexusInventory(g: Game): void {
  assert.ok(g.nexusCards?.cards);
  validateNexusCards(g.nexusCards.cards, g.players);
  assert.deepEqual(
    [
      ...g.nexusCards.cards.deck,
      ...g.nexusCards.cards.discard,
      ...Object.values(g.nexusCards.cards.hands).filter(
        (card) => card !== null,
      ),
    ].sort(),
    [...NEXUS_FACTIONS].sort(),
  );
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
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
export function nexusReject(
  g: Game,
  id: string,
  action: Action,
  pattern: RegExp = /Nexus/,
): void {
  const before = nexusReload(g);
  assert.throws(() => applyAction(g, id, action), pattern);
  assert.deepEqual(g, before);
}
