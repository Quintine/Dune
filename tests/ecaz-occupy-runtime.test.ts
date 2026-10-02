import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import { botActions } from '../game/bots';
import { ecazOccupyFixture, chooseEcazOccupyLead, cancelEcazOccupy, openEcazOccupyPlans,
  stageEcazOccupyCard, ecazOccupyTerritoryForces, settleEcazOccupyArrival, type EcazOccupyFixture } from './fixture-ecaz-occupy';
import { advanceToNextStorm, finishToMovement } from './fixture-advanced-source';

const seat = (game: Game, id: string): Player => game.players.find(p => p.id === id)!;
const forces = (game: Game, fixture: EcazOccupyFixture, id: string) =>
  ecazOccupyTerritoryForces(game, id, fixture.territory);
function availableLeader(game: Game, id: string, strongest: boolean): string {
  const leaders = seat(game, id).leaders.filter(l => !l.dead && !l.usedAt);
  return leaders.sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0].id;
}
/** A labelled physical Traitor Card exchange; no fabricated card or call. */
function holdTraitor(game: Game, owner: string, identity: string): void {
  const receiver = seat(game, owner);
  if (receiver.traitors.includes(identity)) return;
  const reserve = game.traitorReserve ?? [];
  const index = reserve.indexOf(identity);
  if (index >= 0) {
    reserve[index] = receiver.traitors[0];
    receiver.traitors[0] = identity;
    return;
  }
  const donor = game.players.find(p => p.traitors.includes(identity));
  assert.ok(donor, 'The requested physical Traitor Card must exist outside the loyalty exclusion.');
  const donorIndex = donor.traitors.indexOf(identity);
  donor.traitors[donorIndex] = receiver.traitors[0];
  receiver.traitors[0] = identity;
}
function traitorableLeader(game: Game, id: string): string {
  const physical = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors)];
  const leader = seat(game, id).leaders.find(l => !l.dead && !l.usedAt && physical.includes(l.id));
  assert.ok(leader, 'A real non-loyal leader must have a physical Traitor Card.');
  return leader.id;
}
function finishAftermath(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (game.response) {
      game = applyAction(game, game.players.find(p => !game.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' });
    } else if (game.decision?.kind === 'battleLosses') {
      game = applyAction(game, game.decision.player, { type: 'decision', choice: 0 });
    } else if (game.decision?.kind === 'battleCards') {
      game = applyAction(game, game.decision.player, { type: 'decision', discard: [] });
    } else if (game.pendingTreacheryDiscard) {
      game = applyAction(game, game.players[0].id, { type: 'advanceBots' });
    } else return game;
  }
  throw new Error('The native battle aftermath did not complete.');
}
function resolve(fixture: EcazOccupyFixture, lead: 'ecaz' | 'ally', options: {
  outcome?: 'win' | 'loss' | 'soleTraitor' | 'mutualTraitors' | 'explosion';
  typed?: boolean; canceled?: boolean;
} = {}): { game: Game; actor: string; before: Game } {
  const outcome = options.outcome ?? 'win';
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  let game = options.canceled ? cancelEcazOccupy(fixture, lead) : chooseEcazOccupyLead(fixture, lead);
  game = openEcazOccupyPlans(game);
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  const fixed = profile.fixedEcazDial;
  const free = seat(game, profile.forceOwner).faction === 'fremen';
  const variable = outcome === 'loss' ? 0 : options.typed ? profile.maxDial - fixed : 2;
  const support = free ? 0 : options.typed ? 4 : variable;
  let ownLeader = availableLeader(game, actor, outcome !== 'loss');
  const opponentLeader = availableLeader(game, fixture.opponent, outcome === 'loss');
  const voter = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
  if (outcome === 'soleTraitor' || outcome === 'mutualTraitors') {
    holdTraitor(game, voter, opponentLeader);
    if (outcome === 'mutualTraitors') {
      ownLeader = traitorableLeader(game, actor);
      holdTraitor(game, fixture.opponent, ownLeader);
    }
  }
  const weapon = outcome === 'explosion' ? stageEcazOccupyCard(game, actor, c => c.kind === 'lasgun') : undefined;
  const defense = outcome === 'explosion' ? stageEcazOccupyCard(game, fixture.opponent, c => c.kind === 'shield') : undefined;
  game = applyAction(game, actor, { type: 'battlePlan', dial: fixed + variable,
    support, leader: ownLeader, ...(weapon ? { weapon } : {}) });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: outcome === 'loss' ? 8 : 0,
    support: outcome === 'loss' ? 8 : 0, leader: opponentLeader, ...(defense ? { defense } : {}) });
  for (let attempt = 0; attempt < 10 && game.battle; attempt++) {
    const view = viewGame(game, actor).battle!;
    const next = view.traitorVoters.find(id => !view.traitorSubmitted.includes(id));
    if (!next) break;
    const call = next === voter && ['soleTraitor', 'mutualTraitors'].includes(outcome) ||
      next === fixture.opponent && outcome === 'mutualTraitors';
    game = applyAction(game, next, { type: 'traitorCall', call });
  }
  game = finishAftermath(game);
  assert.equal(game.battle, null, 'The actual battle must resolve once, not remain a sealed-plan scaffold.');
  assert.equal(game.decision, null, 'The actual native casualty and card aftermath must finish.');
  return { game, actor, before };
}

