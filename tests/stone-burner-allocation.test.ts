import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { casualtyOptions, type CombatForces } from '../game/combat';
import {
  quoteBattleResolution, StoneBurnerAllocationRequiredError, BattleResolutionQuoteError,
  type BattleResolutionInput, type ResolutionCombatant,
} from '../game/battle-resolution-quote';
import { quoteStoneBurnerAllocations, stoneBurnerCommittedLosses } from '../game/stone-burner-allocation';
import { stoneBurnerPlanBlock, stoneBurnerCompulsionBlock } from '../game/stone-burner';
import { quoteEcazOccupyBattle } from '../game/ecaz-occupy-battle';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { casualtyConstraintFields, committedCasualtyOptions } from '../game/battle-casualty-commitment';

const catalog = (): Card[] => [...baseDeck(), ...ixBattleCards(), ...richeseCards(), ...ecazTreacheryCards()];
const ordinary = (normal: number, freeSupport = false): CombatForces => ({ normal, elite: 0, eliteStrength: 1, freeSupport });
const emperor: CombatForces = { normal: 4, elite: 2, eliteStrength: 2, freeSupport: false };
function combatant(id: string, faction: ResolutionCombatant['faction'], forces: CombatForces, dial: number, support: number): ResolutionCombatant {
  const leader = { ...leaders(faction)[0] };
  return { id, faction, forces: { ...forces }, spice: 10, hand: [], leader,
    plan: { dial, support, leader: leader.id, weapon: null, defense: null } };
}
function fixture(): BattleResolutionInput {
  const attacker = combatant('a', 'emperor', emperor, 3, 1);
  const defender = combatant('d', 'guild', ordinary(4), 1, 1);
  const cards = catalog(), stone = cards.find(card => card.effect === 'stoneBurner')!;
  attacker.hand = [stone]; attacker.plan.weapon = stone.id; attacker.stoneMode = 'ignore';
  return { advanced: true, turn: 2, territory: 'carthag', attacker, defender,
    participants: [attacker, defender].map(side => ({ id: side.id, faction: side.faction })),
    voters: [attacker, defender].map(side => ({ id: side.id, beneficiary: side.id, called: false, traitors: [] })),
    physicalCards: cards, pendingAuditorPresent: false, pendingRetentionPresent: false };
}

void test('a committed Stone physical loss count survives card cleanup and native aftercare without reopening other typed totals', () => {
  const input = fixture();
  const result = quoteBattleResolution({...input,stoneAllocations:{a:3}});
  const commitment = result.casualties!;
  assert.equal(commitment.physicalLossCount, 3);
  const saved = JSON.parse(JSON.stringify(commitment));
  assert.deepEqual(committedCasualtyOptions(saved.forces,saved.dial,saved.support,saved),saved.options);
  assert.equal(new Set(saved.options.map((option: {normal:number;elite:number}) => option.normal + option.elite)).size,1);
  assert.ok(saved.options.length > 1, 'Choosing a physical total still leaves the original typed winner choice');
  assert.deepEqual(casualtyConstraintFields(saved),{physicalLossCount:3});
  assert.deepEqual(committedCasualtyOptions(saved.forces,saved.dial,saved.support),
    casualtyOptions(saved.forces,saved.dial,saved.support), 'Legacy unconstrained casualty choices remain complete');
  assert.deepEqual(committedCasualtyOptions(saved.forces,saved.dial,saved.support,{physicalLossCount:21}),[]);
  assert.deepEqual(committedCasualtyOptions(saved.forces,saved.dial,saved.support,{fullyCommitted:true,physicalLossCount:3}),[],
    'A partial Stone commitment cannot replace the already fixed full Harass remainder');
});

