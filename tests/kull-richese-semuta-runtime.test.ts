import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, advance, attempt, clean, createKullRicheseSemutaFixture, inventory, player,
  type KullRicheseSemutaFixture } from './fixture-kull-richese-semuta';

const held=(game:Game,id:string,card:string)=>player(game,id).hand.some(row=>row.id===card);
function pendingKull(f:KullRicheseSemutaFixture) {
  const pending=act(f.game,f.actor,attempt(f));
  assert.equal(pending.pendingKull?.stage,'offer');
  assert.ok(held(pending,f.actor,f.karama));
  const reaction=viewGame(pending,f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(row=>row.card.id===f.kull && !row.blocked));
  return pending;
}
function declare(f:KullRicheseSemutaFixture,game:Game) {
  const reaction=viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  const declared=act(game,f.reactor,{type:'kullDecision',event:reaction.event,source:'printed',card:f.kull});
  assert.equal(declared.pendingKull?.stage,'counter');
  return declared;
}
function fresh(game:Game,card:string,discardedBy:string) {
  const pending=game.pendingTreacheryDiscard; assert.ok(pending,'A fresh public discard must offer Semuta');
  assert.equal(pending.reaction?.stage,'offer');
  assert.deepEqual(pending.batch.entries.map(entry=>({id:entry.card.id,discardedBy:entry.discardedBy,publicFace:entry.publicFace})),
    [{id:card,discardedBy,publicFace:true}]);
  assert.equal(game.discard.filter(row=>row.id===card).length,1);
  return pending.batch.event;
}
function react(game:Game,f:KullRicheseSemutaFixture,claim:boolean) {
  const pending=game.pendingTreacheryDiscard; assert.ok(pending);
  const event=pending.batch.event,card=pending.batch.entries[0].card.id;
  if (claim) {
    assert.equal(viewGame(game,f.holder).semutaReaction?.canCommit,true);
    game=act(game,f.holder,{type:'semutaCommit',event});
    if (game.pendingTreacheryDiscard?.reaction?.stage==='select')
      game=act(game,f.holder,{type:'semutaSelect',event,card});
  } else {
    for (let count=0;game.pendingTreacheryDiscard?.batch.event===event && count<game.players.length;count++) {
      const reaction=game.pendingTreacheryDiscard!.reaction; assert.ok(reaction?.stage==='offer');
      const actor=game.players.find(row=>!reaction.passed.includes(row.id)); assert.ok(actor);
      game=act(game,actor.id,{type:'semutaPass',event});
    }
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event,event,'Retire exactly the selected fresh batch');
  return game;
}
function assertSemutaResult(game:Game,f:KullRicheseSemutaFixture,card:string,claim:boolean) {
  assert.equal(held(game,f.holder,card),claim);
  assert.equal(held(game,f.holder,f.semuta),!claim);
  assert.equal(game.discard.filter(row=>row.id===card).length,Number(!claim));
  assert.equal(game.discard.filter(row=>row.id===f.semuta).length,Number(claim));
  assert.deepEqual(inventory(game),f.originalCards);
}

for (const claim of [false,true]) void test(`Basic native Richese may ${claim?'claim':'pass'} the successfully played Kull`,()=>{
  const f=createKullRicheseSemutaFixture();
  const declared=declare(f,pendingKull(f));
  const pending=advance(declared,state=>!!state.pendingTreacheryDiscard);
  const event=fresh(pending,f.kull,f.reactor);
  assert.ok(held(pending,f.actor,f.karama),'The prevented original is still held');
  assert.equal(pending.karamaShipping,null);
  const before=structuredClone(pending);
  assert.throws(()=>act(pending,f.actor,attempt(f)));
  assert.deepEqual(pending,before);
  let game=react(pending,f,claim);
  game=advance(game,clean);
  assert.equal(game.pendingKull,null);
  assert.equal(game.karamaShipping,null);
  assert.ok(held(game,f.actor,f.karama));
  assert.ok(viewGame(game,f.actor).karamaBlocked);
  assertSemutaResult(game,f,f.kull,claim);
  assert.throws(()=>act(game,f.holder,{type:'semutaCommit',event}));
});

