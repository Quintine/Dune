import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeBaseGameForAudit, joinGame, newPlayer,
  normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { mobileRoutes } from '../game/board';
import { completedChoamSkillsGame, assertChoamSkillsCustody } from './choam-skills-fixture';
import { completedIxSkillsGame, assertIxSkillsCustody } from './ix-skills-fixture';
import { smugglerShipmentGame } from './smuggler-shipment-fixture';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const player = (game: Game, id: string) => game.players.find(candidate => candidate.id === id)!;
const act = (game: Game, owner: string, action: Action) => reload(applyAction(reload(game), owner, action));
const lastSeq = (game: Game) => game.log.at(-1)?.seq ?? 0;
const notices = (game: Game, name: string, since = 0) =>
  game.log.filter(entry => entry.seq > since && entry.automatic?.name === name);

/** Genuine setup; tests stage only later conserved positions and eligible Tanks. */
function base(advanced = false) {
  let game = createGame('ACTIONNOTICE', newPlayer('a', 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  for (const p of game.players) game = act(game, p.id, { type: 'ready' });
  game = initializeBaseGameForAudit(game);
  for (const p of game.players)
    game = act(game, p.id, { type: 'traitor', leader: player(game, p.id).traitorChoices[0] });
  assert.equal(game.status, 'playing');
  return game;
}

function phase(game: Game, phase: number, active: string | null = null) {
  Object.assign(game, { phase, active, storm: 18, ready: [], response: null, decision: null,
    phaseOpening: null, movementRemaining: active ? [active, ...game.order.filter(id => id !== active)] : null });
  for (const p of game.players) {
    game.deck.push(...p.hand); p.hand = []; p.spice = 20;
    p.shipped = false; p.moved = 0;
  }
  return game;
}

function hold(game: Game, owner: string, effect: string) {
  const index = game.deck.findIndex(card => card.effect === effect);
  assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  player(game, owner).hand.push(card);
  return card.id;
}

function allow(game: Game) {
  for (let step = 0; game.response && step < 20; step++) {
    const voter = game.players.find(candidate => !game.response!.passed.includes(candidate.id))!;
    game = act(game, voter.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

function stable(game: Game) {
  assert.deepEqual(reload(normalizeAutomaticGame(reload(game))), game);
  for (const p of game.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
}

function published(game: Game, name: string, faction: string, since: number) {
  const entries = notices(game, name, since);
  assert.equal(entries.length, 1, `${name} is emitted once for the committed action.`);
  assert.deepEqual(entries[0].automatic, { faction, name });
  for (const p of game.players) {
    const view = viewGame(game, p.id);
    assert.deepEqual(view.log.find(entry => entry.seq === entries[0].seq)?.automatic, entries[0].automatic);
    for (const other of view.players.filter(candidate => candidate.id !== p.id))
      assert.equal(other.hand, undefined);
  }
  stable(game);
  assert.equal(notices(reload(normalizeAutomaticGame(reload(game))), name, since).length, 1);
}

void test('ordinary shipment completion waits for Guild interception and a stopped shipment has no completion notice', () => {
  const initial = phase(base(true), 5, 'a');
  const karama = hold(initial, 'g', 'karama');
  const start = lastSeq(initial);
  const pending = act(initial, 'a', { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 2 });
  assert.equal(pending.decision?.kind, 'guildShipment');
  assert.equal(notices(pending, 'Shipment', start).length, 0);
  assert.equal(player(pending, 'a').forces['imperial_basin:10'] ?? 0, 0);
  stable(pending);
  const committed = act(pending, 'g', { type: 'decision', allow: true });
  assert.equal(player(committed, 'a').forces['imperial_basin:10'], 2);
  published(committed, 'Shipment', 'atreides', start);
  const stopped = act(pending, 'g', { type: 'card', card: karama, mode: 'special' });
  assert.equal(notices(stopped, 'Shipment', start).length, 0);
  assert.equal(player(stopped, 'a').forces['imperial_basin:10'] ?? 0, 0);
  stable(stopped);
});

void test('ordinary movement and native Guild transport publish their committed faction without private detail', () => {
  const initial = phase(base(), 5, 'a');
  Object.assign(player(initial, 'a'), { forces: { 'imperial_basin:10': 3 }, reserves: 17, tanks: 0 });
  const start = lastSeq(initial);
  const moved = act(initial, 'a', { type: 'move', forces: { 'imperial_basin:10': 2 }, territory: 'arrakeen', sector: 10 });
  assert.equal(player(moved, 'a').forces['arrakeen:10'], 2);
  published(moved, 'Movement', 'atreides', start);
  const guild = phase(base(), 5, 'g');
  Object.assign(player(guild, 'g'), { forces: { 'imperial_basin:10': 3 }, reserves: 17, tanks: 0 });
  const guildStart = lastSeq(guild);
  const transported = act(guild, 'g', { type: 'guildShip', forces: { 'imperial_basin:10': 2 }, territory: 'reserves' });
  assert.equal(player(transported, 'g').reserves, 19);
  published(transported, 'Guild transport', 'guild', guildStart);
});

void test('successful force, ordinary leader and Kwisatz revivals each publish one completion notice', () => {
  for (const kind of ['forces', 'leader', 'kwisatz'] as const) {
    const initial = phase(base(kind === 'kwisatz'), 4);
    const owner = player(initial, 'a');
    if (kind === 'forces') Object.assign(owner, { reserves: 17, tanks: 3, forces: {} });
    else {
      for (const leader of owner.leaders) { leader.dead = true; leader.deaths = 1; }
      if (kind === 'kwisatz') owner.kwisatz = { dead: true, revivalCycle: 1 };
    }
    const start = lastSeq(initial);
    const action: Action = kind === 'forces' ? { type: 'revive', amount: 2 }
      : kind === 'leader' ? { type: 'reviveLeader', leader: owner.leaders[0].id }
        : { type: 'reviveKwisatz' };
    const revived = act(initial, 'a', action);
    if (kind === 'forces') assert.equal(player(revived, 'a').tanks, 1);
    else if (kind === 'leader') assert.equal(player(revived, 'a').leaders[0].dead, false);
    else assert.equal(player(revived, 'a').kwisatz!.dead, false);
    published(revived, 'Revival', 'atreides', start);
  }
});

void test('an interruptible CHOAM revival announces only commitment and not an unaffordable canceled benefit', () => {
  const initial = phase(completedChoamSkillsGame({ requestedSkill: 'warmaster' }), 4);
  Object.assign(player(initial, 'c'), { forces: {}, reserves: 15, tanks: 5, spice: 3 });
  const karama = hold(initial, 'e', 'karama');
  const start = lastSeq(initial);
  const pending = act(initial, 'c', { type: 'revive', amount: 3 });
  assert.equal(pending.response?.kind, 'choamRevival');
  assert.equal(notices(pending, 'Revival', start).length, 0);
  assert.equal(player(pending, 'c').tanks, 5);
  stable(pending);
  const committed = allow(pending);
  assert.equal(player(committed, 'c').tanks, 2);
  published(committed, 'Revival', 'choam', start);
  const canceled = act(pending, 'e', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(player(canceled, 'c').tanks, 5);
  assert.equal(player(canceled, 'c').spice, 3);
  assert.equal(notices(canceled, 'Revival', start).length, 0);
  assertChoamSkillsCustody(canceled);
  stable(canceled);
});

void test('ordinary collection emits only for an actual positive desert collection', () => {
  for (const amount of [0, 5]) {
    let game = phase(base(), 5, 'a');
    for (const p of game.players) Object.assign(p, { forces: {}, reserves: 20, tanks: 0 });
    Object.assign(player(game, 'a'), { forces: { 'wind_pass:14': 2 }, reserves: 18 });
    game.spice = amount ? { 'wind_pass:14': amount } : {};
    // Finish the real movement turns; the empty Battle phase enters collection.
    const start = lastSeq(game);
    for (let step = 0; game.phase === 5 && step < 10; step++) {
      if (game.decision?.kind === 'guildTiming')
        game = act(game, game.decision.player, { type: 'decision', take: true });
      else game = act(game, game.active!, { type: 'endMovement' });
    }
    assert.equal(game.phase, 7);
    assert.equal(notices(game, 'Movement', start).length, 0);
    if (amount) {
      assert.equal(player(game, 'a').spice, 24);
      published(game, 'Spice collection', 'atreides', start);
    } else {
      assert.equal(notices(game, 'Spice collection', start).length, 0);
      stable(game);
    }
  }
});

void test('ordinary battle result emits once after both Traitor calls and names only the winning faction', () => {
  let game = phase(base(), 6, 'a');
  for (const p of game.players) Object.assign(p, { forces: { 'wind_pass:14': 6 }, reserves: 14, tanks: 0 });
  game.spice = {};
  const start = lastSeq(game);
  game = act(game, 'a', { type: 'chooseBattle', territory: 'wind_pass', target: 'g' });
  for (let step = 0; game.battle?.preparation && step < 10; step++)
    game = act(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
  game = act(game, 'a', { type: 'battlePlan', dial: 2, leader: player(game, 'a').leaders[0].id });
  game = act(game, 'g', { type: 'battlePlan', dial: 0, leader: player(game, 'g').leaders[4].id });
  game = act(game, 'a', { type: 'traitorCall', call: false });
  assert.equal(notices(game, 'Battle', start).length, 0);
  game = act(game, 'g', { type: 'traitorCall', call: false });
  assert.equal(game.lastBattleContext!.winner, 'a');
  published(game, 'Battle', 'atreides', start);
});

void test('native HMS relocation announces only the allowed move and not its Karama declaration or cancellation', () => {
  let game = phase(completedIxSkillsGame({ requestedSkill: 'warmaster' }), 8);
  const karama = hold(game, 'e', 'karama');
  for (const p of game.players) game = act(game, p.id, { type: 'ready' });
  while (game.phaseOpening) {
    const voter = game.players.find(candidate => !game.phaseOpening!.passed.includes(candidate.id))!;
    game = act(game, voter.id, { type: 'ready' });
  }
  assert.equal(game.decision?.kind, 'mobileStronghold');
  const route = mobileRoutes(game, 3).find(candidate => candidate.length > 1)!;
  assert.ok(route);
  const start = lastSeq(game);
  const pending = act(game, 'i', { type: 'decision', route });
  assert.equal(pending.response?.kind, 'mobileStronghold');
  assert.equal(notices(pending, 'Hidden Mobile Stronghold', start).length, 0);
  const moved = allow(pending);
  assert.equal(moved.mobileStronghold!.location, route.at(-1));
  published(moved, 'Hidden Mobile Stronghold', 'ixians', start);
  const canceled = act(pending, 'e', { type: 'card', card: karama, mode: 'cancel' });
  assert.equal(canceled.mobileStronghold!.location, route[0]);
  assert.equal(notices(canceled, 'Hidden Mobile Stronghold', start).length, 0);
  assertIxSkillsCustody(canceled);
  stable(canceled);
});

void test('an existing named Ghola completion retains its richer notice rather than receiving generic revival metadata', () => {
  const initial = phase(base(), 4);
  const owner = player(initial, 'a');
  owner.leaders[0].dead = true; owner.leaders[0].deaths = 1;
  const card = hold(initial, 'a', 'ghola');
  const start = lastSeq(initial);
  const revived = act(initial, 'a', { type: 'card', card, leader: owner.leaders[0].id });
  published(revived, 'Ghola revival', 'atreides', start);
  assert.equal(notices(revived, 'Revival', start).length, 0);
});

void test('Smuggler shipment retains its richer single completion notice without an additional generic shipment', () => {
  const initial = smugglerShipmentGame();
  const start = lastSeq(initial);
  const shipped = act(initial, 'p', { type: 'ship', territory: 'arrakeen', sector: 10, amount: 3, smuggler: true });
  assert.equal(player(shipped, 'p').reserves, 17);
  assert.equal(player(shipped, 'p').forces['arrakeen:10'], 3);
  published(shipped, 'Smuggler shipment', 'emperor', start);
  assert.equal(notices(shipped, 'Shipment', start).length, 0);
});
