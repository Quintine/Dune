import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { fighterCount } from '../game/advisors';
import { caladanReinforcementChoice } from '../game/caladan-reinforcement-options';
import { TERROR_KINDS } from '../game/moritani-terror';
import {
  actCaladanArrival as act, advanceCaladanArrival as advance,
  allowCaladanArrivalResponses as allow, caladanArrivalInventory as inventory,
  caladanArrivalPlayer as p, caladanArrivalReload as reload,
  createCaladanArrivalFixture as fixture,
} from './fixture-caladan-arrival';

function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
function completed(g: Game, event: string) {
  assert.equal(g.homeworldVictoryReinforcement!.event, event);
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.equal(p(g,'a').reserves, 5);
  inventory(g);
}

void test('controlled Caladan battle sources record actual plans, calls and the original free addition', () => {
  const f = fixture({bg:true});
  assert.match(f.disclosure, /Controlled.*not public acquisition/);
  assert.equal(f.sourceCount, f.actions.length);
  assert.equal(f.actions.filter(s => s.action.type === 'chooseBattle').length,1);
  assert.equal(f.actions.filter(s => s.action.type === 'battlePlan').length,2);
  assert.equal(f.actions.filter(s => s.action.type === 'traitorCall').length,2);
  assert.equal(f.source.homeworldVictoryReinforcement,undefined);
  const before = structuredClone(p(f.game,'a'));
  const g = act(reload(f.game),'a',f.action);
  assert.equal(p(g,'a').reserves,before.reserves-1);
  assert.equal(p(g,'a').forces[f.destination],before.forces[f.destination]+1);
  for (const field of ['spice','shipped','moved','battleLosses'] as const)
    assert.deepEqual(p(g,'a')[field],before[field]);
  assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
  assert.equal(g.homeworldRevivalReturn,undefined);
  inventory(g);
});

for (const flip of [false,true])
  void test(`Caladan Advanced Intrusion ${flip ? 'flip' : 'keep'} waits for the original arrival`, () => {
    const f = fixture({bg:true});
    let g = act(reload(f.game),'a',f.action);
    assert.equal(g.decision?.kind,'intrusion');
    assert.equal(g.decision?.player,'bg');
    assert.equal(g.decision?.kind === 'intrusion' && g.decision.victoryEvent,f.event);
    assert.equal(fighterCount(p(g,'bg'),f.territory),1);
    reject(g,'a',f.action);
    g = act(g,'bg',{type:'decision',accept:flip});
    if (flip) {
      assert.equal(g.response?.kind,'advisorFlip');
      assert.equal(g.response?.advisorVictoryEvent,f.event);
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      g = allow(g);
    }
    g = advance(g);
    assert.equal(fighterCount(p(g,'bg'),f.territory),flip ? 0 : 1);
    assert.equal(p(g,'bg').forces[f.destination],1);
    assert.equal(p(g,'a').forces[f.destination],3);
    completed(g,f.event);
    reject(g,'a',f.action);
  });

void test('Caladan Terror decline leaves the original hidden token and completes once', () => {
  const f = fixture({terror:'robbery'});
  let g = act(reload(f.game),'a',f.action);
  assert.equal(g.pendingTerrorEntry?.cause,'caladanReinforcement');
  assert.equal(g.pendingTerrorEntry?.victoryEvent,f.event);
  assert.equal(g.pendingTerrorEntry?.entrant,'a');
  assert.equal(g.pendingTerrorEntry?.amount,1);
  assert.equal(g.pendingTerrorEntry?.elite,0);
  assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
  reject(g,'a',{type:'decision',decline:true});
  g = act(g,'m',{type:'decision',decline:true});
  g = advance(g);
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === f.token)!.status,'placed');
  assert.equal(p(g,'a').forces[f.destination],3);
  completed(g,f.event);
});

for (const kind of TERROR_KINDS)
  void test(`Caladan original Terror ${kind} resolves before its reinforcement completes`, () => {
    const f = fixture({terror:kind});
    let g = act(reload(f.game),'a',f.action);
    const before = reload(g), entry = g.pendingTerrorEntry!;
    assert.equal(entry.stage,'offer');
    assert.equal(entry.victoryEvent,f.event);
    assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
    g = act(g,'m',{type:'decision',reveal:true});
    if (kind === 'robbery') {
      assert.equal(g.pendingTerrorEntry?.stage,'robbery');
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      g = act(g,'m',{type:'decision',choice:'spice'});
      const stolen = Math.ceil(p(before,'a').spice/2);
      assert.equal(p(g,'a').spice,p(before,'a').spice-stolen);
      assert.equal(p(g,'m').spice,p(before,'m').spice+stolen);
    } else if (kind === 'sneakAttack') {
      assert.equal(g.pendingTerrorEntry?.stage,'sneakAttack');
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      g = act(g,'m',{type:'decision',amount:1});
      assert.equal(p(g,'m').reserves,p(before,'m').reserves-1);
      assert.equal(p(g,'m').forces[f.destination],1);
      assert.equal(p(g,'m').spice,p(before,'m').spice);
    } else if (kind === 'sabotage') {
      g = advance(g);
      assert.equal(g.pendingTerrorEntry?.stage,'gift');
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      assert.ok(g.discard.some(c => c.id === f.heldCard));
      assert.equal(p(g,'a').hand.length,0);
      g = act(g,'m',{type:'decision',decline:true});
    } else if (kind === 'assassination') {
      const deadBefore = p(before,'a').leaders.filter(l => l.dead).length;
      assert.equal(p(g,'a').leaders.filter(l => l.dead).length,deadBefore+1);
      const victim = p(g,'a').leaders.find(l => l.dead && !p(before,'a').leaders.find(old => old.id === l.id)!.dead)!;
      assert.equal(p(g,'m').spice,p(before,'m').spice+victim.strength);
    } else if (kind === 'extortion') {
      assert.ok(g.moritaniExtortion);
      assert.equal(g.moritaniTerror!.tokens.find(t => t.id === f.token)!.status,'extortion');
      assert.equal(p(g,'m').spice,p(before,'m').spice);
    } else {
      assert.equal(p(g,'a').forces[f.destination] ?? 0,0);
      assert.equal(p(g,'a').tanks,p(before,'a').tanks+3);
    }
    g = advance(g);
    assert.equal(g.pendingTerrorEntry,null);
    if (kind !== 'extortion')
      assert.equal(g.moritaniTerror!.tokens.find(t => t.id === f.token)!.status,'removed');
    completed(g,f.event);
    reject(g,'a',f.action);
  });

