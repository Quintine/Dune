import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import { botActions } from '../game/bots';
import { splitLocation } from '../game/board';
import { ecazOccupyFixture, createEcazOccupySetup, chooseEcazOccupyLead,
  openEcazOccupyPlans, stageEcazOccupyCard, ecazOccupyTerritoryForces,
  type EcazOccupyFixture } from './fixture-ecaz-occupy';

const seat = (game: Game, id: string): Player => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
const army = (game: Game, fixture: EcazOccupyFixture, id: string) =>
  ecazOccupyTerritoryForces(game, id, fixture.territory);

function aftermath(state: Game): Game {
  let game = state;
  for (let n = 0; n < 100; n++) {
    if (game.response) game = applyAction(game,
      game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
    else if (game.decision?.kind === 'battleLosses')
      game = applyAction(game, game.decision.player, { type: 'decision', choice: 0 });
    else if (game.pendingTreacheryDiscard)
      game = applyAction(game, game.players[0].id, { type: 'advanceBots' });
    else return game;
  }
  throw Error('Native Occupy aftermath did not finish.');
}

function originalWin(fixture: EcazOccupyFixture, lead: 'ecaz' | 'ally') {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const tleilaxu = fixture.game.players.find(p => p.faction === 'tleilaxu')!.id;
  const held = seat(fixture.game, tleilaxu).faceDancers!;
  const candidates = seat(fixture.game, actor).leaders.filter(l => !l.dead && !l.usedAt);
  const winner = candidates.find(l => held.some(c => !c.revealed && c.leader === l.id));
  assert.ok(winner, 'Use an actual first-draw Face Dancer and the selected lead\'s real leader.');
  const loser = seat(fixture.game, fixture.opponent).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  const weapon = stageEcazOccupyCard(fixture.game, actor, card => card.kind === 'projectile');
  const shield = stageEcazOccupyCard(fixture.game, actor, card => card.kind === 'shield');
  let game = openEcazOccupyPlans(chooseEcazOccupyLead(fixture, lead));
  const before = structuredClone(game);
  const fixed = viewGame(game, actor).battle!.ecazOccupy!.profile!.fixedEcazDial;
  game = applyAction(game, actor, { type: 'battlePlan', dial: fixed + 2,
    support: 2, leader: winner.id, weapon, defense: shield });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0,
    support: 0, leader: loser.id });
  for (let n = 0; n < 10 && game.battle; n++) {
    const view = viewGame(game, actor).battle!;
    const voter = view.traitorVoters.find(id => !view.traitorSubmitted.includes(id));
    if (!voter) break;
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  }
  game = aftermath(game);
  assert.equal(game.decision?.kind, 'battleCards');
  return { game, before, actor, tleilaxu, winner: winner.id, loser: loser.id,
    bounty: loser.strength, weapon, shield };
}

function continueNativeBattlePhase(state: Game): Game {
  let game = state;
  for (let n = 0; n < 30 && game.phase === 6; n++) {
    const actor = game.players.find(p => !game.ready.includes(p.id)); assert.ok(actor);
    const view = viewGame(game, actor.id);
    view.players.find(p => p.id === actor.id)!.bot = 'Easy';
    const action = botActions(view).find(candidate => candidate.type === 'ready'); assert.ok(action);
    game = applyAction(game, actor.id, action);
  }
  assert.equal(game.phase, 7, 'The original battle must continue naturally to Spice Collection.');
  return game;
}

for (const lead of ['ecaz', 'ally'] as const) {
  void test(`Tleilaxu winning Occupy coside cannot Face Dance its selected ${lead} leader`, () => {
    const fixture = ecazOccupyFixture({ allyFaction: 'tleilaxu',
      faceDancerFaction: lead === 'ecaz' ? 'ecaz' : 'tleilaxu' });
    const win = originalWin(fixture, lead);
    const voters = viewGame(win.before, win.actor).battle!.traitorVoters;
    assert.ok(voters.includes(fixture.ecaz) && voters.includes(fixture.ally),
      'Both actual same-faction participants receive their native traitor declaration.');
    let game = applyAction(win.game, win.actor, { type: 'decision', discard: [win.shield] });
    game = aftermath(game);
    assert.equal(game.battle, null);
    assert.equal(game.decision, null, 'No winning-coside Face Dance opportunity may be offered.');
    assert.equal(army(game, fixture, fixture.ecaz), 1);
    assert.equal(army(game, fixture, fixture.ally), 2);
    assert.equal(seat(game, win.actor).leaders.find(l => l.id === win.winner)!.dead, false);
    assert.ok(seat(game, win.tleilaxu).faceDancers!.some(c => c.leader === win.winner && !c.revealed));
    assert.equal(seat(game, win.actor).spice, seat(win.before, win.actor).spice - 2 + win.bounty);
    assert.ok(seat(game, win.actor).hand.some(c => c.id === win.weapon));
    assert.ok(game.discard.some(c => c.id === win.shield));
    continueNativeBattlePhase(game);
  });
}

