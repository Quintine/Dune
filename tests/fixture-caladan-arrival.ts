import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldGameForAudit, joinGame,
  newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { location, territory as boardTerritory } from '../game/board';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { placeTerror, type TerrorKind } from '../game/moritani-terror';
import {
  caladanVictoryFixture, holdVictoryCard, positionVictoryArmy,
  victoryPlayer, victoryReload,
} from './fixture-caladan-victory';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export const caladanArrivalPlayer = victoryPlayer;
export const caladanArrivalReload = victoryReload;
export type CaladanArrivalStep = { actor: string; action: Action };

/** Controlled, conserved battle source. The inherited Homeworld preview
 * initializer is not a public start journey. Wallets, later turn/phase and
 * positions, selected held original cards, and the placed original Terror token are
 * scenario inputs. Only the recorded battle and arrival actions are native
 * chronology; no victory, entry, reaction or reinforcement receipt is installed. */
export const caladanArrivalDisclosure =
  'Controlled Homeworld preview setup and later battle positions/purses/cards/token placement; recorded native battle and arrival actions, not public acquisition history.';

export function actCaladanArrival(
  game: Game, actor: string, action: Action, actions: CaladanArrivalStep[] = [],
): Game {
  const result = normalizeAutomaticGame(applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) });
  return result;
}

/** Resolve only actual neutral native controls, preserving the decisions under
 * test. It never seals a plan, chooses an entry reaction or advances a new phase. */
export function advanceCaladanArrival(
  game: Game, actions: CaladanArrivalStep[] = [],
): Game {
  let g = game;
  for (let n = 0; n < 100; n++) {
    if (g.decision && ['caladanReinforcement', 'intrusion', 'moritaniTerror',
      'ambassador', 'arrivalOverlap'].includes(g.decision.kind)) return g;
    if (!g.battle && !g.response && !g.pendingTreacheryDiscard) return g;
    const next = nextStrongholdFactionsNativeStep(g);
    if (!next) return g;
    g = actCaladanArrival(g, next.actor, next.action, actions);
  }
  assert.fail('The bounded native Caladan continuation did not stop.');
}

export function allowCaladanArrivalResponses(
  game: Game, actions: CaladanArrivalStep[] = [],
): Game {
  let g = game;
  for (let n = 0; g.response && n < 40; n++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = actCaladanArrival(g, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(g.response, null);
  return advanceCaladanArrival(g, actions);
}

export function caladanArrivalInventory(g: Game) {
  homeworldGameIntegrity(g);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)];
  assert.equal(cards.length, g.expansions.includes('ix') ? 47 : 33);
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  for (const p of g.players) {
    const visitors = Object.values(g.homeworlds!.custody!.visitors).reduce(
      (sum, world) => sum + (world[p.id]?.normal ?? 0) + (world[p.id]?.elite ?? 0), 0);
    const stars = p.elites ? p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((sum, count) => sum + count, 0) : 0;
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, count) => sum + count, 0) + visitors, 20);
    assert.ok(stars >= 0 && p.spice >= 0);
  }
  return { cards: cards.length, leaders: g.players.flatMap(p => p.leaders).length };
}

function hmsBattleSource(): Game {
  let g = createGame('CALADANHMSARRIVAL', newPlayer('a', 'Atreides', 'atreides'), true, ['ix']);
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('i', 'Ixians', 'ixians'));
  g = applyAction(g, 'a', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; (g.status === 'setup' || !g.mobileStronghold?.location) && n < 140; n++) {
    const next = nextStrongholdFactionsNativeStep(g);
    if (next) g = applyAction(g, next.actor, next.action);
    else {
      const choice = g.players.map(p => ({actor:p.id, action:botActions(viewGame(g,p.id))[0]})).find(c => c.action);
      assert.ok(choice);
      g = applyAction(g, choice.actor, choice.action);
    }
  }
  assert.equal(g.status, 'playing');
  assert.ok(g.mobileStronghold?.location, 'The original Ix setup must place its actual HMS.');
  // Conserved later scenario positions, not a claimed native movement journey.
  const ix = victoryPlayer(g, 'i');
  ix.reserves += Object.values(ix.forces).reduce((sum, count) => sum + count, 0);
  ix.forces = {};
  ix.elites!.reserves += Object.values(ix.elites!.forces).reduce((sum, count) => sum + count, 0);
  ix.elites!.forces = {};
  for (const p of g.players) { g.deck.push(...p.hand.splice(0)); p.spice = 20; }
  Object.assign(g, { phase:6, turn:2, storm:18, phaseOpening:null, response:null,
    decision:null, active:'a', ready:[], order:g.players.map(p => p.id) });
  positionVictoryArmy(g, 'a', 6, 3);
  positionVictoryArmy(g, 'g', 17, 3);
  for (const id of ['a', 'g']) {
    const p = victoryPlayer(g, id);
    delete p.forces['hagga_basin:12'];
    p.forces['hidden_mobile_stronghold:0'] = 3;
  }
  caladanArrivalInventory(g);
  return g;
}

