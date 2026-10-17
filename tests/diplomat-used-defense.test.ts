import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, RuleError, viewGame, type Game } from '../game/engine';
import {
  completedAdvancedNativeSkillsGame, stageAdvancedNativeSkillBattle,
  openAdvancedNativeSkillBattle, finishAdvancedNativeSkillAftermath,
} from './fixture-advanced-native-skills';
import { takeHarassCard } from './fixture-harass-withdraw';

const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;

/** Conserved rule-unit position after original setup, not a played phase history. */
function usedDefense(source: 'late' | 'shield' = 'late', legacy = false) {
  let game = stageAdvancedNativeSkillBattle(completedAdvancedNativeSkillsGame({
    family: 'richese', requestedSkill: 'diplomat', skillOwner: 'emperor', opponents: ['guild'],
  }), 'emperor', 'guild');
  const worthless = takeHarassCard(game, 'emperor', game.deck.find(c => c.kind === 'worthless')!.id);
  const ownPoison = source === 'late'
    ? takeHarassCard(game, 'emperor', game.deck.find(c => c.kind === 'poison')!.id) : null;
  const enemyPoison = takeHarassCard(game, 'guild', game.deck.find(c => c.kind === 'poison')!.id);
  const shield = source === 'shield'
    ? takeHarassCard(game, 'guild', game.deck.find(c => c.kind === 'shield')!.id) : null;
  const index = game.richeseCache!.findIndex(c => c.effect === 'portableSnooper');
  assert.ok(index >= 0);
  const portable = game.richeseCache!.splice(index, 1)[0];
  const lateOwner = source === 'late' ? 'guild' : 'emperor';
  player(game, lateOwner).hand.push(portable);
  game = openAdvancedNativeSkillBattle(game, 'emperor', 'guild');
  if (legacy) game.battle!.diplomatDefenseVersion = 2;
  game = applyAction(game, 'emperor', { type: 'battlePlan', leader: 'emperor-0', dial: 0, support: 0,
    weapon: ownPoison?.id ?? worthless.id, defense: ownPoison ? worthless.id : null });
  game = applyAction(game, 'guild', { type: 'battlePlan', leader: 'guild-1', dial: 0, support: 0,
    weapon: enemyPoison.id, defense: shield?.id });
  return { game, worthless: worthless.id, portable: portable.id, lateOwner };
}

function copy(game: Game, card: string | null) {
  assert.ok(game.decision?.kind === 'diplomatDefense');
  return applyAction(game, 'emperor', { type: 'decision', event: game.decision!.event, card });
}

void test('a newly used late defense offers its actual role without reopening an earlier false traitor vote', () => {
  const f = usedDefense();
  let game = applyAction(f.game, 'emperor', { type: 'traitorCall', call: false });
  game = applyAction(game, 'guild', { type: 'portableSnooper', event: game.battle!.event, card: f.portable });
  assert.equal(game.decision?.kind, 'diplomatDefense');
  assert.equal(game.battle!.traitorCalls.emperor, false);
  assert.equal(game.battle!.diplomatDefense!.source, f.portable);
  assert.equal(game.battle!.diplomatDefense!.kind, 'snooper');
  assert.ok(viewGame(game, 'emperor').battle!.cards.some(c => c.id === f.portable));
  const plans = structuredClone(game.battle!.plans);
  game = copy(game, f.worthless);
  assert.deepEqual(game.battle!.plans, plans);
  const beforeDuplicate = structuredClone(game);
  assert.throws(() => applyAction(game, 'emperor', { type: 'traitorCall', call: false }), RuleError);
  assert.deepEqual(game, beforeDuplicate);
  game = finishAdvancedNativeSkillAftermath(applyAction(game, 'guild', { type: 'traitorCall', call: false }));
  assert.equal(player(game, 'emperor').leaders.find(l => l.id === 'emperor-0')!.dead, false);
  assert.equal(game.discard.filter(c => c.id === f.worthless).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.portable).length, 1);
});

void test('declining an earlier copy preserves a later own Portable Snooper without reopening the skill', () => {
  const f = usedDefense('shield');
  let game = copy(f.game, null);
  game = applyAction(game, 'emperor', { type: 'portableSnooper', event: game.battle!.event, card: f.portable });
  assert.equal(game.decision, null);
  assert.equal(game.battle!.diplomatDefense!.stage, 'declined');
  assert.equal(game.battle!.lateDefense!.emperor, f.portable);
  assert.ok(viewGame(game, 'guild').battle!.cards.some(c => c.id === f.portable));
  game = applyAction(game, 'emperor', { type: 'traitorCall', call: false });
  game = finishAdvancedNativeSkillAftermath(applyAction(game, 'guild', { type: 'traitorCall', call: false }));
  assert.equal(player(game, 'emperor').leaders.find(l => l.id === 'emperor-0')!.dead, false);
  assert.ok(player(game, 'emperor').hand.some(c => c.id === f.worthless), 'A declined copy adds no mandatory Worthless disposal');
});

void test('a copied Diplomat defense cannot gain a second actual defense through the late slot', () => {
  const f = usedDefense('shield');
  const game = copy(f.game, f.worthless), before = structuredClone(game);
  assert.throws(() => applyAction(game, 'emperor', {
    type: 'portableSnooper', event: game.battle!.event, card: f.portable,
  }), RuleError);
  assert.deepEqual(game, before);
});

void test('a successful traitor declaration does not open a fresh late-defense copy opportunity', () => {
  const f = usedDefense();
  const owner = player(f.game, 'emperor'), identity = 'guild-1';
  if (!owner.traitors.includes(identity)) {
    const returned = owner.traitors[0], donor = f.game.players.find(p => p.traitors.includes(identity));
    if (donor) donor.traitors[donor.traitors.indexOf(identity)] = returned;
    else {
      const index = f.game.traitorReserve!.indexOf(identity); assert.ok(index >= 0);
      f.game.traitorReserve![index] = returned;
    }
    owner.traitors[0] = identity;
  }
  let game = applyAction(f.game, 'emperor', { type: 'traitorCall', call: true });
  game = applyAction(game, 'guild', { type: 'portableSnooper', event: game.battle!.event, card: f.portable });
  assert.equal(game.battle!.traitorCalls.emperor, true);
  assert.equal(game.battle!.diplomatDefense, undefined);
  assert.equal(game.decision, null);
});

void test('an already-open printed-only capability keeps its original late-defense continuation', () => {
  const f = usedDefense('late', true);
  let game = applyAction(f.game, 'emperor', { type: 'traitorCall', call: false });
  game = applyAction(game, 'guild', { type: 'portableSnooper', event: game.battle!.event, card: f.portable });
  assert.equal(game.battle!.traitorCalls.emperor, false);
  assert.equal(game.battle!.diplomatDefense, undefined);
  assert.equal(game.decision, null);
});
