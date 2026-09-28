import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { finishNexusSpice, nexusReady, nexusTurnTwo, orderNexusSpice } from './fixture-nexus-cards';

/** Real Nexus draw, alliance formation, normal Bidding and sealed winner payment. */
export function wonEmperorNexusBankAuction(advanced: boolean, ids: [string, string, string] = ['p', 'q', 'r']): Game {
  const [fremen, owner, harkonnen] = ids;
  let g = nexusTurnTwo({ advanced, seatIds: ids });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  g = applyAction(g, fremen, { type: 'alliance', target: harkonnen });
  g = applyAction(g, harkonnen, { type: 'alliance', target: fremen });
  g = finishNexusSpice(g);
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  const cards = g.nexusCards!.cards!;
  cards.deck = ['emperor', ...cards.deck.filter(card => card !== 'emperor')];
  g = applyAction(g, owner, {
    type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'draw', ownRedraws: 0,
  });
  for (const id of g.nexusCards!.phase!.eligible)
    if (!g.nexusCards!.phase!.done.includes(id))
      g = applyAction(g, id, {
        type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'keep', ownRedraws: 0,
      });
  assert.equal(g.phase, 2);
  g = nexusReady(g);
  for (let i = 0; g.decision?.kind !== 'auctionPayment' && i < 30; i++) {
    if (g.phaseOpening)
      g = applyAction(g, g.players.find(p => !g.phaseOpening!.passed.includes(p.id))!.id, { type: 'ready' });
    else if (g.auction?.active === owner && !g.auction.bid)
      g = applyAction(g, owner, { type: 'bid', amount: 2 });
    else if (g.auction)
      g = applyAction(g, g.auction.active, { type: 'passBid' });
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 3);
  assert.deepEqual(g.decision, { kind: 'auctionPayment', player: owner });
  assert.equal(g.auction?.bidder, owner);
  assert.equal(g.auction?.bid, 2);
  assert.equal(g.auction?.allyPayment ?? 0, 0);
  return g;
}
