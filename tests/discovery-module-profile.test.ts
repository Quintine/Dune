import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, initializeDiscoveryGameForAudit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, RuleError, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';

function lobby(roster: FactionId[], expansions: string[], advanced = true): Game {
  const game = createGame('DISCINIT', newPlayer(roster[0], roster[0], roster[0]), advanced, expansions);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  for (const player of game.players) player.ready = true;
  game.discoveryEnabled = true;
  return game;
}

void test('Discovery requires the selected native family and does not admit paired or mixed E3', () => {
  const unsupported = [
    lobby(['ixians', 'guild'], []),
    lobby(['richese', 'guild'], ['ix']),
    lobby(['ecaz', 'moritani', 'guild'], ['ecaz']),
    lobby(['ecaz', 'ixians', 'guild'], ['ecaz', 'ix']),
    lobby(['moritani', 'harkonnen', 'guild'], ['ecaz']),
  ];
  for (const game of unsupported) assert.throws(() => initializeDiscoveryGameForAudit(game), RuleError);
  // The Advanced Moritani/Harkonnen restriction is not a new Basic restriction.
  const basic = initializeDiscoveryGameForAudit(lobby(['moritani', 'harkonnen', 'guild'], ['ecaz'], false));
  assert.equal(basic.moritaniAssassinatePreview, undefined);
  assert.equal(basic.discoveries?.tokens.length, 8);
});

void test('Discovery Tech requires three seats and untouched physical tokens', () => {
  const two = lobby(['ixians', 'tleilaxu'], ['ix']); two.techTokens = createTechTokens();
  assert.throws(() => initializeDiscoveryGameForAudit(two), RuleError);
  const used = lobby(['choam', 'richese', 'guild'], ['choam']); used.techTokens = createTechTokens();
  used.techTokens.production.owner = 'choam';
  assert.throws(() => initializeDiscoveryGameForAudit(used), RuleError);
  const fresh = lobby(['ixians', 'tleilaxu', 'guild'], ['ix']); fresh.techTokens = createTechTokens();
  const initialized = initializeDiscoveryGameForAudit(fresh);
  assert.equal(initialized.techTokens?.heighliners.owner, 'ixians');
  assert.equal(initialized.techTokens?.axlotl.owner, 'tleilaxu');
  assert.equal(initialized.discoveryEnabled, true);
});

void test('Discovery cannot redeal started components or silently remove another module', () => {
  const initial = lobby(['ixians', 'tleilaxu', 'guild'], ['ix']);
  const started = initializeDiscoveryGameForAudit(initial);
  assert.throws(() => initializeDiscoveryGameForAudit(started), RuleError);
  const overlays: Game[] = [structuredClone(initial), structuredClone(initial), structuredClone(initial)];
  overlays[0].homeworlds = { custody: null };
  overlays[1].nexusCards = { cards: null, phase: null };
  overlays[2].strongholdCards = createStrongholdCards();
  for (const game of overlays) assert.throws(() => initializeDiscoveryGameForAudit(game), RuleError);
});

void test('classic Discovery Skills does not silently drop native families or unrelated modules and previews', () => {
  const native = lobby(['ixians', 'guild', 'fremen'], ['ix']);
  assert.throws(() => initializeLeaderSkillsGameForAudit(native), RuleError);
  const overlays = Array.from({ length: 5 }, () => lobby(['guild', 'emperor', 'harkonnen'], []));
  overlays[0].homeworlds = { custody: null };
  overlays[1].nexusCards = { cards: null, phase: null };
  overlays[2].strongholdCards = createStrongholdCards();
  overlays[3].mentatQuestionPreview = true;
  overlays[4].spiceBankerIncomePreview = true;
  for (const game of overlays) assert.throws(() => initializeLeaderSkillsGameForAudit(game), RuleError);
  const two = lobby(['guild', 'emperor'], []); two.techTokens = createTechTokens();
  assert.throws(() => initializeLeaderSkillsGameForAudit(two), RuleError);
});

void test('Discovery Skills cannot replace already initialized Discovery components', () => {
  const started = initializeDiscoveryGameForAudit(lobby(['guild', 'emperor', 'harkonnen'], []));
  assert.throws(() => initializeLeaderSkillsGameForAudit(started), RuleError);
});
