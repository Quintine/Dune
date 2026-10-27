import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bribePromiseModeSupported } from '../game/bribe-promises';
import { act, advance, clean, createPublicChoamKullFixture as fixture, player,
  publicKullAttempt as attempt, publicKullInventory as inventory } from './fixture-public-choam-kull';

const held = (g: Game,id: string,card: string) => player(g,id).hand.some(c => c.id === card);
function reject(g: Game,id: string,action: Action) {
  const before = structuredClone(g); assert.throws(() => act(g,id,action)); assert.deepEqual(g,before);
}
function createLobby(advanced = false, expansions: string[] = ['choam','ix'], last: 'guild'|'richese' = 'guild') {
  const game = createGame('KULLLOBBY',newPlayer('choam','CHOAM','choam'),advanced,expansions);
  joinGame(game,newPlayer('emperor','Emperor','emperor'));
  joinGame(game,newPlayer(last,last,last));
  return game;
}
function ready(g: Game) {
  for (const seat of g.players) g = act(g,seat.id,{type:'ready'});
  return g;
}
function declare(g: Game,kull: string) {
  const reaction = viewGame(g,'choam').kullReaction; assert.ok(reaction);
  return act(g,'choam',{type:'kullDecision',event:reaction.event,source:'printed',card:kull});
}

void test('Kull is a host-selected lobby preview and default Basic Truth promises retain their existing scope', () => {
  let lobby = createLobby();
  assert.equal(lobby.lobbyOptions?.kullPreview,undefined);
  assert.equal(bribePromiseModeSupported(lobby),true);
  reject(lobby,'emperor',{type:'moduleOption',module:'kullPreview',enabled:true});
  reject(lobby,'choam',{type:'moduleOption',module:'kullPreview',enabled:'true'});
  reject(lobby,'choam',{type:'moduleOption',module:'kullPreview',enabled:true,other:true});
  const baseline = act(ready(lobby),'choam',{type:'start'});
  assert.equal(baseline.kullPreview ?? false,false);
  assert.equal(bribePromiseModeSupported(baseline),true);
  lobby = ready(lobby);
  lobby = act(lobby,'choam',{type:'moduleOption',module:'kullPreview',enabled:true});
  assert.ok(lobby.players.every(seat => !seat.ready));
  assert.equal(lobby.lobbyOptions?.kullPreview,true);
  lobby = act(lobby,'choam',{type:'moduleOption',module:'kullPreview',enabled:false});
  assert.equal(lobby.lobbyOptions?.kullPreview,undefined);
  const f = fixture();
  assert.equal(f.setup.kullPreview,true);
  assert.equal(bribePromiseModeSupported(f.setup),true,'Basic printed Kull now supports the structured bribe family');
  assert.ok(f.actions.some(row => row.actor === f.lobby.host && row.action.type === 'start'));
});

void test('incompatible opt-in starts reject without modifying their original lobby', () => {
  for (const config of [
    {advanced:true,expansions:['choam','ix'],last:'guild' as const,module:false},
    {advanced:false,expansions:['choam'],last:'guild' as const,module:false},
    {advanced:false,expansions:['choam','ix'],last:'richese' as const,module:false},
    {advanced:false,expansions:['choam','ix'],last:'guild' as const,module:true},
  ]) {
    let g = createLobby(config.advanced,config.expansions,config.last);
    g = act(g,'choam',{type:'moduleOption',module:'kullPreview',enabled:true});
    if (config.module) g = act(g,'choam',{type:'moduleOption',module:'leaderSkills',enabled:true});
    g = ready(g);
    reject(g,'choam',config.advanced ? {type:'start',advancedPreview:true} : {type:'start'});
  }
});

