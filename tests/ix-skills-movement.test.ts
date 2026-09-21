import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { GRAPH, TERRITORIES, gameDistance, location, mobileRouteDistance, splitLocation, MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import { botActions } from '../game/bots';
import { botMovementRange } from '../game/bot-mobility';
import { DIFFICULTIES } from '../game/bot-profiles';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { PlanetologistMovement, planetologistMoveDraft } from '../components/planetologist-movement';
import { SandmasterMovement, sandmasterMoveDraft } from '../components/sandmaster-movement';
import { sandmasterRouteDistance } from '../game/sandmaster-movement';
import { createTechTokens } from '../game/tech-tokens';
import {
  assertIxSkillsCustody as custody,
  completedIxSkillsGame,
  initializedIxSkillsOffers,
  ixSkillsPlayer as player,
  rejectIxSkillsAction as reject,
  reloadIxSkillsGame as reload,
} from './ix-skills-fixture';

const act = (g: Game, owner: string, action: Action) => applyAction(reload(g), owner, action);
const sand = TERRITORIES.filter(t => t.type === 'sand')
  .flatMap(t => t.sectors.filter(s => s !== 18).map(s => location(t.id, s)));
const blocked = (key: string) => splitLocation(key).sector === 18;
const distance = (g: Game, from: string, to: string) => gameDistance(g, from, to, blocked);

function stable(g: Game) {
  custody(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
}

/** Conserved movement scenario after the complete real Ix setup and Storm placement. */
function movement(skill: 'planetologist' | 'sandmaster' = 'planetologist', heldKarama = false): Game {
  const g = completedIxSkillsGame({requestedSkill: skill});
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
  }
  if (heldKarama) {
    const index = g.deck.findIndex(card => card.effect === 'karama');
    assert.ok(index >= 0);
    player(g, 'e').hand.push(...g.deck.splice(index, 1));
  }
  Object.assign(g, {
    phase: 5, phaseOpening: null, active: 'i', storm: 18, decision: null,
    response: null, ready: [], order: ['i', 'e', 't'], movementRemaining: ['i', 'e', 't'],
  });
  player(g, 'i').moved = 0;
  player(g, 'i').shipped = true;
  return g;
}

function deploy(g: Game, forces: Record<string, number>, cyborgs: Record<string, number>) {
  const ix = player(g, 'i');
  ix.forces = forces;
  ix.reserves = 20 - Object.values(forces).reduce((a, b) => a + b, 0);
  ix.elites!.forces = cyborgs;
  ix.elites!.reserves = 7 - Object.values(cyborgs).reduce((a, b) => a + b, 0);
  custody(g);
  return g;
}

function geometry(g: Game) {
  const from = sand.find(key => [1, 2, 3].every(d => sand.some(to => distance(g, key, to) === d)));
  assert.ok(from);
  const target = (d: number) => {
    const to = sand.find(key => distance(g, from, key) === d);
    assert.ok(to);
    return to;
  };
  return {from, target};
}

function move(from: string, to: string, elite = 1, mode: 'range' | 'gather' | undefined = 'range'): Action {
  const destination = splitLocation(to);
  return {type: 'move', from, amount: 3, elite, territory: destination.territory,
    sector: destination.sector, ...(mode ? {planetologist: mode} : {})};
}

function allow(g: Game): Game {
  for (let step = 0; g.response && step < 8; step++) {
    const owner = g.players.find(p => !g.response!.passed.includes(p.id));
    assert.ok(owner);
    g = act(g, owner.id, {type: 'passResponse'});
  }
  assert.equal(g.response, null);
  return g;
}

function cancel(g: Game): Game {
  const card = player(g, 'e').hand.find(c => c.effect === 'karama');
  assert.ok(card);
  return act(g, 'e', {type: 'card', card: card.id, mode: 'cancel'});
}

void test('all fourteen physical skills reach genuine Ix card selection, Traitors, Face Dancers and first Storm HMS placement', () => {
  for (const card of LEADER_SKILL_CARDS) {
    const g = completedIxSkillsGame({requestedSkill: card.id});
    assert.equal(g.leaderSkills!.assignments.find(a => a.owner === 'i')!.skill, card.id);
    assert.equal(g.ixSetupCards, null);
    assert.equal(g.mobileStronghold!.location, 'polar_sink:0');
    assert.equal(player(g, 'i').reserves, 14);
    assert.equal(player(g, 'i').elites!.reserves, 4);
    assert.equal(player(g, 't').faceDancers!.length, 3);
    assert.ok(g.players.every(p => p.hand.length === 1));
    stable(g);
  }
  const offers = initializedIxSkillsOffers();
  assert.equal(offers.setupStage, 'leaderSkills');
  assert.ok(offers.players.every(p => p.traitorChoices.length === 0));
  assert.equal(player(offers, 't').faceDancers, undefined);
});

void test('genuine ready Ix lobbies keep public starts, Advanced and additional module profiles closed', () => {
  const lobby = () => {
    let g = createGame('IXGATED', newPlayer('i', 'Ixians', 'ixians'), false, ['ix']);
    joinGame(g, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
    joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
    for (const p of g.players) g = act(g, p.id, {type: 'ready'});
    return g;
  };
  reject(lobby(), 'i', {type: 'start'});
  for (const change of [
    (g: Game) => { g.advanced = true; },
    (g: Game) => { g.discoveryEnabled = true; },
    (g: Game) => { g.techTokens = createTechTokens(); },
    (g: Game) => { g.expansions.push('choam'); },
    (g: Game) => { g.homeworlds = {custody: null}; },
  ]) {
    const g = lobby();
    change(g);
    const before = structuredClone(g);
    assert.throws(() => initializeLeaderSkillsGameForAudit(g));
    assert.deepEqual(g, before);
  }
});

void test('Planetologist gives selected suboids range two independently and cyborg range three through saved native permission', () => {
  const g = movement('planetologist', true);
  const {from, target} = geometry(g);
  deploy(g, {[from]: 4}, {[from]: 1});
  const suboids = act(g, 'i', move(from, target(2), 0));
  assert.equal(suboids.response, null);
  assert.equal(player(suboids, 'i').elites!.forces[from], 1);
  assert.equal(player(suboids, 'i').forces[target(2)], 3);
  stable(suboids);
  const pending = act(g, 'i', move(from, target(3)));
  assert.equal(pending.response?.kind, 'ixMovement');
  assert.equal(pending.pendingIxMove!.planetologist!.mode, 'range');
  assert.equal(player(pending, 'i').moved, 0);
  assert.deepEqual(player(pending, 'i').forces, player(g, 'i').forces);
  stable(pending);
  const settled = allow(pending);
  assert.equal(player(settled, 'i').forces[target(3)], 3);
  assert.equal(player(settled, 'i').elites!.forces[target(3)], 1);
  assert.equal(player(settled, 'i').moved, 1);
  stable(settled);
});

void test('cyborg cancellation keeps the army and unspent movement while the Planetologist range-two replacement stays legal', () => {
  const g = movement('planetologist', true);
  const {from, target} = geometry(g);
  deploy(g, {[from]: 4}, {[from]: 1});
  let next = cancel(act(g, 'i', move(from, target(3))));
  assert.equal(next.pendingIxMove, null);
  assert.equal(player(next, 'i').moved, 0);
  assert.deepEqual(player(next, 'i').forces, player(g, 'i').forces);
  assert.deepEqual(player(next, 'i').elites, player(g, 'i').elites);
  reject(next, 'i', move(from, target(3)), /blocked|more than 2/);
  const view = viewGame(reload(next), 'i');
  const ix = view.players.find(p => p.id === 'i')!;
  assert.equal(botMovementRange(view, ix, 1), 1);
  assert.equal(botMovementRange(view, ix, 1, 'range'), 2);
  next = act(next, 'i', move(from, target(2)));
  assert.equal(player(next, 'i').moved, 1);
  assert.equal(player(next, 'i').forces[target(2)], 3);
  assert.equal(next.response, null);
  stable(next);
});

function gatherGeometry(g: Game, secondDistance: number) {
  for (const to of sand) {
    const first = sand.find(from => distance(g, from, to) === 2);
    if (!first) continue;
    const second = sand.find(from => splitLocation(from).territory !== splitLocation(first).territory &&
      splitLocation(from).territory !== splitLocation(to).territory && distance(g, from, to) === secondDistance);
    if (second) return {first, second, to};
  }
  assert.fail('A pair of distinct sand origins must exist.');
}

function gather(first: string, second: string, to: string, secondElite = 0): Action {
  const target = splitLocation(to);
  return {type: 'move', planetologist: 'gather', forces: {[first]: 3, [second]: 2},
    eliteForces: {[first]: 1, [second]: secondElite}, territory: target.territory, sector: target.sector};
}

void test('gather rejects lending another origin cyborg speed, even when an unselected cyborg remains at the slow origin', () => {
  const g = movement('planetologist', true);
  const {first, second, to} = gatherGeometry(g, 2);
  deploy(g, {[first]: 3, [second]: 3}, {[first]: 1, [second]: 1});
  const action = gather(first, second, to);
  reject(g, 'i', action, /blocked|more than/);
  const target = splitLocation(to);
  const draft = planetologistMoveDraft(viewGame(g, 'i'), 'gather', target.territory, target.sector,
    {[first]: 3, [second]: 2}, {[first]: 1, [second]: 0});
  assert.equal(draft.action, null);
  assert.match(draft.blocked!, /Each selected source/);
  const pending = act(g, 'i', gather(first, second, to, 1));
  assert.equal(pending.response?.kind, 'ixMovement');
  assert.deepEqual(pending.pendingIxMove!.origins, [splitLocation(first).territory, splitLocation(second).territory]);
  const next = allow(pending);
  assert.equal(player(next, 'i').forces[to], 5);
  assert.equal(player(next, 'i').elites!.forces[to], 2);
  assert.equal(player(next, 'i').forces[second], 1);
  stable(next);
});

void test('gather combines a cyborg origin at distance two with a suboid origin at distance one, then cancels without partial transfer', () => {
  const g = movement('planetologist', true);
  const {first, second, to} = gatherGeometry(g, 1);
  deploy(g, {[first]: 3, [second]: 2}, {[first]: 1});
  const pending = act(g, 'i', gather(first, second, to));
  assert.equal(pending.response?.kind, 'ixMovement');
  const canceled = cancel(pending);
  assert.deepEqual(player(canceled, 'i').forces, player(g, 'i').forces);
  assert.deepEqual(player(canceled, 'i').elites, player(g, 'i').elites);
  assert.equal(player(canceled, 'i').moved, 0);
  reject(canceled, 'i', gather(first, second, to), /blocked|more than/);
  const settled = allow(pending);
  assert.equal(player(settled, 'i').forces[to], 5);
  assert.equal(player(settled, 'i').elites!.forces[to], 1);
  stable(canceled);
  stable(settled);
});

void test('selected cyborgs in another sector of the same origin carry that origin in the UI and engine', () => {
  const g = movement('planetologist', true);
  let selected: {keys: string[]; to: string} | undefined;
  for (const t of TERRITORIES.filter(t => t.type === 'sand')) {
    const keys = t.sectors.filter(s => s !== 18).slice(0, 2).map(s => location(t.id, s));
    if (keys.length !== 2) continue;
    const to = sand.find(to => keys.every(from => distance(g, from, to) <= 3) &&
      keys.some(from => distance(g, from, to) === 3));
    if (to) { selected = {keys, to}; break; }
  }
  assert.ok(selected);
  const {keys, to} = selected;
  deploy(g, {[keys[0]]: 2, [keys[1]]: 2}, {[keys[1]]: 1});
  const target = splitLocation(to);
  const view = viewGame(g, 'i');
  const draft = planetologistMoveDraft(view, 'range', target.territory, target.sector,
    {[keys[0]]: 2, [keys[1]]: 2}, {[keys[0]]: 0, [keys[1]]: 1});
  assert.equal(draft.blocked, null);
  assert.ok(draft.action);
  const pending = act(g, 'i', draft.action);
  assert.equal(pending.response?.kind, 'ixMovement');
  const next = allow(pending);
  assert.equal(player(next, 'i').forces[to], 4);
  assert.equal(player(next, 'i').elites!.forces[to], 1);
  const html = renderToStaticMarkup(createElement(PlanetologistMovement, {
    game: view, act: () => {}, busy: false, destination: target.territory, sector: target.sector,
  }));
  assert.match(html, /Each origin uses its own selected cyborgs/);
  stable(next);
});

void test('city ornithopters give the Ix group range three without exposing an unnecessary cyborg response', () => {
  const g = movement('planetologist', true);
  const {from, target} = geometry(g);
  deploy(g, {[from]: 4, 'arrakeen:10': 1}, {[from]: 1});
  const next = act(g, 'i', move(from, target(3), 0));
  assert.equal(next.response, null);
  assert.equal(player(next, 'i').elites!.forces[from], 1);
  assert.equal(player(next, 'i').forces[target(3)], 3);
  stable(next);
});

void test('Ix Sandmaster chosen detours use the cyborg response even when the shortest destination route is one territory', () => {
  const g = movement('sandmaster', true);
  let selected: string[] | undefined;
  for (const from of sand) {
    for (const through of GRAPH[from]) {
      if (!sand.includes(through) || splitLocation(through).territory === splitLocation(from).territory) continue;
      const to = GRAPH[through].find(to => sand.includes(to) && distance(g, from, to) === 1 &&
        mobileRouteDistance([from, through, to]) === 2);
      if (to) { selected = [from, through, to]; break; }
    }
    if (selected) break;
  }
  assert.ok(selected);
  const [from, through, to] = selected;
  deploy(g, {[from]: 4}, {[from]: 1});
  g.spice[through] = 3;
  const action: Action = {...move(from, to, 1, undefined), sandmaster: {routes: {[from]: selected}, collect: [through]}};
  // Explicitly omit Planetologist: this is the independently assigned Sandmaster card.
  delete action.planetologist;
  const pending = act(g, 'i', action);
  assert.equal(pending.response?.kind, 'ixMovement');
  assert.equal(pending.spice[through], 3);
  const canceled = cancel(pending);
  assert.equal(canceled.spice[through], 3);
  assert.equal(player(canceled, 'i').moved, 0);
  reject(canceled, 'i', action, /range|route|Sandmaster/);
  const next = allow(pending);
  assert.equal(next.spice[through], 2);
  assert.equal(player(next, 'i').spice, player(g, 'i').spice + 1);
  assert.equal(player(next, 'i').forces[to], 3);
  stable(canceled);
  stable(next);
});

void test('all bot levels produce legal Ix Planetologist routes from genuine custody without sharing cyborg speed across origins', () => {
  const g = movement();
  const {first, second, to} = gatherGeometry(g, 2);
  deploy(g, {[first]: 5, [second]: 5}, {[first]: 2});
  g.spice[to] = 12;
  let skills = 0;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(g), 'i');
    view.players.find(p => p.id === 'i')!.bot = difficulty;
    const before = structuredClone(view);
    const candidates = botActions(view).filter(a => a.type === 'move');
    assert.deepEqual(view, before);
    assert.ok(candidates.length > 0, difficulty);
    for (const action of candidates) {
      if (action.planetologist) skills++;
      const next = act(g, 'i', action);
      custody(next);
    }
  }
  assert.ok(skills > 0, 'At least one real skill movement must be exercised.');
});