void test('only outcome-ambiguous Stone asks for physical totals, allowing either winner and retaining typed alternatives within one committed total', () => {
  const input = fixture(), before = structuredClone(input);
  const choices = { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }] };
  assert.deepEqual(quoteStoneBurnerAllocations(input), choices);
  assert.throws(() => quoteBattleResolution(input), StoneBurnerAllocationRequiredError);
  const loser = quoteBattleResolution({ ...input, stoneAllocations: { a: 2 } });
  assert.equal(loser.winner, 'd');
  assert.deepEqual(loser.stone, { winner: 'defender', attacker: [2], defender: [3] });
  assert.deepEqual(stoneBurnerCommittedLosses({ ...input, stoneAllocations: { a: 2 } }, 'a'), [
    { normal: 3, elite: 1, paidNormal: 1, paidElite: 0 },
  ]);
  assert.equal(stoneBurnerCommittedLosses(input, 'a'), null);
  assert.equal(stoneBurnerCommittedLosses({ ...input, stoneAllocations: { a: 2 } }, 'd'), null);
  const winner = quoteBattleResolution({ ...input, stoneAllocations: { a: 3 } });
  assert.equal(winner.winner, 'a');
  assert.equal(winner.casualties!.physicalLossCount, 3);
  assert.deepEqual(winner.stone, { winner: 'attacker', attacker: [3], defender: [3] });
  assert.deepEqual(winner.casualties!.options, [
    { normal: 2, elite: 1, paidNormal: 0, paidElite: 1 },
    { normal: 1, elite: 2, paidNormal: 1, paidElite: 0 },
  ]);
  for (const option of winner.casualties!.options) assert.equal(6 - option.normal - option.elite, 3);
  assert.deepEqual(quoteStoneBurnerAllocations({ ...input, stoneAllocations: { a: 3 } }), choices);
  assert.deepEqual(input, before);
});

void test('both variable sides must commit even when the first chosen total already fixes the winner', () => {
  const input = fixture();
  input.defender = { ...input.defender, forces: { ...emperor }, plan: { ...input.defender.plan, dial: 3, support: 1 } };
  const required = { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }, { player: 'd', owner: 'd', totals: [2, 3, 4] }] };
  assert.deepEqual(quoteStoneBurnerAllocations(input), required);
  assert.deepEqual(quoteStoneBurnerAllocations({ ...input, stoneAllocations: { a: 4 } }), required);
  assert.throws(() => quoteBattleResolution({ ...input, stoneAllocations: { a: 4 } }), StoneBurnerAllocationRequiredError);
  assert.equal(quoteBattleResolution({ ...input, stoneAllocations: { a: 4, d: 2 } }).winner, 'a');
  assert.equal(quoteBattleResolution({ ...input, stoneAllocations: { a: 2, d: 4 } }).winner, 'd');
  input.aggressor = 'd';
  assert.equal(quoteBattleResolution({ ...input, stoneAllocations: { a: 3, d: 3 } }).winner, 'd');
});

void test('invariant Stone and ordinary battles keep their original winner-later allocation and gain no commitment roster', () => {
  const input = fixture();
  input.defender.forces = ordinary(1);
  const options = casualtyOptions(input.attacker.forces, 3, 1);
  assert.equal(quoteStoneBurnerAllocations(input), null);
  assert.deepEqual(quoteBattleResolution(input).casualties!.options, options);
  input.attacker.hand = []; input.attacker.plan.weapon = null; delete input.attacker.stoneMode;
  assert.equal(quoteStoneBurnerAllocations(input), null);
  const ordinaryResult = quoteBattleResolution(input);
  assert.equal(ordinaryResult.stone, null);
  assert.deepEqual(ordinaryResult.casualties!.options, options);
});

void test('Basic Cyborg/Suboid pools use the same physical commitment without granting Advanced strength or support', () => {
  const input = fixture(); input.advanced = false;
  input.attacker = combatant('a', 'ixians', { normal: 6, elite: 2, eliteStrength: 2, normalFixedHalf: true, freeSupport: true }, 2, 0);
  const stone = catalog().find(card => card.effect === 'stoneBurner')!;
  input.attacker.hand = [stone]; input.attacker.plan.weapon = stone.id; input.attacker.stoneMode = 'ignore';
  input.defender = combatant('d', 'guild', ordinary(7, true), 1, 0);
  input.participants = [input.attacker, input.defender].map(side => ({ id: side.id, faction: side.faction }));
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'a', owner: 'a', totals: [4, 7] }] });
  assert.equal(quoteBattleResolution({ ...input, stoneAllocations: { a: 4 } }).winner, 'd');
  const result = quoteBattleResolution({ ...input, stoneAllocations: { a: 7 } });
  assert.equal(result.winner, 'a');
  assert.deepEqual(result.casualties!.options, [{ normal: 0, elite: 1, paidNormal: 0, paidElite: 0 }]);
  assert.deepEqual(result.payments, []);
});

void test('physical Mirror retains its own card while the copied Stone uses the same committed comparison', () => {
  const input = fixture(), mirror = catalog().find(card => card.effect === 'mirrorWeapon')!;
  input.defender.hand = [mirror]; input.defender.plan.weapon = mirror.id; input.defender.stoneMode = 'ignore';
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }] });
  const result = quoteBattleResolution({ ...input, stoneAllocations: { a: 2 } });
  assert.equal(result.winner, 'd');
  assert.ok(result.winnerCards.includes(mirror.id));
  assert.ok(result.discarded.some(entry => entry.player === 'a' && entry.card === input.attacker.plan.weapon));
});

