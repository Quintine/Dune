import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { combatArmy } from '../game/combat-location';
import {
  drawClassicNexusReaction, reactionAction, reactionPlayer,
} from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { nextClassicDiscoveryNexusStep, classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';

export type NexusShortCunningStep = ClassicIndependentNexusStep;
export const actNexusShortCunning = reactionAction;
export const nexusShortCunningPlayer = reactionPlayer;
export const nexusShortCunningClean = (game: Game) => classicDiscoveryNexusClean(game) &&
  !game.pendingShipment && !game.pendingGuildBetrayal;
export function nexusShortCunningInventory(game: Game) {
  const cards = [...game.deck,...game.discard,...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index+Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(c => c.id).sort();
  assert.deepEqual(cards,baseDeck().map(c => c.id).sort());
  const native = game.nexusCards!.cards!;
  const nexus = [...native.deck,...native.discard,...Object.values(native.hands).filter(c => c !== null)].sort();
  assert.deepEqual(nexus,[...NEXUS_FACTIONS].sort());
  assert.equal(new Set(nexus).size,nexus.length);
  const traitors = [...(game.traitorReserve ?? []),...game.players.flatMap(p => [...p.traitors,...p.traitorChoices])].sort();
  const spice = [...game.spiceDeck,...game.spiceDiscard.flat()].map(c => JSON.stringify(c)).sort();
  for (const p of game.players)
    assert.equal(p.reserves+p.tanks+Object.values(p.forces).reduce((sum,n) => sum+n,0),20);
  return {cards,nexus,traitors,spice};
}
export function advanceNexusShortCunning(game: Game, until: (game: Game) => boolean,
  actions: NexusShortCunningStep[] = []): Game {
  return advanceClassicIndependentNexus(game,until,actions);
}
const planReady = (game: Game) => nexusShortCunningClean(game) && !!game.battle &&
  !game.battle.revealed && !game.battle.preparation && game.battle.preLeader?.closed !== false;

/** Original public Advanced A/G/E Nexus-only source. The real turn-two worm,
 * reciprocal A/G alliance and closing Nexus draw give unallied E its own card;
 * the only force producer is E's actual smaller normal shipment to Arrakeen.
 * Initial Treachery/Nexus/Spice positions and scalar lotteries are selected
 * while unused. No played hand, army, wallet, phase or receipt is installed. */
export function createNexusShortCunningFixture(options: {amount?:2|4;karama?:boolean} = {}) {
  const amount = options.amount ?? 2, actor = 'emperor', opponent = 'atreides';
  const cards = baseDeck(), counter = cards.find(c => c.effect === 'karama')!;
  const shield = cards.find(c => c.kind === 'shield')!, projectile = cards.find(c => c.kind === 'projectile')!;
  const ordinary = cards.find(c => c.kind === 'worthless')!;
  const base = drawClassicNexusReaction('emperor',actor,{advanced:true,independent:false,
    roster:['atreides','guild','emperor'],startingCards:{
      atreides:[options.karama === false ? ordinary.id : counter.id],guild:[projectile.id],emperor:[shield.id],
    }});
  let game = base.game; const actions = [...base.actions];
  const original = nexusShortCunningInventory(game);
  assert.equal(game.nexusCards!.cards!.hands[actor],'emperor');
  assert.equal(reactionPlayer(game,actor).ally,null);
  assert.equal(reactionPlayer(game,opponent).ally,'guild');
  game = advanceNexusShortCunning(game,g => g.phase === 5 && g.active === actor &&
    nexusShortCunningClean(g),actions);
  const beforeShipment = structuredClone(game), shipmentAt = actions.length;
  game = actNexusShortCunning(game,actor,{type:'ship',territory:'arrakeen',sector:10,
    amount,elite:0,allyPayment:0},actions);
  game = advanceNexusShortCunning(game,nexusShortCunningClean,actions);
  const afterShipment = structuredClone(game), shipment = {
    before:beforeShipment,after:afterShipment,steps:structuredClone(actions.slice(shipmentAt)),
    cost:reactionPlayer(beforeShipment,actor).spice-reactionPlayer(afterShipment,actor).spice,
  };
  assert.equal(shipment.cost,amount);
  assert.deepEqual(combatArmy(game,actor,'arrakeen'),{normal:amount,elite:0});
  game = advanceNexusShortCunning(game,g => g.phase === 6 && !!g.active &&
    nexusShortCunningClean(g),actions);
  const beforeBattle = structuredClone(game), chooser = game.active!;
  assert.ok(viewGame(game,chooser).battleChoices.some(c => c.territory === 'arrakeen'));
  game = actNexusShortCunning(game,chooser,{type:'chooseBattle',territory:'arrakeen',
    target:chooser === actor ? opponent : actor},actions);
  const preparation = structuredClone(game);
  game = advanceNexusShortCunning(game,planReady,actions);
  const leader = reactionPlayer(game,actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a,b) => b.strength-a.strength)[0];
  const enemy = reactionPlayer(game,opponent).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a,b) => a.strength-b.strength)[0];
  assert.ok(leader && enemy);
  assert.deepEqual(game.battle!.plans,{});
  assert.deepEqual(combatArmy(game,actor,'arrakeen'),{normal:amount,elite:0});
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.discoveryEnabled &&
    !game.techTokens && !game.strongholdCards && !game.ecazTreachery);
  assert.deepEqual(nexusShortCunningInventory(game),original);
  const event = viewGame(game,actor).nexusSardaukar!.offer!.event;
  return {game,source:structuredClone(game),actor,owner:actor,opponent,amount,event,
    card:'emperor' as const,karama:options.karama === false ? null : counter.id,
    action:{type:'nexusSardaukar',event} as Action,leader:leader.id,opponentLeader:enemy.id,
    plan:{type:'battlePlan',leader:leader.id,dial:2,support:1} as Action,
    canceledPlan:{type:'battlePlan',leader:leader.id,dial:1,support:1} as Action,
    opponentPlan:{type:'battlePlan',leader:enemy.id,dial:0,support:0} as Action,
    key:'arrakeen:10',territory:'arrakeen',base,shipment,beforeBattle,preparation,original,
    actions,sourceActions:actions,sourceCount:actions.length,
    disclosure:'Original public Advanced A/G/E with Nexus opt-in before Ready/start and base33 only. Actual first turn, turn-two worm, reciprocal A/G alliance and original closing draw earn the unique Emperor card. Only unused original Treachery/Nexus/Spice positions and scalar lotteries are selected. E really ships the requested short ordinary group to original A10 Arrakeen, at its actual city price. No played hand, wallet, force, phase, alliance, Nexus holding, battle, promise or receipt is installed.'};
}
export type NexusShortCunningFixture = ReturnType<typeof createNexusShortCunningFixture>;

