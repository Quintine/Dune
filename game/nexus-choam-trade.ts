import type { Card } from './cards';
import type { Game } from './engine';
import { nexusCardMode } from './nexus-cards';

export type NexusChoamTrade = {
  event: string;
  turn: number;
  owner: string;
  card: string;
  spiceBefore: number;
  stage: 'discard' | 'complete';
  signature: string;
};
export function nexusChoamTradeSignature(record: NexusChoamTrade): string {
  return JSON.stringify([record.event, record.turn, record.owner, record.card,
    record.spiceBefore, record.stage]);
}
export function nexusChoamTradeEvent(turn: number, owner: string): string {
  return JSON.stringify(['nexusChoamTrade', turn, owner]);
}
/** Private owner quote. Secret Ally does not change faction identity or invoke
 * native CHOAM market prices, Cunning conversions, or Auditor rules. */
export function quoteNexusChoamTrade(g: Game, owner: string, automaticPending: boolean) {
  const p = g.players.find(player => player.id === owner);
  if (!p || g.nexusCards?.cards?.hands[owner] !== 'choam' ||
    nexusCardMode('choam', p.faction, g.players.map(player => player.faction)) !== 'secretAlly') return null;
  let blocked: string | null = null;
  if (p.ally) blocked = 'Use a Nexus card while unallied.';
  else if (g.status !== 'playing' || g.phase !== 7)
    blocked = 'Trade during Spice Collection.';
  else if (automaticPending || g.truthtrance || g.response || g.decision || g.phaseOpening ||
    g.pendingKarama || g.pendingTreacheryDiscard || g.pendingNullentropy ||
    g.pendingExchange || g.pendingAmbassador || g.pendingRicheseGift ||
    g.pendingRichesePurchaseIncome || g.nexusCards.phase?.stage === 'drawing' ||
    g.nexusTraitorExchanges?.some(record => record.stage === 'return'))
    blocked = 'Finish the current interaction before trading.';
  if (!blocked && (!Number.isSafeInteger(p.spice) || p.spice < 0 || !Number.isSafeInteger(p.spice + 2)))
    blocked = 'The trade needs a valid spice balance.';
  const cards = p.hand.filter(card => card.kind === 'worthless').map(card => ({ ...card }));
  if (!blocked && !cards.length) blocked = 'You need a Worthless card to trade.';
  return { event: nexusChoamTradeEvent(g.turn, owner), blocked, cards, spice: 2 as const };
}
export function validateNexusChoamTrade(g: Game, record: NexusChoamTrade, physical: readonly Card[]): void {
  const p = record && g.players.find(player => player.id === record.owner);
  if (!record || Object.keys(record).sort().join(',') !== 'card,event,owner,signature,spiceBefore,stage,turn' ||
    !p || g.players.some(player => player.faction === 'choam') ||
    !Number.isSafeInteger(record.turn) || record.turn < 1 || record.turn > g.turn ||
    !Number.isSafeInteger(record.spiceBefore) || record.spiceBefore < 0 ||
    !Number.isSafeInteger(record.spiceBefore + 2) ||
    !['discard', 'complete'].includes(record.stage) ||
    record.event !== nexusChoamTradeEvent(record.turn, record.owner) ||
    record.signature !== nexusChoamTradeSignature(record) ||
    !physical.some(card => card.id === record.card && card.kind === 'worthless'))
    throw new Error('The CHOAM Nexus trade has lost its original owner, card or payment.');
}