void test('Caladan adds directly to a surviving army aboard the actual Ix HMS without shipping', () => {
  const f = fixture({hms:true});
  assert.ok(f.source.mobileStronghold?.location);
  assert.equal(f.territory,'hidden_mobile_stronghold');
  const choice = caladanReinforcementChoice(viewGame(f.game,'a'),f.destination);
  assert.equal(choice.blocked,null);
  assert.deepEqual(choice.action,f.action);
  const before = structuredClone(p(f.game,'a'));
  const g = advance(act(reload(f.game),'a',choice.action!));
  assert.equal(p(g,'a').forces[f.destination],3);
  for (const field of ['spice','shipped','moved'] as const)
    assert.deepEqual(p(g,'a')[field],before[field]);
  assert.deepEqual(g.mobileStronghold,f.game.mobileStronghold);
  completed(g,f.event);
});

void test('Caladan original event and owner reject stale, foreign and oversized entry before cost', () => {
  const f = fixture({bg:true});
  reject(f.game,'g',f.action);
  reject(f.game,'a',{...f.action,event:`${f.event}:stale`});
  reject(f.game,'a',{...f.action,amount:2});
  reject(f.game,'a',{...f.action,destination:'arrakeen:10'});
  assert.equal(p(f.game,'a').reserves,6);
  assert.equal(p(f.game,'a').forces[f.destination],2);
  inventory(f.game);
});

void test('all four minimal profiles use the actual Caladan and Intrusion controls legally', () => {
  const f = fixture({bg:true});
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    let g = reload(f.game);
    const own = viewGame(g,'a');
    own.players.find(seat => seat.id === 'a')!.bot = profile;
    const action = botActions(own).find(a => a.type === 'decision' && a.event === f.event);
    assert.ok(action,`${profile} needs a current original reinforcement action.`);
    g = act(g,'a',action);
    if (g.decision?.kind === 'intrusion') {
      const view = viewGame(g,'bg');
      view.players.find(seat => seat.id === 'bg')!.bot = profile;
      const reaction = botActions(view)[0];
      assert.ok(reaction,`${profile} needs a native Intrusion choice.`);
      g = allow(act(g,'bg',reaction));
    }
    g = advance(g);
    assert.equal(g.homeworldVictoryReinforcement!.stage,'complete');
    assert.equal(p(g,'a').reserves,action.decline ? 6 : 5);
    assert.equal(g.lastBattleContext!.caladanReinforcement!.completed,true);
    inventory(g);
  }
});

for (const first of ['first','second'] as const)
  void test(`Caladan Ambassador ${first} in storm order retains its original victory through Terror`, () => {
    const f = fixture({terror:'robbery',ambassador:first});
    let g = act(reload(f.game),'a',f.action);
    assert.equal(g.pendingArrivalOverlap?.first,first === 'first' ? 'ambassador' : 'terror');
    assert.equal(g.pendingArrivalOverlap?.victoryEvent,f.event);
    const declineAmbassador = () => {
      const entry = g.pendingAmbassador; assert.ok(entry);
      assert.equal(entry.victoryEvent,f.event);
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      g = act(g,'ec',{type:'decision',event:entry.event,decline:true});
    };
    const declineTerror = () => {
      assert.equal(g.pendingTerrorEntry?.victoryEvent,f.event);
      assert.equal(g.homeworldVictoryReinforcement!.stage,'arrival');
      g = act(g,'m',{type:'decision',decline:true});
    };
    if (first === 'first') { declineAmbassador(); declineTerror(); }
    else { declineTerror(); declineAmbassador(); }
    g = advance(g);
    assert.equal(g.pendingArrivalOverlap,null);
    assert.equal(g.homeworldVictoryReinforcement!.ambassadors!.length,1);
    assert.equal(g.homeworldVictoryReinforcement!.ambassadors![0].completed,true);
    assert.equal(p(g,'a').forces[f.destination],3);
    completed(g,f.event);
  });
