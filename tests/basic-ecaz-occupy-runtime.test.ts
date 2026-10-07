import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES, location as locationKey } from '../game/board';
import { ecazOccupyDialChoices, ecazOccupyPlanControl } from '../game/ecaz-occupy-options';
import { advanceToNextStorm, finishToMovement } from './fixture-advanced-source';
import { chooseEcazOccupyLead, cancelEcazOccupy, openEcazOccupyPlans,
  ecazOccupyTerritoryForces, stageEcazOccupyCard, allowEcazOccupyResponses,
  type EcazOccupyFixture } from './fixture-ecaz-occupy';
import { basicEcazOccupyFixture } from './fixture-basic-ecaz-occupy';

const seat = (game: Game, id: string): Player => game.players.find(p => p.id === id)!;
const forces = (game: Game, fixture: EcazOccupyFixture, id: string) =>
  ecazOccupyTerritoryForces(game, id, fixture.territory);
const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function leader(game: Game, id: string, strongest: boolean): string {
  return seat(game, id).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0].id;
}
function reject(game: Game, actor: string, action: Parameters<typeof applyAction>[2]): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected native action cannot commit any part of the battle.');
}

/** Exchange an existing physical Traitor Card, preserving the native deck. */
function holdTraitor(game: Game, owner: string, identity: string): void {
  const receiver = seat(game, owner);
  if (receiver.traitors.includes(identity)) return;
  const reserve = game.traitorReserve ?? [];
  const index = reserve.indexOf(identity);
  if (index >= 0) {
    reserve[index] = receiver.traitors[0];
    receiver.traitors[0] = identity;
  } else {
    const donor = game.players.find(p => p.traitors.includes(identity));
    assert.ok(donor, 'The chosen leader must have a real physical Traitor Card.');
    const donorIndex = donor.traitors.indexOf(identity);
    donor.traitors[donorIndex] = receiver.traitors[0];
    receiver.traitors[0] = identity;
  }
}

function aftermath(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (game.response) game = allowEcazOccupyResponses(game);
    else if (game.decision?.kind === 'battleLosses')
      game = applyAction(game, game.decision.player, { type: 'decision', choice: 0 });
    else if (game.decision?.kind === 'battleCards')
      game = applyAction(game, game.decision.player, { type: 'decision', discard: [] });
    else if (game.pendingTreacheryDiscard)
      game = applyAction(game, game.players[0].id, { type: 'advanceBots' });
    else return game;
  }
  throw new Error('The original Basic battle aftermath did not finish.');
}

function resolve(fixture: EcazOccupyFixture, lead: 'ecaz' | 'ally', options: {
  outcome?: 'win' | 'loss' | 'traitor' | 'mutualTraitors' | 'explosion'; canceled?: boolean;
} = {}): { game: Game; before: Game; actor: string } {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const outcome = options.outcome ?? 'win';
  let game = options.canceled ? cancelEcazOccupy(fixture, lead) : chooseEcazOccupyLead(fixture, lead);
  game = openEcazOccupyPlans(game);
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  const voter = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
  let ownLeader = leader(game, actor, outcome !== 'loss');
  const opponentLeader = leader(game, fixture.opponent, outcome === 'loss');
  if (outcome === 'traitor' || outcome === 'mutualTraitors') {
    holdTraitor(game, voter, opponentLeader);
    if (outcome === 'mutualTraitors') {
      const physical = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors)];
      ownLeader = seat(game, actor).leaders.find(l => !l.dead && !l.usedAt && physical.includes(l.id))!.id;
      holdTraitor(game, fixture.opponent, ownLeader);
    }
  }
  const weapon = outcome === 'explosion' ? stageEcazOccupyCard(game, actor, c => c.kind === 'lasgun') : undefined;
  const defense = outcome === 'explosion' ? stageEcazOccupyCard(game, fixture.opponent, c => c.kind === 'shield') : undefined;
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + (outcome === 'loss' ? 0 : 2),
    support: 0, leader: ownLeader, ...(weapon ? { weapon } : {}) });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: outcome === 'loss' ? 8 : 0,
    support: 0, leader: opponentLeader, ...(defense ? { defense } : {}) });
  for (let attempt = 0; attempt < 10 && game.battle; attempt++) {
    const battle = viewGame(game, actor).battle!;
    const next = battle.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!next) break;
    const call = next === voter && ['traitor', 'mutualTraitors'].includes(outcome) ||
      next === fixture.opponent && outcome === 'mutualTraitors';
    game = applyAction(game, next, { type: 'traitorCall', call });
  }
  game = aftermath(game);
  assert.equal(game.battle, null, 'One original combined battle must retire, not duplicate a second fight.');
  return { game, before, actor };
}

