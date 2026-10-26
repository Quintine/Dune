import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { leaderSkillBattleBonus } from '../game/leader-skill-combat';
import {
  acceptE3HarkonnenCapture as accept, actE3Capture as act, advanceE3Capture as advance,
  cancelE3HarkonnenCapture as cancel, continueE3HarkonnenCaptiveBattle as useCaptive,
  createE3HarkonnenCaptureFixture as fixture, declineE3HarkonnenCapture as decline,
  e3CaptureClean as clean, e3CaptureInventory as inventory, e3CapturePlayer as p,
  e3CaptureReload as reload, type E3CaptureStep,
} from './fixture-e3-harkonnen-capture';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function skillCount(game: Game, skill: string) {
  return game.leaderSkills!.deck.filter(card => card === skill).length +
    game.leaderSkills!.assignments.filter(row => row.skill === skill).length +
    Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards).filter(card => card === skill).length;
}

for (const native of ['ecaz', 'moritani'] as const) {
  void test(`native Advanced ${native} all14 source earns two real battles and the original Harkonnen capture offer`, () => {
    const f = fixture(native);
    assert.equal(f.afterSetup.advanced, true);
    assert.deepEqual(f.afterSetup.players.map(player => player.faction), ['guild', 'harkonnen', native]);
    assert.deepEqual(f.afterSetup.expansions, ['ecaz']);
    assert.equal(f.sourceCounts.setup, f.setupActions.length);
    assert.equal(f.sourceCounts.firstBattle, f.firstBattleActions.length);
    assert.equal(f.sourceCounts.source, f.actions.length);
    assert.ok(f.setupActions.some(step => step.actor === native && step.action.type === 'leaderSkill' &&
      step.action.skill === 'warmaster' && step.action.leader === f.captive));
    assert.deepEqual(f.shipments.map(row => ({ actor: row.actor, amount: row.action.amount, cost: row.cost })),
      [{ actor: 'harkonnen', amount: 1, cost: 2 }, { actor: 'guild', amount: 1, cost: 1 }]);
    assert.equal(f.movement.action.from, 'carthag:11');
    assert.equal(f.movement.action.territory, 'tsimpo');
    assert.equal(p(f.beforeFirstBattle, 'harkonnen').forces['imperial_basin:9'], 1);
    assert.equal(p(f.beforeFirstBattle, 'harkonnen').forces['tsimpo:11'], 1);
    assert.equal(p(f.beforeFirstBattle, 'guild').forces['tsimpo:11'], 1);
    assert.equal(f.game.decision?.kind, 'captureOffer');
    assert.equal(p(f.game, native).tanks, 6);
    assert.equal(p(f.game, native).leaders.find(leader => leader.id === f.captive)?.dead, false);
    assert.deepEqual(f.game.leaderSkills!.assignments.find(row => row.owner === native), f.assignment);
    assert.deepEqual(inventory(f.game), f.original);
    assert.equal(!!f.game.moritaniAssassinate, native === 'moritani');
  });

  void test(`actual trained ${native} capture keeps its original assignment and exposes only the captive lower band`, () => {
    const f = fixture(native), actions: E3CaptureStep[] = [];
    reject(f.game, 'guild', { type: 'decision', accept: true });
    const game = accept(f, 'keep', f.game, actions);
    const leader = p(game, native).leaders.find(leader => leader.id === f.captive)!;
    assert.equal(leader.capturedBy, 'harkonnen'); assert.equal(leader.concealed, undefined);
    assert.equal(leader.dead, false);
    assert.deepEqual(game.leaderSkills!.assignments.find(row => row.owner === native), f.assignment);
    assert.equal(skillCount(game, 'warmaster'), 1);
    assert.equal(game.leaderSkills!.offers[native], undefined);
    for (const actor of [native, 'harkonnen']) {
      const row = viewGame(game, actor).leaderSkills!.assignments.find(row => row.leader === f.captive)!;
      assert.ok(row); assert.equal(row.owner, native); assert.equal(row.controller, 'harkonnen');
      assert.equal(row.captured, true); assert.equal(row.faceUp, false);
      const otherLeader = p(game, actor).leaders.find(own => own.id !== f.captive && !own.dead)!;
      assert.equal(leaderSkillBattleBonus({ assignments: [row],
        selectedLeader: { id: otherLeader.id, kind: 'disc' }, weapon: p(game, 'harkonnen').hand.find(card => card.id === f.worthless),
        defense: undefined, skilledLeaderSurvives: true }).bonus, 0,
      'The captive upper band cannot strengthen either faction’s other leader');
    }
    assert.ok(actions.some(step => step.actor === 'harkonnen' && step.action.accept === true));
    assert.ok(actions.some(step => step.actor === 'harkonnen' && step.action.mode === 'keep'));
    if (native === 'moritani') assert.ok([...f.actions, ...actions].some(step =>
      step.actor === native && step.action.type === 'decision' && step.action.decline === true),
    'Original Moritani optional aftermath is declined through its native control');
    assert.deepEqual(inventory(game), f.original);
  });

  void test(`captured ${native} Warmaster supplies exactly lower three then returns alive with its same assignment`, () => {
    const f = fixture(native), captureActions: E3CaptureStep[] = [], battleActions: E3CaptureStep[] = [];
    const kept = accept(f, 'keep', f.game, captureActions);
    const result = useCaptive(f, kept, 'alive', battleActions), game = result.game;
    assert.equal(result.plans[0].action.leader, f.captive);
    assert.equal(result.plans[0].action.weapon, f.worthless);
    assert.equal(result.plans[0].action.defense, null, 'The held Harkonnen Shield supplies no native Prana bonus');
    const bonuses = game.log.filter(entry => entry.automatic?.name === 'Leader Skill' && entry.text.includes('Warmaster'));
    assert.ok(bonuses.some(entry => entry.text.includes('gained 3 battle strength')));
    assert.equal(bonuses.some(entry => entry.text.includes('gained 1 battle strength')), false);
    const leader = p(game, native).leaders.find(leader => leader.id === f.captive)!;
    assert.equal(leader.dead, false); assert.equal(leader.capturedBy, undefined); assert.equal(leader.usedAt, 'tsimpo');
    assert.deepEqual(game.leaderSkills!.assignments.find(row => row.owner === native), f.assignment);
    assert.equal(game.leaderSkills!.deck.includes('warmaster'), false);
    assert.equal(skillCount(game, 'warmaster'), 1);
    assert.equal(viewGame(game, native).leaderSkills!.assignments.find(row => row.leader === f.captive)?.controller, native);
    assert.ok(p(game, 'harkonnen').hand.some(card => card.id === f.shield));
    assert.ok(p(game, 'harkonnen').hand.some(card => card.id === f.worthless));
    assert.ok(captureActions.length > 0 && battleActions.length > 0);
    assert.deepEqual(inventory(game), f.original);
  });

  void test(`actual Guild poison kills the captive ${native} trainer and returns its one physical skill`, () => {
    const f = fixture(native), kept = accept(f);
    const result = useCaptive(f, kept, 'death'), game = result.game;
    assert.equal(result.plans[1].action.weapon, f.poison);
    assert.equal(result.plans[0].action.defense, null);
    const leader = p(game, native).leaders.find(leader => leader.id === f.captive)!;
    assert.equal(leader.dead, true); assert.equal(leader.deaths, 1); assert.equal(leader.capturedBy, undefined);
    assert.equal(game.leaderSkills!.assignments.some(row => row.leader === f.captive), false);
    assert.equal(game.leaderSkills!.deck.filter(skill => skill === 'warmaster').length, 1);
    assert.equal(skillCount(game, 'warmaster'), 1);
    assert.equal(game.discard.filter(card => card.id === f.worthless).length, 1);
    assert.ok(p(game, 'harkonnen').hand.some(card => card.id === f.shield));
    assert.equal(game.log.filter(entry => entry.automatic?.name === 'Leader Skill lost' && entry.text.includes('Warmaster')).length, 1);
    assert.deepEqual(inventory(game), f.original);
  });

  void test(`native execution of the known trained ${native} captive pays two and returns the skill once`, () => {
    const f = fixture(native), before = p(f.game, 'harkonnen').spice;
    const game = accept(f, 'execute');
    const leader = p(game, native).leaders.find(leader => leader.id === f.captive)!;
    assert.equal(leader.dead, true); assert.ok(leader.deaths >= 2); assert.equal(leader.capturedBy, undefined);
    assert.equal(p(game, 'harkonnen').spice, before + 2);
    assert.equal(game.leaderSkills!.assignments.some(row => row.leader === f.captive), false);
    assert.equal(game.leaderSkills!.deck.filter(skill => skill === 'warmaster').length, 1);
    assert.equal(skillCount(game, 'warmaster'), 1);
    assert.deepEqual(inventory(game), f.original);
  });
}