export function createCaladanArrivalFixture(options: {
  bg?: boolean; terror?: TerrorKind; hms?: boolean; ambassador?: 'first' | 'second';
} = {}) {
  assert.ok(!options.hms || (!options.bg && !options.terror));
  let g = options.hms ? hmsBattleSource() : caladanVictoryFixture({
    advanced:true,
    extraSeats: options.bg ? [{id:'bg',faction:'beneGesserit'}] :
      options.terror ? [{id:'m',faction:'moritani'}, ...(options.ambassador ? [{id:'ec',faction:'ecaz'} as const] : [])] : [],
  });
  const territory = options.hms ? 'hidden_mobile_stronghold' : options.terror ? 'arrakeen' : 'hagga_basin';
  const destination = `${territory}:${options.hms ? 0 : options.terror ? 10 : 12}`;
  let token: string | undefined;
  let heldCard: string | undefined;
  if (options.bg) {
    const bg = victoryPlayer(g, 'bg');
    Object.assign(bg, {reserves:19,forces:{'hagga_basin:12':1},advisors:{}});
    holdVictoryCard(g,'g','karama'); // Keep an actual preventable flip response open.
  }
  if (options.terror) {
    // Ecaz/Moritani native roster preview; no extra Treachery module is added.
    g.expansions.push('ecaz');
    for (const id of ['a','g']) {
      const p = victoryPlayer(g,id);
      delete p.forces['hagga_basin:12'];
      p.forces['arrakeen:10'] = 3;
    }
    const original = g.moritaniTerror!.tokens.find(t => t.kind === options.terror)!;
    token = original.id;
    g.moritaniTerror = placeTerror(g.moritaniTerror!, token, territory, 1);
    if (options.terror === 'sabotage') {
      heldCard = holdVictoryCard(g,'a','shield');
      holdVictoryCard(g,'m','karama'); // An actual held card supplies the optional gift.
    }
  }
  if (options.ambassador) {
    assert.ok(options.terror);
    // Controlled original-token supply and storm order; neither reaction has
    // been accepted and no later arrival/continuation receipt is installed.
    g.ecazAmbassadors = createAmbassadors(() => 0);
    const ambassador = g.ecazAmbassadors.tokens.find(token => token.zone === 'supply')!;
    g.ecazAmbassadors = placeAmbassador(g.ecazAmbassadors, ambassador.id, {turn:1,availableSpice:20,
      destination:{id:territory,stronghold:true,inStorm:false,allowed:true}}).state;
    g.order = options.ambassador === 'first' ? ['a','g','ec','m'] : ['a','g','m','ec'];
  }
  // A separately staged one-counter contest retains Battle phase after this
  // victory, so unrelated automatic Collection income is not part of entry proof.
  const other = location('shield_wall', boardTerritory('shield_wall').sectors[0]);
  const atreides = victoryPlayer(g,'a'), guildArmy = victoryPlayer(g,'g');
  assert.ok(atreides.forces['polar_sink:0'] > 0 && guildArmy.reserves > 0);
  atreides.forces['polar_sink:0']--; atreides.forces[other] = 1;
  guildArmy.reserves--; guildArmy.forces[other] = 1;
  caladanArrivalInventory(g);
  const source = victoryReload(g), actions: CaladanArrivalStep[] = [];
  g = actCaladanArrival(g,'a',{type:'chooseBattle',territory,target:'g'},actions);
  g = advanceCaladanArrival(g,actions);
  assert.ok(g.battle && !g.battle.preparation && !g.decision && !g.response);
  const a = victoryPlayer(g,'a').leaders.reduce((best,l) => l.strength > best.strength ? l : best);
  const guild = victoryPlayer(g,'g').leaders.reduce((best,l) => l.strength < best.strength ? l : best);
  g = actCaladanArrival(g,'a',{type:'battlePlan',leader:a.id,dial:1,support:1},actions);
  g = actCaladanArrival(g,'g',{type:'battlePlan',leader:guild.id,dial:0,support:0},actions);
  g = advanceCaladanArrival(g,actions);
  assert.equal(g.decision?.kind,'caladanReinforcement');
  assert.equal(g.lastBattleContext?.winner,'a');
  assert.equal(victoryPlayer(g,'a').forces[destination],2);
  const event = g.homeworldVictoryReinforcement!.event;
  const offer = viewGame(g,'a').caladanReinforcement!;
  caladanArrivalInventory(g);
  return {game:g,source,actions,sourceActions:actions,sourceCount:actions.length,
    disclosure:caladanArrivalDisclosure,territory,destination,event,token,heldCard,offer,
    action:{type:'decision',event,destination,amount:1} as Action,
    decline:{type:'decision',event,decline:true} as Action};
}
