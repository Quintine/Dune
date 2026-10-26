import assert from 'node:assert/strict';
import test from 'node:test';
import { VOICE_KINDS } from '../game/battle-cards';
import {
  BattlePowerQuestionError,
  battlePowerMatches,
  battlePowerOf,
  nativeBattlePowerOpportunity,
  parseBattlePowerClaim,
  type BattlePowerClaim,
  type BattlePowerDeclaration,
  type NativeBattlePowerGame,
} from '../game/battle-power-question';

function game(): NativeBattlePowerGame {
  return { status: 'playing', phase: 6, players: [
    { id: 'bg', faction: 'beneGesserit', ally: null }, { id: 'a', faction: 'atreides', ally: null },
    { id: 'e', faction: 'emperor', ally: null },
  ], battle: { event: 'battle:1', territory: 'carthag', attacker: 'bg', defender: 'a', revealed: false,
    prepared: true, preparation: { kind: 'voice', owner: 'bg', beneficiary: 'bg' } } };
}

void test('native battle-power claims parse exact declaration predicates without hidden values or groups', () => {
  const claims: BattlePowerClaim[] = [{ kind: 'voice', use: true }, { kind: 'voice', use: false },
    { kind: 'prescience', use: true }, { kind: 'prescience', use: false },
    ...VOICE_KINDS.map(cardType => ({ kind: 'voiceCommand' as const, cardType, must: false })),
    ...(['leader', 'weapon', 'defense', 'dial'] as const).map(field => ({ kind: 'prescienceField' as const, field }))];
  for (const claim of claims) {
    assert.deepEqual(parseBattlePowerClaim(claim), claim);
    assert.notEqual(parseBattlePowerClaim(claim), claim);
    assert.equal(battlePowerOf(claim), claim.kind === 'voice' || claim.kind === 'voiceCommand' ? 'voice' : 'prescience');
  }
  for (const claim of [null, [], {}, { kind: 'voice', use: 'yes' }, { kind: 'voice', use: true, source: 'battle:1' },
    { kind: 'voiceCommand', cardType: 'unknown', must: true }, { kind: 'voiceCommand', cardType: 'shield', must: 1 },
    { kind: 'prescienceField', field: 'support' }, { kind: 'prescienceField', field: 'weapon', value: 'Lasgun' },
    { kind: 'and', terms: [{ kind: 'voice', use: true }, { kind: 'voice', use: false }] }])
    assert.throws(() => parseBattlePowerClaim(claim), BattlePowerQuestionError);
});

void test('actual Voice use, exact command and explicit Decline match independently of later effect success', () => {
  const declaration: BattlePowerDeclaration = { power: 'voice', use: true, cardType: 'projectile', must: true };
  assert.equal(battlePowerMatches({ kind: 'voice', use: true }, declaration), true);
  assert.equal(battlePowerMatches({ kind: 'voice', use: false }, declaration), false);
  assert.equal(battlePowerMatches({ kind: 'voiceCommand', cardType: 'projectile', must: true }, declaration), true);
  assert.equal(battlePowerMatches({ kind: 'voiceCommand', cardType: 'projectile', must: false }, declaration), false);
  assert.equal(battlePowerMatches({ kind: 'voiceCommand', cardType: 'poison', must: true }, declaration), false);
  const decline: BattlePowerDeclaration = { power: 'voice', use: false };
  assert.equal(battlePowerMatches({ kind: 'voice', use: false }, decline), true);
  assert.equal(battlePowerMatches({ kind: 'voiceCommand', cardType: 'projectile', must: true }, decline), false);
  assert.equal(battlePowerMatches({ kind: 'prescience', use: false }, decline), false);
});

void test('Prescience predicates refer to use or requested field, never the inspected answer', () => {
  for (const field of ['leader', 'weapon', 'defense', 'dial'] as const) {
    const declaration: BattlePowerDeclaration = { power: 'prescience', use: true, field };
    assert.equal(battlePowerMatches({ kind: 'prescience', use: true }, declaration), true);
    assert.equal(battlePowerMatches({ kind: 'prescienceField', field }, declaration), true);
    assert.equal(battlePowerMatches({ kind: 'voice', use: true }, declaration), false);
    assert.equal(battlePowerMatches({ kind: 'prescience', use: false }, declaration), false);
  }
  assert.equal(battlePowerMatches({ kind: 'prescienceField', field: 'weapon' },
    { power: 'prescience', use: true, field: 'dial' }), false);
  assert.equal(battlePowerMatches({ kind: 'prescience', use: false }, { power: 'prescience', use: false }), true);
  for (const declaration of [null, {}, { power: 'voice', use: false, cardType: 'shield' },
    { power: 'voice', use: true, cardType: 'unknown', must: false }, { power: 'prescience', use: true, field: 'support' },
    { power: 'prescience', use: true, field: 'weapon', value: 'Lasgun' }, { power: 'voice', use: true, cardType: 'shield', must: true, prevented: true }])
    assert.throws(() => battlePowerMatches({ kind: 'voice', use: true }, declaration as never), BattlePowerQuestionError);
});

