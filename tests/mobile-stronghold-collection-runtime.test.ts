import assert from 'node:assert/strict';
import test from 'node:test';
import { type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION, mobileRoutes, splitLocation, territory } from '../game/board';
import { createSemutaIxianMovementFixture as fixture, actSemutaIxianMovement as act,
  allowSemutaIxianMovement as allow, passSemutaIxianMovement as pass,
  semutaIxianMovementPlayer as player, semutaIxianMovementInventory as inventory } from './fixture-semuta-ixian-movement';

function reject(game: Game, actor: string, action: Action) {
  const before=structuredClone(game); assert.throws(() => act(game,actor,action)); assert.deepEqual(game,before);
}
function totalSpice(game: Game) { return Object.values(game.spice).reduce((sum,value) => sum+value,0); }
function selections(route: readonly string[], chosen: Readonly<Record<string,number>> = {}) {
  return route.map(location => ({location,amount:chosen[location] ?? 0}));
}

/** The source's actual turn-2 native route and forces are retained. For two
 * sector-choice tests only, redistribute existing board spice into two sand
 * sectors of one valid distinct-sector route. The total is conserved; the
 * resulting pile locations are a controlled setup, not earned Spice Blows. */
function twoPiles(game: Game) {
  const staged=structuredClone(game), before=totalSpice(staged);
  assert.ok(before >= 5, 'The real preceding blow supplies at least five spice');
  const route=mobileRoutes(staged,3).find(candidate =>
    candidate.filter(key => territory(splitLocation(key).territory).type === 'sand').length >= 2);
  assert.ok(route, 'A native connected route must visit two sand sectors');
  const [first,second]=route.filter(key => territory(splitLocation(key).territory).type === 'sand');
  const original=Object.keys(staged.spice)[0]; assert.ok(original);
  staged.spice={ [first]:3, [second]:2 };
  staged.spice[original]=(staged.spice[original] ?? 0)+before-5;
  assert.equal(totalSpice(staged),before); assert.notEqual(first,second);
  return {game:staged,route,first,second};
}

