import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { leaders, spiceDeck, treacheryDeck } from '../game/cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { DISCOVERY_SPICE_CARDS, DISCOVERY_TOKENS } from '../game/discoveries';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { createOccupiedPercentageState } from '../game/homeworld-occupied-percentage';
import {
  createMixedPhaseModulesFixture, mixedPhaseModulesInventory, type MixedPhaseModulesOptions,
} from './fixture-mixed-phase-modules';

function originalOccupation(game: Game) {
  assert.equal(game.homeworldOccupationPreview, true);
  assert.equal(game.pendingHomeworldOccupiedIncome, null);
  assert.deepEqual(game.homeworldOccupiedIncomeHistory, []);
  assert.ok(game.homeworldOccupiedPercentageLedger);
  assert.deepEqual(game.homeworldOccupiedPercentageLedger.receipts, []);
  if (game.players.some(player => player.faction === 'ecaz')) {
    assert.equal(game.homeworldEcazVictoryPreview, true); assert.equal(game.ecazOccupyPreview, true);
  }
}
function originalModules(game: Game, options: MixedPhaseModulesOptions) {
  if (options.nexus) {
    const cards = game.nexusCards?.cards; assert.ok(cards);
    assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(),
      [...NEXUS_FACTIONS].sort());
  } else assert.ok(!game.nexusCards);
  if (options.discoveries) {
    assert.equal(game.discoveryEnabled, true); assert.ok(game.discoveries);
    assert.deepEqual(game.discoveries.tokens.map(token => token.face).sort(), DISCOVERY_TOKENS.map(token => token.id).sort());
    assert.equal(new Set(game.discoveries.tokens.map(token => token.id)).size, 8);
    const cards = [...game.spiceDeck, ...game.spiceDiscard.flat(),
      ...(game.spiceResolution?.skipped ?? []), ...(game.spiceSequence?.skipped ?? [])];
    assert.equal(cards.length, spiceDeck(game.expansions.includes('ix')).length + 7);
    assert.deepEqual(cards.flatMap(card => 'territory' in card && card.discovery ? [card.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(card => card.discovery).sort());
    assert.equal(cards.filter(card => 'worm' in card && card.greatMaker).length, 1);
  } else assert.ok(!game.discoveryEnabled && !game.discoveries);
  if (options.skills) {
    const skills = game.leaderSkills; assert.ok(skills);
    assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(offer => offer.cards),
      ...skills.assignments.map(assignment => assignment.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  } else assert.ok(!game.leaderSkills);
}
function entry(options: MixedPhaseModulesOptions) {
  const f = createMixedPhaseModulesFixture({ ...options, homeworlds: true });
  assert.equal(f.setup.status, 'setup'); originalOccupation(f.setup);
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 1);
  originalModules(f.setup, options); originalModules(f.game, options);
  assert.equal(f.nexus, !!options.nexus); assert.equal(f.discoveries, !!options.discoveries);
  assert.equal(f.originalInventory.length, treacheryDeck(options.expansions).length);
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory);
  const firstReady = f.actions.findIndex(step => step.action.type === 'ready');
  for (const [enabled, module] of [[options.nexus, 'nexusCards'], [options.discoveries, 'discoveries']] as const) {
    if (!enabled) continue;
    const selected = f.actions.findIndex(step => step.action.type === 'moduleOption' && step.action.module === module && step.action.enabled === true);
    assert.ok(selected >= 0 && selected < firstReady); assert.equal(f.actions[selected].actor, f.initial.host);
  }
  for (const player of f.afterSetup.players) {
    assert.deepEqual(player.leaders.map(leader => leader.id).sort(), leaders(player.faction).map(leader => leader.id).sort());
    assert.ok(viewGame(f.game, player.id).homeworlds?.worlds?.some(world => world.native === player.id));
    const requested = options.training?.[player.faction];
    if (requested) {
      const assignment = f.afterSetup.leaderSkills!.assignments.find(assignment => assignment.owner === player.id);
      assert.ok(assignment); assert.equal(assignment.skill, requested);
      assert.ok(player.leaders.some(leader => leader.id === assignment.leader));
      assert.ok(f.actions.some(step => step.actor === player.id && step.action.type === 'leaderSkill' &&
        step.action.skill === requested && step.action.leader === assignment.leader));
    }
  }
  assert.ok(!f.game.semutaPreview && !f.game.ecazTreachery);
  assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.actions.length);
  return f;
}

// These recipes exercise previously registered original World envelopes. They
// do not assert new roster or overlay admission.
void test('public original classic World Nexus and Discovery starts retain ordinary occupation and physical components', () => {
  entry({ factions: ['atreides', 'emperor', 'fremen'], expansions: [], nexus: true, tech: true });
  entry({ factions: ['atreides', 'emperor'], expansions: [], discoveries: true });
});

void test('public original Advanced World Nexus plus Discovery keeps real fourteen-card training and phase modules', () => {
  entry({ factions: ['atreides', 'emperor', 'fremen'], expansions: [], advanced: true,
    nexus: true, discoveries: true, skills: true, tech: true, strongholds: true,
    training: { atreides: 'warmaster', emperor: 'mentat', fremen: 'swordmaster-of-ginaz' } });
});

void test('public admitted paired E1 Nexus and standalone Ecaz Discovery retain original Worlds and occupation state', () => {
  entry({ factions: ['ixians', 'tleilaxu', 'guild'], expansions: ['ix'], nexus: true, tech: true });
  entry({ factions: ['ecaz', 'emperor', 'guild'], expansions: ['ecaz'], discoveries: true });
});

void test('an original World Nexus lobby rejects a pre-existing occupation ledger without overwriting it', () => {
  const f = createMixedPhaseModulesFixture({ factions: ['atreides', 'emperor', 'fremen'], expansions: [],
    homeworlds: true, nexus: true });
  // Controlled negative input only: this otherwise valid original ready lobby
  // has an existing typed ledger before fresh setup is allowed to create one.
  const game = structuredClone(f.lobby);
  game.homeworldOccupiedPercentageLedger = createOccupiedPercentageState();
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, game.host, { type: 'start' }));
  assert.deepEqual(game, before);
});