function occupyFixture(canceled = false): BattleResolutionInput {
  const input = fixture();
  const profile = quoteEcazOccupyBattle({ advanced: true, battleOrderActor: 'ecaz',
    ecaz: { id: 'ecaz', faction: 'ecaz', ally: 'ally', forces: ordinary(5) },
    ally: { id: 'ally', faction: 'emperor', ally: 'ecaz', forces: { ...emperor } },
    lead: canceled ? 'ally' : 'ecaz', canceled });
  const own = combatant(profile.lead, canceled ? 'emperor' : 'ecaz', profile.forces, profile.fixedEcazDial + 3, 1);
  own.ally = canceled ? 'ecaz' : 'ally';
  own.hand = input.attacker.hand; own.plan.weapon = input.attacker.plan.weapon; own.stoneMode = 'ignore';
  input.attacker = own; input.ecazOccupy = profile;
  input.defender = combatant('d', 'guild', ordinary(canceled ? 4 : 6), 1, 1);
  input.participants = [{ id: 'ecaz', faction: 'ecaz', ally: 'ally' }, { id: 'ally', faction: 'emperor', ally: 'ecaz' }, { id: 'd', faction: 'guild' }];
  input.voters = ['ecaz', 'ally'].map(id => ({ id, beneficiary: profile.lead, called: false, traitors: [] }))
    .concat([{ id: 'd', beneficiary: 'd', called: false, traitors: [] }]);
  return input;
}

void test('active Occupy asks the variable physical owner for the lead side total, retaining fixed Ecaz loss and same-total typed alternatives', () => {
  const input = occupyFixture();
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'ecaz', owner: 'ally', totals: [4, 5, 6] }] });
  const result = quoteBattleResolution({ ...input, stoneAllocations: { ecaz: 5 } });
  assert.equal(result.winner, 'ecaz');
  assert.deepEqual(result.fixedLosses, [{ owner: 'ecaz', normal: 3, elite: 0 }]);
  assert.equal(result.casualties!.owner, 'ally');
  assert.equal(result.casualties!.physicalLossCount, 3, 'The fixed Ecaz losses are outside the committed variable loss count');
  assert.equal(result.casualties!.options.length, 2);
  assert.deepEqual(stoneBurnerCommittedLosses({ ...input, stoneAllocations: { ecaz: 5 } }, 'ecaz'), result.casualties!.options);
  for (const option of result.casualties!.options) assert.equal(2 + 6 - option.normal - option.elite, 5);
  assert.deepEqual(quoteBattleResolution({ ...input, stoneAllocations: { ecaz: 4 } }).destroyedArmies, ['ecaz', 'ally']);
  assert.throws(() => quoteStoneBurnerAllocations({ ...input, stoneAllocations: { ally: 5 } }), /original side players/);
  const canceled = occupyFixture(true);
  assert.deepEqual(quoteStoneBurnerAllocations(canceled), { choices: [{ player: 'ally', owner: 'ally', totals: [2, 3, 4] }] });
  assert.deepEqual(quoteBattleResolution({ ...canceled, stoneAllocations: { ally: 3 } }).fixedLosses, []);
});

void test('Ecaz Harass removes only its fixed undialed complement before variable totals, without changing the original mandatory loss', () => {
  const input = occupyFixture(), own = input.attacker, profile = input.ecazOccupy!;
  const harass = catalog().find(card => card.id === HARASS_WITHDRAW_CARD)!;
  own.hand = [...own.hand, harass]; own.plan.defense = harass.id;
  own.harassWithdraw = { blocked: null, forces: profile.ecazForces,
    locations: { 'carthag:11': { normal: 5, elite: 0 } },
    occupy: { cardUser: 'ecaz', ecaz: 'ecaz', ally: 'ally', canceled: false,
      fixedEcazDial: 3, variableForces: profile.forces } };
  input.defender.forces = ordinary(4);
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'ecaz', owner: 'ally', totals: [2, 3, 4] }] });
  const result = quoteBattleResolution({ ...input, stoneAllocations: { ecaz: 3 } });
  assert.deepEqual(result.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  assert.deepEqual(result.fixedLosses, [{ owner: 'ecaz', normal: 3, elite: 0 }]);
  assert.equal(result.casualties!.options.length, 2);
  assert.deepEqual(stoneBurnerCommittedLosses({ ...input, stoneAllocations: { ecaz: 3 } }, 'ecaz'), result.casualties!.options);
  for (const option of result.casualties!.options) assert.equal(6 - option.normal - option.elite, 3);
});