for (const advanced of [false,true]) {
  const mode=advanced ? 'Advanced' : 'Basic';
  void test(`${mode} the actual prior-blow route accepts a partial native collection and keeps omitted legacy behavior`, () => {
    const f=fixture({kind:'mobileStronghold',advanced});
    const source=structuredClone(f.beforeDeclaration), route=f.route!;
    const pile=f.collection[0].location, sourceSpice=structuredClone(source.spice);
    assert.ok((source.spice[pile] ?? 0)>0); assert.equal(player(source,f.owner).forces[MOBILE_LOCATION],6);
    const records=selections(route,{[pile]:1});
    let pending=act(source,f.owner,{type:'decision',route,collect:true,collections:records});
    assert.equal(pending.response?.kind,'mobileStronghold');
    assert.deepEqual(pending.pendingMobileMove?.route,route);
    assert.deepEqual(pending.spice,sourceSpice,'A pending cancelable move spends no board spice');
    let done=allow(pending);
    assert.equal(player(done,f.owner).spice,player(source,f.owner).spice+1);
    assert.equal(done.spice[pile] ?? 0,sourceSpice[pile]-1);
    for (const [key,amount] of Object.entries(sourceSpice)) if (key !== pile) assert.equal(done.spice[key] ?? 0,amount);
    assert.equal(done.mobileStronghold?.location,route.at(-1));
    assert.deepEqual(inventory(done),f.originalInventory);
    // Legacy `collect:true` keeps the historical complete per-sector harvest.
    pending=act(source,f.owner,{type:'decision',route,collect:true}); done=allow(pending);
    assert.equal(player(done,f.owner).spice,player(source,f.owner).spice+f.collectionAmount);
    assert.deepEqual(inventory(done),f.originalInventory);
    // Legacy explicit false declines every native route collection.
    pending=act(source,f.owner,{type:'decision',route,collect:false}); done=allow(pending);
    assert.equal(player(done,f.owner).spice,player(source,f.owner).spice);
    assert.deepEqual(done.spice,sourceSpice);
  });

  void test(`${mode} ordered route choices can take from one sector and leave another`, () => {
    const f=fixture({kind:'mobileStronghold',advanced}), staged=twoPiles(f.beforeDeclaration);
    const before=structuredClone(staged.game), records=selections(staged.route,{[staged.first]:2});
    let game=act(staged.game,f.owner,{type:'decision',route:staged.route,collect:true,collections:records});
    assert.equal(game.response?.kind,'mobileStronghold');
    assert.deepEqual(game.spice,before.spice);
    game=allow(game);
    assert.equal(player(game,f.owner).spice,player(before,f.owner).spice+2);
    assert.equal(game.spice[staged.first] ?? 0,before.spice[staged.first]-2);
    assert.equal(game.spice[staged.second],before.spice[staged.second]);
    assert.equal(totalSpice(game),totalSpice(before)-2);
    assert.deepEqual(inventory(game),f.originalInventory);
  });

  void test(`${mode} malformed route allocations and repeated routes reject without mutation`, () => {
    const f=fixture({kind:'mobileStronghold',advanced}), staged=twoPiles(f.beforeDeclaration);
    const {game,route,first,second}=staged;
    const valid=selections(route,{[first]:1,[second]:1});
    const action=(collections:unknown,customRoute=route,collect=true): Action =>
      ({type:'decision',route:customRoute,collect,collections});
    reject(game,f.owner,action(valid.slice(1)));
    reject(game,f.owner,action([...valid,{location:first,amount:0}]));
    const wrong=structuredClone(valid); wrong[0].location=first; if (route[0] === first) wrong[0].location=second;
    reject(game,f.owner,action(wrong));
    const neg=structuredClone(valid); neg[route.indexOf(first)].amount=-1; reject(game,f.owner,action(neg));
    const fractional=structuredClone(valid); fractional[route.indexOf(first)].amount=0.5; reject(game,f.owner,action(fractional));
    const oversized=structuredClone(valid); oversized[route.indexOf(first)].amount=game.spice[first]+1; reject(game,f.owner,action(oversized));
    reject(game,f.owner,action(valid,route,false));
    const repeated=[...route,route[route.length-2]];
    reject(game,f.owner,action(selections(repeated),repeated));
    assert.deepEqual(inventory(game),f.originalInventory);
  });

  void test(`${mode} selection respects the per-force sector cap and the original Karama cancel`, () => {
    const f=fixture({kind:'mobileStronghold',advanced}), staged=twoPiles(f.beforeDeclaration);
    // Controlled force-custody supplement: move five original Ixian counters
    // from the HMS to reserves, retaining one of the original three Cyborgs.
    // Totals and the typed seven-Cyborg inventory remain unchanged.
    const reduced=structuredClone(staged.game), ix=player(reduced,f.owner);
    assert.equal(ix.forces[MOBILE_LOCATION],6); assert.equal(ix.elites!.forces[MOBILE_LOCATION],3);
    ix.forces[MOBILE_LOCATION]=1; ix.reserves+=5;
    ix.elites!.forces[MOBILE_LOCATION]=1; ix.elites!.reserves+=2;
    assert.ok(reduced.spice[staged.first] >= 3);
    const tooMuch=selections(staged.route,{[staged.first]:3});
    reject(reduced,f.owner,{type:'decision',route:staged.route,collect:true,collections:tooMuch});
    const records=selections(staged.route,{[staged.first]:2,[staged.second]:1});
    let game=act(reduced,f.owner,{type:'decision',route:staged.route,collect:true,collections:records});
    assert.equal(game.response?.kind,'mobileStronghold');
    assert.deepEqual(game.spice,reduced.spice); assert.equal(player(game,f.owner).spice,ix.spice);
    game=act(game,f.spender,f.action);
    // Fresh Basic CHOAM/Ix setup now enables printed Kull by default. Decline
    // its real intervening offer; the original Karama then reaches Semuta.
    if (game.pendingKull?.stage === 'offer') {
      const frame=game.pendingKull;
      game=act(game,frame.player,{type:'kullDecision',event:frame.event,decline:true});
    }
    assert.ok(game.pendingTreacheryDiscard?.reaction,'The actual Karama cost offers its native Semuta continuation');
    game=pass(game);
    assert.equal(game.pendingMobileMove ?? null,null);
    assert.equal(game.mobileStronghold?.location,reduced.mobileStronghold?.location);
    assert.deepEqual(game.spice,reduced.spice); assert.equal(player(game,f.owner).spice,ix.spice);
    assert.deepEqual(inventory(game),f.originalInventory);
  });
}