for (const lead of ['ecaz', 'ally'] as const)
  for (const origin of ['reserves', 'board'] as const)
    for (const count of [0, 1, 3]) {
      void test(`External Tleilaxu replaces both ${lead}-led Occupy armies: ${origin} ${count}/3`, () => {
        const options = { allyFaction: 'guild', opponentFaction: 'emperor',
          roster: ['ecaz', 'guild', 'emperor', 'tleilaxu'], expansions: ['ecaz', 'ix'],
          faceDancerFaction: lead === 'ecaz' ? 'ecaz' : 'guild' } as const;
        const initial = createEcazOccupySetup({ ...options, roster: [...options.roster], expansions: [...options.expansions] });
        const fixture = ecazOccupyFixture({ ...options, initial,
          roster: [...options.roster], expansions: [...options.expansions] });
        const tleilaxu = fixture.game.players.find(p => p.faction === 'tleilaxu')!.id;
        // Labelled conserved physical source placement outside the battle:
        // five original Tleilaxu reserve counters become Arrakeen board sources.
        const source = 'arrakeen:10';
        seat(fixture.game, tleilaxu).reserves -= 5;
        seat(fixture.game, tleilaxu).forces[source] = 5;
        const win = originalWin(fixture, lead);
        let game = applyAction(win.game, win.actor, { type: 'decision', discard: [win.shield] });
        game = aftermath(game);
        const decision = game.decision;
        assert.ok(decision?.kind === 'faceDance');
        assert.equal(decision.winner, win.actor);
        assert.equal(decision.leader, win.winner);
        assert.equal(army(game, fixture, fixture.ecaz), 1);
        assert.equal(army(game, fixture, fixture.ally), 2);
        assert.equal(seat(game, win.actor).spice, seat(win.before, win.actor).spice - 2 + win.bounty);
        const beforeDance = structuredClone(game);
        const nonLead = win.actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
        const nonLeadHand = structuredClone(seat(game, nonLead).hand);
        const sector = splitLocation(fixture.location).sector;
        assert.throws(() => applyAction(game, tleilaxu,
          { type: 'decision', reveal: true, sources: { reserves: 4 }, sector }), /more forces/,
        'Replacement cannot exceed the whole surviving coalition.');
        const sources = origin === 'reserves' ? { reserves: count } : { [source]: count };
        game = applyAction(game, tleilaxu, { type: 'decision', reveal: true, sources, sector });
        game = aftermath(game);
        assert.equal(army(game, fixture, fixture.ecaz), 0);
        assert.equal(army(game, fixture, fixture.ally), 0);
        assert.equal(army(game, fixture, tleilaxu), count);
        assert.equal(seat(game, fixture.ecaz).reserves, seat(beforeDance, fixture.ecaz).reserves + 1);
        assert.equal(seat(game, fixture.ally).reserves, seat(beforeDance, fixture.ally).reserves + 2);
        assert.equal(seat(game, tleilaxu).reserves,
          seat(beforeDance, tleilaxu).reserves - (origin === 'reserves' ? count : 0));
        assert.equal(seat(game, tleilaxu).forces[source], 5 - (origin === 'board' ? count : 0));
        assert.equal(seat(game, win.actor).leaders.find(l => l.id === win.winner)!.dead, true);
        assert.equal(seat(game, fixture.opponent).leaders.find(l => l.id === win.loser)!.dead, true);
        assert.equal(seat(game, tleilaxu).spice, seat(beforeDance, tleilaxu).spice,
          'Face Dance leader death is not a second bounty.');
        assert.equal(seat(game, win.actor).spice, seat(beforeDance, win.actor).spice,
          'Original selected winner retains its bounty after replacement.');
        assert.ok(seat(game, win.actor).hand.some(c => c.id === win.weapon));
        assert.ok(game.discard.some(c => c.id === win.shield));
        assert.deepEqual(seat(game, nonLead).hand, nonLeadHand);
        assert.ok(seat(game, tleilaxu).faceDancers!.some(c => c.leader === win.winner && c.revealed));
        assert.equal(game.battle, null);
        assert.equal(game.decision, null);
        continueNativeBattlePhase(game);
      });
    }
