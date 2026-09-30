import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeRicheseBetrayalGameForAudit, joinGame,
  newPlayer, viewGame, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { drawNexusCard, type NexusState } from '../game/nexus-cards';
import { orderNexusSpice } from './fixture-nexus-cards';

export const RICHESE_BETRAYAL_FIXTURE_FACTIONS = ['richese','choam','harkonnen','fremen'] as const;
export type RicheseBetrayalFixtureOptions = {
  seatIds?: string[];
  source?: 'cache' | 'blackMarket';
  advanced?: boolean;
  holderNexus?: 'richese' | 'choam';
  allyPayment?: number;
  allyIsSeller?: boolean;
  allySpice?: number;
  beforeFinalBid?: (g: Game) => void;
  bonusCounter?: boolean;
};
export type RicheseBetrayalFixture = {
  game: Game;
  holder: string;
  other: string;
  target: string;
  buyer: string;
  card: string;
  event: string;
  ally: string | null;
  counterCard: string | null;
};
function step(g: Game): Game {
  for (const p of g.players) {
    const v = viewGame(g,p.id);
    v.players.find(seat => seat.id === p.id)!.bot = 'Easy';
    const action = botActions(v)[0];
    if (action) return applyAction(g,p.id,action);
  }
  throw new Error(`Richese Betrayal setup stalled at ${g.status}/${g.phase}/${g.decision?.kind}`);
}
function holdNexus(g: Game, owner: string, card: 'richese' | 'choam' | 'guild') {
  const cards = g.nexusCards!.cards!;
  assert.ok(cards.deck.includes(card));
  const ordered: NexusState = {...cards,deck:[card,...cards.deck.filter(c => c !== card)]};
  g.nexusCards!.cards = drawNexusCard(ordered,owner,g.players,() => 0);
}
/** Genuine setup and completed Spice phase, conserved physical Nexus draws and
 * real declaration/bid actions. Arrange resources only before the auction, never
 * rewrite a paused receipt. Seat IDs are fixed before setup for authenticated SQL. */
export function createRicheseBetrayalFixture(
  kind: 'purchase' | 'sale', options: RicheseBetrayalFixtureOptions = {},
): RicheseBetrayalFixture {
  const ids = options.seatIds ?? ['richese','holder','buyer','other'];
  assert.equal(ids.length,4);
  const [target,holder,harkonnen,other] = ids;
  const source = options.source ?? (kind === 'purchase' ? 'cache' : 'blackMarket');
  assert.ok(kind !== 'purchase' || source === 'cache');
  const advanced = options.advanced ?? source === 'blackMarket';
  assert.ok(source !== 'blackMarket' || advanced);
  let g = createGame('RICHESEBETRAYAL',newPlayer(target,'Richese','richese'),advanced,['choam']);
  for (let i = 1; i < ids.length; i++)
    joinGame(g,newPlayer(ids[i],RICHESE_BETRAYAL_FIXTURE_FACTIONS[i],RICHESE_BETRAYAL_FIXTURE_FACTIONS[i]));
  g.nexusCards = {cards:null,phase:null};
  for (const p of g.players) g = applyAction(g,p.id,{type:'ready'});
  g = initializeRicheseBetrayalGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 100; i++) g = step(g);
  assert.equal(g.status,'playing');
  for (const p of g.players) {g.deck.push(...p.hand.splice(0));p.spice = 20;}
  for (let i = 0; g.phase === 0 && i < 100; i++) g = step(g);
  assert.equal(g.phase,1);
  orderNexusSpice(g,['land','land']);
  for (let i = 0; g.phase === 1 && i < 100; i++) g = step(g);
  assert.equal(g.phase,2);
  assert.equal(g.nexusCards!.phase!.stage,'complete');
  holdNexus(g,holder,options.holderNexus ?? 'richese');
  const contribution = options.allyPayment ?? 0;
  const buyer = kind === 'purchase' ? target : harkonnen;
  let ally: string | null = null;
  if (contribution) {
    assert.equal(kind,'sale');
    assert.ok(contribution > 0 && contribution <= 6);
    ally = options.allyIsSeller ? target : other;
    g.players.find(p => p.id === harkonnen)!.ally = ally;
    g.players.find(p => p.id === ally)!.ally = harkonnen;
  } else holdNexus(g,other,'guild');
  const card = source === 'cache' ? g.richeseCache![0].id : (() => {
    const index = g.deck.findIndex(c => c.kind === 'shield');
    assert.ok(index >= 0);
    const selected = g.deck.splice(index,1)[0];
    g.players.find(p => p.id === target)!.hand.push(selected);
    return selected.id;
  })();
  for (const id of g.order) g = applyAction(g,id,{type:'ready'});
  while (g.decision?.kind === 'choamMarket')
    g = applyAction(g,g.decision.player,{type:'decision',done:true});
  assert.equal(g.phase,3);
  if (source === 'cache') {
    if (g.decision?.kind === 'richeseBlackMarket')
      g = applyAction(g,target,{type:'decision',event:g.richeseBidding!.event,decline:true});
    g = applyAction(g,target,{type:'decision',event:g.richeseBidding!.event,position:'first'});
  }
  assert.equal(g.decision?.kind,source === 'cache' ? 'richeseCache' : 'richeseBlackMarket');
  g = applyAction(g,target,{type:'decision',event:g.richeseBidding!.event,card,method:'onceAround',direction:'clockwise'});
  assert.equal(g.response,null);
  let counterCard: string | null = null;
  if (options.bonusCounter) {
    const index = g.deck.findIndex(c => c.effect === 'karama');
    assert.ok(index >= 0);
    const counter = g.deck.splice(index,1)[0];
    g.players.find(p => p.id === other)!.hand.push(counter);
    counterCard = counter.id;
  }
  if (ally) {
    if (options.allySpice !== undefined) g.players.find(p => p.id === ally)!.spice = options.allySpice;
    g = applyAction(g,ally,{type:'pledgeAid',amount:contribution});
  }
  for (let i = 0; !g.pendingRicheseBetrayal && i < 10; i++) {
    const lot = g.richeseAuction!;
    assert.ok(lot && !lot.outcome && lot.active);
    if (lot.acted.length === lot.order.length - 1) options.beforeFinalBid?.(g);
    g = applyAction(g,lot.active,{type:'richeseBid',event:lot.event,
      amount:lot.active === buyer ? 6 : kind === 'purchase' && !lot.bidder ? 1 : null,
      ...(lot.active === buyer ? {allyPayment:contribution} : {})});
  }
  assert.ok(g.pendingRicheseBetrayal);
  assert.equal(g.pendingRicheseBetrayal.receipt.invoice.kind,kind);
  return {game:g,holder,other,target,buyer,card,event:g.pendingRicheseBetrayal.receipt.event,ally,counterCard};
}
