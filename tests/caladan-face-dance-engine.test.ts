import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actCaladanFaceDance, caladanFaceDanceInventory, caladanFaceDancePhysical,
  caladanFaceDancePlayer as player, caladanFaceDancePopulation, createCaladanFaceDanceFixture,
  faceDanceCaladanFaceDance, finishCaladanFaceDance, reinforceCaladanFaceDance,
  type CaladanFaceDanceFixture,
} from './fixture-caladan-face-dance';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actCaladanFaceDance(game, actor, action));
  assert.deepEqual(game, before);
}
function source(f: CaladanFaceDanceFixture) {
  assert.equal(f.game.status, 'playing');
  assert.equal(f.game.turn, f.beforeBattle.turn);
  assert.equal(f.game.phase, 6);
  assert.deepEqual(f.game.expansions, ['ix']);
  assert.ok(f.game.homeworlds?.custody);
  assert.ok(!f.game.nexusCards && !f.game.leaderSkills && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.ok(f.game.decision?.kind === 'caladanReinforcement');
  assert.equal(f.game.decision.player, f.owner);
  assert.equal(f.game.decision.event, f.event);
  assert.equal(f.game.response ?? null, null);
  assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.game.pendingFaceDance!.player, f.dancer);
  assert.equal(f.game.pendingFaceDance!.winner, f.owner);
  assert.equal(f.game.pendingFaceDance!.identity, f.leader);
  assert.equal(f.game.homeworldVictoryReinforcement!.stage, 'choice');
  assert.equal(f.game.homeworldVictoryReinforcement!.offer!.blocked, null);
  assert.equal(f.game.homeworldVictoryReinforcement!.offer!.population, 6);
  assert.equal(f.game.homeworldVictoryReinforcement!.offer!.survivors, 10);
  assert.equal(caladanFaceDancePopulation(f.afterSetup), 10);
  assert.equal(caladanFaceDancePopulation(f.game), 6);
  assert.equal(player(f.game, f.owner).forces[f.location], 10);
  assert.equal(player(f.game, f.owner).forces['polar_sink:0'], 4);
  assert.equal(player(f.game, f.dancer).reserves, 20);
  assert.equal(f.shipments.length, 2);
  assert.equal(f.shipments[0].step.actor, f.owner);
  assert.equal(f.shipments[0].step.action.amount, 4);
  assert.equal(f.shipments[0].step.action.territory, 'polar_sink');
  assert.ok(f.shipments[0].step.action.homeworldSources);
  assert.equal(f.shipments[1].step.actor, f.opponent);
  assert.equal(f.shipments[1].step.action.amount, 1);
  assert.equal(f.shipments[1].step.action.territory, f.territory);
  assert.ok(player(f.afterSetup, f.dancer).faceDancers!.some(card => card.leader === f.leader && !card.revealed));
  assert.ok(!player(f.game, f.owner).leaders.find(leader => leader.id === f.leader)!.dead);
  assert.equal(f.game.lastBattleContext!.winner, f.owner);
  assert.equal(f.game.lastBattleContext!.event, f.event);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(caladanFaceDanceInventory(f.game), f.originalInventory);
}
function completedGrant(f: CaladanFaceDanceFixture, game: Game, give: boolean) {
  assert.equal(game.homeworldVictoryReinforcement!.event, f.event);
  assert.equal(game.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(game.homeworldVictoryReinforcement!.destination, give ? f.destination : 'decline');
  assert.equal(game.lastBattleContext!.caladanReinforcement!.event, f.event);
  assert.equal(game.lastBattleContext!.caladanReinforcement!.completed, true);
}

for (const advanced of [false, true]) {
  for (const give of [true, false]) for (const reveal of [true, false]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} native Caladan ${give ? 'reinforces before' : 'declines before'} Face Dance ${reveal ? 'reveal' : 'decline'}`, () => {
      const f = createCaladanFaceDanceFixture({ advanced });
      source(f);
      let game = reinforceCaladanFaceDance(f, structuredClone(f.game), give);
      const amount = give ? 11 : 10;
      assert.equal(game.decision?.kind, 'faceDance');
      assert.deepEqual(game.pendingFaceDance, f.originalFaceDance);
      assert.equal(player(game, f.owner).forces[f.location], amount);
      assert.equal(caladanFaceDancePopulation(game), give ? 5 : 6);
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
      assert.equal(player(game, f.owner).shipped, player(f.game, f.owner).shipped);
      assert.equal(player(game, f.owner).moved, player(f.game, f.owner).moved);
      completedGrant(f, game, give);
      rejected(game, f.owner, f.action);
      rejected(game, f.dancer, { type: 'decision', reveal: true, sources: { reserves: amount + 1 }, sector: 10 });
      const beforeDance = structuredClone(game);
      game = faceDanceCaladanFaceDance(f, game, reveal);
      assert.equal(player(game, f.owner).spice, player(beforeDance, f.owner).spice);
      assert.equal(player(game, f.dancer).spice, player(beforeDance, f.dancer).spice);
      // Later collection may pay the original or replacement stronghold owner.
      game = finishCaladanFaceDance(f, game);
      completedGrant(f, game, give);
      assert.equal(game.pendingFaceDance ?? null, null);
      assert.notEqual(game.decision?.kind, 'caladanReinforcement');
      assert.notEqual(game.decision?.kind, 'faceDance');
      assert.equal(player(game, f.owner).forces['polar_sink:0'], 4);
      if (reveal) {
        assert.equal(player(game, f.owner).forces[f.location] ?? 0, 0);
        assert.equal(player(game, f.dancer).forces[f.location], amount);
        assert.equal(player(game, f.dancer).reserves, player(beforeDance, f.dancer).reserves - amount);
        assert.equal(caladanFaceDancePopulation(game), 16,
          'All live winning counters, including the granted one, return to the same native Caladan pool');
        assert.equal(player(game, f.owner).leaders.find(leader => leader.id === f.leader)!.dead, true);
        assert.equal(player(game, f.owner).leaders.find(leader => leader.id === f.leader)!.deaths,
          player(f.game, f.owner).leaders.find(leader => leader.id === f.leader)!.deaths + 1);
        assert.equal(player(game, f.dancer).faceDancers!.filter(card => card.leader === f.leader && card.revealed).length, 1);
      } else {
        assert.equal(player(game, f.owner).forces[f.location], amount);
        assert.equal(player(game, f.dancer).forces[f.location] ?? 0, 0);
        assert.equal(player(game, f.dancer).reserves, 20);
        assert.equal(caladanFaceDancePopulation(game), give ? 5 : 6);
        assert.equal(player(game, f.owner).leaders.find(leader => leader.id === f.leader)!.dead, false);
        assert.ok(player(game, f.dancer).faceDancers!.some(card => card.leader === f.leader && !card.revealed));
      }
      rejected(game, f.owner, f.action);
      assert.deepEqual(caladanFaceDanceInventory(game), f.originalInventory);
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} native Caladan pending Face Dance rejects stale, foreign and early reveal choices`, () => {
    const f = createCaladanFaceDanceFixture({ advanced });
    source(f);
    rejected(f.game, f.dancer, f.action);
    rejected(f.game, f.opponent, f.action);
    rejected(f.game, f.owner, { ...f.action, event: 'stale' });
    rejected(f.game, f.owner, { ...f.action, amount: 2 });
    rejected(f.game, f.dancer, { type: 'decision', reveal: true, sources: { reserves: 11 }, sector: 10 });
    assert.deepEqual(caladanFaceDancePhysical(f.game), f.originalPhysical);
    assert.deepEqual(f.game.pendingFaceDance, f.originalFaceDance);
    assert.equal(f.game.homeworldVictoryReinforcement!.stage, 'choice');
    assert.deepEqual(caladanFaceDanceInventory(f.game), f.originalInventory);
  });
}

