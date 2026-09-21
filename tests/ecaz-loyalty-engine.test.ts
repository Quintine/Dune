import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  initializeFactionExpansionsGameForAudit,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { runBots } from '../game/bots';
import { traitorDeck } from '../game/traitors';
import { DIFFICULTIES } from '../game/bot-profiles';

function readyTable(factions: FactionId[], advanced = true, expansions = ['ecaz']) {
  const g = createGame(
    `ECAZLOYALTY${factions.length}${advanced ? 'A' : 'B'}`,
    newPlayer('p0', 'Player 0', factions[0]),
    advanced,
    expansions,
  );
  for (let i = 1; i < factions.length; i++)
    joinGame(g, newPlayer(`p${i}`, `Player ${i}`, factions[i]));
  g.players.forEach((p) => {
    p.ready = true;
    p.bot = 'Easy';
  });
  return g;
}

function setupToTraitors(g: Game) {
  let state = initializeFactionExpansionsGameForAudit(g);
  for (let i = 0; i < 12 && state.setupStage !== 'traitors'; i++) {
    state = runBots(state, 1);
    if (state.status === 'playing') break;
  }
  assert.ok(state.setupStage === 'traitors' || state.status === 'playing');
  return state;
}

function completeSetup(g: Game) {
  let state = g;
  for (let i = 0; i < 240 && state.status === 'setup'; i++)
    state = runBots(state, 1);
  assert.equal(state.status, 'playing', `setup did not complete at ${state.setupStage}`);
  return state;
}

function traitorCustody(g: Game) {
  return [
    ...g.players.flatMap((p) => p.traitorChoices),
    ...g.players.flatMap((p) => p.traitors),
    ...g.players.flatMap((p) => (p.faceDancers ?? []).map((card) => card.leader)),
    ...(g.traitorReserve ?? []),
  ];
}

void test('Advanced Ecaz creates a private pending marker and selects loyalty after BG prediction', () => {
  let g = readyTable(['beneGesserit', 'ecaz', 'atreides']);
  g = initializeFactionExpansionsGameForAudit(g);
  assert.deepEqual(g.ecazLoyalty, { player: 'p1', card: null });
  assert.equal(viewGame(g, 'p0').ecazLoyalty, null);
  assert.equal(g.setupStage, 'prediction');

  for (let i = 0; i < 24 && g.setupStage !== 'traitors' && g.status === 'setup'; i++)
    g = runBots(g, 1);
  assert.equal(g.ecazLoyalty!.player, 'p1');
  assert.ok(g.ecazLoyalty!.card);
  assert.deepEqual(viewGame(g, 'p0').ecazLoyalty, g.ecazLoyalty);
  assert.ok(g.log.some((entry) => entry.text.includes('before initial dealing')));
});

void test('Basic and Advanced games without Ecaz have no loyalty marker', () => {
  let basic = readyTable(['ecaz', 'atreides'], false, ['ecaz']);
  basic = initializeFactionExpansionsGameForAudit(basic);
  assert.equal(basic.ecazLoyalty, undefined);
  assert.equal(viewGame(basic, 'p0').ecazLoyalty, null);

  let advanced = readyTable(['atreides', 'emperor'], true, ['ix']);
  advanced = initializeFactionExpansionsGameForAudit(advanced);
  assert.equal(advanced.ecazLoyalty, undefined);
  assert.equal(viewGame(advanced, 'p0').ecazLoyalty, null);
});

void test('Every legal two-to-six player Ecaz setup removes exactly one native leader from traitor custody', () => {
  const profiles: FactionId[][] = [
    ['ecaz', 'atreides'],
    ['ecaz', 'atreides', 'emperor'],
    ['ecaz', 'atreides', 'emperor', 'fremen'],
    ['ecaz', 'atreides', 'emperor', 'fremen', 'beneGesserit'],
    ['ecaz', 'atreides', 'emperor', 'fremen', 'beneGesserit', 'harkonnen'],
  ];
  for (const factions of profiles) {
    const g = setupToTraitors(readyTable(factions));
    const selected = g.ecazLoyalty!.card;
    assert.ok(selected);
    assert.ok(g.players.find((p) => p.faction === 'ecaz')!.leaders.some((l) => l.id === selected));
    const universe = traitorDeck(g.players).filter((id) => id !== selected);
    const custody = traitorCustody(g);
    assert.equal(custody.includes(selected), false);
    assert.equal(custody.length, universe.length);
    assert.deepEqual([...custody].sort(), [...universe].sort());
  }
});

