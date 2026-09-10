import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  nexusRicheseFixture,
  nexusRicheseInventory,
  holdNexusRicheseCard,
  type NexusRicheseFixtureOptions,
} from './fixture-nexus-richese';
import {
  nexusReload,
  nexusAllow,
  orderNexusSpice,
} from './fixture-nexus-cards';
import { botActions } from '../game/bots';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { homeworldGameIntegrity } from '../game/homeworld-game';

export type NexusGuildSecretAllyFixtureOptions = Omit<
  NexusRicheseFixtureOptions,
  'guild' | 'ownerFaction' | 'opponentFaction'
> & {
  ownerFaction?: Exclude<NexusRicheseFixtureOptions['ownerFaction'], 'guild'>;
  opponentFaction?: Exclude<
    NexusRicheseFixtureOptions['opponentFaction'],
    'guild'
  >;
};
/** Genuine final native setup without Guild. Exchange physical Nexus identities
 * before any declaration; no effect receipt or shipment allowance is staged. */
export function nexusGuildSecretAllyFixture(
  options: NexusGuildSecretAllyFixtureOptions = {},
) {
  const f = nexusRicheseFixture({
    ...options,
    opponentFaction:
      options.opponentFaction ??
      (options.ownerFaction === 'harkonnen' ? 'beneGesserit' : 'harkonnen'),
  });
  const cards = f.g.nexusCards!.cards!,
    index = cards.deck.indexOf('guild');
  assert.ok(index >= 0);
  assert.equal(cards.hands[f.owner], 'richese');
  cards.deck[index] = 'richese';
  cards.hands[f.owner] = 'guild';
  assert.equal(
    f.g.players.some((p) => p.faction === 'guild'),
    false,
  );
  nexusRicheseInventory(f.g);
  return f;
}
export function nexusGuildSecretAllyRequest(
  g: Game,
  owner: string,
  action: Action = {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 5,
  },
): Action {
  return { ...action, nexus: viewGame(g, owner).nexusGuildSecretAlly!.event };
}
export function nexusGuildSecretAllyInventory(g: Game) {
  const census = structuredClone(g);
  for (const p of census.players)
    p.reserves += Object.values(g.homeworlds?.custody?.visitors ?? {}).reduce(
      (sum, visitors) =>
        sum + (visitors[p.id]?.normal ?? 0) + (visitors[p.id]?.elite ?? 0),
      0,
    );
  nexusTraitorInventory(census);
  if (g.homeworlds) homeworldGameIntegrity(g);
}
export const nexusGuildSecretAllyReload = nexusReload;
export const holdGuildSecretAllyCard = holdNexusRicheseCard;

export function nexusGuildSecretAllianceFixture(
  seatIds?: [string, string, string],
) {
  const f = nexusGuildSecretAllyFixture({
    seatIds,
    opponentFaction: 'moritani',
  });
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
      territory: 'arrakeen',
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
      `Secret Ally alliance progression stalled at ${g.turn}/${g.phase}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 5);
  while (g.active !== f.owner)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.nexusCards!.cards!.hands[f.owner], 'guild');
  nexusGuildSecretAllyInventory(g);
  return { ...f, g };
}
