import type { Game } from './engine';

/** Only public placement IDs enter the offer; Terror faces remain Moritani-private. */
export function moritaniBetrayalOffer(g: Game, owner: string, automaticPending: boolean) {
  const player = g.players.find(seat => seat.id === owner);
  if (!player || g.nexusCards?.cards?.hands[owner] !== 'moritani' ||
    !g.players.some(seat => seat.faction === 'moritani') || player.faction === 'moritani') return null;
  const tokens = g.moritaniTerror?.tokens.filter(token => token.status === 'placed' && token.location !== null)
    .map(token => ({ id: token.id, territory: token.location! })) ?? [];
  let blocked: string | null = null;
  if (player.ally) blocked = 'An allied player cannot hold or play a Nexus card.';
  else if (g.status !== 'playing') blocked = 'Wait until play begins.';
  else if (automaticPending) blocked = 'Finish the automatic phase continuation before returning a Terror token.';
  else if (g.response || g.decision || g.truthtrance || g.phaseOpening || g.pendingKarama ||
    g.pendingTreacheryDiscard || g.pendingTerrorEntry || g.pendingMoritaniPlacement ||
    g.pendingExchange || g.pendingNullentropy || g.pendingRicheseGift || g.pendingAmbassador ||
    g.pendingCapture || g.battle || g.nexusTraitorPending || g.nexusCards?.phase?.stage === 'drawing')
    blocked = 'Finish the current interaction before returning a Terror token.';
  else if (!tokens.length) blocked = 'Moritani has no placed Terror token to return.';
  return { event: JSON.stringify(['nexusMoritaniBetrayal', g.turn, g.phase, owner, g.nexusCards!.cards!.discard.length]), blocked, tokens };
}
