import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { isAdvisor } from '../game/advisors';
import {
  createCaladanSneakFixture as fixture, openCaladanSneak as open,
  commitCaladanSneak as commit, actCaladanSneak as act,
  settleCaladanSneak as settle, passCaladanSneakResponse as pass,
  allowCaladanSneakResponses as allow, caladanSneakPlayer as p,
  caladanSneakInventory as inventory, caladanSneakReload as reload,
} from './fixture-caladan-sneak';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game,actor,action));
  assert.deepEqual(game,before);
}
function complete(game: Game, event: string) {
  assert.equal(game.homeworldVictoryReinforcement!.event,event);
  assert.equal(game.homeworldVictoryReinforcement!.stage,'complete');
  assert.equal(game.lastBattleContext!.caladanReinforcement!.completed,true);
  assert.equal(p(game,'a').reserves,5);
  assert.equal(p(game,'a').forces['arrakeen:10'],3);
  inventory(game);
}
function declineChildAmbassador(game: Game) {
  const entry = game.pendingAmbassador;
  assert.ok(entry);
  return act(game,'ec',{type:'decision',event:entry.event,decline:true});
}

void test('Caladan positive Sneak commits one distinct reserve group with one actual original receipt', () => {
  const f = fixture({bg:'none'}), opened = open(f);
  assert.match(f.disclosure,/Controlled.*no installed victory or child receipt/);
  assert.equal(f.sourceCount,f.sourceActions.length);
  assert.equal(f.sourceActions.filter(s => s.action.type === 'battlePlan').length,2);
  assert.equal(f.sourceActions.filter(s => s.action.type === 'traitorCall').length,2);
  assert.equal(f.source.homeworldVictoryReinforcement,undefined);
  const before = reload(opened.game);
  const game = settle(act(opened.game,'m',{type:'decision',amount:1}));
  assert.equal(p(game,'m').reserves,p(before,'m').reserves-1);
  assert.equal(p(game,'m').forces['arrakeen:10'],1);
  for (const id of ['a','m']) for (const field of ['spice','shipped','moved'] as const)
    assert.deepEqual(p(game,id)[field],p(before,id)[field]);
  const receipts = game.homeworldVictoryReinforcement!.terrorArrivals!;
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].packet.owner,'m');
  assert.equal(receipts[0].packet.territory,'arrakeen');
  assert.equal(receipts[0].packet.sector,10);
  assert.equal(receipts[0].packet.amount,1);
  assert.equal(receipts[0].packet.elite,0);
  assert.notEqual(receipts[0].packet.event,f.event);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.token)!.status,'removed');
  complete(game,f.event);
  reject(game,'a',f.action);
});

void test('Caladan zero Sneak spends no reserve and creates no child or free advisor source', () => {
  const f = fixture({bg:'away'}), before = open(f);
  const game = settle(act(before.game,'m',{type:'decision',amount:0}));
  assert.equal(p(game,'m').reserves,p(before.game,'m').reserves);
  assert.equal(p(game,'m').forces['arrakeen:10'],undefined);
  assert.equal(game.homeworldVictoryReinforcement!.terrorArrivals?.length ?? 0,0);
  assert.equal(game.pendingSpiritualAdvisor,undefined);
  assert.equal(game.pendingArrivalReaction?.length ?? 0,0);
  assert.equal(game.pendingAmbassador??null,null);
  complete(game,f.event);
});