// Keep the first source arithmetic case independently runnable before the batch.
void test('Advanced Occupy E1 Ecaz lead contributes one free strength and has no Ecaz survivor', () => {
  const fixture = ecazOccupyFixture({ ecazForces: 1, allyFaction: 'guild' });
  const { game, actor, before } = resolve(fixture, 'ecaz');
  assert.equal(game.lastBattleContext!.winner, actor);
  assert.equal(forces(game, fixture, fixture.ecaz), 0);
  assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, 1);
  assert.equal(forces(game, fixture, fixture.ally), 2);
  assert.equal(seat(before, actor).spice - seat(game, actor).spice, 2,
    'Only the actual ally commitment costs the selected lead spice.');
  assert.equal(forces(game, fixture, fixture.opponent), 0);
});

for (const ecazForces of [1, 2, 3, 4, 5]) for (const lead of ['ecaz', 'ally'] as const)
  for (const order of ['ecaz-first', 'ally-first', 'opponent-first'] as const) {
    if (ecazForces === 1 && lead === 'ecaz' && order === 'ecaz-first') continue;
    void test(`Advanced Occupy E${ecazForces}, ${lead} lead, ${order}: floor survivors and original payer`, () => {
      const fixture = ecazOccupyFixture({ ecazForces, allyFaction: 'guild', order });
      const expectedOrder = order === 'ecaz-first' ? [fixture.ecaz, fixture.ally, fixture.opponent] :
        order === 'ally-first' ? [fixture.ally, fixture.opponent, fixture.ecaz] : [fixture.opponent, fixture.ecaz, fixture.ally];
      assert.deepEqual(fixture.game.order, expectedOrder, 'Printed circles must create the requested real order.');
      const { game, actor, before } = resolve(fixture, lead);
      const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
      assert.equal(game.lastBattleContext!.winner, actor);
      assert.equal(forces(game, fixture, fixture.ecaz), Math.floor(ecazForces / 2));
      assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, Math.ceil(ecazForces / 2));
      assert.equal(forces(game, fixture, fixture.ally), 2);
      assert.equal(seat(before, actor).spice - seat(game, actor).spice, 2);
      assert.equal(seat(before, nonLead).spice, seat(game, nonLead).spice);
      assert.deepEqual(seat(game, nonLead).hand, seat(before, nonLead).hand);
      assert.ok(game.phase >= 7, 'The one collapsed coalition battle continues to native collection.');
    });
  }
