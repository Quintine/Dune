import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import { createAmbassadorRevivalIncomeFixture, actAmbassadorRevivalIncome,
  advanceAmbassadorRevivalIncome, ambassadorRevivalIncomeClean,
  type AmbassadorRevivalIncomeStep } from './fixture-ambassador-revival-income';
import { chooseEcazOccupyLead, openEcazOccupyPlans, stageEcazOccupyCard,
  ecazOccupyTerritoryForces, type EcazOccupyFixture } from './fixture-ecaz-occupy';

const player = (game: Game, actor: string): Player => {
  const result = game.players.find(candidate => candidate.id === actor); assert.ok(result); return result;
};
const cards = (game: Game) => [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)]
  .map(card => card.id).sort();
const traitors = (game: Game) => [...(game.traitorReserve ?? []), ...game.players.flatMap(p =>
  [...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(card => card.leader)])].sort();
const totalForces = (game: Game) => game.players.map(p => ({ id: p.id,
  total: p.reserves + p.tanks + Object.values(p.forces).reduce((sum, count) => sum + count, 0) }));
let originalSetup: Game | undefined;
function publicBasicSetup(): Game {
  // This is the actual admitted public Basic start, not the old Advanced
  // Occupy factory or a started Advanced game whose rules flag was changed.
  originalSetup ??= createAmbassadorRevivalIncomeFixture().afterSetup;
  const game = structuredClone(originalSetup);
  assert.equal(game.advanced, false); assert.equal(game.status, 'playing');
  assert.equal(game.turn, 1); assert.equal(game.phase, 0);
  assert.deepEqual(game.expansions, ['ecaz', 'ix']); assert.equal(cards(game).length, 47);
  return game;
}
function originalBlow(game: Game, worm: boolean) {
  const from = game.spiceDeck.findIndex(card => worm ? 'worm' in card && !card.greatMaker && !card.suppressed
    : 'territory' in card && !card.discovery);
  assert.ok(from >= 0); game.spiceDeck.unshift(game.spiceDeck.splice(from, 1)[0]);
}

/** Explicit CONTROLLED consumer setup after the real Basic public setup:
 * printed armies return to their own physical reserves, and later Treachery
 * and Face Dancer identities are conserved swaps. No wallet, phase, alliance,
 * battle frame, plan, casualty or outcome is installed. All subsequent native
 * alliance, paid shipment and battle controls execute through applyAction. */