void test('public Kull offer, decline, successful use, and distinct counter retain native custody and income', () => {
  const f = fixture(), original = structuredClone(f.game), sourceCards = inventory(original);
  assert.equal(original.kullPreview,true); assert.deepEqual(sourceCards,f.originalCards);
  const wallet = original.players.map(p => p.spice), forces = original.players.map(p => ({forces:p.forces,reserves:p.reserves,tanks:p.tanks}));
  const offered = act(original,f.actor,attempt(f));
  assert.equal(offered.pendingKull?.stage,'offer');
  assert.equal(offered.karamaShipping,null);
  assert.ok(held(offered,f.actor,f.karama));
  assert.deepEqual(offered.players.map(p => p.spice),wallet);
  assert.deepEqual(offered.players.map(p => ({forces:p.forces,reserves:p.reserves,tanks:p.tanks})),forces);
  for (const outsider of [f.actor,f.counterOwner]) {
    const reaction = viewGame(offered,outsider).kullReaction; assert.ok(reaction);
    assert.equal(reaction.canDecline,false); assert.deepEqual(reaction.plays,[]);
  }
  const reaction = viewGame(offered,f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(play => play.source === 'printed' && play.card.id === f.kull && !play.blocked));
  reject(offered,f.counterOwner,{type:'kullDecision',event:reaction.event,decline:true});
  reject(offered,f.reactor,{type:'kullDecision',event:'stale',decline:true});
  const declined = act(offered,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  assert.equal(declined.pendingKull,null);
  assert.equal(declined.karamaShipping?.owner,f.actor);
  assert.equal(declined.discard.filter(card => card.id === f.karama).length,1);
  assert.ok(held(declined,f.reactor,f.kull));
  assert.deepEqual(inventory(declined),sourceCards);
  const declared = declare(offered,f.kull);
  const successful = advance(declared,clean);
  assert.equal(successful.karamaShipping,null);
  assert.ok(held(successful,f.actor,f.karama));
  assert.equal(successful.discard.filter(card => card.id === f.kull).length,1);
  assert.deepEqual(successful.players.map(p => p.spice),wallet);
  assert.deepEqual(inventory(successful),sourceCards);
  reject(successful,f.actor,attempt(f));
  const counter = viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
  assert.ok(counter.includes(f.counter),'The distinct original Guild Karama is a legal counter');
  const interrupted = act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
  const resumed = advance(interrupted,clean);
  assert.equal(resumed.pendingKull,null);
  assert.equal(resumed.karamaShipping?.owner,f.actor);
  assert.ok(held(resumed,f.reactor,f.kull));
  assert.equal(resumed.discard.filter(card => card.id === f.karama).length,1);
  assert.equal(resumed.discard.filter(card => card.id === f.counter).length,1);
  assert.deepEqual(inventory(resumed),sourceCards);
});

void test('neutral public offer and deferred overbid do not depend on holding Kull', () => {
  const f = fixture(), absent = structuredClone(f.game), owner = player(absent,f.reactor);
  // Conserved controlled supplement: swap the original held Kull and a physical
  // undealt deck card; this is not an earned trade or a new card.
  const heldIndex = owner.hand.findIndex(card => card.id === f.kull); assert.ok(heldIndex >= 0);
  assert.ok(absent.deck.length); [owner.hand[heldIndex],absent.deck[0]] = [absent.deck[0],owner.hand[heldIndex]];
  assert.deepEqual(inventory(absent),f.originalCards);
  const withCard = act(f.game,f.actor,attempt(f)), withoutCard = act(absent,f.actor,attempt(f));
  assert.deepEqual(viewGame(withCard,f.actor).kullReaction,viewGame(withoutCard,f.actor).kullReaction);
  const auctionWithout = structuredClone(f.auction), auctionOwner = player(auctionWithout,f.reactor);
  const index = auctionOwner.hand.findIndex(card => card.id === f.kull); assert.ok(index >= 0);
  assert.ok(auctionWithout.deck.length); [auctionOwner.hand[index],auctionWithout.deck[0]] = [auctionWithout.deck[0],auctionOwner.hand[index]];
  for (const g of [f.auction,auctionWithout]) {
    const amount = player(g,f.actor).spice + 1;
    reject(g,f.actor,{type:'bid',amount});
    assert.notEqual(g.auction?.bidder,f.actor);
    assert.ok(held(g,f.actor,f.karama));
  }
});

void test('all four profiles use only the projected physical Kull cost', () => {
  const f = fixture(), offered = act(f.game,f.actor,attempt(f));
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(offered,f.reactor); v.players.find(p => p.id === f.reactor)!.bot = difficulty;
    const action = botActions(v)[0]; assert.ok(action,difficulty);
    assert.deepEqual(action,{type:'kullDecision',event:v.kullReaction!.event,source:'printed',card:f.kull});
    const result = act(offered,f.reactor,action); assert.equal(result.pendingKull?.stage,'counter');
    assert.deepEqual(inventory(result),f.originalCards);
  }
});

void test('a legacy unmarked Basic game retains its original Karama path', () => {
  const f = fixture(), legacy = structuredClone(f.game);
  // This controlled legacy-shape supplement removes the opt-in stamp only;
  // the original cards, turn, board and wallets remain from native play.
  delete legacy.kullPreview;
  const completed = act(legacy,f.actor,attempt(f));
  assert.equal(completed.pendingKull ?? null,null);
  assert.equal(completed.karamaShipping?.owner,f.actor);
  assert.equal(completed.discard.filter(card => card.id === f.karama).length,1);
  assert.ok(held(completed,f.reactor,f.kull));
  assert.deepEqual(inventory(completed),f.originalCards);
});
