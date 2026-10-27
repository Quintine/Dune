import assert from 'node:assert/strict';
import { applyAction, captureCandidates, viewGame, type Action, type Game } from '../game/engine';
import { DUKE_VIDAL_ID, dukeController } from '../game/duke-vidal';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { quoteHomeworldCustody } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  createHomeworldEcazDukeFixture, actHomeworldEcazDuke,
  homeworldEcazDukeClean, homeworldEcazDukePlayer, homeworldEcazDukeInventory,
  nextHomeworldEcazDukeStep, type HomeworldEcazDukeStep,
} from './fixture-homeworld-ecaz-duke';

export const ecazDukeCaptivePlayer = homeworldEcazDukePlayer;
export const ecazDukeCaptiveInventory = homeworldEcazDukeInventory;
export const ecazDukeCaptiveClean = homeworldEcazDukeClean;
export type EcazDukeCaptiveStep = HomeworldEcazDukeStep;

/** Only selects the original random permutation over the engine's actual
 * capture pool. Native UUID/non-scalar entropy is untouched. */
function selectDukeCapture<T>(game: Game, run: () => T): T {
  const capture = game.pendingCapture; assert.ok(capture);
  const pool = captureCandidates(game,capture.loser,capture.territory,capture.duke);
  const duke = pool.find(l => l.id === DUKE_VIDAL_ID); assert.ok(duke);
  const desired = [duke,...pool.filter(l => l.id !== DUKE_VIDAL_ID)];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length-1; i > 0; i--) {
    const j = current.findIndex(l => l.id === desired[i].id);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j+0.5)*0x100000000/(i+1)));
    [current[i],current[j]] = [current[j],current[i]];
  }
  assert.deepEqual(current.map(l => l.id),desired.map(l => l.id));
  const descriptor = Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView|null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && index < rolls.length)
      array[0] = rolls[index++];
    else Reflect.apply(native,crypto,[array]);
    return array;
  };
  try { const result=run(); assert.ok(index===0 || index===rolls.length); return result; }
  finally {
    if (descriptor) Object.defineProperty(crypto,'getRandomValues',descriptor);
    else Reflect.deleteProperty(crypto,'getRandomValues');
  }
}

export function actEcazDukeCaptive(game: Game, actor: string, action: Action,
  actions: EcazDukeCaptiveStep[] = []): Game {
  if (game.pendingCapture && (game.response?.kind === 'capture' ||
    game.decision?.kind === 'captureOffer' && action.type === 'decision' && action.accept === true)) {
    const result = selectDukeCapture(game,() => applyAction(game,actor,action));
    actions.push({actor,action:structuredClone(action)}); return result;
  }
  return actHomeworldEcazDuke(game,actor,action,actions);
}