void test('four minimal profiles choose the real Caladan reinforcement and native Face Dance without a second grant', () => {
  for (const advanced of [false, true]) {
    const f = createCaladanFaceDanceFixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      const ownerView = viewGame(f.game, f.owner);
      ownerView.players.find(seat => seat.id === f.owner)!.bot = difficulty;
      const reinforcement = botActions(ownerView)[0];
      assert.deepEqual(reinforcement, f.action, `${advanced}/${difficulty} reinforces the actual surviving army`);
      let game = actCaladanFaceDance(structuredClone(f.game), f.owner, reinforcement);
      assert.equal(player(game, f.owner).forces[f.location], 11);
      assert.equal(game.decision?.kind, 'faceDance');
      const dancerView = viewGame(game, f.dancer);
      dancerView.players.find(seat => seat.id === f.dancer)!.bot = difficulty;
      const dance = botActions(dancerView)[0];
      assert.ok(dance);
      assert.equal(dance.type, 'decision');
      assert.equal(dance.reveal, true);
      assert.deepEqual(dance.sources, { reserves: 11 });
      game = actCaladanFaceDance(game, f.dancer, dance);
      game = finishCaladanFaceDance(f, game);
      assert.equal(player(game, f.dancer).forces[f.location], 11);
      assert.equal(caladanFaceDancePopulation(game), 16);
      completedGrant(f, game, true);
      assert.deepEqual(caladanFaceDanceInventory(game), f.originalInventory);
    }
  }
});