for (const claim of [false,true]) void test(`Basic native Richese may ${claim?'claim':'pass'} the distinct Kull-counter Karama`,()=>{
  const f=createKullRicheseSemutaFixture();
  const declared=declare(f,pendingKull(f));
  assert.ok(viewGame(declared,f.counterOwner).responseControls?.cancelCards.includes(f.counter));
  const pending=act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
  const event=fresh(pending,f.counter,f.counterOwner);
  assert.ok(held(pending,f.actor,f.karama),'The original Karama remains reserved until the counter completes');
  assert.ok(held(pending,f.reactor,f.kull),'The canceled Kull remains held');
  assert.equal(pending.karamaShipping,null);
  let game=react(pending,f,claim);
  game=advance(game,clean);
  assert.equal(game.pendingKull,null);
  assert.equal(game.karamaShipping?.owner,f.actor);
  assert.ok(held(game,f.reactor,f.kull));
  assert.equal(game.discard.filter(row=>row.id===f.karama).length,1);
  assertSemutaResult(game,f,f.counter,claim);
  assert.throws(()=>act(game,f.holder,{type:'semutaCommit',event}));
});

void test('all minimal bot profiles choose a legal Semuta reaction to Kull',()=>{
  const f=createKullRicheseSemutaFixture();
  const pending=advance(declare(f,pendingKull(f)),state=>!!state.pendingTreacheryDiscard);
  fresh(pending,f.kull,f.reactor);
  for (const difficulty of DIFFICULTIES) {
    const view=viewGame(pending,f.holder);
    view.players.find(row=>row.id===f.holder)!.bot=difficulty;
    const action=botActions(view)[0]; assert.ok(action,difficulty);
    assert.ok(['semutaPass','semutaCommit'].includes(action.type),difficulty);
    let game=act(pending,f.holder,action);
    if (game.pendingTreacheryDiscard?.reaction?.stage==='select')
      game=act(game,f.holder,{type:'semutaSelect',event:pending.pendingTreacheryDiscard!.batch.event,card:f.kull});
    game=advance(game,clean);
    assert.equal(game.pendingKull,null);
    assert.equal(game.karamaShipping,null);
    assert.ok(held(game,f.actor,f.karama));
    assert.deepEqual(inventory(game),f.originalCards);
  }
});

for (const holdsSemuta of [false,true]) void test(`a nested Ornithopter parent with ${holdsSemuta?'held':'unheld'} Semuta hides Kull and preserves decline`,()=>{
  const f=createKullRicheseSemutaFixture();
  const source=structuredClone(f.game);
  // Controlled parent supplement: move the original physical Ornithopter from
  // Richese's cache into the active player's legal unfinished flight slot.
  // The exact phase, actor, counters and other physical cards are native.
  const index=source.richeseCache!.findIndex(card=>card.name==='Ornithopter');
  assert.ok(index>=0);
  const card=source.richeseCache!.splice(index,1)[0];
  source.ornithopter={event:'controlled-kull-semuta-flight',player:f.actor,card,turn:source.turn,
    mode:'range3',startingMove:player(source,f.actor).moved,completed:0};
  if (!holdsSemuta) {
    // A conserved controlled transfer gives the same public parent without a
    // Semuta holder; the eligibility gate must never inspect that hidden fact.
    const hand=player(source,f.holder).hand;
    const semuta=hand.findIndex(row=>row.id===f.semuta); assert.ok(semuta>=0);
    source.richeseCache!.push(hand.splice(semuta,1)[0]);
  }
  const pending=act(source,f.actor,attempt(f));
  assert.equal(pending.pendingKull?.stage,'offer');
  const reaction=viewGame(pending,f.reactor).kullReaction; assert.ok(reaction);
  assert.equal(reaction.canDecline,true);
  assert.deepEqual(reaction.plays,[],'Unsupported parent blocks the public Kull play independent of hidden Semuta ownership');
  assert.ok(held(pending,f.reactor,f.kull));
  const declined=act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  const resumed=advance(declined,clean);
  assert.equal(resumed.pendingKull,null);
  assert.equal(resumed.karamaShipping?.owner,f.actor);
  assert.equal(resumed.discard.filter(row=>row.id===f.karama).length,1);
  assert.deepEqual(resumed.ornithopter,source.ornithopter);
  assert.ok(held(resumed,f.reactor,f.kull));
});
