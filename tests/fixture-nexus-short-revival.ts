import assert from 'node:assert/strict';
import { normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { emperorNexusRevivalCount } from '../game/nexus-emperor-secret-ally';
import {
  createClassicIndependentNexusFixture, advanceClassicIndependentNexus, type ClassicIndependentNexusStep,
} from './fixture-classic-independent-nexus';
import {
  applyClassicDiscoveryNexusStep, classicDiscoveryNexusClean, nextClassicDiscoveryNexusStep,
} from './fixture-discovery-classic-nexus';

export type NexusShortRevivalStep = ClassicIndependentNexusStep;
export const actNexusShortRevival = (game: Game, actor: string, action: Action,
  actions: NexusShortRevivalStep[] = []) => applyClassicDiscoveryNexusStep(game,{actor,action},actions);
export const nexusShortRevivalPlayer = (game: Game, actor = 'atreides') => {
  const p = game.players.find(p => p.id === actor); assert.ok(p); return p;
};
export const nexusShortRevivalClean = (game: Game) => classicDiscoveryNexusClean(game) &&
  !game.pendingRevival && !game.pendingShipment && !game.pendingGuildBetrayal;
export function nexusShortRevivalInventory(game: Game) {
  const cards = [...game.deck,...game.discard,...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index+Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(c => c.id).sort();
  assert.deepEqual(cards,baseDeck().map(c => c.id).sort());
  const state = game.nexusCards!.cards!;
  const nexus = [...state.deck,...state.discard,...Object.values(state.hands).filter(card => card !== null)].sort();
  assert.deepEqual(nexus,[...NEXUS_FACTIONS].sort());
  const traitors = [...(game.traitorReserve ?? []),...game.players.flatMap(p => [...p.traitors,...p.traitorChoices])].sort();
  const spice = [...game.spiceDeck,...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  for (const p of game.players)
    assert.equal(p.reserves+p.tanks+Object.values(p.forces).reduce((sum,n) => sum+n,0),20);
  return {cards,nexus,traitors,spice};
}

export function nextNexusShortRevival(game: Game, losses?:1|2): NexusShortRevivalStep|null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'guildTiming')
      return {actor:game.decision.player,action:{type:'decision',take:false}};
    if (game.decision?.kind === 'battleLosses' && game.decision.player === 'atreides' && losses) {
      const choice = game.decision.options.findIndex(loss => loss.normal === losses && loss.elite === 0);
      assert.ok(choice >= 0,'Select the actual paid ordinary loss promised by this source.');
      return {actor:'atreides',action:{type:'decision',choice}};
    }
    if (game.battle?.outcomeWindow && !game.battle.outcomeWindow.closed) {
      const actor = [game.battle.attacker,game.battle.defender]
        .find(id => !game.battle!.outcomeWindow!.ready.includes(id)); assert.ok(actor);
      return {actor,action:{type:'battleOutcomeReady',event:game.battle.outcomeWindow.event}};
    }
  }
  return nextClassicDiscoveryNexusStep(game);
}
export function advanceNexusShortRevival(game: Game, until: (game: Game) => boolean,
  actions: NexusShortRevivalStep[] = [], losses?:1|2): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status,'finished');
    if (game.pendingGuildBetrayal) {
      game = advanceClassicIndependentNexus(game,g => !g.pendingGuildBetrayal,actions);
      continue;
    }
    const step = nextNexusShortRevival(game,losses);
    assert.ok(step,`Choose the native original plan/control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actNexusShortRevival(game,step.actor,step.action,actions);
  }
  assert.fail('The genuine short-revival chronology did not reach its finite boundary.');
}

/** Actual public A/G/H Nexus-only setup and battle-to-revival producer. Initial
 * unopened deals/Spice order/Nexus draw and scalar entropy are the only choices
 * outside actions. Dead counters, card holding, alliance, phase and allowances
 * are all native results; no played resource or receipt is installed. */
export function createNexusShortRevivalFixture(options: {amount?:1|2} = {}) {
  const amount = options.amount ?? 1, actor = 'atreides', guild = 'guild', harkonnen = 'harkonnen';
  const cards = baseDeck(), shield = cards.find(c => c.kind === 'shield')!, projectile = cards.find(c => c.kind === 'projectile')!;
  const worthless = cards.find(c => c.kind === 'worthless')!, snooper = cards.find(c => c.kind === 'snooper')!;
  const base = createClassicIndependentNexusFixture({advanced:true,independent:false,
    roster:['atreides','guild','harkonnen'],startingCards:{atreides:[shield.id],guild:[projectile.id],
      harkonnen:[worthless.id,snooper.id]}});
  let game = base.game; const actions = [...base.actions];
  const original = nexusShortRevivalInventory(game), afterSetup = structuredClone(game);
  const act = (owner: string, action: Action) => {game = actNexusShortRevival(game,owner,action,actions);};
  const reach = (until: (game: Game) => boolean) => {game = advanceNexusShortRevival(game,until,actions,amount);};
  const spiceOrder: {position:number;from:number;card:Game['spiceDeck'][number]}[] = [];
  for (const [position,worm] of [false,false,true,false,false].entries()) {
    const from = game.spiceDeck.findIndex((card,index) => index >= position &&
      (worm ? 'worm' in card : 'territory' in card)); assert.ok(from >= position);
    const [card] = game.spiceDeck.splice(from,1); game.spiceDeck.splice(position,0,card);
    spiceOrder.push({position,from,card:structuredClone(card)});
  }
  reach(g => g.turn === 1 && g.phase === 5 && g.active === guild && nexusShortRevivalClean(g));
  const beforeShipment = structuredClone(game), shipmentAt = actions.length;
  act(guild,{type:'ship',territory:'arrakeen',sector:10,amount:1,elite:0,allyPayment:0});
  reach(nexusShortRevivalClean);
  const shipment = {before:beforeShipment,after:structuredClone(game),steps:structuredClone(actions.slice(shipmentAt))};
  assert.equal(nexusShortRevivalPlayer(game,guild).forces['arrakeen:10'],1);
  reach(g => g.turn === 1 && g.phase === 6 && !!g.active && nexusShortRevivalClean(g));
  const beforeBattle = structuredClone(game), battleAt = actions.length, chooser = game.active!;
  assert.ok(viewGame(game,chooser).battleChoices.some(choice => choice.territory === 'arrakeen'));
  act(chooser,{type:'chooseBattle',territory:'arrakeen',target:chooser === actor ? guild : actor});
  reach(g => nexusShortRevivalClean(g) && !!g.battle && !g.battle.revealed &&
    !g.battle.preparation && g.battle.preLeader?.closed !== false);
  const own = nexusShortRevivalPlayer(game,actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a,b) => b.strength-a.strength)[0];
  const other = nexusShortRevivalPlayer(game,guild).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a,b) => a.strength-b.strength)[0]; assert.ok(own && other);
  const plans: Record<string, {leader:string;dial:number;support:number}> = {
    [actor]:{leader:own.id,dial:amount,support:amount},[guild]:{leader:other.id,dial:0,support:0},
  };
  for (const owner of [game.battle!.attacker,game.battle!.defender]) act(owner,{type:'battlePlan',...plans[owner]});
  reach(g => !g.battle && nexusShortRevivalClean(g));
  const battleResolution = structuredClone(game), battleActions = structuredClone(actions.slice(battleAt));
  assert.equal(game.lastBattleContext!.winner,actor);
  assert.equal(nexusShortRevivalPlayer(game,actor).tanks,amount);
  assert.equal(nexusShortRevivalPlayer(game,actor).forces['arrakeen:10'],10-amount);
  reach(g => g.turn === 2 && g.nexus && !g.spiceWindow && !g.spiceResolution && nexusShortRevivalClean(g));
  const nexus = structuredClone(game), allianceAt = actions.length;
  act(guild,{type:'alliance',target:harkonnen}); act(harkonnen,{type:'alliance',target:guild});
  const alliance = {steps:structuredClone(actions.slice(allianceAt)),after:structuredClone(game)};
  reach(g => g.nexusCards?.phase?.stage === 'drawing');
  const state = game.nexusCards!.cards!, from = state.deck.indexOf('emperor'); assert.ok(from >= 0);
  state.deck.unshift(state.deck.splice(from,1)[0]);
  const beforeDraw = structuredClone(game), drawAt = actions.length;
  act(actor,{type:'nexusCardChoice',turn:game.turn,card:state.hands[actor],choice:'draw',ownRedraws:0});
  const afterDraw = structuredClone(game), drawActions = structuredClone(actions.slice(drawAt));
  assert.equal(game.nexusCards!.cards!.hands[actor],'emperor');
  reach(g => g.turn === 2 && g.phase === 4 && nexusShortRevivalClean(g) &&
    (!g.revivalOrder || g.revivalOrder.remaining[0] === actor));
  assert.equal(nexusShortRevivalPlayer(game,actor).tanks,amount);
  assert.equal(nexusShortRevivalPlayer(game,actor).revived,0);
  const offer = viewGame(game,actor).nexusEmperorSecretAlly; assert.ok(offer);
  assert.equal(offer.revival.amount,amount); assert.equal(offer.revival.blocked,null);
  assert.deepEqual(nexusShortRevivalInventory(game),original);
  return {game,source:structuredClone(game),actor,amount,event:offer.event,
    action:{type:'nexusEmperorRevive',event:offer.event,elite:0} as Action,
    base,afterSetup,shipment,beforeBattle,plans,battleResolution,battleActions,nexus,alliance,
    beforeDraw,afterDraw,drawActions,nexusOrder:{from,card:'emperor' as const},
    beforeRevival:structuredClone(game),spiceOrder,original,actions,sourceActions:actions,sourceCount:actions.length,
    disclosure:'Original public Advanced A/G/H Nexus-only base33 setup, selected unopened four-card deal, five original Spice positions and scalar lotteries. Guild really ships1 to original A10 Arrakeen; real A leader5/dial1or2/paid support1or2 wins and creates exactly the requested one/two ordinary Tanks. Actual next-turn worm and G–H reciprocal alliance leave A unallied; original unused Emperor Nexus position is selected before A’s real closing draw. Native phase controls and current Revival queue stop before A ordinary return. No played hand, purse, army, Tank, phase, alliance, Nexus holding, quota or receipt is installed.'};
}
export type NexusShortRevivalFixture = ReturnType<typeof createNexusShortRevivalFixture>;

export function applyNexusShortRevival(f: NexusShortRevivalFixture, source = f.game) {
  const actions: NexusShortRevivalStep[] = [], before = structuredClone(source);
  let game = actNexusShortRevival(structuredClone(source),f.actor,f.action,actions);
  const declared = structuredClone(game);
  game = normalizeAutomaticGame(game);
  assert.equal(game.nexusEmperorSecretHistory!.at(-1)!.stage,'returned');
  assert.equal(emperorNexusRevivalCount(game.nexusEmperorSecretHistory!.at(-1)!),f.amount);
  assert.equal(nexusShortRevivalPlayer(game,f.actor).tanks,0);
  assert.deepEqual(nexusShortRevivalInventory(game),f.original);
  return {game,before,declared,actions};
}
