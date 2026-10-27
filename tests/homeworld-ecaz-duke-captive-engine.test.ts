import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DUKE_VIDAL_ID, dukeController, retireHomeworldDukeTenure } from '../game/duke-vidal';
import { quoteHomeworldEcazDuke, releaseCapturedHomeworldDuke } from '../game/homeworld-ecaz-duke';
import {
  createHomeworldEcazDukeCaptiveFixture, expireEcazDukeCaptive,
  useExpiredEcazDukeCaptive, controlledEcazDukeCaptiveDeparture,
  actEcazDukeCaptive as act, ecazDukeCaptivePlayer as p,
  ecazDukeCaptiveInventory as inventory,
  type HomeworldEcazDukeCaptiveFixture,
} from './fixture-homeworld-ecaz-duke-captive';

let earned: HomeworldEcazDukeCaptiveFixture | undefined;
const fixture = () => earned ??= createHomeworldEcazDukeCaptiveFixture();
const reload = (g: Game): Game => structuredClone(g);
function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game,actor,action));
  assert.deepEqual(game,before);
}
function disc(game: Game) {
  assert.equal(game.dukeVidal!.leader.id,DUKE_VIDAL_ID);
  assert.equal(game.players.flatMap(p => p.leaders).filter(l => l.id === DUKE_VIDAL_ID).length,0);
  assert.deepEqual(inventory(game),fixture().source.originalInventory);
}

void test('native occupied-Ecaz capture starts with original Harkonnen, actual World lease and unused-Duke lottery', () => {
  const f = fixture(), source = f.source;
  assert.match(f.disclosure,/Original public Advanced.*no installed occupation, lease or capture receipt/);
  assert.equal(source.initial.players.length,5);
  assert.equal(source.initial.players.find(p => p.id === f.captor)!.faction,'harkonnen');
  assert.equal(p(source.afterSetup,f.captor).forces['carthag:11'],10);
  assert.equal(p(source.afterSetup,f.captor).hand.length,2);
  assert.equal(source.originalInventory.length,33);
  assert.equal(p(source.duneShipment.after,f.owner).forces['sietch_tabr:14'],2);
  assert.equal(source.secondEntrant!.steps[0].actor,f.captor);
  assert.equal(source.qualification.player,f.owner);
  assert.equal(source.qualification.cause,'sole');
  assert.equal(f.beforeBattle.dukeVidal!.controller,f.owner);
  assert.equal(f.beforeBattle.dukeVidal!.source,'homeworldEcaz');
  assert.equal(f.beforeBattle.dukeVidal!.leader.usedAt,undefined);
  assert.ok(Object.values(f.plans).every(plan => plan.leader !== f.dukeId));
  assert.ok(f.candidates.includes(f.dukeId));
  assert.equal(f.selected.decision?.kind === 'capturedLeader' && f.selected.decision.leader,f.dukeId);
  assert.equal(f.game.dukeVidal!.leader.capturedBy,f.captor);
  assert.equal(dukeController(f.game.dukeVidal!),f.captor);
  assert.deepEqual(f.game.dukeVidal!.captureVisibility,{controller:f.owner,acquiredTurn:2,source:'homeworldEcaz'});
  assert.equal(f.game.dukeVidal!.leader.usedAt,undefined);
  assert.equal(f.sourceCount,f.sourceActions.length);
  assert.equal(f.captureActions.filter(step => step.action.type === 'battlePlan').length,2);
  assert.equal(f.captureActions.filter(step => step.action.type === 'decision' && step.action.accept === true).length,1);
  disc(f.game);
});

void test('actual next-turn expiry retires occupied-Ecaz underlay while Harkonnen keeps the same unused living captive', () => {
  const f = fixture(), expired = expireEcazDukeCaptive(f), duke = expired.game.dukeVidal!;
  assert.equal(expired.game.turn,3);
  assert.ok(expired.actions.length > 0);
  assert.equal(duke.controller,null);
  assert.equal(duke.acquiredTurn,null);
  assert.equal(duke.source,null);
  assert.deepEqual(duke.captureVisibility,{controller:null,acquiredTurn:null,source:null});
  assert.equal(duke.leader.capturedBy,f.captor);
  assert.equal(duke.leader.concealed!.controller,f.owner);
  assert.equal(duke.leader.dead,false);
  assert.equal(duke.leader.deaths,f.game.dukeVidal!.leader.deaths);
  assert.equal(duke.leader.usedAt,undefined);
  assert.equal(dukeController(duke),f.captor);
  assert.deepEqual(expired.game.homeworldEcazDukeGrants,f.game.homeworldEcazDukeGrants);
  const offer = quoteHomeworldEcazDuke(expired.game);
  assert.equal(offer.owner,f.owner);
  assert.match(offer.blocked!,/captur|conceal|custody/i);
  assert.deepEqual(retireHomeworldDukeTenure(duke,expired.game.turn),duke);
  disc(expired.game);
});

