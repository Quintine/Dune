import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { HomeworldId } from '../game/homeworld-cards';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import {
  quoteOccupiedHomeworldVoice,
  quoteOccupiedHomeworldFaceDancer,
  quoteOccupiedHomeworldTerror,
  type OccupiedHomeworldDefenseQuote,
  occupiedHomeworldSardaukarStatus,
} from '../game/homeworld-occupied-defenses';
import {
  addDefenseVisitor,
  assertDefenseInventory,
  clearDefenseNative,
  defensePlayer,
  freshDefenseGame,
  qualifyDefensePosition,
  recordDefensePosition,
  removeDefenseVisitor,
} from './fixture-homeworld-occupied-defenses';

const targeted: Record<'voice' | 'faceDancer' | 'terror', {
  native: FactionId;
  card: HomeworldId;
  world: string;
  quote: (game: Game, target: string) => OccupiedHomeworldDefenseQuote;
}> = {
  voice: { native: 'beneGesserit', card: 'wallach_ix', world: 'homeworld:beneGesserit',
    quote: quoteOccupiedHomeworldVoice },
  faceDancer: { native: 'tleilaxu', card: 'tleilax', world: 'homeworld:tleilaxu',
    quote: quoteOccupiedHomeworldFaceDancer },
  terror: { native: 'moritani', card: 'grumman', world: 'homeworld:moritani',
    quote: quoteOccupiedHomeworldTerror },
};

for (const [effect, rule] of Object.entries(targeted)) {
  void test(`${effect}: original fresh setup, conserved sole qualification, exact occupier and reciprocal-ally scope`, () => {
    const game = freshDefenseGame(rule.native);
    assert.equal(rule.quote(game, 'occupier').status, 'allowed', 'fresh unoccupied card grants no immunity');
    qualifyDefensePosition(game, rule.world);
    const qualified = structuredClone(game);
    assert.equal(rule.quote(game, 'occupier').status, 'prohibited');
    assert.equal(rule.quote(game, 'ally').status, 'allowed', 'an unallied player is not protected');
    assert.equal(rule.quote(game, 'opponent').status, 'allowed');
    assert.equal(rule.quote(game, 'native').status, 'allowed', 'the benefit does not protect the native');
    assert.deepEqual(game, qualified, 'quoting changes no physical counters, cards or history');

    defensePlayer(game, 'occupier').ally = 'ally';
    assert.equal(rule.quote(game, 'ally').status, 'allowed', 'one-way alliance gives no entitlement');
    defensePlayer(game, 'ally').ally = 'occupier';
    assert.equal(rule.quote(game, 'ally').status, 'prohibited');
    assert.equal(rule.quote(game, 'opponent').status, 'allowed');
    defensePlayer(game, 'occupier').ally = 'opponent';
    assert.equal(rule.quote(game, 'ally').status, 'allowed', 'former reciprocal ally loses protection immediately');
    assert.equal(rule.quote(game, 'opponent').status, 'allowed', 'new alliance must also be reciprocal');
    defensePlayer(game, 'opponent').ally = 'occupier';
    assert.equal(rule.quote(game, 'opponent').status, 'prohibited');
    assert.equal(rule.quote(game, 'occupier').status, 'prohibited');

    const saved: Game = JSON.parse(JSON.stringify(game));
    const before = structuredClone(saved);
    assert.equal(rule.quote(saved, 'opponent').status, 'prohibited');
    assert.equal(rule.quote(saved, 'ally').status, 'allowed');
    assert.deepEqual(saved, before, 'JSON history supplies the same pure quote');
    assertDefenseInventory(saved);
    delete saved.homeworldOccupationPreview;
    assert.equal(rule.quote(saved, 'occupier').status, 'allowed', 'disabled preview preserves original behavior');
    assert.equal(rule.quote(saved, 'opponent').status, 'allowed');
  });
}

void test('Advanced occupied Salusa suppresses advantage while every original starred counter retains its typed custody', () => {
  const game = freshDefenseGame('emperor');
  const emperor = defensePlayer(game, 'native');
  // Controlled conserved deployment: one actual Sardaukar leaves Salusa for
  // Arrakis, where losing its advantage must not change its physical identity.
  emperor.reserves--;
  emperor.elites!.reserves--;
  game.homeworlds!.custody!.salusa!.elite--;
  emperor.forces['arrakeen:10'] = (emperor.forces['arrakeen:10'] ?? 0) + 1;
  emperor.elites!.forces['arrakeen:10'] = (emperor.elites!.forces['arrakeen:10'] ?? 0) + 1;
  recordDefensePosition(game, 'one-starred-counter-deployed-to-arrakis');
  qualifyDefensePosition(game, 'homeworld:emperor:salusa');
  const before = structuredClone(game);
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: true, blocked: null });
  assert.equal(emperor.elites!.forces['arrakeen:10'], 1);
  assert.equal(emperor.elites!.tanks, 4);
  assert.equal(emperor.elites!.reserves, 0);
  assert.deepEqual(game, before, 'suppression is a rule quote, not counter conversion');
  assertDefenseInventory(game);
  const saved: Game = JSON.parse(JSON.stringify(game));
  assert.deepEqual(occupiedHomeworldSardaukarStatus(saved), { suppressed: true, blocked: null });
  delete saved.homeworldOccupationPreview;
  assert.deepEqual(occupiedHomeworldSardaukarStatus(saved), { suppressed: false, blocked: null });
});