function controlledBasicCoalition(coside: boolean, lead: 'ecaz' | 'ally') {
  let game = publicBasicSetup();
  const initial = structuredClone(game), inventory = cards(game), physicalTraitors = traitors(game);
  const physicalForces = totalForces(game), startingWallets = game.players.map(p => ({ id: p.id, spice: p.spice }));
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, count) => sum + count, 0); p.forces = {};
  }
  assert.deepEqual(totalForces(game), physicalForces);
  assert.deepEqual(game.players.map(p => ({ id: p.id, spice: p.spice })), startingWallets);
  const actions: AmbassadorRevivalIncomeStep[] = [];
  const act = (actor: string, action: AmbassadorRevivalIncomeStep['action']) => {
    game = actAmbassadorRevivalIncome(game, actor, action, actions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceAmbassadorRevivalIncome(game, until, actions);
  };
  originalBlow(game, false);
  reach(state => state.turn === 2 && state.phase === 1);
  assert.ok(!game.spiceSequence && !game.spiceResolution && !game.spiceWindow && !game.nexus);
  originalBlow(game, true);
  reach(state => state.phase === 1 && !!state.nexus && !state.spiceResolution &&
    !state.spiceWindow && ambassadorRevivalIncomeClean(state));
  const ecaz = 'ecaz', ally = coside ? 'tleilaxu' : 'guild', opponent = 'harkonnen';
  act(ecaz, { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: ecaz });
  assert.equal(player(game, ecaz).ally, ally); assert.equal(player(game, ally).ally, ecaz);
  reach(state => state.phase === 5 && ambassadorRevivalIncomeClean(state));
  const territory = 'arrakeen', location = 'arrakeen:10', paid: {
    actor: string; amount: number; before: number; after: number;
  }[] = [];
  for (let count = 0; game.phase === 5 && count < 100; count++) {
    if (!ambassadorRevivalIncomeClean(game)) {
      reach(ambassadorRevivalIncomeClean); continue;
    }
    const actor = game.active!;
    if (actor === ecaz || actor === ally || actor === opponent) {
      const amount = actor === ecaz ? 3 : actor === ally ? 4 : 8;
      const before = player(game, actor).spice;
      act(actor, { type: 'ship', amount, territory, sector: 10 }); reach(ambassadorRevivalIncomeClean);
      paid.push({ actor, amount, before, after: player(game, actor).spice });
      assert.equal(player(game, actor).forces[location], amount);
    }
    act(actor, { type: 'endMovement' });
  }
  reach(state => state.phase === 6 && ambassadorRevivalIncomeClean(state));
  assert.equal(paid.length, 3);
  for (const shipment of paid)
    assert.equal(shipment.before - shipment.after,
      shipment.actor === 'guild' || ally === 'guild' && shipment.actor === ecaz
        ? Math.ceil(shipment.amount / 2) : shipment.amount,
      'Original Basic stronghold rates fund each physical army without a staged wallet');
  const actor = lead === 'ecaz' ? ecaz : ally;
  const candidates = player(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
    physicalTraitors.includes(leader.id)).sort((a, b) => b.strength - a.strength);
  const leader = candidates[0]; assert.ok(leader, 'Choose a native non-loyal leader with an actual physical Traitor Card');
  const dancers = player(game, 'tleilaxu').faceDancers!;
  if (!dancers.some(dancer => dancer.leader === leader.id && !dancer.revealed)) {
    const returned = dancers[0].leader, reserve = game.traitorReserve!;
    const index = reserve.indexOf(leader.id);
    if (index >= 0) reserve[index] = returned;
    else {
      const donor = game.players.find(p => p.traitors.includes(leader.id));
      assert.ok(donor, 'The selected physical target must retain reserve or native Traitor-hand custody');
      donor.traitors[donor.traitors.indexOf(leader.id)] = returned;
    }
    // Labelled controlled Face Dancer custody exchange, not a natural deal.
    dancers[0] = { leader: leader.id, revealed: false };
  }
  assert.deepEqual(traitors(game), physicalTraitors);
  const weapon = stageEcazOccupyCard(game, actor, card => card.kind === 'projectile');
  const shield = stageEcazOccupyCard(game, actor, card => card.kind === 'shield');
  assert.deepEqual(cards(game), inventory);
  assert.equal(game.advanced, false);
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === territory);
  assert.ok(choice); const chooser = choice.chooser;
  act(chooser, { type: 'chooseBattle', territory,
    target: choice.attacker === chooser ? choice.defender : choice.attacker });
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  const fixture: EcazOccupyFixture = { game, initial, afterSetup: initial, ecaz, ally, opponent,
    territory, location, ecazForces: 3 };
  return { fixture, actor, leader: leader.id, weapon, shield, inventory, physicalTraitors, physicalForces, actions, paid,
    staging: 'Controlled conserved board/card/Face Dancer positions after a genuine public Basic setup; original worm alliance, funded shipments and native battle controls.' };
}

