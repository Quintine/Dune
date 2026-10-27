import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { actSalusaGhola, advanceSalusaGhola, salusaGholaClean,
  type SalusaGholaStep } from './fixture-salusa-ghola';

const seat = (g: Game, id: string) => { const p = g.players.find(p => p.id === id); assert.ok(p); return p; };
const readyForPlan = (g: Game) => salusaGholaClean(g) && !!g.battle && !g.battle.revealed &&
  !g.battle.preparation && (!g.battle.preLeader || g.battle.preLeader.closed);
function livingLeader(g: Game, id: string, strongest: boolean, excluded?: string) {
  const leaders = seat(g, id).leaders.filter(l => !l.dead && !l.capturedBy && l.id !== excluded &&
    (!l.usedAt || l.usedAt === 'imperial_basin')).sort((a,b) => strongest ? b.strength-a.strength : a.strength-b.strength);
  assert.ok(leaders[0]); return leaders[0].id;
}
/** Real public Advanced E/A/G source: three actual forces meet in Imperial
 * Basin; the first battle's surviving leader discs then remain in that same
 * territory while the two remaining armies fight. Only the unopened three-card
 * starting deal, two unopened land Spice positions and scalar lotteries are
 * selected; no played forces, leaders, wallet, battle or clock is assigned. */
export function createBattleTerritoryExplosionFixture() {
  let game = createGame('TERRITORYEXPLOSION', newPlayer('emperor','Emperor','emperor'), true);
  joinGame(game,newPlayer('atreides','Atreides','atreides'));
  joinGame(game,newPlayer('guild','Guild','guild'));
  const actions: SalusaGholaStep[] = [];
  const act = (actor: string, action: Action) => { game = actSalusaGhola(game,actor,action,actions); };
  const reach = (until: (g: Game) => boolean) => { game = advanceSalusaGhola(game,until,actions); };
  for (const p of game.players) act(p.id,{type:'ready'});
  const lobby = structuredClone(game);
  act(game.host,{type:'start',advancedPreview:true});
  const setup = structuredClone(game);
  assert.equal(game.status,'setup'); assert.ok(game.players.every(p => p.hand.length === 0));
  const shield = game.deck.find(c => c.kind === 'shield');
  const ordinary = game.deck.find(c => c.kind === 'projectile');
  const lasgun = game.deck.find(c => c.kind === 'lasgun');
  assert.ok(shield && ordinary && lasgun);
  const selected = [shield,ordinary,lasgun];
  const startingSelection = selected.map((card,position) => {
    const from = game.deck.findIndex(c => c.id === card.id); assert.ok(from >= position);
    [game.deck[position],game.deck[from]] = [game.deck[from],game.deck[position]];
    return {position,from,card:card.id};
  });
  reach(g => g.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(c => c.id)),selected.map(c => c.id));
  const spiceSelection = [0,1].map(position => {
    const from = game.spiceDeck.findIndex((c,index) => index >= position &&
      'territory' in c && !c.discovery && c.territory !== 'imperial_basin');
    assert.ok(from >= position); const [c] = game.spiceDeck.splice(from,1);
    game.spiceDeck.splice(position,0,c); return {position,from,card:structuredClone(c)};
  });
  reach(g => g.phase === 5 && salusaGholaClean(g));
  const shipments: SalusaGholaStep[] = [];
  for (let n = 0; game.phase === 5 && n < 100; n++) {
    if (!salusaGholaClean(game)) { reach(salusaGholaClean); continue; }
    const owner = game.active!;
    if (owner === 'atreides') {
      act(owner,{type:'move',from:'arrakeen:10',territory:'imperial_basin',sector:9,amount:1});
    } else {
      const action: Action = {type:'ship',territory:'imperial_basin',sector:9,
        amount:owner === 'emperor' ? 2 : 1,elite:0,allyPayment:0};
      shipments.push({actor:owner,action}); act(owner,action);
    }
    reach(salusaGholaClean);
    act(owner,{type:'endMovement'});
  }
  assert.equal(game.phase,6);
  reach(g => salusaGholaClean(g) && !g.battle && !!g.active);
  const beforeFirst = structuredClone(game), chooser = game.active!;
  const choice = viewGame(game,chooser).battleChoices.find(c => c.territory === 'imperial_basin' &&
    (c.attacker === 'atreides' || c.defender === 'atreides'));
  assert.ok(choice, 'Choose the actual first contest against Atreides');
  const other = choice.attacker === 'atreides' ? choice.defender : choice.attacker;
  act(chooser,{type:'chooseBattle',territory:'imperial_basin',target:chooser === 'atreides' ? other : 'atreides'});
  reach(readyForPlan);
  const priorLoser = livingLeader(game,'atreides',false), priorWinner = livingLeader(game,other,true);
  act('atreides',{type:'battlePlan',leader:priorLoser,dial:0,support:0});
  act(other,{type:'battlePlan',leader:priorWinner,dial:0,support:0});
  reach(g => !g.battle && salusaGholaClean(g) && g.phase === 6 && !!g.active);
  const afterFirst = structuredClone(game);
  assert.equal(game.lastBattleContext?.winner,other);
  assert.ok(seat(game,'atreides').leaders.some(l => l.id === priorLoser && !l.dead && l.usedAt === 'imperial_basin'));
  assert.ok(seat(game,other).leaders.some(l => l.id === priorWinner && !l.dead && l.usedAt === 'imperial_basin'));
  const secondChooser = game.active!;
  const next = viewGame(game,secondChooser).battleChoices.find(c => c.territory === 'imperial_basin' &&
    [c.attacker,c.defender].includes('emperor') && [c.attacker,c.defender].includes('guild'));
  assert.ok(next, 'The actual two remaining armies must battle');
  act(secondChooser,{type:'chooseBattle',territory:'imperial_basin',
    target:secondChooser === 'emperor' ? 'guild' : 'emperor'});
  reach(readyForPlan);
  const beforeExplosion = structuredClone(game);
  const emperorLeader = livingLeader(game,'emperor',false,other === 'emperor' ? priorWinner : undefined);
  const guildLeader = livingLeader(game,'guild',false,other === 'guild' ? priorWinner : undefined);
  const plans = [
    {actor:'emperor',action:{type:'battlePlan',leader:emperorLeader,dial:0,support:0,defense:shield.id} as Action},
    {actor:'guild',action:{type:'battlePlan',leader:guildLeader,dial:0,support:0,weapon:lasgun.id} as Action},
  ];
  return {game,beforeExplosion,beforeFirst,afterFirst,lobby,setup,afterSetup,startingSelection,spiceSelection,
    priorLoser,priorWinner,priorWinnerOwner:other,emperorLeader,guildLeader,plans,actions,shipments,
    shield:shield.id,lasgun:lasgun.id,territory:'imperial_basin',
    staging:'Only unopened starting cards and Spice positions and scalar lotteries are selected. The board entry, first battle and survivor discs use public native actions.'};
}
