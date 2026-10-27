import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer } from '../game/engine';
import { DISCOVERY_SPICE_CARDS } from '../game/discoveries';
import { territory } from '../game/board';
import {
  DisasterPreflightError, validateDiscoveryBlow, validateWormDevouring,
} from '../game/disaster-preflight';
import {
  createRicheseNoField, deployRicheseNoField, type NoFieldLocation, type NoFieldValue,
} from '../game/richese-no-field';

const printed = DISCOVERY_SPICE_CARDS.find(card => card.territory === 'hagga_basin')!;
const sourceKey = `${printed.territory}:${printed.sector}`;

/** Controlled helper inputs, not a native draw/deployment chronology. The
 * marker, armies and reserve/Tanks populations are assigned explicitly so the
 * preflight's effect-specific casualty validation can be tested in isolation. */
function fixture({ value = 5, reserves = 20, location = {
  territory: printed.territory, sector: printed.sector,
} }: { value?: NoFieldValue; reserves?: number; location?: NoFieldLocation } = {}) {
  const game = createGame('DISCOVERYBLOWPREFLIGHT', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  game.players.push(newPlayer('f', 'Fremen', 'fremen'), newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(game, { status: 'playing', phase: 1, turn: 2 });
  const richese = game.players.find(player => player.id === 'r')!;
  const fremen = game.players.find(player => player.id === 'f')!;
  const emperor = game.players.find(player => player.id === 'e')!;
  const stock = createRicheseNoField(['controlled-zero', 'controlled-three', 'controlled-five']);
  const token = stock.tokens.find(candidate => candidate.value === value)!;
  richese.noField = deployRicheseNoField(stock, { tokenId: token.id, controller: richese.id, location });
  richese.noFieldEvent = 'controlled-before-blow-event';
  richese.reserves = reserves;
  richese.tanks = 20 - reserves;
  return { game, richese, fremen, emperor };
}

void test('Discovery preflight accepts zero three and five markers with scarce or empty reserves without revealing or mutating', () => {
  for (const [value, reserves] of [[0, 0], [0, 20], [3, 0], [3, 2], [5, 2], [5, 20]] as const) {
    const { game } = fixture({ value, reserves }), before = structuredClone(game);
    assert.doesNotThrow(() => validateDiscoveryBlow(game, printed.territory));
    assert.deepEqual(game, before);
  }
});

void test('Discovery casualty capacity uses the reserve-capped reveal and never counts a zero marker as one counter', () => {
  // Numeric capacity-boundary supplements, deliberately not physical game
  // populations: the existing guard rejects an unsafe post-loss Tanks total.
  const capped = fixture({ value: 5, reserves: 2 });
  capped.richese.tanks = Number.MAX_SAFE_INTEGER - 2;
  const before = structuredClone(capped.game);
  assert.doesNotThrow(() => validateDiscoveryBlow(capped.game, printed.territory));
  assert.deepEqual(capped.game, before);
  capped.richese.tanks++;
  const invalid = structuredClone(capped.game);
  assert.throws(() => validateDiscoveryBlow(capped.game, printed.territory), /tank capacity/);
  assert.deepEqual(capped.game, invalid);

  const zero = fixture({ value: 0, reserves: 20 });
  zero.richese.tanks = Number.MAX_SAFE_INTEGER;
  assert.doesNotThrow(() => validateDiscoveryBlow(zero.game, printed.territory));
});

void test('mixed same-territory physical and elite groups validate every sector before accepting Discovery casualties', () => {
  const { game, richese, fremen, emperor } = fixture({ value: 3, reserves: 2 });
  const anotherSector = territory(printed.territory).sectors.find(sector => sector !== printed.sector);
  assert.notEqual(anotherSector, undefined);
  const otherKey = `${printed.territory}:${anotherSector}`;
  richese.forces = { [sourceKey]: 2 }; richese.tanks = 16;
  fremen.forces = { [sourceKey]: 2, [otherKey]: 1 }; fremen.reserves = 17;
  fremen.elites = { reserves: 2, tanks: 0, forces: { [otherKey]: 1 }, revived: 0 };
  emperor.forces = { [otherKey]: 3 }; emperor.reserves = 17;
  emperor.elites = { reserves: 1, tanks: 0, forces: { [otherKey]: 2 }, revived: 0 };
  const before = structuredClone(game);
  assert.doesNotThrow(() => validateDiscoveryBlow(game, printed.territory));
  assert.deepEqual(game, before);

  const tooManyElites = structuredClone(game);
  tooManyElites.players.find(player => player.id === emperor.id)!.elites!.forces[otherKey] = 4;
  assert.throws(() => validateDiscoveryBlow(tooManyElites, printed.territory), /ordinary and elite forces/);
  const eliteOnly = structuredClone(game);
  delete eliteOnly.players.find(player => player.id === emperor.id)!.forces[otherKey];
  assert.throws(() => validateDiscoveryBlow(eliteOnly, printed.territory), /ordinary and elite forces/);
});

void test('an unrelated or explicitly nested Discovery marker stays outside the parent blow casualty set', () => {
  for (const location of [
    { territory: 'imperial_basin', sector: 10 },
    { territory: 'cistern', sector: 0 },
  ]) {
    const { game, richese } = fixture({ value: 5, reserves: 0, location });
    // This explicit nested ID remains a separate location. It is not the
    // printed parent territory even if that token is placed inside the parent.
    const before = structuredClone(game);
    assert.doesNotThrow(() => validateDiscoveryBlow(game, printed.territory));
    assert.deepEqual(game, before);
    assert.deepEqual(richese.noField?.deployed?.location, location);
  }
});

void test('Discovery checks Fremen and protected-allied casualties that an ordinary worm may skip', () => {
  for (const actor of ['f', 'e']) {
    const { game, fremen, emperor } = fixture();
    fremen.ally = emperor.id; emperor.ally = fremen.id;
    game.players.find(player => player.id === actor)!.forces[sourceKey] = 0.5;
    assert.doesNotThrow(() => validateWormDevouring(game, printed.territory, actor === 'e' ? emperor.id : undefined));
    const before = structuredClone(game);
    assert.throws(() => validateDiscoveryBlow(game, printed.territory), /ordinary and elite forces/);
    assert.deepEqual(game, before);
  }
});

void test('only the six printed Discovery blow territories are accepted as targets', () => {
  const { game } = fixture();
  for (const card of DISCOVERY_SPICE_CARDS)
    assert.doesNotThrow(() => validateDiscoveryBlow(game, card.territory));
  const before = structuredClone(game);
  for (const target of ['arrakeen', 'imperial_basin', 'polar_sink', 'cistern', 'unknown-territory'])
    assert.throws(() => validateDiscoveryBlow(game, target), DisasterPreflightError);
  assert.deepEqual(game, before);
});
