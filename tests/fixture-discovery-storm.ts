import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  discoveryFixture,
  enterDiscoveryCollection,
} from './fixture-discovery';

/** Genuine module setup, physical reveal and next-turn entry; positions are
 * arranged for a focused storm rather than an unmodified complete game. */
export function discoveryStormFixture(
  advanced = false,
  ids: [string, string, string] = ['a', 'g', 'f'],
) {
  let g = discoveryFixture(advanced, ids);
  const token = enterDiscoveryCollection(
    g,
    'ecological-testing-station',
    ids[0],
  );
  if (viewGame(g, ids[0]).discoveries!.canInspect.includes(token.id))
    g = applyAction(g, ids[0], {
      type: 'discovery',
      token: token.id,
      reveal: false,
    });
  g = applyAction(g, ids[0], {
    type: 'discovery',
    token: token.id,
    reveal: true,
  });
  Object.assign(g, {
    phase: 8,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    stormCard: 2,
  });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'discoveryEntry');
  const offer = viewGame(g, ids[0]).discoveryEntry!;
  g = applyAction(g, ids[0], {
    type: 'decision',
    event: offer.event,
    accept: true,
    groups: offer.sources,
  });
  assert.equal(g.discoveryEntry, undefined);
  g.storm = 6;
  if (!advanced)
    for (const id of g.stormDialers)
      g = applyAction(g, id, { type: 'stormDial', amount: 1 });
  assert.equal(g.stormPending, 2);
  return g;
}
export function confirmDiscoveryStorm(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
export function holdStormCard(g: Game, owner: string, effect: string) {
  const card = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
  ].find((c) => c.effect === effect)!;
  assert.ok(card);
  g.deck = g.deck.filter((c) => c.id !== card.id);
  g.discard = g.discard.filter((c) => c.id !== card.id);
  for (const p of g.players) p.hand = p.hand.filter((c) => c.id !== card.id);
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card;
}
