import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { introductionStorm, introductionSpiceBlow, OPENING_DEFAULTS } from '../game/introduction-opening';
import { INTRODUCTION_STEPS, newIntroduction, restoreIntroduction } from '../game/introduction';
import { placeFixtureHand } from './fixture-hand';

function started() {
  let g = createGame('OPENLESS', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  g.players.forEach(p => { p.ready = true; });
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  for (let i = 0; i < g.players.length; i++) placeFixtureHand(g, i, []);
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of state.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}

void test('every storm lesson dial matches real sealing, reveal, traversal, shelter and custody', () => {
  for (const stormExample of ['first', 'later'] as const) for (let stormDial = stormExample === 'first' ? 0 : 1; stormDial <= (stormExample === 'first' ? 20 : 3); stormDial++) {
    const choice = { ...OPENING_DEFAULTS, stormExample, stormDial };
    const opening = introductionStorm(choice);
    assert.equal(opening.otherDial, null);
    assert.equal(introductionStorm({ ...choice, stormStage: 'sealed' }).distance, null);
    let g = started();
    g.turn = stormExample === 'first' ? 1 : 2;
    g.storm = opening.start; g.stormDialers = ['a', 'e']; g.ready = [];
    g.players[0].forces = { ...opening.initialForces }; g.players[0].reserves = opening.reserves;
    g.spice = { ...opening.initialSpice };
    g = applyAction(g, 'a', { type: 'stormDial', amount: stormDial });
    assert.equal(viewGame(g, 'e').stormRevealed, null);
    const revealed = introductionStorm({ ...choice, stormStage: 'revealed' });
    g = applyAction(g, 'e', { type: 'stormDial', amount: revealed.otherDial! });
    assert.equal(g.stormPending, revealed.distance);
    assert.equal(g.storm, revealed.sector);
    const expected = introductionStorm({ ...choice, stormStage: 'resolved' });
    g = ready(g);
    assert.equal(g.storm, expected.sector);
    assert.deepEqual(g.players[0].forces, expected.forces);
    assert.equal(g.players[0].tanks, expected.tanks);
    assert.deepEqual(g.spice, expected.spice);
    assert.equal(g.players[0].reserves + g.players[0].tanks + Object.values(g.players[0].forces).reduce((a,b)=>a+b,0),20);
  }
});

void test('spice examples match actual draw, accumulation, storm loss, first-turn skip and Nexus timing', () => {
  for (const blowExample of ['clear', 'storm', 'worm', 'first-worm'] as const) {
    const choice = { ...OPENING_DEFAULTS, blowExample };
    const opening = introductionSpiceBlow(choice);
    assert.deepEqual(opening.revealed, []);
    let g = started();
    g.turn = opening.turn; g.phase = 1; g.storm = opening.storm; g.ready = [];
    const originalWorms = g.spiceDeck.filter(c => 'worm' in c).length;
    g.spice = { ...opening.initialSpice };
    g.players[0].forces = {}; g.players[0].reserves = 20;
    g.players[1].forces = opening.forces ? { 'the_great_flat:15': opening.forces } : {};
    g.players[1].reserves = opening.reserves;
    const take = (kind: 'worm' | 'the_great_flat' | 'broken_land') => {
      const i = g.spiceDeck.findIndex(c => kind === 'worm' ? 'worm' in c : 'territory' in c && c.territory === kind);
      assert.ok(i >= 0); return g.spiceDeck.splice(i,1)[0];
    };
    if (opening.turn > 1) g.spiceDiscard[0].push(take('the_great_flat'));
    const cards = blowExample.includes('worm') ? [take('worm'),take('broken_land')] : [take('broken_land')];
    g.spiceDeck.unshift(...cards);
    g = ready(g);
    const expected = introductionSpiceBlow({ ...choice, blowStage: 'revealed' });
    assert.deepEqual(g.spice, expected.spice);
    assert.equal(g.players[1].forces['the_great_flat:15'] ?? 0,expected.forces);
    assert.equal(g.players[1].tanks,expected.tanks);
    assert.ok(g.spiceWindow,'Replacement blow remains open before Nexus');
    assert.equal(expected.nexus,false);
    g = ready(JSON.parse(JSON.stringify(g)) as Game);
    const settled = introductionSpiceBlow({ ...choice, blowStage: 'settled' });
    assert.equal(!!g.nexus,settled.nexus);
    assert.equal(g.spiceWindow,null);
    assert.equal(g.phase,settled.nexus?1:2);
    if (blowExample === 'first-worm') {
      assert.equal(g.spiceDeck.filter(c => 'worm' in c).length, originalWorms);
      assert.equal(g.spiceSequence, null);
    }
  }
});

void test('v5 progress retains all eleven lesson identities and results with fresh opening examples', () => {
  const titles=['Your place at the table','Choose an ally at the Nexus','Claim CHOAM Charity','Bid for a hidden card',
    'Revive forces and leaders','Ship within your budget','Move across the board','Seal a battle plan','Reveal a Traitor','Collect the spice','Join a table'];
  for (const [step,title] of titles.entries()) {
    const old = { ...newIntroduction(), version:5, step, charityClaimed:true, revivalActions:[{kind:'forces',amount:1}],
      allianceActions:['offer'], allianceClosed:true, allianceChecked:true, stormDial:'ignore', blowStage:'ignore', room:'exclude' };
    const restored=restoreIntroduction(JSON.stringify(old))!;
    assert.equal(restored.version,6); assert.equal(INTRODUCTION_STEPS[restored.step].title,title);
    assert.equal(restored.charityClaimed,true); assert.deepEqual(restored.revivalActions,[{kind:'forces',amount:1}]);
    assert.equal(restored.allianceChecked,true); assert.equal(restored.stormDial,2); assert.equal(restored.blowStage,'draft');
    assert.equal(Object.hasOwn(restored,'room'),false);
    assert.deepEqual(restoreIntroduction(JSON.stringify(restored)),restored);
  }
  assert.equal(restoreIntroduction(JSON.stringify({...newIntroduction(),version:5,step:11})),null);
});

void test('every opening practice stage survives JSON and malformed choices fail closed', () => {
  for (const stormStage of ['draft','sealed','revealed','resolved'] as const) for (const blowStage of ['draft','revealed','settled'] as const) {
    const s={...newIntroduction(),stormStage,blowStage,blowExample:'worm' as const};
    assert.deepEqual(restoreIntroduction(JSON.stringify(s)),s);
    const before=structuredClone(s); introductionStorm(s); introductionSpiceBlow(s); assert.deepEqual(s,before);
  }
  for (const patch of [{stormDial:0},{stormDial:4},{stormDial:1.5},{stormExample:'advanced'},{stormStage:'moved'},
    {stormExample:'first',stormDial:21},{blowExample:'sandtrout'},{blowStage:'nexus'}, {blowStage:true}])
    assert.equal(restoreIntroduction(JSON.stringify({...newIntroduction(),...patch})),null);
});