void test('temporary elite roles commit physical normal totals and never manufacture starred losses', () => {
  const input = fixture(); input.attacker.forces = { normal: 6, elite: 0, temporaryElite: 2, eliteStrength: 2, freeSupport: false };
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }] });
  const result = quoteBattleResolution({ ...input, stoneAllocations: { a: 3 } });
  assert.deepEqual(result.casualties!.options, [{ normal: 3, elite: 0, paidNormal: 1, paidElite: 0 }]);
});

void test('native World and reconstructed visible Richese pools retain the same physical total rule', () => {
  const input = fixture(); input.territory = 'homeworld:emperor';
  input.homeworld = { native: 'a', card: 'kaitain', side: 'high', nativeForces: { normal: 4, elite: 2 } };
  input.voters = [input.voters[0]];
  assert.deepEqual(quoteStoneBurnerAllocations(input), { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }] });
  assert.equal(quoteBattleResolution({ ...input, stoneAllocations: { a: 3 } }).winner, 'a');
  const revealed = fixture();
  revealed.defender = combatant('d', 'richese', ordinary(4), 1, 1);
  revealed.defender.noFieldAtTerritory = false;
  revealed.participants = [revealed.attacker, revealed.defender].map(side => ({ id: side.id, faction: side.faction, noFieldAtTerritory: false }));
  assert.deepEqual(quoteStoneBurnerAllocations(revealed), { choices: [{ player: 'a', owner: 'a', totals: [2, 3, 4] }] });
});

void test('successful traitors and Lasgun–shield explosions have no allocation opportunity', () => {
  const input = fixture();
  input.voters = input.voters.map((voter, index) => index ? voter : {
    ...voter, called: true, traitors: [input.defender.leader!.id] });
  assert.equal(quoteStoneBurnerAllocations(input), null);
  assert.equal(quoteBattleResolution(input).result, 'traitor');
  const explosion = fixture(), cards = catalog(), shield = cards.find(card => card.kind === 'shield')!, lasgun = cards.find(card => card.kind === 'lasgun')!;
  explosion.attacker.hand = [...explosion.attacker.hand, shield]; explosion.attacker.plan.defense = shield.id;
  explosion.defender.hand = [lasgun]; explosion.defender.plan.weapon = lasgun.id;
  assert.equal(quoteStoneBurnerAllocations(explosion), null);
  assert.equal(quoteBattleResolution(explosion).result, 'explosion');
});

void test('invalid totals, unrelated keys, missing modes and unfunded support fail before offering an allocation', () => {
  const input = fixture();
  const invalid: Record<string, number>[] = [{ a: 1 }, { a: 2.5 }, { d: 3 }, { unrelated: 2 }];
  for (const stoneAllocations of invalid)
    assert.throws(() => quoteStoneBurnerAllocations({ ...input, stoneAllocations }), BattleResolutionQuoteError);
  assert.throws(() => quoteStoneBurnerAllocations({ ...input, stoneAllocations: Object.create({ a: 3 }) as Record<string, number> }), /original side players/);
  input.attacker.spice = 0;
  assert.throws(() => quoteStoneBurnerAllocations(input), /funded/);
  input.attacker.spice = 10; delete input.attacker.stoneMode;
  assert.throws(() => quoteStoneBurnerAllocations(input), /revealed mode/);
});

void test('new-battle precommit opt-in removes only the old timing boundary and retains invalid-force/dial/zero-spice plan checks', () => {
  const input = fixture();
  assert.ok(stoneBurnerPlanBlock(input.attacker.forces, 3, 1, input.defender.forces, 'attacker'));
  assert.equal(stoneBurnerPlanBlock(input.attacker.forces, 3, 1, input.defender.forces, 'attacker', 'attacker', undefined, true), null);
  assert.ok(stoneBurnerPlanBlock(input.attacker.forces, 99, 1, input.defender.forces, 'attacker', 'attacker', undefined, true));
  assert.ok(stoneBurnerPlanBlock({ ...input.attacker.forces, normal: -1 }, 3, 1, input.defender.forces, 'attacker', 'attacker', undefined, true));
  assert.ok(stoneBurnerCompulsionBlock(ordinary(0), emperor, 'attacker'));
  assert.equal(stoneBurnerCompulsionBlock(ordinary(0), emperor, 'attacker', 'attacker', undefined, true), null);
});
