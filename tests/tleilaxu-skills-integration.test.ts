import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { basicTleilaxuLeaderSkillsProfile } from '../game/leader-skill-profile';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { registerHooks } from 'node:module';
const aliases = registerHooks({resolve(specifier,context,next){return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier,context);}});
const { RihaniChoice } = await import('../components/rihani-decipherer');
aliases.deregister();
import { sampleInventory, verifySampleCustody } from '../tools/sample-custody';
import { completedTleilaxuSkillsGame, initializedTleilaxuSkillsOffers, assertTleilaxuSkillsCustody as custody, tleilaxuSkillsPlayer as player, reloadTleilaxuSkillsGame as reload, rejectTleilaxuSkillsAction as reject } from './tleilaxu-skills-fixture';

const act = (g: Game, owner: string, action: Action) => applyAction(reload(g), owner, action);
function stable(g: Game) {
  custody(g); verifySampleCustody(g, sampleInventory(g));
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
}
// Explicit conserved positions after genuine setup; not claimed as played phase histories.
function stage(g: Game, owner = 't', opponent = 'e') {
  for (const p of g.players) {
    g.deck.push(...p.hand); p.hand = [];
    p.forces = [owner, opponent].includes(p.id) ? { 'wind_pass:14': 6, 'carthag:11': 1 } : {};
    p.reserves = [owner, opponent].includes(p.id) ? 13 : 20; p.tanks = 0; p.spice = 20;
  }
  Object.assign(g, { phase: 6, active: owner, storm: 18, order: [owner, opponent, ...g.players.map(p => p.id).filter(id => id !== owner && id !== opponent)],
    ready: [], decision: null, response: null, phaseOpening: null, spice: {} });
  return g;
}
function open(g: Game, owner = 't', opponent = 'e') {
  g = act(g, owner, { type: 'chooseBattle', territory: 'wind_pass', target: opponent });
  for (let i = 0; i < 30; i++) {
    if (g.response) g = act(g, g.players.find(p => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
    else if (g.decision?.kind === 'leaderSkillVisibility') g = act(g, g.decision.player, { type: 'leaderSkillVisibility', event: g.decision.event, hide: true });
    else if (g.battle?.preparation) g = act(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  assert.equal(g.decision, null); assert.equal(g.battle?.preparation, undefined);
  return g;
}
function plans(g: Game, own: Partial<Action> = {}, other: Partial<Action> = {}, owner = 't', opponent = 'e') {
  g = act(g, owner, { type: 'battlePlan', dial: 4, leader: player(g, owner).leaders[0].id, ...own });
  return act(g, opponent, { type: 'battlePlan', dial: 0, leader: player(g, opponent).leaders[1].id, ...other });
}
function resolve(g: Game, owner = 't', opponent = 'e') {
  g = act(g, owner, { type: 'traitorCall', call: false });
  return act(g, opponent, { type: 'traitorCall', call: false });
}
function exchange(g: Game, owner: string) {
  const event = g.rihaniHistory!.at(-1)!.event;
  g = act(g, owner, { type: 'decision', event, draw: true });
  const r = g.rihaniHistory!.at(-1)!;
  return act(g, owner, { type: 'decision', event, cards: [r.drawn[0], r.eligible[0]] });
}

void test('all fourteen skills admit genuine Basic Tleilaxu setup while public, Advanced, Richese and module gates remain closed', () => {
  for (const card of LEADER_SKILL_CARDS) {
    const game = completedTleilaxuSkillsGame({ requestedSkill: card.id });
    assert.equal(game.leaderSkills!.assignments.find(a => a.owner === 't')!.skill, card.id);
    assert.equal(basicTleilaxuLeaderSkillsProfile(game), true);
    assert.equal(basicTleilaxuLeaderSkillsProfile(viewGame(game, 'a')), true);
    stable(game);
  }
  for (const mutate of [(g: Game) => {g.advanced = true;}, (g: Game) => {g.players[1] = newPlayer('x','Richese','richese');},
    (g: Game) => {g.discoveryEnabled = true;}, (g: Game) => {g.expansions.push('choam');}]) {
    const g = createGame('TLEIGATE',newPlayer('t','Tleilaxu','tleilaxu'),false,['ix']);
    joinGame(g,newPlayer('e','Emperor','emperor'));g.players.forEach(p => {p.ready = true;});mutate(g);
    const before = JSON.stringify(g);assert.throws(() => initializeLeaderSkillsGameForAudit(g));assert.equal(JSON.stringify(g),before);
  }
  const lobby = createGame('TLEIPUBL',newPlayer('t','Tleilaxu','tleilaxu'),false,['ix']);
  joinGame(lobby,newPlayer('e','Emperor','emperor'));lobby.players.forEach(p => {p.ready = true;});reject(lobby,'t',{type:'start'});
  const offer = initializedTleilaxuSkillsOffers({requestedSkill:'rihani-decipherer'});
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(offer,'t');view.players.find(p => p.id === 't')!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'leaderSkill');assert.ok(action);assert.doesNotThrow(() => act(offer,'t',action));
  }
});

void test('native Rihani keeps a private Face Dancer, returns only an old unrevealed card and survives JSON across every choice', () => {
  let g = stage(completedTleilaxuSkillsGame({requestedSkill:'rihani-decipherer'}));
  player(g,'t').faceDancers![0].revealed = true; // Conserved pre-existing public reveal.
  const known = player(g,'t').faceDancers![0].leader;
  g = resolve(plans(open(g)));
  assert.equal(g.decision?.kind,'rihani');stable(g);
  const offered = g.rihaniHistory!.at(-1)!;
  assert.equal(offered.peeked.length,2);assert.equal(offered.drawn.length,0);assert.ok(!offered.eligible.includes(known));
  assert.deepEqual(viewGame(g,'e').rihani!.history,[]);
  reject(g,'e',{type:'decision',event:offered.event,draw:true});
  const markup = renderToStaticMarkup(createElement(RihaniChoice,{game:viewGame(g,'t'),act:()=>{},busy:false}));
  assert.match(markup,/Draw two Face Dancers/);assert.match(markup,/unrevealed/);
  g = act(g,'t',{type:'decision',event:offered.event,draw:true});stable(g);
  const drawn = g.rihaniHistory!.at(-1)!;
  assert.equal(player(g,'t').faceDancers!.length,5);assert.equal(player(g,'t').traitors.length,0);
  for (const observer of ['a','e']) {
    assert.deepEqual(viewGame(g,observer).rihani!.history,[]);
    assert.equal(viewGame(g,observer).rihani!.pending?.drawn,undefined);
  }
  reject(g,'t',{type:'decision',event:drawn.event,cards:[drawn.drawn[0],known]});
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(g,'t');view.players.find(p => p.id === 't')!.bot = difficulty;
    const action=botActions(view).find(a=>a.type==='decision');assert.ok(action);assert.doesNotThrow(()=>act(g,'t',action));
  }
  g=act(g,'t',{type:'decision',event:drawn.event,cards:[drawn.drawn[0],drawn.eligible[0]]});
  assert.equal(player(g,'t').faceDancers!.length,3);
  assert.ok(player(g,'t').faceDancers!.some(c=>c.leader===known&&c.revealed));
  assert.ok(player(g,'t').faceDancers!.some(c=>c.leader===drawn.drawn[0]&&!c.revealed));
  assert.ok(g.traitorReserve!.includes(drawn.drawn[1]));stable(g);
});

void test('completed winner Rihani cleanup releases custody for later Face Dance and returns the killed leader skill once', () => {
  let g = stage(completedTleilaxuSkillsGame({requestedSkill:'rihani-decipherer',skillOwner:'atreides'}),'a','e');
  const target='atreides-0', dancer=player(g,'t').faceDancers![0];
  // Swap physical identities to target this battle without fabricating a card.
  const index=g.traitorReserve!.indexOf(target);
  if(index>=0) {g.traitorReserve![index]=dancer.leader;dancer.leader=target;}
  else {
    const held=g.players.find(p=>p.traitors.includes(target));
    if(held) {held.traitors[held.traitors.indexOf(target)]=dancer.leader;dancer.leader=target;}
    else assert.ok(player(g,'t').faceDancers!.some(c=>c.leader===target));
  }
  g=resolve(plans(open(g,'a','e'),{},{},'a','e'),'a','e');
  g=exchange(g,'a');
  assert.equal(g.decision?.kind,'faceDance');assert.equal(g.lastBattleContext!.rihani!.faceDanceStarted,true);stable(g);
  const before=structuredClone(g.rihaniHistory), spice=player(g,'t').spice;
  g=act(g,'t',{type:'decision',reveal:true,sources:{reserves:1},sector:14});
  assert.equal(g.phase,6);assert.equal(player(g,'a').leaders[0].dead,true);
  assert.ok(!g.leaderSkills!.assignments.some(a=>a.leader===target));
  assert.equal(g.leaderSkills!.deck.filter(s=>s==='rihani-decipherer').length,1);
  assert.deepEqual(g.rihaniHistory,before);assert.equal(player(g,'t').spice,spice);stable(g);
});

void test('Zoal Smuggler collects copied opposing printed strength at reveal, including zero for Cheap Hero', () => {
  for (const strength of [5,3,0]) {
    let g=stage(completedTleilaxuSkillsGame({requestedSkill:'smuggler'}));g.spice={'wind_pass:14':9};
    let other:Partial<Action>;
    if(strength===0) {
      const i=g.deck.findIndex(c=>c.kind==='hero');assert.ok(i>=0);
      const card=g.deck.splice(i,1)[0];player(g,'e').hand.push(card);other={leader:card.id};
    } else {
      const disc=player(g,'e').leaders.find(l=>l.strength===strength);assert.ok(disc);other={leader:disc.id};
    }
    g=plans(open(g),{},other);
    assert.equal(g.battle!.smugglerCollection!.strength,strength);
    assert.equal(player(g,'t').spice,20); // Sealing/reveal records, settlement collects.
    g=resolve(g);assert.equal(player(g,'t').spice,20+strength);assert.equal(g.spice['wind_pass:14'],9-strength);stable(g);
  }
});