for (const ecazForces of [2, 4]) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic E${ecazForces} ${lead} lead: free full-strength commitment and equal Ecaz loss/survival`, () => {
    const fixture = basicEcazOccupyFixture({ ecazForces });
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const pending = reload(fixture.game); // Only an actual pending lead decision is resumed.
    const prepared = openEcazOccupyPlans(chooseEcazOccupyLead({ ...fixture, game: pending }, lead));
    const view = viewGame(prepared, actor);
    const profile = view.battle!.ecazOccupy!.profile!;
    assert.equal(profile.fixedEcazDial, ecazForces / 2);
    assert.equal(profile.forceOwner, fixture.ally);
    assert.equal(profile.maxDial, ecazForces / 2 + 4);
    assert.equal(profile.maxSupport, 0);
    assert.equal(ecazOccupyPlanControl(view, ecazForces / 2 + 2, 0)!.blocked, null);
    assert.notEqual(ecazOccupyPlanControl(view, ecazForces / 2 + 2, 1)!.blocked, null);
    const { game, before } = resolve(fixture, lead);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(forces(game, fixture, fixture.ecaz), ecazForces / 2);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, ecazForces / 2);
    assert.equal(forces(game, fixture, fixture.ally), 2);
    assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, 2);
    assert.equal(forces(game, fixture, fixture.opponent), 0);
    for (const id of [fixture.ecaz, fixture.ally]) assert.equal(seat(game, id).spice, seat(before, id).spice);
    assert.equal(game.phase, 7, 'Surviving allies coexist into original Collection without resettlement.');
  });

for (const allyFaction of ['emperor', 'fremen'] as const) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic ${allyFaction} ${lead} lead uses native ordinary inventory without Advanced elite strength`, () => {
    const fixture = basicEcazOccupyFixture({ allyFaction, ecazForces: 4 });
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const prepared = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
    const profile = viewGame(prepared, actor).battle!.ecazOccupy!.profile!;
    assert.equal(profile.maxDial, 6, 'Four real Basic ordinary forces provide four variable strength.');
    const { game, before } = resolve(fixture, lead);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(forces(game, fixture, fixture.ally), 2);
    assert.equal(seat(game, actor).spice, seat(before, actor).spice);
  });