for (const order of ['first','second'] as const)
  void test(`Caladan Sneak preserves the original Ambassador ${order} before its second child offer`, () => {
    const f = fixture({bg:'none',ambassador:order}), opened = open(f);
    const original = structuredClone(opened.game.pendingArrivalOverlap);
    assert.ok(original);
    assert.equal(original.victoryEvent,f.event);
    let game = act(opened.game,'m',{type:'decision',amount:1});
    if (order === 'second') {
      assert.equal(game.pendingAmbassador?.entrant,'a');
      assert.equal(game.pendingAmbassador?.event,game.pendingArrivalOverlap?.ambassadorEvent);
      assert.equal(game.pendingArrivalOverlap?.event,original.event);
      assert.equal(game.homeworldVictoryReinforcement!.stage,'arrival');
      const queued = game.pendingArrivalReaction!.find(entry => entry.entrant === 'm')!;
      assert.ok(queued);
      assert.equal(queued.caladanSneakAdvisor,true);
      assert.equal(queued.caladanArrival?.event,f.event);
      assert.equal(queued.caladanArrival?.terror?.owner,'m');
      game = declineChildAmbassador(game);
    }
    assert.equal(game.pendingArrivalOverlap,null);
    assert.equal(game.pendingAmbassador?.entrant,'m');
    assert.equal(game.pendingAmbassador?.token,f.ambassadorToken);
    assert.equal(game.pendingAmbassador?.victoryEvent,f.event);
    const records = game.homeworldVictoryReinforcement!.ambassadors!;
    assert.equal(records.length,2);
    assert.deepEqual(records.map(record => record.completed),[true,false]);
    assert.equal(records[0].entrant,'a');
    assert.equal(records[1].entrant,'m');
    assert.equal(records[1].terror?.event,game.homeworldVictoryReinforcement!.terrorArrivals![0].packet.event);
    assert.notEqual(records[0].event,records[1].event);
    reject(game,'a',f.action);
    game = settle(declineChildAmbassador(game));
    assert.deepEqual(game.homeworldVictoryReinforcement!.ambassadors!.map(record => record.completed),[true,true]);
    assert.equal(p(game,'m').reserves,19);
    assert.equal(p(game,'m').forces['arrakeen:10'],1);
    complete(game,f.event);
  });

void test('Caladan Sneak Advanced accompaniment uses its own committed source with away or resident advisors', () => {
  for (const bg of ['away','advisors'] as const) {
    const f = fixture({bg}), committed = commit(f);
    let game = committed.game;
    assert.equal(game.decision?.kind,'advisor');
    assert.ok(game.decision?.kind === 'advisor' && game.decision.caladanArrival);
    if (game.decision?.kind !== 'advisor') assert.fail('The committed Sneak group owns its advisor offer.');
    const parent = game.decision.caladanArrival!;
    assert.equal(parent.event,f.event);
    assert.equal(parent.terror?.owner,'m');
    assert.equal(parent.terror?.amount,1);
    const before = reload(game), original = structuredClone(game.homeworldVictoryReinforcement!.terrorArrivals);
    game = act(game,'bg',{type:'decision',accept:true,accompany:true});
    assert.equal(game.response?.kind,'advisor');
    assert.equal(game.response?.spiritualAdvisorSource?.phase,6);
    assert.equal(game.response?.spiritualAdvisorSource?.victoryEvent,f.event);
    assert.deepEqual(game.pendingSpiritualAdvisor!.decision.caladanArrival,parent);
    assert.equal(game.homeworldVictoryReinforcement!.stage,'arrival');
    assert.equal(p(game,'bg').reserves,p(before,'bg').reserves);
    game = allow(game);
    assert.equal(p(game,'bg').forces['arrakeen:10'],bg === 'advisors' ? 2 : 1);
    assert.equal(p(game,'bg').reserves,p(before,'bg').reserves-1);
    assert.equal(isAdvisor(p(game,'bg'),'arrakeen'),true);
    assert.deepEqual(game.homeworldVictoryReinforcement!.terrorArrivals,original);
    complete(game,f.event);
  }
});

for (const prevented of [false,true])
  void test(`Caladan Sneak Polar arrival ${prevented ? 'prevents' : 'allows'} the distinct automatic conversion`, () => {
    const f = fixture({bg:'away',polarAlone:true}), committed = commit(f);
    let game = act(committed.game,'bg',{type:'decision',accept:true,accompany:false});
    assert.equal(game.pendingSpiritualAdvisor?.stage,'shipping');
    game = pass(game);
    assert.equal(game.response?.automaticAdvisorFlip?.producer,'spiritualArrival');
    assert.equal(game.pendingSpiritualAdvisor?.stage,'arrival');
    assert.equal(p(game,'bg').forces['polar_sink:0'],1);
    assert.equal(isAdvisor(p(game,'bg'),'polar_sink'),true);
    const physical = structuredClone(p(game,'bg'));
    game = prevented ? act(game,'g',{type:'card',card:f.karama,mode:'cancel'}) : pass(game);
    game = settle(game);
    assert.equal(isAdvisor(p(game,'bg'),'polar_sink'),prevented);
    assert.equal(p(game,'bg').forces['polar_sink:0'],physical.forces['polar_sink:0']);
    assert.equal(p(game,'bg').reserves,physical.reserves);
    assert.equal(p(game,'m').forces['arrakeen:10'],1);
    assert.equal(game.discard.filter(c => c.id === f.karama).length,Number(prevented));
    assert.equal(game.homeworldVictoryReinforcement!.terrorArrivals!.length,1);
    complete(game,f.event);
  });