void test('saved Ix allowance revalidates each origin and trainer while cancellation only needs its original declaration', () => {
  const g = movement('planetologist', true);
  const {first, second, to} = gatherGeometry(g, 2);
  deploy(g, {[first]: 3, [second]: 3}, {[first]: 1, [second]: 1});
  const pending = act(g, 'i', gather(first, second, to, 1));
  const changedSource = reload(pending);
  player(changedSource, 'i').elites!.forces[second] = 0;
  player(changedSource, 'i').elites!.reserves++;
  reject(changedSource, 'e', {type: 'passResponse'});
  const canceled = cancel(changedSource);
  assert.equal(canceled.pendingIxMove, null);
  assert.equal(player(canceled, 'i').moved, 0);
  assert.deepEqual(player(canceled, 'i').forces, player(changedSource, 'i').forces);
  assert.deepEqual(player(canceled, 'i').elites, player(changedSource, 'i').elites);
  stable(canceled);
  for (const mutate of [
    (saved: Game) => { player(saved, 'i').leaders[0].capturedBy = 't'; },
    (saved: Game) => { saved.pendingIxMove!.origins!.reverse(); },
  ]) {
    const saved = reload(pending);
    mutate(saved);
    const card = player(saved, 'e').hand.find(c => c.effect === 'karama')!;
    reject(saved, 'e', {type: 'passResponse'});
    reject(saved, 'e', {type: 'card', card: card.id, mode: 'cancel'});
  }
});