for (const outcome of ['loss', 'traitor', 'mutualTraitors', 'explosion'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Basic ${outcome} with ${lead} lead settles both physical armies through original handlers`, () => {
      const fixture = basicEcazOccupyFixture({ ecazForces: 4 });
      const { game, before, actor } = resolve(fixture, lead, { outcome });
      assert.equal(game.lastBattleContext!.result, outcome === 'loss' ? 'normal' : outcome);
      assert.equal(game.lastBattleContext!.winner, outcome === 'traitor' ? actor : outcome === 'loss' ? fixture.opponent : null);
      for (const [id, count] of [[fixture.ecaz, 4], [fixture.ally, 4]] as const) {
        assert.equal(forces(game, fixture, id), outcome === 'traitor' ? count : 0);
        assert.equal(seat(game, id).tanks - seat(before, id).tanks, outcome === 'traitor' ? 0 : count);
        const bounty = outcome === 'traitor' && id === actor
          ? seat(before, fixture.opponent).leaders.find(l => l.id === leader(before, fixture.opponent, false))!.strength : 0;
        assert.equal(seat(game, id).spice - seat(before, id).spice, bounty,
          'Basic support is free while the original defeated-leader bounty still belongs to the lead.');
      }
    });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic printed Karama after ${lead} lead permits only that lead's own free ordinary dial`, () => {
    const fixture = basicEcazOccupyFixture({ ecazForces: 4 });
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const canceled = cancelEcazOccupy(fixture, lead);
    const prepared = openEcazOccupyPlans(canceled);
    const profile = viewGame(prepared, actor).battle!.ecazOccupy!.profile!;
    assert.equal(profile.canceled, true);
    assert.equal(profile.fixedEcazDial, 0);
    assert.equal(profile.forceOwner, actor);
    assert.equal(profile.maxDial, 4);
    const { game, before } = resolve(fixture, lead, { canceled: true });
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(forces(game, fixture, fixture.ecaz), lead === 'ecaz' ? 2 : 4);
    assert.equal(forces(game, fixture, fixture.ally), lead === 'ally' ? 2 : 4);
    assert.equal(seat(game, actor).spice, seat(before, actor).spice);
    assert.equal(seat(game, fixture.ecaz).ally, fixture.ally);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic ${lead} lead owns printed plan cards and its original aftermath discard`, () => {
    const fixture = basicEcazOccupyFixture();
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    const shield = stageEcazOccupyCard(fixture.game, actor, card => card.kind === 'shield');
    let game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
    const nonLeadHand = structuredClone(seat(game, nonLead).hand);
    reject(game, nonLead, { type: 'battlePlan', dial: 4, support: 0,
      leader: leader(game, nonLead, true), defense: shield });
    game = applyAction(game, actor, { type: 'battlePlan', dial: 4, support: 0,
      leader: leader(game, actor, true), defense: shield });
    game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0,
      leader: leader(game, fixture.opponent, false) });
    for (const voter of viewGame(game, actor).battle!.traitorVoters)
      game = applyAction(game, voter, { type: 'traitorCall', call: false });
    assert.equal(game.decision?.kind, 'battleCards');
    assert.equal(game.decision!.player, actor);
    const pending = reload(game);
    game = applyAction(pending, actor, { type: 'decision', discard: [shield] });
    game = aftermath(game);
    assert.ok(game.discard.some(card => card.id === shield));
    assert.ok(!seat(game, actor).hand.some(card => card.id === shield));
    assert.deepEqual(seat(game, nonLead).hand, nonLeadHand);
    assert.equal(game.phase, 7);
  });


for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Basic ${difficulty} policy selects ${lead} and seals a legal actual-owner plan`, () => {
      const fixture = basicEcazOccupyFixture();
      const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
      const leadView = viewGame(fixture.game, fixture.ecaz);
      leadView.players.find(p => p.id === fixture.ecaz)!.bot = difficulty;
      const choose = botActions(leadView).find(a => a.type === 'decision' && a.lead === actor);
      assert.ok(choose, 'Every policy must retain both legal native lead choices.');
      let game = openEcazOccupyPlans(applyAction(fixture.game, fixture.ecaz, choose));
      const view = viewGame(game, actor);
      view.players.find(p => p.id === actor)!.bot = difficulty;
      const plan = botActions(view).find(a => a.type === 'battlePlan');
      assert.ok(plan, 'The actual lead must receive a sealable native candidate.');
      assert.ok(ecazOccupyDialChoices(view).some(c => c.dial === plan.dial && c.support === (plan.support ?? 0)));
      assert.equal(ecazOccupyPlanControl(view, Number(plan.dial), Number(plan.support ?? 0))!.blocked, null);
      game = applyAction(game, actor, plan);
      assert.ok(game.battle!.plans[actor], 'The selected lead, not the force owner, owns the sealed plan.');
      const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
      assert.equal(game.battle!.plans[nonLead], undefined);
      game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0,
        leader: leader(game, fixture.opponent, false) });
      for (const voter of viewGame(game, actor).battle!.traitorVoters)
        game = applyAction(game, voter, { type: 'traitorCall', call: false });
      game = aftermath(game);
      assert.equal(game.battle, null);
      assert.equal(game.phase, 7, 'The policy-generated real battle must continue into native Collection.');
    });