void test('low but unoccupied Advanced Salusa and occupied primary Kaitain do not suppress Sardaukar', () => {
  const game = freshDefenseGame('emperor');
  clearDefenseNative(game, 'homeworld:emperor:salusa');
  recordDefensePosition(game, 'conserved-empty-unoccupied-salusa');
  const before = structuredClone(game);
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: false, blocked: null });
  assert.deepEqual(game, before);
  qualifyDefensePosition(game, 'homeworld:emperor');
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: false, blocked: null },
    'Kaitain is not Salusa even though both worlds belong to Emperor');
  assertDefenseInventory(game);
});

void test('Basic has no Salusa: occupied Kaitain does not remove original Basic starred identities', () => {
  const game = freshDefenseGame('emperor', false);
  const emperor = defensePlayer(game, 'native');
  assert.equal(game.homeworlds!.custody!.salusa, null);
  assert.equal(homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .some(home => home.secondary), false);
  assert.equal(emperor.elites!.reserves, 5);
  assert.equal(defensePlayer(game, 'fremen').elites!.reserves +
    Object.values(defensePlayer(game, 'fremen').elites!.forces).reduce((a, b) => a + b, 0), 3);
  qualifyDefensePosition(game, 'homeworld:emperor');
  const before = structuredClone(game);
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: false, blocked: null });
  assert.equal(emperor.elites!.tanks, 5, 'Basic Homeworld Sardaukar retain physical starred identity');
  assert.deepEqual(game, before);
  assertDefenseInventory(game);
});

const ambiguityRules: Record<string, {
  native: FactionId;
  card: HomeworldId;
  world: string;
  high: number;
  quote: (game: Game) => { blocked: string | null; suppressed?: boolean; status?: OccupiedHomeworldDefenseQuote['status'] };
}> = {
  voice: { native: 'beneGesserit', card: 'wallach_ix', world: 'homeworld:beneGesserit', high: 11,
    quote: game => quoteOccupiedHomeworldVoice(game, 'opponent') },
  faceDancer: { native: 'tleilaxu', card: 'tleilax', world: 'homeworld:tleilaxu', high: 9,
    quote: game => quoteOccupiedHomeworldFaceDancer(game, 'opponent') },
  terror: { native: 'moritani', card: 'grumman', world: 'homeworld:moritani', high: 8,
    quote: game => quoteOccupiedHomeworldTerror(game, 'opponent') },
  sardaukar: { native: 'emperor', card: 'salusa_secundus', world: 'homeworld:emperor:salusa', high: 2,
    quote: occupiedHomeworldSardaukarStatus },
};

for (const [effect, rule] of Object.entries(ambiguityRules)) {
  void test(`${effect}: departed, contested, competing, restored-high and expired evidence propagate the shared blocker without guessing`, () => {
    const qualified = freshDefenseGame(rule.native);
    qualifyDefensePosition(qualified, rule.world);
    for (const mode of ['departed', 'contested', 'competing', 'restored-high', 'expired'] as const) {
      const game = structuredClone(qualified);
      if (mode === 'departed' || mode === 'competing') {
        removeDefenseVisitor(game, rule.world);
        recordDefensePosition(game, 'qualifier-departed');
        if (mode === 'competing') {
          addDefenseVisitor(game, rule.world, 'opponent');
          recordDefensePosition(game, 'different-conserved-sole-arrival');
        } else {
          addDefenseVisitor(game, rule.world);
          recordDefensePosition(game, 'qualifier-returned-after-departure');
        }
      } else if (mode === 'contested') {
        addDefenseVisitor(game, rule.world, 'opponent');
        recordDefensePosition(game, 'second-foreign-army-contests');
        removeDefenseVisitor(game, rule.world, 'opponent');
        recordDefensePosition(game, 'contest-ended-but-ruling-still-pending');
      } else if (mode === 'restored-high') {
        const native = defensePlayer(game, 'native');
        native.tanks -= rule.high;
        native.reserves += rule.high;
        if (rule.card === 'salusa_secundus') {
          native.elites!.tanks -= rule.high;
          native.elites!.reserves += rule.high;
          game.homeworlds!.custody!.salusa!.elite += rule.high;
        }
        recordDefensePosition(game, 'conserved-native-high-threshold-restored');
        clearDefenseNative(game, rule.world);
        recordDefensePosition(game, 'native-high-later-lost-without-invented-expiry-policy');
      } else {
        game.turn++;
        // Controlled incomplete boundary: no new-turn source may be fabricated.
      }
      const before = structuredClone(game);
      const actual = rule.quote(game);
      assert.notEqual(actual.blocked, null, 'an ambiguous beneficiary cannot authorize the native effect');
      if (effect !== 'sardaukar') assert.equal(actual.status, 'unresolved');
      if (effect === 'sardaukar') assert.equal(actual.suppressed, false, 'blocked is not selected strength');
      assert.deepEqual(game, before);
      const saved: Game = JSON.parse(JSON.stringify(game));
      assert.deepEqual(rule.quote(saved), actual, 'original JSON history retains ambiguity');
      assertDefenseInventory(saved);
      delete saved.homeworldOccupationPreview;
      assert.deepEqual(rule.quote(saved), effect === 'sardaukar'
        ? { suppressed: false, blocked: null } : { status: 'allowed', blocked: null }, 'preview-off does not block old rules');
    }
  });
}
