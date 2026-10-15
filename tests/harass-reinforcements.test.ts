import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction, viewGame, type Action, type Game} from '../game/engine';
import {finishHarassPreparation, harassCustody, harassWithdrawGame, takeHarassCard} from './fixture-harass-withdraw';
import {chooseEcazOccupyLead, ecazOccupyFixture, openEcazOccupyPlans} from './fixture-ecaz-occupy';
import {finishOccupyCardsAftermath, holdOccupyCardsTraitor} from './fixture-ecaz-occupy-cards';

const harass = 'ecaz-harass-withdraw';
const reinforcements = 'ecaz-reinforcements';
function fixture(advanced = false) {
  // Rock has no collection income to obscure original battle support payments.
  const game = harassWithdrawGame({advanced, factions: ['emperor', 'atreides', 'guild'],
    territory: 'shield_wall', sector: 8});
  takeHarassCard(game, 'a', reinforcements);
  return game;
}
function ownPlan(game: Game, slot: 'weapon' | 'defense' = 'weapon'): Action {
  return {type: 'battlePlan', dial: 1, support: game.advanced ? 1 : 0,
    leader: 'emperor-4', weapon: slot === 'weapon' ? reinforcements : harass,
    defense: slot === 'weapon' ? harass : reinforcements};
}
function seal(game: Game, slot: 'weapon' | 'defense' = 'weapon', other: Partial<Action> = {}) {
  game = applyAction(game, 'a', ownPlan(game, slot));
  return applyAction(game, 'd', {type: 'battlePlan', dial: 0, support: 0,
    leader: 'atreides-2', ...other});
}
function finish(game: Game, calls: readonly string[] = []) {
  for (const player of ['a', 'd']) game = applyAction(game, player,
    {type: 'traitorCall', call: calls.includes(player)});
  game = finishOccupyCardsAftermath(game);
  harassCustody(game);
  return game;
}
function assertDiscarded(game: Game) {
  for (const id of [harass, reinforcements]) {
    assert.equal(game.discard.filter(card => card.id === id).length, 1);
    assert.ok(game.players.every(player => !player.hand.some(card => card.id === id)));
  }
}

void test('both same-plan slot orders add the decisive bonus without changing Harass commitment, support or disposal', () => {
  for (const advanced of [false, true]) for (const slot of ['weapon', 'defense'] as const) {
    const game = fixture(advanced);
    const done = finish(seal(game, slot));
    assert.equal(done.lastBattleContext?.winner, 'a', 'dial1 + leader2 + bonus2 beats leader4');
    assert.equal(done.players[0].reserves, 16, 'fifteen original reserves minus cost3 plus four returned');
    assert.equal(done.players[0].tanks, 4, 'three reserve counters and only the one original dialed counter');
    assert.deepEqual(done.players[0].forces, {});
    assert.equal(done.players[0].spice, advanced ? 29 : 30);
    assert.equal(done.players[0].leaders.find(leader => leader.id === 'emperor-4')!.dead, false);
    assertDiscarded(done);
    assert.equal(done.battle, null);
    assert.equal(done.decision, null);
  }
});

void test('returned ordinary counters cannot replace the original elite reserve cost', () => {
  const game = fixture(true), owner = game.players[0];
  owner.reserves = 3;
  owner.tanks = 12;
  owner.elites!.reserves = 1;
  owner.elites!.tanks = 4;
  harassCustody(game);
  const preview = viewGame(game, 'a').battle!.reinforcements!;
  assert.equal(preview.normal, 2);
  assert.equal(preview.elite, 1);
  const done = finish(seal(game));
  assert.equal(done.players[0].reserves, 4);
  assert.equal(done.players[0].elites!.reserves, 0);
  assert.equal(done.players[0].elites!.tanks, 5, 'the original elite reserve was spent before ordinary returns');
  assert.equal(done.players[0].tanks, 16);
  assert.equal(done.players[0].spice, 29);
  assertDiscarded(done);
});

void test('a future Harass return cannot fund an underfunded same-plan Reinforcements commitment', () => {
  const game = fixture(true), owner = game.players[0];
  owner.reserves = 2;
  owner.tanks = 13;
  owner.elites!.reserves = 1;
  owner.elites!.tanks = 4;
  harassCustody(game);
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, 'a', ownPlan(game)), /three own forces in reserves/);
  assert.deepEqual(game, before);
});

