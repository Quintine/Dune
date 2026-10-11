import assert from 'node:assert/strict';
import {applyAction,createGame,joinGame,newPlayer,initializeSemutaGameForAudit,viewGame,type Game} from '../game/engine';
import {botActions} from '../game/bots';
import {SEMUTA_DRUG_ID} from '../game/semuta-drug';

export function initializeSemutaStrongholdsGame(count=3,tech=false):Game {
  const factions=['richese','atreides','choam','ixians','tleilaxu','fremen'] as const;
  let game=createGame(`SEMUTASH${count}${tech?'T':''}`,newPlayer('r','Richese','richese'),true,count>=4?['choam','ix']:['choam']);
  const ids=['r','a','e','i','t','f'];
  for(let n=1;n<count;n++)joinGame(game,newPlayer(ids[n],factions[n],factions[n]));
  game=applyAction(game,'r',{type:'strongholdCards',enabled:true});
  if(tech)game=applyAction(game,'r',{type:'techTokens',enabled:true});
  for(const player of game.players){player.bot='Medium';player.ready=true;}
  game=initializeSemutaGameForAudit(game);
  for(let step=0;(game.status==='setup'||game.phase===0||game.phase===1)&&step<240;step++) {
    let next:Game|undefined;
    for(const player of game.players){const action=botActions(viewGame(game,player.id))[0];if(action){next=applyAction(game,player.id,action);break;}}
    assert.ok(next,'Original native setup/first Storm needs a legal continuation.');game=next;
  }
  assert.equal(game.status,'playing');assert.equal(game.phase,2);
  if(tech)assert.ok(Object.values(game.techTokens!).every(token=>token.owner));
  return game;
}
export function semutaStrongholdsClosingFixture(tech=false) {
  const game=initializeSemutaStrongholdsGame(3,tech);
  const cards=[...game.deck,...game.discard,...game.richeseCache!,...game.players.flatMap(p=>p.hand)].map(c=>c.id).sort();
  game.deck.push(...game.players.flatMap(p=>p.hand));for(const player of game.players)player.hand=[];
  const take=(id:string)=>{for(const zone of [game.deck,game.discard,game.richeseCache!]){const index=zone.findIndex(card=>card.id===id);if(index>=0)return zone.splice(index,1)[0];}throw Error(`Missing physical ${id}`);};
  const semuta=take(SEMUTA_DRUG_ID),gamont=take(game.deck.find(c=>c.name==='Trip to Gamont')!.id);
  game.players.find(p=>p.id==='r')!.hand.push(semuta);game.players.find(p=>p.id==='e')!.hand.push(gamont);
  for(const player of game.players){player.reserves+=player.tanks+Object.values(player.forces).reduce((sum,n)=>sum+n,0);player.forces={};player.tanks=0;}
  const target=game.players.find(p=>p.id==='a')!;
  target.reserves-=4;target.forces={'arrakeen:10':3,'carthag:11':1};
  Object.assign(game,{turn:2,phase:7,active:null,movementRemaining:[],ready:[],response:null,decision:null,phaseOpening:null,stormPending:null});
  let state=game;
  for(const id of ['a','e','r'])state=applyAction(state,id,{type:'ready'});
  state=applyAction(state,'e',{type:'decision',done:true});
  assert.equal(state.phase,8);
  for(const id of ['a','e','r'])state=applyAction(state,id,{type:'ready'});
  state=applyAction(state,'e',{type:'decision',done:true});
  assert.equal(state.decision?.kind,'choamMentat');
  return {game:state,semuta:semuta.id,gamont:gamont.id,cards};
}
