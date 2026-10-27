import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { actFamilyAtomics } from './fixture-family-atomics';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type SalusaGholaStep = StrongholdFactionsNativeStep;
export const actSalusaGhola = actFamilyAtomics;
export const salusaGholaPlayer = (game: Game, actor = 'emperor') => {
  const p = game.players.find(p => p.id === actor); assert.ok(p); return p;
};
export const salusaGholaClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingShipment;
export function salusaGholaArmy(game: Game) {
  const home = homeworldForceGroups(homeworldContext(game),game.homeworlds!.custody!)
    .find(home => home.id === 'homeworld:emperor:salusa'); assert.ok(home);
  return structuredClone(home.forces.emperor);
}
export function salusaGholaInventory(game: Game) {
  homeworldGameIntegrity(game);
  const cards = [...game.deck,...game.discard,...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index+Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(c => c.id).sort();
  assert.deepEqual(cards,treacheryDeck([]).map(c => c.id).sort());
  const traits = [...(game.traitorReserve ?? []),...game.players.flatMap(p => [...p.traitors,...p.traitorChoices])].sort();
  const spice = [...game.spiceDeck,...game.spiceDiscard.flat()].map(c => JSON.stringify(c)).sort();
  return {cards,traitors:traits,spice};
}

/** Native controls only, including current ordered Charity/Revival. A live
 * unsealed plan and Ghola declaration remain caller choices. */
export function nextSalusaGhola(game: Game): SalusaGholaStep|null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'guildTiming')
      return {actor:game.decision.player,action:{type:'decision',take:false}};
    if (game.decision?.kind === 'caladanReinforcement')
      return {actor:game.decision.player,action:{type:'decision',event:game.decision.event,decline:true}};
    if (game.decision?.kind === 'battleLosses' && game.decision.player === 'emperor') {
      const choice = game.decision.options.findIndex(loss => loss.normal === 0 && loss.elite === 1);
      assert.ok(choice >= 0,'The actual dial must offer exactly one Sardaukar casualty.');
      return {actor:'emperor',action:{type:'decision',choice}};
    }
    if (game.battle?.outcomeWindow && !game.battle.outcomeWindow.closed) {
      const actor = [game.battle.attacker,game.battle.defender]
        .find(id => !game.battle!.outcomeWindow!.ready.includes(id)); assert.ok(actor);
      return {actor,action:{type:'battleOutcomeReady',event:game.battle.outcomeWindow.event}};
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceSalusaGhola(game: Game, until: (game: Game) => boolean,
  actions: SalusaGholaStep[] = []): Game {
  for (let n = 0; n < 1300; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status,'finished');
    const next = nextSalusaGhola(game);
    assert.ok(next,`Choose the current native Ghola/plan action at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSalusaGhola(game,next.actor,next.action,actions);
  }
  assert.fail('The genuine Salusa/Ghola source did not reach its finite boundary.');
}
const planReady = (game: Game) => salusaGholaClean(game) && !!game.battle &&
  !game.battle.revealed && !game.battle.preparation &&
  (!game.battle.preLeader || game.battle.preLeader.closed);
function livingLeader(game: Game, actor: string, strongest: boolean) {
  const leaders = salusaGholaPlayer(game,actor).leaders.filter(l => !l.dead && !l.usedAt && !l.capturedBy);
  leaders.sort((a,b) => strongest ? b.strength-a.strength : a.strength-b.strength);
  assert.ok(leaders[0]); return leaders[0].id;
}

/** Earned public one-turn source. Initial hands/Spice order are selected only
 * while unopened; native setup, payments, typed shipments, split movement and
 * the earlier combat casualty create every later resource and battle field. */
export function createSalusaGholaFixture() {
  const actor = 'emperor', atreides = 'atreides', guild = 'guild';
  let game = createGame('SALUSAGHOLA',newPlayer(actor,'Emperor','emperor'),true);
  joinGame(game,newPlayer(atreides,'Atreides','atreides'));
  joinGame(game,newPlayer(guild,'Guild','guild'));
  const initial = structuredClone(game), actions: SalusaGholaStep[] = [];
  const act = (owner: string, action: Action) => {game = actSalusaGhola(game,owner,action,actions);};
  const reach = (until: (game: Game) => boolean) => {game = advanceSalusaGhola(game,until,actions);};
  act(actor,{type:'homeworlds',enabled:true});
  for (const p of game.players) act(p.id,{type:'ready'});
  const lobby = structuredClone(game);
  act(actor,{type:'start',advancedPreview:true});
  const setup = structuredClone(game);
  assert.equal(game.status,'setup'); assert.ok(game.players.every(p => p.hand.length === 0));
  const ghola = game.deck.find(c => c.effect === 'ghola');
  const shield = game.deck.find(c => c.kind === 'shield'), projectile = game.deck.find(c => c.kind === 'projectile');
  assert.ok(ghola && shield && projectile);
  const selected = [ghola,shield,projectile], dealOrder = selected.map((card,position) => {
    const from = game.deck.findIndex(c => c.id === card.id); assert.ok(from >= position);
    [game.deck[position],game.deck[from]] = [game.deck[from],game.deck[position]];
    return {position,from,card:card.id};
  });
  const beforeDeal = structuredClone(game);
  reach(g => g.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(c => c.id)),selected.map(c => c.id));
  assert.deepEqual(salusaGholaArmy(game),{normal:0,elite:5});
  const original = salusaGholaInventory(game);
  const spiceOrder = [0,1].map(position => {
    const from = game.spiceDeck.findIndex((card,index) => index >= position &&
      'territory' in card && !card.discovery && card.territory !== 'imperial_basin');
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from,1);
    game.spiceDeck.splice(position,0,card); return {position,from,card:structuredClone(card)};
  });
  reach(g => g.phase === 5 && salusaGholaClean(g));
  const shipments: {before:Game;after:Game;steps:SalusaGholaStep[]}[] = [];
  let movement: {before:Game;after:Game;steps:SalusaGholaStep[]}|undefined;
  for (let n = 0; game.phase === 5 && n < 200; n++) {
    if (!salusaGholaClean(game)) {
      const next = nextSalusaGhola(game); assert.ok(next); act(next.actor,next.action); continue;
    }
    const owner = game.active!;
    if (owner === actor || owner === guild) {
      const before = structuredClone(game), start = actions.length;
      const amount = owner === actor ? 4 : 1, elite = owner === actor ? 4 : 0;
      const homeworldSources = nativeShipmentSources(viewGame(game,owner),amount,elite); assert.ok(homeworldSources);
      act(owner,{type:'ship',territory:'imperial_basin',sector:9,amount,elite,allyPayment:0,homeworldSources});
      reach(salusaGholaClean);
      shipments.push({before,after:structuredClone(game),steps:structuredClone(actions.slice(start))});
      if (owner === actor) {
        const beforeMove = structuredClone(game), at = actions.length;
        act(owner,{type:'move',from:'imperial_basin:9',territory:'arrakeen',sector:10,amount:2,elite:2});
        reach(salusaGholaClean);
        movement = {before:beforeMove,after:structuredClone(game),steps:structuredClone(actions.slice(at))};
      }
    }
    act(owner,{type:'endMovement'});
  }
  assert.ok(movement); assert.equal(game.phase,6);
  reach(g => salusaGholaClean(g) && !g.battle && !!g.active);
  const beforeFirstBattle = structuredClone(game), firstTerritory = game.active === guild ? 'imperial_basin' : 'arrakeen';
  const firstOpponent = firstTerritory === 'arrakeen' ? atreides : guild;
  const firstChooser = game.active!;
  assert.ok(viewGame(game,firstChooser).battleChoices.some(c => c.territory === firstTerritory));
  const firstAt = actions.length;
  act(firstChooser,{type:'chooseBattle',territory:firstTerritory,target:firstChooser === actor ? firstOpponent : actor});
  const firstPreparation = structuredClone(game);
  reach(planReady);
  const firstPlans = {[actor]:{leader:livingLeader(game,actor,true),dial:2,support:1},
    [firstOpponent]:{leader:livingLeader(game,firstOpponent,false),dial:0,support:0}};
  const firstBeforePlans = structuredClone(game);
  for (const owner of [game.battle!.attacker,game.battle!.defender])
    act(owner,{type:'battlePlan',...firstPlans[owner]});
  reach(g => !g.battle && salusaGholaClean(g));
  const firstResolution = structuredClone(game), firstActions = structuredClone(actions.slice(firstAt));
  assert.equal(game.lastBattleContext?.winner,actor);
  assert.equal(salusaGholaPlayer(game).elites!.tanks,1);
  assert.deepEqual(salusaGholaArmy(game),{normal:0,elite:1});
  const secondTerritory = firstTerritory === 'arrakeen' ? 'imperial_basin' : 'arrakeen';
  const opponent = firstOpponent === atreides ? guild : atreides;
  reach(g => !g.battle && salusaGholaClean(g) && !!g.active);
  const beforeSecondBattle = structuredClone(game), chooser = game.active!;
  assert.ok(viewGame(game,chooser).battleChoices.some(c => c.territory === secondTerritory));
  act(chooser,{type:'chooseBattle',territory:secondTerritory,target:chooser === actor ? opponent : actor});
  const preparation = structuredClone(game);
  reach(planReady);
  assert.deepEqual(game.battle!.plans,{});
  assert.ok(salusaGholaPlayer(game).hand.some(c => c.id === ghola.id));
  assert.equal(salusaGholaPlayer(game).elites!.tanks,1);
  assert.equal(viewGame(game,actor).battle!.ownForces!.elite,2);
  assert.deepEqual(salusaGholaInventory(game),original);
  return {game,source:structuredClone(game),actor,card:ghola.id,
    action:{type:'card',card:ghola.id,amount:1,elite:1} as Action,opponent,
    territory:secondTerritory,firstTerritory,firstOpponent,firstPlans,
    initial,lobby,setup,beforeDeal,afterSetup,dealOrder,spiceOrder,original,setupActions,
    shipments,movement,beforeFirstBattle,firstPreparation,firstBeforePlans,firstResolution,firstActions,
    beforeSecondBattle,preparation,actions,sourceActions:actions,sourceCount:actions.length,
    disclosure:'Original public Advanced E/A/G with Homeworlds enabled before Ready/start, base33 and no optional modules. Only unopened starting cards, two land Spice positions and scalar lotteries selected. Real typed E4stars desert shipment costs8 and leaves Salusa1; real two-star movement creates Arrakeen contest, and real Guild1 shipment creates Basin contest. The first actual E win uses paid support1/dial2 and kills one real Sardaukar. Stop at the other actual live unsealed battle with Ghola held, Salusa1, tanks1star and two fighting stars. No later phase, force, purse, Tank, hand, battle commitment or receipt is installed.'};
}
export type SalusaGholaFixture = ReturnType<typeof createSalusaGholaFixture>;

export function playSalusaGholaBattle(f: SalusaGholaFixture, source = f.game) {
  let game = structuredClone(source); const actions: SalusaGholaStep[] = [];
  const before = structuredClone(game);
  game = actSalusaGhola(game,f.actor,f.action,actions);
  game = advanceSalusaGhola(game,planReady,actions);
  const returned = structuredClone(game), leader = livingLeader(game,f.actor,true);
  const enemy = livingLeader(game,f.opponent,false);
  game = actSalusaGhola(game,f.actor,{type:'battlePlan',leader,dial:2,support:0},actions);
  const afterPlan = structuredClone(game);
  game = actSalusaGhola(game,f.opponent,{type:'battlePlan',leader:enemy,dial:0,support:0},actions);
  game = advanceSalusaGhola(game,g => !g.battle && salusaGholaClean(g),actions);
  return {game,before,returned,afterPlan,actions};
}