export function advanceEcazDukeCaptive(game: Game, until: (game: Game) => boolean,
  actions: EcazDukeCaptiveStep[] = []): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status,'finished');
    const next = game.decision?.kind === 'captureOffer'
      ? {actor:game.decision.player,action:{type:'decision',accept:false} as Action}
      : nextHomeworldEcazDukeStep(game);
    assert.ok(next,`Choose the current native Duke/battle action at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actEcazDukeCaptive(game,next.actor,next.action,actions);
  }
  assert.fail('The bounded occupied-Duke captive chronology did not reach its boundary.');
}

function planReady(game: Game) {
  return homeworldEcazDukeClean(game) && !!game.battle && !game.battle.revealed &&
    !game.battle.preparation && (!game.battle.preLeader || game.battle.preLeader.closed);
}
function nativeLeader(game: Game, actor: string, strongest: boolean) {
  const leaders = homeworldEcazDukePlayer(game,actor).leaders.filter(l =>
    !l.dead && !l.capturedBy && !l.gholaBy && !l.usedAt);
  leaders.sort((a,b) => strongest ? b.strength-a.strength : a.strength-b.strength);
  assert.ok(leaders[0]); return leaders[0].id;
}

/** Entire public original E/G/A/Ecaz/H source: real paid Tabr garrison and
 * Harkonnen entry, actual Ecaz World victory/qualification/automatic lease,
 * actual Harkonnen victory over E WITHOUT using Duke, then original native
 * unused-leader capture lottery and Keep. No played custody is installed. */
export function createHomeworldEcazDukeCaptiveFixture() {
  const source = createHomeworldEcazDukeFixture({advanced:true,harkonnen:true});
  let game = structuredClone(source.game);
  const actions: EcazDukeCaptiveStep[] = [...source.sourceActions], start = actions.length;
  const owner = source.occupier, captor = source.opponent;
  assert.equal(captor,'harkonnen'); assert.equal(game.battle?.territory,'sietch_tabr');
  assert.equal(game.dukeVidal?.source,'homeworldEcaz');
  assert.equal(game.dukeVidal?.controller,owner); assert.equal(game.dukeVidal?.leader.usedAt,undefined);
  const beforeBattle = structuredClone(game);
  const plans = {
    [owner]:{leader:nativeLeader(game,owner,false),dial:0,support:0},
    [captor]:{leader:nativeLeader(game,captor,true),dial:0,support:0},
  };
  for (const actor of [game.battle!.attacker,game.battle!.defender])
    game = actEcazDukeCaptive(game,actor,{type:'battlePlan',...plans[actor]},actions);
  game = advanceEcazDukeCaptive(game,g => g.decision?.kind === 'captureOffer',actions);
  assert.equal(game.lastBattleContext?.winner,captor);
  const captureOffer = structuredClone(game), pending = game.pendingCapture!;
  const candidates = captureCandidates(game,pending.loser,pending.territory,pending.duke).map(l => l.id);
  assert.ok(candidates.includes(DUKE_VIDAL_ID));
  game = actEcazDukeCaptive(game,captor,{type:'decision',accept:true},actions);
  game = advanceEcazDukeCaptive(game,g => g.decision?.kind === 'capturedLeader',actions);
  assert.equal(game.decision?.kind === 'capturedLeader' && game.decision.leader,DUKE_VIDAL_ID);
  const selected = structuredClone(game);
  game = actEcazDukeCaptive(game,captor,{type:'decision',mode:'keep'},actions);
  game = advanceEcazDukeCaptive(game,g => !g.battle && homeworldEcazDukeClean(g),actions);
  assert.equal(game.dukeVidal?.leader.capturedBy,captor);
  assert.equal(dukeController(game.dukeVidal!),captor);
  assert.equal(game.dukeVidal?.controller,owner);
  assert.equal(game.dukeVidal?.leader.usedAt,undefined);
  assert.deepEqual(homeworldEcazDukeInventory(game),source.originalInventory);
  homeworldGameIntegrity(game);
  return {game,source,beforeBattle,captureOffer,selected,candidates,plans,owner,captor,
    dukeId:DUKE_VIDAL_ID,world:source.world,territory:source.secondTerritory,sector:source.secondSector,
    actions,sourceActions:actions,sourceCount:actions.length,captureActions:actions.slice(start),
    disclosure:'Original public Advanced Ecaz/E/G/A/H with Homeworlds only; selected unopened original six-card/Spice orders and native scalar lotteries. Real paid shipments, World occupation/grant, second battle, emitted unused-Duke capture lottery and Keep; no installed occupation, lease or capture receipt.'};
}
export type HomeworldEcazDukeCaptiveFixture = ReturnType<typeof createHomeworldEcazDukeCaptiveFixture>;

export function expireEcazDukeCaptive(f: HomeworldEcazDukeCaptiveFixture, source = f.game) {
  const actions: EcazDukeCaptiveStep[] = [], before = structuredClone(source);
  const game = advanceEcazDukeCaptive(structuredClone(source),g => g.turn > before.turn &&
    g.phase === 0 && homeworldEcazDukeClean(g),actions);
  assert.equal(game.dukeVidal?.leader.capturedBy,f.captor);
  return {game,before,actions};
}

/** Actual later paid E entry into surviving Harkonnen Tabr1, actual native
 * captive-Duke plan, reveal/calls and battle release. No army is restaged. */
export function useExpiredEcazDukeCaptive(f: HomeworldEcazDukeCaptiveFixture, source: Game) {
  let game = structuredClone(source); const actions: EcazDukeCaptiveStep[] = [];
  game = advanceEcazDukeCaptive(game,g => g.phase === 5 && g.active === f.owner &&
    homeworldEcazDukeClean(g),actions);
  const homeworldSources = nativeShipmentSources(viewGame(game,f.owner),1,0); assert.ok(homeworldSources);
  const beforeShip = structuredClone(game);
  game = actEcazDukeCaptive(game,f.owner,{type:'ship',territory:f.territory,sector:f.sector,
    amount:1,elite:0,allyPayment:0,homeworldSources},actions);
  game = advanceEcazDukeCaptive(game,g => g.phase === 6 && !!g.active &&
    !g.battle && homeworldEcazDukeClean(g),actions);
  const actor = game.active!;
  assert.ok(viewGame(game,actor).battleChoices.some(choice => choice.territory === f.territory));
  game = actEcazDukeCaptive(game,actor,{type:'chooseBattle',territory:f.territory,
    target:actor === f.owner ? f.captor : f.owner},actions);
  game = advanceEcazDukeCaptive(game,planReady,actions);
  const beforeBattle = structuredClone(game), enemy = nativeLeader(game,f.owner,false);
  for (const id of [game.battle!.attacker,game.battle!.defender])
    game = actEcazDukeCaptive(game,id,{type:'battlePlan',leader:id === f.captor ? DUKE_VIDAL_ID : enemy,
      dial:0,support:0},actions);
  game = advanceEcazDukeCaptive(game,g => !g.battle && homeworldEcazDukeClean(g),actions);
  assert.equal(game.dukeVidal?.leader.capturedBy,undefined);
  homeworldGameIntegrity(game);
  return {game,beforeShip,beforeBattle,actions};
}

/** LABELLED CONTROLLED HELPER SUPPLEMENT: move the three actually earned E
 * visitors back into their actual native World, conserving pools. This does
 * not claim a played departure or synthesize an occupation observation. It is
 * used only to ask the release helper about an already-lost current entitlement. */
export function controlledEcazDukeCaptiveDeparture(source: Game) {
  const game = structuredClone(source), owner = 'emperor', world = 'homeworld:ecaz';
  const group = game.homeworlds!.custody!.visitors[world][owner];
  assert.ok(group && group.normal > 0 && group.elite === 0);
  const quote = quoteHomeworldCustody(homeworldContext(game),game.homeworlds!.custody!,[
    {homeworld:world,player:owner,withdraw:{...group},deposit:{normal:0,elite:0}},
    {homeworld:'homeworld:emperor',player:owner,withdraw:{normal:0,elite:0},deposit:{...group}},
  ]);
  game.homeworlds!.custody = quote.state;
  for (const seat of quote.players) homeworldEcazDukePlayer(game,seat.id).reserves = seat.reserves;
  homeworldGameIntegrity(game);
  return game;
}