void test('Sandmaster ordinary HMS entry and exit use the current pointer in engine, controls and saved routes', () => {
  const pointer = 'wind_pass:14';
  const g = movement('sandmaster');
  g.mobileStronghold!.location = pointer; // Explicit conserved board position after genuine placement.
  g.spice[pointer] = 3;
  const exit: Action = {type: 'move', from: MOBILE_LOCATION, amount: 3, elite: 1,
    territory: 'wind_pass', sector: 14};
  const view = viewGame(g, 'i');
  const draft = sandmasterMoveDraft(view, exit);
  assert.equal(draft.blocked, null);
  assert.ok(draft.action);
  assert.deepEqual(draft.choice!.routes[MOBILE_LOCATION], [MOBILE_LOCATION, pointer]);
  assert.equal(sandmasterRouteDistance(g, draft.choice!.routes[MOBILE_LOCATION]), 1);
  const html = renderToStaticMarkup(createElement(SandmasterMovement, {
    game: view, move: exit, act: () => {}, busy: false,
  }));
  assert.match(html, /Hidden Mobile Stronghold/);
  const next = act(g, 'i', draft.action);
  assert.equal(next.mobileStronghold!.location, pointer);
  assert.equal(player(next, 'i').forces[MOBILE_LOCATION], 3);
  assert.equal(player(next, 'i').forces[pointer], 3);
  assert.equal(next.spice[pointer], 2);
  stable(next);

  const entering = movement('sandmaster');
  entering.mobileStronghold!.location = pointer;
  deploy(entering, {[pointer]: 4, [MOBILE_LOCATION]: 2}, {[pointer]: 1, [MOBILE_LOCATION]: 2});
  const enter: Action = {type: 'move', from: pointer, amount: 3, elite: 1,
    territory: MOBILE_STRONGHOLD, sector: 0};
  const entryDraft = sandmasterMoveDraft(viewGame(entering, 'i'), enter);
  assert.equal(entryDraft.blocked, null);
  assert.ok(entryDraft.action);
  assert.deepEqual(entryDraft.choice!.routes[pointer], [pointer, MOBILE_LOCATION]);
  const entered = act(entering, 'i', entryDraft.action);
  assert.equal(player(entered, 'i').forces[MOBILE_LOCATION], 5);
  assert.equal(player(entered, 'i').elites!.forces[MOBILE_LOCATION], 3);
  assert.equal(entered.mobileStronghold!.location, pointer);
  stable(entered);

  const storm = reload(g);
  storm.storm = 14;
  assert.equal(sandmasterMoveDraft(viewGame(storm, 'i'), exit).action, null);
  reject(storm, 'i', draft.action);
  const shifted = reload(g);
  shifted.mobileStronghold!.location = 'false_wall_west:16';
  reject(shifted, 'i', draft.action, /Sandmaster|route|range/);
});

