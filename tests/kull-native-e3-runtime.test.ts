import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bribePromiseModeSupported } from '../game/bribe-promises';
import { act, advance, inventory, player, createKullNativeE3Fixture,
  type E3NativeRoster, type E3NativeTarget, type KullNativeE3Fixture } from './fixture-kull-native-e3';

const held = (g: Game, playerId: string, card: string) => player(g,playerId).hand.some(row => row.id === card);
const finished = (g: Game) => !g.pendingKull && !g.response && !g.phaseOpening &&
  !g.pendingEcazPlacement && !g.pendingMoritaniPlacement;
function offer(f: KullNativeE3Fixture, state: Game): Game {
  const cards = viewGame(state,f.actor).responseControls?.cancelCards ?? [];
  assert.ok(cards.includes(f.karama),'The original Emperor holds a usable physical Karama');
  const game = act(state,f.actor,{type:'card',mode:'cancel',card:f.karama});
  assert.equal(game.pendingKull?.stage,'offer');
  const reaction = viewGame(game,f.reactor).kullReaction; assert.ok(reaction);
  assert.ok(reaction.plays.some(row => row.card.id === f.kull && !row.blocked));
  assert.ok(held(game,f.actor,f.karama));
  return game;
}
function declaration(f: KullNativeE3Fixture, state: Game): Game {
  const reaction = viewGame(state,f.reactor).kullReaction; assert.ok(reaction);
  return act(state,f.reactor,{type:'kullDecision',event:reaction.event,source:'printed',card:f.kull});
}
function placementResult(f: KullNativeE3Fixture, state: Game, placed: boolean) {
  if (f.target === 'ecaz') {
    const token = state.ecazAmbassadors?.tokens.find(row => row.id === f.token); assert.ok(token);
    assert.equal(token.zone,placed ? 'placed' : 'supply');
    assert.equal(token.location,placed ? 'carthag' : null);
  } else {
    const token = state.moritaniTerror?.tokens.find(row => row.id === f.token); assert.ok(token);
    assert.equal(token.status,placed ? 'placed' : 'available');
    assert.equal(token.location,placed ? 'carthag' : null);
  }
}

for (const [roster,target] of [['ecaz','ecaz'],['moritani','moritani'],
  ['both','ecaz'],['both','moritani']] as const satisfies readonly (readonly [E3NativeRoster,E3NativeTarget])[]) {
  void test(`Basic ${roster} Kull preserves real ${target} placement through each counter outcome`, () => {
    const f = createKullNativeE3Fixture(roster,target);
    assert.ok(f.actions.some(row => row.actor === f.lobby.host && row.action.type === 'start'));
    assert.equal(bribePromiseModeSupported(f.game),true);
    const pending = offer(f,f.game), reaction = viewGame(pending,f.reactor).kullReaction!;
    const decline = advance(act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true}),finished);
    placementResult(f,decline,false);
    assert.ok(held(decline,f.reactor,f.kull));
    assert.equal(decline.discard.filter(row => row.id === f.karama).length,1);
    assert.deepEqual(inventory(decline),f.originalCards);

    const declared = declaration(f,pending);
    const success = advance(declared,finished);
    placementResult(f,success,true);
    assert.ok(held(success,f.actor,f.karama));
    assert.equal(success.discard.filter(row => row.id === f.kull).length,1);
    assert.deepEqual(inventory(success),f.originalCards);

    const cards = viewGame(declared,f.counterOwner).responseControls?.cancelCards ?? [];
    assert.ok(cards.includes(f.counter),'Guild holds a distinct counter to Kull');
    const countered = advance(act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter}),finished);
    placementResult(f,countered,false);
    assert.ok(held(countered,f.reactor,f.kull));
    assert.equal(countered.discard.filter(row => row.id === f.counter).length,1);
    assert.equal(countered.discard.filter(row => row.id === f.karama).length,1);
    assert.deepEqual(inventory(countered),f.originalCards);
  });
}

void test('the four minimal CHOAM bot profiles can take a native Ecaz Kull reaction', () => {
  const f = createKullNativeE3Fixture('ecaz'), pending = offer(f,f.game);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending,f.reactor);
    view.players.find(row => row.id === f.reactor)!.bot = difficulty;
    const action = botActions(view)[0]; assert.ok(action,difficulty);
    assert.deepEqual(action,{type:'kullDecision',event:view.kullReaction!.event,source:'printed',card:f.kull});
    assert.equal(act(pending,f.reactor,action).pendingKull?.stage,'counter');
  }
});

void test('a native Ecaz Charity-funded bribe survives Kull decline, block and counter', () => {
  const f = createKullNativeE3Fixture('ecaz');
  const purse = player(f.early,f.actor).spice;
  assert.ok(purse > 0);
  let game = act(f.early,f.actor,{type:'bribe',target:f.counterOwner,amount:purse});
  assert.equal(player(game,f.actor).spice,0);
  game = act(game,f.asker,{type:'card',card:f.truth});
  while (game.truthtrance?.stage === 'priority') {
    const passer = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(passer);
    game = act(game,passer.id,{type:'truthPass'});
  }
  game = act(game,f.asker,{type:'truthAsk',question:{kind:'bribe',target:f.actor,
    turn:game.turn,recipient:f.counterOwner,minimum:1}});
  assert.ok(viewGame(game,f.actor).truthBribeAnswers?.includes('yes'));
  game = act(game,f.actor,{type:'truthAnswer',answer:'yes'});
  const promise = structuredClone(game.bribePromises);
  game = advance(game,state => state.phase === 2 && state.response?.kind === 'choamCharity');
  const pending = offer(f,game), reaction = viewGame(pending,f.reactor).kullReaction!;
  assert.equal(pending.pendingKull?.resume.response?.kind,'choamCharity');
  assert.equal(viewGame(pending,f.actor).bribePromiseGuide,null);
  const declined = act(pending,f.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  const declared = declaration(f,pending);
  const countered = act(declared,f.counterOwner,{type:'card',mode:'cancel',card:f.counter});
  for (const branch of [declined,declared,countered]) {
    const ready = advance(branch,state => !state.pendingKull && !state.response && !state.phaseOpening && !state.decision);
    assert.deepEqual(ready.bribePromises,promise);
    const guide = viewGame(ready,f.actor).bribePromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type,'charity');
    const charity = act(ready,f.actor,guide.action);
    assert.equal(player(charity,f.actor).charityTurn,charity.turn);
    const paid = act(charity,f.actor,{type:'bribe',target:f.counterOwner,amount:1});
    assert.equal(player(paid,f.counterOwner).bribes,purse+1);
    assert.ok(paid.bribePromises?.at(-1)?.fulfilled);
    assert.deepEqual(inventory(paid),f.originalCards);
  }
});