void test('Basic city survivors get no city income; shared Collection resumes once at its actual decision', () => {
  const city = basicEcazOccupyFixture({ territory: 'arrakeen' });
  const cityResult = resolve(city, 'ecaz');
  assert.equal(cityResult.game.phase, 7);
  for (const id of [city.ecaz, city.ally])
    assert.equal(seat(cityResult.game, id).spice, seat(cityResult.before, id).spice,
      'Basic Arrakeen grants no Advanced two-spice city income.');
  assert.equal(forces(cityResult.game, city, city.ecaz), 2);
  assert.equal(forces(cityResult.game, city, city.ally), 2);

  const desert = basicEcazOccupyFixture();
  // Controlled bank-funded physical spice after native setup; not a collection receipt.
  desert.game.spice[desert.location] = 5;
  const resolution = resolve(desert, 'ally');
  const before = resolution.before;
  let game = resolution.game;
  assert.equal(game.decision?.kind, 'ecazSpice');
  assert.equal(game.spice[desert.location], 0);
  const pending = reload(game); // Resume only the actual allocation decision.
  game = applyAction(pending, pending.decision!.player,
    { type: 'decision', event: pending.ecazCollection!.event, allocation: { kind: 'equal' } });
  assert.equal(game.decision, null);
  assert.equal(game.ecazCollection!.stage, 'complete');
  assert.equal(seat(game, desert.ecaz).spice - seat(before, desert.ecaz).spice, 2);
  assert.equal(seat(game, desert.ally).spice - seat(before, desert.ally).spice, 3);
  assert.equal(game.ecazCollection!.settled.length, 1);
  reject(game, pending.decision!.player,
    { type: 'decision', event: pending.ecazCollection!.event, allocation: { kind: 'equal' } });
});

void test('Basic reciprocal coalition coexists in three shared strongholds and wins through original Mentat', () => {
  const fixture = basicEcazOccupyFixture();
  let game = resolve(fixture, 'ecaz').game;
  game = finishToMovement(advanceToNextStorm(game));
  // Conserved controlled board after the next genuine Storm; no alliance,
  // victory decision, phase or reserve identity is manufactured.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
  }
  const cities = TERRITORIES.filter(t => t.type === 'stronghold' &&
    t.sectors.some(sector => sector !== game.storm)).slice(0, 3).map(t => t.id);
  assert.equal(cities.length, 3, 'Three original strongholds remain outside the actual Storm.');
  for (const city of cities) {
    const sector = TERRITORIES.find(t => t.id === city)!.sectors.find(s => s !== game.storm)!;
    assert.ok(sector !== undefined);
    for (const id of [fixture.ecaz, fixture.ally]) {
      seat(game, id).reserves--;
      seat(game, id).forces[locationKey(city, sector)] = 1;
    }
  }
  const progress = viewGame(game, fixture.ecaz).victoryProgress.find(p => p.player === fixture.ecaz)!;
  assert.deepEqual([...progress.jointlyOccupied].sort(), [...cities].sort());
  assert.equal(progress.qualifies, true);
  while (game.phase === 5) {
    game = allowEcazOccupyResponses(game);
    game = applyAction(game, game.active!, { type: 'endMovement' });
  }
  assert.equal(game.phase, 7, 'Shared allied cities must not produce spurious coalition battles.');
  for (let attempt = 0; attempt < 50 && game.status === 'playing'; attempt++) {
    game = allowEcazOccupyResponses(game);
    const actor = game.players.find(p => !game.ready.includes(p.id))!.id;
    game = applyAction(game, actor, { type: 'ready' });
  }
  assert.equal(game.status, 'finished');
  assert.deepEqual([...game.winner].sort(), [fixture.ecaz, fixture.ally].sort());
});