function settle(state: Game): Game {
  let game = state;
  for (let count = 0; count < 100; count++) {
    if (game.response) {
      const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
      game = applyAction(game, actor.id, { type: 'passResponse' });
    } else if (game.decision?.kind === 'battleLosses')
      game = applyAction(game, game.decision.player, { type: 'decision', choice: 0 });
    else if (game.pendingTreacheryDiscard)
      game = applyAction(game, game.host, { type: 'advanceBots' });
    else return game;
  }
  throw Error('The native Basic coalition aftermath did not reach its next control');
}
function winControlledBattle(source: ReturnType<typeof controlledBasicCoalition>, lead: 'ecaz' | 'ally') {
  const { fixture, actor } = source;
  let game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
  const before = structuredClone(game), profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  assert.equal(profile.advanced, false); assert.equal(profile.fixedEcazDial, 2); assert.equal(profile.maxSupport, 0);
  assert.equal(profile.planOwner, actor); assert.equal(profile.forceOwner, fixture.ally);
  const loser = player(game, fixture.opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(loser);
  game = applyAction(game, actor, { type: 'battlePlan', dial: 4, support: 0,
    leader: source.leader, weapon: source.weapon, defense: source.shield });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0, leader: loser.id });
  const voters = viewGame(game, actor).battle!.traitorVoters;
  assert.ok(voters.includes(fixture.ecaz) && voters.includes(fixture.ally));
  for (let count = 0; game.battle && count < 10; count++) {
    const view = viewGame(game, actor).battle!;
    const voter = view.traitorVoters.find(id => !view.traitorSubmitted.includes(id));
    if (!voter) break;
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  }
  game = settle(game); assert.equal(game.decision?.kind, 'battleCards');
  assert.equal(game.decision.player, actor);
  return { game, before, loser: loser.id, bounty: loser.strength };
}
function assertCompleted(game: Game, source: ReturnType<typeof controlledBasicCoalition>) {
  assert.equal(game.advanced, false); assert.equal(game.battle, null); assert.equal(game.decision, null);
  assert.deepEqual(cards(game), source.inventory); assert.deepEqual(traitors(game), source.physicalTraitors);
  assert.deepEqual(totalForces(game), source.physicalForces);
  assert.ok(player(game, source.actor).hand.some(card => card.id === source.weapon));
  assert.ok(game.discard.some(card => card.id === source.shield));
  const collection = advanceAmbassadorRevivalIncome(game,
    state => state.phase === 7 && ambassadorRevivalIncomeClean(state));
  assert.equal(collection.phase, 7, 'Original battle readiness continues to native collection');
}
const army = (game: Game, source: ReturnType<typeof controlledBasicCoalition>, actor: string) =>
  ecazOccupyTerritoryForces(game, actor, source.fixture.territory);

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic admitted Ecaz/Tleilaxu Occupy suppresses Face Dance for ${lead} lead`, () => {
    const source = controlledBasicCoalition(true, lead), win = winControlledBattle(source, lead);
    let game = applyAction(win.game, source.actor, { type: 'decision', discard: [source.shield] });
    game = settle(game);
    assert.equal(army(game, source, 'ecaz'), 1); assert.equal(army(game, source, 'tleilaxu'), 2);
    assert.equal(player(game, source.actor).leaders.find(leader => leader.id === source.leader)!.dead, false);
    assert.ok(player(game, 'tleilaxu').faceDancers!.some(dancer => dancer.leader === source.leader && !dancer.revealed));
    assert.equal(player(game, source.actor).spice, player(win.before, source.actor).spice + win.bounty,
      'Basic support is zero and only the actual original leader bounty is credited');
    assertCompleted(game, source);
  });

for (const lead of ['ecaz', 'ally'] as const) for (const count of [0, 3])
  void test(`Basic admitted external Tleilaxu Face Dance replaces both ${lead}-led armies with ${count} forces`, () => {
    const source = controlledBasicCoalition(false, lead), win = winControlledBattle(source, lead);
    let game = applyAction(win.game, source.actor, { type: 'decision', discard: [source.shield] });
    game = settle(game);
    assert.ok(game.decision?.kind === 'faceDance');
    assert.equal(game.decision.player, 'tleilaxu'); assert.equal(game.decision.winner, source.actor);
    assert.equal(game.decision.leader, source.leader);
    assert.equal(army(game, source, 'ecaz'), 1); assert.equal(army(game, source, 'guild'), 2);
    const before = structuredClone(game), other = source.actor === 'ecaz' ? 'guild' : 'ecaz';
    game = applyAction(game, 'tleilaxu', { type: 'decision', reveal: true, sources: { reserves: count }, sector: 10 });
    game = settle(game);
    assert.equal(army(game, source, 'ecaz'), 0); assert.equal(army(game, source, 'guild'), 0);
    assert.equal(army(game, source, 'tleilaxu'), count);
    assert.equal(player(game, 'ecaz').reserves, player(before, 'ecaz').reserves + 1);
    assert.equal(player(game, 'guild').reserves, player(before, 'guild').reserves + 2);
    assert.equal(player(game, 'tleilaxu').reserves, player(before, 'tleilaxu').reserves - count);
    assert.equal(player(game, source.actor).leaders.find(leader => leader.id === source.leader)!.dead, true);
    assert.equal(player(game, source.fixture.opponent).leaders.find(leader => leader.id === win.loser)!.dead, true);
    assert.equal(player(game, 'tleilaxu').spice, player(before, 'tleilaxu').spice);
    assert.equal(player(game, source.actor).spice, player(before, source.actor).spice, 'No second bounty after replacement');
    assert.deepEqual(player(game, other).hand, player(before, other).hand);
    assert.ok(player(game, 'tleilaxu').faceDancers!.some(dancer => dancer.leader === source.leader && dancer.revealed));
    assertCompleted(game, source);
  });