void test('real later captive-Duke battle use returns the expired shared disc set aside after a paid native entry', () => {
  const f = fixture(), expired = expireEcazDukeCaptive(f);
  const result = useExpiredEcazDukeCaptive(f,expired.game), game = result.game, duke = game.dukeVidal!;
  assert.ok(result.actions.some(step => step.actor === f.owner && step.action.type === 'ship' &&
    step.action.territory === f.territory && step.action.amount === 1));
  assert.ok(result.actions.some(step => step.actor === f.captor && step.action.type === 'battlePlan' &&
    step.action.leader === f.dukeId));
  assert.equal(result.beforeBattle.dukeVidal!.leader.capturedBy,f.captor);
  assert.equal(game.lastBattleContext!.winner,f.captor);
  assert.equal(duke.leader.id,f.dukeId);
  assert.equal(duke.leader.dead,false);
  assert.equal(duke.leader.deaths,f.game.dukeVidal!.leader.deaths);
  assert.equal(duke.leader.usedAt,f.territory);
  assert.equal(duke.leader.capturedBy,undefined);
  assert.equal(duke.leader.concealed,undefined);
  assert.equal(duke.captureVisibility,undefined);
  assert.equal(duke.controller,null);
  assert.equal(duke.source,null);
  assert.equal(duke.acquiredTurn,null);
  disc(game);
});

void test('earned captive helper release restores the still-current qualified original occupied-Ecaz tenure', () => {
  const f = fixture(), game = reload(f.game), before = reload(game);
  const released = releaseCapturedHomeworldDuke(game,f.captor);
  assert.equal(game.turn,2);
  assert.equal(released.controller,f.owner);
  assert.equal(released.source,'homeworldEcaz');
  assert.equal(released.acquiredTurn,game.turn);
  assert.equal(released.leader.id,f.dukeId);
  assert.equal(released.leader.dead,false);
  assert.equal(released.leader.deaths,game.dukeVidal!.leader.deaths);
  assert.equal(released.leader.capturedBy,undefined);
  assert.equal(released.leader.concealed,undefined);
  assert.equal(released.captureVisibility,undefined);
  assert.deepEqual(game,before,'This focused helper exercise is not a claimed native early-release action.');
});

void test('controlled conserved same-turn departure helper context cannot restore an ended occupied-Ecaz entitlement', () => {
  const f = fixture(), game = controlledEcazDukeCaptiveDeparture(f.game);
  // Explicit unit supplement: only present physical custody changed. No played
  // departure, occupation observation, lease/capture receipt or clock is added.
  assert.equal(game.turn,f.game.turn);
  assert.deepEqual(game.homeworldOccupationHistory,f.game.homeworldOccupationHistory);
  assert.deepEqual(game.homeworldEcazDukeGrants,f.game.homeworldEcazDukeGrants);
  assert.equal(quoteHomeworldEcazDuke(game).owner,null);
  const before = reload(game), released = releaseCapturedHomeworldDuke(game,f.captor);
  assert.equal(released.controller,null);
  assert.equal(released.source,null);
  assert.equal(released.acquiredTurn,null);
  assert.equal(released.leader.id,f.dukeId);
  assert.equal(released.leader.dead,false);
  assert.equal(released.leader.capturedBy,undefined);
  assert.equal(released.captureVisibility,undefined);
  assert.deepEqual(game,before);
  disc(game);
});

void test('actual occupied-Ecaz acquisition remains blocked on the captive and foreign helper release rejects before mutation', () => {
  const f = fixture(), expired = expireEcazDukeCaptive(f), game = expired.game;
  const quote = quoteHomeworldEcazDuke(game); assert.ok(quote.event);
  reject(game,f.owner,{type:'homeworldDuke',event:quote.event,recipient:f.owner});
  const before = reload(game);
  assert.throws(() => releaseCapturedHomeworldDuke(game,f.owner));
  assert.deepEqual(game,before);
  assert.equal(dukeController(game.dukeVidal!),f.captor);
  disc(game);
});

void test('all four minimal profiles answer the actual occupied-Duke captured-leader choice legally', () => {
  const f = fixture();
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = reload(f.selected), view = viewGame(game,f.captor);
    view.players.find(p => p.id === f.captor)!.bot = profile;
    const action = botActions(view)[0];
    assert.ok(action,`${profile} needs the actual retained/executed captive decision.`);
    const next = act(game,f.captor,action);
    if (action.mode === 'execute') {
      assert.equal(next.dukeVidal!.leader.dead,true);
      assert.equal(next.dukeVidal!.leader.capturedBy,undefined);
      // The native Keep baseline includes the same automatic Carthag income.
      assert.equal(p(next,f.captor).spice,p(f.game,f.captor).spice+2);
    } else {
      assert.equal(action.mode,'keep');
      assert.equal(next.dukeVidal!.leader.capturedBy,f.captor);
    }
    disc(next);
  }
});