void test('Harkonnen keeps four dealt traitors and Tleilaxu face-dancer rebuilding excludes loyalty', () => {
  const g = completeSetup(setupToTraitors(readyTable(['ecaz', 'harkonnen', 'tleilaxu', 'atreides'], true, ['ecaz', 'ix'])));
  const harkonnen = g.players.find((p) => p.faction === 'harkonnen')!;
  const tleilaxu = g.players.find((p) => p.faction === 'tleilaxu')!;
  assert.equal(harkonnen.traitors.length, 4);
  assert.deepEqual(harkonnen.traitorChoices, []);
  assert.deepEqual(tleilaxu.traitorChoices, []);
  assert.equal(tleilaxu.faceDancers?.length, 3);
  assert.equal(traitorCustody(g).includes(g.ecazLoyalty!.card!), false);
  assert.deepEqual(
    [...traitorCustody(g)].sort(),
    traitorDeck(g.players, true).filter((id) => id !== g.ecazLoyalty!.card).sort(),
  );
});

void test('all four bot profiles can legally perform Ecaz setup', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = readyTable(['beneGesserit', 'ecaz', 'atreides', 'harkonnen']);
    g.players.forEach((p) => (p.bot = difficulty));
    g = initializeFactionExpansionsGameForAudit(g);
    for (let i = 0; i < 20 && g.status === 'setup'; i++) {
      g = runBots(g);
      if (g.setupStage === undefined) break;
    }
    assert.equal(g.status, 'playing', `${difficulty} did not complete setup`);
    assert.ok(g.ecazLoyalty?.card);
  }
});

void test('Leader Skills audit setup remains available for the no-Ecaz profile', () => {
  let g = readyTable(['beneGesserit', 'atreides'], true, ['choam']);
  g = initializeLeaderSkillsGameForAudit(g);
  assert.equal(g.ecazLoyalty, undefined);
  assert.equal(g.setupStage, 'prediction');
  g = runBots(g, 1);
  assert.ok(g.setupStage === 'skillTreachery' || g.setupStage === 'leaderSkills' || g.status === 'playing');
});

void test('JSON save and normalize preserve the selected marker without duplicate loyalty logs', () => {
  const started = setupToTraitors(readyTable(['ecaz', 'atreides', 'emperor']));
  const before = started.ecazLoyalty;
  const loyaltyLogs = started.log.filter((entry) => entry.text.includes('Ecaz Loyalty')).length;
  const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(started)) as Game);
  assert.deepEqual(restored.ecazLoyalty, before);
  assert.equal(restored.log.filter((entry) => entry.text.includes('Ecaz Loyalty')).length, loyaltyLogs);
  assert.deepEqual(viewGame(restored, 'p0').ecazLoyalty, before);
});

void test('a legacy started state without the marker is not assigned loyalty retroactively', () => {
  const setup = completeSetup(setupToTraitors(readyTable(['ecaz', 'atreides'])));
  const selected = setup.ecazLoyalty!.card!;
  setup.traitorReserve!.push(selected);
  const beforeCustody = traitorCustody(setup).sort();
  const legacy = JSON.parse(JSON.stringify(setup)) as Game;
  delete legacy.ecazLoyalty;
  const restored = normalizeAutomaticGame(legacy);
  assert.equal(restored.ecazLoyalty, undefined);
  assert.equal(viewGame(restored, 'p0').ecazLoyalty, null);
  assert.deepEqual(traitorCustody(restored).sort(), beforeCustody);
});
