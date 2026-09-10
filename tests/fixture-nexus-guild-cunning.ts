import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Action } from '../game/engine';
import {
  nexusRicheseFixture,
  holdNexusRicheseCard,
  type NexusRicheseFixtureOptions,
} from './fixture-nexus-richese';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';
import { orderNexusSpice } from './fixture-nexus-cards';
import { botActions } from '../game/bots';

export type NexusGuildCunningFixture = {
  g: Game;
  owner: string;
  target: string;
  observer: string;
  karama?: string;
};
/** Reuse genuine final native Guild setup, then exchange two physical Nexus
 * identities before any Cunning declaration; no grant or progress is invented. */
export function nexusGuildCunningFixture(
  options: Pick<
    NexusRicheseFixtureOptions,
    | 'seatIds'
    | 'advanced'
    | 'homeworlds'
    | 'spice'
    | 'karama'
    | 'opponentFaction'
  > = {},
): NexusGuildCunningFixture {
  const f = nexusRicheseFixture({ ...options, ownerFaction: 'guild' });
  const cards = f.g.nexusCards!.cards!,
    index = cards.deck.indexOf('guild');
  assert.ok(index >= 0);
  assert.equal(cards.hands[f.owner], 'richese');
  cards.deck[index] = 'richese';
  cards.hands[f.owner] = 'guild';
  nexusGuildCunningInventory(f.g);
  return f;
}
/** Allow only the already declared shipment and its ordinary response chain. */
export function settleGuildCunningShipment(g: Game): Game {
  if (g.decision?.kind === 'guildShipment')
    g = applyAction(g, g.decision.player, { type: 'decision', allow: true });
  return nexusAllow(g);
}
export function originalGuildCunningTurn(
  f: NexusGuildCunningFixture,
  move = true,
  g = f.g,
): Game {
  g = settleGuildCunningShipment(
    applyAction(g, f.owner, {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 5,
    }),
  );
  if (move)
    g = applyAction(g, f.owner, {
      type: 'move',
      from: 'arrakeen:10',
      territory: 'hagga_basin',
      sector: 12,
      amount: 5,
    });
  nexusGuildCunningInventory(g);
  return g;
}
export function nexusGuildCunningRequest(
  f: NexusGuildCunningFixture,
  g = f.g,
): Action {
  return {
    type: 'endMovement',
    nexus: viewGame(g, f.owner).nexusGuildCunning!.offer!.event,
  };
}
export function holdGuildCunningCard(g: Game, owner: string, kind: string) {
  const held = g.players
    .find((p) => p.id === owner)!
    .hand.find((c) => c.kind === kind || c.effect === kind);
  return held ?? holdNexusRicheseCard(g, owner, kind);
}
export function nexusGuildCunningInventory(g: Game) {
  // The shared card census also checks a pre-Homeworld aggregate force total.
  // Count foreign visitors in that detached census; validate actual typed
  // Homeworld custody against the unchanged game separately.
  const census = structuredClone(g);
  for (const p of census.players)
    p.reserves += Object.values(g.homeworlds?.custody?.visitors ?? {}).reduce(
      (sum, visitors) => {
        const group = visitors[p.id];
        return sum + (group?.normal ?? 0) + (group?.elite ?? 0);
      },
      0,
    );
  nexusTraitorInventory(census);
  if (g.homeworlds) homeworldGameIntegrity(g);
}
export const nexusGuildCunningReload = nexusReload;
export const nexusGuildCunningAllow = nexusAllow;

/** Place an actual native Terror token at the first Mentat, then complete the
 * next Storm/Spice/auction/Revival before returning the Guild's real turn. */
export function nexusGuildCunningAllianceFixture(
  seatIds?: [string, string, string],
): NexusGuildCunningFixture {
  const f = nexusGuildCunningFixture({ seatIds, opponentFaction: 'moritani' });
  // Reserve this actual card before the intervening real auction can distribute
  // all copies. The later scenario reuses this owned identity rather than
  // assuming a needed card remains in the randomly shuffled draw pile.
  holdGuildCunningCard(f.g, f.owner, 'hajr');
  let g = f.g;
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  const token = g.moritaniTerror!.tokens.find((t) => t.kind === 'robbery')!;
  g = nexusAllow(
    applyAction(g, f.target, {
      type: 'decision',
      token: token.id,
      territory: 'carthag',
    }),
  );
  let ordered = false;
  for (
    let step = 0;
    !(
      g.turn === 2 &&
      g.phase === 5 &&
      !g.response &&
      !g.decision &&
      !g.phaseOpening
    ) && step < 180;
    step++
  ) {
    if (g.turn === 2 && g.phase === 1 && !ordered) {
      orderNexusSpice(g, ['land', 'land']);
      ordered = true;
    }
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
      `Guild alliance fixture stalled at ${g.turn}/${g.phase}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 5);
  while (g.active !== f.owner)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.nexusCards!.cards!.hands[f.owner], 'guild');
  nexusGuildCunningInventory(g);
  return { ...f, g };
}
