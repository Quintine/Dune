import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createBureaucratPairedFundingSetup, advanceBureaucratPairedFunding,
  type BureaucratPairedFundingStep,
} from './fixture-bureaucrat-paired-funding';

export type PairedAuctionSource = 'normal' | 'cache' | 'blackMarket';
export interface BureaucratPairedAuctionFixture {
  game:Game;
  opening:Game;
  sourceSetup:Game;
  beforePledge:Game;
  beforeAction:Game;
  payer:string;
  donor:string;
  trainer:string;
  richese:string;
  guild:string;
  emperor:string;
  source:PairedAuctionSource;
  method:'silent'|'onceAround';
  position:'first'|'last';
  action:Action;
  amount:number;
  payerShare:number;
  donorShare:number;
  card:string;
  counterCard?:string;
  physical:string[];
  actions:BureaucratPairedFundingStep[];
  staging:string[];
  payee:string;
}
export const pairedAuctionPlayer = (game:Game,id:string) => game.players.find(p=>p.id===id)!;
export function pairedAuctionPhysicalCards(game:Game):string[] {
  return [...game.deck,...game.discard,...game.players.flatMap(p=>p.hand),
    ...(game.richeseCache ?? []),...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin==='normal')) ?? [])]
    .map(card=>card.id).sort();
}
export function allowPairedAuctionResponses(state:Game):Game {
  let game=state;
  for(let n=0;game.response&&n<40;n++) {
    const actor=game.players.find(p=>{
      const controls=viewGame(game,p.id).responseControls;
      return controls&&!controls.hasPassed&&controls.cancelCards.length>0;
    });
    assert.ok(actor,'An original unpassed counter holder must remain');
    game=applyAction(game,actor.id,{type:'passResponse'});
  }
  assert.equal(game.response,null);
  return game;
}
export function choosePairedAuctionOwner(game:Game,values:Record<string,unknown>):Game {
  assert.ok(game.decision);
  return applyAction(game,game.decision.player,{type:'decision',event:game.richeseBidding!.event,...values} as Action);
}
export function choosePairedAuctionBureaucrat(game:Game,redirect=true):Game {
  assert.equal(game.decision?.kind,'bureaucratPayment');
  return applyAction(game,game.decision!.player,{type:'decision',event:game.bureaucratPaymentEvent,redirect});
}

/** Only counter-card custody is controlled here: swap an original unplayed
 * card without adding a card, hand space, wallet, army, receipt or turn. */
function counterKarama(game:Game,actor:string,staging:string[]):string {
  const owner=pairedAuctionPlayer(game,actor),held=owner.hand.find(c=>c.effect==='karama');
  if(held) return held.id;
  const index=game.deck.findIndex(c=>c.effect==='karama');
  assert.ok(index>=0&&owner.hand.length>0);
  const outgoing=owner.hand[0],incoming=game.deck[index];
  owner.hand[0]=incoming;game.deck[index]=outgoing;
  staging.push(`Native counter window: swap original unplayed ${incoming.id} with held ${outgoing.id} for ${actor}; retain physical cards and hand size.`);
  return incoming.id;
}