void test('Caladan Sneak shipping prevention leaves the committed group and original cost without replay or refund', () => {
  const f = fixture(), committed = commit(f);
  const before = reload(committed.game);
  let game = act(committed.game,'bg',{type:'decision',accept:true,accompany:true});
  assert.equal(game.response?.kind,'advisor');
  game = settle(act(game,'g',{type:'card',card:f.karama,mode:'cancel'}));
  assert.equal(p(game,'bg').reserves,p(before,'bg').reserves);
  assert.equal(p(game,'bg').forces['arrakeen:10'],undefined);
  assert.equal(p(game,'m').forces['arrakeen:10'],1);
  assert.equal(p(game,'m').reserves,19);
  assert.equal(game.discard.filter(c => c.id === f.karama).length,1);
  assert.equal(game.homeworldVictoryReinforcement!.terrorArrivals!.length,1);
  complete(game,f.event);
  reject(game,'bg',{type:'decision',accept:true,accompany:true});
});

void test('Caladan Sneak decline consumes only the original optional advisor choice', () => {
  const f = fixture(), committed = commit(f), before = structuredClone(p(committed.game,'bg'));
  const game = settle(act(committed.game,'bg',{type:'decision',accept:false}));
  assert.deepEqual(p(game,'bg'),before);
  assert.ok(p(game,'g').hand.some(c => c.id === f.karama));
  assert.equal(game.pendingSpiritualAdvisor,undefined);
  assert.equal(game.homeworldVictoryReinforcement!.terrorArrivals!.length,1);
  complete(game,f.event);
});

void test('Caladan Sneak Basic fallback uses the legal original free Polar shipment', () => {
  const f = fixture({advanced:false}), committed = commit(f), before = reload(committed.game);
  let game = act(committed.game,'bg',{type:'decision',accept:true,accompany:false});
  assert.equal(game.response?.spiritualAdvisorSource?.victoryEvent,f.event);
  game = allow(game);
  assert.equal(p(game,'bg').forces['polar_sink:0'],1);
  assert.equal(p(game,'bg').reserves,p(before,'bg').reserves-1);
  assert.equal(isAdvisor(p(game,'bg'),'polar_sink'),false);
  assert.equal(p(game,'bg').spice,p(before,'bg').spice);
  complete(game,f.event);
});

void test('Caladan Sneak keeps native owner and amount validation while the original choice is busy', () => {
  const f = fixture(), opened = open(f);
  reject(opened.game,'a',{type:'decision',amount:1});
  reject(opened.game,'m',{type:'decision',amount:-1});
  reject(opened.game,'a',f.action);
  const committed = commit(f);
  reject(committed.game,'a',{...f.action,event:`${f.event}:stale`});
  reject(committed.game,'g',{type:'decision',accept:true,accompany:true});
  assert.equal(p(committed.game,'m').reserves,19);
  assert.equal(committed.game.homeworldVictoryReinforcement!.terrorArrivals!.length,1);
  inventory(committed.game);
});

void test('all four minimal profiles can answer the actual Caladan Sneak advisor opportunity legally', () => {
  const f = fixture(), committed = commit(f);
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    let game = reload(committed.game);
    const own = viewGame(game,'bg');
    own.players.find(player => player.id === 'bg')!.bot = profile;
    const action = botActions(own)[0];
    assert.ok(action,`${profile} needs a legal original advisor choice.`);
    game = allow(act(game,'bg',action));
    assert.equal(game.homeworldVictoryReinforcement!.terrorArrivals!.length,1);
    assert.equal(p(game,'m').reserves,19);
    complete(game,f.event);
  }
});
