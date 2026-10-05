import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer,
  viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { strongholdControllers } from '../game/stronghold-cards';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { advanceEcazStronghold, ecazStrongholdFixture, ecazStrongholdSeat as seat,
  finishEcazStronghold, openEcazStronghold, type EcazStrongholdFixture } from './fixture-ecaz-strongholds';

function freshLobby(advanced = true): Game {
  let game = createGame('ECAZSTRONGHOLDGUARD', newPlayer('auth-ecaz', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  joinGame(game, newPlayer('auth-guild', 'Guild', 'guild'));
  joinGame(game, newPlayer('auth-emperor', 'Emperor', 'emperor'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  return game;
}
function reveal(fixture: EcazStrongholdFixture, lead: 'ecaz' | 'ally', options: {
  variable?: number; opponentDial?: number; tie?: boolean; defense?: string;
} = {}) {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const defense = options.defense ?? stageEcazOccupyCard(fixture.game, actor, c => c.kind === 'shield');
  fixture.staging.push(`Conserved physical Shield ${defense} at selected ${actor} exposes the original winner-card boundary before Collection.`);
  let game = openEcazStronghold(fixture, lead);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  let own = seat(game, actor).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
  let other = seat(game, fixture.opponent).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  if (options.tie) {
    const matching = seat(game, actor).leaders.find(l => !l.dead && !l.usedAt &&
      seat(game, fixture.opponent).leaders.some(o => !o.dead && !o.usedAt && o.strength === l.strength));
    assert.ok(matching, 'The original faction leaders supply an actual equal-strength pair.');
    own = matching;
    other = seat(game, fixture.opponent).leaders.find(l => !l.dead && !l.usedAt && l.strength === own.strength)!;
  }
  const variable = options.variable ?? 3;
  const before = structuredClone(game);
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + variable,
    support: variable, leader: own.id, defense });
  const opponentDial = options.opponentDial ?? (options.tie ? profile.fixedEcazDial + variable : 0);
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: opponentDial,
    support: opponentDial, leader: other.id });
  assert.ok(game.battle?.revealed, 'Both original selected players seal real plans.');
  const battle = game.battle!;
  const side = (id: string): ResolutionCombatant => {
    const player = seat(game, id), view = viewGame(game, id).battle!;
    assert.ok(view.ownForces);
    return { id, faction: player.faction, ally: player.ally, spice: player.spice, hand: player.hand,
      plan: battle.plans[id], leader: player.leaders.find(l => l.id === battle.plans[id].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[id] };
  };
  const publicBattle = viewGame(game, actor).battle!;
  const quote = quoteBattleResolution({ advanced: true, turn: game.turn, territory: fixture.territory,
    ecazOccupy: publicBattle.ecazOccupy!.profile!, aggressor: publicBattle.aggressor,
    attacker: side(battle.attacker), defender: side(battle.defender),
    voters: publicBattle.traitorVoters.map(id => ({ id, called: false, traitors: seat(game, id).traitors,
      beneficiary: [battle.attacker, battle.defender].includes(id) ? id : actor })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
  for (const voter of publicBattle.traitorVoters)
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  const afterBattle = structuredClone(game);
  game = finishEcazStronghold(game);
  return { game, afterBattle, before, actor, quote, ownLeader: own.id, opponentLeader: other.id };
}

void test('Advanced E3 Stronghold setup retains authenticated seats, exact deck and actual shared end-Mentat custody', () => {
  const admitted = freshLobby();
  const fixture = ecazStrongholdFixture({ initial: admitted });
  assert.deepEqual(fixture.initial.players.map(p => p.id), admitted.players.map(p => p.id));
  assert.equal(fixture.ecaz, 'auth-ecaz'); assert.equal(fixture.ally, 'auth-guild');
  assert.deepEqual([...fixture.afterSetup.deck, ...fixture.afterSetup.discard,
    ...fixture.afterSetup.players.flatMap(p => p.hand)].map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.ok(Object.values(fixture.initial.strongholdCards!.owners).every(owner => owner === null));
  assert.ok(Object.values(fixture.afterSetup.strongholdCards!.owners).every(owner => owner === null));
  assert.equal(fixture.beforeMentat.strongholdCards!.owners.arrakeen, null);
  assert.equal(strongholdControllers(fixture.beforeMentat.players, false).arrakeen, fixture.ecaz);
  const settled = applyAction(fixture.beforeMentat, fixture.mentatStep.actor, fixture.mentatStep.action);
  assert.deepEqual(settled.strongholdCards, fixture.afterMentat.strongholdCards);
  assert.equal(settled.strongholdCards!.claimedTurn, 2);
  assert.equal(Object.values(settled.strongholdCards!.owners).filter(id => id === fixture.ecaz).length, 1);
  assert.ok(!Object.values(settled.strongholdCards!.owners).includes(fixture.ally));
  assert.equal(seat(settled, fixture.ecaz).ally, fixture.ally);
  assert.equal(seat(settled, fixture.ally).ally, fixture.ecaz);
});

void test('Only an actual pending Ecaz lead choice is JSON-restored and consumed once', () => {
  const fixture = ecazStrongholdFixture();
  const restored: Game = JSON.parse(JSON.stringify(fixture.game));
  const decision = restored.decision;
  assert.ok(decision?.kind === 'ecazBattleLead');
  const action = { type: 'decision', event: decision.event, lead: fixture.ally };
  const continued = applyAction(restored, fixture.ecaz, action);
  assert.equal(continued.battle!.ecazOccupy!.lead, fixture.ally);
  assert.equal(continued.strongholdCards!.owners.arrakeen, fixture.ecaz);
  assert.throws(() => applyAction(continued, fixture.ecaz, action));
});

for (const lead of ['ecaz', 'ally'] as const) for (const variable of [0, 1, 3])
  void test(`Arrakeen ${lead} lead: only actual variable support ${variable} receives holder bank funding`, () => {
    const fixture = ecazStrongholdFixture();
    const result = reveal(fixture, lead, { variable });
    const { game, afterBattle, before, actor, quote } = result;
    const payment = quote.payments.find(p => p.player === actor)!;
    assert.equal(payment.bankSupport, lead === 'ecaz' ? Math.min(2, variable) : 0);
    assert.equal(payment.ownPayment, lead === 'ecaz' ? Math.max(0, variable - 2) : variable);
    assert.equal(afterBattle.decision?.kind, 'battleCards');
    assert.equal(seat(before, actor).spice - seat(afterBattle, actor).spice, payment.ownPayment);
    const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    assert.equal(seat(afterBattle, nonLead).spice, seat(before, nonLead).spice);
    assert.equal(seat(game, actor).spice, seat(afterBattle, actor).spice + 2);
    assert.equal(seat(game, nonLead).spice, seat(afterBattle, nonLead).spice + 2);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(seat(game, fixture.ecaz).forces[fixture.location], 2);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, 3);
    assert.equal(seat(game, fixture.ally).forces[fixture.location], 4 - variable);
    assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, variable);
    assert.equal(seat(game, fixture.opponent).forces[fixture.location], undefined);
    assert.ok(!seat(game, actor).leaders.find(l => l.id === result.ownLeader)!.dead);
    assert.ok(!seat(game, fixture.opponent).leaders.find(l => l.id === result.opponentLeader)!.dead);
    const scores = quote.scores!;
    assert.equal(scores[quote.winner === before.battle!.attacker ? 'attacker' : 'defender'],
      3 + variable + seat(before, actor).leaders.find(l => l.id === result.ownLeader)!.strength);
    assert.equal(game.strongholdCards!.owners.arrakeen, fixture.ecaz);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Habbanya tie advantage belongs only to the actual ${lead} plan owner`, () => {
    const fixture = ecazStrongholdFixture({ kind: 'habbanya_ridge_sietch' });
    const prepared = openEcazStronghold(fixture, lead);
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const view = viewGame(prepared, actor).battle!;
    if (lead === 'ecaz') assert.equal(view.aggressor, fixture.opponent,
      'The actual holder must overturn an opposing ordinary tie priority.');
    assert.equal(view.strongholdEffects[actor], lead === 'ecaz' ? fixture.territory : null);
    assert.equal(view.tieWinner, lead === 'ecaz' ? fixture.ecaz : view.aggressor);
    const result = reveal(fixture, lead, { variable: 0, tie: true });
    assert.equal(result.quote.scores!.attacker, result.quote.scores!.defender);
    assert.equal(result.game.lastBattleContext!.winner, view.tieWinner);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Tabr winning income is paid once to ${lead} only when that selected plan owner holds the card`, () => {
    const fixture = ecazStrongholdFixture({ kind: 'sietch_tabr' });
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const shield = stageEcazOccupyCard(fixture.game, actor, c => c.kind === 'shield');
    fixture.staging.push(`Conserved physical Shield ${shield} transferred to selected ${actor}; no face or wallet manufactured.`);
    const result = reveal(fixture, lead, { variable: 1, opponentDial: 2, defense: shield });
    const { game, afterBattle, before, quote } = result;
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.deepEqual(quote.strongholdIncome, lead === 'ecaz' ? [{ player: actor, amount: 2 }] : []);
    assert.equal(seat(afterBattle, actor).spice, seat(before, actor).spice - 1 + (lead === 'ecaz' ? 2 : 0));
    assert.ok(seat(game, actor).hand.some(c => c.id === shield));
    const afterCollection = advanceEcazStronghold(game, g => g.phase === 8 && !g.phaseOpening && !g.response && !g.decision);
    assert.ok(seat(afterCollection, actor).hand.some(c => c.id === shield));
    assert.equal(afterCollection.strongholdCards!.owners.sietch_tabr, fixture.ecaz);
    assert.equal(afterCollection.strongholdCards!.claimedTurn, 2);
    assert.equal(seat(afterCollection, fixture.ecaz).forces[fixture.location], 2);
    assert.equal(seat(afterCollection, fixture.ally).forces[fixture.location], 3);
  });

void test('All four minimal policies consume actual Ecaz lead, original counter and selected plan slots', () => {
  const fixture = ecazStrongholdFixture();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const policy = (game: Game, actor: string) => {
      const view = viewGame(game, actor);
      view.players.find(p => p.id === actor)!.bot = difficulty;
      return botActions(view);
    };
    const lead = policy(fixture.game, fixture.ecaz).find(a => a.type === 'decision');
    assert.ok(lead);
    let game = applyAction(fixture.game, fixture.ecaz, lead);
    assert.equal(game.response?.kind, 'ecazOccupy');
    const counter = policy(game, fixture.opponent).find(a => a.type === 'passResponse' ||
      a.type === 'card' && a.mode === 'cancel');
    assert.ok(counter);
    game = applyAction(game, fixture.opponent, counter);
    game = advanceEcazStronghold(game, g => !g.response && !g.decision && !g.battle?.preparation && (!g.battle?.preLeader || g.battle.preLeader.closed));
    const actor = game.battle!.ecazOccupy!.lead!;
    const plan = policy(game, actor).find(a => a.type === 'battlePlan');
    assert.ok(plan);
    game = applyAction(game, actor, plan);
    assert.ok(game.battle!.plans[actor]);
    const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
    assert.ok(game.battle!.plans[actor].dial >= profile.fixedEcazDial);
    for (const selected of ['ecaz', 'ally'] as const) {
      const prepared = openEcazStronghold(fixture, selected);
      const selectedActor = selected === 'ecaz' ? fixture.ecaz : fixture.ally;
      const selectedPlan = policy(prepared, selectedActor).find(a => a.type === 'battlePlan');
      assert.ok(selectedPlan);
      applyAction(prepared, selectedActor, selectedPlan);
    }
  }
});

void test('Actual Stronghold initializer excludes Basic, E1/E2 mixtures, native pair and all other overlays', () => {
  assert.throws(() => initializeStrongholdFactionsGameForAudit(freshLobby(false)));
  for (const overlay of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'discoveryEnabled', 'ecazTreachery'] as const) {
    const game = freshLobby();
    Object.assign(game, { [overlay]: true });
    assert.throws(() => initializeStrongholdFactionsGameForAudit(game));
  }
  for (const expansion of ['ix', 'choam'] as const) {
    const mixed = freshLobby(); mixed.expansions.push(expansion);
    assert.throws(() => initializeStrongholdFactionsGameForAudit(mixed));
  }
  let pair = createGame('ECAZMORITANISTRONGHOLDGUARD', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(pair, newPlayer('moritani', 'Moritani', 'moritani'));
  joinGame(pair, newPlayer('guild', 'Guild', 'guild'));
  for (const player of pair.players) pair = applyAction(pair, player.id, { type: 'ready' });
  assert.throws(() => initializeStrongholdFactionsGameForAudit(pair));
});

for (const lead of ['ecaz', 'ally'] as const)
  void test(`live original Discovery coalition preserves ${lead} lead support, physical allied losses and held-card custody`, () => {
    const fixture = ecazStrongholdFixture({ discoveries: true, tech: true });
    const { game, afterBattle, before, actor, quote } = reveal(fixture, lead, { variable: 3 });
    const payment = quote.payments.find(receipt => receipt.player === actor)!;
    assert.equal(payment.bankSupport, lead === 'ecaz' ? 2 : 0);
    assert.equal(payment.ownPayment, lead === 'ecaz' ? 1 : 3);
    assert.equal(seat(before, actor).spice - seat(afterBattle, actor).spice, payment.ownPayment);
    assert.equal(seat(game, fixture.ecaz).forces[fixture.location], 2);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, 3);
    assert.equal(seat(game, fixture.ally).forces[fixture.location], 1);
    assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, 3);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.strongholdCards!.owners.arrakeen, fixture.ecaz);
    assert.deepEqual(game.discoveries, before.discoveries);
  });
