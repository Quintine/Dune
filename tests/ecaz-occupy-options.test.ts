import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { controlsLeader } from '../game/leader-control';
import { pinDeterministicRandom } from './deterministic-random';
import {
  ecazOccupyDialChoices,
  ecazOccupyLeadOptions,
  ecazOccupyOwnProfile,
  ecazOccupyPlanControl,
  ecazOccupyPolicyActions,
} from '../game/ecaz-occupy-options';
import {
  cancelEcazOccupy,
  chooseEcazOccupyLead,
  ecazOccupyFixture,
  openEcazOccupyPlans,
} from './fixture-ecaz-occupy';

void test('Ecaz can choose either real plan owner; other seats cannot choose the lead', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
  const own = viewGame(fixture.game, fixture.ecaz);
  const choices = ecazOccupyLeadOptions(own);
  assert.deepEqual(choices.map((choice) => choice.lead), [fixture.ecaz, fixture.ally]);
  for (const choice of choices) {
    assert.equal(choice.blocked, null);
    const game = applyAction(fixture.game, fixture.ecaz, choice.action);
    const selected = ecazOccupyOwnProfile(viewGame(game, choice.lead));
    assert.equal(selected?.planOwner, choice.lead);
    assert.equal(selected?.payer, choice.lead);
    assert.equal(selected?.forceOwner, fixture.ally);
    assert.equal(selected?.fixedEcazDial, 2);
    assert.equal(ecazOccupyOwnProfile(viewGame(game, fixture.opponent)), null);
  }
  const outsider = viewGame(fixture.game, fixture.ally);
  assert.ok(ecazOccupyLeadOptions(outsider).every((choice) => !!choice.blocked));
  assert.deepEqual(ecazOccupyPolicyActions(outsider), []);
  for (const choice of choices)
    assert.throws(() => applyAction(fixture.game, fixture.ally, choice.action));
});

void test('free fixed Ecaz strength is mandatory and cannot borrow the other ally’s spice', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
  const game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, 'ecaz'));
  // Labelled Spice Bank budget staging: no allied credit or force property changes.
  game.players.find((player) => player.id === fixture.ecaz)!.spice = 0;
  game.players.find((player) => player.id === fixture.ally)!.spice = 30;
  const view = viewGame(game, fixture.ecaz);
  const choices = ecazOccupyDialChoices(view);
  assert.ok(choices.some((choice) => choice.dial === 2 && choice.support === 0));
  assert.ok(choices.some((choice) => choice.dial === 2.5 && choice.support === 0));
  assert.ok(choices.every((choice) => choice.support === 0 && choice.dial >= 2));
  assert.equal(ecazOccupyPlanControl(view, 2, 0)?.blocked, null);
  assert.ok(ecazOccupyPlanControl(view, 1.5, 0)?.blocked);
  assert.ok(ecazOccupyPlanControl(view, 3, 1)?.blocked);
  assert.deepEqual(ecazOccupyDialChoices(viewGame(game, fixture.ally)), []);
  const me = view.players.find((player) => player.id === view.me)!;
  const leader = me.leaders.find((entry) => !entry.dead && controlsLeader(me, entry) &&
    (!entry.usedAt || entry.usedAt === fixture.territory))!;
  assert.ok(leader);
  const next = applyAction(game, fixture.ecaz, {
    type: 'battlePlan', dial: 2.5, support: 0, leader: leader.id,
    weapon: null, defense: null, kwisatz: false,
  });
  assert.equal(next.battle?.plans[fixture.ecaz].dial, 2.5);
  assert.equal(next.battle?.plans[fixture.ecaz].support, 0);
  assert.equal(next.players.find((player) => player.id === fixture.ecaz)?.spice, 0);
  assert.equal(next.players.find((player) => player.id === fixture.ally)?.spice, 30);
});

void test('native Karama keeps either selected lead but replaces the active combined dial with their own army', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
    const game = openEcazOccupyPlans(cancelEcazOccupy(fixture, lead));
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const view = viewGame(game, actor);
    const control = ecazOccupyPlanControl(view, 0, 0)!;
    assert.equal(control.profile.canceled, true);
    assert.equal(control.profile.planOwner, actor);
    assert.equal(control.profile.forceOwner, actor);
    assert.equal(control.minimum, 0);
    assert.equal(control.fixedEcazDial, 0);
    assert.equal(control.maximum, lead === 'ecaz' ? 3 : 4);
    assert.equal(control.blocked, null);
    assert.ok(ecazOccupyDialChoices(view).some((choice) => choice.dial === 0 && choice.support === 0));
    assert.ok(ecazOccupyPlanControl(view, control.maximum + 0.5, 0)?.blocked);
    if (lead === 'ecaz') assert.ok(ecazOccupyPlanControl(view, 4, 3)?.blocked);
  }
});

void test('typed Fremen and Emperor variable armies retain native legal increments and support', () => {
  const fremen = ecazOccupyFixture({ allyFaction: 'fremen', ecazForces: 3 });
  const fremenGame = openEcazOccupyPlans(chooseEcazOccupyLead(fremen, 'ecaz'));
  const fremenView = viewGame(fremenGame, fremen.ecaz);
  const free = ecazOccupyDialChoices(fremenView);
  assert.ok(free.some((choice) => choice.variableDial === 6 && choice.dial === 8));
  assert.ok(free.every((choice) => choice.support === 0 && Number.isInteger(choice.variableDial)));
  assert.ok(ecazOccupyPlanControl(fremenView, 2.5, 0)?.blocked);
  assert.ok(ecazOccupyPlanControl(fremenView, 3, 1)?.blocked);
  const emperor = ecazOccupyFixture({ allyFaction: 'emperor', ecazForces: 3 });
  const emperorGame = openEcazOccupyPlans(chooseEcazOccupyLead(emperor, 'ecaz'));
  const emperorView = viewGame(emperorGame, emperor.ecaz);
  const paid = ecazOccupyDialChoices(emperorView);
  assert.ok(paid.some((choice) => choice.variableDial === 0.5 && choice.support === 0));
  assert.ok(paid.some((choice) => choice.variableDial === 6 && choice.support === 4));
  assert.equal(ecazOccupyPlanControl(emperorView, 8, 4)?.blocked, null);
});

void test('all four native policies finish Occupy planning through optional powers for either lead, active or canceled', (t) => {
  pinDeterministicRandom(t, 8);
  for (const lead of ['ecaz', 'ally'] as const) for (const canceled of [false, true]) {
    const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
    const game = openEcazOccupyPlans(canceled
      ? cancelEcazOccupy(fixture, lead) : chooseEcazOccupyLead(fixture, lead));
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    for (const policy of DIFFICULTIES) {
      let state = structuredClone(game);
      for (let step = 0; step < 4; step++) {
        const view = viewGame(state, actor);
        view.players.find((player) => player.id === actor)!.bot = policy;
        const actions = botActions(view);
        const action = actions[0];
        assert.ok(action, `${policy}/${lead}/${canceled}: planning must retain a legal continuation`);
        if (action.type === 'battlePlan')
          assert.equal(ecazOccupyPlanControl(view, Number(action.dial), Number(action.support ?? 0))?.blocked, null);
        state = applyAction(state, actor, action);
        if (viewGame(state, actor).battle?.submitted.includes(actor)) break;
      }
      assert.ok(viewGame(state, actor).battle?.submitted.includes(actor),
        `${policy}/${lead}/${canceled}: optional powers must finish and the selected lead must seal a plan`);
    }
  }
});