for (const lead of ['ecaz', 'ally'] as const)
  void test(`Selected ${lead} lead retains its actual ordinary tie position, not the coalition chooser's position`, () => {
    const fixture = ecazOccupyFixture({ ecazForces: 1, allyFaction: 'guild', order: 'ally-first' });
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    let game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
    const own = seat(game, actor).leaders.find(l => !l.dead &&
      seat(game, fixture.opponent).leaders.some(other => !other.dead && other.strength === l.strength));
    assert.ok(own, 'The native rosters must supply two equal-strength available leaders.');
    const other = seat(game, fixture.opponent).leaders.find(l => !l.dead && l.strength === own.strength)!;
    game = applyAction(game, actor, { type: 'battlePlan', dial: 1, support: 0, leader: own.id });
    game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 1, support: 1, leader: other.id });
    for (const voter of viewGame(game, actor).battle!.traitorVoters)
      game = applyAction(game, voter, { type: 'traitorCall', call: false });
    game = finishAftermath(game);
    assert.equal(game.lastBattleContext!.winner, lead === 'ecaz' ? fixture.opponent : fixture.ally);
  });
for (const allyFaction of ['fremen', 'emperor'] as const) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Advanced Occupy ${allyFaction} typed elite commitment retains its force owner with ${lead} lead`, () => {
    const fixture = ecazOccupyFixture({ allyFaction, ecazForces: 5 });
    const { game, actor, before } = resolve(fixture, lead, { typed: true });
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(forces(game, fixture, fixture.ecaz), 2);
    assert.equal(forces(game, fixture, fixture.ally), 0);
    assert.equal(seat(game, fixture.ally).elites!.tanks - seat(before, fixture.ally).elites!.tanks, 2);
    assert.equal(seat(before, actor).spice - seat(game, actor).spice, allyFaction === 'fremen' ? 0 : 4);
  });
for (const lead of ['ecaz', 'ally'] as const)
  void test(`Native allied Sardaukar lose their double strength against Fremen with ${lead} lead`, () => {
    const fixture = ecazOccupyFixture({ allyFaction: 'emperor', opponentFaction: 'fremen', ecazForces: 5 });
    const prepared = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const profile = viewGame(prepared, actor).battle!.ecazOccupy!.profile!;
    assert.equal(profile.maxDial - profile.fixedEcazDial, 4,
      'The actual enemy faction, not the Ecaz plan actor, determines Sardaukar strength.');
    const { game } = resolve(fixture, lead, { typed: true });
    assert.equal(forces(game, fixture, fixture.ally), 0);
    assert.equal(seat(game, fixture.ally).elites!.tanks, 2);
  });
for (const outcome of ['loss', 'soleTraitor', 'mutualTraitors', 'explosion'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Advanced Occupy true ${outcome} with ${lead} lead settles both physical coalition pools`, () => {
      const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 5 });
      const { game, actor, before } = resolve(fixture, lead, { outcome });
      if (outcome === 'soleTraitor') {
        assert.equal(game.lastBattleContext!.result, 'traitor');
        assert.equal(game.lastBattleContext!.winner, actor);
        assert.equal(forces(game, fixture, fixture.ecaz), 5);
        assert.equal(forces(game, fixture, fixture.ally), 4);
        assert.equal(seat(game, fixture.ecaz).tanks, seat(before, fixture.ecaz).tanks);
        assert.equal(seat(game, fixture.ally).tanks, seat(before, fixture.ally).tanks);
      } else {
        assert.equal(game.lastBattleContext!.result, outcome === 'loss' ? 'normal' : outcome);
        assert.equal(game.lastBattleContext!.winner, outcome === 'loss' ? fixture.opponent : null);
        assert.equal(forces(game, fixture, fixture.ecaz), 0);
        assert.equal(forces(game, fixture, fixture.ally), 0);
        assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, 5);
        assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, 4);
      }
    });
for (const lead of ['ecaz', 'ally'] as const)
  void test(`Printed Karama with ${lead} lead recomputes own physical dial before seal`, () => {
    const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 5 });
    const { game, actor } = resolve(fixture, lead, { canceled: true });
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(forces(game, fixture, fixture.ecaz), lead === 'ecaz' ? 3 : 5);
    assert.equal(forces(game, fixture, fixture.ally), lead === 'ally' ? 2 : 4);
  });