void test('own, opposing and mutual Traitors preserve the original Reinforcements cost and cancel only opposing Harass', () => {
  for (const advanced of [false, true]) for (const calls of [['a'], ['d'], ['a', 'd']]) {
    const game = fixture(advanced);
    if (calls.includes('a')) holdOccupyCardsTraitor(game, 'a', 'atreides-2');
    if (calls.includes('d')) holdOccupyCardsTraitor(game, 'd', 'emperor-4');
    const done = finish(seal(game), calls);
    const canceled = calls.includes('d');
    assert.equal(done.lastBattleContext?.result, calls.length === 2 ? 'mutualTraitors' : 'traitor');
    assert.equal(done.lastBattleContext?.winner, calls.length === 2 ? null : calls[0]);
    assert.equal(done.players[0].reserves, canceled ? 12 : 16);
    assert.equal(done.players[0].tanks, canceled ? 8 : 3);
    assert.deepEqual(done.players[0].forces, canceled ? {} : {'shield_wall:8': 1});
    const bounty = !canceled ? game.players[1].leaders.find(leader => leader.id === 'atreides-2')!.strength : 0;
    assert.equal(done.players[0].spice, game.players[0].spice - (advanced && canceled ? 1 : 0) + bounty);
    assertDiscarded(done);
  }
});

void test('same-plan utility cards both pay and discard while Harass returns precede a Lasgun Shield explosion', () => {
  for (const advanced of [false, true]) {
    const game = fixture(advanced);
    const laser = game.deck.find(card => card.kind === 'lasgun')!;
    const shield = game.deck.find(card => card.kind === 'shield')!;
    takeHarassCard(game, 'd', laser.id);
    takeHarassCard(game, 'd', shield.id);
    const done = finish(seal(game, 'weapon', {weapon: laser.id, defense: shield.id}));
    assert.equal(done.lastBattleContext?.result, 'explosion');
    assert.equal(done.lastBattleContext?.winner, null);
    assert.equal(done.players[0].reserves, 16);
    assert.equal(done.players[0].tanks, 4);
    assert.deepEqual(done.players[0].forces, {});
    assert.equal(done.players[1].tanks, 5);
    assertDiscarded(done);
  }
});

void test('active Occupy same-plan utilities pay only the actual card user and retain original fixed versus variable losses', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const source = ecazOccupyFixture({ecazTreachery: true, allyFaction: 'guild', opponentFaction: 'emperor',
      ecazForces: 5, allyForces: 4});
    const owner = lead === 'ecaz' ? source.ecaz : source.ally;
    takeHarassCard(source.game, owner, harass);
    takeHarassCard(source.game, owner, reinforcements);
    let game = finishHarassPreparation(openEcazOccupyPlans(chooseEcazOccupyLead(source, lead)));
    const before = structuredClone(game);
    const profile = viewGame(game, owner).battle!.ecazOccupy!.profile!;
    const player = game.players.find(player => player.id === owner)!;
    const other = game.players.find(player => player.id === source.opponent)!;
    game = applyAction(game, owner, {type: 'battlePlan', dial: profile.fixedEcazDial + 1, support: 1,
      leader: player.leaders.find(leader => !leader.dead && !leader.usedAt)!.id,
      weapon: reinforcements, defense: harass});
    game = applyAction(game, source.opponent, {type: 'battlePlan', dial: 0, support: 0,
      leader: [...other.leaders].sort((a,b) => a.strength - b.strength)[0].id});
    for (const voter of viewGame(game, owner).battle!.traitorVoters)
      game = applyAction(game, voter, {type: 'traitorCall', call: false});
    game = finishOccupyCardsAftermath(game);
    assert.equal(game.lastBattleContext?.winner, owner);
    const delta = (id: string, field: 'reserves' | 'tanks') =>
      game.players.find(player => player.id === id)![field] - before.players.find(player => player.id === id)![field];
    assert.equal(delta(owner, 'reserves'), lead === 'ecaz' ? -1 : 0);
    assert.equal(delta(source.ecaz, 'tanks'), lead === 'ecaz' ? 6 : 3);
    assert.equal(delta(source.ally, 'tanks'), lead === 'ally' ? 4 : 1);
    assert.equal(game.players.find(player => player.id === source.ecaz)!.forces[source.location] ?? 0,
      lead === 'ecaz' ? 0 : 2);
    assert.equal(game.players.find(player => player.id === source.ally)!.forces[source.location] ?? 0,
      lead === 'ally' ? 0 : 3);
    assertDiscarded(game);
  }
});