void test('both actual native capture offers may be declined or canceled with the original dealt Karama', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    const f = fixture(native);
    for (const mode of ['decline', 'cancel'] as const) {
      const game = mode === 'decline' ? decline(f) : cancel(f);
      const leader = p(game, native).leaders.find(leader => leader.id === f.captive)!;
      assert.equal(leader.dead, false); assert.equal(leader.capturedBy, undefined);
      assert.deepEqual(game.leaderSkills!.assignments.find(row => row.owner === native), f.assignment);
      assert.equal(skillCount(game, 'warmaster'), 1);
      assert.equal(game.discard.filter(card => card.id === f.karama).length, mode === 'cancel' ? 1 : 0);
      assert.equal(p(game, 'harkonnen').spice, p(f.game, 'harkonnen').spice);
      assert.deepEqual(inventory(game), f.original);
    }
  }
});

void test('four minimal profiles make legal original capture and captive-disposition choices for both native trainers', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    const f = fixture(native);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
      let game = reload(f.game);
      const own = viewGame(game, 'harkonnen'); own.players.find(row => row.id === 'harkonnen')!.bot = difficulty;
      const proposal = botActions(own).find(action => action.type === 'decision' && typeof action.accept === 'boolean');
      assert.ok(proposal, `${native}/${difficulty} supplies its original capture choice`);
      game = act(game, 'harkonnen', proposal, [], f.captive);
      if (proposal.accept) {
        game = advance(game, state => state.decision?.kind === 'capturedLeader', [], f.captive);
        const current = viewGame(game, 'harkonnen'); current.players.find(row => row.id === 'harkonnen')!.bot = difficulty;
        const disposition = botActions(current).find(action => action.type === 'decision' && ['keep', 'execute'].includes(String(action.mode)));
        assert.ok(disposition, `${native}/${difficulty} disposes of the actual emitted captive`);
        game = act(game, 'harkonnen', disposition);
      }
      game = advance(game, state => !state.battle && clean(state));
      assert.equal(skillCount(game, 'warmaster'), 1);
      assert.deepEqual(inventory(game), f.original);
    }
  }
});
