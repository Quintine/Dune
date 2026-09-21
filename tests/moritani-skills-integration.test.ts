import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { basicMoritaniLeaderSkillsProfile } from '../game/leader-skill-profile';
import { spiceBankerModeSupported } from '../game/spice-banker';
import { diplomatDefenseModeSupported } from '../game/diplomat-defense';
import { sandmasterModeSupported } from '../game/sandmaster-movement';
import { smugglerBattleModeSupported } from '../game/smuggler-battle';
import { bureaucratPaymentModeSupported } from '../game/bureaucrat-payment';
import { planetologistMovementModeSupported } from '../game/planetologist-movement';
import { planetologistMoveDraft } from '../components/planetologist-movement';
import { TERRITORIES, distance, location, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { completedMoritaniSkillsGame, initializedMoritaniSkillsOffers, assertMoritaniSkillsCustody, moritaniSkillsPlayer as player, reloadMoritaniSkillsGame as reload, rejectMoritaniSkillsAction as reject } from './moritani-skills-fixture';

function movementPosition(game: Game): Game {
  // Conserved focused position following genuine setup, not a played phase history.
  for (const p of game.players) {
    p.forces = {}; p.reserves = 20; p.tanks = 0;
    p.spice = 20; p.moved = 0; p.shipped = false;
  }
  Object.assign(game, { phase: 5, active: 'm', order: ['m', 'a', 'e'], storm: 18,
    ready: [], decision: null, response: null, phaseOpening: null });
  return game;
}

void test('every canonical skill can be dealt and publicly assigned to Basic Moritani without reducing the deck', () => {
  for (const card of LEADER_SKILL_CARDS) {
    const game = completedMoritaniSkillsGame({ requestedSkill: card.id });
    assert.equal(game.leaderSkills!.assignments.find(a => a.owner === 'm')!.skill, card.id);
    assertMoritaniSkillsCustody(game);
    for (const p of game.players) {
      const view = viewGame(game, p.id);
      assert.equal(view.leaderSkills!.offer, null);
      assert.equal(view.leaderSkills!.assignments.length, 3);
      assert.deepEqual(viewGame(reload(game), p.id), view);
    }
  }
});

void test('Moritani skill integration shares public guards and retains Advanced, Ecaz and optional-module boundaries', () => {
  const game = completedMoritaniSkillsGame();
  const gates = [basicMoritaniLeaderSkillsProfile, spiceBankerModeSupported, diplomatDefenseModeSupported,
    sandmasterModeSupported, smugglerBattleModeSupported, bureaucratPaymentModeSupported, planetologistMovementModeSupported];
  for (const gate of gates) {
    assert.equal(gate(game), true, gate.name);
    assert.equal(gate(viewGame(game, 'a')), true, `${gate.name} projected`);
  }
  for (const change of [
    (g: Game) => { g.advanced = true; },
    (g: Game) => { g.players[1] = newPlayer('a', 'Ecaz', 'ecaz'); },
    (g: Game) => { g.expansions.push('choam'); },
    (g: Game) => { g.discoveryEnabled = true; },
    (g: Game) => { g.ecazTreachery = true; },
  ]) {
    const lobby = createGame('MORIGATE', newPlayer('m', 'Moritani', 'moritani'), false, ['ecaz']);
    joinGame(lobby, newPlayer('a', 'Atreides', 'atreides'));
    lobby.players.forEach(p => { p.ready = true; });
    change(lobby);
    const before = JSON.stringify(lobby);
    assert.throws(() => initializeLeaderSkillsGameForAudit(lobby));
    assert.equal(JSON.stringify(lobby), before);
    assert.equal(basicMoritaniLeaderSkillsProfile(lobby), false);
  }
  const publicLobby = createGame('MORIPUBL', newPlayer('m', 'Moritani', 'moritani'), false, ['ecaz']);
  joinGame(publicLobby, newPlayer('a', 'Atreides', 'atreides'));
  publicLobby.players.forEach(p => { p.ready = true; });
  reject(publicLobby, 'm', { type: 'start' });
});

void test('all four profiles legally choose from the same private Moritani setup offer', () => {
  const game = initializedMoritaniSkillsOffers({ requestedSkill: 'planetologist' });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(game), 'm');
    view.players.find(p => p.id === 'm')!.bot = difficulty;
    const action = botActions(view)[0];
    assert.equal(action.type, 'leaderSkill');
    const next = applyAction(game, 'm', action);
    assert.equal(next.leaderSkills!.assignments.find(a => a.owner === 'm')?.leader, action.leader);
    assertMoritaniSkillsCustody(next);
  }
});

void test('Moritani Planetologist controls and bots use the same extended movement through saved views', () => {
  const game = movementPosition(completedMoritaniSkillsGame({ requestedSkill: 'planetologist' }));
  const from = 'red_chasm:7';
  player(game, 'm').forces = { [from]: 3 }; player(game, 'm').reserves = 17;
  const to = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => location(t.id, s)))
    .find(key => splitLocation(key).sector !== 18 && distance(from, key, k => splitLocation(k).sector === 18) === 2)!;
  assert.ok(to);
  const target = splitLocation(to);
  const draft = planetologistMoveDraft(viewGame(game, 'm'), 'range', target.territory, target.sector, { [from]: 3 }, {});
  assert.equal(draft.blocked, null); assert.ok(draft.action);
  const done = applyAction(reload(game), 'm', draft.action);
  assert.equal(player(done, 'm').forces[to], 3);
  assert.equal(player(done, 'm').forces[from] ?? 0, 0);
  assert.equal(player(done, 'm').moved, 1);
  assertMoritaniSkillsCustody(done);
  // Make the same two-step target useful; only legal availability is assessed.
  game.spice = { [to]: 8 };
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'm'); view.players.find(p => p.id === 'm')!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'move' && a.planetologist === 'range');
    assert.ok(action, difficulty);
    assert.doesNotThrow(() => applyAction(game, 'm', action));
  }
});

void test('Moritani Smuggler ships the free companion once and Bureaucrat redirects a real paid bribe after restore', () => {
  let game = movementPosition(completedMoritaniSkillsGame({ requestedSkill: 'smuggler' }));
  const ship = { type: 'ship', territory: 'carthag', sector: 11, amount: 3, smuggler: true };
  game = applyAction(game, 'm', ship);
  assert.equal(player(game, 'm').forces['carthag:11'], 3);
  assert.equal(player(game, 'm').reserves, 17);
  assert.equal(player(game, 'm').spice, 18);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  reject(game, 'm', ship); assertMoritaniSkillsCustody(game);

  game = movementPosition(completedMoritaniSkillsGame({ requestedSkill: 'bureaucrat' }));
  game = applyAction(game, 'a', { type: 'bribe', target: 'e', amount: 5 });
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(game.decision?.player, 'm');
  const event = game.bureaucratPaymentEvent;
  const done = applyAction(reload(game), 'm', { type: 'decision', event, redirect: true });
  assert.equal(player(done, 'a').spice, 15);
  assert.equal(player(done, 'e').bribes, 3);
  assert.equal(done.bureaucratPayments!.used.length, 1);
  reject(done, 'm', { type: 'decision', event, redirect: true });
  assertMoritaniSkillsCustody(done);
});