export function resolveNexusShortCunning(f: NexusShortCunningFixture, canceled = false, source = f.game) {
  const actions: NexusShortCunningStep[] = [];
  let game = actNexusShortCunning(structuredClone(source),f.actor,f.action,actions);
  const declared = structuredClone(game);
  if (canceled) {
    assert.ok(f.karama);
    assert.equal(game.response?.kind,'nexusSardaukar');
    game = actNexusShortCunning(game,f.opponent,{type:'card',card:f.karama,mode:'cancel'},actions);
  } else game = advanceNexusShortCunning(game,nexusShortCunningClean,actions);
  assert.equal(game.nexusSardaukarLast?.stage,canceled ? 'canceled' : 'active');
  return {game,declared,actions};
}

export function finishNexusShortCunning(f: NexusShortCunningFixture, source: Game,
  plan: Action = f.plan, actions: NexusShortCunningStep[] = []) {
  let game = actNexusShortCunning(source,f.actor,plan,actions);
  const afterPlan = structuredClone(game);
  game = actNexusShortCunning(game,f.opponent,f.opponentPlan,actions);
  const revealed = structuredClone(game);
  for (let n = 0; game.battle && n < 100; n++) {
    const choice = game.decision?.kind === 'battleLosses' && game.decision.player === f.actor
      ? game.decision.options.findIndex(loss => loss.normal === 1 && loss.elite === 0) : -1;
    const next = choice >= 0 ? {actor:f.actor,action:{type:'decision',choice} as Action}
      : nextClassicDiscoveryNexusStep(game); assert.ok(next);
    game = actNexusShortCunning(game,next.actor,next.action,actions);
  }
  assert.equal(game.battle,null);
  return {game,afterPlan,revealed,actions};
}