void test('Native BG Worthless conversion cancels Occupy without changing selected lead or alliance', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild', opponentFaction: 'beneGesserit' });
  const game = openEcazOccupyPlans(cancelEcazOccupy(fixture, 'ecaz', true));
  const profile = viewGame(game, fixture.ecaz).battle!.ecazOccupy!.profile!;
  assert.equal(profile.canceled, true);
  assert.equal(profile.forceOwner, fixture.ecaz);
  assert.equal(profile.fixedEcazDial, 0);
  assert.equal(seat(game, fixture.ecaz).ally, fixture.ally);
  assert.equal(seat(game, fixture.ally).ally, fixture.ecaz);
});
void test('Native allied BG advisors are excluded from the Occupy fighter side and lead choice', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'beneGesserit', advisorAlly: true });
  assert.ok(seat(fixture.game, fixture.ally).advisors?.[fixture.territory]);
  assert.notEqual(fixture.game.decision?.kind, 'ecazBattleLead');
  assert.equal(viewGame(fixture.game, fixture.ecaz).battle!.ecazOccupy, null);
});
void test('Native aftermath retires only selected lead cards and four minimal policies can continue', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild' });
  const shield = stageEcazOccupyCard(fixture.game, fixture.ecaz, card => card.kind === 'shield');
  let game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, 'ecaz'));
  const nonLeadHand = structuredClone(seat(game, fixture.ally).hand);
  game = applyAction(game, fixture.ecaz, { type: 'battlePlan', dial: 4, support: 2,
    leader: availableLeader(game, fixture.ecaz, true), defense: shield });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0,
    leader: availableLeader(game, fixture.opponent, false) });
  for (const voter of viewGame(game, fixture.ecaz).battle!.traitorVoters)
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  assert.equal(game.decision?.kind, 'battleCards');
  game = applyAction(game, game.decision!.player, { type: 'decision', discard: [shield] });
  game = finishAftermath(game);
  assert.ok(game.discard.some(card => card.id === shield));
  assert.deepEqual(seat(game, fixture.ally).hand, nonLeadHand);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, fixture.ecaz);
    view.players.find(p => p.id === fixture.ecaz)!.bot = difficulty;
    const candidates = botActions(view);
    const action = candidates.find(a => a.type === 'ready');
    assert.ok(action, `${difficulty} continues the actual post-battle phase.`);
    const next = applyAction(game, fixture.ecaz, action);
    assert.ok(next.ready.includes(fixture.ecaz) || next.phase > game.phase);
  }
});

void test('Surviving coalition fights a second native battle next turn without a phase or plan retrofit', () => {
  const fixture = ecazOccupyFixture({ ecazForces: 5, allyFaction: 'guild' });
  let game = resolve(fixture, 'ecaz').game;
  const firstEvent = game.lastBattleContext!.event;
  game = advanceToNextStorm(game);
  // Reorder only unplayed physical territory faces to avoid an unrelated new Nexus.
  for (const position of [0, 1]) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position &&
      'territory' in card && card.territory !== fixture.territory);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = finishToMovement(game);
  while (game.phase === 5) {
    const actor = game.active!;
    if (actor === fixture.opponent) {
      game = applyAction(game, actor, { type: 'ship', territory: fixture.territory, sector: 15, amount: 2 });
      game = settleEcazOccupyArrival(game);
    }
    game = applyAction(game, actor, { type: 'endMovement' });
  }
  while (game.phaseOpening)
    game = applyAction(game, game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!.id,
      { type: 'ready' });
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === fixture.territory)!;
  assert.ok(choice);
  game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: fixture.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  const result = resolve({ ...fixture, game, ecazForces: 2 }, 'ecaz').game;
  assert.notEqual(result.lastBattleContext!.event, firstEvent);
  assert.equal(result.lastBattleContext!.turn, fixture.game.turn + 1);
  assert.equal(forces(result, fixture, fixture.ecaz), 1);
  assert.equal(forces(result, fixture, fixture.ally), 0);
  assert.ok(result.phase >= 7);
});