export function createBureaucratPairedAuctionFixture({
  advanced=false,source='normal',payerShare=5,donorShare=3,counter=false,
  method='silent',position='first',donor='f',
}:{advanced?:boolean;source?:PairedAuctionSource;payerShare?:number;donorShare?:number;
  counter?:boolean;method?:'silent'|'onceAround';position?:'first'|'last';donor?:'f'|'b'|'e'}={}):BureaucratPairedAuctionFixture {
  assert.ok(advanced||source!=='blackMarket','Basic has no Black Market');
  const native=createBureaucratPairedFundingSetup(advanced);
  let game=native.game;
  const actions:BureaucratPairedFundingStep[]=[...native.actions],staging=[...native.staging];
  if(donor!=='f') {
    game=structuredClone(native.worm);
    actions.splice(actions.findIndex(step=>step.action.type==='alliance'));
    for(const [actor,target] of [['p',donor],[donor,'p']]) {
      const action:Action={type:'alliance',target};
      actions.push({actor,action});game=applyAction(game,actor,action);
    }
    game=advanceBureaucratPairedFunding(game,s=>s.turn===2&&s.phase===3,actions);
  }
  const opening=structuredClone(game);
  const choose=(values:Record<string,unknown>)=>{game=choosePairedAuctionOwner(game,values);};
  if(advanced) {
    assert.equal(game.decision?.kind,'richeseBlackMarket');
    if(source==='blackMarket') choose({card:pairedAuctionPlayer(game,'r').hand[0].id,method,direction:'clockwise'});
    else choose({decline:true});
  } else assert.equal(game.decision?.kind,'richeseDeclaration');
  if(source!=='blackMarket') {
    choose({position:source==='normal'?'last':position});
    game=allowPairedAuctionResponses(game);
    if(source==='cache') {
      if(position==='last') game=advanceBureaucratPairedFunding(game,s=>s.decision?.kind==='richeseCache',actions);
      assert.equal(game.decision?.kind,'richeseCache');
      choose({card:game.richeseCache![0].id,method,direction:'clockwise'});
    }
  }
  game=allowPairedAuctionResponses(game);
  const sourceSetup=structuredClone(game),physical=pairedAuctionPhysicalCards(game);
  const counterCard=counter?counterKarama(game,'b',staging):undefined;
  if(source==='normal') {
    for(let n=0;game.auction!.active!=='p'&&n<game.players.length;n++)
      game=applyAction(game,game.auction!.active,{type:'passBid'});
    assert.equal(game.auction!.active,'p');
  } else if(method==='onceAround') {
    for(let n=0;game.richeseAuction!.active!=='p'&&n<game.players.length;n++)
      game=applyAction(game,game.richeseAuction!.active!,{type:'richeseBid',event:game.richeseAuction!.event,amount:null});
    assert.equal(game.richeseAuction!.active,'p');
  }
  const beforePledge=structuredClone(game);
  game=applyAction(game,donor,{type:'pledgeAid',amount:donorShare});
  const beforeAction=structuredClone(game),amount=payerShare+donorShare;
  const card=source==='normal'?game.auction!.cards[game.auction!.index].id:game.richeseAuction!.cardId;
  const action:Action=source==='normal'?{type:'bid',amount,allyPayment:donorShare}:
    {type:'richeseBid',event:game.richeseAuction!.event,amount,allyPayment:donorShare};
  return {...native,game,donor,opening,sourceSetup,beforePledge,beforeAction,source,method,position,
    action,amount,payerShare,donorShare,card,counterCard,physical,actions,staging,
    payee:source==='normal'?'e':'r'};
}

export function payBureaucratPairedAuction(fixture:BureaucratPairedAuctionFixture,state=fixture.game):Game {
  let game=applyAction(state,fixture.payer,fixture.action);
  if(fixture.source==='normal') {
    const index=fixture.beforeAction.auction!.index;
    for(let n=0;!game.currentAuctionSale&&game.auction?.index===index&&n<game.players.length+2;n++) {
      if(game.decision?.kind==='auctionPayment') {
        game=applyAction(game,fixture.payer,{type:'decision',karama:false});break;
      }
      assert.ok(!game.decision&&!game.response);
      game=applyAction(game,game.auction!.active,{type:'passBid'});
    }
  } else {
    const event=fixture.beforeAction.richeseAuction!.event;
    for(let n=0;game.richeseAuction?.event===event&&!game.richeseAuction.outcome&&n<game.players.length;n++) {
      const lot=game.richeseAuction;
      const actor=lot.method==='silent'?lot.order.find(id=>!(id in lot.sealed))!:lot.active!;
      game=applyAction(game,actor,{type:'richeseBid',event,amount:lot.method==='silent'?0:null});
    }
  }
  return game;
}
