import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, initializeKullGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bribePromiseModeSupported } from '../game/bribe-promises';
import { act, advance, clean, player, inventory, attempt, createKullNativeIxFixture,
  type KullNativeIxFixture, type IxNativeRoster } from './fixture-kull-native-ix';

const held = (game: Game, seat: string, card: string) => player(game,seat).hand.some(row=>row.id === card);
function question(f: KullNativeIxFixture, game: Game): Game {
  game = act(game,f.asker,{type:'card',card:f.truth});
  while (game.truthtrance?.stage === 'priority') {
    const seat = game.players.find(row=>!game.truthtrance!.passed.includes(row.id));
    assert.ok(seat);
    game = act(game,seat.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  game = act(game,f.asker,{type:'truthAsk',question:{kind:'bribe',target:f.actor,
    turn:game.turn,recipient:f.recipient,minimum:1}});
  assert.ok(viewGame(game,f.actor).truthBribeAnswers?.includes('yes'));
  return act(game,f.actor,{type:'truthAnswer',answer:'yes'});
}
function offer(f: KullNativeIxFixture, game: Game) {
  game = act(game,f.actor,attempt(f));
  assert.equal(game.pendingKull?.stage,'offer');
  const reaction = viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(row=>row.card.id === f.kull && !row.blocked));
  assert.ok(held(game,f.actor,f.karama));
  return {game,reaction};
}
function declare(f: KullNativeIxFixture, game: Game): Game {
  const reaction = viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  return act(game,f.reactor,{type:'kullDecision',event:reaction.event,source:'printed',card:f.kull});
}

void test('the native Ix faction extension does not open the Advanced audit initializer', () => {
  for (const faction of ['ixians', 'tleilaxu'] as const) {
    const game = createGame('ADVANCEDKULL', newPlayer('choam','CHOAM','choam'), true, ['choam','ix']);
    joinGame(game, newPlayer(faction,faction,faction));
    const before = structuredClone(game);
    assert.throws(() => initializeKullGameForAudit(game), /Kull preview/);
    assert.deepEqual(game,before);
  }
});

for (const roster of ['ixians','tleilaxu','both'] as const satisfies readonly IxNativeRoster[]) {
  void test(`public Basic ${roster} native setup and Kull retain original Karama, counter and bribe`,()=>{
    const f = createKullNativeIxFixture(roster);
    assert.ok(f.actions.some(row=>row.actor === f.lobby.host && row.action.type === 'start'));
    assert.equal(bribePromiseModeSupported(f.game),true);
    const bound = question(f,f.game);
    const savedPromise = structuredClone(bound.bribePromises);
    const {game:pending,reaction} = offer(f,bound);
    assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
    assert.deepEqual(pending.bribePromises,savedPromise);

    const declined = act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
    assert.equal(declined.karamaShipping?.owner,f.actor);
    assert.equal(declined.discard.filter(card=>card.id === f.karama).length,1);
    assert.ok(held(declined,f.reactor,f.kull));
    assert.deepEqual(declined.bribePromises,savedPromise);
    assert.deepEqual(inventory(declined),f.originalCards);

    const declared = declare(f,pending);
    const successful = advance(declared,clean);
    assert.equal(successful.karamaShipping,null);
    assert.ok(held(successful,f.actor,f.karama));
    assert.equal(successful.discard.filter(card=>card.id === f.kull).length,1);
    assert.deepEqual(successful.bribePromises,savedPromise);
    const paid = act(successful,f.actor,{type:'bribe',target:f.recipient,amount:1});
    assert.equal(player(paid,f.recipient).bribes,1);
    assert.ok(paid.bribePromises?.at(-1)?.fulfilled);
    assert.deepEqual(inventory(paid),f.originalCards);

    const counter = viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
    assert.ok(counter.includes(f.counter),'The Emperor holds a distinct real Karama counter');
    const interrupted = act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
    const resumed = advance(interrupted,clean);
    assert.equal(resumed.karamaShipping?.owner,f.actor);
    assert.ok(held(resumed,f.reactor,f.kull));
    assert.equal(resumed.discard.filter(card=>card.id === f.counter).length,1);
    assert.equal(resumed.discard.filter(card=>card.id === f.karama).length,1);
    assert.deepEqual(resumed.bribePromises,savedPromise);
    const paidAfterCounter = act(resumed,f.actor,{type:'bribe',target:f.recipient,amount:1});
    assert.ok(paidAfterCounter.bribePromises?.at(-1)?.fulfilled);
    assert.deepEqual(inventory(paidAfterCounter),f.originalCards);
  });
}

void test('all four minimal bot profiles can choose the projected Kull in a native Ixian game',()=>{
  const f = createKullNativeIxFixture('ixians'), pending = offer(f,f.game).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending,f.reactor);
    view.players.find(row=>row.id === f.reactor)!.bot = difficulty;
    const action = botActions(view)[0]; assert.ok(action,difficulty);
    assert.deepEqual(action,{type:'kullDecision',event:view.kullReaction!.event,source:'printed',card:f.kull});
    const declared = act(pending,f.reactor,action);
    assert.equal(declared.pendingKull?.stage,'counter');
    assert.deepEqual(inventory(declared),f.originalCards);
  }
});

for (const roster of ['ixians','tleilaxu','both'] as const satisfies readonly IxNativeRoster[]) {
  void test(`a ${roster} Charity-funded bribe Yes survives Kull decline, block and a distinct counter`,()=>{
    const f = createKullNativeIxFixture(roster);
    const purse = player(f.early,f.actor).spice;
    assert.ok(purse > 0);
    let source = act(f.early,f.actor,{type:'bribe',target:f.recipient,amount:purse});
    assert.equal(player(source,f.actor).spice,0);
    source = question(f,source);
    const income = advance(source,state=>state.phase === 2 && state.response?.kind === 'choamCharity');
    assert.equal(income.choamCharity?.turn === income.turn,false);
    const promise = structuredClone(income.bribePromises);
    const pending = act(income,f.actor,{type:'card',mode:'cancel',card:f.karama});
    assert.equal(pending.pendingKull?.stage,'offer');
    assert.equal(pending.pendingKull?.resume.response?.kind,'choamCharity');
    assert.deepEqual(pending.bribePromises,promise);
    assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
    const reaction = viewGame(pending,f.reactor).kullReaction; assert.ok(reaction);
    assert.ok(reaction.plays.some(row=>row.card.id === f.kull && !row.blocked));
    const declined = advance(act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true}),clean);
    assert.equal(declined.choamCharity?.canceled,true);
    const declared = declare(f,pending);
    const successful = advance(declared,clean);
    assert.equal(successful.choamCharity?.canceled,false);
    const choices = viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
    assert.ok(choices.includes(f.counter));
    const interrupted = act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
    const countered = advance(interrupted,clean);
    assert.equal(countered.choamCharity?.canceled,true);
    for (const outcome of [declined,successful,countered]) {
      assert.deepEqual(outcome.bribePromises,promise);
      const guide = viewGame(outcome,f.actor).bribePromiseGuide; assert.ok(guide);
      assert.equal(guide.action.type,'charity');
      const charity = act(outcome,f.actor,guide.action);
      assert.equal(player(charity,f.actor).charityTurn,charity.turn);
      const paid = act(charity,f.actor,{type:'bribe',target:f.recipient,amount:1});
      assert.equal(player(paid,f.recipient).bribes,purse+1);
      assert.ok(paid.bribePromises?.at(-1)?.fulfilled);
      assert.deepEqual(inventory(paid),f.originalCards);
    }
  });
}