void test('Sandmaster HMS endpoint extension saves a cyborg response and rejects a changed pointer before settlement', () => {
  const g = movement('sandmaster', true);
  const pointer = 'wind_pass:14';
  g.mobileStronghold!.location = pointer;
  const target = sand.find(key => distance(g, pointer, key) === 1 && distance(g, MOBILE_LOCATION, key) === 2);
  assert.ok(target);
  const at = splitLocation(target);
  const action: Action = {type: 'move', from: MOBILE_LOCATION, amount: 3, elite: 1,
    territory: at.territory, sector: at.sector};
  const draft = sandmasterMoveDraft(viewGame(g, 'i'), action);
  assert.ok(draft.action);
  const pending = act(g, 'i', draft.action);
  assert.equal(pending.response?.kind, 'ixMovement');
  stable(pending);
  const changed = reload(pending);
  changed.mobileStronghold!.location = 'false_wall_west:16';
  reject(changed, 'e', {type: 'passResponse'}, /Sandmaster|route/);
  const canceled = cancel(pending);
  assert.equal(player(canceled, 'i').forces[MOBILE_LOCATION], 6);
  assert.equal(player(canceled, 'i').moved, 0);
  const allowed = allow(pending);
  assert.equal(player(allowed, 'i').forces[target], 3);
  assert.equal(player(allowed, 'i').forces[MOBILE_LOCATION], 3);
  assert.equal(allowed.mobileStronghold!.location, pointer);
  stable(allowed);
  stable(canceled);
});