void test('actual prepared native Voice and ordered future Prescience retain distinct owners, sides and readiness', () => {
  const source = game(), before = structuredClone(source);
  assert.equal(source.battle!.prepared, true);
  assert.deepEqual(nativeBattlePowerOpportunity(source, 'bg', 'voice'), { event: 'battle:1', territory: 'carthag',
    power: 'voice', owner: 'bg', beneficiary: 'bg', target: 'a', ready: true });
  assert.deepEqual(nativeBattlePowerOpportunity(source, 'a', 'prescience'), { event: 'battle:1', territory: 'carthag',
    power: 'prescience', owner: 'a', beneficiary: 'a', target: 'bg', ready: false });
  source.battle!.preparation = { kind: 'prescience', owner: 'a', beneficiary: 'a' };
  assert.equal(nativeBattlePowerOpportunity(source, 'a', 'prescience')!.ready, true);
  assert.equal(nativeBattlePowerOpportunity(source, 'bg', 'voice'), null);
  assert.deepEqual(before.battle!.preparation, { kind: 'voice', owner: 'bg', beneficiary: 'bg' });
});

void test('native power quotation supports actual reciprocal allied beneficiaries without borrowing their faction identity', () => {
  const source = game();
  source.players = source.players.map(player => ({ ...player, ally: player.id === 'bg' ? 'e' : player.id === 'e' ? 'bg' : null }));
  source.battle!.attacker = 'e';
  source.battle!.preparation = { kind: 'voice', owner: 'bg', beneficiary: 'e' };
  assert.deepEqual(nativeBattlePowerOpportunity(source, 'bg', 'voice'), { event: 'battle:1', territory: 'carthag',
    power: 'voice', owner: 'bg', beneficiary: 'e', target: 'a', ready: true });
  assert.equal(nativeBattlePowerOpportunity(source, 'e', 'voice'), null);
  source.players = source.players.map(player => player.id === 'e' ? { ...player, ally: null } : player);
  assert.equal(nativeBattlePowerOpportunity(source, 'bg', 'voice'), null);
});

void test('modal and Truth priority retain the original source with readiness suspended while blocked use still permits Decline', () => {
  for (const blocker of ['response', 'decision', 'phaseOpening', 'truthtrance', 'pendingTreacheryDiscard'] as const) {
    const source = { ...game(), [blocker]: {} };
    const quote = nativeBattlePowerOpportunity(source, 'bg', 'voice');
    assert.equal(quote!.event, 'battle:1');
    assert.equal(quote!.ready, false);
  }
  const blocked = game();
  blocked.battle!.preparation!.blocked = 'This Voice use is blocked.';
  assert.equal(nativeBattlePowerOpportunity(blocked, 'bg', 'voice')!.ready, true,
    'Decline remains an executable owned choice; use legality is a separate engine quote');
});

void test('borrowed powers, completed declarations, foreign owners and crossed public sources create no native opportunity', () => {
  for (const kind of ['nexusVoice', 'prescienceAnswer', 'nexusPrescienceAnswer']) {
    const source = game(); source.battle!.preparation!.kind = kind;
    assert.equal(nativeBattlePowerOpportunity(source, 'bg', 'voice'), null);
    assert.equal(nativeBattlePowerOpportunity(source, 'a', 'prescience'), null);
  }
  for (const mutate of [
    (source: NativeBattlePowerGame) => { source.status = 'finished'; },
    (source: NativeBattlePowerGame) => { source.phase = 5; },
    (source: NativeBattlePowerGame) => { source.battle!.revealed = true; },
    (source: NativeBattlePowerGame) => { source.battle!.event = ''; },
    (source: NativeBattlePowerGame) => { source.battle!.preparation!.owner = 'e'; },
    (source: NativeBattlePowerGame) => { source.battle!.preparation!.beneficiary = 'a'; },
    (source: NativeBattlePowerGame) => { source.battle!.defender = 'missing'; },
  ]) {
    const source = game(); mutate(source);
    assert.equal(nativeBattlePowerOpportunity(source, 'bg', 'voice'), null);
  }
});

void test('native event/location quotation is pure and accepts original off-board battle locations', () => {
  const source = game(); source.battle!.territory = 'homeworld:guild';
  const before = structuredClone(source);
  assert.equal(nativeBattlePowerOpportunity(source, 'bg', 'voice')!.territory, 'homeworld:guild');
  assert.deepEqual(source, before);
  assert.equal(nativeBattlePowerOpportunity(source, 'other', 'voice'), null);
});
