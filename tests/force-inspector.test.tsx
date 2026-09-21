import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FACTIONS } from '../game/catalog';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField } from '../game/richese-no-field';

const aliases=registerHooks({
  resolve(specifier,context,next) { return next(specifier==='next/link'?'vinext/shims/link':specifier==='next/image'?'vinext/shims/image':specifier,context); },
  load(url,context,next) {
    if(!url.endsWith('.module.css')) return next(url,context);
    const css=readFileSync(new URL(url),'utf8');
    const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>[m[1],m[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const { ForceCounterFace, ForceInventoryDetails, ForceReferenceGallery }=await import('../components/force-inspector');
const { GameTable }=await import('../components/game-table');
aliases.deregister();

void test('live player summaries expose named inspection to every seat without sending an action', () => {
  const g=createGame('FORCEUI',newPlayer('a','A observer','atreides'));
  joinGame(g,newPlayer('h','H observer','harkonnen'));
  const before=JSON.stringify(g);
  const html=renderToStaticMarkup(createElement(GameTable,{game:viewGame(g,'a'),send:async()=>{assert.fail('Inspection must not act.');},onExit(){},busy:true}));
  assert.match(html,/Inspect forces: A observer · Atreides/);
  assert.match(html,/Inspect forces: H observer · Harkonnen/);
  assert.equal((html.match(/>Inspect forces</g)??[]).length,2);
  assert.equal(JSON.stringify(g),before);
});

void test('reference covers every faction and renders enlarged ordinary, special and advisor identities', () => {
  const html=renderToStaticMarkup(createElement(ForceReferenceGallery));
  for(const house of FACTIONS) {
    assert.ok(html.includes(`value="${house.id}"`));
    const face=renderToStaticMarkup(createElement(ForceCounterFace,{factionId:house.id,kind:'force'}));
    assert.ok(face.includes(`${house.name} `));
  }
  for(const [id,name] of [['emperor','Sardaukar'],['fremen','Fedaykin'],['ixians','Cyborg']] as const)
    assert.match(renderToStaticMarkup(createElement(ForceCounterFace,{factionId:id,kind:'special'})),new RegExp(name));
  assert.match(renderToStaticMarkup(createElement(ForceCounterFace,{factionId:'beneGesserit',kind:'advisor'})),/Advisor counter/);
});

void test('visible counter details preserve concealed-value privacy and render invalid pools without invented counts', () => {
  const bodies=[];
  for(const value of [0,3,5] as const) {
    const state=createRicheseNoField(['hidden-zero','hidden-three','hidden-five']);
    const deployed=deployRicheseNoField(state,{tokenId:state.tokens.find(t=>t.value===value)!.id,controller:'r',location:{territory:'arrakeen',sector:10}});
    const player={...newPlayer('r','Richese','richese'),noField:projectRicheseNoField(deployed,false)};
    const html=renderToStaticMarkup(createElement(ForceInventoryDetails,{player}));
    assert.match(html,/20 physical force counters/);assert.match(html,/Concealed No-Field/);
    assert.match(html,/Arrakeen · sector 10/);assert.doesNotMatch(html,/hidden-zero|hidden-three|hidden-five/);
    bodies.push(html);
  }
  assert.equal(bodies[0],bodies[1]);assert.equal(bodies[1],bodies[2]);
  const invalid={...newPlayer('i','Ixians','ixians'),reserves:1};
  const html=renderToStaticMarkup(createElement(ForceInventoryDetails,{player:invalid}));
  assert.match(html,/<output/);assert.match(html,/could not be reconciled/);assert.doesNotMatch(html,/physical force counters/);
});
